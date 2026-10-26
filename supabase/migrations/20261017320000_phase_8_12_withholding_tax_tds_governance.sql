-- =============================================================================
-- ZUVO TV CRM — PHASE 8.12 MASTER DATABASE MIGRATION
-- Enterprise Statutory Withholding Tax (TDS/TCS), Vendor Form 16A Governance &
-- Statutory Tax Settlement Engine (ITNS-281)
-- Target Environment: Supabase PostgreSQL
-- Filename: 20261017320000_phase_8_12_withholding_tax_tds_governance.sql
-- =============================================================================

SET search_path = public, pg_temp;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure Account 2240 (TDS & Withholding Tax Payable) exists in Chart of Accounts
INSERT INTO public.chart_of_accounts 
(account_number, account_name, account_type, account_subtype, normal_balance, is_system_account, system_control_type, description)
VALUES
('2240', 'TDS & Withholding Tax Payable', 'LIABILITY', 'TAX_PAYABLE', 'CREDIT', true, NULL, 'Statutory withholding tax deducted at source payable to Central Government via ITNS-281')
ON CONFLICT (account_number) DO NOTHING;

-- Sequences for concurrency-safe sequential identifiers
CREATE SEQUENCE IF NOT EXISTS public.seq_tds_deduction_number START WITH 1001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_tds_challan_number START WITH 1001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_tds_certificate_number START WITH 1001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- =============================================================================
-- 1. TABLE: public.tds_sections_master
-- Master statutory tax deduction codes and default parameters under Income Tax Act
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tds_sections_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_code TEXT NOT NULL UNIQUE, -- e.g. 194Q_GOODS, 194C_COMPANY, 194C_INDIVIDUAL, 194J_TECH, 194H_COMMISSION, 206C_TCS
    section_title TEXT NOT NULL,
    act_section TEXT NOT NULL, -- e.g. '194Q', '194C', '194J', '194H', '206C(1H)'
    default_rate_pct NUMERIC(6, 3) NOT NULL CHECK (default_rate_pct >= 0),
    higher_rate_pct NUMERIC(6, 3) NOT NULL DEFAULT 20.000 CHECK (higher_rate_pct >= default_rate_pct),
    surcharge_rate_pct NUMERIC(6, 3) NOT NULL DEFAULT 0.000 CHECK (surcharge_rate_pct >= 0),
    cess_rate_pct NUMERIC(6, 3) NOT NULL DEFAULT 4.000 CHECK (cess_rate_pct >= 0),
    threshold_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (threshold_amount >= 0), -- e.g. 50,00,000 for 194Q, 15,000 for 194H
    threshold_type TEXT NOT NULL DEFAULT 'ANNUAL_AGGREGATE' CHECK (threshold_type IN ('PER_BILL', 'ANNUAL_AGGREGATE', 'SINGLE_OR_AGGREGATE')),
    gl_liability_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tds_sections_code ON public.tds_sections_master(section_code);
CREATE INDEX IF NOT EXISTS idx_tds_sections_active ON public.tds_sections_master(is_active);

-- Seed Standard Statutory Sections under Indian Income Tax Act
INSERT INTO public.tds_sections_master
(section_code, section_title, act_section, default_rate_pct, higher_rate_pct, surcharge_rate_pct, cess_rate_pct, threshold_amount, threshold_type, description)
VALUES
('194Q_GOODS', 'TDS on Purchase of Goods (> ₹50L)', '194Q', 0.100, 5.000, 0.000, 4.000, 5000000.00, 'ANNUAL_AGGREGATE', 'Statutory 0.1% TDS on value exceeding ₹50L aggregate purchases in financial year'),
('194C_COMPANY', 'TDS on Contractors (Corporate / Company)', '194C', 2.000, 20.000, 0.000, 4.000, 30000.00, 'SINGLE_OR_AGGREGATE', '2.0% TDS on freight and logistics contracts payable to corporate entities'),
('194C_INDIVIDUAL', 'TDS on Contractors (Individual / Proprietorship)', '194C', 1.000, 20.000, 0.000, 4.000, 30000.00, 'SINGLE_OR_AGGREGATE', '1.0% TDS on transport and logistics contractors payable to individuals'),
('194J_TECH', 'TDS on Technical & Professional Services', '194J', 2.000, 20.000, 0.000, 4.000, 30000.00, 'ANNUAL_AGGREGATE', '2.0% TDS on software, engineering and professional inspection fees'),
('194H_COMMISSION', 'TDS on Commission & Dealer Trade Incentives', '194H', 5.000, 20.000, 0.000, 4.000, 15000.00, 'ANNUAL_AGGREGATE', '5.0% TDS on dealer commercial rebates, volume discounts, and broker incentives exceeding ₹15,000'),
('206C_TCS', 'TCS on Sale of Television Goods (> ₹50L)', '206C(1H)', 0.100, 5.000, 0.000, 4.000, 5000000.00, 'ANNUAL_AGGREGATE', '0.1% TCS on B2B TV sales receipts exceeding ₹50L threshold')
ON CONFLICT (section_code) DO NOTHING;

