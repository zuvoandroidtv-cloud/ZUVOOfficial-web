-- =============================================================================
-- ZUVO TV CRM — PHASE 7.0
-- NOTIFICATION GATEWAY, DELIVERY RECEIPTS & IDEMPOTENT RECONCILIATION
-- File: 20261017100000_phase_7_0_gateway_and_settlement_hardening.sql
-- =============================================================================

-- 1. Create communication_delivery_receipts Table
-- Stores delivery status receipts and webhook callbacks with idempotency.
CREATE TABLE IF NOT EXISTS public.communication_delivery_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_log_id UUID REFERENCES public.communication_logs(id) ON DELETE SET NULL,
    provider_name TEXT NOT NULL,
    provider_message_id TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    error_code TEXT,
    error_message TEXT,
    raw_payload JSONB,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_receipt_status CHECK (status IN ('delivered', 'sent', 'failed', 'undelivered', 'rejected', 'simulated'))
);

-- Indexes for performance & idempotent lookups
CREATE INDEX IF NOT EXISTS idx_comm_receipts_log_id ON public.communication_delivery_receipts(communication_log_id);
CREATE INDEX IF NOT EXISTS idx_comm_receipts_provider_msg ON public.communication_delivery_receipts(provider_name, provider_message_id);
CREATE INDEX IF NOT EXISTS idx_comm_receipts_idempotency ON public.communication_delivery_receipts(idempotency_key);

-- 2. Enable RLS on communication_delivery_receipts
ALTER TABLE public.communication_delivery_receipts ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies: Authenticated CRM staff can view delivery receipts; Anonymous is blocked
DROP POLICY IF EXISTS "CRM staff view delivery receipts" ON public.communication_delivery_receipts;
CREATE POLICY "CRM staff view delivery receipts"
    ON public.communication_delivery_receipts FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'service', 'sales', 'support'));

REVOKE ALL ON TABLE public.communication_delivery_receipts FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.communication_delivery_receipts TO authenticated;
GRANT ALL ON TABLE public.communication_delivery_receipts TO postgres, service_role;

-- 4. Idempotent Delivery Receipt Ingestion RPC
CREATE OR REPLACE FUNCTION public.fn_log_communication_delivery_receipt(
    p_log_id UUID,
    p_provider_name TEXT,
    p_provider_message_id TEXT,
    p_channel TEXT,
    p_status TEXT,
    p_idempotency_key TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_raw_payload JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_existing_id UUID;
    v_receipt_id UUID;
BEGIN
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'service', 'sales', 'support', 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized: Only CRM administrators can log communication delivery receipts';
    END IF;

    -- 1. Check idempotency if key provided
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM public.communication_delivery_receipts
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'receipt_id', v_existing_id,
                'idempotent_duplicate', true,
                'message', 'Receipt already logged'
            );
        END IF;
    END IF;

    -- 2. Insert receipt
    INSERT INTO public.communication_delivery_receipts (
        communication_log_id,
        provider_name,
        provider_message_id,
        idempotency_key,
        channel,
        status,
        error_message,
        raw_payload
    ) VALUES (
        p_log_id,
        COALESCE(p_provider_name, 'ZUVO_SIMULATION_ADAPTER'),
        COALESCE(p_provider_message_id, 'MSG-' || gen_random_uuid()::text),
        p_idempotency_key,
        COALESCE(p_channel, 'in_app'),
        COALESCE(p_status, 'delivered'),
        p_error_message,
        p_raw_payload
    )
    RETURNING id INTO v_receipt_id;

    -- 3. Synchronize parent communication_logs if log_id provided
    IF p_log_id IS NOT NULL THEN
        UPDATE public.communication_logs
        SET status = CASE 
                WHEN p_status IN ('delivered', 'simulated') THEN 'delivered'
                WHEN p_status = 'sent' THEN 'sent'
                WHEN p_status IN ('failed', 'undelivered', 'rejected') THEN 'failed'
                ELSE status
            END,
            delivered_at = CASE WHEN p_status IN ('delivered', 'simulated') THEN now() ELSE delivered_at END,
            failure_reason = COALESCE(p_error_message, failure_reason),
            updated_at = now()
        WHERE id = p_log_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'receipt_id', v_receipt_id,
        'idempotent_duplicate', false,
        'status', p_status
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_log_communication_delivery_receipt(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_log_communication_delivery_receipt(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
