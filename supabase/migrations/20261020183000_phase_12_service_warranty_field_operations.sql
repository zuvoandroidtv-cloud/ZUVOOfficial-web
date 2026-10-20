-- =============================================================================
-- ZUVO TV CRM — PHASE 12 (PART 2) MASTER DATABASE MIGRATION
-- Consolidated Enterprise Service, Warranty & Field Operations Intelligence
-- Filename: 20261020183000_phase_12_service_warranty_field_operations.sql
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. EXTEND SERVICE_TICKETS FOR ENTERPRISE RESOLUTION & ROOT CAUSE GOVERNANCE
-- =============================================================================

DO $$
BEGIN
    -- Tenant isolation
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'service_tickets' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.service_tickets ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;

    -- Root cause classification
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'service_tickets' AND column_name = 'root_cause_code'
    ) THEN
        ALTER TABLE public.service_tickets ADD COLUMN root_cause_code TEXT NULL;
    END IF;

    -- Resolution classification
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'service_tickets' AND column_name = 'resolution_type'
    ) THEN
        ALTER TABLE public.service_tickets ADD COLUMN resolution_type TEXT NULL;
    END IF;

    -- Replacement unit linkage
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'service_tickets' AND column_name = 'replacement_unit_id'
    ) THEN
        ALTER TABLE public.service_tickets ADD COLUMN replacement_unit_id UUID NULL REFERENCES public.product_units(id) ON DELETE SET NULL;
    END IF;

    -- First visit resolution indicator
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'service_tickets' AND column_name = 'first_visit_resolution'
    ) THEN
        ALTER TABLE public.service_tickets ADD COLUMN first_visit_resolution BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- Customer confirmation flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'service_tickets' AND column_name = 'customer_confirmed'
    ) THEN
        ALTER TABLE public.service_tickets ADD COLUMN customer_confirmed BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- Total service cost (accumulated)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'service_tickets' AND column_name = 'total_service_cost'
    ) THEN
        ALTER TABLE public.service_tickets ADD COLUMN total_service_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
    END IF;

    -- Warranty covered amount
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'service_tickets' AND column_name = 'warranty_covered_amount'
    ) THEN
        ALTER TABLE public.service_tickets ADD COLUMN warranty_covered_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
    END IF;

    -- Customer charged amount
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'service_tickets' AND column_name = 'customer_charged_amount'
    ) THEN
        ALTER TABLE public.service_tickets ADD COLUMN customer_charged_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
    END IF;
END $$;

-- Extend service_tickets status constraint to cover enterprise lifecycle
ALTER TABLE public.service_tickets DROP CONSTRAINT IF EXISTS service_tickets_status_check;
ALTER TABLE public.service_tickets ADD CONSTRAINT service_tickets_status_check 
CHECK (status IN (
    'open',
    'assigned',
    'scheduled',
    'en_route',
    'in_progress',
    'waiting_parts',
    'revisit_required',
    'resolved',
    'closed',
    'cancelled'
));

