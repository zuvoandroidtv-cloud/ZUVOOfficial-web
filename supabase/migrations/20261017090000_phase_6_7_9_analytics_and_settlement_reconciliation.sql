-- =============================================================================
-- ZUVO TV CRM — PHASE 6.7.9 FORWARD-ONLY MIGRATION
-- File: 20261017090000_phase_6_7_9_analytics_and_settlement_reconciliation.sql
-- Description:
--   1. Authoritative order-level financial summary function:
--      public.fn_get_order_financial_summary(p_sale_id uuid)
--   2. Reconciled Financial Reporting View:
--      public.vw_sales_financial_analytics (security_invoker = true)
--      Deduplicates refunds: effective_refund = GREATEST(payments_refunded, rma_refunds)
--      Calculates: net_revenue = gross_sales - effective_refunds
--   3. Reconciled Analytics KPIs Function:
--      public.fn_get_advanced_analytics_kpis(...) with reconciled refunds & net_revenue
--   4. Dealer Consignment Return & Settlement Reconciliation:
--      public.fn_process_dealer_consignment_return(p_consignment_item_id uuid, p_reason text)
--   5. Phase 6.7.9 Comprehensive Database Verification Function:
--      public.fn_run_phase_6_7_9_verification()
-- =============================================================================

-- =============================================================================
-- SECTION 1: fn_get_order_financial_summary
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_get_order_financial_summary(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sale RECORD;
    v_completed_total numeric := 0;
    v_refunded_payments_total numeric := 0;
    v_rma_refunds_total numeric := 0;
    v_effective_refund numeric := 0;
    v_gross_collected numeric := 0;
    v_net_paid numeric := 0;
    v_outstanding numeric := 0;
    v_cost_basis numeric := 0;
    v_gross_profit numeric := 0;
    v_gross_margin_pct numeric := 0;
    v_payment_count integer := 0;
    v_rma_count integer := 0;
BEGIN
    IF p_sale_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sale ID required');
    END IF;

    SELECT id, sale_number, subtotal, discount_amount, tax_amount, total_amount, payment_status, sale_status, dealer_id
    INTO v_sale
    FROM public.sales
    WHERE id = p_sale_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sale not found');
    END IF;

    -- Aggregate completed & refunded payments
    SELECT 
        COALESCE(SUM(amount) FILTER (WHERE payment_status IN ('completed', 'success')), 0),
        COALESCE(SUM(amount) FILTER (WHERE payment_status = 'refunded'), 0),
        COUNT(*)
    INTO 
        v_completed_total,
        v_refunded_payments_total,
        v_payment_count
    FROM public.payments
    WHERE sale_id = p_sale_id;

    -- Aggregate RMA sales returns refunds
    SELECT 
        COALESCE(SUM(refund_amount) FILTER (WHERE refund_status IN ('completed', 'approved', 'processed')), 0),
        COUNT(*)
    INTO 
        v_rma_refunds_total,
        v_rma_count
    FROM public.sales_returns
    WHERE sale_id = p_sale_id;

    -- Authoritative deduplication logic established in Phase 6.7.8:
    -- An RMA refund of X recorded in sales_returns and payment rows marked 'refunded' of X
    -- represent the same economic outflow. Effective refund = GREATEST(payments_refunded, rma_refunds).
    v_effective_refund := GREATEST(v_refunded_payments_total, v_rma_refunds_total);
    v_gross_collected := v_completed_total + v_refunded_payments_total;
    v_net_paid := GREATEST(0, v_gross_collected - v_effective_refund);

    -- Outstanding receivable calculation
    IF v_sale.sale_status = 'returned' OR v_sale.sale_status = 'cancelled' THEN
        v_outstanding := 0;
    ELSE
        v_outstanding := GREATEST(0, v_sale.total_amount - v_net_paid);
    END IF;

    -- Cost basis calculation from linked product units
    SELECT COALESCE(SUM(pu.purchase_cost), 0)
    INTO v_cost_basis
    FROM public.sale_items si
    JOIN public.product_units pu ON pu.id = si.product_unit_id
    WHERE si.sale_id = p_sale_id;

    -- Gross Profit and Gross Margin
    v_gross_profit := v_net_paid - v_cost_basis;
    IF v_net_paid > 0 THEN
        v_gross_margin_pct := ROUND((v_gross_profit / v_net_paid) * 100, 2);
    ELSE
        v_gross_margin_pct := 0;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale.id,
        'sale_number', v_sale.sale_number,
        'subtotal', v_sale.subtotal,
        'discount_amount', v_sale.discount_amount,
        'tax_amount', v_sale.tax_amount,
        'total_amount', v_sale.total_amount,
        'sale_status', v_sale.sale_status,
        'payment_status', v_sale.payment_status,
        'gross_collected', v_gross_collected,
        'completed_payments', v_completed_total,
        'refunded_payments', v_refunded_payments_total,
        'rma_refunds', v_rma_refunds_total,
        'effective_refund', v_effective_refund,
        'net_revenue', v_net_paid,
        'cost_basis', v_cost_basis,
        'gross_profit', v_gross_profit,
        'gross_margin_pct', v_gross_margin_pct,
        'outstanding_balance', v_outstanding,
        'is_fully_paid', (v_net_paid >= v_sale.total_amount AND v_sale.total_amount > 0),
        'payment_records_count', v_payment_count,
        'rma_records_count', v_rma_count
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_get_order_financial_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_order_financial_summary(uuid) TO authenticated;

-- Also maintain backward-compatible alias get_sale_payment_summary
CREATE OR REPLACE FUNCTION public.get_sale_payment_summary(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.fn_get_order_financial_summary(p_sale_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_sale_payment_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sale_payment_summary(uuid) TO authenticated;

-- =============================================================================
-- SECTION 2: RECONCILED VIEW vw_sales_financial_analytics
-- =============================================================================
CREATE OR REPLACE VIEW public.vw_sales_financial_analytics WITH (security_invoker = true) AS
WITH daily_sales AS (
  SELECT
    s.sale_date::date AS period_date,
    s.dealer_id,
    COUNT(s.id)::int AS total_orders,
    COUNT(CASE WHEN s.sale_status = 'completed' THEN 1 END)::int AS completed_orders,
    COUNT(CASE WHEN s.sale_status = 'cancelled' THEN 1 END)::int AS cancelled_orders,
    COALESCE(SUM(CASE WHEN s.sale_status != 'cancelled' THEN s.subtotal ELSE 0 END), 0) AS gross_sales,
    COALESCE(SUM(CASE WHEN s.sale_status != 'cancelled' THEN s.discount_amount ELSE 0 END), 0) AS total_discounts,
    COALESCE(SUM(CASE WHEN s.sale_status != 'cancelled' THEN (s.subtotal - s.discount_amount) ELSE 0 END), 0) AS net_sales,
    COALESCE(SUM(CASE WHEN s.sale_status != 'cancelled' THEN s.tax_amount ELSE 0 END), 0) AS total_tax,
    COALESCE(SUM(CASE WHEN s.sale_status != 'cancelled' THEN s.total_amount ELSE 0 END), 0) AS invoiced_total,
    -- Reconcile outstanding receivables directly per sale
    COALESCE(SUM(
      CASE WHEN s.sale_status NOT IN ('cancelled', 'returned') THEN
        GREATEST(0, s.total_amount - COALESCE(
          (SELECT SUM(p.amount) FROM public.payments p WHERE p.sale_id = s.id AND p.payment_status IN ('completed', 'success')), 0
        ))
      ELSE 0 END
    ), 0) AS outstanding_balance
  FROM public.sales s
  GROUP BY s.sale_date::date, s.dealer_id
),
daily_payments AS (
  SELECT
    p.paid_at::date AS period_date,
    s.dealer_id,
    COALESCE(SUM(CASE WHEN p.payment_status IN ('completed', 'success') THEN p.amount ELSE 0 END), 0) AS payments_collected,
    COALESCE(SUM(CASE WHEN p.payment_status = 'refunded' THEN p.amount ELSE 0 END), 0) AS payment_refunds
  FROM public.payments p
  JOIN public.sales s ON s.id = p.sale_id
  WHERE s.sale_status != 'cancelled'
  GROUP BY p.paid_at::date, s.dealer_id
),
daily_returns AS (
  SELECT
    sr.created_at::date AS period_date,
    sr.dealer_id,
    COUNT(sr.id)::int AS returns_count,
    COALESCE(SUM(sr.refund_amount), 0) AS rma_refunds
  FROM public.sales_returns sr
  WHERE sr.refund_status IN ('completed', 'approved', 'processed')
  GROUP BY sr.created_at::date, sr.dealer_id
)
SELECT
  ds.period_date,
  ds.dealer_id,
  d.dealer_name,
  ds.total_orders,
  ds.completed_orders,
  ds.cancelled_orders,
  ds.gross_sales,
  ds.total_discounts,
  ds.net_sales,
  ds.total_tax,
  ds.invoiced_total,
  COALESCE(dp.payments_collected, 0) AS payments_collected,
  ds.outstanding_balance,
  COALESCE(dr.returns_count, 0) AS returns_count,
  -- Reconciled Effective Refund: max(payment_refunds, rma_refunds) to avoid double counting
  GREATEST(COALESCE(dp.payment_refunds, 0), COALESCE(dr.rma_refunds, 0)) AS refunds_value,
  -- Net revenue = gross invoiced minus deduplicated effective refunds
  GREATEST(0, ds.net_sales - GREATEST(COALESCE(dp.payment_refunds, 0), COALESCE(dr.rma_refunds, 0))) AS net_revenue
FROM daily_sales ds
LEFT JOIN public.dealers d ON d.id = ds.dealer_id
LEFT JOIN daily_payments dp ON dp.period_date = ds.period_date AND (dp.dealer_id = ds.dealer_id OR (dp.dealer_id IS NULL AND ds.dealer_id IS NULL))
LEFT JOIN daily_returns dr ON dr.period_date = ds.period_date AND (dr.dealer_id = ds.dealer_id OR (dr.dealer_id IS NULL AND ds.dealer_id IS NULL));

GRANT SELECT ON public.vw_sales_financial_analytics TO authenticated, service_role;

-- =============================================================================
-- SECTION 3: RECONCILED fn_get_advanced_analytics_kpis
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_get_advanced_analytics_kpis(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_dealer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_user_dealer_id uuid;
  v_target_dealer_id uuid;
  v_result jsonb;

  -- Sales vars
  v_gross_sales numeric := 0;
  v_discounts numeric := 0;
  v_net_sales numeric := 0;
  v_tax numeric := 0;
  v_invoiced_total numeric := 0;
  v_total_orders int := 0;
  v_completed_orders int := 0;
  v_cancelled_orders int := 0;
  v_aov numeric := 0;
  v_payments_collected numeric := 0;
  v_payments_refunded numeric := 0;
  v_rma_refunds numeric := 0;
  v_effective_refunds numeric := 0;
  v_outstanding_receivables numeric := 0;
  v_returns_count int := 0;
  v_net_revenue numeric := 0;

  -- Inventory vars
  v_total_units int := 0;
  v_warehouse_available int := 0;
  v_dealer_stock int := 0;
  v_in_transit int := 0;
  v_sold_units int := 0;
  v_total_valuation numeric := 0;
  v_low_stock_variants int := 0;

  -- Procurement vars
  v_total_pos int := 0;
  v_total_po_value numeric := 0;
  v_ordered_qty int := 0;
  v_received_qty int := 0;
  v_pending_qty int := 0;

  -- Service vars
  v_total_tickets int := 0;
  v_open_tickets int := 0;
  v_overdue_tickets int := 0;
  v_resolved_tickets int := 0;
  v_avg_resolution_hours numeric := 0;
  v_fvr_rate numeric := 0;
  v_completed_visits int := 0;
  v_total_service_cost numeric := 0;

  -- Warranty vars
  v_total_warranties int := 0;
  v_active_warranties int := 0;
  v_expired_warranties int := 0;

  -- Consignment vars
  v_consignment_stock int := 0;
  v_consignment_pending_ack int := 0;
  v_consignment_settled int := 0;

  -- CSAT vars
  v_csat_avg_rating numeric := 0;
  v_csat_responses int := 0;
  v_csat_response_rate numeric := 0;
  v_csat_pending_followups int := 0;
BEGIN
  -- Authenticate and determine role
  v_role := public.get_current_user_role();
  v_user_dealer_id := public.get_current_user_dealer_id();

  -- Enforce dealer tenancy isolation
  IF v_role = 'dealer' THEN
    IF v_user_dealer_id IS NULL THEN
      RETURN jsonb_build_object('error', 'Unauthorized dealer account');
    END IF;
    v_target_dealer_id := v_user_dealer_id;
  ELSE
    -- Staff roles
    v_target_dealer_id := p_dealer_id;
  END IF;

  -- 1. SALES KPIS
  SELECT
    COALESCE(SUM(CASE WHEN s.sale_status != 'cancelled' THEN s.subtotal ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.sale_status != 'cancelled' THEN s.discount_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.sale_status != 'cancelled' THEN (s.subtotal - s.discount_amount) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.sale_status != 'cancelled' THEN s.tax_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.sale_status != 'cancelled' THEN s.total_amount ELSE 0 END), 0),
    COUNT(s.id)::int,
    COUNT(CASE WHEN s.sale_status = 'completed' THEN 1 END)::int,
    COUNT(CASE WHEN s.sale_status = 'cancelled' THEN 1 END)::int
  INTO
    v_gross_sales,
    v_discounts,
    v_net_sales,
    v_tax,
    v_invoiced_total,
    v_total_orders,
    v_completed_orders,
    v_cancelled_orders
  FROM public.sales s
  WHERE (v_target_dealer_id IS NULL OR s.dealer_id = v_target_dealer_id)
    AND (p_start_date IS NULL OR s.sale_date::date >= p_start_date)
    AND (p_end_date IS NULL OR s.sale_date::date <= p_end_date);

  IF v_completed_orders > 0 THEN
    v_aov := ROUND(v_invoiced_total / v_completed_orders, 2);
  ELSE
    v_aov := 0;
  END IF;

  -- Payments collected during the requested period (Cash Accounting Basis)
  SELECT 
    COALESCE(SUM(CASE WHEN p.payment_status IN ('completed', 'success') THEN p.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN p.payment_status = 'refunded' THEN p.amount ELSE 0 END), 0)
  INTO 
    v_payments_collected,
    v_payments_refunded
  FROM public.payments p
  JOIN public.sales s ON s.id = p.sale_id
  WHERE (v_target_dealer_id IS NULL OR s.dealer_id = v_target_dealer_id)
    AND (p_start_date IS NULL OR p.paid_at::date >= p_start_date)
    AND (p_end_date IS NULL OR p.paid_at::date <= p_end_date);

  -- Outstanding receivables on active sales
  SELECT COALESCE(SUM(
    GREATEST(0, s.total_amount - COALESCE(
      (SELECT SUM(p.amount) FROM public.payments p WHERE p.sale_id = s.id AND p.payment_status IN ('completed', 'success')), 0
    ))
  ), 0)
  INTO v_outstanding_receivables
  FROM public.sales s
  WHERE (v_target_dealer_id IS NULL OR s.dealer_id = v_target_dealer_id)
    AND s.sale_status NOT IN ('cancelled', 'returned')
    AND (p_start_date IS NULL OR s.sale_date::date >= p_start_date)
    AND (p_end_date IS NULL OR s.sale_date::date <= p_end_date);

  -- Sales returns & RMA refunds
  SELECT
    COUNT(sr.id)::int,
    COALESCE(SUM(CASE WHEN sr.refund_status IN ('completed', 'approved', 'processed') THEN sr.refund_amount ELSE 0 END), 0)
  INTO
    v_returns_count,
    v_rma_refunds
  FROM public.sales_returns sr
  WHERE (v_target_dealer_id IS NULL OR sr.dealer_id = v_target_dealer_id)
    AND (p_start_date IS NULL OR sr.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR sr.created_at::date <= p_end_date);

  -- Reconciled effective refunds: GREATEST of payment refunds and RMA refunds
  v_effective_refunds := GREATEST(v_payments_refunded, v_rma_refunds);
  v_net_revenue := GREATEST(0, v_net_sales - v_effective_refunds);

  -- 2. INVENTORY KPIS
  IF v_role != 'dealer' THEN
    SELECT
      COUNT(pu.id)::int,
      COUNT(CASE WHEN pu.status = 'in_stock' AND pu.warehouse_id IS NOT NULL AND pu.dealer_id IS NULL THEN 1 END)::int,
      COUNT(CASE WHEN pu.status = 'in_stock' AND pu.dealer_id IS NOT NULL THEN 1 END)::int,
      COUNT(CASE WHEN pu.status = 'in_transit' THEN 1 END)::int,
      COUNT(CASE WHEN pu.status = 'sold' THEN 1 END)::int,
      COALESCE(SUM(CASE WHEN pu.status = 'in_stock' AND pu.ownership_type = 'zuvo_owned' THEN pu.purchase_cost ELSE 0 END), 0)
    INTO
      v_total_units,
      v_warehouse_available,
      v_dealer_stock,
      v_in_transit,
      v_sold_units,
      v_total_valuation
    FROM public.product_units pu;

    SELECT COUNT(pv.id)::int
    INTO v_low_stock_variants
    FROM public.product_variants pv
    WHERE (
      SELECT COUNT(pu.id)
      FROM public.product_units pu
      WHERE pu.variant_id = pv.id
        AND pu.status = 'in_stock'
        AND pu.warehouse_id IS NOT NULL
        AND pu.dealer_id IS NULL
    ) <= 5;
  ELSE
    SELECT
      COUNT(pu.id)::int,
      COUNT(CASE WHEN pu.status = 'in_stock' THEN 1 END)::int,
      0,
      COUNT(CASE WHEN pu.status = 'in_transit' THEN 1 END)::int,
      COUNT(CASE WHEN pu.status = 'sold' THEN 1 END)::int,
      0
    INTO
      v_total_units,
      v_dealer_stock,
      v_warehouse_available,
      v_in_transit,
      v_sold_units,
      v_total_valuation
    FROM public.product_units pu
    WHERE pu.dealer_id = v_target_dealer_id;
  END IF;

  -- 3. PROCUREMENT KPIS (Staff only)
  IF v_role NOT IN ('dealer', 'technician') THEN
    SELECT
      COUNT(po.id)::int,
      COALESCE(SUM(po.total_amount), 0),
      COALESCE(SUM(po.ordered_quantity), 0),
      COALESCE(SUM(po.received_quantity), 0),
      COALESCE(SUM(GREATEST(0, po.ordered_quantity - po.received_quantity)), 0)
    INTO
      v_total_pos,
      v_total_po_value,
      v_ordered_qty,
      v_received_qty,
      v_pending_qty
    FROM public.purchase_orders po
    WHERE po.status != 'cancelled'
      AND (p_start_date IS NULL OR po.po_date >= p_start_date)
      AND (p_end_date IS NULL OR po.po_date <= p_end_date);
  END IF;

  -- 4. SERVICE KPIS
  SELECT
    COUNT(st.id)::int,
    COUNT(CASE WHEN st.status IN ('open', 'assigned', 'in_progress') THEN 1 END)::int,
    COUNT(CASE WHEN st.status IN ('open', 'assigned', 'in_progress') AND st.sla_due_at < NOW() THEN 1 END)::int,
    COUNT(CASE WHEN st.status IN ('resolved', 'closed') THEN 1 END)::int,
    COALESCE(ROUND(AVG(
      CASE WHEN st.status IN ('resolved', 'closed') AND st.resolved_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (st.resolved_at - st.created_at)) / 3600.0
      ELSE NULL END
    )::numeric, 1), 0),
    COALESCE(SUM(st.total_cost), 0)
  INTO
    v_total_tickets,
    v_open_tickets,
    v_overdue_tickets,
    v_resolved_tickets,
    v_avg_resolution_hours,
    v_total_service_cost
  FROM public.service_tickets st
  WHERE (p_start_date IS NULL OR st.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR st.created_at::date <= p_end_date);

  SELECT COUNT(sv.id)::int
  INTO v_completed_visits
  FROM public.service_visits sv
  WHERE sv.status = 'completed'
    AND (p_start_date IS NULL OR sv.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR sv.created_at::date <= p_end_date);

  IF v_resolved_tickets > 0 THEN
    SELECT COALESCE(ROUND((COUNT(DISTINCT sv.ticket_id)::numeric / v_resolved_tickets::numeric) * 100.0, 1), 0)
    INTO v_fvr_rate
    FROM public.service_visits sv
    WHERE sv.status = 'completed'
      AND sv.ticket_id IN (
        SELECT id FROM public.service_tickets WHERE status IN ('resolved', 'closed')
      )
    GROUP BY sv.ticket_id
    HAVING COUNT(sv.id) = 1;
    v_fvr_rate := COALESCE(v_fvr_rate, 0);
  END IF;

  -- 5. WARRANTY KPIS
  SELECT
    COUNT(w.id)::int,
    COUNT(CASE WHEN w.status = 'active' AND w.end_date >= CURRENT_DATE THEN 1 END)::int,
    COUNT(CASE WHEN w.status = 'expired' OR (w.status = 'active' AND w.end_date < CURRENT_DATE) THEN 1 END)::int
  INTO
    v_total_warranties,
    v_active_warranties,
    v_expired_warranties
  FROM public.warranties w
  JOIN public.product_units pu ON pu.id = w.product_unit_id
  WHERE (v_target_dealer_id IS NULL OR pu.dealer_id = v_target_dealer_id)
    AND (p_start_date IS NULL OR w.start_date >= p_start_date)
    AND (p_end_date IS NULL OR w.start_date <= p_end_date);

  -- 6. CONSIGNMENT KPIS
  SELECT
    COUNT(CASE WHEN dcs.consignment_status IN ('received', 'available') THEN 1 END)::int,
    COUNT(CASE WHEN dcs.consignment_status = 'dispatched' THEN 1 END)::int,
    COUNT(CASE WHEN dcs.settlement_status = 'settled' THEN 1 END)::int
  INTO
    v_consignment_stock,
    v_consignment_pending_ack,
    v_consignment_settled
  FROM public.dealer_consignment_stock dcs
  WHERE (v_target_dealer_id IS NULL OR dcs.dealer_id = v_target_dealer_id);

  -- 7. CSAT KPIS
  SELECT
    COALESCE(ROUND(AVG(cf.rating)::numeric, 2), 0),
    COUNT(cf.id)::int
  INTO
    v_csat_avg_rating,
    v_csat_responses
  FROM public.csat_feedback cf
  WHERE (p_start_date IS NULL OR cf.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR cf.created_at::date <= p_end_date);

  SELECT COUNT(cf.id)::int
  INTO v_csat_pending_followups
  FROM public.csat_followups cf
  WHERE cf.status IN ('pending', 'in_progress');

  IF v_completed_visits > 0 THEN
    v_csat_response_rate := ROUND((v_csat_responses::numeric / v_completed_visits::numeric) * 100.0, 1);
  ELSE
    v_csat_response_rate := 0;
  END IF;

  -- Build consolidated payload
  v_result := jsonb_build_object(
    'sales', jsonb_build_object(
      'gross_sales', v_gross_sales,
      'discounts', v_discounts,
      'net_sales', v_net_sales,
      'tax', v_tax,
      'invoiced_total', v_invoiced_total,
      'total_orders', v_total_orders,
      'completed_orders', v_completed_orders,
      'cancelled_orders', v_cancelled_orders,
      'aov', v_aov,
      'payments_collected', v_payments_collected,
      'payments_refunded', v_payments_refunded,
      'rma_refunds', v_rma_refunds,
      'effective_refunds', v_effective_refunds,
      'outstanding_receivables', v_outstanding_receivables,
      'returns_count', v_returns_count,
      'refunds_value', v_effective_refunds,
      'net_revenue', v_net_revenue
    ),
    'inventory', jsonb_build_object(
      'total_units', v_total_units,
      'warehouse_available_units', v_warehouse_available,
      'dealer_stock_units', v_dealer_stock,
      'in_transit_units', v_in_transit,
      'sold_units', v_sold_units,
      'total_valuation', v_total_valuation,
      'low_stock_variants_count', v_low_stock_variants
    ),
    'procurement', jsonb_build_object(
      'total_pos', v_total_pos,
      'total_po_value', v_total_po_value,
      'ordered_quantity', v_ordered_qty,
      'received_quantity', v_received_qty,
      'pending_quantity', v_pending_qty
    ),
    'service', jsonb_build_object(
      'total_tickets', v_total_tickets,
      'open_tickets', v_open_tickets,
      'overdue_tickets', v_overdue_tickets,
      'resolved_tickets', v_resolved_tickets,
      'avg_resolution_hours', v_avg_resolution_hours,
      'fvr_rate_pct', v_fvr_rate,
      'completed_visits', v_completed_visits,
      'total_service_cost', v_total_service_cost
    ),
    'warranty', jsonb_build_object(
      'total_registered', v_total_warranties,
      'active_warranties', v_active_warranties,
      'expired_warranties', v_expired_warranties
    ),
    'consignment', jsonb_build_object(
      'active_stock_units', v_consignment_stock,
      'pending_acknowledgment', v_consignment_pending_ack,
      'settled_units', v_consignment_settled
    ),
    'csat', jsonb_build_object(
      'average_rating', v_csat_avg_rating,
      'total_responses', v_csat_responses,
      'response_rate_pct', v_csat_response_rate,
      'pending_followups', v_csat_pending_followups
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_advanced_analytics_kpis(date, date, uuid) TO authenticated, service_role;

-- =============================================================================
-- SECTION 4: DEALER CONSIGNMENT RETURN & SETTLEMENT RECONCILIATION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_process_dealer_consignment_return(
    p_consignment_item_id uuid,
    p_reason text,
    p_to_warehouse_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
    v_cs record;
    v_unit record;
    v_target_wh_id uuid;
    v_credit_reference text;
BEGIN
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'inventory', 'sales') THEN
        RAISE EXCEPTION 'Unauthorized: Only administrative and inventory staff can process dealer consignment returns';
    END IF;

    IF p_consignment_item_id IS NULL THEN
        RAISE EXCEPTION 'Consignment item ID is required';
    END IF;

    -- Concurrency-safe lock on target consignment stock record
    SELECT * INTO v_cs
    FROM public.dealer_consignment_stock
    WHERE id = p_consignment_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Consignment stock record % not found', p_consignment_item_id;
    END IF;

    -- Validate current consignment status
    IF v_cs.consignment_status IN ('returned', 'recalled') THEN
        RAISE EXCEPTION 'Consignment unit is already marked as returned/recalled (status: %)', v_cs.consignment_status;
    END IF;

    IF v_cs.consignment_status = 'sold' THEN
        RAISE EXCEPTION 'Product unit has already been sold. Please process customer RMA sales return first.';
    END IF;

    -- Lock and inspect linked product unit
    SELECT * INTO v_unit
    FROM public.product_units
    WHERE id = v_cs.product_unit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Linked product unit % not found', v_cs.product_unit_id;
    END IF;

    -- Determine target warehouse
    IF p_to_warehouse_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = p_to_warehouse_id) THEN
            RAISE EXCEPTION 'Specified target warehouse does not exist';
        END IF;
        v_target_wh_id := p_to_warehouse_id;
    ELSE
        -- Fallback to unit's original warehouse or default central warehouse
        v_target_wh_id := COALESCE(v_cs.from_warehouse_id, (SELECT id FROM public.warehouses LIMIT 1));
    END IF;

    -- Generate unique credit adjustment reference memo
    v_credit_reference := 'CR-MEMO-' || to_char(now(), 'YYYYMMDD') || '-' || substr(p_consignment_item_id::text, 1, 8);

    -- 1. Update dealer_consignment_stock status
    UPDATE public.dealer_consignment_stock
    SET consignment_status = 'returned',
        returned_at = now(),
        settlement_status = 'cancelled',
        settlement_reference = v_credit_reference,
        settlement_date = now(),
        notes = concat_ws(' | ', notes, 'Returned to warehouse: ' || p_reason),
        updated_at = now()
    WHERE id = p_consignment_item_id;

    -- 2. Update linked product unit
    UPDATE public.product_units
    SET dealer_id = NULL,
        warehouse_id = v_target_wh_id,
        status = 'in_stock',
        ownership_type = 'zuvo_owned',
        updated_at = now()
    WHERE id = v_cs.product_unit_id;

    -- 3. Record audit movement in dealer_consignment_movements
    INSERT INTO public.dealer_consignment_movements (
        consignment_id,
        product_unit_id,
        dealer_id,
        movement_type,
        previous_consignment_status,
        new_consignment_status,
        previous_ownership_type,
        new_ownership_type,
        performed_by,
        reference_number,
        reason,
        notes
    ) VALUES (
        v_cs.id,
        v_cs.product_unit_id,
        v_cs.dealer_id,
        'CONSIGNMENT_RETURN',
        v_cs.consignment_status,
        'returned',
        v_cs.ownership_type,
        'zuvo_owned',
        auth.uid(),
        v_credit_reference,
        COALESCE(p_reason, 'Consignment unit returned from dealer stock to warehouse'),
        'Credited via memo: ' || v_credit_reference || ' | Restocked to warehouse ' || v_target_wh_id
    );

    -- 4. Record entry in general inventory_transactions
    INSERT INTO public.inventory_transactions (
        product_unit_id,
        transaction_type,
        previous_status,
        new_status,
        reference_note,
        performed_by
    ) VALUES (
        v_cs.product_unit_id,
        'CONSIGNMENT_RETURN',
        v_unit.status,
        'in_stock',
        'Consignment return credit memo: ' || v_credit_reference || ' (' || p_reason || ')',
        auth.uid()
    );

    RETURN jsonb_build_object(
        'success', true,
        'consignment_id', p_consignment_item_id,
        'product_unit_id', v_cs.product_unit_id,
        'dealer_id', v_cs.dealer_id,
        'credit_memo_reference', v_credit_reference,
        'new_status', 'returned',
        'warehouse_id', v_target_wh_id,
        'message', 'Consignment unit returned and credited to dealer ledger'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_process_dealer_consignment_return(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_process_dealer_consignment_return(uuid, text, uuid) TO authenticated;

-- =============================================================================
-- SECTION 5: PHASE 6.7.9 COMPREHENSIVE VERIFICATION FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_run_phase_6_7_9_verification()
RETURNS TABLE(step_number integer, test_case text, result text, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_sum jsonb;
    v_kpis jsonb;
    v_cust_id uuid;
    v_variant_id uuid;
    v_unit_id uuid;
    v_dealer_id uuid;
    v_wh_id uuid;
    v_sale_id uuid;
    v_cons_id uuid;
    v_return_res jsonb;
    v_dup_error boolean := false;
BEGIN
    -- STEP 1: Reconciled Financial Reporting Deduplication Function Test
    BEGIN
        SELECT public.fn_get_order_financial_summary('00000000-0000-0000-0000-000000000000'::uuid) INTO v_order_sum;
        IF (v_order_sum->>'error') = 'Sale not found' THEN
            step_number := 1;
            test_case := 'Order-Level Financial Summary RPC (Safe Missing Sale)';
            result := 'PASS';
            detail := 'public.fn_get_order_financial_summary returned expected non-crashing error payload';
            RETURN NEXT;
        ELSE
            step_number := 1;
            test_case := 'Order-Level Financial Summary RPC (Safe Missing Sale)';
            result := 'FAIL';
            detail := 'Unexpected payload: ' || v_order_sum::text;
            RETURN NEXT;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        step_number := 1;
        test_case := 'Order-Level Financial Summary RPC (Safe Missing Sale)';
        result := 'FAIL';
        detail := SQLERRM;
        RETURN NEXT;
    END;

    -- STEP 2: Mathematical Deduction Verification (net_revenue = gross_sales - effective_refunds)
    BEGIN
        SELECT public.fn_get_advanced_analytics_kpis(NULL, NULL, NULL) INTO v_kpis;
        IF (v_kpis->'sales'->>'net_revenue')::numeric = GREATEST(0, (v_kpis->'sales'->>'net_sales')::numeric - (v_kpis->'sales'->>'effective_refunds')::numeric) THEN
            step_number := 2;
            test_case := 'Reconciled Analytics KPIs Math Consistency';
            result := 'PASS';
            detail := 'net_revenue (' || (v_kpis->'sales'->>'net_revenue') || ') exactly equals net_sales (' || (v_kpis->'sales'->>'net_sales') || ') - effective_refunds (' || (v_kpis->'sales'->>'effective_refunds') || ')';
            RETURN NEXT;
        ELSE
            step_number := 2;
            test_case := 'Reconciled Analytics KPIs Math Consistency';
            result := 'FAIL';
            detail := 'Discrepancy in sales math';
            RETURN NEXT;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        step_number := 2;
        test_case := 'Reconciled Analytics KPIs Math Consistency';
        result := 'FAIL';
        detail := SQLERRM;
        RETURN NEXT;
    END;

    -- STEP 3: Setup Isolated Synthetic Consignment Fixture
    BEGIN
        SELECT id INTO v_wh_id FROM public.warehouses LIMIT 1;
        SELECT id INTO v_dealer_id FROM public.dealers LIMIT 1;
        SELECT id INTO v_variant_id FROM public.product_variants LIMIT 1;

        INSERT INTO public.product_units (
            variant_id, warehouse_id, dealer_id, serial_number, barcode, status, ownership_type, purchase_cost
        ) VALUES (
            v_variant_id, v_wh_id, v_dealer_id, 'QA-P679-SER-001', 'QA-P679-BAR-001', 'in_transit', 'zuvo_owned', 14000.00
        ) RETURNING id INTO v_unit_id;

        INSERT INTO public.dealer_consignment_stock (
            dealer_id, product_unit_id, ownership_type, consignment_status, from_warehouse_id
        ) VALUES (
            v_dealer_id, v_unit_id, 'zuvo_owned', 'available', v_wh_id
        ) RETURNING id INTO v_cons_id;

        step_number := 3;
        test_case := 'Synthetic Consignment Fixture Creation';
        result := 'PASS';
        detail := 'Created test consignment item ' || v_cons_id || ' for unit ' || v_unit_id;
        RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
        step_number := 3;
        test_case := 'Synthetic Consignment Fixture Creation';
        result := 'FAIL';
        detail := SQLERRM;
        RETURN NEXT;
    END;

    -- STEP 4: Process Dealer Consignment Return & Credit Memo
    BEGIN
        SELECT public.fn_process_dealer_consignment_return(v_cons_id, 'Customer canceled reservation - return to central depot', v_wh_id)
        INTO v_return_res;

        IF (v_return_res->>'success')::boolean = true AND (v_return_res->>'credit_memo_reference') LIKE 'CR-MEMO-%' THEN
            step_number := 4;
            test_case := 'Consignment Return & Credit Memo Generation';
            result := 'PASS';
            detail := 'Generated credit memo ' || (v_return_res->>'credit_memo_reference') || ' and restored stock to warehouse';
            RETURN NEXT;
        ELSE
            step_number := 4;
            test_case := 'Consignment Return & Credit Memo Generation';
            result := 'FAIL';
            detail := 'Unexpected return payload: ' || v_return_res::text;
            RETURN NEXT;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        step_number := 4;
        test_case := 'Consignment Return & Credit Memo Generation';
        result := 'FAIL';
        detail := SQLERRM;
        RETURN NEXT;
    END;

    -- STEP 5: Duplicate Return Processing Prevention (Idempotency / Guard Check)
    BEGIN
        v_dup_error := false;
        BEGIN
            PERFORM public.fn_process_dealer_consignment_return(v_cons_id, 'Duplicate attempt');
        EXCEPTION WHEN OTHERS THEN
            v_dup_error := true;
        END;

        IF v_dup_error THEN
            step_number := 5;
            test_case := 'Duplicate Consignment Return Prevention';
            result := 'PASS';
            detail := 'Attempt to process already-returned consignment item was cleanly rejected';
            RETURN NEXT;
        ELSE
            step_number := 5;
            test_case := 'Duplicate Consignment Return Prevention';
            result := 'FAIL';
            detail := 'Duplicate return was allowed without error!';
            RETURN NEXT;
        END IF;
    END;

    -- STEP 6: Serial Number Traceability & Inventory Ledger Entry
    BEGIN
        IF EXISTS (
            SELECT 1 FROM public.dealer_consignment_movements
            WHERE consignment_id = v_cons_id AND movement_type = 'CONSIGNMENT_RETURN'
        ) AND EXISTS (
            SELECT 1 FROM public.inventory_transactions
            WHERE product_unit_id = v_unit_id AND transaction_type = 'CONSIGNMENT_RETURN'
        ) THEN
            step_number := 6;
            test_case := 'Consignment Movement & Inventory Ledger Traceability';
            result := 'PASS';
            detail := 'Movement and inventory transactions recorded with complete serial traceability';
            RETURN NEXT;
        ELSE
            step_number := 6;
            test_case := 'Consignment Movement & Inventory Ledger Traceability';
            result := 'FAIL';
            detail := 'Missing ledger movements';
            RETURN NEXT;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        step_number := 6;
        test_case := 'Consignment Movement & Inventory Ledger Traceability';
        result := 'FAIL';
        detail := SQLERRM;
        RETURN NEXT;
    END;

    -- STEP 7: Baseline Integrity Verification (INV-20261006-08899)
    BEGIN
        IF EXISTS (
            SELECT 1 FROM public.sales
            WHERE sale_number = 'INV-20261006-08899'
              AND total_amount = 22418.82
              AND payment_status = 'paid'
              AND sale_status = 'completed'
        ) THEN
            step_number := 7;
            test_case := 'Baseline Invoice Integrity (INV-20261006-08899)';
            result := 'PASS';
            detail := 'Invoice INV-20261006-08899 matches exact baseline (22418.82 paid completed)';
            RETURN NEXT;
        ELSE
            step_number := 7;
            test_case := 'Baseline Invoice Integrity (INV-20261006-08899)';
            result := 'FAIL';
            detail := 'Baseline invoice was altered or not found!';
            RETURN NEXT;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        step_number := 7;
        test_case := 'Baseline Invoice Integrity (INV-20261006-08899)';
        result := 'FAIL';
        detail := SQLERRM;
        RETURN NEXT;
    END;

    -- STEP 8: Clean Up Synthetic Test Fixtures
    BEGIN
        DELETE FROM public.dealer_consignment_movements WHERE consignment_id = v_cons_id;
        DELETE FROM public.dealer_consignment_stock WHERE id = v_cons_id;
        DELETE FROM public.inventory_transactions WHERE product_unit_id = v_unit_id;
        DELETE FROM public.product_units WHERE id = v_unit_id;

        step_number := 8;
        test_case := 'Synthetic QA Data Cleanup';
        result := 'PASS';
        detail := 'Purged synthetic unit QA-P679-SER-001 and consignment record ' || v_cons_id;
        RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
        step_number := 8;
        test_case := 'Synthetic QA Data Cleanup';
        result := 'FAIL';
        detail := SQLERRM;
        RETURN NEXT;
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_run_phase_6_7_9_verification() TO authenticated, service_role, anon;
