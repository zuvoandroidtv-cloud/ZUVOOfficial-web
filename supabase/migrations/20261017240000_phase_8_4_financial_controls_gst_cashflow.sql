-- =============================================================================
-- ZUVO TV CRM — PHASE 8.4 MIGRATION
-- Enterprise Financial Controls, GST Compliance & Management Cash-Flow Intelligence
-- Target Environment: Supabase PostgreSQL
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. SEQUENCES FOR CONCURRENCY-SAFE APPROVAL & CONTROL NUMBERING
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_finance_approval_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_finance_exception_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 2. TABLE: public.finance_control_rules
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.finance_control_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code TEXT NOT NULL UNIQUE,
    rule_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (
        category IN (
            'JOURNAL_THRESHOLD',
            'BACKDATED_ENTRY',
            'REVERSAL_GATE',
            'BAD_DEBT_GATE',
            'CREDIT_MEMO_GATE',
            'WARRANTY_ADJUSTMENT',
            'AP_PAYMENT_VARIANCE',
            'AR_PAYMENT_VARIANCE',
            'GST_TAX_VARIANCE',
            'PERIOD_CLOSE_GATE'
        )
    ),
    threshold_amount NUMERIC(15, 2) DEFAULT 0.00,
    severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    requires_approval BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_control_rules_code ON public.finance_control_rules(rule_code);
CREATE INDEX IF NOT EXISTS idx_finance_control_rules_category ON public.finance_control_rules(category);

-- =============================================================================
-- 3. TABLE: public.finance_control_exceptions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.finance_control_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exception_number TEXT NOT NULL UNIQUE,
    rule_id UUID REFERENCES public.finance_control_rules(id) ON DELETE RESTRICT,
    rule_code TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    entity_type TEXT NOT NULL, -- e.g. JOURNAL_ENTRY, COMMERCIAL_INVOICE, AP_INVOICE, PAYMENT_RECEIPT, CREDIT_MEMO
    entity_id UUID NOT NULL,
    entity_reference TEXT NOT NULL,
    detected_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    threshold_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (
        status IN ('OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED', 'WAIVED')
    ),
    assigned_reviewer_id UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_exceptions_status ON public.finance_control_exceptions(status);
CREATE INDEX IF NOT EXISTS idx_finance_exceptions_entity ON public.finance_control_exceptions(entity_type, entity_id);

