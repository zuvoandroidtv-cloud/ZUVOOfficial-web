-- =============================================================================
-- Migration: Phase 7.7 Enterprise Warranty Claim Settlement, Dealer Reimbursement Claims & Extended Warranty Upsell Lifecycle
-- Environment: Supabase PostgreSQL (axpryvuknepqeflymzlv.supabase.co)
-- Timestamp: 2026-10-17 17:00:00 UTC
-- =============================================================================

-- =============================================================================
-- SECTION 1: EXTENDED WARRANTY PLANS CATALOG
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.extended_warranty_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code TEXT UNIQUE NOT NULL,
    plan_name TEXT NOT NULL,
    coverage_months INTEGER NOT NULL CHECK (coverage_months IN (12, 24, 36)),
    screen_size_min INTEGER NOT NULL DEFAULT 24 CHECK (screen_size_min >= 24),
    screen_size_max INTEGER NOT NULL DEFAULT 65 CHECK (screen_size_max >= screen_size_min),
    retail_price NUMERIC(10,2) NOT NULL CHECK (retail_price >= 0),
    dealer_commission_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00 CHECK (dealer_commission_pct >= 0 AND dealer_commission_pct <= 100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    terms_and_conditions TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed standard ZUVO Care plans if not existing
INSERT INTO public.extended_warranty_plans (plan_code, plan_name, coverage_months, screen_size_min, screen_size_max, retail_price, dealer_commission_pct, terms_and_conditions)
VALUES
    ('EW-1YR-COMPACT', 'ZUVO Care 1-Year Shield (24"-32")', 12, 24, 32, 1499.00, 15.00, 'Comprehensive coverage for motherboard, power supply, and remote. Excludes physical panel cracks.'),
    ('EW-1YR-MIDSIZE', 'ZUVO Care 1-Year Shield (43")', 12, 43, 43, 2499.00, 15.00, 'Comprehensive coverage for 4K main board, power inverter, and backlight strips. Excludes physical panel breakage.'),
    ('EW-2YR-PREMIUM', 'ZUVO Care 2-Year Ultra Protection (43"-55")', 24, 43, 55, 4299.00, 18.00, 'Two years of uninterrupted doorstep service, optical backlight repair, and board swaps.'),
    ('EW-3YR-MAXCARE', 'ZUVO Care 3-Year Diamond Armor (50"-65")', 36, 50, 65, 6999.00, 20.00, 'Ultimate 36-month full-spectrum coverage including annual health inspection and zero labor cost.')
ON CONFLICT (plan_code) DO NOTHING;

-- =============================================================================
-- SECTION 2: EXTENDED WARRANTY POLICIES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.extended_warranty_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_number TEXT UNIQUE NOT NULL,
    warranty_id UUID NOT NULL REFERENCES public.warranties(id) ON DELETE RESTRICT,
    plan_id UUID NOT NULL REFERENCES public.extended_warranty_plans(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'CLAIMED')),
    extended_start_date DATE NOT NULL,
    extended_end_date DATE NOT NULL,
    premium_paid NUMERIC(10,2) NOT NULL CHECK (premium_paid >= 0),
    dealer_commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (dealer_commission_amount >= 0),
    payment_reference TEXT NOT NULL,
    sales_channel TEXT NOT NULL CHECK (sales_channel IN ('DIRECT_CRM', 'DEALER_PORTAL', 'CUSTOMER_PORTAL')),
    cancellation_reason TEXT DEFAULT NULL,
    cancelled_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_extended_policy_dates CHECK (extended_end_date > extended_start_date)
);

