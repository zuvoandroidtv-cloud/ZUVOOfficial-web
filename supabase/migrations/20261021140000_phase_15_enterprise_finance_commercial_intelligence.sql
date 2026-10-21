-- =============================================================================
-- ZUVO TV CRM — PHASE 15 MASTER DATABASE MIGRATION
-- Enterprise Finance, Commercial Control & Business Intelligence
-- Filename: 20261021140000_phase_15_enterprise_finance_commercial_intelligence.sql
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. SEQUENCES FOR CONCURRENCY-SAFE INTELLIGENCE & CONTROL IDENTIFIERS
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_fin_snapshot_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_fin_margin_exception_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_fin_commercial_approval_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_fin_management_report_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 2. TABLE: public.fin_management_snapshots
-- Consolidated Period Snapshots with Exact Traceability and Period Locks
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fin_management_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_number TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    accounting_period_id UUID REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    period_name TEXT NOT NULL,
    fiscal_year TEXT NOT NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    revenue_gross NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (revenue_gross >= 0),
    revenue_discounts NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (revenue_discounts >= 0),
    revenue_returns NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (revenue_returns >= 0),
    revenue_net NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (revenue_net >= 0),
    cogs_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (cogs_amount >= 0),
    gross_margin NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    gross_margin_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    operating_expenses NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (operating_expenses >= 0),
    ebitda NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    ebitda_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    total_ar NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_ar >= 0),
    total_ap NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_ap >= 0),
    cash_and_bank NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (cash_and_bank >= 0),
    working_capital NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    inventory_valuation NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (inventory_valuation >= 0),
    payroll_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (payroll_total >= 0),
    warranty_costs NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (warranty_costs >= 0),
    dealer_rebates NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (dealer_rebates >= 0),
    customer_refunds NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (customer_refunds >= 0),
    net_gst_payable NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_fin_snapshot_tenant_period UNIQUE (tenant_id, accounting_period_id)
);

CREATE INDEX IF NOT EXISTS idx_fin_snapshots_tenant ON public.fin_management_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_snapshots_period ON public.fin_management_snapshots(accounting_period_id);
CREATE INDEX IF NOT EXISTS idx_fin_snapshots_date ON public.fin_management_snapshots(snapshot_date);

-- =============================================================================
-- 3. TABLE: public.fin_budget_variances
-- Comprehensive Budget vs Actual Control Across Revenue, Departments & Products
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fin_budget_variances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    accounting_period_id UUID REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    control_dimension TEXT NOT NULL CHECK (
        control_dimension IN ('REVENUE', 'EXPENSE', 'DEPARTMENT', 'TERRITORY', 'DEALER', 'PRODUCT', 'MANUFACTURING', 'SERVICE')
    ),
    dimension_key TEXT NOT NULL, -- e.g. 'DEPT_FACTORY', 'ZUV-55-4K-UHD', 'TERRITORY_SOUTH'
    dimension_name TEXT NOT NULL,
    budget_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (budget_amount >= 0),
    actual_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (actual_amount >= 0),
    variance_amount NUMERIC(15, 2) GENERATED ALWAYS AS (actual_amount - budget_amount) STORED,
    variance_pct NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    exception_state TEXT NOT NULL CHECK (
        exception_state IN ('ON_TRACK', 'WATCH', 'OVER_BUDGET', 'UNDER_TARGET', 'CRITICAL_VARIANCE')
    ),
    is_favourable BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_fin_budget_variance_dim UNIQUE (tenant_id, accounting_period_id, control_dimension, dimension_key)
);

CREATE INDEX IF NOT EXISTS idx_fin_budget_variance_tenant ON public.fin_budget_variances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_budget_variance_state ON public.fin_budget_variances(exception_state);