-- =============================================================================
-- 2. SEQUENCES FOR SERVICE REPLACEMENTS & CLAIMS
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS public.seq_service_replacement_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 3. TABLE: UNIT REPLACEMENT AUTHORIZATIONS (Controlled TV Swaps)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.service_unit_replacements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    replacement_number TEXT NOT NULL UNIQUE,
    service_ticket_id UUID NOT NULL REFERENCES public.service_tickets(id) ON DELETE RESTRICT,
    original_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    replacement_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL CHECK (
        reason IN ('PANEL_REPEATED_FAILURE', 'UNECONOMIC_REPAIR', 'OUT_OF_BOX_FAILURE', 'CUSTOMER_ESCALATION_APPROVED')
    ),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'DISPATCHED', 'COMPLETED', 'REJECTED')),
    replacement_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (replacement_cost >= 0),
    requested_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_diff_replacement_units CHECK (original_unit_id <> replacement_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_replacements_ticket ON public.service_unit_replacements(service_ticket_id);
CREATE INDEX IF NOT EXISTS idx_replacements_orig ON public.service_unit_replacements(original_unit_id);
CREATE INDEX IF NOT EXISTS idx_replacements_new ON public.service_unit_replacements(replacement_unit_id);
CREATE INDEX IF NOT EXISTS idx_replacements_status ON public.service_unit_replacements(status);

-- =============================================================================
-- 4. SERVER-AUTHORITATIVE RPC: fn_validate_warranty_eligibility
-- Deterministic, database-side validation of TV warranty coverage
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_validate_warranty_eligibility(
    p_serial_number TEXT,
    p_customer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_unit RECORD;
    v_warranty RECORD;
    v_is_eligible BOOLEAN := false;
    v_status TEXT := 'NOT_FOUND';
    v_reason TEXT := 'Chassis serial not found in master registry.';
    v_days_remaining INT := 0;
BEGIN
    -- 1. Find Product Unit
    SELECT * INTO v_unit 
    FROM public.product_units 
    WHERE lower(serial_number) = lower(trim(p_serial_number))
       OR lower(barcode) = lower(trim(p_serial_number));

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'is_eligible', false,
            'status', 'INVALID_SERIAL',
            'reason', 'Serial number does not exist in ZUVO master catalog.',
            'days_remaining', 0
        );
    END IF;

    -- 2. Find Active Warranty
    SELECT * INTO v_warranty 
    FROM public.warranties 
    WHERE product_unit_id = v_unit.id 
    ORDER BY created_at DESC 
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'is_eligible', false,
            'status', 'NO_WARRANTY_RECORD',
            'serial_number', v_unit.serial_number,
            'reason', 'No commercial warranty registered for this chassis unit.',
            'days_remaining', 0
        );
    END IF;

    -- Check date expiration
    IF v_warranty.end_date < CURRENT_DATE THEN
        RETURN jsonb_build_object(
            'is_eligible', false,
            'status', 'EXPIRED',
            'serial_number', v_unit.serial_number,
            'warranty_number', v_warranty.warranty_number,
            'start_date', v_warranty.start_date,
            'end_date', v_warranty.end_date,
            'reason', 'Standard manufacturer warranty expired on ' || v_warranty.end_date,
            'days_remaining', 0
        );
    END IF;

    v_days_remaining := (v_warranty.end_date - CURRENT_DATE);

    RETURN jsonb_build_object(
        'is_eligible', true,
        'status', 'ACTIVE_COVERED',
        'serial_number', v_unit.serial_number,
        'warranty_id', v_warranty.id,
        'warranty_number', v_warranty.warranty_number,
        'warranty_type', v_warranty.warranty_type,
        'start_date', v_warranty.start_date,
        'end_date', v_warranty.end_date,
        'days_remaining', v_days_remaining,
        'parts_covered', true,
        'labour_covered', true,
        'reason', 'Valid active warranty verified with ' || v_days_remaining || ' days remaining.'
    );
END;
$$;