CREATE INDEX IF NOT EXISTS idx_ew_policies_warranty ON public.extended_warranty_policies(warranty_id);
CREATE INDEX IF NOT EXISTS idx_ew_policies_unit ON public.extended_warranty_policies(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_ew_policies_dealer ON public.extended_warranty_policies(dealer_id);
CREATE INDEX IF NOT EXISTS idx_ew_policies_customer ON public.extended_warranty_policies(customer_id);
CREATE INDEX IF NOT EXISTS idx_ew_policies_status ON public.extended_warranty_policies(status);

-- =============================================================================
-- SECTION 3: ENTERPRISE WARRANTY CLAIMS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.warranty_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_number TEXT UNIQUE NOT NULL,
    warranty_id UUID NOT NULL REFERENCES public.warranties(id) ON DELETE RESTRICT,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    service_ticket_id UUID REFERENCES public.service_tickets(id) ON DELETE SET NULL,
    claim_type TEXT NOT NULL CHECK (claim_type IN ('COMPONENT_REPAIR', 'WHOLE_UNIT_SWAP', 'PANEL_REPLACEMENT', 'COMMERCIAL_REFUND')),
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SETTLED', 'CANCELLED')),
    defect_description TEXT NOT NULL,
    claimed_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (claimed_amount >= 0),
    approved_amount NUMERIC(12,2) DEFAULT NULL CHECK (approved_amount IS NULL OR approved_amount >= 0),
    settlement_type TEXT DEFAULT NULL CHECK (
        settlement_type IS NULL OR 
        settlement_type IN ('PARTS_LABOR_PAYOUT', 'CREDIT_MEMO', 'DIRECT_REPLACEMENT', 'NO_CHARGE_REPAIR', 'REJECTED_OUT_OF_SCOPE')
    ),
    settlement_reference TEXT DEFAULT NULL,
    rejection_reason TEXT DEFAULT NULL,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    settled_at TIMESTAMPTZ DEFAULT NULL,
    idempotency_key TEXT UNIQUE DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wclaim_warranty ON public.warranty_claims(warranty_id);
CREATE INDEX IF NOT EXISTS idx_wclaim_unit ON public.warranty_claims(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_wclaim_status ON public.warranty_claims(status);
CREATE INDEX IF NOT EXISTS idx_wclaim_customer ON public.warranty_claims(customer_id);

-- =============================================================================
-- SECTION 4: DEALER REIMBURSEMENT CLAIMS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.dealer_reimbursement_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reimbursement_number TEXT UNIQUE NOT NULL,
    dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
    warranty_claim_id UUID REFERENCES public.warranty_claims(id) ON DELETE SET NULL,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'AUDITING', 'APPROVED', 'REJECTED', 'CREDITED')),
    labor_cost_claimed NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (labor_cost_claimed >= 0),
    parts_cost_claimed NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (parts_cost_claimed >= 0),
    total_claimed NUMERIC(12,2) GENERATED ALWAYS AS (labor_cost_claimed + parts_cost_claimed) STORED,
    approved_amount NUMERIC(12,2) DEFAULT NULL CHECK (approved_amount IS NULL OR approved_amount >= 0),
    credit_memo_number TEXT UNIQUE DEFAULT NULL,
    rejection_reason TEXT DEFAULT NULL,
    dealer_notes TEXT,
    auditor_notes TEXT,
    audited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    credited_at TIMESTAMPTZ DEFAULT NULL,
    idempotency_key TEXT UNIQUE DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dealer_reimb_dealer ON public.dealer_reimbursement_claims(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_reimb_unit ON public.dealer_reimbursement_claims(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_dealer_reimb_status ON public.dealer_reimbursement_claims(status);

-- =============================================================================
-- SECTION 5: WARRANTY SETTLEMENT AUDIT LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.warranty_settlement_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('WARRANTY_CLAIM', 'DEALER_REIMBURSEMENT', 'EXTENDED_POLICY')),
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    amount NUMERIC(12,2),
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ws_audit_entity ON public.warranty_settlement_audit_logs(entity_type, entity_id);

-- =============================================================================
-- SECTION 6: ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.extended_warranty_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extended_warranty_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_reimbursement_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_settlement_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6.1 Extended Warranty Plans: Public Read-Only for active plans, Staff Write
DROP POLICY IF EXISTS "Public can view active extended warranty plans" ON public.extended_warranty_plans;
CREATE POLICY "Public can view active extended warranty plans"
ON public.extended_warranty_plans FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Staff can manage extended warranty plans" ON public.extended_warranty_plans;
CREATE POLICY "Staff can manage extended warranty plans"
ON public.extended_warranty_plans FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
          AND r.name IN ('super_admin', 'admin', 'service', 'sales')
    )
);

-- 6.2 Extended Warranty Policies: Staff all, Dealers their own
DROP POLICY IF EXISTS "Staff can view all extended warranty policies" ON public.extended_warranty_policies;
CREATE POLICY "Staff can view all extended warranty policies"
ON public.extended_warranty_policies FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
          AND r.name IN ('super_admin', 'admin', 'service', 'sales')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.dealer_id IS NOT NULL
          AND p.dealer_id = extended_warranty_policies.dealer_id
    )
);

