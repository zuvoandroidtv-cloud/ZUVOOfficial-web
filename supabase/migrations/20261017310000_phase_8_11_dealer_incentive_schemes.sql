-- =============================================================================
-- ZUVO TV CRM — PHASE 8.11 MASTER DATABASE MIGRATION
-- Enterprise Dealer Commercial Incentives, Volume Rebate Slabs,
-- Target Accruals & Statutory Trade Discount Settlement Governance
-- Filename: 20261017310000_phase_8_11_dealer_incentive_schemes.sql
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. SEED COA ACCOUNTS FOR INCENTIVE SCHEME ACCRUALS & REBATES
-- =============================================================================
INSERT INTO public.chart_of_accounts 
(account_number, account_name, account_type, account_subtype, normal_balance, is_system_account, system_control_type, description)
VALUES
('2150', 'Provision for Dealer Scheme Rebates & Incentives', 'LIABILITY', 'PAYABLES', 'CREDIT', true, NULL, 'Accrued liability for volume and revenue trade rebates to dealers'),
('5150', 'Dealer Commercial Schemes & Rebates Expense', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, NULL, 'Volume discounts, festival scheme bonuses, and dealer performance rebates')
ON CONFLICT (account_number) DO NOTHING;

-- =============================================================================
-- 2. SEQUENCES FOR CONCURRENCY-SAFE NUMBERING
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_dealer_scheme_code
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_dealer_settlement_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 3. TABLE: public.dealer_scheme_programs
-- Master definition of dealer commercial incentive and rebate schemes
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.dealer_scheme_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    scheme_code TEXT NOT NULL,
    scheme_name TEXT NOT NULL,
    description TEXT NULL,
    scheme_type TEXT NOT NULL CHECK (
        scheme_type IN ('VOLUME_REBATE', 'REVENUE_REBATE', 'TARGET_INCENTIVE', 'FESTIVAL_SCHEME', 'PRODUCT_MIX_INCENTIVE')
    ),
    eligibility_tier TEXT NOT NULL DEFAULT 'ALL' CHECK (
        eligibility_tier IN ('ALL', 'TIER_1_PLATINUM', 'TIER_2_GOLD', 'TIER_3_SILVER', 'SELECT_DEALERS')
    ),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    settlement_method TEXT NOT NULL DEFAULT 'AR_CREDIT_MEMO' CHECK (
        settlement_method IN ('AR_CREDIT_MEMO', 'BANK_TRANSFER', 'COMMERCIAL_CREDIT_NOTE')
    ),
    accounting_treatment TEXT NOT NULL DEFAULT 'ACCRUAL_MATCHING' CHECK (
        accounting_treatment IN ('ACCRUAL_MATCHING', 'CASH_SETTLEMENT')
    ),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'SETTLED', 'CANCELLED')
    ),
    budget_allocated NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (budget_allocated >= 0),
    total_accrued_liability NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_accrued_liability >= 0),
    total_settled_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_settled_amount >= 0),
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_dealer_scheme_code_tenant UNIQUE (tenant_id, scheme_code),
    CONSTRAINT chk_scheme_dates CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_dealer_schemes_tenant ON public.dealer_scheme_programs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dealer_schemes_type ON public.dealer_scheme_programs(scheme_type);
