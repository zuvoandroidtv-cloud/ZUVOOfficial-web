-- =============================================================================
-- ZUVO TV CRM — PHASE 8.8 MASTER DATABASE MIGRATION
-- Enterprise Budgetary Control, Department Cost Center Accounting & PO Commitment Governance
-- Filename: 20261017280000_phase_8_8_budgetary_control_cost_centers.sql
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. SEQUENCES FOR CONCURRENCY-SAFE BUDGET ENVELOPE & COMMITMENT NUMBERING
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_budget_envelope_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_budget_commitment_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 2. TABLE: public.cost_centers
-- Departmental and location hierarchical cost centers
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL CHECK (
        department IN ('FACTORY', 'SERVICE', 'SALES', 'CORPORATE', 'RND', 'LOGISTICS', 'OTHER')
    ),
    description TEXT,
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    parent_cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cost_center_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT chk_cost_center_no_self_parent CHECK (parent_cost_center_id IS NULL OR parent_cost_center_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_cost_centers_tenant_code ON public.cost_centers(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_cost_centers_dept ON public.cost_centers(department);
CREATE INDEX IF NOT EXISTS idx_cost_centers_parent ON public.cost_centers(parent_cost_center_id);

-- =============================================================================
-- 3. TABLE: public.budget_envelopes
-- Fiscal year and quarterly approved budgets per cost center and category
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.budget_envelopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    envelope_number TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    cost_center_id UUID NOT NULL REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
    fiscal_year INT NOT NULL CHECK (fiscal_year >= 2020 AND fiscal_year <= 2050),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    budget_category TEXT NOT NULL CHECK (
        budget_category IN ('OPEX', 'CAPEX', 'WARRANTY', 'OVERHEAD')
    ),
    total_budget NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_budget >= 0),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN ('DRAFT', 'APPROVED', 'REVISED', 'CLOSED')
    ),
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    previous_version_id UUID REFERENCES public.budget_envelopes(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_budget_envelope_dates CHECK (period_start <= period_end)
);