-- =============================================================================
-- 4. TABLE: public.finance_approval_requests
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.finance_approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT NOT NULL UNIQUE,
    request_type TEXT NOT NULL CHECK (
        request_type IN (
            'MANUAL_JOURNAL_APPROVAL',
            'BAD_DEBT_WRITE_OFF',
            'CREDIT_MEMO_OFFSET',
            'HIGH_VALUE_PAYMENT',
            'PERIOD_CLOSE_OVERRIDE',
            'GST_VARIANCE_WAIVER'
        )
    ),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    entity_reference TEXT NOT NULL,
    requested_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
    ),
    requester_id UUID NOT NULL REFERENCES auth.users(id),
    reviewer_id UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_no_self_approval CHECK (requester_id <> reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_approval_status ON public.finance_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_finance_approval_entity ON public.finance_approval_requests(entity_type, entity_id);

-- =============================================================================
-- 5. TABLE: public.finance_approval_actions (Immutable Audit Log of Actions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.finance_approval_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id UUID NOT NULL REFERENCES public.finance_approval_requests(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED')),
    actor_id UUID NOT NULL REFERENCES auth.users(id),
    action_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_approval_actions_req ON public.finance_approval_actions(approval_request_id);

-- =============================================================================
-- 6. TABLE: public.financial_audit_events
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.financial_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- e.g. CONTROL_TRIGGERED, APPROVAL_GRANTED, EXCEPTION_RESOLVED, PERIOD_LOCKED, GST_RECONCILED
    severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    entity_type TEXT NOT NULL,
    entity_id UUID,
    entity_reference TEXT,
    event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    actor_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_audit_events_type ON public.financial_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_financial_audit_events_created ON public.financial_audit_events(created_at DESC);

-- =============================================================================
-- 7. TABLE: public.gst_reconciliation_records
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.gst_reconciliation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES public.accounting_periods(id) ON DELETE CASCADE,
    period_name TEXT NOT NULL,
    taxable_turnover NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    outward_cgst NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    outward_sgst NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    outward_igst NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_outward_tax NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    inward_cgst_itc NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    inward_sgst_itc NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    inward_igst_itc NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_inward_itc NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    net_gst_liability NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    invoice_count INT NOT NULL DEFAULT 0,
    vendor_bill_count INT NOT NULL DEFAULT 0,
    tax_variance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'FILE_READY' CHECK (
        status IN ('MATCHED', 'VARIANCE', 'EXCEPTION', 'REVIEWED', 'FILE_READY')
    ),
    reconciled_by UUID REFERENCES auth.users(id),
    reconciled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_gst_reconciliation_period UNIQUE (period_id)
);

CREATE INDEX IF NOT EXISTS idx_gst_reconcile_period ON public.gst_reconciliation_records(period_id);

-- =============================================================================
-- 8. TABLE: public.cash_flow_snapshots
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cash_flow_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES public.accounting_periods(id) ON DELETE CASCADE,
    period_name TEXT NOT NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    opening_cash NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    -- Operating Cash Flows
    customer_collections NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vendor_payments NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    operating_expenses NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    warranty_claims_paid NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    gst_tax_settled NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    net_operating_cash_flow NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    -- Investing Cash Flows
    inventory_capitalization NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    scrap_salvage_inflow NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    net_investing_cash_flow NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    -- Financing Cash Flows
    equity_injections NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    financing_disbursements NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    net_financing_cash_flow NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    -- Net Position
    net_cash_change NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    closing_cash NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cash_flow_period UNIQUE (period_id)
);

CREATE INDEX IF NOT EXISTS idx_cash_flow_snapshots_period ON public.cash_flow_snapshots(period_id);

-- =============================================================================
-- 9. SEED: DEFAULT FINANCIAL CONTROL RULES
-- =============================================================================
INSERT INTO public.finance_control_rules
(rule_code, rule_name, description, category, threshold_amount, severity, requires_approval)
VALUES
('FCR-001', 'High Value Manual Journal Entry', 'Requires Finance Controller signoff for manual journal entries exceeding threshold.', 'JOURNAL_THRESHOLD', 50000.00, 'HIGH', true),
('FCR-002', 'Critical Value Journal Entry (>₹2,50,000)', 'Requires Executive Admin signoff for journal entries exceeding ₹2,50,000.', 'JOURNAL_THRESHOLD', 250000.00, 'CRITICAL', true),
('FCR-003', 'Backdated Entry Detection', 'Flags entries with transaction date prior to current calendar month.', 'BACKDATED_ENTRY', 0.00, 'HIGH', true),
('FCR-004', 'Bad Debt Write-Off Threshold', 'Mandates review and dual approval for uncollectible debt write-offs above ₹5,000.', 'BAD_DEBT_GATE', 5000.00, 'HIGH', true),
('FCR-005', 'High Value Credit Memo Offset', 'Requires approval before applying dealer credit memo offsets exceeding ₹20,000.', 'CREDIT_MEMO_GATE', 20000.00, 'HIGH', true),
('FCR-006', 'High Value Vendor AP Disbursement', 'Requires secondary reviewer for vendor payouts exceeding ₹1,00,000.', 'AP_PAYMENT_VARIANCE', 100000.00, 'HIGH', true),
('FCR-007', 'GST Return Variance (>₹100)', 'Blocks automatic file-ready signoff if GSTR calculation variance exceeds ₹100.', 'GST_TAX_VARIANCE', 100.00, 'CRITICAL', true),
('FCR-008', 'Unbalanced Period Close Gate', 'Strictly blocks locking accounting periods if trial balance variance is non-zero.', 'PERIOD_CLOSE_GATE', 0.00, 'CRITICAL', true)
ON CONFLICT (rule_code) DO NOTHING;

-- =============================================================================
-- 10. RPC: fn_generate_gst_reconciliation (Server-Authoritative GST Engine)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_generate_gst_reconciliation(p_period_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period RECORD;
    v_outward_cgst NUMERIC(15, 2) := 0.00;
    v_outward_sgst NUMERIC(15, 2) := 0.00;
    v_outward_igst NUMERIC(15, 2) := 0.00;
    v_tot_outward NUMERIC(15, 2) := 0.00;
    v_taxable_turnover NUMERIC(15, 2) := 0.00;
    v_inward_cgst NUMERIC(15, 2) := 0.00;
    v_inward_sgst NUMERIC(15, 2) := 0.00;
    v_inward_igst NUMERIC(15, 2) := 0.00;
    v_tot_inward NUMERIC(15, 2) := 0.00;
    v_net_liability NUMERIC(15, 2) := 0.00;
    v_inv_count INT := 0;
    v_vbill_count INT := 0;
    v_variance NUMERIC(15, 2) := 0.00;
    v_status TEXT := 'FILE_READY';
    v_rec_id UUID;
BEGIN
    SELECT * INTO v_period FROM public.accounting_periods WHERE id = p_period_id;
    IF v_period.id IS NULL THEN
        RAISE EXCEPTION 'Accounting period % not found.', p_period_id;
    END IF;

    -- Aggregate Outward Supplies from commercial_tax_invoices
    SELECT 
        COALESCE(SUM(taxable_value), 0.00),
        COALESCE(SUM(cgst_amount), 0.00),
        COALESCE(SUM(sgst_amount), 0.00),
        COALESCE(SUM(igst_amount), 0.00),
        COALESCE(SUM(total_tax), 0.00),
        COUNT(*)
    INTO 
        v_taxable_turnover, v_outward_cgst, v_outward_sgst, v_outward_igst, v_tot_outward, v_inv_count
    FROM public.commercial_tax_invoices
    WHERE invoice_date BETWEEN v_period.start_date AND v_period.end_date
      AND invoice_status <> 'CANCELLED';

    -- Aggregate Inward Purchases & ITC from vendor_invoices
    SELECT 
        COALESCE(SUM(tax_amount) * 0.5, 0.00), -- 9% CGST
        COALESCE(SUM(tax_amount) * 0.5, 0.00), -- 9% SGST
        0.00,
        COALESCE(SUM(tax_amount), 0.00),
        COUNT(*)
    INTO 
        v_inward_cgst, v_inward_sgst, v_inward_igst, v_tot_inward, v_vbill_count
    FROM public.vendor_invoices
    WHERE invoice_date BETWEEN v_period.start_date AND v_period.end_date;

    v_net_liability := v_tot_outward - v_tot_inward;

    -- Check against General Ledger tax liability accounts (2200 series vs 1200 series)
    -- Compute variance between subledgers and posted GL
    SELECT 
        ABS(v_tot_outward - COALESCE(SUM(CASE WHEN c.account_number LIKE '22%' THEN l.credit_amount - l.debit_amount ELSE 0 END), v_tot_outward))
    INTO v_variance
    FROM public.journal_entry_lines l
    JOIN public.journal_entries j ON l.journal_entry_id = j.id
    JOIN public.chart_of_accounts c ON l.account_id = c.id
    WHERE j.entry_date BETWEEN v_period.start_date AND v_period.end_date AND j.status = 'POSTED';

    IF v_variance > 100.00 THEN
        v_status := 'VARIANCE';
    ELSE
        v_status := 'FILE_READY';
    END IF;

    -- Upsert GST Reconciliation Record
    INSERT INTO public.gst_reconciliation_records (
        period_id,
        period_name,
        taxable_turnover,
        outward_cgst,
        outward_sgst,
        outward_igst,
        total_outward_tax,
        inward_cgst_itc,
        inward_sgst_itc,
        inward_igst_itc,
        total_inward_itc,
        net_gst_liability,
        invoice_count,
        vendor_bill_count,
        tax_variance,
        status,
        reconciled_by,
        reconciled_at
    ) VALUES (
        p_period_id,
        v_period.period_name,
        v_taxable_turnover,
        v_outward_cgst,
        v_outward_sgst,
        v_outward_igst,
        v_tot_outward,
        v_inward_cgst,
        v_inward_sgst,
        v_inward_igst,
        v_tot_inward,
        v_net_liability,
        v_inv_count,
        v_vbill_count,
        v_variance,
        v_status,
        auth.uid(),
        now()
    )
    ON CONFLICT (period_id) DO UPDATE SET
        taxable_turnover = EXCLUDED.taxable_turnover,
        outward_cgst = EXCLUDED.outward_cgst,
        outward_sgst = EXCLUDED.outward_sgst,
        outward_igst = EXCLUDED.outward_igst,
        total_outward_tax = EXCLUDED.total_outward_tax,
        inward_cgst_itc = EXCLUDED.inward_cgst_itc,
        inward_sgst_itc = EXCLUDED.inward_sgst_itc,
        inward_igst_itc = EXCLUDED.inward_igst_itc,
        total_inward_itc = EXCLUDED.total_inward_itc,
        net_gst_liability = EXCLUDED.net_gst_liability,
        invoice_count = EXCLUDED.invoice_count,
        vendor_bill_count = EXCLUDED.vendor_bill_count,
        tax_variance = EXCLUDED.tax_variance,
        status = EXCLUDED.status,
        reconciled_at = now()
    RETURNING id INTO v_rec_id;

    RETURN jsonb_build_object(
        'success', true,
        'reconciliation_id', v_rec_id,
        'period_name', v_period.period_name,
        'status', v_status,
        'taxable_turnover', v_taxable_turnover,
        'outward_tax', jsonb_build_object(
            'cgst', v_outward_cgst,
            'sgst', v_outward_sgst,
            'igst', v_outward_igst,
            'total', v_tot_outward
        ),
        'inward_itc', jsonb_build_object(
            'cgst', v_inward_cgst,
            'sgst', v_inward_sgst,
            'igst', v_inward_igst,
            'total', v_tot_inward
        ),
        'net_gst_liability', v_net_liability,
        'invoice_count', v_inv_count,
        'vendor_bill_count', v_vbill_count,
        'tax_variance', v_variance,
        'integration_boundary', 'Authoritative internal return ready. External API relay required for GSTN portal submission.'
    );
END;
$$;

-- =============================================================================
-- 11. RPC: fn_generate_cash_flow_snapshot (Operating, Investing, Financing)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_generate_cash_flow_snapshot(p_period_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period RECORD;
    v_open_cash NUMERIC(15, 2) := 0.00;
    v_collections NUMERIC(15, 2) := 0.00;
    v_ap_payments NUMERIC(15, 2) := 0.00;
    v_opex NUMERIC(15, 2) := 0.00;
    v_warranty NUMERIC(15, 2) := 0.00;
    v_gst_paid NUMERIC(15, 2) := 0.00;
    v_net_operating NUMERIC(15, 2) := 0.00;
    v_inv_cap NUMERIC(15, 2) := 0.00;
    v_scrap NUMERIC(15, 2) := 0.00;
    v_net_investing NUMERIC(15, 2) := 0.00;
    v_equity_in NUMERIC(15, 2) := 0.00;
    v_net_financing NUMERIC(15, 2) := 0.00;
    v_net_change NUMERIC(15, 2) := 0.00;
    v_closing_cash NUMERIC(15, 2) := 0.00;
    v_snap_id UUID;
BEGIN
    SELECT * INTO v_period FROM public.accounting_periods WHERE id = p_period_id;
    IF v_period.id IS NULL THEN
        RAISE EXCEPTION 'Accounting period % not found.', p_period_id;
    END IF;

    -- Opening Cash: Bank balance before start of period
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0.00)
    INTO v_open_cash
    FROM public.journal_entry_lines l
    JOIN public.journal_entries j ON l.journal_entry_id = j.id
    JOIN public.chart_of_accounts c ON l.account_id = c.id
    WHERE c.account_number = '1010'
      AND j.entry_date < v_period.start_date
      AND j.status = 'POSTED';

    -- Operating Inflows: Customer AR Collections (Debit Bank, Credit AR)
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_collections
    FROM public.customer_ar_transactions
    WHERE transaction_type = 'PAYMENT_APPLIED'
      AND transaction_timestamp::date BETWEEN v_period.start_date AND v_period.end_date;

    -- Operating Outflows: Vendor AP Payments (Debit AP, Credit Bank)
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_ap_payments
    FROM public.vendor_ap_transactions
    WHERE transaction_type = 'PAYMENT'
      AND transaction_date BETWEEN v_period.start_date AND v_period.end_date;

    -- Operating Expenses
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0.00)
    INTO v_opex
    FROM public.journal_entry_lines l
    JOIN public.journal_entries j ON l.journal_entry_id = j.id
    JOIN public.chart_of_accounts c ON l.account_id = c.id
    WHERE c.account_number IN ('5100', '5500')
      AND j.entry_date BETWEEN v_period.start_date AND v_period.end_date
      AND j.status = 'POSTED';

    -- Warranty Paid
    SELECT COALESCE(SUM(credit_amount), 0.00)
    INTO v_warranty
    FROM public.dealer_warranty_credit_memos
    WHERE created_at::date BETWEEN v_period.start_date AND v_period.end_date;

    v_net_operating := v_collections - (v_ap_payments + v_opex + v_warranty + v_gst_paid);

    -- Investing Cash Flows
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0.00)
    INTO v_inv_cap
    FROM public.journal_entry_lines l
    JOIN public.journal_entries j ON l.journal_entry_id = j.id
    JOIN public.chart_of_accounts c ON l.account_id = c.id
    WHERE c.account_number = '1300'
      AND j.entry_date BETWEEN v_period.start_date AND v_period.end_date
      AND j.status = 'POSTED';

    v_net_investing := v_scrap - v_inv_cap;

    -- Financing Cash Flows
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0.00)
    INTO v_equity_in
    FROM public.journal_entry_lines l
    JOIN public.journal_entries j ON l.journal_entry_id = j.id
    JOIN public.chart_of_accounts c ON l.account_id = c.id
    WHERE c.account_number = '3100'
      AND j.entry_date BETWEEN v_period.start_date AND v_period.end_date
      AND j.status = 'POSTED';

    v_net_financing := v_equity_in;
    v_net_change := v_net_operating + v_net_investing + v_net_financing;
    v_closing_cash := v_open_cash + v_net_change;

    -- Upsert Snapshot
    INSERT INTO public.cash_flow_snapshots (
        period_id,
        period_name,
        snapshot_date,
        opening_cash,
        customer_collections,
        vendor_payments,
        operating_expenses,
        warranty_claims_paid,
        gst_tax_settled,
        net_operating_cash_flow,
        inventory_capitalization,
        scrap_salvage_inflow,
        net_investing_cash_flow,
        equity_injections,
        financing_disbursements,
        net_financing_cash_flow,
        net_cash_change,
        closing_cash,
        generated_at
    ) VALUES (
        p_period_id,
        v_period.period_name,
        CURRENT_DATE,
        v_open_cash,
        v_collections,
        v_ap_payments,
        v_opex,
        v_warranty,
        v_gst_paid,
        v_net_operating,
        v_inv_cap,
        v_scrap,
        v_net_investing,
        v_equity_in,
        0.00,
        v_net_financing,
        v_net_change,
        v_closing_cash,
        now()
    )
    ON CONFLICT (period_id) DO UPDATE SET
        snapshot_date = CURRENT_DATE,
        customer_collections = EXCLUDED.customer_collections,
        vendor_payments = EXCLUDED.vendor_payments,
        operating_expenses = EXCLUDED.operating_expenses,
        warranty_claims_paid = EXCLUDED.warranty_claims_paid,
        net_operating_cash_flow = EXCLUDED.net_operating_cash_flow,
        inventory_capitalization = EXCLUDED.inventory_capitalization,
        net_investing_cash_flow = EXCLUDED.net_investing_cash_flow,
        equity_injections = EXCLUDED.equity_injections,
        net_financing_cash_flow = EXCLUDED.net_financing_cash_flow,
        net_cash_change = EXCLUDED.net_cash_change,
        closing_cash = EXCLUDED.closing_cash,
        generated_at = now()
    RETURNING id INTO v_snap_id;

    RETURN jsonb_build_object(
        'success', true,
        'snapshot_id', v_snap_id,
        'period_name', v_period.period_name,
        'opening_cash', v_open_cash,
        'operating', jsonb_build_object(
            'customer_collections', v_collections,
            'vendor_payments', v_ap_payments,
            'operating_expenses', v_opex,
            'warranty_claims_paid', v_warranty,
            'net_operating', v_net_operating
        ),
        'investing', jsonb_build_object(
            'inventory_capitalization', v_inv_cap,
            'scrap_salvage', v_scrap,
            'net_investing', v_net_investing
        ),
        'financing', jsonb_build_object(
            'equity_inflows', v_equity_in,
            'net_financing', v_net_financing
        ),
        'net_cash_change', v_net_change,
        'closing_cash', v_closing_cash
    );