CREATE INDEX IF NOT EXISTS idx_dealer_schemes_dates ON public.dealer_scheme_programs(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_dealer_schemes_status ON public.dealer_scheme_programs(status);

-- =============================================================================
-- 4. TABLE: public.dealer_scheme_slabs
-- Tiered incentive rules and qualification thresholds
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.dealer_scheme_slabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    scheme_id UUID NOT NULL REFERENCES public.dealer_scheme_programs(id) ON DELETE CASCADE,
    slab_sequence INT NOT NULL CHECK (slab_sequence > 0),
    slab_name TEXT NOT NULL,
    min_qualifying_units INT NOT NULL DEFAULT 0 CHECK (min_qualifying_units >= 0),
    max_qualifying_units INT NULL CHECK (max_qualifying_units IS NULL OR max_qualifying_units >= min_qualifying_units),
    min_qualifying_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (min_qualifying_revenue >= 0),
    max_qualifying_revenue NUMERIC(14, 2) NULL CHECK (max_qualifying_revenue IS NULL OR max_qualifying_revenue >= min_qualifying_revenue),
    rebate_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (rebate_percentage >= 0 AND rebate_percentage <= 100),
    fixed_rebate_per_unit NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (fixed_rebate_per_unit >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_scheme_slab_seq UNIQUE (scheme_id, slab_sequence)
);

CREATE INDEX IF NOT EXISTS idx_scheme_slabs_scheme ON public.dealer_scheme_slabs(scheme_id);

-- =============================================================================
-- 5. TABLE: public.dealer_scheme_enrollments
-- Dealer assignments, targets, live achievements, and current slab attainment
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.dealer_scheme_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    scheme_id UUID NOT NULL REFERENCES public.dealer_scheme_programs(id) ON DELETE CASCADE,
    dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
    target_units INT NOT NULL DEFAULT 0 CHECK (target_units >= 0),
    target_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (target_revenue >= 0),
    current_qualifying_units INT NOT NULL DEFAULT 0 CHECK (current_qualifying_units >= 0),
    current_qualifying_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (current_qualifying_revenue >= 0),
    current_slab_id UUID NULL REFERENCES public.dealer_scheme_slabs(id) ON DELETE SET NULL,
    current_earned_rebate NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (current_earned_rebate >= 0),
    status TEXT NOT NULL DEFAULT 'ENROLLED' CHECK (
        status IN ('ENROLLED', 'DISQUALIFIED', 'ACHIEVED', 'SETTLED', 'CANCELLED')
    ),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_evaluated_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_dealer_scheme_enrollment UNIQUE (scheme_id, dealer_id)
);

CREATE INDEX IF NOT EXISTS idx_scheme_enrollments_scheme ON public.dealer_scheme_enrollments(scheme_id);
CREATE INDEX IF NOT EXISTS idx_scheme_enrollments_dealer ON public.dealer_scheme_enrollments(dealer_id);

-- =============================================================================
-- 6. TABLE: public.dealer_scheme_accruals
-- Period-end accounting provision for earned dealer incentives
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.dealer_scheme_accruals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    scheme_id UUID NOT NULL REFERENCES public.dealer_scheme_programs(id) ON DELETE RESTRICT,
    dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
    accounting_period_id UUID NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    qualifying_units INT NOT NULL DEFAULT 0 CHECK (qualifying_units >= 0),
    qualifying_sales_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (qualifying_sales_value >= 0),
    applicable_slab_id UUID NULL REFERENCES public.dealer_scheme_slabs(id) ON DELETE SET NULL,
    accrued_amount NUMERIC(14, 2) NOT NULL CHECK (accrued_amount >= 0),
    prior_accrual NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (prior_accrual >= 0),
    incremental_accrual NUMERIC(14, 2) NOT NULL CHECK (incremental_accrual >= 0),
    journal_entry_id UUID NULL REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED', 'SETTLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_scheme_dealer_period UNIQUE (scheme_id, dealer_id, accounting_period_id)
);

CREATE INDEX IF NOT EXISTS idx_scheme_accruals_scheme ON public.dealer_scheme_accruals(scheme_id);
CREATE INDEX IF NOT EXISTS idx_scheme_accruals_dealer ON public.dealer_scheme_accruals(dealer_id);
CREATE INDEX IF NOT EXISTS idx_scheme_accruals_period ON public.dealer_scheme_accruals(accounting_period_id);