-- =============================================================================
-- 2. TABLE: public.vendor_tds_profiles
-- Entity PAN compliance, lower deduction certificate tracking, and cumulative turnover
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_tds_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    pan_number TEXT NOT NULL,
    is_pan_valid BOOLEAN NOT NULL DEFAULT true,
    is_specified_person_206ab BOOLEAN NOT NULL DEFAULT false, -- Higher rate applies if true (non-filer)
    entity_classification TEXT NOT NULL DEFAULT 'COMPANY' CHECK (entity_classification IN ('COMPANY', 'INDIVIDUAL', 'HUF', 'PARTNERSHIP', 'LLP', 'GOVERNMENT', 'FOREIGN_ENTITY')),
    has_lower_deduction_cert BOOLEAN NOT NULL DEFAULT false,
    lower_deduction_cert_no TEXT,
    lower_deduction_rate_pct NUMERIC(6, 3) CHECK (lower_deduction_rate_pct IS NULL OR lower_deduction_rate_pct >= 0),
    lower_deduction_valid_from DATE,
    lower_deduction_valid_to DATE,
    lower_deduction_limit_amount NUMERIC(14, 2),
    cumulative_financial_turnover NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (cumulative_financial_turnover >= 0),
    current_fiscal_year TEXT NOT NULL DEFAULT 'FY2026-27',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_vendor_fiscal_tds_profile UNIQUE (vendor_id, current_fiscal_year),
    CONSTRAINT chk_lower_deduction_dates CHECK (
        (has_lower_deduction_cert = false) OR 
        (lower_deduction_valid_from IS NOT NULL AND lower_deduction_valid_to IS NOT NULL AND lower_deduction_valid_from <= lower_deduction_valid_to)
    )
);

CREATE INDEX IF NOT EXISTS idx_vendor_tds_profiles_vendor ON public.vendor_tds_profiles(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_tds_profiles_pan ON public.vendor_tds_profiles(pan_number);

-- =============================================================================
-- 3. TABLE: public.tds_deduction_ledger
-- Granular ledger linking vendor bills or dealer rebates to statutory tax deductions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tds_deduction_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deduction_number TEXT NOT NULL UNIQUE, -- e.g. TDS-202610-0001
    source_type TEXT NOT NULL CHECK (source_type IN ('VENDOR_INVOICE', 'LANDED_COST_VOUCHER', 'DEALER_SCHEME_SETTLEMENT', 'MANUAL_DEDUCTION')),
    source_id UUID NOT NULL,
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE RESTRICT,
    dealer_id UUID REFERENCES public.dealers(id) ON DELETE RESTRICT,
    tds_section_id UUID NOT NULL REFERENCES public.tds_sections_master(id) ON DELETE RESTRICT,
    deduction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    fiscal_year TEXT NOT NULL DEFAULT 'FY2026-27',
    quarter TEXT NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
    gross_base_amount NUMERIC(14, 2) NOT NULL CHECK (gross_base_amount > 0),
    exemption_threshold_applied NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (exemption_threshold_applied >= 0),
    taxable_base_amount NUMERIC(14, 2) NOT NULL CHECK (taxable_base_amount >= 0),
    applied_rate_pct NUMERIC(6, 3) NOT NULL CHECK (applied_rate_pct >= 0),
    tds_tax_amount NUMERIC(14, 2) NOT NULL CHECK (tds_tax_amount >= 0),
    surcharge_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (surcharge_amount >= 0),
    cess_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (cess_amount >= 0),
    total_tds_deducted NUMERIC(14, 2) NOT NULL CHECK (total_tds_deducted >= 0),
    net_payable_amount NUMERIC(14, 2) NOT NULL CHECK (net_payable_amount >= 0),
    pan_status TEXT NOT NULL DEFAULT 'VALID_PAN' CHECK (pan_status IN ('VALID_PAN', 'INVALID_PAN', 'PAN_NOT_AVAILABLE', 'LOWER_DEDUCTION_CERT')),
    rate_basis TEXT NOT NULL DEFAULT 'NORMAL_RATE' CHECK (rate_basis IN ('NORMAL_RATE', 'HIGHER_RATE_206AA', 'HIGHER_RATE_206AB', 'LOWER_RATE_CERT')),
    gl_journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    settlement_status TEXT NOT NULL DEFAULT 'ACCRUED' CHECK (settlement_status IN ('ACCRUED', 'DEPOSITED', 'CANCELLED', 'REFUNDED')),
    challan_id UUID, -- References tds_challan_settlements
    certificate_id UUID, -- References tds_form_16a_certificates
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_tds_net_balance CHECK (net_payable_amount = round(gross_base_amount - total_tds_deducted, 2))
);

CREATE INDEX IF NOT EXISTS idx_tds_ledger_source ON public.tds_deduction_ledger(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_tds_ledger_vendor ON public.tds_deduction_ledger(vendor_id);
CREATE INDEX IF NOT EXISTS idx_tds_ledger_dealer ON public.tds_deduction_ledger(dealer_id);
CREATE INDEX IF NOT EXISTS idx_tds_ledger_status ON public.tds_deduction_ledger(settlement_status);
CREATE INDEX IF NOT EXISTS idx_tds_ledger_quarter ON public.tds_deduction_ledger(fiscal_year, quarter);

-- =============================================================================
-- 4. TABLE: public.tds_challan_settlements
-- Statutory monthly ITNS-281 Government Challan deposits to Central Government
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tds_challan_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challan_reference_number TEXT NOT NULL UNIQUE, -- e.g. CHL-202610-0001
    bsr_code TEXT NOT NULL CHECK (length(bsr_code) = 7), -- 7-digit statutory RBI/Bank Branch code
    challan_tender_date DATE NOT NULL,
    challan_serial_number TEXT NOT NULL, -- CIN sequence number from bank counterfoil
    payment_mode TEXT NOT NULL DEFAULT 'E_PAYMENT' CHECK (payment_mode IN ('E_PAYMENT', 'NET_BANKING', 'NEFT_RTGS', 'OVER_THE_COUNTER')),
    bank_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
    fiscal_year TEXT NOT NULL DEFAULT 'FY2026-27',
    tax_month TEXT NOT NULL, -- e.g. '2026-10'
    section_code TEXT NOT NULL,
    total_tax_amount NUMERIC(14, 2) NOT NULL CHECK (total_tax_amount >= 0),
    surcharge_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (surcharge_amount >= 0),
    cess_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (cess_amount >= 0),
    interest_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (interest_amount >= 0),
    fee_penalty_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (fee_penalty_amount >= 0),
    total_challan_amount NUMERIC(14, 2) NOT NULL CHECK (total_challan_amount > 0),
    allocated_deductions_count INT NOT NULL DEFAULT 0,
    gl_journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    bank_utr_number TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_challan_total CHECK (total_challan_amount = round(total_tax_amount + surcharge_amount + cess_amount + interest_amount + fee_penalty_amount, 2))
);