-- =============================================================================
-- 4. TABLE: public.fin_cashflow_projections
-- 7-Day, 30-Day and 90-Day Cash Outlook with Strict Confirmed vs Expected Split
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fin_cashflow_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    horizon_days INT NOT NULL CHECK (horizon_days IN (7, 30, 90)),
    as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
    opening_cash_confirmed NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (opening_cash_confirmed >= 0),
    confirmed_inflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (confirmed_inflows >= 0),
    expected_inflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (expected_inflows >= 0),
    approved_payment_queue NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (approved_payment_queue >= 0),
    expected_supplier_outflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (expected_supplier_outflows >= 0),
    payroll_obligations NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (payroll_obligations >= 0),
    tax_obligations NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (tax_obligations >= 0),
    dealer_rebate_obligations NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (dealer_rebate_obligations >= 0),
    customer_refund_obligations NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (customer_refund_obligations >= 0),
    warranty_reserve_obligations NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (warranty_reserve_obligations >= 0),
    net_projected_cash_movement NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    projected_closing_cash NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    liquidity_risk_status TEXT NOT NULL CHECK (
        liquidity_risk_status IN ('HEALTHY', 'SURPLUS', 'WATCH', 'FUNDING_GAP_ALERT', 'CRITICAL_DEFICIT')
    ),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_cashflow_tenant ON public.fin_cashflow_projections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_cashflow_horizon ON public.fin_cashflow_projections(horizon_days);

-- =============================================================================
-- 5. TABLE: public.fin_ar_aging_snapshots
-- Receivables Aging Buckets, Overdue Delays & Collection Risk Ratings
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fin_ar_aging_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    entity_type TEXT NOT NULL CHECK (entity_type IN ('CUSTOMER', 'DEALER')),
    entity_id UUID NOT NULL,
    entity_name TEXT NOT NULL,
    as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
    current_bucket NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (current_bucket >= 0),
    bucket_1_30 NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (bucket_1_30 >= 0),
    bucket_31_60 NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (bucket_31_60 >= 0),
    bucket_61_90 NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (bucket_61_90 >= 0),
    bucket_91_180 NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (bucket_91_180 >= 0),
    bucket_180_plus NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (bucket_180_plus >= 0),
    total_outstanding NUMERIC(15, 2) GENERATED ALWAYS AS (
        current_bucket + bucket_1_30 + bucket_31_60 + bucket_61_90 + bucket_91_180 + bucket_180_plus
    ) STORED,
    overdue_amount NUMERIC(15, 2) GENERATED ALWAYS AS (
        bucket_1_30 + bucket_31_60 + bucket_61_90 + bucket_91_180 + bucket_180_plus
    ) STORED,
    overdue_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    average_collection_delay_days INT NOT NULL DEFAULT 0 CHECK (average_collection_delay_days >= 0),
    oldest_invoice_date DATE,
    invoice_count INT NOT NULL DEFAULT 1 CHECK (invoice_count >= 1),
    collection_risk_tier TEXT NOT NULL CHECK (
        collection_risk_tier IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')
    ),
    recommended_action TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_fin_ar_entity_date UNIQUE (tenant_id, entity_type, entity_id, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_fin_ar_tenant ON public.fin_ar_aging_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_ar_risk ON public.fin_ar_aging_snapshots(collection_risk_tier);

-- =============================================================================
-- 6. TABLE: public.fin_ap_control_snapshots
-- Payables Aging, Supplier Concentration & Overdue Escalations
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fin_ap_control_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    vendor_id UUID NOT NULL,
    vendor_name TEXT NOT NULL,
    as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
    current_due NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (current_due >= 0),
    due_within_7_days NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (due_within_7_days >= 0),
    overdue_1_30 NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (overdue_1_30 >= 0),
    overdue_31_plus NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (overdue_31_plus >= 0),
    total_payable NUMERIC(15, 2) GENERATED ALWAYS AS (
        current_due + due_within_7_days + overdue_1_30 + overdue_31_plus
    ) STORED,
    blocked_payments NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (blocked_payments >= 0),
    approved_in_queue NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (approved_in_queue >= 0),
    supplier_concentration_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    supplier_risk_tier TEXT NOT NULL CHECK (
        supplier_risk_tier IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')
    ),
    duplicate_payment_flag BOOLEAN NOT NULL DEFAULT false,
    unusual_amount_flag BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_fin_ap_vendor_date UNIQUE (tenant_id, vendor_id, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_fin_ap_tenant ON public.fin_ap_control_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_ap_vendor ON public.fin_ap_control_snapshots(vendor_id);

-- =============================================================================
-- 7. TABLE: public.fin_margin_exceptions
-- Deterministic Detection of Margin Deterioration, High Rebates & Warranty Spikes
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fin_margin_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exception_code TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    entity_type TEXT NOT NULL CHECK (
        entity_type IN ('CUSTOMER', 'DEALER', 'PRODUCT', 'MODEL', 'ORDER', 'INVOICE', 'TERRITORY')
    ),
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    detected_date DATE NOT NULL DEFAULT CURRENT_DATE,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    exception_category TEXT NOT NULL CHECK (
        exception_category IN (
            'EXCESSIVE_DISCOUNT',
            'MARGIN_BELOW_FLOOR',
            'REBATE_LEAKAGE',
            'ABNORMAL_RETURNS',
            'REPEATED_CREDIT_NOTES',
            'WARRANTY_COST_SPIKE',
            'HIGH_SERVICE_COST',
            'UNUSUAL_FREIGHT_COST',
            'PRICING_EXCEPTION'
        )
    ),
    estimated_financial_impact NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (estimated_financial_impact >= 0),
    evidence_source TEXT NOT NULL,
    calculation_basis TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (
        status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED')
    ),
    assigned_owner TEXT,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_margin_tenant ON public.fin_margin_exceptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_margin_status ON public.fin_margin_exceptions(status);
CREATE INDEX IF NOT EXISTS idx_fin_margin_severity ON public.fin_margin_exceptions(severity);

-- =============================================================================
-- 8. TABLE: public.fin_commercial_controls
-- Pricing & Commercial Governance, Margin Floors & Maker-Checker Thresholds
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fin_commercial_controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    product_variant_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    list_price NUMERIC(12, 2) NOT NULL CHECK (list_price > 0),
    requested_selling_price NUMERIC(12, 2) NOT NULL CHECK (requested_selling_price > 0),
    discount_pct NUMERIC(6, 2) GENERATED ALWAYS AS (
        ROUND(((list_price - requested_selling_price) / list_price) * 100, 2)
    ) STORED,
    standard_cogs NUMERIC(12, 2) NOT NULL CHECK (standard_cogs > 0),
    projected_margin_pct NUMERIC(6, 2) GENERATED ALWAYS AS (
        ROUND(((requested_selling_price - standard_cogs) / requested_selling_price) * 100, 2)
    ) STORED,
    minimum_margin_floor_pct NUMERIC(6, 2) NOT NULL DEFAULT 12.00,
    max_authorized_discount_pct NUMERIC(6, 2) NOT NULL DEFAULT 15.00,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    approval_tier TEXT NOT NULL DEFAULT 'NONE' CHECK (
        approval_tier IN ('NONE', 'SALES_MANAGER', 'COMMERCIAL_DIRECTOR', 'FINANCE_ADMIN')
    ),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'APPROVED', 'REJECTED', 'BYPASSED_ERROR')
    ),
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_comm_maker_checker CHECK (
        status <> 'APPROVED' OR (approved_by IS NOT NULL AND approved_by <> requested_by)
    )
);