-- =============================================================================
-- 7. TABLE: public.dealer_scheme_settlements
-- Adjudicated settlement disbursement records and AR credit allocations
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.dealer_scheme_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    settlement_number TEXT NOT NULL,
    scheme_id UUID NOT NULL REFERENCES public.dealer_scheme_programs(id) ON DELETE RESTRICT,
    dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
    settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    qualifying_units INT NOT NULL CHECK (qualifying_units >= 0),
    qualifying_revenue NUMERIC(14, 2) NOT NULL CHECK (qualifying_revenue >= 0),
    eligible_amount NUMERIC(14, 2) NOT NULL CHECK (eligible_amount >= 0),
    deductions NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (deductions >= 0),
    final_payout NUMERIC(14, 2) NOT NULL CHECK (final_payout >= 0),
    settlement_method TEXT NOT NULL DEFAULT 'AR_CREDIT_MEMO' CHECK (
        settlement_method IN ('AR_CREDIT_MEMO', 'BANK_TRANSFER', 'COMMERCIAL_CREDIT_NOTE')
    ),
    ar_transaction_id UUID NULL REFERENCES public.customer_ar_transactions(id) ON DELETE SET NULL,
    statutory_credit_note_id UUID NULL REFERENCES public.statutory_credit_notes(id) ON DELETE SET NULL,
    journal_entry_id UUID NULL REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    approval_status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (
        approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')
    ),
    approved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NULL,
    settlement_status TEXT NOT NULL DEFAULT 'SETTLED' CHECK (
        settlement_status IN ('PENDING', 'PROCESSING', 'SETTLED', 'CANCELLED')
    ),
    notes TEXT NULL,
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_dealer_settlement_number_tenant UNIQUE (tenant_id, settlement_number),
    CONSTRAINT chk_settlement_final_le_eligible CHECK (final_payout <= eligible_amount)
);

CREATE INDEX IF NOT EXISTS idx_scheme_settlements_scheme ON public.dealer_scheme_settlements(scheme_id);
CREATE INDEX IF NOT EXISTS idx_scheme_settlements_dealer ON public.dealer_scheme_settlements(dealer_id);
CREATE INDEX IF NOT EXISTS idx_scheme_settlements_status ON public.dealer_scheme_settlements(settlement_status);

-- =============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.dealer_scheme_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_scheme_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_scheme_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_scheme_accruals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_scheme_settlements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.dealer_scheme_programs FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.dealer_scheme_slabs FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.dealer_scheme_enrollments FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.dealer_scheme_accruals FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.dealer_scheme_settlements FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealer_scheme_programs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealer_scheme_slabs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealer_scheme_enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealer_scheme_accruals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealer_scheme_settlements TO authenticated;

-- Dealer Isolation Policy: Dealers can view only schemes they are enrolled in and their own statements
CREATE POLICY p_dealer_schemes_select ON public.dealer_scheme_programs
    FOR SELECT TO authenticated
    USING (
        (auth.jwt()->>'role') IN ('super_admin', 'admin', 'sales', 'finance') OR
        (status = 'ACTIVE' AND id IN (
            SELECT scheme_id FROM public.dealer_scheme_enrollments
            WHERE dealer_id IN (SELECT id FROM public.dealers WHERE email = auth.jwt()->>'email')
        ))
    );

CREATE POLICY p_dealer_slabs_select ON public.dealer_scheme_slabs
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY p_dealer_enrollments_select ON public.dealer_scheme_enrollments
    FOR SELECT TO authenticated
    USING (
        (auth.jwt()->>'role') IN ('super_admin', 'admin', 'sales', 'finance') OR
        (dealer_id IN (SELECT id FROM public.dealers WHERE email = auth.jwt()->>'email'))
    );

CREATE POLICY p_dealer_settlements_select ON public.dealer_scheme_settlements
    FOR SELECT TO authenticated
    USING (
        (auth.jwt()->>'role') IN ('super_admin', 'admin', 'sales', 'finance') OR
        (dealer_id IN (SELECT id FROM public.dealers WHERE email = auth.jwt()->>'email'))
    );

CREATE POLICY p_dealer_accruals_select ON public.dealer_scheme_accruals
    FOR SELECT TO authenticated
    USING ((auth.jwt()->>'role') IN ('super_admin', 'admin', 'finance'));