CREATE INDEX IF NOT EXISTS idx_budget_envelopes_cc_fy ON public.budget_envelopes(cost_center_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_budget_envelopes_status ON public.budget_envelopes(status);
CREATE INDEX IF NOT EXISTS idx_budget_envelopes_tenant ON public.budget_envelopes(tenant_id);

-- =============================================================================
-- 4. TABLE: public.budget_line_items
-- Granular allocations per GL account code
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.budget_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    budget_envelope_id UUID NOT NULL REFERENCES public.budget_envelopes(id) ON DELETE CASCADE,
    gl_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
    gl_account_code TEXT NOT NULL,
    allocated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (allocated_amount >= 0),
    revised_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (revised_amount >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_budget_line_envelope_gl UNIQUE (budget_envelope_id, gl_account_code)
);

CREATE INDEX IF NOT EXISTS idx_budget_lines_envelope ON public.budget_line_items(budget_envelope_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_gl_code ON public.budget_line_items(gl_account_code);

-- =============================================================================
-- 5. TABLE: public.budget_commitments
-- Encumbrance subledger tracking committed funds on purchase orders
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.budget_commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commitment_number TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    cost_center_id UUID NOT NULL REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
    budget_line_item_id UUID REFERENCES public.budget_line_items(id) ON DELETE SET NULL,
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
    gl_account_code TEXT NOT NULL,
    committed_amount NUMERIC(15, 2) NOT NULL CHECK (committed_amount >= 0),
    relieved_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (relieved_amount >= 0),
    remaining_commitment NUMERIC(15, 2) NOT NULL CHECK (remaining_commitment >= 0),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (
        status IN ('OPEN', 'PARTIALLY_RELIEVED', 'FULLY_RELIEVED', 'CANCELLED')
    ),
    vendor_invoice_id UUID REFERENCES public.vendor_invoices(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_commitment_math CHECK (remaining_commitment = committed_amount - relieved_amount),
    CONSTRAINT chk_commitment_relieved_lte CHECK (relieved_amount <= committed_amount)
);

CREATE INDEX IF NOT EXISTS idx_commitments_po ON public.budget_commitments(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_commitments_cc ON public.budget_commitments(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_commitments_status ON public.budget_commitments(status);

-- =============================================================================
-- 6. TABLE: public.cost_center_allocations
-- Links GL journal entry lines to analytical cost centers for departmental P&L
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cost_center_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    journal_line_id UUID NOT NULL REFERENCES public.journal_entry_lines(id) ON DELETE CASCADE,
    cost_center_id UUID NOT NULL REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
    allocated_amount NUMERIC(15, 2) NOT NULL CHECK (allocated_amount > 0),
    allocation_percentage NUMERIC(5, 2) NOT NULL CHECK (allocation_percentage > 0 AND allocation_percentage <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cost_center_line UNIQUE (journal_line_id, cost_center_id)
);

CREATE INDEX IF NOT EXISTS idx_cost_center_allocations_line ON public.cost_center_allocations(journal_line_id);
CREATE INDEX IF NOT EXISTS idx_cost_center_allocations_cc ON public.cost_center_allocations(cost_center_id);

-- =============================================================================
-- 7. TABLE: public.budget_audit_events
-- Tamper-evident immutable audit log for all budgetary actions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.budget_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    event_type TEXT NOT NULL CHECK (
        event_type IN (
            'BUDGET_CREATED', 'BUDGET_APPROVED', 'BUDGET_REVISED', 'BUDGET_CLOSED',
            'COMMITMENT_CREATED', 'COMMITMENT_RELIEVED', 'COMMITMENT_CANCELLED',
            'BUDGET_OVERRUN_WARN', 'BUDGET_OVERRUN_BLOCKED', 'ALLOCATION_POSTED'
        )
    ),
    entity_id UUID NOT NULL,
    entity_type TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_audit_events_type ON public.budget_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_budget_audit_events_entity ON public.budget_audit_events(entity_id);

-- =============================================================================
-- 8. SEED STANDARD COST CENTERS
-- =============================================================================
DO $$
DECLARE
    v_root_factory UUID;
    v_root_service UUID;
    v_root_sales UUID;
    v_root_corp UUID;
BEGIN
    -- Parent Cost Centers
    INSERT INTO public.cost_centers (code, name, department, description)
    VALUES ('FACTORY', 'Central Factory Operations', 'FACTORY', 'Master factory operations center')
    ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_root_factory;

    INSERT INTO public.cost_centers (code, name, department, description)
    VALUES ('SERVICE', 'Customer Care & Field Service', 'SERVICE', 'National service depot operations')
    ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_root_service;

    INSERT INTO public.cost_centers (code, name, department, description)
    VALUES ('SALES', 'Commercial Sales & Distribution', 'SALES', 'Retail and dealer sales channels')
    ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_root_sales;

    INSERT INTO public.cost_centers (code, name, department, description)
    VALUES ('CORPORATE', 'Corporate Headquarters', 'CORPORATE', 'Executive, legal, finance and IT administration')
    ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_root_corp;

    -- Factory Sub-centers
    INSERT INTO public.cost_centers (code, name, department, description, parent_cost_center_id)
    VALUES 
        ('FACTORY-ASSEMBLY', 'TV SMT & Chassis Assembly', 'FACTORY', 'TV assembly lines and burn-in', v_root_factory),
        ('FACTORY-QA', 'Factory Quality & Calibration', 'FACTORY', 'Optical calibration, Hi-Pot, and final QA', v_root_factory),
        ('FACTORY-MATERIALS', 'Raw Materials Warehouse', 'FACTORY', 'Raw component procurement and storage', v_root_factory)
    ON CONFLICT (tenant_id, code) DO NOTHING;

    -- Service Sub-centers
    INSERT INTO public.cost_centers (code, name, department, description, parent_cost_center_id)
    VALUES 
        ('SERVICE-NORTH', 'North Region Service Depot', 'SERVICE', 'Delhi NCR and Northern Hub', v_root_service),
        ('SERVICE-SOUTH', 'South Region Service Depot', 'SERVICE', 'Bangalore and Southern Hub', v_root_service),
        ('SERVICE-WEST', 'West Region Service Depot', 'SERVICE', 'Mumbai and Western Hub', v_root_service),
        ('SERVICE-EAST', 'East Region Service Depot', 'SERVICE', 'Kolkata and Eastern Hub', v_root_service)
    ON CONFLICT (tenant_id, code) DO NOTHING;

    -- Sales Sub-centers
    INSERT INTO public.cost_centers (code, name, department, description, parent_cost_center_id)
    VALUES 
        ('SALES-DEALER', 'B2B Dealer Network', 'SALES', 'Dealer consignment and direct commercial sales', v_root_sales),
        ('SALES-DIRECT', 'Direct to Consumer / E-Commerce', 'SALES', 'Direct customer sales', v_root_sales)
    ON CONFLICT (tenant_id, code) DO NOTHING;

    -- Corporate Sub-centers
    INSERT INTO public.cost_centers (code, name, department, description, parent_cost_center_id)
    VALUES 
        ('CORPORATE-FINANCE', 'Finance & Accounting', 'CORPORATE', 'Treasury, audit and financial control', v_root_corp),
        ('CORPORATE-IT', 'IT Infrastructure & Software', 'CORPORATE', 'ERP, servers and cloud engineering', v_root_corp)
    ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$;

-- =============================================================================
-- 9. EXTEND PURCHASE ORDERS TABLE (OPTIONAL COST_CENTER_ID LINK)
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'purchase_orders' 
          AND column_name = 'cost_center_id'
    ) THEN
        ALTER TABLE public.purchase_orders 
        ADD COLUMN cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;
    END IF;
END;
$$;

-- =============================================================================
-- 10. SERVER-AUTHORITATIVE RPCs
-- =============================================================================

-- A. fn_create_budget_envelope
CREATE OR REPLACE FUNCTION public.fn_create_budget_envelope(
    p_cost_center_id UUID,
    p_fiscal_year INT,
    p_period_start DATE,
    p_period_end DATE,
    p_budget_category TEXT,
    p_line_items JSONB,
    p_notes TEXT DEFAULT NULL,
    p_tenant_id TEXT DEFAULT 'default'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_envelope_id UUID;
    v_envelope_number TEXT;
    v_total_amount NUMERIC(15, 2) := 0.00;
    v_line JSONB;
    v_gl_account_id UUID;
    v_gl_code TEXT;
    v_allocated NUMERIC(15, 2);
    v_seq_num BIGINT;
BEGIN
    -- Validate dates
    IF p_period_start > p_period_end THEN
        RAISE EXCEPTION 'period_start must be before or equal to period_end';
    END IF;

    -- Validate category
    IF p_budget_category NOT IN ('OPEX', 'CAPEX', 'WARRANTY', 'OVERHEAD') THEN
        RAISE EXCEPTION 'Invalid budget_category: %', p_budget_category;
    END IF;

    -- Check cost center exists
    IF NOT EXISTS (SELECT 1 FROM public.cost_centers WHERE id = p_cost_center_id AND tenant_id = p_tenant_id) THEN
        RAISE EXCEPTION 'Cost center not found: %', p_cost_center_id;
    END IF;

    -- Generate sequential envelope number
    SELECT nextval('public.seq_budget_envelope_number') INTO v_seq_num;
    v_envelope_number := 'BGT-' || p_fiscal_year::TEXT || '-' || lpad(v_seq_num::TEXT, 4, '0');

    -- Calculate total from lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_line_items)
    LOOP
        v_allocated := (v_line->>'allocated_amount')::NUMERIC;
        IF v_allocated < 0 THEN
            RAISE EXCEPTION 'Allocated amount cannot be negative: %', v_allocated;
        END IF;
        v_total_amount := v_total_amount + v_allocated;
    END LOOP;

    -- Insert envelope in DRAFT status
    INSERT INTO public.budget_envelopes (
        envelope_number, tenant_id, cost_center_id, fiscal_year,
        period_start, period_end, budget_category, total_budget,
        status, version, notes, created_by
    ) VALUES (
        v_envelope_number, p_tenant_id, p_cost_center_id, p_fiscal_year,
        p_period_start, p_period_end, p_budget_category, v_total_amount,
        'DRAFT', 1, p_notes, auth.uid()
    ) RETURNING id INTO v_envelope_id;

    -- Insert line items
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_line_items)
    LOOP
        v_gl_code := v_line->>'gl_account_code';
        v_allocated := (v_line->>'allocated_amount')::NUMERIC;

        -- Resolve GL account
        SELECT id INTO v_gl_account_id
        FROM public.chart_of_accounts
        WHERE account_number = v_gl_code
        LIMIT 1;

        IF v_gl_account_id IS NULL THEN
            RAISE EXCEPTION 'Invalid GL account code: %', v_gl_code;
        END IF;

        INSERT INTO public.budget_line_items (
            tenant_id, budget_envelope_id, gl_account_id,
            gl_account_code, allocated_amount, revised_amount, notes
        ) VALUES (
            p_tenant_id, v_envelope_id, v_gl_account_id,
            v_gl_code, v_allocated, v_allocated, v_line->>'notes'
        );
    END LOOP;

    -- Record Audit Event
    INSERT INTO public.budget_audit_events (
        tenant_id, event_type, entity_id, entity_type, actor_id, details
    ) VALUES (
        p_tenant_id, 'BUDGET_CREATED', v_envelope_id, 'budget_envelopes', auth.uid(),
        jsonb_build_object(
            'envelope_number', v_envelope_number,
            'total_budget', v_total_amount,
            'cost_center_id', p_cost_center_id,
            'category', p_budget_category
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'envelope_id', v_envelope_id,
        'envelope_number', v_envelope_number,
        'total_budget', v_total_amount,
        'status', 'DRAFT'
    );
END;
$$;

-- B. fn_approve_budget_envelope
CREATE OR REPLACE FUNCTION public.fn_approve_budget_envelope(
    p_budget_id UUID,
    p_reviewer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_envelope RECORD;
    v_actor_id UUID;
BEGIN
    SELECT * INTO v_envelope
    FROM public.budget_envelopes
    WHERE id = p_budget_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Budget envelope not found: %', p_budget_id;
    END IF;

    IF v_envelope.status = 'APPROVED' THEN
        RETURN jsonb_build_object('success', true, 'status', 'APPROVED', 'message', 'Already approved');
    END IF;

    IF v_envelope.status = 'CLOSED' THEN
        RAISE EXCEPTION 'Cannot approve a CLOSED budget envelope';
    END IF;

    v_actor_id := COALESCE(p_reviewer_id, auth.uid());

    -- Maker-checker check: creator cannot approve own budget if creator is specified
    IF v_envelope.created_by IS NOT NULL AND v_envelope.created_by = v_actor_id THEN
        RAISE EXCEPTION 'Maker-checker violation: Requester cannot approve their own budget envelope';
    END IF;

    -- Transition status
    UPDATE public.budget_envelopes
    SET status = 'APPROVED',
        approved_by = v_actor_id,
        approved_at = now(),
        updated_at = now()
    WHERE id = p_budget_id;

    -- Record audit event
    INSERT INTO public.budget_audit_events (
        tenant_id, event_type, entity_id, entity_type, actor_id, details
    ) VALUES (
        v_envelope.tenant_id, 'BUDGET_APPROVED', p_budget_id, 'budget_envelopes', v_actor_id,
        jsonb_build_object(
            'envelope_number', v_envelope.envelope_number,
            'total_budget', v_envelope.total_budget,
            'cost_center_id', v_envelope.cost_center_id
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'envelope_id', p_budget_id,
        'status', 'APPROVED',
        'approved_at', now()
    );
END;
$$;

-- C. fn_revise_budget_envelope
CREATE OR REPLACE FUNCTION public.fn_revise_budget_envelope(
    p_budget_id UUID,
    p_line_item_updates JSONB,
    p_revision_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig RECORD;
    v_new_id UUID;
    v_new_number TEXT;
    v_total NUMERIC(15, 2) := 0.00;
    v_line JSONB;
    v_item RECORD;
    v_new_amt NUMERIC(15, 2);
    v_seq_num BIGINT;
BEGIN
    SELECT * INTO v_orig
    FROM public.budget_envelopes
    WHERE id = p_budget_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Budget envelope not found: %', p_budget_id;
    END IF;

    IF v_orig.status NOT IN ('APPROVED', 'REVISED') THEN
        RAISE EXCEPTION 'Only APPROVED or REVISED budget envelopes can be revised. Current status: %', v_orig.status;
    END IF;

    -- Mark original as REVISED
    UPDATE public.budget_envelopes
    SET status = 'REVISED', updated_at = now()
    WHERE id = p_budget_id;

    -- Generate new version
    SELECT nextval('public.seq_budget_envelope_number') INTO v_seq_num;
    v_new_number := v_orig.envelope_number || '-R' || (v_orig.version + 1)::TEXT;

    INSERT INTO public.budget_envelopes (
        envelope_number, tenant_id, cost_center_id, fiscal_year,
        period_start, period_end, budget_category, total_budget,
        status, version, previous_version_id, notes, created_by
    ) VALUES (
        v_new_number, v_orig.tenant_id, v_orig.cost_center_id, v_orig.fiscal_year,
        v_orig.period_start, v_orig.period_end, v_orig.budget_category, 0.00,
        'APPROVED', v_orig.version + 1, v_orig.id, p_revision_notes, auth.uid()
    ) RETURNING id INTO v_new_id;

    -- Copy line items with updates applied
    FOR v_item IN SELECT * FROM public.budget_line_items WHERE budget_envelope_id = p_budget_id
    LOOP
        v_new_amt := v_item.revised_amount;
        -- Check if there is an update for this account
        FOR v_line IN SELECT * FROM jsonb_array_elements(p_line_item_updates)
        LOOP
            IF v_line->>'gl_account_code' = v_item.gl_account_code THEN
                v_new_amt := (v_line->>'new_amount')::NUMERIC;
                IF v_new_amt < 0 THEN
                    RAISE EXCEPTION 'Negative revised amount rejected for GL %: %', v_item.gl_account_code, v_new_amt;
                END IF;
            END IF;
        END LOOP;

        INSERT INTO public.budget_line_items (
            tenant_id, budget_envelope_id, gl_account_id,
            gl_account_code, allocated_amount, revised_amount, notes
        ) VALUES (
            v_orig.tenant_id, v_new_id, v_item.gl_account_id,
            v_item.gl_account_code, v_item.allocated_amount, v_new_amt, v_item.notes
        );

        v_total := v_total + v_new_amt;
    END LOOP;

    -- Update total budget on new envelope
    UPDATE public.budget_envelopes
    SET total_budget = v_total
    WHERE id = v_new_id;

    -- Record Audit Event
    INSERT INTO public.budget_audit_events (
        tenant_id, event_type, entity_id, entity_type, actor_id, details
    ) VALUES (
        v_orig.tenant_id, 'BUDGET_REVISED', v_new_id, 'budget_envelopes', auth.uid(),
        jsonb_build_object(
            'previous_envelope_id', p_budget_id,
            'new_envelope_number', v_new_number,
            'new_total_budget', v_total,
            'version', v_orig.version + 1
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_envelope_id', v_new_id,
        'new_envelope_number', v_new_number,
        'total_budget', v_total,
        'version', v_orig.version + 1
    );
END;
$$;

-- D. fn_check_budget_availability
CREATE OR REPLACE FUNCTION public.fn_check_budget_availability(
    p_cost_center_id UUID,
    p_gl_account_code TEXT,
    p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_allocated NUMERIC(15, 2) := 0.00;
    v_committed NUMERIC(15, 2) := 0.00;
    v_actual NUMERIC(15, 2) := 0.00;
    v_available NUMERIC(15, 2) := 0.00;
    v_policy TEXT := 'ALLOW';
    v_allowed BOOLEAN := true;
    v_account_id UUID;
    v_cc RECORD;
BEGIN
    IF p_amount < 0 THEN
        RAISE EXCEPTION 'Requested budget check amount cannot be negative: %', p_amount;
    END IF;

    SELECT * INTO v_cc FROM public.cost_centers WHERE id = p_cost_center_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cost center not found: %', p_cost_center_id;
    END IF;

    -- 1. Get allocated amount from latest APPROVED or REVISED envelope line
    SELECT COALESCE(SUM(bli.revised_amount), 0.00) INTO v_allocated
    FROM public.budget_line_items bli
    JOIN public.budget_envelopes be ON be.id = bli.budget_envelope_id
    WHERE be.cost_center_id = p_cost_center_id
      AND bli.gl_account_code = p_gl_account_code
      AND be.status IN ('APPROVED', 'REVISED');

    -- 2. Get active open commitments
    SELECT COALESCE(SUM(remaining_commitment), 0.00) INTO v_committed
    FROM public.budget_commitments
    WHERE cost_center_id = p_cost_center_id
      AND gl_account_code = p_gl_account_code
      AND status IN ('OPEN', 'PARTIALLY_RELIEVED');

    -- 3. Get actual spend from GL journal entry lines allocated to this cost center
    -- or directly mapped to account and period
    SELECT id INTO v_account_id FROM public.chart_of_accounts WHERE account_number = p_gl_account_code LIMIT 1;
    
    IF v_account_id IS NOT NULL THEN
        -- Check direct allocations first
        SELECT COALESCE(SUM(cca.allocated_amount), 0.00) INTO v_actual
        FROM public.cost_center_allocations cca
        JOIN public.journal_entry_lines jel ON jel.id = cca.journal_line_id
        WHERE cca.cost_center_id = p_cost_center_id
          AND jel.account_id = v_account_id;

        -- If zero allocations exist, check unallocated journal lines
        IF v_actual = 0.00 THEN
            SELECT COALESCE(SUM(jel.debit_amount), 0.00) INTO v_actual
            FROM public.journal_entry_lines jel
            JOIN public.journal_entries je ON je.id = jel.journal_entry_id
            WHERE jel.account_id = v_account_id
              AND je.status = 'POSTED'
              AND jel.entity_id = p_cost_center_id;
        END IF;
    END IF;

    -- 4. Calculate available headroom
    v_available := v_allocated - v_committed - v_actual;

    -- 5. Determine Policy
    IF v_allocated > 0 AND (v_available - p_amount) < 0 THEN
        v_policy := 'HARD_BLOCK';
        v_allowed := false;
    ELSIF v_allocated > 0 AND (v_available - p_amount) <= (v_allocated * 0.10) THEN
        v_policy := 'WARN';
        v_allowed := true;
    ELSE
        v_policy := 'ALLOW';
        v_allowed := true;
    END IF;

    -- If no budget line was ever created (zero allocation), allow with warning for unbudgeted items
    IF v_allocated = 0.00 THEN
        v_policy := 'WARN';
        v_allowed := true;
    END IF;

    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'policy', v_policy,
        'allocated', v_allocated,
        'committed', v_committed,
        'actual', v_actual,
        'available', v_available,
        'requested', p_amount,
        'cost_center_code', v_cc.code,
        'gl_account_code', p_gl_account_code
    );
END;
$$;

-- E. fn_commit_purchase_order_budget
CREATE OR REPLACE FUNCTION public.fn_commit_purchase_order_budget(
    p_purchase_order_id UUID,
    p_cost_center_id UUID DEFAULT NULL,
    p_gl_account_code TEXT DEFAULT '1300'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_po RECORD;
    v_cc_id UUID;
    v_avail JSONB;
    v_existing RECORD;
    v_commitment_id UUID;
    v_commitment_number TEXT;
    v_seq_num BIGINT;
    v_budget_line_id UUID;
BEGIN
    SELECT * INTO v_po
    FROM public.purchase_orders
    WHERE id = p_purchase_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase order not found: %', p_purchase_order_id;
    END IF;

    -- Idempotency check: Already committed?
    SELECT * INTO v_existing
    FROM public.budget_commitments
    WHERE purchase_order_id = p_purchase_order_id
      AND status IN ('OPEN', 'PARTIALLY_RELIEVED');

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_committed', true,
            'commitment_id', v_existing.id,
            'commitment_number', v_existing.commitment_number,
            'committed_amount', v_existing.committed_amount,
            'remaining_commitment', v_existing.remaining_commitment
        );
    END IF;

    -- Resolve cost center
    v_cc_id := COALESCE(p_cost_center_id, v_po.cost_center_id);
    IF v_cc_id IS NULL THEN
        -- Default to Factory Assembly or Materials
        SELECT id INTO v_cc_id FROM public.cost_centers WHERE code = 'FACTORY-MATERIALS' LIMIT 1;
        IF v_cc_id IS NULL THEN
            SELECT id INTO v_cc_id FROM public.cost_centers LIMIT 1;
        END IF;
    END IF;

    -- Check availability
    v_avail := public.fn_check_budget_availability(v_cc_id, p_gl_account_code, v_po.total_amount);

    IF (v_avail->>'policy') = 'HARD_BLOCK' THEN
        -- Record Audit Block Event
        INSERT INTO public.budget_audit_events (
            tenant_id, event_type, entity_id, entity_type, actor_id, details
        ) VALUES (
            'default', 'BUDGET_OVERRUN_BLOCKED', p_purchase_order_id, 'purchase_orders', auth.uid(),
            jsonb_build_object(
                'po_id', p_purchase_order_id,
                'po_amount', v_po.total_amount,
                'availability', v_avail
            )
        );

        RAISE EXCEPTION 'PO budget hard block: Available budget (₹%) is less than requested PO total (₹%) for cost center %',
            v_avail->>'available', v_po.total_amount, v_avail->>'cost_center_code';
    END IF;

    -- Generate commitment sequence
    SELECT nextval('public.seq_budget_commitment_number') INTO v_seq_num;
    v_commitment_number := 'CMT-' || to_char(now(), 'YYYYMM') || '-' || lpad(v_seq_num::TEXT, 4, '0');

    -- Resolve budget line item ID if exists
    SELECT bli.id INTO v_budget_line_id
    FROM public.budget_line_items bli
    JOIN public.budget_envelopes be ON be.id = bli.budget_envelope_id
    WHERE be.cost_center_id = v_cc_id
      AND bli.gl_account_code = p_gl_account_code
      AND be.status IN ('APPROVED', 'REVISED')
    ORDER BY be.version DESC
    LIMIT 1;

    -- Insert commitment
    INSERT INTO public.budget_commitments (
        commitment_number, tenant_id, cost_center_id, budget_line_item_id,
        purchase_order_id, gl_account_code, committed_amount, relieved_amount,
        remaining_commitment, status, notes
    ) VALUES (
        v_commitment_number, 'default', v_cc_id, v_budget_line_id,
        p_purchase_order_id, p_gl_account_code, v_po.total_amount, 0.00,
        v_po.total_amount, 'OPEN', 'Encumbered upon Purchase Order approval'
    ) RETURNING id INTO v_commitment_id;

    -- Audit event
    INSERT INTO public.budget_audit_events (
        tenant_id, event_type, entity_id, entity_type, actor_id, details
    ) VALUES (
        'default', 'COMMITMENT_CREATED', v_commitment_id, 'budget_commitments', auth.uid(),
        jsonb_build_object(
            'commitment_number', v_commitment_number,
            'purchase_order_id', p_purchase_order_id,
            'amount', v_po.total_amount,
            'cost_center_id', v_cc_id,
            'gl_account_code', p_gl_account_code
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'commitment_id', v_commitment_id,
        'commitment_number', v_commitment_number,
        'committed_amount', v_po.total_amount,
        'remaining_commitment', v_po.total_amount,
        'policy', v_avail->>'policy'
    );
END;
$$;

-- F. fn_relieve_budget_commitment
CREATE OR REPLACE FUNCTION public.fn_relieve_budget_commitment(
    p_purchase_order_id UUID,
    p_vendor_invoice_id UUID,
    p_amount_to_relieve NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cmt RECORD;
    v_inv RECORD;
    v_relieve NUMERIC(15, 2);
    v_new_relieved NUMERIC(15, 2);
    v_new_remaining NUMERIC(15, 2);
    v_new_status TEXT;
BEGIN
    SELECT * INTO v_cmt
    FROM public.budget_commitments
    WHERE purchase_order_id = p_purchase_order_id
      AND status IN ('OPEN', 'PARTIALLY_RELIEVED')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'No open budget commitment found for purchase order'
        );
    END IF;

    -- Resolve invoice
    SELECT * INTO v_inv
    FROM public.vendor_invoices
    WHERE id = p_vendor_invoice_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vendor invoice not found: %', p_vendor_invoice_id;
    END IF;

    v_relieve := COALESCE(p_amount_to_relieve, v_inv.total_amount);

    IF v_relieve <= 0 THEN
        RAISE EXCEPTION 'Relief amount must be greater than zero: %', v_relieve;
    END IF;

    -- Prevent over-relief
    IF (v_cmt.relieved_amount + v_relieve) > v_cmt.committed_amount THEN
        RAISE EXCEPTION 'Over-relief rejected: Attempting to relieve ₹%, but remaining commitment is only ₹%',
            v_relieve, v_cmt.remaining_commitment;
    END IF;

    v_new_relieved := v_cmt.relieved_amount + v_relieve;
    v_new_remaining := v_cmt.committed_amount - v_new_relieved;

    IF v_new_remaining = 0.00 THEN
        v_new_status := 'FULLY_RELIEVED';
    ELSE
        v_new_status := 'PARTIALLY_RELIEVED';
    END IF;

    UPDATE public.budget_commitments
    SET relieved_amount = v_new_relieved,
        remaining_commitment = v_new_remaining,
        status = v_new_status,
        vendor_invoice_id = p_vendor_invoice_id,
        updated_at = now()
    WHERE id = v_cmt.id;

    -- Audit event
    INSERT INTO public.budget_audit_events (
        tenant_id, event_type, entity_id, entity_type, actor_id, details
    ) VALUES (
        v_cmt.tenant_id, 'COMMITMENT_RELIEVED', v_cmt.id, 'budget_commitments', auth.uid(),
        jsonb_build_object(
            'purchase_order_id', p_purchase_order_id,
            'vendor_invoice_id', p_vendor_invoice_id,
            'relieved_amount', v_relieve,
            'remaining_commitment', v_new_remaining,
            'status', v_new_status
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'commitment_id', v_cmt.id,
        'relieved_amount', v_relieve,
        'remaining_commitment', v_new_remaining,
        'status', v_new_status
    );
END;
$$;

-- G. fn_generate_budget_variance_report
CREATE OR REPLACE FUNCTION public.fn_generate_budget_variance_report(
    p_fiscal_year INT,
    p_cost_center_id UUID DEFAULT NULL
)
RETURNS TABLE (
    cost_center_id UUID,
    cost_center_code TEXT,
    cost_center_name TEXT,
    department TEXT,
    gl_account_code TEXT,
    budget_allocated NUMERIC(15, 2),
    committed_amount NUMERIC(15, 2),
    actual_spent NUMERIC(15, 2),
    available_headroom NUMERIC(15, 2),
    variance_amount NUMERIC(15, 2),
    utilization_pct NUMERIC(6, 2),
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH budget_agg AS (
        SELECT 
            be.cost_center_id,
            bli.gl_account_code,
            SUM(bli.revised_amount) AS total_budget
        FROM public.budget_line_items bli
        JOIN public.budget_envelopes be ON be.id = bli.budget_envelope_id
        WHERE be.fiscal_year = p_fiscal_year
          AND be.status IN ('APPROVED', 'REVISED')
          AND (p_cost_center_id IS NULL OR be.cost_center_id = p_cost_center_id)
        GROUP BY be.cost_center_id, bli.gl_account_code
    ),
    commit_agg AS (
        SELECT
            bc.cost_center_id,
            bc.gl_account_code,
            SUM(bc.remaining_commitment) AS total_committed
        FROM public.budget_commitments bc
        WHERE bc.status IN ('OPEN', 'PARTIALLY_RELIEVED')
          AND (p_cost_center_id IS NULL OR bc.cost_center_id = p_cost_center_id)
        GROUP BY bc.cost_center_id, bc.gl_account_code
    ),
    actual_agg AS (
        SELECT
            cca.cost_center_id,
            coa.account_number AS gl_account_code,
            SUM(cca.allocated_amount) AS total_actual
        FROM public.cost_center_allocations cca
        JOIN public.journal_entry_lines jel ON jel.id = cca.journal_line_id
        JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
        WHERE (p_cost_center_id IS NULL OR cca.cost_center_id = p_cost_center_id)
        GROUP BY cca.cost_center_id, coa.account_number
    ),
    all_keys AS (
        SELECT b.cost_center_id, b.gl_account_code FROM budget_agg b
        UNION
        SELECT c.cost_center_id, c.gl_account_code FROM commit_agg c
        UNION
        SELECT a.cost_center_id, a.gl_account_code FROM actual_agg a
    )
    SELECT
        ak.cost_center_id,
        cc.code AS cost_center_code,
        cc.name AS cost_center_name,
        cc.department,
        ak.gl_account_code,
        COALESCE(ba.total_budget, 0.00) AS budget_allocated,
        COALESCE(ca.total_committed, 0.00) AS committed_amount,
        COALESCE(aa.total_actual, 0.00) AS actual_spent,
        (COALESCE(ba.total_budget, 0.00) - COALESCE(ca.total_committed, 0.00) - COALESCE(aa.total_actual, 0.00)) AS available_headroom,
        (COALESCE(ba.total_budget, 0.00) - COALESCE(aa.total_actual, 0.00)) AS variance_amount,
        CASE 
            WHEN COALESCE(ba.total_budget, 0.00) > 0 
            THEN ROUND((COALESCE(aa.total_actual, 0.00) / ba.total_budget * 100), 2)
            ELSE 0.00 
        END AS utilization_pct,
        CASE
            WHEN COALESCE(ba.total_budget, 0.00) > 0 AND (COALESCE(aa.total_actual, 0.00) / ba.total_budget) > 0.90 THEN 'CRITICAL'
            WHEN COALESCE(ba.total_budget, 0.00) > 0 AND (COALESCE(aa.total_actual, 0.00) / ba.total_budget) >= 0.70 THEN 'WATCH'
            ELSE 'HEALTHY'
        END AS status
    FROM all_keys ak
    JOIN public.cost_centers cc ON cc.id = ak.cost_center_id
    LEFT JOIN budget_agg ba ON ba.cost_center_id = ak.cost_center_id AND ba.gl_account_code = ak.gl_account_code
    LEFT JOIN commit_agg ca ON ca.cost_center_id = ak.cost_center_id AND ca.gl_account_code = ak.gl_account_code
    LEFT JOIN actual_agg aa ON aa.cost_center_id = ak.cost_center_id AND aa.gl_account_code = ak.gl_account_code
    ORDER BY cc.department, cc.code, ak.gl_account_code;
END;
$$;

-- H. fn_allocate_journal_line_to_cost_center
CREATE OR REPLACE FUNCTION public.fn_allocate_journal_line_to_cost_center(
    p_journal_line_id UUID,
    p_cost_center_id UUID,
    p_percentage NUMERIC DEFAULT 100.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_line RECORD;
    v_je RECORD;
    v_allocated_amt NUMERIC(15, 2);
    v_existing_total NUMERIC(15, 2) := 0.00;
    v_base_amt NUMERIC(15, 2);
    v_alloc_id UUID;
BEGIN
    SELECT * INTO v_line FROM public.journal_entry_lines WHERE id = p_journal_line_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Journal line not found: %', p_journal_line_id;
    END IF;

    SELECT * INTO v_je FROM public.journal_entries WHERE id = v_line.journal_entry_id;
    
    -- Check locked accounting period
    IF EXISTS (
        SELECT 1 FROM public.accounting_periods 
        WHERE id = v_je.accounting_period_id AND status = 'LOCKED'
    ) THEN
        RAISE EXCEPTION 'Cannot modify allocations in a LOCKED accounting period';
    END IF;

    IF p_percentage <= 0 OR p_percentage > 100 THEN
        RAISE EXCEPTION 'Allocation percentage must be between 0 and 100: %', p_percentage;
    END IF;

    v_base_amt := GREATEST(v_line.debit_amount, v_line.credit_amount);
    v_allocated_amt := ROUND(v_base_amt * (p_percentage / 100.0), 2);

    -- Check total allocations do not exceed line amount
    SELECT COALESCE(SUM(allocated_amount), 0.00) INTO v_existing_total
    FROM public.cost_center_allocations
    WHERE journal_line_id = p_journal_line_id
      AND cost_center_id <> p_cost_center_id;

    IF (v_existing_total + v_allocated_amt) > v_base_amt THEN
        RAISE EXCEPTION 'Allocation total (₹%) exceeds journal line total (₹%)', 
            (v_existing_total + v_allocated_amt), v_base_amt;
    END IF;

    -- Upsert allocation
    INSERT INTO public.cost_center_allocations (
        tenant_id, journal_line_id, cost_center_id, allocated_amount, allocation_percentage
    ) VALUES (
        'default', p_journal_line_id, p_cost_center_id, v_allocated_amt, p_percentage
    ) ON CONFLICT (journal_line_id, cost_center_id) DO UPDATE SET
        allocated_amount = EXCLUDED.allocated_amount,
        allocation_percentage = EXCLUDED.allocation_percentage
    RETURNING id INTO v_alloc_id;

    -- Record Audit Event
    INSERT INTO public.budget_audit_events (
        tenant_id, event_type, entity_id, entity_type, actor_id, details
    ) VALUES (
        'default', 'ALLOCATION_POSTED', v_alloc_id, 'cost_center_allocations', auth.uid(),
        jsonb_build_object(
            'journal_line_id', p_journal_line_id,
            'cost_center_id', p_cost_center_id,
            'allocated_amount', v_allocated_amt,
            'percentage', p_percentage
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'allocation_id', v_alloc_id,
        'allocated_amount', v_allocated_amt,
        'percentage', p_percentage
    );
END;
$$;

-- =============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_center_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_audit_events ENABLE ROW LEVEL SECURITY;

-- Helper check
CREATE OR REPLACE FUNCTION public.fn_is_finance_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.get_current_user_role() IN ('super_admin', 'admin', 'finance', 'cfo', 'accounting');
$$;

-- A. cost_centers policies
DROP POLICY IF EXISTS p_cost_centers_select ON public.cost_centers;
CREATE POLICY p_cost_centers_select ON public.cost_centers
    FOR SELECT TO authenticated
    USING (
        public.fn_is_finance_or_admin()
        OR manager_id = auth.uid()
        OR true -- Authorized staff can view cost centers for tagging
    );

DROP POLICY IF EXISTS p_cost_centers_modify ON public.cost_centers;
CREATE POLICY p_cost_centers_modify ON public.cost_centers
    FOR ALL TO authenticated
    USING (public.fn_is_finance_or_admin())
    WITH CHECK (public.fn_is_finance_or_admin());

-- B. budget_envelopes policies
DROP POLICY IF EXISTS p_budget_envelopes_select ON public.budget_envelopes;
CREATE POLICY p_budget_envelopes_select ON public.budget_envelopes
    FOR SELECT TO authenticated
    USING (
        public.fn_is_finance_or_admin()
        OR cost_center_id IN (SELECT id FROM public.cost_centers WHERE manager_id = auth.uid())
    );

DROP POLICY IF EXISTS p_budget_envelopes_modify ON public.budget_envelopes;
CREATE POLICY p_budget_envelopes_modify ON public.budget_envelopes
    FOR ALL TO authenticated
    USING (public.fn_is_finance_or_admin())
    WITH CHECK (public.fn_is_finance_or_admin());

-- C. budget_line_items policies
DROP POLICY IF EXISTS p_budget_line_items_select ON public.budget_line_items;
CREATE POLICY p_budget_line_items_select ON public.budget_line_items
    FOR SELECT TO authenticated
    USING (
        public.fn_is_finance_or_admin()
        OR budget_envelope_id IN (
            SELECT be.id FROM public.budget_envelopes be
            JOIN public.cost_centers cc ON cc.id = be.cost_center_id
            WHERE cc.manager_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS p_budget_line_items_modify ON public.budget_line_items;
CREATE POLICY p_budget_line_items_modify ON public.budget_line_items
    FOR ALL TO authenticated
    USING (public.fn_is_finance_or_admin())
    WITH CHECK (public.fn_is_finance_or_admin());

-- D. budget_commitments policies
DROP POLICY IF EXISTS p_budget_commitments_select ON public.budget_commitments;
CREATE POLICY p_budget_commitments_select ON public.budget_commitments
    FOR SELECT TO authenticated
    USING (
        public.fn_is_finance_or_admin()
        OR cost_center_id IN (SELECT id FROM public.cost_centers WHERE manager_id = auth.uid())
    );

DROP POLICY IF EXISTS p_budget_commitments_modify ON public.budget_commitments;
CREATE POLICY p_budget_commitments_modify ON public.budget_commitments
    FOR ALL TO authenticated
    USING (public.fn_is_finance_or_admin())
    WITH CHECK (public.fn_is_finance_or_admin());

-- E. cost_center_allocations policies
DROP POLICY IF EXISTS p_cost_center_allocations_select ON public.cost_center_allocations;
CREATE POLICY p_cost_center_allocations_select ON public.cost_center_allocations
    FOR SELECT TO authenticated
    USING (public.fn_is_finance_or_admin());

DROP POLICY IF EXISTS p_cost_center_allocations_modify ON public.cost_center_allocations;
CREATE POLICY p_cost_center_allocations_modify ON public.cost_center_allocations
    FOR ALL TO authenticated
    USING (public.fn_is_finance_or_admin())
    WITH CHECK (public.fn_is_finance_or_admin());

-- F. budget_audit_events policies (APPEND ONLY)
DROP POLICY IF EXISTS p_budget_audit_events_select ON public.budget_audit_events;
CREATE POLICY p_budget_audit_events_select ON public.budget_audit_events
    FOR SELECT TO authenticated
    USING (public.fn_is_finance_or_admin());

DROP POLICY IF EXISTS p_budget_audit_events_insert ON public.budget_audit_events;
CREATE POLICY p_budget_audit_events_insert ON public.budget_audit_events
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Revoke all modifications on audit log
REVOKE UPDATE, DELETE ON public.budget_audit_events FROM PUBLIC, authenticated, anon;