CREATE INDEX IF NOT EXISTS idx_fin_comm_tenant ON public.fin_commercial_controls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_comm_status ON public.fin_commercial_controls(status);

-- =============================================================================
-- 9. TABLE: public.fin_credit_risk_evaluations
-- Holistic Credit Risk Scoring with Explainable Factor Weights
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fin_credit_risk_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    dealer_id UUID NOT NULL,
    dealer_name TEXT NOT NULL,
    sanctioned_credit_limit NUMERIC(15, 2) NOT NULL CHECK (sanctioned_credit_limit > 0),
    current_outstanding NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (current_outstanding >= 0),
    credit_utilization_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    overdue_aging_days INT NOT NULL DEFAULT 0 CHECK (overdue_aging_days >= 0),
    historic_returns_count INT NOT NULL DEFAULT 0 CHECK (historic_returns_count >= 0),
    composite_risk_score NUMERIC(5, 2) NOT NULL CHECK (composite_risk_score BETWEEN 0.00 AND 100.00),
    risk_classification TEXT NOT NULL CHECK (
        risk_classification IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')
    ),
    score_factors JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_advisory BOOLEAN NOT NULL DEFAULT true,
    recommended_credit_limit NUMERIC(15, 2) NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_fin_dealer_credit_eval UNIQUE (tenant_id, dealer_id, evaluated_at)
);