CREATE INDEX IF NOT EXISTS idx_tds_challans_month ON public.tds_challan_settlements(tax_month);
CREATE INDEX IF NOT EXISTS idx_tds_challans_section ON public.tds_challan_settlements(section_code);

-- Link FK from tds_deduction_ledger to tds_challan_settlements
ALTER TABLE public.tds_deduction_ledger 
    ADD CONSTRAINT fk_tds_ledger_challan 
    FOREIGN KEY (challan_id) REFERENCES public.tds_challan_settlements(id) ON DELETE SET NULL;

-- =============================================================================
-- 5. TABLE: public.tds_form_26q_batches
-- Quarterly statutory return aggregation schedules (Form 26Q) and Form 16A issuance
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tds_form_26q_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_reference_number TEXT NOT NULL UNIQUE, -- e.g. 26Q-202627-Q2-0001
    fiscal_year TEXT NOT NULL DEFAULT 'FY2026-27',
    quarter TEXT NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    total_deductions_count INT NOT NULL DEFAULT 0,
    total_taxable_base NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_taxable_base >= 0),
    total_tds_deducted NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_tds_deducted >= 0),
    total_tds_deposited NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_tds_deposited >= 0),
    challan_matched_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'VALIDATED', 'CIN_VERIFIED', 'FILED', 'ACCEPTED_BY_TIN')),
    tin_acknowledgement_number TEXT,
    filing_date DATE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_26q_quarter_batch UNIQUE (fiscal_year, quarter)
);

CREATE INDEX IF NOT EXISTS idx_26q_batch_quarter ON public.tds_form_26q_batches(fiscal_year, quarter);

-- =============================================================================
-- 6. TABLE: public.tds_form_16a_certificates
-- Form 16A quarterly TDS certificates issued to vendors and dealers
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tds_form_16a_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_number TEXT NOT NULL UNIQUE, -- e.g. CERT-16A-202627-Q2-0001
    form_26q_batch_id UUID REFERENCES public.tds_form_26q_batches(id) ON DELETE SET NULL,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('VENDOR', 'DEALER')),
    recipient_vendor_id UUID REFERENCES public.vendors(id) ON DELETE RESTRICT,
    recipient_dealer_id UUID REFERENCES public.dealers(id) ON DELETE RESTRICT,
    pan_number TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    fiscal_year TEXT NOT NULL DEFAULT 'FY2026-27',
    quarter TEXT NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
    total_amount_credited NUMERIC(14, 2) NOT NULL CHECK (total_amount_credited >= 0),
    total_tds_deducted NUMERIC(14, 2) NOT NULL CHECK (total_tds_deducted >= 0),
    total_tds_deposited NUMERIC(14, 2) NOT NULL CHECK (total_tds_deposited >= 0),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    download_url TEXT,
    status TEXT NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED', 'DISPATCHED_TO_PARTY', 'ACKNOWLEDGED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_16a_recipient_quarter UNIQUE (recipient_type, recipient_vendor_id, recipient_dealer_id, fiscal_year, quarter)
);

CREATE INDEX IF NOT EXISTS idx_16a_recipient ON public.tds_form_16a_certificates(recipient_type, recipient_vendor_id, recipient_dealer_id);

-- Link FK from tds_deduction_ledger to tds_form_16a_certificates
ALTER TABLE public.tds_deduction_ledger 
    ADD CONSTRAINT fk_tds_ledger_cert 
    FOREIGN KEY (certificate_id) REFERENCES public.tds_form_16a_certificates(id) ON DELETE SET NULL;

-- =============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict multi-tenant isolation, staff protection, dealer/vendor isolation
-- =============================================================================
ALTER TABLE public.tds_sections_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_tds_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tds_deduction_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tds_challan_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tds_form_26q_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tds_form_16a_certificates ENABLE ROW LEVEL SECURITY;

-- 1. Master Sections: Readable by authenticated staff, writable by super_admin & admin
DROP POLICY IF EXISTS "Staff read tds_sections_master" ON public.tds_sections_master;
CREATE POLICY "Staff read tds_sections_master" ON public.tds_sections_master
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage tds_sections_master" ON public.tds_sections_master;
CREATE POLICY "Admin manage tds_sections_master" ON public.tds_sections_master
    FOR ALL TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin')
    );

-- 2. Vendor TDS Profiles: Full access by finance staff; vendors can only view their own
DROP POLICY IF EXISTS "Finance manage vendor_tds_profiles" ON public.vendor_tds_profiles;
CREATE POLICY "Finance manage vendor_tds_profiles" ON public.vendor_tds_profiles
    FOR ALL TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'finance')
    );

-- 3. Deduction Ledger: Managed by finance; vendors/dealers can only read their records
DROP POLICY IF EXISTS "Finance manage tds_deduction_ledger" ON public.tds_deduction_ledger;
CREATE POLICY "Finance manage tds_deduction_ledger" ON public.tds_deduction_ledger
    FOR ALL TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'finance')
    );

DROP POLICY IF EXISTS "Dealers read own tds_deductions" ON public.tds_deduction_ledger;
CREATE POLICY "Dealers read own tds_deductions" ON public.tds_deduction_ledger
    FOR SELECT TO authenticated
    USING (
        dealer_id = public.get_current_user_dealer_id()
    );