-- =============================================================================
-- 5. SERVER-AUTHORITATIVE RPC: fn_assign_technician_dispatch
-- Assigns field service visit with conflict & workload detection
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_assign_technician_dispatch(
    p_ticket_id UUID,
    p_technician_id UUID,
    p_scheduled_at TIMESTAMPTZ,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ticket RECORD;
    v_tech RECORD;
    v_visit_id UUID;
    v_conflict_count INT;
BEGIN
    SELECT * INTO v_ticket FROM public.service_tickets WHERE id = p_ticket_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service ticket % not found.', p_ticket_id;
    END IF;

    IF v_ticket.status IN ('resolved', 'closed', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot dispatch technician to ticket in % status.', v_ticket.status;
    END IF;

    SELECT * INTO v_tech FROM public.profiles WHERE id = p_technician_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Technician profile % not found.', p_technician_id;
    END IF;

    -- Check for overlapping scheduled visit (+- 1 hour window)
    SELECT COUNT(*) INTO v_conflict_count
    FROM public.service_visits
    WHERE technician_id = p_technician_id
      AND status IN ('scheduled', 'assigned', 'en_route', 'in_progress')
      AND scheduled_at BETWEEN (p_scheduled_at - INTERVAL '1 hour') AND (p_scheduled_at + INTERVAL '1 hour');

    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'Schedule conflict: Technician already has a dispatched visit within 1 hour of %', p_scheduled_at;
    END IF;

    -- Create Service Visit
    INSERT INTO public.service_visits (
        service_ticket_id, technician_id, scheduled_at, status, visit_type, created_by
    ) VALUES (
        p_ticket_id, p_technician_id, p_scheduled_at, 'assigned', 'repair', p_actor_id
    ) RETURNING id INTO v_visit_id;

    -- Update Ticket State
    UPDATE public.service_tickets
    SET assigned_to = p_technician_id,
        assigned_at = now(),
        status = 'assigned',
        updated_at = now()
    WHERE id = p_ticket_id;

    -- Log update
    INSERT INTO public.service_updates (
        service_ticket_id, status, notes, created_by
    ) VALUES (
        p_ticket_id, 'assigned', 'Dispatched to technician ' || COALESCE(v_tech.full_name, 'Staff'), p_actor_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'visit_id', v_visit_id,
        'ticket_id', p_ticket_id,
        'status', 'assigned',
        'scheduled_at', p_scheduled_at
    );
END;
$$;

-- =============================================================================
-- 6. SERVER-AUTHORITATIVE RPC: fn_approve_unit_replacement
-- Maker-checker authorized full TV chassis replacement for defective unit
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_approve_unit_replacement(
    p_replacement_id UUID,
    p_approver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rep RECORD;
    v_orig_unit RECORD;
    v_new_unit RECORD;
BEGIN
    SELECT * INTO v_rep FROM public.service_unit_replacements WHERE id = p_replacement_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Replacement record % not found.', p_replacement_id;
    END IF;

    IF v_rep.status != 'PENDING' THEN
        RAISE EXCEPTION 'Cannot approve replacement in status %', v_rep.status;
    END IF;

    -- Maker-checker guard
    IF v_rep.requested_by IS NOT NULL AND v_rep.requested_by = p_approver_id THEN
        RAISE EXCEPTION 'Maker-checker violation: Requesting technician cannot approve their own unit replacement.';
    END IF;

    SELECT * INTO v_orig_unit FROM public.product_units WHERE id = v_rep.original_unit_id FOR UPDATE;
    SELECT * INTO v_new_unit FROM public.product_units WHERE id = v_rep.replacement_unit_id FOR UPDATE;

    IF v_new_unit.status != 'in_stock' THEN
        RAISE EXCEPTION 'Replacement unit % is not in_stock (status: %).', v_new_unit.serial_number, v_new_unit.status;
    END IF;

    -- 1. Original Unit -> Return / Depot Refurbishment hold
    UPDATE public.product_units
    SET status = 'returned', qc_status = 'DEFECTIVE_REPLACED', updated_at = now()
    WHERE id = v_rep.original_unit_id;

    -- 2. Replacement Unit -> Sold / Customer Ownership transfer
    UPDATE public.product_units
    SET status = 'sold', updated_at = now()
    WHERE id = v_rep.replacement_unit_id;

    -- 3. Update Replacement Request
    UPDATE public.service_unit_replacements
    SET status = 'APPROVED', approved_by = p_approver_id, approved_at = now(), updated_at = now()
    WHERE id = p_replacement_id;

    -- 4. Update Service Ticket
    UPDATE public.service_tickets
    SET replacement_unit_id = v_rep.replacement_unit_id,
        resolution_type = 'FULL_UNIT_REPLACEMENT',
        updated_at = now()
    WHERE id = v_rep.service_ticket_id;

    -- 5. Record Inventory Transactions
    INSERT INTO public.inventory_transactions (
        product_unit_id, transaction_type, previous_status, new_status,
        movement_reason, reference_note, performed_by
    ) VALUES 
    (v_rep.original_unit_id, 'return', v_orig_unit.status, 'returned', 'Defective Replacement Return', 'Replaced by ' || v_new_unit.serial_number, p_approver_id),
    (v_rep.replacement_unit_id, 'sale', 'in_stock', 'sold', 'Warranty Replacement Dispatch', 'Replaced defective ' || v_orig_unit.serial_number, p_approver_id);

    RETURN jsonb_build_object(
        'success', true,
        'replacement_number', v_rep.replacement_number,
        'original_serial', v_orig_unit.serial_number,
        'replacement_serial', v_new_unit.serial_number,
        'status', 'APPROVED'
    );
END;
$$;

-- =============================================================================
-- 7. REPORTING & INTELLIGENCE VIEWS (security_invoker = true)
-- =============================================================================

CREATE OR REPLACE VIEW public.vw_service_operations_cockpit
WITH (security_invoker = true)
AS
SELECT 
    COUNT(st.id) AS total_cases,
    COUNT(st.id) FILTER (WHERE st.status IN ('open', 'assigned', 'scheduled', 'in_progress', 'waiting_parts')) AS active_cases,
    COUNT(st.id) FILTER (WHERE st.sla_status = 'BREACHED') AS breached_sla_cases,
    COUNT(st.id) FILTER (WHERE st.status = 'waiting_parts') AS parts_waiting_cases,
    COUNT(st.id) FILTER (WHERE st.status IN ('resolved', 'closed')) AS resolved_cases,
    COUNT(st.id) FILTER (WHERE st.first_visit_resolution = true) AS fvr_resolved_cases,
    COALESCE(SUM(st.total_service_cost), 0.00) AS total_service_cost_absorbed,
    COALESCE(SUM(st.warranty_covered_amount), 0.00) AS warranty_reserve_absorbed,
    COALESCE(SUM(st.customer_charged_amount), 0.00) AS customer_paid_recoveries
FROM public.service_tickets st;

CREATE OR REPLACE VIEW public.vw_product_quality_root_cause_intelligence
WITH (security_invoker = true)
AS
SELECT 
    pv.id AS variant_id,
    pv.model_name,
    pv.screen_size,
    COUNT(DISTINCT pu.id) AS deployed_units_count,
    COUNT(DISTINCT st.id) AS failure_ticket_count,
    ROUND(
        (COUNT(DISTINCT st.id)::numeric / NULLIF(COUNT(DISTINCT pu.id), 0)::numeric) * 100, 
        2
    ) AS failure_rate_pct,
    COUNT(DISTINCT ur.id) AS full_unit_replacements_count,
    COALESCE(SUM(st.total_service_cost), 0.00) AS total_warranty_cost,
    CASE 
        WHEN (COUNT(DISTINCT st.id)::numeric / NULLIF(COUNT(DISTINCT pu.id), 0)::numeric) * 100 >= 5.0 THEN 'CRITICAL'
        WHEN (COUNT(DISTINCT st.id)::numeric / NULLIF(COUNT(DISTINCT pu.id), 0)::numeric) * 100 >= 3.0 THEN 'HIGH_FAILURE'
        WHEN (COUNT(DISTINCT st.id)::numeric / NULLIF(COUNT(DISTINCT pu.id), 0)::numeric) * 100 >= 1.5 THEN 'WATCH'
        ELSE 'NORMAL'
    END AS quality_health_tier
FROM public.product_variants pv
LEFT JOIN public.product_units pu ON pv.id = pu.variant_id
LEFT JOIN public.service_tickets st ON pu.id = st.product_unit_id
LEFT JOIN public.service_unit_replacements ur ON st.id = ur.service_ticket_id AND ur.status = 'APPROVED'
GROUP BY pv.id, pv.model_name, pv.screen_size;

-- =============================================================================
-- 8. ENABLE ROW LEVEL SECURITY (RLS) ON ALL NEW TABLES
-- =============================================================================

ALTER TABLE public.service_unit_replacements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view unit replacements" ON public.service_unit_replacements;
CREATE POLICY "Staff view unit replacements" ON public.service_unit_replacements
    FOR SELECT TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'service', 'support', 'technician')
    );

DROP POLICY IF EXISTS "Service managers manage unit replacements" ON public.service_unit_replacements;
CREATE POLICY "Service managers manage unit replacements" ON public.service_unit_replacements
    FOR ALL TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'service')
    );

GRANT SELECT ON public.vw_service_operations_cockpit TO authenticated;
GRANT SELECT ON public.vw_product_quality_root_cause_intelligence TO authenticated;

GRANT EXECUTE ON FUNCTION public.fn_validate_warranty_eligibility(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_assign_technician_dispatch(UUID, UUID, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_approve_unit_replacement(UUID, UUID) TO authenticated;

REVOKE ALL ON public.service_unit_replacements FROM anon;