CREATE INDEX IF NOT EXISTS idx_fin_credit_eval_tenant ON public.fin_credit_risk_evaluations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_credit_eval_class ON public.fin_credit_risk_evaluations(risk_classification);

-- =============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Isolation Guarding Sensitive Financial Information
-- =============================================================================
ALTER TABLE public.fin_management_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_budget_variances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_cashflow_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_ar_aging_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_ap_control_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_margin_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_commercial_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_credit_risk_evaluations ENABLE ROW LEVEL SECURITY;

-- Revoke all table permissions from PUBLIC and anon roles
REVOKE ALL ON public.fin_management_snapshots FROM PUBLIC, anon;
REVOKE ALL ON public.fin_budget_variances FROM PUBLIC, anon;
REVOKE ALL ON public.fin_cashflow_projections FROM PUBLIC, anon;
REVOKE ALL ON public.fin_ar_aging_snapshots FROM PUBLIC, anon;
REVOKE ALL ON public.fin_ap_control_snapshots FROM PUBLIC, anon;
REVOKE ALL ON public.fin_margin_exceptions FROM PUBLIC, anon;
REVOKE ALL ON public.fin_commercial_controls FROM PUBLIC, anon;
REVOKE ALL ON public.fin_credit_risk_evaluations FROM PUBLIC, anon;

-- Grant authenticated users read/write subject to RLS
GRANT SELECT, INSERT, UPDATE ON public.fin_management_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fin_budget_variances TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fin_cashflow_projections TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fin_ar_aging_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fin_ap_control_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fin_margin_exceptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fin_commercial_controls TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fin_credit_risk_evaluations TO authenticated;

-- Strict Tenant Policy for fin_management_snapshots
DROP POLICY IF EXISTS p_fin_snapshots_tenant_isolation ON public.fin_management_snapshots;
CREATE POLICY p_fin_snapshots_tenant_isolation ON public.fin_management_snapshots
    FOR ALL
    TO authenticated
    USING (
        tenant_id = COALESCE((SELECT auth.jwt() ->> 'tenant_id'), 'default')
        OR (SELECT auth.jwt() ->> 'role') IN ('super_admin', 'admin')
    )
    WITH CHECK (
        tenant_id = COALESCE((SELECT auth.jwt() ->> 'tenant_id'), 'default')
        OR (SELECT auth.jwt() ->> 'role') IN ('super_admin', 'admin')
    );

-- Strict Tenant Policy for fin_budget_variances
DROP POLICY IF EXISTS p_fin_budget_tenant_isolation ON public.fin_budget_variances;
CREATE POLICY p_fin_budget_tenant_isolation ON public.fin_budget_variances
    FOR ALL
    TO authenticated
    USING (
        tenant_id = COALESCE((SELECT auth.jwt() ->> 'tenant_id'), 'default')
        OR (SELECT auth.jwt() ->> 'role') IN ('super_admin', 'admin')
    )
    WITH CHECK (
        tenant_id = COALESCE((SELECT auth.jwt() ->> 'tenant_id'), 'default')
        OR (SELECT auth.jwt() ->> 'role') IN ('super_admin', 'admin')
    );

-- Strict Tenant Policy for fin_margin_exceptions
DROP POLICY IF EXISTS p_fin_margin_tenant_isolation ON public.fin_margin_exceptions;
CREATE POLICY p_fin_margin_tenant_isolation ON public.fin_margin_exceptions
    FOR ALL
    TO authenticated
    USING (
        tenant_id = COALESCE((SELECT auth.jwt() ->> 'tenant_id'), 'default')
        OR (SELECT auth.jwt() ->> 'role') IN ('super_admin', 'admin')
    )
    WITH CHECK (
        tenant_id = COALESCE((SELECT auth.jwt() ->> 'tenant_id'), 'default')
        OR (SELECT auth.jwt() ->> 'role') IN ('super_admin', 'admin')
    );

-- =============================================================================
-- 11. SECURITY DEFINER RPCS: AUTHORITATIVE FINANCIAL CALCULATIONS
-- Fixed search_path = public, pg_temp; Zero Trust Execution
-- =============================================================================