DROP POLICY IF EXISTS "Staff can insert extended warranty policies" ON public.extended_warranty_policies;
CREATE POLICY "Staff can insert extended warranty policies"
ON public.extended_warranty_policies FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
          AND r.name IN ('super_admin', 'admin', 'service', 'sales')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.dealer_id IS NOT NULL
          AND p.dealer_id = extended_warranty_policies.dealer_id
    )
);

-- 6.3 Warranty Claims: Staff all, Dealers only units they sold
DROP POLICY IF EXISTS "Staff can view warranty claims" ON public.warranty_claims;
CREATE POLICY "Staff can view warranty claims"
ON public.warranty_claims FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
          AND r.name IN ('super_admin', 'admin', 'service', 'sales')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.warranties w ON w.id = warranty_claims.warranty_id
        WHERE p.id = auth.uid()
          AND p.dealer_id IS NOT NULL
          AND p.dealer_id = w.dealer_id
    )
);

DROP POLICY IF EXISTS "Staff can modify warranty claims" ON public.warranty_claims;
CREATE POLICY "Staff can modify warranty claims"
ON public.warranty_claims FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
          AND r.name IN ('super_admin', 'admin', 'service')
    )
);

-- 6.4 Dealer Reimbursement Claims: Strictly Tenant Isolated
DROP POLICY IF EXISTS "Dealers can view own reimbursement claims" ON public.dealer_reimbursement_claims;
CREATE POLICY "Dealers can view own reimbursement claims"
ON public.dealer_reimbursement_claims FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
          AND r.name IN ('super_admin', 'admin', 'service', 'sales')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.dealer_id IS NOT NULL
          AND p.dealer_id = dealer_reimbursement_claims.dealer_id
    )
);

DROP POLICY IF EXISTS "Dealers can submit own reimbursement claims" ON public.dealer_reimbursement_claims;
CREATE POLICY "Dealers can submit own reimbursement claims"
ON public.dealer_reimbursement_claims FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
          AND r.name IN ('super_admin', 'admin', 'service')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.dealer_id IS NOT NULL
          AND p.dealer_id = dealer_reimbursement_claims.dealer_id
    )
);

-- 6.5 Audit Logs: Staff only
DROP POLICY IF EXISTS "Staff can view settlement audit logs" ON public.warranty_settlement_audit_logs;
CREATE POLICY "Staff can view settlement audit logs"
ON public.warranty_settlement_audit_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
          AND r.name IN ('super_admin', 'admin', 'service')
    )
);

-- Revoke all direct writes from public and anon
REVOKE ALL ON public.extended_warranty_policies FROM anon;
REVOKE ALL ON public.warranty_claims FROM anon;
REVOKE ALL ON public.dealer_reimbursement_claims FROM anon;
REVOKE ALL ON public.warranty_settlement_audit_logs FROM anon;

-- =============================================================================
-- SECTION 7: AUTHORITATIVE RPC FUNCTIONS (SECURITY DEFINER)
-- =============================================================================