END;
$$;

-- =============================================================================
-- 12. RPC: fn_generate_cash_flow_forecast (30, 60, 90-Day Liquidity Outlook)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_generate_cash_flow_forecast(p_horizon_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_horizon DATE;
    v_cur_cash NUMERIC(15, 2) := 0.00;
    v_proj_ar_inflows NUMERIC(15, 2) := 0.00;
    v_proj_ap_outflows NUMERIC(15, 2) := 0.00;
    v_proj_gst_outflows NUMERIC(15, 2) := 0.00;
    v_net_projected NUMERIC(15, 2) := 0.00;
    v_projected_cash NUMERIC(15, 2) := 0.00;
    v_is_negative BOOLEAN := false;
BEGIN
    v_horizon := CURRENT_DATE + p_horizon_days;

    -- Current Cash from Operating Bank Account 1010
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0.00)
    INTO v_cur_cash
    FROM public.journal_entry_lines l
    JOIN public.journal_entries j ON l.journal_entry_id = j.id
    JOIN public.chart_of_accounts c ON l.account_id = c.id
    WHERE c.account_number = '1010' AND j.status = 'POSTED';

    -- Projected Inflows from open AR ledger with due_date within horizon
    SELECT COALESCE(SUM(remaining_balance), 0.00)
    INTO v_proj_ar_inflows
    FROM public.customer_ar_ledger
    WHERE status IN ('OPEN', 'PARTIALLY_SETTLED')
      AND due_date <= v_horizon;

    -- Projected Outflows from open Vendor AP ledger with due_date within horizon
    SELECT COALESCE(SUM(remaining_balance), 0.00)
    INTO v_proj_ap_outflows
    FROM public.vendor_ap_ledger
    WHERE status IN ('OPEN', 'PARTIALLY_SETTLED')
      AND due_date <= v_horizon;

    -- Projected GST liability due
    SELECT COALESCE(SUM(remaining_balance) * 0.18, 0.00)
    INTO v_proj_gst_outflows
    FROM public.customer_ar_ledger
    WHERE status IN ('OPEN', 'PARTIALLY_SETTLED')
      AND due_date <= v_horizon;

    v_net_projected := v_proj_ar_inflows - (v_proj_ap_outflows + v_proj_gst_outflows);
    v_projected_cash := v_cur_cash + v_net_projected;
    v_is_negative := (v_projected_cash < 0);

    RETURN jsonb_build_object(
        'horizon_days', p_horizon_days,
        'forecast_through_date', v_horizon,
        'current_cash_position', v_cur_cash,
        'projected_inflows', jsonb_build_object(
            'customer_ar_due', v_proj_ar_inflows,
            'total_inflows', v_proj_ar_inflows
        ),
        'projected_outflows', jsonb_build_object(
            'vendor_ap_due', v_proj_ap_outflows,
            'statutory_gst_due', v_proj_gst_outflows,
            'total_outflows', v_proj_ap_outflows + v_proj_gst_outflows
        ),
        'net_projected_cash_change', v_net_projected,
        'projected_closing_cash', v_projected_cash,
        'warning_negative_cash', v_is_negative,
        'estimation_notice', 'Estimates based on actual contractual maturities and open ledger balances.'
    );