-- =============================================================================
-- 9. RPC: fn_evaluate_dealer_scheme_progress
-- Evaluates verified qualifying sales, deducts returned units, and assigns slab
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_evaluate_dealer_scheme_progress(
    p_scheme_id UUID,
    p_dealer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_scheme RECORD;
    v_enrollment RECORD;
    v_qualifying_units INT := 0;
    v_qualifying_rev NUMERIC(14, 2) := 0.00;
    v_returned_units INT := 0;
    v_returned_rev NUMERIC(14, 2) := 0.00;
    v_net_units INT := 0;
    v_net_rev NUMERIC(14, 2) := 0.00;
    v_attained_slab RECORD;
    v_earned_rebate NUMERIC(14, 2) := 0.00;
BEGIN
    SELECT * INTO v_scheme FROM public.dealer_scheme_programs WHERE id = p_scheme_id;
    IF v_scheme.id IS NULL THEN
        RAISE EXCEPTION 'Scheme program not found.';
    END IF;

    -- 1. Compute gross delivered sales during scheme active dates
    SELECT 
        COALESCE(COUNT(pu.id), 0),
        COALESCE(SUM(soi.unit_price), 0.00)
    INTO v_qualifying_units, v_qualifying_rev
    FROM public.sales_orders so
    JOIN public.sales_order_items soi ON so.id = soi.sales_order_id
    JOIN public.sales_order_reservations sor ON soi.id = sor.sales_order_item_id
    JOIN public.product_units pu ON sor.product_unit_id = pu.id
    WHERE so.dealer_id = p_dealer_id
      AND so.status IN ('DISPATCHED', 'DELIVERED')
      AND so.order_date BETWEEN v_scheme.start_date AND v_scheme.end_date;

    -- 2. Subtract commercial returns (Phase 8.10 integration)
    SELECT 
        COALESCE(COUNT(ri.id), 0),
        COALESCE(SUM(ri.return_taxable_value), 0.00)
    INTO v_returned_units, v_returned_rev
    FROM public.commercial_sales_returns r
    JOIN public.commercial_sales_return_items ri ON r.id = ri.commercial_return_id
    WHERE r.dealer_id = p_dealer_id
      AND r.status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'CREDIT_NOTE_ISSUED')
      AND r.requested_date BETWEEN v_scheme.start_date AND v_scheme.end_date
      AND ri.item_status = 'ACCEPTED';

    v_net_units := GREATEST(0, v_qualifying_units - v_returned_units);
    v_net_rev := GREATEST(0.00, v_qualifying_rev - v_returned_rev);

    -- 3. Evaluate matching slab
    SELECT * INTO v_attained_slab
    FROM public.dealer_scheme_slabs
    WHERE scheme_id = p_scheme_id
      AND v_net_units >= min_qualifying_units
      AND (max_qualifying_units IS NULL OR v_net_units <= max_qualifying_units)
      AND v_net_rev >= min_qualifying_revenue
      AND (max_qualifying_revenue IS NULL OR v_net_rev <= max_qualifying_revenue)
    ORDER BY slab_sequence DESC
    LIMIT 1;

    IF v_attained_slab.id IS NOT NULL THEN
        IF v_attained_slab.rebate_percentage > 0 THEN
            v_earned_rebate := round(v_net_rev * (v_attained_slab.rebate_percentage / 100.0), 2);
        END IF;
        IF v_attained_slab.fixed_rebate_per_unit > 0 THEN
            v_earned_rebate := v_earned_rebate + (v_net_units * v_attained_slab.fixed_rebate_per_unit);
        END IF;
    END IF;

    -- Update enrollment record
    UPDATE public.dealer_scheme_enrollments
    SET current_qualifying_units = v_net_units,
        current_qualifying_revenue = v_net_rev,
        current_slab_id = v_attained_slab.id,
        current_earned_rebate = v_earned_rebate,
        last_evaluated_at = now()
    WHERE scheme_id = p_scheme_id AND dealer_id = p_dealer_id;

    RETURN jsonb_build_object(
        'success', true,
        'scheme_id', p_scheme_id,
        'dealer_id', p_dealer_id,
        'gross_units', v_qualifying_units,
        'returned_units', v_returned_units,
        'net_qualifying_units', v_net_units,
        'net_qualifying_revenue', v_net_rev,
        'attained_slab_id', v_attained_slab.id,
        'slab_name', v_attained_slab.slab_name,
        'earned_rebate', v_earned_rebate
    );
END;
$$;