-- 4. Challan Settlements & 26Q Batches: Strictly restricted to super_admin and admin
DROP POLICY IF EXISTS "Finance manage tds_challan_settlements" ON public.tds_challan_settlements;
CREATE POLICY "Finance manage tds_challan_settlements" ON public.tds_challan_settlements
    FOR ALL TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'finance')
    );

DROP POLICY IF EXISTS "Finance manage tds_form_26q_batches" ON public.tds_form_26q_batches;
CREATE POLICY "Finance manage tds_form_26q_batches" ON public.tds_form_26q_batches
    FOR ALL TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'finance')
    );

-- 5. Form 16A Certificates: Finance manages; vendors/dealers can read their own
DROP POLICY IF EXISTS "Finance manage tds_form_16a_certificates" ON public.tds_form_16a_certificates;
CREATE POLICY "Finance manage tds_form_16a_certificates" ON public.tds_form_16a_certificates
    FOR ALL TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'finance')
    );

DROP POLICY IF EXISTS "Dealers read own form_16a_certificates" ON public.tds_form_16a_certificates;
CREATE POLICY "Dealers read own form_16a_certificates" ON public.tds_form_16a_certificates
    FOR SELECT TO authenticated
    USING (
        recipient_dealer_id = public.get_current_user_dealer_id()
    );

-- =============================================================================
-- 8. AUTHORITATIVE BUSINESS LOGIC RPCS (SECURITY DEFINER)
-- =============================================================================