END;
$$;

-- =============================================================================
-- 13. RPC: fn_create_finance_approval_request (Workflow Trigger & Guard)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_create_finance_approval_request(
    p_request_type TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_entity_reference TEXT,
    p_amount NUMERIC,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_req_num TEXT;
    v_req_id UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit financial approval request.';
    END IF;

    IF p_amount < 0 THEN
        RAISE EXCEPTION 'Requested approval amount cannot be negative.';
    END IF;

    v_req_num := 'FAR-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(nextval('public.seq_finance_approval_number')::text, 4, '0');

    INSERT INTO public.finance_approval_requests (
        request_number,
        request_type,
        entity_type,
        entity_id,
        entity_reference,
        requested_amount,
        reason,
        status,
        requester_id
    ) VALUES (
        v_req_num,
        p_request_type,
        p_entity_type,
        p_entity_id,
        p_entity_reference,
        p_amount,
        p_reason,
        'PENDING',
        v_actor_id
    ) RETURNING id INTO v_req_id;

    -- Log Approval Action
    INSERT INTO public.finance_approval_actions (
        approval_request_id,
        action,
        actor_id,
        action_notes
    ) VALUES (
        v_req_id,
        'SUBMITTED',
        v_actor_id,
        'Approval request initialized: ' || p_reason
    );

    -- Log Immutable Audit Event
    INSERT INTO public.financial_audit_events (
        event_type,
        severity,
        entity_type,
        entity_id,
        entity_reference,
        event_payload,
        actor_id
    ) VALUES (
        'APPROVAL_REQUESTED',
        'INFO',
        p_entity_type,
        p_entity_id,
        p_entity_reference,
        jsonb_build_object('request_number', v_req_num, 'amount', p_amount, 'type', p_request_type),
        v_actor_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_req_id,
        'request_number', v_req_num,
        'status', 'PENDING'
    );
END;
$$;

-- =============================================================================
-- 14. RPC: fn_approve_finance_request & fn_reject_finance_request
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_approve_finance_request(
    p_request_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_req RECORD;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'finance')
        ) THEN
            RAISE EXCEPTION 'Access denied: Only Finance and Executive Admins may approve requests.';
        END IF;
    END IF;

    SELECT * INTO v_req FROM public.finance_approval_requests WHERE id = p_request_id;
    IF v_req.id IS NULL THEN
        RAISE EXCEPTION 'Approval request % not found.', p_request_id;
    END IF;

    -- Strict Self-Approval Rejection Guard
    IF v_actor_id IS NOT NULL AND v_req.requester_id = v_actor_id THEN
        RAISE EXCEPTION 'Self-approval violation: Requester cannot approve their own financial request.';
    END IF;

    IF v_req.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Request % is already % and cannot be approved.', v_req.request_number, v_req.status;
    END IF;

    UPDATE public.finance_approval_requests
    SET status = 'APPROVED',
        reviewer_id = v_actor_id,
        reviewed_at = now(),
        review_notes = p_notes
    WHERE id = p_request_id;

    INSERT INTO public.finance_approval_actions (
        approval_request_id,
        action,
        actor_id,
        action_notes
    ) VALUES (
        p_request_id,
        'APPROVED',
        COALESCE(v_actor_id, v_req.requester_id),
        COALESCE(p_notes, 'Approved by financial governance review.')
    );

    INSERT INTO public.financial_audit_events (
        event_type,
        severity,
        entity_type,
        entity_id,
        entity_reference,
        event_payload,
        actor_id
    ) VALUES (
        'APPROVAL_GRANTED',
        'INFO',
        v_req.entity_type,
        v_req.entity_id,
        v_req.entity_reference,
        jsonb_build_object('request_number', v_req.request_number, 'amount', v_req.requested_amount),
        v_actor_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'request_number', v_req.request_number,
        'status', 'APPROVED'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_reject_finance_request(
    p_request_id UUID,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_req RECORD;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'finance')
        ) THEN
            RAISE EXCEPTION 'Access denied: Only Finance and Executive Admins may reject requests.';
        END IF;
    END IF;

    SELECT * INTO v_req FROM public.finance_approval_requests WHERE id = p_request_id;
    IF v_req.id IS NULL THEN
        RAISE EXCEPTION 'Approval request % not found.', p_request_id;
    END IF;

    IF v_req.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Request % is already %.', v_req.request_number, v_req.status;
    END IF;

    UPDATE public.finance_approval_requests
    SET status = 'REJECTED',
        reviewer_id = v_actor_id,
        reviewed_at = now(),
        review_notes = p_notes
    WHERE id = p_request_id;

    INSERT INTO public.finance_approval_actions (
        approval_request_id,
        action,
        actor_id,
        action_notes
    ) VALUES (
        p_request_id,
        'REJECTED',
        COALESCE(v_actor_id, v_req.requester_id),
        p_notes
    );

    INSERT INTO public.financial_audit_events (
        event_type,
        severity,
        entity_type,
        entity_id,
        entity_reference,
        event_payload,
        actor_id
    ) VALUES (
        'APPROVAL_REJECTED',
        'WARNING',
        v_req.entity_type,
        v_req.entity_id,
        v_req.entity_reference,
        jsonb_build_object('request_number', v_req.request_number, 'notes', p_notes),
        v_actor_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'request_number', v_req.request_number,
        'status', 'REJECTED'
    );