-- =============================================================================
-- 10. RPC: fn_post_monthly_scheme_accrual
-- Posts monthly matching provision into General Ledger via Phase 8.3 GL engine
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_post_monthly_scheme_accrual(
    p_scheme_id UUID,
    p_accounting_period_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_period RECORD;
    v_scheme RECORD;
    v_enr RECORD;
    v_prior_accrual NUMERIC(14, 2) := 0.00;
    v_incremental NUMERIC(14, 2) := 0.00;
    v_total_incremental NUMERIC(14, 2) := 0.00;
    v_eval_res JSONB;
    v_expense_acc_id UUID;
    v_provision_acc_id UUID;
    v_gl_lines JSONB;
    v_gl_post_res JSONB;
    v_journal_id UUID;
    v_dealers_accrued INT := 0;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'finance')
        ) THEN
            RAISE EXCEPTION 'Access denied: Only Finance and Administrative roles may post scheme accruals.';
        END IF;
    END IF;

    SELECT * INTO v_period FROM public.accounting_periods WHERE id = p_accounting_period_id;
    IF v_period.id IS NULL THEN
        RAISE EXCEPTION 'Accounting period not found.';
    END IF;
    IF v_period.status = 'LOCKED' THEN
        RAISE EXCEPTION 'Accounting period % is LOCKED. Postings prohibited.', v_period.period_name;
    END IF;

    SELECT * INTO v_scheme FROM public.dealer_scheme_programs WHERE id = p_scheme_id;
    IF v_scheme.id IS NULL THEN
        RAISE EXCEPTION 'Scheme program not found.';
    END IF;

    -- Look up COA accounts
    SELECT id INTO v_expense_acc_id FROM public.chart_of_accounts WHERE account_number = '5150';
    SELECT id INTO v_provision_acc_id FROM public.chart_of_accounts WHERE account_number = '2150';

    -- Loop through enrolled dealers and compute incremental accruals
    FOR v_enr IN SELECT * FROM public.dealer_scheme_enrollments WHERE scheme_id = p_scheme_id
    LOOP
        -- Re-evaluate current progress
        v_eval_res := public.fn_evaluate_dealer_scheme_progress(p_scheme_id, v_enr.dealer_id);

        -- Find previous accruals for this dealer and scheme
        SELECT COALESCE(SUM(incremental_accrual), 0.00) INTO v_prior_accrual
        FROM public.dealer_scheme_accruals
        WHERE scheme_id = p_scheme_id AND dealer_id = v_enr.dealer_id AND status = 'POSTED';

        v_incremental := GREATEST(0.00, (v_eval_res->>'earned_rebate')::numeric - v_prior_accrual);

        IF v_incremental > 0 THEN
            INSERT INTO public.dealer_scheme_accruals (
                scheme_id,
                dealer_id,
                accounting_period_id,
                qualifying_units,
                qualifying_sales_value,
                applicable_slab_id,
                accrued_amount,
                prior_accrual,
                incremental_accrual,
                status
            ) VALUES (
                p_scheme_id,
                v_enr.dealer_id,
                p_accounting_period_id,
                (v_eval_res->>'net_qualifying_units')::int,
                (v_eval_res->>'net_qualifying_revenue')::numeric,
                (v_eval_res->>'attained_slab_id')::uuid,
                (v_eval_res->>'earned_rebate')::numeric,
                v_prior_accrual,
                v_incremental,
                'POSTED'
            );

            v_total_incremental := v_total_incremental + v_incremental;
            v_dealers_accrued := v_dealers_accrued + 1;
        END IF;
    END LOOP;

    -- If incremental accrual occurred, post balanced double-entry GL journal entry
    -- Dr Dealer Scheme Expense (5150)
    -- Cr Provision for Dealer Rebates (2150)
    IF v_total_incremental > 0 THEN
        v_gl_lines := jsonb_build_array(
            jsonb_build_object(
                'account_id', v_expense_acc_id,
                'debit_amount', v_total_incremental,
                'credit_amount', 0.00,
                'description', 'Monthly Trade Scheme Accrual Provision for ' || v_scheme.scheme_code
            ),
            jsonb_build_object(
                'account_id', v_provision_acc_id,
                'debit_amount', 0.00,
                'credit_amount', v_total_incremental,
                'description', 'Accrued Dealer Scheme Liability for ' || v_scheme.scheme_code
            )
        );

        v_gl_post_res := public.fn_post_journal_entry(jsonb_build_object(
            'entry_date', CURRENT_DATE,
            'source_document_type', 'COMMERCIAL_INVOICE',
            'source_document_reference_id', p_scheme_id,
            'narration', 'Trade Rebate Accrual for Scheme ' || v_scheme.scheme_code || ' in period ' || v_period.period_name,
            'lines', v_gl_lines
        ));

        v_journal_id := (v_gl_post_res->>'journal_entry_id')::uuid;

        -- Update accrual records with journal ID
        UPDATE public.dealer_scheme_accruals
        SET journal_entry_id = v_journal_id
        WHERE scheme_id = p_scheme_id AND accounting_period_id = p_accounting_period_id AND journal_entry_id IS NULL;

        -- Update scheme cumulative liability
        UPDATE public.dealer_scheme_programs
        SET total_accrued_liability = total_accrued_liability + v_total_incremental,
            updated_at = now()
        WHERE id = p_scheme_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'scheme_id', p_scheme_id,
        'period_id', p_accounting_period_id,
        'dealers_accrued', v_dealers_accrued,
        'total_incremental_accrued', v_total_incremental,
        'journal_entry_id', v_journal_id
    );