-- 7.1 RPC: Submit Enterprise Warranty Claim
CREATE OR REPLACE FUNCTION public.fn_submit_warranty_claim(
    p_warranty_id UUID,
    p_claim_type TEXT,
    p_defect_description TEXT,
    p_claimed_amount NUMERIC DEFAULT 0.00,
    p_service_ticket_id UUID DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_warranty public.warranties%ROWTYPE;
    v_claim_number TEXT;
    v_existing_claim public.warranty_claims%ROWTYPE;
    v_claim_id UUID;
BEGIN
    -- Idempotency check
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        SELECT * INTO v_existing_claim FROM public.warranty_claims WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'claim_id', v_existing_claim.id,
                'claim_number', v_existing_claim.claim_number,
                'status', v_existing_claim.status,
                'is_duplicate', true,
                'message', 'Retrieved existing warranty claim matching idempotency key'
            );
        END IF;
    END IF;

    -- Validate warranty
    SELECT * INTO v_warranty FROM public.warranties WHERE id = p_warranty_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Warranty record % not found', p_warranty_id;
    END IF;

    IF v_warranty.status NOT IN ('active', 'registered') THEN
        RAISE EXCEPTION 'Warranty is not in active or registered status (current: %)', v_warranty.status;
    END IF;

    -- Check dates (must be within warranty coverage window)
    IF CURRENT_DATE > v_warranty.warranty_end_date THEN
        RAISE EXCEPTION 'Warranty expired on % (Current date: %)', v_warranty.warranty_end_date, CURRENT_DATE;
    END IF;

    IF p_defect_description IS NULL OR length(trim(p_defect_description)) < 5 THEN
        RAISE EXCEPTION 'Defect description must be provided with sufficient technical detail';
    END IF;

    IF p_claimed_amount < 0 THEN
        RAISE EXCEPTION 'Claimed amount cannot be negative';
    END IF;

    -- Generate sequential claim number
    v_claim_number := 'CLM-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

    INSERT INTO public.warranty_claims (
        claim_number,
        warranty_id,
        product_unit_id,
        customer_id,
        service_ticket_id,
        claim_type,
        status,
        defect_description,
        claimed_amount,
        idempotency_key
    ) VALUES (
        v_claim_number,
        p_warranty_id,
        v_warranty.product_unit_id,
        v_warranty.customer_id,
        p_service_ticket_id,
        p_claim_type,
        'SUBMITTED',
        p_defect_description,
        p_claimed_amount,
        p_idempotency_key
    )
    RETURNING id INTO v_claim_id;

    -- Audit log
    INSERT INTO public.warranty_settlement_audit_logs (
        entity_type, entity_id, action, previous_status, new_status, amount, performed_by, notes
    ) VALUES (
        'WARRANTY_CLAIM', v_claim_id, 'CLAIM_SUBMITTED', NULL, 'SUBMITTED', p_claimed_amount, auth.uid(), 'Warranty claim initialized'
    );

    RETURN jsonb_build_object(
        'success', true,
        'claim_id', v_claim_id,
        'claim_number', v_claim_number,
        'status', 'SUBMITTED',
        'is_duplicate', false,
        'message', 'Warranty claim successfully submitted'
    );
END;
$$;

