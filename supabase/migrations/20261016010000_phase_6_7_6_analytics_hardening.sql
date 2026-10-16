-- ====================================================================
-- Phase 6.7.6 Hardening: Financial Accuracy & Dealer Isolation
-- Migration: 20261016010000_phase_6_7_6_analytics_hardening.sql
-- ====================================================================

-- 1. HARDEN RLS ON PAYMENTS AND SALES_RETURNS
-- Drop over-permissive true policy on sales_returns
DROP POLICY IF EXISTS "sales_returns_select" ON public.sales_returns;

CREATE POLICY "sales_returns_select_staff" ON public.sales_returns
FOR SELECT TO authenticated
USING (
  get_current_user_role() = ANY (ARRAY['super_admin', 'admin', 'sales', 'inventory', 'service', 'support'])
);

-- Allow dealers to view payments strictly associated with their own sales
DROP POLICY IF EXISTS "crm_payments_select_dealer" ON public.payments;

CREATE POLICY "crm_payments_select_dealer" ON public.payments
FOR SELECT TO authenticated
USING (
  get_current_user_role() = 'dealer' AND sale_id IN (
    SELECT s.id FROM public.sales s WHERE s.dealer_id = get_current_user_dealer_id()
  )
);

-- 2. RECREATE vw_sales_financial_analytics WITH PER-SALE RECEIVABLES CALCULATION
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
    -- Reconcile outstanding receivables directly per sale (never negative, unaffected by other payments)
    COALESCE(SUM(
      CASE WHEN s.sale_status != 'cancelled' THEN
        GREATEST(0, s.total_amount - COALESCE(
          (SELECT SUM(p.amount) FROM public.payments p WHERE p.sale_id = s.id AND p.payment_status IN ('completed', 'success')), 0
        ))
      ELSE 0 END
    ), 0) AS outstanding_balance
  FROM public.sales s
  GROUP BY s.sale_date::date, s.dealer_id
),
daily_payments AS (
  -- Cash collections on this date
  SELECT
    p.paid_at::date AS period_date,
    s.dealer_id,
    COALESCE(SUM(p.amount), 0) AS payments_collected
  FROM public.payments p
  JOIN public.sales s ON s.id = p.sale_id
  WHERE p.payment_status IN ('completed', 'success') AND s.sale_status != 'cancelled'
  GROUP BY p.paid_at::date, s.dealer_id
),
daily_returns AS (
  -- Returns issued on this date
  SELECT
    sr.created_at::date AS period_date,
    sr.dealer_id,
    COUNT(sr.id)::int AS returns_count,
    COALESCE(SUM(sr.refund_amount), 0) AS refunds_value
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
  COALESCE(dr.refunds_value, 0) AS refunds_value,
  (ds.net_sales - COALESCE(dr.refunds_value, 0)) AS net_revenue
FROM daily_sales ds
LEFT JOIN public.dealers d ON d.id = ds.dealer_id
LEFT JOIN daily_payments dp ON dp.period_date = ds.period_date AND (dp.dealer_id = ds.dealer_id OR (dp.dealer_id IS NULL AND ds.dealer_id IS NULL))
LEFT JOIN daily_returns dr ON dr.period_date = ds.period_date AND (dr.dealer_id = ds.dealer_id OR (dr.dealer_id IS NULL AND ds.dealer_id IS NULL));

-- 3. RECREATE vw_inventory_valuation_aging WITH DEALER COST MASKING
CREATE OR REPLACE VIEW public.vw_inventory_valuation_aging WITH (security_invoker = true) AS
SELECT
  pu.warehouse_id,
  w.warehouse_name,
  pu.dealer_id,
  d.dealer_name,
  pu.variant_id,
  pv.product_name AS variant_name,
  pm.model_name,
  pu.status,
  pu.ownership_type,
  COUNT(pu.id)::int AS unit_count,
  -- Mask company purchase cost from dealer role
  CASE WHEN public.get_current_user_role() = 'dealer' THEN 0 ELSE COALESCE(SUM(pu.purchase_cost), 0) END AS total_valuation,
  CASE WHEN public.get_current_user_role() = 'dealer' THEN 0 ELSE ROUND(AVG(COALESCE(pu.purchase_cost, 0)), 2) END AS avg_unit_cost,
  COUNT(CASE WHEN CURRENT_DATE - COALESCE(pu.received_at::date, pu.created_at::date) <= 30 THEN 1 END)::int AS age_0_30_days,
  COUNT(CASE WHEN CURRENT_DATE - COALESCE(pu.received_at::date, pu.created_at::date) BETWEEN 31 AND 60 THEN 1 END)::int AS age_31_60_days,
  COUNT(CASE WHEN CURRENT_DATE - COALESCE(pu.received_at::date, pu.created_at::date) BETWEEN 61 AND 90 THEN 1 END)::int AS age_61_90_days,
  COUNT(CASE WHEN CURRENT_DATE - COALESCE(pu.received_at::date, pu.created_at::date) > 90 THEN 1 END)::int AS age_90_plus_days,
  ROUND(AVG(CURRENT_DATE - COALESCE(pu.received_at::date, pu.created_at::date)), 1) AS avg_age_days
FROM public.product_units pu
LEFT JOIN public.warehouses w ON w.id = pu.warehouse_id
LEFT JOIN public.dealers d ON d.id = pu.dealer_id
LEFT JOIN public.product_variants pv ON pv.id = pu.variant_id
LEFT JOIN public.product_models pm ON pm.id = pv.model_id
GROUP BY
  pu.warehouse_id,
  w.warehouse_name,
  pu.dealer_id,
  d.dealer_name,
  pu.variant_id,
  pv.product_name,
  pm.model_name,
  pu.status,
  pu.ownership_type;

-- 4. RECREATE vw_operational_audit_discrepancies RESTRICTING DEALER ACCESS
CREATE OR REPLACE VIEW public.vw_operational_audit_discrepancies WITH (security_invoker = true) AS
SELECT
  'Inventory Ledger' AS audit_category,
  'warning' AS discrepancy_level,
  'product_units' AS entity_type,
  pu.id::text AS entity_id,
  'Unit ' || COALESCE(pu.serial_number, pu.barcode, pu.id::text) || ' is marked in_stock but lacks warehouse and dealer assignment.' AS issue_description,
  pu.created_at AS detected_at
FROM public.product_units pu
WHERE pu.status = 'in_stock' AND pu.warehouse_id IS NULL AND pu.dealer_id IS NULL
  AND public.get_current_user_role() != 'dealer'

UNION ALL

SELECT
  'Sales vs Inventory' AS audit_category,
  'warning' AS discrepancy_level,
  'product_units' AS entity_type,
  pu.id::text AS entity_id,
  'Unit ' || COALESCE(pu.serial_number, pu.barcode, pu.id::text) || ' is marked sold but has no sale item record.' AS issue_description,
  pu.updated_at AS detected_at
FROM public.product_units pu
WHERE pu.status = 'sold'
  AND NOT EXISTS (SELECT 1 FROM public.sale_items si WHERE si.product_unit_id = pu.id)
  AND public.get_current_user_role() != 'dealer'

UNION ALL

SELECT
  'Procurement Receiving' AS audit_category,
  'critical' AS discrepancy_level,
  'purchase_order_items' AS entity_type,
  poi.id::text AS entity_id,
  'PO item over-received: received ' || poi.received_quantity || ' exceeds ordered ' || poi.ordered_quantity || '.' AS issue_description,
  poi.updated_at AS detected_at
FROM public.purchase_order_items poi
WHERE poi.received_quantity > poi.ordered_quantity
  AND public.get_current_user_role() != 'dealer'

UNION ALL

SELECT
  'Warranty & Quality' AS audit_category,
  'warning' AS discrepancy_level,
  'warranties' AS entity_type,
  w.id::text AS entity_id,
  'Warranty ' || w.warranty_number || ' is active but unit ' || COALESCE(pu.serial_number, pu.barcode) || ' is defective with no open service ticket.' AS issue_description,
  w.updated_at AS detected_at
FROM public.warranties w
JOIN public.product_units pu ON pu.id = w.product_unit_id
WHERE w.status = 'active'
  AND pu.status = 'defective'
  AND NOT EXISTS (
    SELECT 1 FROM public.service_tickets st
    WHERE st.product_unit_id = pu.id AND st.status IN ('open', 'assigned', 'in_progress', 'pending_parts')
  )
  AND public.get_current_user_role() != 'dealer';

-- 5. UPDATE fn_get_advanced_analytics_kpis WITH PER-SALE RECEIVABLES LOGIC
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
  v_outstanding_receivables numeric := 0;
  v_returns_count int := 0;
  v_refunds_value numeric := 0;
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
  SELECT COALESCE(SUM(p.amount), 0)
  INTO v_payments_collected
  FROM public.payments p
  JOIN public.sales s ON s.id = p.sale_id
  WHERE (v_target_dealer_id IS NULL OR s.dealer_id = v_target_dealer_id)
    AND (p_start_date IS NULL OR p.paid_at::date >= p_start_date)
    AND (p_end_date IS NULL OR p.paid_at::date <= p_end_date)
    AND p.payment_status IN ('completed', 'success');

  -- Outstanding receivables on sales belonging to this period (Accrual Receivables Basis)
  SELECT COALESCE(SUM(
    GREATEST(0, s.total_amount - COALESCE(
      (SELECT SUM(p.amount) FROM public.payments p WHERE p.sale_id = s.id AND p.payment_status IN ('completed', 'success')), 0
    ))
  ), 0)
  INTO v_outstanding_receivables
  FROM public.sales s
  WHERE (v_target_dealer_id IS NULL OR s.dealer_id = v_target_dealer_id)
    AND s.sale_status != 'cancelled'
    AND (p_start_date IS NULL OR s.sale_date::date >= p_start_date)
    AND (p_end_date IS NULL OR s.sale_date::date <= p_end_date);

  -- Sales returns & refunds
  SELECT
    COUNT(sr.id)::int,
    COALESCE(SUM(CASE WHEN sr.refund_status IN ('completed', 'approved', 'processed') THEN sr.refund_amount ELSE 0 END), 0)
  INTO
    v_returns_count,
    v_refunds_value
  FROM public.sales_returns sr
  WHERE (v_target_dealer_id IS NULL OR sr.dealer_id = v_target_dealer_id)
    AND (p_start_date IS NULL OR sr.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR sr.created_at::date <= p_end_date);

  v_net_revenue := GREATEST(0, v_net_sales - v_refunds_value);

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
    FROM public.product_units pu
    WHERE (v_target_dealer_id IS NULL OR pu.dealer_id = v_target_dealer_id);

    SELECT COUNT(DISTINCT pv.id)::int
    INTO v_low_stock_variants
    FROM public.product_variants pv
    LEFT JOIN public.product_units pu ON pu.variant_id = pv.id AND pu.status = 'in_stock'
    GROUP BY pv.id
    HAVING COUNT(pu.id) <= 5;
  ELSE
    SELECT
      COUNT(pu.id)::int,
      0,
      COUNT(CASE WHEN pu.status = 'in_stock' THEN 1 END)::int,
      COUNT(CASE WHEN pu.status = 'in_transit' THEN 1 END)::int,
      COUNT(CASE WHEN pu.status = 'sold' THEN 1 END)::int,
      0 -- Strict zero valuation for dealers
    INTO
      v_total_units,
      v_warehouse_available,
      v_dealer_stock,
      v_in_transit,
      v_sold_units,
      v_total_valuation
    FROM public.product_units pu
    WHERE pu.dealer_id = v_target_dealer_id;
  END IF;

  -- 3. PROCUREMENT KPIS (internal only - dealers don't see procurement)
  IF v_role != 'dealer' AND v_target_dealer_id IS NULL THEN
    SELECT
      COUNT(po.id)::int,
      COALESCE(SUM(po.total_amount), 0)
    INTO
      v_total_pos,
      v_total_po_value
    FROM public.purchase_orders po
    WHERE po.status != 'cancelled'
      AND (p_start_date IS NULL OR po.po_date >= p_start_date)
      AND (p_end_date IS NULL OR po.po_date <= p_end_date);

    SELECT
      COALESCE(SUM(poi.ordered_quantity), 0)::int,
      COALESCE(SUM(poi.received_quantity), 0)::int
    INTO
      v_ordered_qty,
      v_received_qty
    FROM public.purchase_order_items poi
    JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
    WHERE po.status != 'cancelled'
      AND (p_start_date IS NULL OR po.po_date >= p_start_date)
      AND (p_end_date IS NULL OR po.po_date <= p_end_date);

    v_pending_qty := GREATEST(0, v_ordered_qty - v_received_qty);
  END IF;

  -- 4. SERVICE OPERATIONS KPIS
  SELECT
    COUNT(st.id)::int,
    COUNT(CASE WHEN st.status IN ('open', 'assigned', 'in_progress', 'pending_parts') THEN 1 END)::int,
    COUNT(CASE WHEN st.status IN ('open', 'assigned', 'in_progress', 'pending_parts')
      AND NOW() - st.opened_at > (
        CASE st.priority
          WHEN 'urgent' THEN INTERVAL '24 hours'
          WHEN 'high' THEN INTERVAL '48 hours'
          ELSE INTERVAL '72 hours'
        END
      ) THEN 1 END)::int,
    COUNT(CASE WHEN st.status IN ('resolved', 'closed') THEN 1 END)::int,
    ROUND(AVG(CASE WHEN st.status IN ('resolved', 'closed') AND st.opened_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (COALESCE(st.resolved_at, st.closed_at, NOW()) - st.opened_at)) / 3600.0
    END)::numeric, 1)
  INTO
    v_total_tickets,
    v_open_tickets,
    v_overdue_tickets,
    v_resolved_tickets,
    v_avg_resolution_hours
  FROM public.service_tickets st
  WHERE (v_target_dealer_id IS NULL OR st.dealer_id = v_target_dealer_id)
    AND (p_start_date IS NULL OR st.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR st.created_at::date <= p_end_date);

  IF v_resolved_tickets > 0 THEN
    SELECT ROUND(
      (COUNT(CASE WHEN (
        SELECT COUNT(*) FROM public.service_visits sv
        WHERE sv.service_ticket_id = st.id AND sv.status = 'completed'
      ) = 1 THEN 1 END)::numeric / v_resolved_tickets::numeric) * 100.0, 1
    )
    INTO v_fvr_rate
    FROM public.service_tickets st
    WHERE (v_target_dealer_id IS NULL OR st.dealer_id = v_target_dealer_id)
      AND st.status IN ('resolved', 'closed')
      AND (p_start_date IS NULL OR st.created_at::date >= p_start_date)
      AND (p_end_date IS NULL OR st.created_at::date <= p_end_date);
  END IF;

  SELECT COUNT(sv.id)::int
  INTO v_completed_visits
  FROM public.service_visits sv
  JOIN public.service_tickets st ON st.id = sv.service_ticket_id
  WHERE (v_target_dealer_id IS NULL OR st.dealer_id = v_target_dealer_id)
    AND sv.status = 'completed'
    AND (p_start_date IS NULL OR sv.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR sv.created_at::date <= p_end_date);

  SELECT COALESCE(SUM(scost.amount), 0)
  INTO v_total_service_cost
  FROM public.service_costs scost
  JOIN public.service_tickets st ON st.id = scost.service_ticket_id
  WHERE (v_target_dealer_id IS NULL OR st.dealer_id = v_target_dealer_id)
    AND (p_start_date IS NULL OR scost.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR scost.created_at::date <= p_end_date);

  -- 5. WARRANTY KPIS
  SELECT
    COUNT(w.id)::int,
    COUNT(CASE WHEN w.status = 'active' AND w.warranty_end_date >= CURRENT_DATE THEN 1 END)::int,
    COUNT(CASE WHEN w.status = 'expired' OR w.warranty_end_date < CURRENT_DATE THEN 1 END)::int
  INTO
    v_total_warranties,
    v_active_warranties,
    v_expired_warranties
  FROM public.warranties w
  WHERE (v_target_dealer_id IS NULL OR w.dealer_id = v_target_dealer_id)
    AND (p_start_date IS NULL OR w.registered_at::date >= p_start_date)
    AND (p_end_date IS NULL OR w.registered_at::date <= p_end_date);

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
    COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0),
    COUNT(r.id)::int
  INTO
    v_csat_avg_rating,
    v_csat_responses
  FROM public.csat_responses r
  JOIN public.csat_surveys s ON s.id = r.survey_id
  WHERE (v_target_dealer_id IS NULL OR s.dealer_id = v_target_dealer_id)
    AND (p_start_date IS NULL OR r.submitted_at::date >= p_start_date)
    AND (p_end_date IS NULL OR r.submitted_at::date <= p_end_date);

  SELECT
    CASE WHEN COUNT(s.id) > 0 THEN
      ROUND((COUNT(CASE WHEN s.status = 'submitted' THEN 1 END)::numeric / COUNT(s.id)::numeric) * 100.0, 1)
    ELSE 0 END
  INTO v_csat_response_rate
  FROM public.csat_surveys s
  WHERE (v_target_dealer_id IS NULL OR s.dealer_id = v_target_dealer_id)
    AND (p_start_date IS NULL OR s.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR s.created_at::date <= p_end_date);

  SELECT COUNT(cf.id)::int
  INTO v_csat_pending_followups
  FROM public.csat_followups cf
  WHERE (v_target_dealer_id IS NULL OR cf.dealer_id = v_target_dealer_id)
    AND cf.status IN ('pending', 'in_progress');

  -- Build JSON return payload
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
      'outstanding_receivables', v_outstanding_receivables,
      'returns_count', v_returns_count,
      'refunds_value', v_refunds_value,
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
      'avg_resolution_hours', COALESCE(v_avg_resolution_hours, 0),
      'fvr_rate_pct', COALESCE(v_fvr_rate, 0),
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