END;
$$;

-- =============================================================================
-- 11. RPC: fn_settle_dealer_scheme_payout
-- Adjudicates earned rebate, offsets open customer AR, and derecognizes provision
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_settle_dealer_scheme_payout(p_settlement_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_scheme_id UUID;
    v_dealer_id UUID;
    v_enr RECORD;
    v_scheme RECORD;
    v_eligible NUMERIC(14, 2);
    v_deductions NUMERIC(14, 2);
    v_final NUMERIC(14, 2);
    v_method TEXT;
    v_notes TEXT;
    v_settle_num TEXT;
    v_seq_val BIGINT;
    v_settle_id UUID;
    v_ar_rec RECORD;
    v_ar_tx_id UUID;
    v_provision_acc_id UUID;
    v_ar_acc_id UUID;
    v_bank_acc_id UUID;
    v_gl_lines JSONB;
    v_gl_res JSONB;
    v_journal_id UUID;
BEGIN
    v_actor_id := auth.uid();
    v_scheme_id := (p_settlement_data->>'scheme_id')::uuid;
    v_dealer_id := (p_settlement_data->>'dealer_id')::uuid;
    v_deductions := COALESCE((p_settlement_data->>'deductions')::numeric, 0.00);
    v_method := COALESCE(p_settlement_data->>'settlement_method', 'AR_CREDIT_MEMO');
    v_notes := p_settlement_data->>'notes';

    SELECT * INTO v_scheme FROM public.dealer_scheme_programs WHERE id = v_scheme_id;
    IF v_scheme.id IS NULL THEN
        RAISE EXCEPTION 'Scheme program not found.';
    END IF;

    SELECT * INTO v_enr FROM public.dealer_scheme_enrollments WHERE scheme_id = v_scheme_id AND dealer_id = v_dealer_id;
    IF v_enr.id IS NULL THEN
        RAISE EXCEPTION 'Dealer is not enrolled in this scheme.';
    END IF;

    v_eligible := v_enr.current_earned_rebate;
    v_final := GREATEST(0.00, v_eligible - v_deductions);

    IF v_final <= 0 THEN
        RAISE EXCEPTION 'Eligible payout after deductions is zero or negative.';
    END IF;

    -- Concurrency-safe settlement number
    v_seq_val := nextval('public.seq_dealer_settlement_number');
    v_settle_num := 'STL-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_seq_val::text, 4, '0');

    -- Insert settlement header
    INSERT INTO public.dealer_scheme_settlements (
        settlement_number,
        scheme_id,
        dealer_id,
        qualifying_units,
        qualifying_revenue,
        eligible_amount,
        deductions,
        final_payout,
        settlement_method,
        notes,
        created_by
    ) VALUES (
        v_settle_num,
        v_scheme_id,
        v_dealer_id,
        v_enr.current_qualifying_units,
        v_enr.current_qualifying_revenue,
        v_eligible,
        v_deductions,
        v_final,
        v_method,
        v_notes,
        v_actor_id
    ) RETURNING id INTO v_settle_id;

    -- Look up COA Accounts
    SELECT id INTO v_provision_acc_id FROM public.chart_of_accounts WHERE account_number = '2150';
    SELECT id INTO v_ar_acc_id FROM public.chart_of_accounts WHERE account_number = '1100';
    SELECT id INTO v_bank_acc_id FROM public.chart_of_accounts WHERE account_number = '1010';

    -- 1. If settlement method is AR_CREDIT_MEMO, credit open dealer receivable balance
    IF v_method = 'AR_CREDIT_MEMO' THEN
        SELECT * INTO v_ar_rec 
        FROM public.customer_ar_ledger 
        WHERE dealer_id = v_dealer_id AND status IN ('OPEN', 'PARTIALLY_SETTLED')
        ORDER BY due_date ASC LIMIT 1;

        IF v_ar_rec.id IS NOT NULL THEN
            INSERT INTO public.customer_ar_transactions (
                ar_ledger_id,
                transaction_type,
                amount,
                reference_id,
                actor,
                notes
            ) VALUES (
                v_ar_rec.id,
                'CREDIT_MEMO_OFFSET',
                v_final,
                v_settle_num,
                v_actor_id,
                'Trade rebate scheme credit memo offset for ' || v_scheme.scheme_code
            ) RETURNING id INTO v_ar_tx_id;

            UPDATE public.customer_ar_ledger
            SET settled_amount = round(settled_amount + v_final, 2),
                remaining_balance = round(GREATEST(remaining_balance - v_final, 0.00), 2),
                status = CASE WHEN (remaining_balance - v_final) <= 0 THEN 'SETTLED' ELSE 'PARTIALLY_SETTLED' END,
                updated_at = now()
            WHERE id = v_ar_rec.id;
        END IF;

        -- GL: Dr Provision for Dealer Rebates (2150) = Cr AR Control (1100)
        v_gl_lines := jsonb_build_array(
            jsonb_build_object(
                'account_id', v_provision_acc_id,
                'debit_amount', v_final,
                'credit_amount', 0.00,
                'description', 'Derecognize Scheme Provision for ' || v_settle_num
            ),
            jsonb_build_object(
                'account_id', v_ar_acc_id,
                'debit_amount', 0.00,
                'credit_amount', v_final,
                'description', 'AR Credit Offset for Settlement ' || v_settle_num
            )
        );
    ELSE
        -- GL: Dr Provision for Dealer Rebates (2150) = Cr Bank Account (1010)
        v_gl_lines := jsonb_build_array(
            jsonb_build_object(
                'account_id', v_provision_acc_id,
                'debit_amount', v_final,
                'credit_amount', 0.00,
                'description', 'Derecognize Scheme Provision for ' || v_settle_num
            ),
            jsonb_build_object(
                'account_id', v_bank_acc_id,
                'debit_amount', 0.00,
                'credit_amount', v_final,
                'description', 'Bank Disbursal for Settlement ' || v_settle_num
            )
        );
    END IF;

    -- Post balanced settlement journal entry
    v_gl_res := public.fn_post_journal_entry(jsonb_build_object(
        'entry_date', CURRENT_DATE,
        'source_document_type', 'COMMERCIAL_INVOICE',
        'source_document_reference_id', v_settle_id,
        'narration', 'Trade Rebate Settlement ' || v_settle_num || ' for scheme ' || v_scheme.scheme_code,
        'lines', v_gl_lines
    ));

    v_journal_id := (v_gl_res->>'journal_entry_id')::uuid;

    UPDATE public.dealer_scheme_settlements
    SET journal_entry_id = v_journal_id,
        ar_transaction_id = v_ar_tx_id,
        settlement_status = 'SETTLED',
        approved_at = now(),
        updated_at = now()
    WHERE id = v_settle_id;

    -- Update scheme cumulative settled total
    UPDATE public.dealer_scheme_programs
    SET total_settled_amount = total_settled_amount + v_final,
        updated_at = now()
    WHERE id = v_scheme_id;

    RETURN jsonb_build_object(
        'success', true,
        'settlement_id', v_settle_id,
        'settlement_number', v_settle_num,
        'final_payout', v_final,
        'journal_entry_id', v_journal_id,
        'ar_transaction_id', v_ar_tx_id
    );
END;
$$;