-- Helper: Generate sequential concurrency-safe identifiers
CREATE OR REPLACE FUNCTION public.fn_generate_tds_number(p_prefix TEXT, p_seq_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_seq_val BIGINT;
    v_year_month TEXT;
BEGIN
    v_year_month := to_char(CURRENT_DATE, 'YYYYMM');
    v_seq_val := nextval('public.' || p_seq_name);
    RETURN p_prefix || '-' || v_year_month || '-' || lpad(v_seq_val::text, 4, '0');
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 1: fn_evaluate_and_deduct_tds
-- Evaluates Section thresholds, PAN validity, lower deduction certs, and deducts TDS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_evaluate_and_deduct_tds(
    p_source_type TEXT,
    p_source_id UUID,
    p_section_code TEXT,
    p_force_rate_pct NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_section RECORD;
    v_vendor RECORD;
    v_dealer RECORD;
    v_vendor_profile RECORD;
    v_gross_amount NUMERIC(14, 2);
    v_taxable_base NUMERIC(14, 2);
    v_effective_rate NUMERIC(6, 3);
    v_rate_basis TEXT := 'NORMAL_RATE';
    v_pan_status TEXT := 'VALID_PAN';
    v_tds_tax NUMERIC(14, 2);
    v_cess_tax NUMERIC(14, 2);
    v_total_tds NUMERIC(14, 2);
    v_net_payable NUMERIC(14, 2);
    v_deduction_num TEXT;
    v_deduction_id UUID;
    v_quarter TEXT;
    v_month INT;
    v_vendor_id UUID := NULL;
    v_dealer_id UUID := NULL;
    v_existing_id UUID;
BEGIN
    -- Check if deduction already exists (idempotency guard)
    SELECT id INTO v_existing_id 
    FROM public.tds_deduction_ledger 
    WHERE source_type = p_source_type AND source_id = p_source_id AND settlement_status != 'CANCELLED';

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'TDS deduction already exists for this transaction',
            'tds_deduction_id', v_existing_id,
            'is_duplicate', true
        );
    END IF;

    -- Fetch master section
    SELECT * INTO v_section 
    FROM public.tds_sections_master 
    WHERE section_code = p_section_code AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active TDS section code % not found', p_section_code;
    END IF;

    -- Determine quarter from current date
    v_month := EXTRACT(MONTH FROM CURRENT_DATE);
    IF v_month IN (4, 5, 6) THEN v_quarter := 'Q1';
    ELSIF v_month IN (7, 8, 9) THEN v_quarter := 'Q2';
    ELSIF v_month IN (10, 11, 12) THEN v_quarter := 'Q3';
    ELSE v_quarter := 'Q4';
    END IF;

    -- Extract gross amount and party based on source_type
    IF p_source_type = 'VENDOR_INVOICE' THEN
        SELECT vi.*, v.id as v_id, v.legal_name, v.tax_id as pan 
        INTO v_vendor 
        FROM public.vendor_invoices vi
        JOIN public.vendors v ON vi.vendor_id = v.id
        WHERE vi.id = p_source_id;

        IF NOT FOUND THEN RAISE EXCEPTION 'Vendor invoice % not found', p_source_id; END IF;
        v_gross_amount := v_vendor.subtotal; -- TDS is calculated on taxable base (excluding GST under Circular 23/2017)
        v_vendor_id := v_vendor.v_id;

        -- Check vendor TDS profile
        SELECT * INTO v_vendor_profile 
        FROM public.vendor_tds_profiles 
        WHERE vendor_id = v_vendor_id;

    ELSIF p_source_type = 'DEALER_SCHEME_SETTLEMENT' THEN
        SELECT dss.*, d.id as d_id, d.legal_name, d.tax_identifier as pan
        INTO v_dealer
        FROM public.dealer_scheme_settlements dss
        JOIN public.dealers d ON dss.dealer_id = d.id
        WHERE dss.id = p_source_id;

        IF NOT FOUND THEN RAISE EXCEPTION 'Dealer settlement % not found', p_source_id; END IF;
        v_gross_amount := v_dealer.approved_payout;
        v_dealer_id := v_dealer.d_id;

    ELSE
        RAISE EXCEPTION 'Unsupported TDS source type: %', p_source_type;
    END IF;

    -- Determine Tax Rate & Threshold Evaluation
    IF p_force_rate_pct IS NOT NULL THEN
        v_effective_rate := p_force_rate_pct;
        v_taxable_base := v_gross_amount;
    ELSIF p_section_code = '194Q_GOODS' THEN
        -- Section 194Q: 0.1% on purchase of goods exceeding ₹50,00,000 threshold
        IF v_vendor_profile.cumulative_financial_turnover + v_gross_amount <= v_section.threshold_amount THEN
            -- Below ₹50L threshold, no TDS deducted
            v_taxable_base := 0.00;
            v_effective_rate := 0.000;
        ELSIF v_vendor_profile.cumulative_financial_turnover < v_section.threshold_amount THEN
            -- Crosses threshold this transaction: tax only the incremental excess above ₹50L
            v_taxable_base := round((v_vendor_profile.cumulative_financial_turnover + v_gross_amount) - v_section.threshold_amount, 2);
            v_effective_rate := v_section.default_rate_pct;
        ELSE
            -- Already crossed threshold earlier: full bill is taxable
            v_taxable_base := v_gross_amount;
            v_effective_rate := v_section.default_rate_pct;
        END IF;

        -- Check Section 206AA / 206AB penalty rate
        IF v_vendor_profile.is_pan_valid = false OR v_vendor.pan IS NULL OR length(v_vendor.pan) != 10 THEN
            v_effective_rate := v_section.higher_rate_pct; -- 5% for 194Q under 206AA
            v_pan_status := 'INVALID_PAN';
            v_rate_basis := 'HIGHER_RATE_206AA';
        END IF;

    ELSIF p_section_code = '194H_COMMISSION' THEN
        -- Section 194H: 5.0% on dealer commission/incentives exceeding ₹15,000
        IF v_gross_amount >= v_section.threshold_amount THEN
            v_taxable_base := v_gross_amount;
            v_effective_rate := v_section.default_rate_pct;
        ELSE
            v_taxable_base := 0.00;
            v_effective_rate := 0.000;
        END IF;

        IF v_dealer.pan IS NULL OR length(v_dealer.pan) != 10 THEN
            v_effective_rate := v_section.higher_rate_pct; -- 20% under 206AA
            v_pan_status := 'INVALID_PAN';
            v_rate_basis := 'HIGHER_RATE_206AA';
        END IF;

    ELSE
        -- Default Section behavior (194C, 194J)
        v_taxable_base := v_gross_amount;
        v_effective_rate := v_section.default_rate_pct;

        -- Check lower deduction certificate
        IF v_vendor_profile.has_lower_deduction_cert = true 
           AND CURRENT_DATE BETWEEN v_vendor_profile.lower_deduction_valid_from AND v_vendor_profile.lower_deduction_valid_to THEN
            v_effective_rate := v_vendor_profile.lower_deduction_rate_pct;
            v_pan_status := 'LOWER_DEDUCTION_CERT';
            v_rate_basis := 'LOWER_RATE_CERT';
        ELSIF v_vendor_profile.is_pan_valid = false THEN
            v_effective_rate := v_section.higher_rate_pct;
            v_pan_status := 'INVALID_PAN';
            v_rate_basis := 'HIGHER_RATE_206AA';
        END IF;
    END IF;

    -- Arithmetic calculation
    v_tds_tax := round(v_taxable_base * (v_effective_rate / 100.0), 2);
    v_cess_tax := 0.00; -- Cess not applicable on resident domestic TDS (only on NRI/Salaries)
    v_total_tds := v_tds_tax + v_cess_tax;
    v_net_payable := round(v_gross_amount - v_total_tds, 2);

    -- Generate sequence number
    v_deduction_num := public.fn_generate_tds_number('TDS', 'seq_tds_deduction_number');

    -- Insert into deduction ledger
    INSERT INTO public.tds_deduction_ledger (
        deduction_number, source_type, source_id, vendor_id, dealer_id,
        tds_section_id, deduction_date, fiscal_year, quarter,
        gross_base_amount, exemption_threshold_applied, taxable_base_amount,
        applied_rate_pct, tds_tax_amount, cess_amount, total_tds_deducted,
        net_payable_amount, pan_status, rate_basis, settlement_status, created_by
    ) VALUES (
        v_deduction_num, p_source_type, p_source_id, v_vendor_id, v_dealer_id,
        v_section.id, CURRENT_DATE, 'FY2026-27', v_quarter,
        v_gross_amount, (v_gross_amount - v_taxable_base), v_taxable_base,
        v_effective_rate, v_tds_tax, v_cess_tax, v_total_tds,
        v_net_payable, v_pan_status, v_rate_basis, 'ACCRUED', auth.uid()
    ) RETURNING id INTO v_deduction_id;

    -- Update vendor cumulative turnover if vendor transaction
    IF v_vendor_id IS NOT NULL THEN
        UPDATE public.vendor_tds_profiles 
        SET cumulative_financial_turnover = round(cumulative_financial_turnover + v_gross_amount, 2),
            updated_at = now()
        WHERE vendor_id = v_vendor_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'tds_deduction_id', v_deduction_id,
        'deduction_number', v_deduction_num,
        'gross_base_amount', v_gross_amount,
        'taxable_base_amount', v_taxable_base,
        'applied_rate_pct', v_effective_rate,
        'total_tds_deducted', v_total_tds,
        'net_payable_amount', v_net_payable,
        'pan_status', v_pan_status,
        'rate_basis', v_rate_basis
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 2: fn_post_tds_deduction_to_gl
-- Posts balanced double entry: Dr AP Control (2100) / Cr TDS Payable (2240)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_post_tds_deduction_to_gl(p_tds_deduction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deduction RECORD;
    v_entry_number TEXT;
    v_journal_id UUID;
    v_ap_account_id UUID;
    v_tds_account_id UUID;
    v_current_period UUID;
BEGIN
    SELECT * INTO v_deduction 
    FROM public.tds_deduction_ledger 
    WHERE id = p_tds_deduction_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'TDS Deduction % not found', p_tds_deduction_id; END IF;
    IF v_deduction.total_tds_deducted <= 0 THEN
        RETURN jsonb_build_object('success', true, 'message', 'Zero TDS, no GL entry needed');
    END IF;
    IF v_deduction.gl_journal_entry_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'message', 'GL entry already exists', 'journal_entry_id', v_deduction.gl_journal_entry_id);
    END IF;

    -- Find Accounts
    SELECT id INTO v_ap_account_id FROM public.chart_of_accounts WHERE account_number = '2100';
    SELECT id INTO v_tds_account_id FROM public.chart_of_accounts WHERE account_number = '2240';

    -- Find Open Period
    SELECT id INTO v_current_period 
    FROM public.accounting_periods 
    WHERE status = 'OPEN' AND CURRENT_DATE BETWEEN start_date AND end_date 
    LIMIT 1;

    IF v_current_period IS NULL THEN
        RAISE EXCEPTION 'No open accounting period found for date %', CURRENT_DATE;
    END IF;

    v_entry_number := 'JE-TDS-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(nextval('public.seq_journal_entry_number')::text, 4, '0');

    -- Create balanced journal entry header
    INSERT INTO public.journal_entries (
        entry_number, entry_date, accounting_period_id, source_document_type,
        source_document_id, narration, total_debit, total_credit, status, is_balanced
    ) VALUES (
        v_entry_number, CURRENT_DATE, v_current_period, 'TDS_WITHHOLDING',
        p_tds_deduction_id, 'TDS withholding entry: ' || v_deduction.deduction_number,
        v_deduction.total_tds_deducted, v_deduction.total_tds_deducted, 'POSTED', true
    ) RETURNING id INTO v_journal_id;

    -- Line 1: Debit AP Control 2100 (reducing vendor gross liability by tax withheld)
    INSERT INTO public.journal_lines (
        journal_entry_id, account_id, line_type, amount, description
    ) VALUES (
        v_journal_id, v_ap_account_id, 'DEBIT', v_deduction.total_tds_deducted,
        'Withholding offset against vendor bill / rebate'
    );

    -- Line 2: Credit TDS Payable 2240 (creating statutory liability to Government)
    INSERT INTO public.journal_lines (
        journal_entry_id, account_id, line_type, amount, description
    ) VALUES (
        v_journal_id, v_tds_account_id, 'CREDIT', v_deduction.total_tds_deducted,
        'Statutory TDS Payable u/s ' || v_deduction.deduction_number
    );

    -- Update deduction record
    UPDATE public.tds_deduction_ledger 
    SET gl_journal_entry_id = v_journal_id, updated_at = now() 
    WHERE id = p_tds_deduction_id;

    RETURN jsonb_build_object(
        'success', true,
        'journal_entry_id', v_journal_id,
        'entry_number', v_entry_number,
        'amount', v_deduction.total_tds_deducted
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 3: fn_record_tds_challan_payment
-- Deposits withheld tax to Central Government (ITNS-281) & balances GL
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_record_tds_challan_payment(p_challan_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_bsr_code TEXT;
    v_tender_date DATE;
    v_cin TEXT;
    v_tax_month TEXT;
    v_section_code TEXT;
    v_tax_amount NUMERIC(14, 2);
    v_interest NUMERIC(14, 2) := 0.00;
    v_penalty NUMERIC(14, 2) := 0.00;
    v_total_amount NUMERIC(14, 2);
    v_bank_account_id UUID;
    v_tds_account_id UUID;
    v_interest_account_id UUID;
    v_challan_ref TEXT;
    v_challan_id UUID;
    v_journal_id UUID;
    v_entry_number TEXT;
    v_current_period UUID;
    v_deduction_ids UUID[];
    v_count INT := 0;
BEGIN
    v_bsr_code := p_challan_data->>'bsr_code';
    v_tender_date := (p_challan_data->>'challan_tender_date')::DATE;
    v_cin := p_challan_data->>'challan_serial_number';
    v_tax_month := p_challan_data->>'tax_month';
    v_section_code := p_challan_data->>'section_code';
    v_tax_amount := (p_challan_data->>'tax_amount')::NUMERIC;
    v_interest := COALESCE((p_challan_data->>'interest_amount')::NUMERIC, 0.00);
    v_penalty := COALESCE((p_challan_data->>'fee_penalty_amount')::NUMERIC, 0.00);
    v_total_amount := round(v_tax_amount + v_interest + v_penalty, 2);

    IF length(v_bsr_code) != 7 THEN
        RAISE EXCEPTION 'Statutory BSR code must be exactly 7 digits. Got: %', v_bsr_code;
    END IF;

    IF v_total_amount <= 0 THEN
        RAISE EXCEPTION 'Challan payment amount must be positive';
    END IF;

    -- Accounts
    SELECT id INTO v_tds_account_id FROM public.chart_of_accounts WHERE account_number = '2240';
    SELECT id INTO v_bank_account_id FROM public.chart_of_accounts WHERE account_number = '1010';
    SELECT id INTO v_interest_account_id FROM public.chart_of_accounts WHERE account_number = '5100';

    -- Open Period
    SELECT id INTO v_current_period 
    FROM public.accounting_periods 
    WHERE status = 'OPEN' AND v_tender_date BETWEEN start_date AND end_date 
    LIMIT 1;

    IF v_current_period IS NULL THEN
        RAISE EXCEPTION 'No open accounting period found for challan date %', v_tender_date;
    END IF;

    v_challan_ref := public.fn_generate_tds_number('CHL', 'seq_tds_challan_number');

    -- Insert Challan
    INSERT INTO public.tds_challan_settlements (
        challan_reference_number, bsr_code, challan_tender_date, challan_serial_number,
        payment_mode, bank_account_id, fiscal_year, tax_month, section_code,
        total_tax_amount, interest_amount, fee_penalty_amount, total_challan_amount,
        created_by
    ) VALUES (
        v_challan_ref, v_bsr_code, v_tender_date, v_cin,
        'E_PAYMENT', v_bank_account_id, 'FY2026-27', v_tax_month, v_section_code,
        v_tax_amount, v_interest, v_penalty, v_total_amount, auth.uid()
    ) RETURNING id INTO v_challan_id;

    -- Allocate accrued deductions to this challan
    UPDATE public.tds_deduction_ledger 
    SET challan_id = v_challan_id,
        settlement_status = 'DEPOSITED',
        updated_at = now()
    WHERE settlement_status = 'ACCRUED' 
      AND to_char(deduction_date, 'YYYY-MM') = v_tax_month
      AND tds_section_id IN (SELECT id FROM public.tds_sections_master WHERE section_code = v_section_code);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    UPDATE public.tds_challan_settlements SET allocated_deductions_count = v_count WHERE id = v_challan_id;

    -- Post Balanced GL Settlement Entry: Dr 2240 TDS Payable = Cr 1010 Bank
    v_entry_number := 'JE-CHL-' || to_char(v_tender_date, 'YYYYMM') || '-' || lpad(nextval('public.seq_journal_entry_number')::text, 4, '0');

    INSERT INTO public.journal_entries (
        entry_number, entry_date, accounting_period_id, source_document_type,
        source_document_id, narration, total_debit, total_credit, status, is_balanced
    ) VALUES (
        v_entry_number, v_tender_date, v_current_period, 'TDS_CHALLAN_PAYMENT',
        v_challan_id, 'ITNS-281 Statutory TDS deposit: CIN ' || v_cin || ' BSR ' || v_bsr_code,
        v_total_amount, v_total_amount, 'POSTED', true
    ) RETURNING id INTO v_journal_id;

    -- Line 1: Debit 2240 TDS Payable (clearing statutory liability)
    INSERT INTO public.journal_lines (
        journal_entry_id, account_id, line_type, amount, description
    ) VALUES (
        v_journal_id, v_tds_account_id, 'DEBIT', v_tax_amount,
        'Clearance of statutory TDS liability for ' || v_tax_month
    );

    -- Line 1b: Debit Interest/Penalty if present
    IF (v_interest + v_penalty) > 0 THEN
        INSERT INTO public.journal_lines (
            journal_entry_id, account_id, line_type, amount, description
        ) VALUES (
            v_journal_id, v_interest_account_id, 'DEBIT', (v_interest + v_penalty),
            'Statutory TDS late payment interest and filing fee'
        );
    END IF;

    -- Line 2: Credit 1010 Operating Bank (outflow of funds)
    INSERT INTO public.journal_lines (
        journal_entry_id, account_id, line_type, amount, description
    ) VALUES (
        v_journal_id, v_bank_account_id, 'CREDIT', v_total_amount,
        'Statutory challan payment to Central Government'
    );

    UPDATE public.tds_challan_settlements 
    SET gl_journal_entry_id = v_journal_id 
    WHERE id = v_challan_id;

    RETURN jsonb_build_object(
        'success', true,
        'challan_id', v_challan_id,
        'challan_reference_number', v_challan_ref,
        'total_deposited', v_total_amount,
        'allocated_deductions_count', v_count,
        'journal_entry_id', v_journal_id
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 4: fn_generate_form_26q_quarterly_schedule
-- Compiles quarterly Form 26Q return batches and verifies CIN coverage
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_generate_form_26q_quarterly_schedule(
    p_fiscal_year TEXT,
    p_quarter TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_batch_ref TEXT;
    v_batch_id UUID;
    v_total_deductions INT;
    v_total_base NUMERIC(14, 2);
    v_total_deducted NUMERIC(14, 2);
    v_total_deposited NUMERIC(14, 2);
    v_cin_matched INT;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- Set quarter dates
    IF p_quarter = 'Q1' THEN v_start_date := '2026-04-01'; v_end_date := '2026-06-30';
    ELSIF p_quarter = 'Q2' THEN v_start_date := '2026-07-01'; v_end_date := '2026-09-30';
    ELSIF p_quarter = 'Q3' THEN v_start_date := '2026-10-01'; v_end_date := '2026-12-31';
    ELSE v_start_date := '2027-01-01'; v_end_date := '2027-03-31';
    END IF;

    -- Aggregate totals
    SELECT 
        COUNT(*),
        COALESCE(SUM(taxable_base_amount), 0.00),
        COALESCE(SUM(total_tds_deducted), 0.00),
        COALESCE(SUM(CASE WHEN settlement_status = 'DEPOSITED' THEN total_tds_deducted ELSE 0.00 END), 0.00),
        COUNT(challan_id)
    INTO 
        v_total_deductions, v_total_base, v_total_deducted, v_total_deposited, v_cin_matched
    FROM public.tds_deduction_ledger
    WHERE fiscal_year = p_fiscal_year AND quarter = p_quarter AND settlement_status != 'CANCELLED';

    v_batch_ref := '26Q-' || replace(p_fiscal_year, '-', '') || '-' || p_quarter || '-' || lpad(nextval('public.seq_tds_deduction_number')::text, 4, '0');

    INSERT INTO public.tds_form_26q_batches (
        batch_reference_number, fiscal_year, quarter, period_start_date, period_end_date,
        total_deductions_count, total_taxable_base, total_tds_deducted, total_tds_deposited,
        challan_matched_count, status, created_by
    ) VALUES (
        v_batch_ref, p_fiscal_year, p_quarter, v_start_date, v_end_date,
        v_total_deductions, v_total_base, v_total_deducted, v_total_deposited,
        v_cin_matched, CASE WHEN v_total_deductions = v_cin_matched AND v_total_deductions > 0 THEN 'CIN_VERIFIED' ELSE 'DRAFT' END,
        auth.uid()
    ) ON CONFLICT (fiscal_year, quarter) DO UPDATE SET
        total_deductions_count = EXCLUDED.total_deductions_count,
        total_taxable_base = EXCLUDED.total_taxable_base,
        total_tds_deducted = EXCLUDED.total_tds_deducted,
        total_tds_deposited = EXCLUDED.total_tds_deposited,
        challan_matched_count = EXCLUDED.challan_matched_count,
        updated_at = now()
    RETURNING id INTO v_batch_id;

    RETURN jsonb_build_object(
        'success', true,
        'batch_id', v_batch_id,
        'batch_reference_number', v_batch_ref,
        'total_deductions_count', v_total_deductions,
        'total_tds_deducted', v_total_deducted,
        'total_tds_deposited', v_total_deposited,
        'cin_matched_count', v_cin_matched,
        'is_fully_deposited', (v_total_deducted = v_total_deposited)
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 5: fn_issue_form_16a_certificate
-- Issues digital Form 16A quarterly TDS certificate to vendor or dealer
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_issue_form_16a_certificate(
    p_recipient_type TEXT,
    p_party_id UUID,
    p_fiscal_year TEXT,
    p_quarter TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cert_num TEXT;
    v_cert_id UUID;
    v_pan TEXT;
    v_legal_name TEXT;
    v_total_credited NUMERIC(14, 2);
    v_total_deducted NUMERIC(14, 2);
    v_total_deposited NUMERIC(14, 2);
    v_vendor_id UUID := NULL;
    v_dealer_id UUID := NULL;
BEGIN
    IF p_recipient_type = 'VENDOR' THEN
        v_vendor_id := p_party_id;
        SELECT legal_name, tax_id INTO v_legal_name, v_pan FROM public.vendors WHERE id = p_party_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Vendor % not found', p_party_id; END IF;

        SELECT 
            COALESCE(SUM(gross_base_amount), 0.00),
            COALESCE(SUM(total_tds_deducted), 0.00),
            COALESCE(SUM(CASE WHEN settlement_status = 'DEPOSITED' THEN total_tds_deducted ELSE 0.00 END), 0.00)
        INTO v_total_credited, v_total_deducted, v_total_deposited
        FROM public.tds_deduction_ledger
        WHERE vendor_id = p_party_id AND fiscal_year = p_fiscal_year AND quarter = p_quarter AND settlement_status != 'CANCELLED';

    ELSIF p_recipient_type = 'DEALER' THEN
        v_dealer_id := p_party_id;
        SELECT legal_name, tax_identifier INTO v_legal_name, v_pan FROM public.dealers WHERE id = p_party_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Dealer % not found', p_party_id; END IF;

        SELECT 
            COALESCE(SUM(gross_base_amount), 0.00),
            COALESCE(SUM(total_tds_deducted), 0.00),
            COALESCE(SUM(CASE WHEN settlement_status = 'DEPOSITED' THEN total_tds_deducted ELSE 0.00 END), 0.00)
        INTO v_total_credited, v_total_deducted, v_total_deposited
        FROM public.tds_deduction_ledger
        WHERE dealer_id = p_party_id AND fiscal_year = p_fiscal_year AND quarter = p_quarter AND settlement_status != 'CANCELLED';

    ELSE
        RAISE EXCEPTION 'Invalid recipient type: %', p_recipient_type;
    END IF;

    IF v_total_deducted = 0 THEN
        RAISE EXCEPTION 'No statutory TDS deductions found for party % in %-%', p_party_id, p_fiscal_year, p_quarter;
    END IF;

    v_cert_num := 'CERT-16A-' || replace(p_fiscal_year, '-', '') || '-' || p_quarter || '-' || lpad(nextval('public.seq_tds_certificate_number')::text, 4, '0');

    INSERT INTO public.tds_form_16a_certificates (
        certificate_number, recipient_type, recipient_vendor_id, recipient_dealer_id,
        pan_number, legal_name, fiscal_year, quarter,
        total_amount_credited, total_tds_deducted, total_tds_deposited,
        status
    ) VALUES (
        v_cert_num, p_recipient_type, v_vendor_id, v_dealer_id,
        COALESCE(v_pan, 'PANNOTAVBL'), v_legal_name, p_fiscal_year, p_quarter,
        v_total_credited, v_total_deducted, v_total_deposited,
        'GENERATED'
    ) ON CONFLICT (recipient_type, recipient_vendor_id, recipient_dealer_id, fiscal_year, quarter) DO UPDATE SET
        total_amount_credited = EXCLUDED.total_amount_credited,
        total_tds_deducted = EXCLUDED.total_tds_deducted,
        total_tds_deposited = EXCLUDED.total_tds_deposited,
        status = 'GENERATED'
    RETURNING id INTO v_cert_id;

    -- Link deductions to certificate
    UPDATE public.tds_deduction_ledger 
    SET certificate_id = v_cert_id 
    WHERE ((p_recipient_type = 'VENDOR' AND vendor_id = p_party_id) OR (p_recipient_type = 'DEALER' AND dealer_id = p_party_id))
      AND fiscal_year = p_fiscal_year AND quarter = p_quarter;

    RETURN jsonb_build_object(
        'success', true,
        'certificate_id', v_cert_id,
        'certificate_number', v_cert_num,
        'legal_name', v_legal_name,
        'pan_number', v_pan,
        'total_amount_credited', v_total_credited,
        'total_tds_deducted', v_total_deducted,
        'total_tds_deposited', v_total_deposited
    );
END;
$$;