-- 7.2 RPC: Settle / Adjudicate Enterprise Warranty Claim
CREATE OR REPLACE FUNCTION public.fn_settle_warranty_claim(
    p_claim_id UUID,
    p_decision TEXT, -- 'APPROVE', 'REJECT'
    p_settlement_type TEXT DEFAULT 'NO_CHARGE_REPAIR',
    p_approved_amount NUMERIC DEFAULT 0.00,
    p_rejection_reason TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_claim public.warranty_claims%ROWTYPE;
    v_new_status TEXT;
    v_settlement_ref TEXT := NULL;
    v_caller_role TEXT;
BEGIN
    -- Verify authorized role
    SELECT r.name INTO v_caller_role
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid();

    IF v_caller_role NOT IN ('super_admin', 'admin', 'service') THEN
        RAISE EXCEPTION 'Access denied. Settle claims requires administrative or service staff authorization.';
    END IF;

    -- Lock row for update
    SELECT * INTO v_claim FROM public.warranty_claims WHERE id = p_claim_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Warranty claim % not found', p_claim_id;
    END IF;

    IF v_claim.status IN ('SETTLED', 'REJECTED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Warranty claim % is already finalized in % status', v_claim.claim_number, v_claim.status;
    END IF;

    IF p_decision = 'APPROVE' THEN
        v_new_status := 'SETTLED';
        IF p_approved_amount < 0 THEN
            RAISE EXCEPTION 'Approved settlement amount cannot be negative';
        END IF;
        v_settlement_ref := 'SETTLE-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');
    ELSIF p_decision = 'REJECT' THEN
        v_new_status := 'REJECTED';
        IF p_rejection_reason IS NULL OR length(trim(p_rejection_reason)) < 3 THEN
            RAISE EXCEPTION 'Rejection reason is required when rejecting a warranty claim';
        END IF;
        p_approved_amount := 0.00;
        p_settlement_type := 'REJECTED_OUT_OF_SCOPE';
    ELSE
        RAISE EXCEPTION 'Invalid decision %. Must be APPROVE or REJECT.', p_decision;
    END IF;

    UPDATE public.warranty_claims
    SET status = v_new_status,
        approved_amount = p_approved_amount,
        settlement_type = p_settlement_type,
        settlement_reference = v_settlement_ref,
        rejection_reason = p_rejection_reason,
        reviewed_by = auth.uid(),
        settled_at = now(),
        updated_at = now()
    WHERE id = p_claim_id;

    -- Audit log
    INSERT INTO public.warranty_settlement_audit_logs (
        entity_type, entity_id, action, previous_status, new_status, amount, performed_by, notes
    ) VALUES (
        'WARRANTY_CLAIM', p_claim_id, 'CLAIM_' || p_decision, v_claim.status, v_new_status, p_approved_amount, auth.uid(), COALESCE(p_notes, p_rejection_reason)
    );

    RETURN jsonb_build_object(
        'success', true,
        'claim_id', p_claim_id,
        'claim_number', v_claim.claim_number,
        'new_status', v_new_status,
        'approved_amount', p_approved_amount,
        'settlement_reference', v_settlement_ref,
        'message', 'Warranty claim successfully adjudicated'
    );
END;
$$;

-- 7.3 RPC: Submit Dealer Reimbursement Claim
CREATE OR REPLACE FUNCTION public.fn_submit_dealer_reimbursement(
    p_dealer_id UUID,
    p_product_unit_id UUID,
    p_labor_cost NUMERIC,
    p_parts_cost NUMERIC,
    p_warranty_claim_id UUID DEFAULT NULL,
    p_dealer_notes TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing public.dealer_reimbursement_claims%ROWTYPE;
    v_reimb_num TEXT;
    v_reimb_id UUID;
    v_caller_dealer_id UUID;
    v_caller_role TEXT;
BEGIN
    -- Idempotency check
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        SELECT * INTO v_existing FROM public.dealer_reimbursement_claims WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'reimbursement_id', v_existing.id,
                'reimbursement_number', v_existing.reimbursement_number,
                'status', v_existing.status,
                'is_duplicate', true,
                'message', 'Existing reimbursement claim returned'
            );
        END IF;
    END IF;

    -- Validate caller tenancy
    SELECT r.name, p.dealer_id INTO v_caller_role, v_caller_dealer_id
    FROM public.profiles p
    LEFT JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid();

    IF v_caller_dealer_id IS NOT NULL AND v_caller_dealer_id <> p_dealer_id THEN
        RAISE EXCEPTION 'Dealer tenant violation: cannot submit reimbursement on behalf of another dealer';
    END IF;

    IF p_labor_cost < 0 OR p_parts_cost < 0 THEN
        RAISE EXCEPTION 'Claimed costs cannot be negative';
    END IF;

    IF (p_labor_cost + p_parts_cost) <= 0 THEN
        RAISE EXCEPTION 'Total reimbursement claim must be greater than zero';
    END IF;

    v_reimb_num := 'DRC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

    INSERT INTO public.dealer_reimbursement_claims (
        reimbursement_number,
        dealer_id,
        warranty_claim_id,
        product_unit_id,
        status,
        labor_cost_claimed,
        parts_cost_claimed,
        dealer_notes,
        idempotency_key
    ) VALUES (
        v_reimb_num,
        p_dealer_id,
        p_warranty_claim_id,
        p_product_unit_id,
        'PENDING',
        p_labor_cost,
        p_parts_cost,
        p_dealer_notes,
        p_idempotency_key
    )
    RETURNING id INTO v_reimb_id;

    -- Audit log
    INSERT INTO public.warranty_settlement_audit_logs (
        entity_type, entity_id, action, previous_status, new_status, amount, performed_by, notes
    ) VALUES (
        'DEALER_REIMBURSEMENT', v_reimb_id, 'REIMBURSEMENT_SUBMITTED', NULL, 'PENDING', (p_labor_cost + p_parts_cost), auth.uid(), p_dealer_notes
    );

    RETURN jsonb_build_object(
        'success', true,
        'reimbursement_id', v_reimb_id,
        'reimbursement_number', v_reimb_num,
        'total_claimed', (p_labor_cost + p_parts_cost),
        'status', 'PENDING',
        'is_duplicate', false,
        'message', 'Dealer reimbursement claim successfully submitted'
    );
END;
$$;

-- 7.4 RPC: Approve Dealer Reimbursement & Issue Credit Memo
CREATE OR REPLACE FUNCTION public.fn_approve_dealer_reimbursement(
    p_reimbursement_id UUID,
    p_approved_amount NUMERIC,
    p_auditor_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reimb public.dealer_reimbursement_claims%ROWTYPE;
    v_credit_memo TEXT;
    v_caller_role TEXT;
BEGIN
    SELECT r.name INTO v_caller_role
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid();

    IF v_caller_role NOT IN ('super_admin', 'admin', 'service') THEN
        RAISE EXCEPTION 'Access denied. Approving dealer reimbursements requires staff authorization.';
    END IF;

    SELECT * INTO v_reimb FROM public.dealer_reimbursement_claims WHERE id = p_reimbursement_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reimbursement claim % not found', p_reimbursement_id;
    END IF;

    IF v_reimb.status IN ('APPROVED', 'CREDITED') THEN
        RAISE EXCEPTION 'Reimbursement % has already been settled', v_reimb.reimbursement_number;
    END IF;

    IF p_approved_amount <= 0 THEN
        RAISE EXCEPTION 'Approved reimbursement amount must be greater than zero';
    END IF;

    v_credit_memo := 'CR-MEMO-DRC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

    UPDATE public.dealer_reimbursement_claims
    SET status = 'CREDITED',
        approved_amount = p_approved_amount,
        credit_memo_number = v_credit_memo,
        auditor_notes = p_auditor_notes,
        audited_by = auth.uid(),
        credited_at = now(),
        updated_at = now()
    WHERE id = p_reimbursement_id;

    -- Audit log
    INSERT INTO public.warranty_settlement_audit_logs (
        entity_type, entity_id, action, previous_status, new_status, amount, performed_by, notes
    ) VALUES (
        'DEALER_REIMBURSEMENT', p_reimbursement_id, 'REIMBURSEMENT_CREDITED', v_reimb.status, 'CREDITED', p_approved_amount, auth.uid(), 'Credit memo: ' || v_credit_memo
    );

    RETURN jsonb_build_object(
        'success', true,
        'reimbursement_id', p_reimbursement_id,
        'reimbursement_number', v_reimb.reimbursement_number,
        'status', 'CREDITED',
        'approved_amount', p_approved_amount,
        'credit_memo_number', v_credit_memo,
        'message', 'Dealer reimbursement successfully approved and credited'
    );
END;
$$;

-- 7.5 RPC: Activate Extended Warranty Policy
CREATE OR REPLACE FUNCTION public.fn_activate_extended_warranty(
    p_warranty_id UUID,
    p_plan_id UUID,
    p_payment_reference TEXT,
    p_sales_channel TEXT DEFAULT 'DIRECT_CRM',
    p_dealer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_warranty public.warranties%ROWTYPE;
    v_plan public.extended_warranty_plans%ROWTYPE;
    v_policy_num TEXT;
    v_policy_id UUID;
    v_start_date DATE;
    v_end_date DATE;
    v_commission NUMERIC(10,2) := 0.00;
BEGIN
    SELECT * INTO v_warranty FROM public.warranties WHERE id = p_warranty_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Base warranty % not found', p_warranty_id;
    END IF;

    IF v_warranty.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot activate extended warranty on cancelled base warranty';
    END IF;

    SELECT * INTO v_plan FROM public.extended_warranty_plans WHERE id = p_plan_id;
    IF NOT FOUND OR NOT v_plan.is_active THEN
        RAISE EXCEPTION 'Active extended warranty plan % not found', p_plan_id;
    END IF;

    -- Start date is continuous from current warranty_end_date (or today if expired within grace period)
    IF v_warranty.warranty_end_date >= CURRENT_DATE THEN
        v_start_date := v_warranty.warranty_end_date;
    ELSE
        -- 30-day grace period check
        IF CURRENT_DATE > (v_warranty.warranty_end_date + INTERVAL '30 days')::DATE THEN
            RAISE EXCEPTION 'Unit is outside the 30-day post-warranty grace period for extended coverage';
        END IF;
        v_start_date := CURRENT_DATE;
    END IF;

    v_end_date := (v_start_date + (v_plan.coverage_months || ' months')::INTERVAL)::DATE;
    v_policy_num := 'EWP-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

    IF p_sales_channel = 'DEALER_PORTAL' AND p_dealer_id IS NOT NULL THEN
        v_commission := round((v_plan.retail_price * v_plan.dealer_commission_pct / 100.0), 2);
    END IF;

    INSERT INTO public.extended_warranty_policies (
        policy_number,
        warranty_id,
        plan_id,
        customer_id,
        product_unit_id,
        dealer_id,
        status,
        extended_start_date,
        extended_end_date,
        premium_paid,
        dealer_commission_amount,
        payment_reference,
        sales_channel
    ) VALUES (
        v_policy_num,
        p_warranty_id,
        p_plan_id,
        v_warranty.customer_id,
        v_warranty.product_unit_id,
        p_dealer_id,
        'ACTIVE',
        v_start_date,
        v_end_date,
        v_plan.retail_price,
        v_commission,
        p_payment_reference,
        p_sales_channel
    )
    RETURNING id INTO v_policy_id;

    -- Synchronize primary warranty expiration date seamlessly
    UPDATE public.warranties
    SET warranty_end_date = v_end_date,
        status = 'active',
        updated_at = now()
    WHERE id = p_warranty_id;

    -- Audit log
    INSERT INTO public.warranty_settlement_audit_logs (
        entity_type, entity_id, action, previous_status, new_status, amount, performed_by, notes
    ) VALUES (
        'EXTENDED_POLICY', v_policy_id, 'POLICY_ACTIVATED', NULL, 'ACTIVE', v_plan.retail_price, auth.uid(), 'Plan: ' || v_plan.plan_code || ' Extended to: ' || v_end_date
    );

    RETURN jsonb_build_object(
        'success', true,
        'policy_id', v_policy_id,
        'policy_number', v_policy_num,
        'plan_name', v_plan.plan_name,
        'new_warranty_end_date', v_end_date,
        'premium_paid', v_plan.retail_price,
        'dealer_commission', v_commission,
        'message', 'Extended warranty policy activated successfully'
    );
END;
$$;

-- 7.6 RPC: Cancel Extended Warranty Policy (Cooling-off Period)
CREATE OR REPLACE FUNCTION public.fn_cancel_extended_warranty_policy(
    p_policy_id UUID,
    p_cancellation_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_policy public.extended_warranty_policies%ROWTYPE;
    v_has_claims BOOLEAN;
    v_caller_role TEXT;
BEGIN
    SELECT r.name INTO v_caller_role
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid();

    IF v_caller_role NOT IN ('super_admin', 'admin', 'service') THEN
        RAISE EXCEPTION 'Access denied. Cancelling policy requires staff authorization.';
    END IF;

    SELECT * INTO v_policy FROM public.extended_warranty_policies WHERE id = p_policy_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Extended warranty policy % not found', p_policy_id;
    END IF;

    IF v_policy.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Policy % is not active (status: %)', v_policy.policy_number, v_policy.status;
    END IF;

    -- Check if claims filed against policy
    SELECT EXISTS (
        SELECT 1 FROM public.warranty_claims 
        WHERE warranty_id = v_policy.warranty_id
          AND created_at >= v_policy.created_at
          AND status NOT IN ('REJECTED', 'CANCELLED')
    ) INTO v_has_claims;

    IF v_has_claims THEN
        RAISE EXCEPTION 'Policy cannot be cancelled because warranty claims have been processed during the extended coverage period';
    END IF;

    UPDATE public.extended_warranty_policies
    SET status = 'CANCELLED',
        cancellation_reason = p_cancellation_reason,
        cancelled_at = now(),
        updated_at = now()
    WHERE id = p_policy_id;

    -- Restore base warranty date back to extended_start_date
    UPDATE public.warranties
    SET warranty_end_date = v_policy.extended_start_date,
        updated_at = now()
    WHERE id = v_policy.warranty_id;

    -- Audit log
    INSERT INTO public.warranty_settlement_audit_logs (
        entity_type, entity_id, action, previous_status, new_status, amount, performed_by, notes
    ) VALUES (
        'EXTENDED_POLICY', p_policy_id, 'POLICY_CANCELLED', 'ACTIVE', 'CANCELLED', v_policy.premium_paid, auth.uid(), p_cancellation_reason
    );

    RETURN jsonb_build_object(
        'success', true,
        'policy_id', p_policy_id,
        'policy_number', v_policy.policy_number,
        'status', 'CANCELLED',
        'restored_warranty_end_date', v_policy.extended_start_date,
        'message', 'Extended warranty policy cancelled and warranty end date restored'
    );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.fn_submit_warranty_claim(UUID, TEXT, TEXT, NUMERIC, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_settle_warranty_claim(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_submit_dealer_reimbursement(UUID, UUID, NUMERIC, NUMERIC, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_approve_dealer_reimbursement(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_activate_extended_warranty(UUID, UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cancel_extended_warranty_policy(UUID, TEXT) TO authenticated;

-- Revoke from anonymous
REVOKE EXECUTE ON FUNCTION public.fn_submit_warranty_claim FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_settle_warranty_claim FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_submit_dealer_reimbursement FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_approve_dealer_reimbursement FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_activate_extended_warranty FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_cancel_extended_warranty_policy FROM PUBLIC, anon;
