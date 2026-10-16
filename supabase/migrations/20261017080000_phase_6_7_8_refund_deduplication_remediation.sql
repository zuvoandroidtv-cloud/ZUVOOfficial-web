-- =============================================================================
-- ZUVO TV CRM — PHASE 6.7.8 FORWARD-ONLY REFUND DEDUPLICATION & LEDGER REMEDIATION
-- File: 20261017080000_phase_6_7_8_refund_deduplication_remediation.sql
-- Description:
--   1. Authoritative resolution of refund double-counting defect:
--      - Eliminates double-counting when refunds are recorded in sales_returns (RMA)
--        and/or when payment rows in public.payments are marked 'refunded'.
--      - Deduplicates cash outflows via:
--          v_effective_refund := GREATEST(v_refunded_payments_total, v_rma_refunds_total);
--          v_gross_collected := v_completed_total + v_refunded_payments_total;
--          v_net_received := GREATEST(0, v_gross_collected - v_effective_refund);
--   2. Proper outstanding balance handling for returned orders:
--      - When sales.sale_status = 'returned', customer balance is settled:
--          v_outstanding := 0;
--      - When not returned, outstanding balance is:
--          v_outstanding := GREATEST(0, v_sale.total_amount - v_net_received);
--   3. Maintains non-recursive triggers and strict FOR UPDATE row-locking.
--   4. Preserves least-privilege execute grants and fixed search_path = public.
-- =============================================================================

-- 1. Authoritative Sale Payment Status Synchronization Function (Remediated)
CREATE OR REPLACE FUNCTION public.sync_sale_payment_status(p_sale_id uuid)
RETURNS text
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
    v_net_received numeric := 0;
    v_target_status text;
    v_total_payments_count integer := 0;
    v_rma_count integer := 0;
BEGIN
    IF p_sale_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Concurrency-safe row lock on the target sale
    SELECT id, total_amount, payment_status, sale_status 
    INTO v_sale 
    FROM public.sales 
    WHERE id = p_sale_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Authoritative calculation of payment records
    SELECT 
        COALESCE(SUM(amount) FILTER (WHERE payment_status = 'completed'), 0),
        COALESCE(SUM(amount) FILTER (WHERE payment_status = 'refunded'), 0),
        COUNT(*)
    INTO 
        v_completed_total,
        v_refunded_payments_total,
        v_total_payments_count
    FROM public.payments
    WHERE sale_id = p_sale_id;

    -- Authoritative calculation of RMA returns refunds
    SELECT 
        COALESCE(SUM(refund_amount) FILTER (WHERE refund_status IN ('completed', 'approved', 'processed')), 0),
        COUNT(*)
    INTO 
        v_rma_refunds_total,
        v_rma_count
    FROM public.sales_returns
    WHERE sale_id = p_sale_id;

    -- Canonical deduplication:
    -- If an RMA return refund of ₹X is issued, and the payment tender of ₹X is ALSO marked 'refunded',
    -- the effective refund is max(refunded_payments, rma_refunds), avoiding ₹2X double-count.
    v_effective_refund := GREATEST(v_refunded_payments_total, v_rma_refunds_total);
    v_gross_collected := v_completed_total + v_refunded_payments_total;
    v_net_received := GREATEST(0, v_gross_collected - v_effective_refund);

    -- Status determination adhering to sales_payment_status_check: ('pending', 'partial', 'paid', 'refunded')
    IF v_sale.total_amount <= 0 THEN
        IF v_effective_refund > 0 OR v_sale.sale_status = 'returned' THEN
            v_target_status := 'refunded';
        ELSE
            v_target_status := 'paid';
        END IF;
    ELSIF (v_total_payments_count > 0 OR v_rma_count > 0) AND v_effective_refund > 0 AND v_net_received = 0 THEN
        -- All previously completed payments were refunded
        v_target_status := 'refunded';
    ELSIF v_net_received >= v_sale.total_amount THEN
        -- Fully settled order
        v_target_status := 'paid';
    ELSIF v_net_received > 0 AND v_net_received < v_sale.total_amount THEN
        -- Partial payment (or partial refund with remaining positive balance)
        v_target_status := 'partial';
    ELSE
        -- No completed collections (pending, failed, or zero payments)
        v_target_status := 'pending';
    END IF;

    -- Only update if status has actually changed to prevent recursive triggers and unnecessary writes
    IF v_sale.payment_status IS DISTINCT FROM v_target_status THEN
        UPDATE public.sales
        SET payment_status = v_target_status,
            updated_at = now()
        WHERE id = p_sale_id;
    END IF;

    RETURN v_target_status;
END;
$$;

-- 2. Helper Function: get_sale_payment_summary (Remediated)
CREATE OR REPLACE FUNCTION public.get_sale_payment_summary(p_sale_id uuid)
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
    v_count integer := 0;
BEGIN
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sale not found');
    END IF;

    SELECT 
        COALESCE(SUM(amount) FILTER (WHERE payment_status = 'completed'), 0),
        COALESCE(SUM(amount) FILTER (WHERE payment_status = 'refunded'), 0),
        COUNT(*)
    INTO 
        v_completed_total,
        v_refunded_payments_total,
        v_count
    FROM public.payments
    WHERE sale_id = p_sale_id;

    SELECT 
        COALESCE(SUM(refund_amount) FILTER (WHERE refund_status IN ('completed', 'approved', 'processed')), 0)
    INTO 
        v_rma_refunds_total
    FROM public.sales_returns
    WHERE sale_id = p_sale_id;

    -- Canonical deduplication
    v_effective_refund := GREATEST(v_refunded_payments_total, v_rma_refunds_total);
    v_gross_collected := v_completed_total + v_refunded_payments_total;
    v_net_paid := GREATEST(0, v_gross_collected - v_effective_refund);

    -- If the order was returned, the customer does not have an outstanding receivable balance
    IF v_sale.sale_status = 'returned' THEN
        v_outstanding := 0;
    ELSE
        v_outstanding := GREATEST(0, v_sale.total_amount - v_net_paid);
    END IF;

    RETURN jsonb_build_object(
        'sale_id', v_sale.id,
        'sale_number', v_sale.sale_number,
        'total_amount', v_sale.total_amount,
        'sale_status', v_sale.sale_status,
        'payment_status', v_sale.payment_status,
        'completed_payments', v_completed_total,
        'refunded_payments', v_refunded_payments_total,
        'rma_refunds', v_rma_refunds_total,
        'effective_refund', v_effective_refund,
        'net_paid', v_net_paid,
        'outstanding_balance', v_outstanding,
        'is_fully_paid', (v_net_paid >= v_sale.total_amount AND v_sale.total_amount > 0),
        'payment_records_count', v_count
    );
END;
$$;

-- 3. Execute Grants
REVOKE EXECUTE ON FUNCTION public.sync_sale_payment_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_sale_payment_status(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_sale_payment_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sale_payment_summary(uuid) TO authenticated;
