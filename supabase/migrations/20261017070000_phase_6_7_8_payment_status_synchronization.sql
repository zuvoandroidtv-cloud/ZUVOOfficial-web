-- =============================================================================
-- ZUVO TV CRM — PHASE 6.7.8 FORWARD-ONLY PAYMENT STATUS SYNCHRONIZATION
-- File: 20261017070000_phase_6_7_8_payment_status_synchronization.sql
-- Description:
--   1. Authoritative synchronization of sales.payment_status from public.payments & sales_returns.
--   2. Atomic, concurrency-safe calculation via FOR UPDATE locking.
--   3. Support for partial payments, split payments, multi-tender, and full/partial refunds.
--   4. Trigger-based automatic sync on payments (INSERT, UPDATE, DELETE) and sales_returns.
--   5. Non-recursive execution (only updates sales when target status differs).
--   6. Helper functions: get_sale_payment_summary and record_sale_payment.
-- =============================================================================

-- 1. Authoritative Sale Payment Status Synchronization Function
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
    v_total_refunded numeric := 0;
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

    v_total_refunded := v_refunded_payments_total + v_rma_refunds_total;
    v_net_received := GREATEST(0, v_completed_total - v_rma_refunds_total);

    -- Status determination adhering to sales_payment_status_check: ('pending', 'partial', 'paid', 'refunded')
    IF v_sale.total_amount <= 0 THEN
        IF v_total_refunded > 0 OR v_sale.sale_status = 'returned' THEN
            v_target_status := 'refunded';
        ELSE
            v_target_status := 'paid';
        END IF;
    ELSIF (v_total_payments_count > 0 OR v_rma_count > 0) AND v_total_refunded > 0 AND v_net_received = 0 THEN
        -- All previously completed payments were refunded
        v_target_status := 'refunded';
    ELSIF v_net_received >= v_sale.total_amount THEN
        -- Fully settled order
        v_target_status := 'paid';
    ELSIF v_net_received > 0 AND v_net_received < v_sale.total_amount THEN
        -- Partial payment (or partial refund with remaining positive balance)
        v_target_status := 'partial';
    ELSE
        -- No completed payments (e.g. only pending or failed payments, or zero payments)
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

-- 2. Trigger on public.payments to keep public.sales.payment_status synchronized
CREATE OR REPLACE FUNCTION public.trg_payments_sync_sale_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.sale_id IS NOT NULL THEN
            PERFORM public.sync_sale_payment_status(OLD.sale_id);
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.sale_id IS DISTINCT FROM NEW.sale_id AND OLD.sale_id IS NOT NULL THEN
            PERFORM public.sync_sale_payment_status(OLD.sale_id);
        END IF;
        IF NEW.sale_id IS NOT NULL THEN
            PERFORM public.sync_sale_payment_status(NEW.sale_id);
        END IF;
        RETURN NEW;
    ELSE -- INSERT
        IF NEW.sale_id IS NOT NULL THEN
            PERFORM public.sync_sale_payment_status(NEW.sale_id);
        END IF;
        RETURN NEW;
    END IF;
END;
$$;

CREATE OR REPLACE TRIGGER trg_sync_sale_payment_on_payment_change
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_payments_sync_sale_status();

-- 3. Trigger on public.sales_returns to keep public.sales.payment_status synchronized on RMA refunds
CREATE OR REPLACE FUNCTION public.trg_sales_returns_sync_sale_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.sale_id IS NOT NULL THEN
            PERFORM public.sync_sale_payment_status(OLD.sale_id);
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.sale_id IS DISTINCT FROM NEW.sale_id AND OLD.sale_id IS NOT NULL THEN
            PERFORM public.sync_sale_payment_status(OLD.sale_id);
        END IF;
        IF NEW.sale_id IS NOT NULL THEN
            PERFORM public.sync_sale_payment_status(NEW.sale_id);
        END IF;
        RETURN NEW;
    ELSE -- INSERT
        IF NEW.sale_id IS NOT NULL THEN
            PERFORM public.sync_sale_payment_status(NEW.sale_id);
        END IF;
        RETURN NEW;
    END IF;
END;
$$;

CREATE OR REPLACE TRIGGER trg_sync_sale_payment_on_return_change
AFTER INSERT OR UPDATE OR DELETE ON public.sales_returns
FOR EACH ROW
EXECUTE FUNCTION public.trg_sales_returns_sync_sale_status();

-- 4. Helper Function: get_sale_payment_summary
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

    v_net_paid := GREATEST(0, v_completed_total - v_rma_refunds_total);
    v_outstanding := GREATEST(0, v_sale.total_amount - v_net_paid);

    RETURN jsonb_build_object(
        'sale_id', v_sale.id,
        'sale_number', v_sale.sale_number,
        'total_amount', v_sale.total_amount,
        'payment_status', v_sale.payment_status,
        'completed_payments', v_completed_total,
        'refunded_payments', v_refunded_payments_total,
        'rma_refunds', v_rma_refunds_total,
        'net_paid', v_net_paid,
        'outstanding_balance', v_outstanding,
        'is_fully_paid', (v_net_paid >= v_sale.total_amount AND v_sale.total_amount > 0),
        'payment_records_count', v_count
    );
END;
$$;

-- 5. Helper Function: record_sale_payment
CREATE OR REPLACE FUNCTION public.record_sale_payment(
    p_sale_id uuid,
    p_amount numeric,
    p_payment_method text DEFAULT 'card',
    p_payment_reference text DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
    v_sale RECORD;
    v_payment_id uuid;
    v_summary jsonb;
    v_payment_ref text;
BEGIN
    -- Role check: Only authorized staff can record payments
    v_role := public.get_current_user_role();
    IF v_role IS NULL OR NOT (v_role = ANY (ARRAY['super_admin', 'admin', 'sales'])) THEN
        RAISE EXCEPTION 'Access denied: Insufficient permissions to record payments for role %', COALESCE(v_role, 'none');
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero.';
    END IF;

    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale order not found.';
    END IF;

    v_payment_ref := COALESCE(trim(p_payment_reference), 'PAY-' || to_char(now(), 'YYYYMMDD') || '-' || substring(md5(random()::text), 1, 8));

    -- Insert payment record (trigger trg_sync_sale_payment_on_payment_change will automatically sync sales)
    INSERT INTO public.payments (
        sale_id,
        amount,
        payment_method,
        payment_status,
        payment_reference,
        paid_at,
        notes
    ) VALUES (
        p_sale_id,
        p_amount,
        COALESCE(p_payment_method, 'card'),
        'completed',
        v_payment_ref,
        now(),
        p_notes
    ) RETURNING id INTO v_payment_id;

    SELECT public.get_sale_payment_summary(p_sale_id) INTO v_summary;

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'sale_id', p_sale_id,
        'payment_reference', v_payment_ref,
        'summary', v_summary
    );
END;
$$;

-- 6. Enforce least-privilege execute permissions
REVOKE EXECUTE ON FUNCTION public.sync_sale_payment_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_sale_payment_status(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_sale_payment_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sale_payment_summary(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.record_sale_payment(uuid, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sale_payment(uuid, numeric, text, text, text) TO authenticated;