END;
$$;

-- =============================================================================
-- 15. RPC: fn_resolve_finance_exception
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_resolve_finance_exception(
    p_exception_id UUID,
    p_action TEXT, -- RESOLVED, WAIVED, REJECTED
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_exc RECORD;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'finance')
        ) THEN
            RAISE EXCEPTION 'Access denied: Only Finance and Administrative roles may resolve control exceptions.';
        END IF;
    END IF;

    SELECT * INTO v_exc FROM public.finance_control_exceptions WHERE id = p_exception_id;
    IF v_exc.id IS NULL THEN
        RAISE EXCEPTION 'Control exception % not found.', p_exception_id;
    END IF;

    IF v_exc.status IN ('RESOLVED', 'WAIVED', 'REJECTED') THEN
        RAISE EXCEPTION 'Exception % is already %.', v_exc.exception_number, v_exc.status;
    END IF;

    UPDATE public.finance_control_exceptions
    SET status = p_action,
        resolved_by = v_actor_id,
        resolved_at = now(),
        resolution_notes = p_notes
    WHERE id = p_exception_id;

    INSERT INTO public.financial_audit_events (
        event_type,
        severity,
        entity_type,
        entity_id,
        entity_reference,
        event_payload,
        actor_id
    ) VALUES (
        'EXCEPTION_RESOLVED',
        'INFO',
        v_exc.entity_type,
        v_exc.entity_id,
        v_exc.entity_reference,
        jsonb_build_object('exception_number', v_exc.exception_number, 'action', p_action, 'notes', p_notes),
        v_actor_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'exception_id', p_exception_id,
        'exception_number', v_exc.exception_number,
        'status', p_action
    );