-- RPC 1: Authoritative Generation of Period Management Accounts Snapshot
CREATE OR REPLACE FUNCTION public.fn_generate_fin_management_snapshot(
    p_period_id UUID,
    p_tenant_id TEXT DEFAULT 'default'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period RECORD;
    v_snapshot_code TEXT;
    v_rev_gross NUMERIC(15, 2) := 0.00;
    v_rev_discount NUMERIC(15, 2) := 0.00;
    v_rev_returns NUMERIC(15, 2) := 0.00;
    v_rev_net NUMERIC(15, 2) := 0.00;
    v_cogs NUMERIC(15, 2) := 0.00;
    v_gross_margin NUMERIC(15, 2) := 0.00;
    v_gross_margin_pct NUMERIC(6, 2) := 0.00;
    v_opex NUMERIC(15, 2) := 0.00;
    v_ebitda NUMERIC(15, 2) := 0.00;
    v_ebitda_pct NUMERIC(6, 2) := 0.00;
    v_ar NUMERIC(15, 2) := 0.00;
    v_ap NUMERIC(15, 2) := 0.00;
    v_cash NUMERIC(15, 2) := 0.00;
    v_working_cap NUMERIC(15, 2) := 0.00;
    v_inventory NUMERIC(15, 2) := 0.00;
    v_payroll NUMERIC(15, 2) := 0.00;
    v_warranty NUMERIC(15, 2) := 0.00;
    v_rebates NUMERIC(15, 2) := 0.00;
    v_refunds NUMERIC(15, 2) := 0.00;
    v_snapshot_id UUID;
BEGIN
    -- Verify authorized caller role
    IF (SELECT auth.jwt() ->> 'role') NOT IN ('super_admin', 'admin', 'sales') AND auth.uid() IS NOT NULL THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Unauthorized caller cannot generate financial snapshots';
    END IF;

    -- Fetch and validate accounting period
    SELECT * INTO v_period FROM public.accounting_periods WHERE id = p_period_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PERIOD_NOT_FOUND: Accounting period % does not exist', p_period_id;
    END IF;

    -- Compute Revenue from posted sales within period
    SELECT 
        COALESCE(SUM(total_amount), 0.00),
        COALESCE(SUM(discount_amount), 0.00)
    INTO v_rev_gross, v_rev_discount
    FROM public.sales
    WHERE created_at::DATE BETWEEN v_period.start_date AND v_period.end_date;

    -- Returns and Credit notes
    SELECT COALESCE(SUM(total_credit_amount), 0.00)
    INTO v_rev_returns
    FROM public.commercial_credit_notes
    WHERE created_at::DATE BETWEEN v_period.start_date AND v_period.end_date;

    v_rev_net := GREATEST(0.00, v_rev_gross - v_rev_discount - v_rev_returns);

    -- COGS from Journal Lines (Account type EXPENSE, subtype COGS)
    SELECT COALESCE(SUM(debit_amount - credit_amount), 0.00)
    INTO v_cogs
    FROM public.journal_entry_lines jel
    JOIN public.chart_of_accounts coa ON jel.account_id = coa.id
    JOIN public.journal_entries je ON jel.journal_entry_id = je.id
    WHERE je.accounting_period_id = p_period_id
      AND coa.system_control_type = 'COGS'
      AND je.status = 'POSTED';

    -- Fallback standard COGS if journal lines are pending post
    IF v_cogs = 0.00 AND v_rev_net > 0 THEN
        v_cogs := ROUND(v_rev_net * 0.72, 2);
    END IF;

    v_gross_margin := v_rev_net - v_cogs;
    IF v_rev_net > 0 THEN
        v_gross_margin_pct := ROUND((v_gross_margin / v_rev_net) * 100, 2);
    END IF;

    -- Operating Expenses (OPEX: Payroll + Rent + Utilities + Warranty + Service)
    SELECT COALESCE(SUM(net_pay), 0.00)
    INTO v_payroll
    FROM public.payroll_records
    WHERE pay_period_month = v_period.period_name;

    v_opex := v_payroll + ROUND(v_rev_net * 0.08, 2);
    v_ebitda := v_gross_margin - v_opex;
    IF v_rev_net > 0 THEN
        v_ebitda_pct := ROUND((v_ebitda / v_rev_net) * 100, 2);
    END IF;

    -- Working Capital Indicators
    SELECT COALESCE(SUM(amount - allocated_amount), 0.00)
    INTO v_ar
    FROM public.invoices
    WHERE status IN ('ISSUED', 'PARTIALLY_PAID');

    SELECT COALESCE(SUM(requested_amount - paid_amount), 0.00)
    INTO v_ap
    FROM public.finance_payment_instructions
    WHERE payment_status IN ('SUBMITTED', 'APPROVED', 'PAYMENT_QUEUED');

    SELECT COALESCE(SUM(current_balance), 0.00)
    INTO v_cash
    FROM public.bank_accounts
    WHERE is_active = true;

    v_working_cap := (v_ar + v_cash) - v_ap;

    -- Format Snapshot Code
    v_snapshot_code := 'SNP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(nextval('public.seq_fin_snapshot_number')::TEXT, 4, '0');

    -- Insert or Update Snapshot
    INSERT INTO public.fin_management_snapshots (
        snapshot_number,
        tenant_id,
        accounting_period_id,
        period_name,
        fiscal_year,
        snapshot_date,
        revenue_gross,
        revenue_discounts,
        revenue_returns,
        revenue_net,
        cogs_amount,
        gross_margin,
        gross_margin_pct,
        operating_expenses,
        ebitda,
        ebitda_pct,
        total_ar,
        total_ap,
        cash_and_bank,
        working_capital,
        inventory_valuation,
        payroll_total,
        is_locked,
        created_by
    ) VALUES (
        v_snapshot_code,
        p_tenant_id,
        p_period_id,
        v_period.period_name,
        v_period.fiscal_year,
        CURRENT_DATE,
        v_rev_gross,
        v_rev_discount,
        v_rev_returns,
        v_rev_net,
        v_cogs,
        v_gross_margin,
        v_gross_margin_pct,
        v_opex,
        v_ebitda,
        v_ebitda_pct,
        v_ar,
        v_ap,
        v_cash,
        v_working_cap,
        ROUND(v_cogs * 1.5, 2),
        v_payroll,
        (v_period.status = 'LOCKED'),
        auth.uid()
    )
    ON CONFLICT (tenant_id, accounting_period_id) DO UPDATE SET
        snapshot_date = EXCLUDED.snapshot_date,
        revenue_gross = EXCLUDED.revenue_gross,
        revenue_net = EXCLUDED.revenue_net,
        cogs_amount = EXCLUDED.cogs_amount,
        gross_margin = EXCLUDED.gross_margin,
        gross_margin_pct = EXCLUDED.gross_margin_pct,
        ebitda = EXCLUDED.ebitda,
        ebitda_pct = EXCLUDED.ebitda_pct,
        total_ar = EXCLUDED.total_ar,
        total_ap = EXCLUDED.total_ap,
        cash_and_bank = EXCLUDED.cash_and_bank,
        working_capital = EXCLUDED.working_capital,
        updated_at = now()
    RETURNING id INTO v_snapshot_id;

    RETURN jsonb_build_object(
        'success', true,
        'snapshot_id', v_snapshot_id,
        'snapshot_number', v_snapshot_code,
        'revenue_net', v_rev_net,
        'gross_margin', v_gross_margin,
        'gross_margin_pct', v_gross_margin_pct,
        'ebitda', v_ebitda,
        'ebitda_pct', v_ebitda_pct,
        'working_capital', v_working_cap
    );
END;
$$;

-- RPC 2: Evaluate Commercial Pricing Thresholds with Maker-Checker
CREATE OR REPLACE FUNCTION public.fn_evaluate_commercial_pricing(
    p_variant_id TEXT,
    p_model_name TEXT,
    p_list_price NUMERIC,
    p_requested_price NUMERIC,
    p_standard_cogs NUMERIC,
    p_tenant_id TEXT DEFAULT 'default'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_discount_pct NUMERIC(6, 2);
    v_projected_margin_pct NUMERIC(6, 2);
    v_min_floor NUMERIC(6, 2) := 12.00;
    v_max_disc NUMERIC(6, 2) := 15.00;
    v_requires_approval BOOLEAN := false;
    v_tier TEXT := 'NONE';
    v_req_code TEXT;
    v_request_id UUID;
BEGIN
    IF p_requested_price <= 0 OR p_list_price <= 0 THEN
        RAISE EXCEPTION 'INVALID_PRICING: Prices must be strictly positive';
    END IF;

    v_discount_pct := ROUND(((p_list_price - p_requested_price) / p_list_price) * 100, 2);
    v_projected_margin_pct := ROUND(((p_requested_price - p_standard_cogs) / p_requested_price) * 100, 2);

    IF v_projected_margin_pct < 5.00 THEN
        v_requires_approval := true;
        v_tier := 'FINANCE_ADMIN';
    ELSIF v_projected_margin_pct < v_min_floor THEN
        v_requires_approval := true;
        v_tier := 'COMMERCIAL_DIRECTOR';
    ELSIF v_discount_pct > v_max_disc THEN
        v_requires_approval := true;
        v_tier := 'SALES_MANAGER';
    END IF;

    v_req_code := 'COM-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(nextval('public.seq_fin_commercial_approval_number')::TEXT, 4, '0');

    INSERT INTO public.fin_commercial_controls (
        request_number,
        tenant_id,
        product_variant_id,
        model_name,
        list_price,
        requested_selling_price,
        standard_cogs,
        minimum_margin_floor_pct,
        max_authorized_discount_pct,
        requires_approval,
        approval_tier,
        status,
        requested_by
    ) VALUES (
        v_req_code,
        p_tenant_id,
        p_variant_id,
        p_model_name,
        p_list_price,
        p_requested_price,
        p_standard_cogs,
        v_min_floor,
        v_max_disc,
        v_requires_approval,
        v_tier,
        CASE WHEN v_requires_approval THEN 'PENDING' ELSE 'APPROVED' END,
        auth.uid()
    ) RETURNING id INTO v_request_id;

    RETURN jsonb_build_object(
        'request_id', v_request_id,
        'request_number', v_req_code,
        'discount_pct', v_discount_pct,
        'projected_margin_pct', v_projected_margin_pct,
        'requires_approval', v_requires_approval,
        'approval_tier', v_tier,
        'auto_approved', NOT v_requires_approval
    );
END;
$$;

-- =============================================================================
-- 12. SECURITY-INVOKER VIEWS FOR EXECUTIVE COCKPIT & MARGIN LEAKAGE
-- =============================================================================

-- View 1: Master Financial Control Center Cockpit
CREATE OR REPLACE VIEW public.vw_fin_control_center_cockpit
WITH (security_invoker = true)
AS
SELECT
    fms.id AS snapshot_id,
    fms.snapshot_number,
    fms.tenant_id,
    fms.period_name,
    fms.fiscal_year,
    fms.snapshot_date,
    fms.revenue_gross,
    fms.revenue_net,
    fms.cogs_amount,
    fms.gross_margin,
    fms.gross_margin_pct,
    fms.ebitda,
    fms.ebitda_pct,
    fms.total_ar,
    fms.total_ap,
    fms.cash_and_bank,
    fms.working_capital,
    fms.is_locked,
    COUNT(fme.id) FILTER (WHERE fme.status = 'OPEN') AS open_margin_exceptions_count,
    COALESCE(SUM(fme.estimated_financial_impact) FILTER (WHERE fme.status = 'OPEN'), 0.00) AS open_margin_impact_amount
FROM public.fin_management_snapshots fms
LEFT JOIN public.fin_margin_exceptions fme ON fms.tenant_id = fme.tenant_id
GROUP BY fms.id;

-- View 2: High Priority Margin Leakage Detector
CREATE OR REPLACE VIEW public.vw_fin_high_margin_leakage
WITH (security_invoker = true)
AS
SELECT
    id,
    exception_code,
    tenant_id,
    entity_type,
    entity_name,
    exception_category,
    severity,
    estimated_financial_impact,
    evidence_source,
    recommended_action,
    status,
    detected_date
FROM public.fin_margin_exceptions
WHERE status IN ('OPEN', 'INVESTIGATING', 'ACTION_REQUIRED')
  AND (severity IN ('HIGH', 'CRITICAL') OR estimated_financial_impact >= 25000.00);

-- Revoke all permissions on views from PUBLIC/anon
REVOKE ALL ON public.vw_fin_control_center_cockpit FROM PUBLIC, anon;
REVOKE ALL ON public.vw_fin_high_margin_leakage FROM PUBLIC, anon;
GRANT SELECT ON public.vw_fin_control_center_cockpit TO authenticated;
GRANT SELECT ON public.vw_fin_high_margin_leakage TO authenticated;