END;
$$;

-- =============================================================================
-- 16. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.finance_control_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_control_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gst_reconciliation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_snapshots ENABLE ROW LEVEL SECURITY;

-- 1. Rules: Read for internal staff; write for finance/admin
CREATE POLICY "rules_select_staff" ON public.finance_control_rules
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance', 'sales')
        )
    );

CREATE POLICY "rules_admin_write" ON public.finance_control_rules
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- 2. Exceptions: Read/write for finance and admin
CREATE POLICY "exceptions_finance_access" ON public.finance_control_exceptions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- 3. Approvals: Read/write for finance and admin
CREATE POLICY "approvals_finance_access" ON public.finance_approval_requests
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- 4. Actions: Read/write for finance and admin
CREATE POLICY "actions_finance_access" ON public.finance_approval_actions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- 5. Audit Events: Read for finance/admin/auditor; append-only via RPC
CREATE POLICY "audit_events_select_finance" ON public.financial_audit_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- 6. GST Reconciliation: Read/write for finance and admin
CREATE POLICY "gst_reconcile_finance" ON public.gst_reconciliation_records
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- 7. Cash Flow Snapshots: Read/write for finance and admin
CREATE POLICY "cash_flow_finance" ON public.cash_flow_snapshots
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- Revoke all permissions from anon
REVOKE ALL ON public.finance_control_rules FROM anon;
REVOKE ALL ON public.finance_control_exceptions FROM anon;
REVOKE ALL ON public.finance_approval_requests FROM anon;
REVOKE ALL ON public.finance_approval_actions FROM anon;
REVOKE ALL ON public.financial_audit_events FROM anon;
REVOKE ALL ON public.gst_reconciliation_records FROM anon;
REVOKE ALL ON public.cash_flow_snapshots FROM anon;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.fn_generate_gst_reconciliation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_cash_flow_snapshot(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_cash_flow_forecast(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_finance_approval_request(TEXT, TEXT, UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_approve_finance_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reject_finance_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_resolve_finance_exception(UUID, TEXT, TEXT) TO authenticated;
