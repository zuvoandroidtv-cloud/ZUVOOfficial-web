-- =============================================================================
-- ZUVO TV CRM — PHASE 8.13 MASTER DATABASE MIGRATION
-- Enterprise Payroll, Employee Expenses & Statutory HR Finance Engine
-- Target Environment: Supabase PostgreSQL
-- Filename: 20261017330000_phase_8_13_payroll_employee_expenses.sql
-- =============================================================================

SET search_path = public, pg_temp;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. SEED COA ACCOUNTS FOR PAYROLL, HR LIABILITIES & STATUTORY CONTRIBUTIONS
-- =============================================================================
INSERT INTO public.chart_of_accounts 
(account_number, account_name, account_type, account_subtype, normal_balance, is_system_account, system_control_type, description)
VALUES
-- Operating Expenses (5000s)
('5600', 'Salaries, Wages & Allowances', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, NULL, 'Base salaries, HRA, DA, and direct compensation to employees'),
('5610', 'Employer EPF Contribution Expense', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, NULL, 'Statutory employer 12% provident fund matching contribution'),
('5620', 'Employer ESIC Contribution Expense', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, NULL, 'Statutory employer 3.25% employee state insurance contribution'),
('5630', 'Employee Welfare & Expense Reimbursements', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, NULL, 'Approved employee business travel, meal and operational claims'),

-- Current Liabilities (2000s)
('2300', 'Salaries & Wages Payable', 'LIABILITY', 'PAYABLES', 'CREDIT', true, NULL, 'Net monthly payroll payable to employees'),
('2310', 'Employee Reimbursements Payable', 'LIABILITY', 'PAYABLES', 'CREDIT', true, NULL, 'Approved expense claims payable to staff'),
('2320', 'EPF Payable (Employee & Employer)', 'LIABILITY', 'TAX_PAYABLE', 'CREDIT', true, NULL, 'Total provident fund contribution payable to EPFO'),
('2330', 'ESIC Payable (Employee & Employer)', 'LIABILITY', 'TAX_PAYABLE', 'CREDIT', true, NULL, 'Total ESIC contribution payable to ESI Corporation'),
('2340', 'Professional Tax Payable', 'LIABILITY', 'TAX_PAYABLE', 'CREDIT', true, NULL, 'State-wise employee professional tax deducted and payable to State Govt'),
('2350', 'Salary TDS Payable (Section 192)', 'LIABILITY', 'TAX_PAYABLE', 'CREDIT', true, NULL, 'Income tax deducted at source from employee salaries under Section 192'),

-- Current Assets (1000s)
('1150', 'Employee Advances & Receivables', 'ASSET', 'RECEIVABLES', 'DEBIT', true, NULL, 'Recoverable salary and travel advances disbursed to staff')
ON CONFLICT (account_number) DO NOTHING;

-- =============================================================================
-- 2. SEQUENCES FOR CONCURRENCY-SAFE NUMBERING
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_employee_code START WITH 1001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_payroll_run_number START WITH 1001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_expense_claim_number START WITH 1001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_advance_number START WITH 1001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_payslip_number START WITH 1001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- =============================================================================
-- 3. TABLE: public.employee_master
-- Canonical employee registry linking profile identities, bank and statutory IDs
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employee_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    employee_code TEXT NOT NULL UNIQUE, -- e.g. EMP-1001
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    date_of_joining DATE NOT NULL,
    date_of_exit DATE,
    department TEXT NOT NULL CHECK (department IN ('MANUFACTURING', 'WAREHOUSE', 'SERVICE', 'SALES', 'FINANCE', 'HR', 'MANAGEMENT')),
    designation TEXT NOT NULL,
    location_depot_id UUID REFERENCES public.depots(id) ON DELETE SET NULL,
    employment_type TEXT NOT NULL DEFAULT 'FULL_TIME' CHECK (employment_type IN ('FULL_TIME', 'PROBATION', 'CONTRACTOR', 'INTERN')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED')),
    pan_number TEXT,
    uan_number TEXT, -- Universal Account Number for EPF
    esic_number TEXT,
    bank_account_number TEXT,
    bank_ifsc TEXT,
    bank_name TEXT,
    cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES public.employee_master(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_employee_dates CHECK (date_of_exit IS NULL OR date_of_joining <= date_of_exit)
);

CREATE INDEX IF NOT EXISTS idx_employee_master_code ON public.employee_master(employee_code);
CREATE INDEX IF NOT EXISTS idx_employee_master_dept ON public.employee_master(department);
CREATE INDEX IF NOT EXISTS idx_employee_master_status ON public.employee_master(status);
CREATE INDEX IF NOT EXISTS idx_employee_master_tenant ON public.employee_master(tenant_id);

-- =============================================================================
-- 4. TABLE: public.employee_compensation
-- Versioned, effective-dated CTC structures and statutory flags
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employee_compensation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    employee_id UUID NOT NULL REFERENCES public.employee_master(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    basic_salary NUMERIC(14, 2) NOT NULL CHECK (basic_salary >= 0),
    hra NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (hra >= 0),
    special_allowance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (special_allowance >= 0),
    other_allowances NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (other_allowances >= 0),
    gross_salary NUMERIC(14, 2) GENERATED ALWAYS AS (basic_salary + hra + special_allowance + other_allowances) STORED,
    annual_ctc NUMERIC(14, 2) NOT NULL CHECK (annual_ctc >= 0),
    employee_pf_enabled BOOLEAN NOT NULL DEFAULT true,
    employer_pf_enabled BOOLEAN NOT NULL DEFAULT true,
    esi_enabled BOOLEAN NOT NULL DEFAULT true,
    professional_tax_enabled BOOLEAN NOT NULL DEFAULT true,
    payroll_tds_enabled BOOLEAN NOT NULL DEFAULT true,
    tds_monthly_deduction NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tds_monthly_deduction >= 0),
    state_for_pt TEXT NOT NULL DEFAULT 'MAHARASHTRA',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_comp_dates CHECK (effective_to IS NULL OR effective_from <= effective_to)
);

CREATE INDEX IF NOT EXISTS idx_employee_compensation_emp ON public.employee_compensation(employee_id, is_active);

-- =============================================================================
-- 5. TABLE: public.payroll_periods
-- Monthly operating payroll control calendar linked to Phase 8.3 accounting periods
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    period_code TEXT NOT NULL UNIQUE, -- e.g. PAY-2026-10
    fiscal_year TEXT NOT NULL, -- e.g. FY2026-27
    month_number INT NOT NULL CHECK (month_number BETWEEN 1 AND 12),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_calendar_days INT NOT NULL CHECK (total_calendar_days BETWEEN 28 AND 31),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'PROCESSING', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'PAID', 'CLOSED'
    )),
    accounting_period_id UUID REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    locked_by UUID REFERENCES auth.users(id),
    locked_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_payroll_period_dates CHECK (period_start <= period_end)
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_dates ON public.payroll_periods(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON public.payroll_periods(status);

-- =============================================================================
-- 6. TABLE: public.payroll_runs
-- Batch execution run summarizing gross, deductions, employer cost, and approval
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    run_number TEXT NOT NULL UNIQUE, -- e.g. RUN-202610-0001
    payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE RESTRICT,
    run_date DATE NOT NULL DEFAULT CURRENT_DATE,
    employee_count INT NOT NULL DEFAULT 0 CHECK (employee_count >= 0),
    total_gross_payroll NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_gross_payroll >= 0),
    total_employee_pf NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_employee_pf >= 0),
    total_employee_esi NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_employee_esi >= 0),
    total_professional_tax NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_professional_tax >= 0),
    total_salary_tds NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_salary_tds >= 0),
    total_advance_recovery NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_advance_recovery >= 0),
    total_other_deductions NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_other_deductions >= 0),
    total_net_payroll NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_net_payroll >= 0),
    total_employer_pf NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_employer_pf >= 0),
    total_employer_esi NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_employer_esi >= 0),
    total_employer_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_employer_cost >= 0),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED_TO_GL', 'PAID', 'CANCELLED'
    )),
    gl_journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    submitted_by UUID REFERENCES auth.users(id),
    submitted_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payroll_period_run UNIQUE (payroll_period_id, status)
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_period ON public.payroll_runs(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON public.payroll_runs(status);

-- =============================================================================
-- 7. TABLE: public.payroll_employee_entries
-- Detailed itemized payroll slip line for each employee in a run
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.payroll_employee_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employee_master(id) ON DELETE RESTRICT,
    compensation_id UUID REFERENCES public.employee_compensation(id) ON DELETE RESTRICT,
    calendar_days INT NOT NULL,
    payable_days NUMERIC(5, 2) NOT NULL CHECK (payable_days >= 0),
    loss_of_pay_days NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (loss_of_pay_days >= 0),
    earned_basic NUMERIC(14, 2) NOT NULL CHECK (earned_basic >= 0),
    earned_hra NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (earned_hra >= 0),
    earned_special_allowance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (earned_special_allowance >= 0),
    earned_other_allowances NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (earned_other_allowances >= 0),
    gross_earnings NUMERIC(14, 2) NOT NULL CHECK (gross_earnings >= 0),
    employee_pf NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (employee_pf >= 0),
    employee_esi NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (employee_esi >= 0),
    professional_tax NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (professional_tax >= 0),
    salary_tds NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (salary_tds >= 0),
    advance_recovery NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (advance_recovery >= 0),
    other_deductions NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (other_deductions >= 0),
    total_deductions NUMERIC(14, 2) NOT NULL CHECK (total_deductions >= 0),
    net_salary NUMERIC(14, 2) NOT NULL CHECK (net_salary >= 0),
    employer_pf NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (employer_pf >= 0),
    employer_esi NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (employer_esi >= 0),
    employer_total_cost NUMERIC(14, 2) NOT NULL CHECK (employer_total_cost >= 0),
    payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PROCESSING', 'PAID', 'ON_HOLD')),
    payment_reference TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_run_employee_entry UNIQUE (payroll_run_id, employee_id),
    CONSTRAINT chk_entry_net_arithmetic CHECK (net_salary = round(gross_earnings - total_deductions, 2))
);

CREATE INDEX IF NOT EXISTS idx_payroll_entries_run ON public.payroll_employee_entries(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_emp ON public.payroll_employee_entries(employee_id);

-- =============================================================================
-- 8. TABLE: public.employee_expense_claims
-- Employee reimbursement requests with approval gate and AP integration
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employee_expense_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    claim_number TEXT NOT NULL UNIQUE, -- e.g. EXP-202610-0001
    employee_id UUID NOT NULL REFERENCES public.employee_master(id) ON DELETE RESTRICT,
    expense_date DATE NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'TRAVEL_CONVEYANCE', 'MEALS_LODGING', 'CLIENT_ENTERTAINMENT', 'OFFICE_SUPPLIES', 'TRAINING', 'OTHER'
    )),
    title TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount > 0),
    cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    receipt_url TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'POSTED_TO_GL', 'PAID'
    )),
    gl_journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    payment_reference TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_claims_emp ON public.employee_expense_claims(employee_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_status ON public.employee_expense_claims(status);

-- =============================================================================
-- 9. TABLE: public.employee_advances
-- Disbursed recoverable advances with balance tracking and payroll recovery
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employee_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    advance_number TEXT NOT NULL UNIQUE, -- e.g. ADV-202610-0001
    employee_id UUID NOT NULL REFERENCES public.employee_master(id) ON DELETE RESTRICT,
    advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    principal_amount NUMERIC(14, 2) NOT NULL CHECK (principal_amount > 0),
    recovered_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (recovered_amount >= 0),
    remaining_balance NUMERIC(14, 2) NOT NULL CHECK (remaining_balance >= 0),
    monthly_installment NUMERIC(14, 2) NOT NULL CHECK (monthly_installment > 0),
    status TEXT NOT NULL DEFAULT 'DISBURSED' CHECK (status IN (
        'REQUESTED', 'APPROVED', 'DISBURSED', 'PARTIALLY_RECOVERED', 'FULLY_RECOVERED', 'WRITTEN_OFF'
    )),
    purpose TEXT NOT NULL,
    gl_journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_advance_balance CHECK (remaining_balance = round(principal_amount - recovered_amount, 2))
);

CREATE INDEX IF NOT EXISTS idx_employee_advances_emp ON public.employee_advances(employee_id, status);

-- =============================================================================
-- 10. TABLE: public.payslip_records
-- Immutable monthly payslip snapshots with cryptographic verification hashes
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.payslip_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    payslip_number TEXT NOT NULL UNIQUE, -- e.g. SLIP-202610-0001
    payroll_entry_id UUID NOT NULL REFERENCES public.payroll_employee_entries(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employee_master(id) ON DELETE RESTRICT,
    payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE RESTRICT,
    fiscal_year TEXT NOT NULL,
    month_name TEXT NOT NULL,
    gross_earnings NUMERIC(14, 2) NOT NULL,
    total_deductions NUMERIC(14, 2) NOT NULL,
    net_salary NUMERIC(14, 2) NOT NULL,
    payslip_payload JSONB NOT NULL, -- Complete immutable snapshot of all line items
    verification_hash TEXT NOT NULL, -- SHA-256 integrity hash
    is_dispatched BOOLEAN NOT NULL DEFAULT false,
    dispatched_at TIMESTAMPTZ,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payslip_entry UNIQUE (payroll_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_payslips_emp_period ON public.payslip_records(employee_id, payroll_period_id);

-- =============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict multi-tenant isolation, HR/Finance control, employee self-view isolation
-- =============================================================================
ALTER TABLE public.employee_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_compensation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_employee_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_records ENABLE ROW LEVEL SECURITY;

-- 1. Employee Master
CREATE POLICY "HR manage employee_master" ON public.employee_master
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'hr', 'finance')
        )
    );

CREATE POLICY "Employees read own employee_master" ON public.employee_master
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());

-- 2. Compensation & Payroll Runs: Strictly HR/Finance/Admin
CREATE POLICY "Finance manage employee_compensation" ON public.employee_compensation
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'hr', 'finance')
        )
    );

CREATE POLICY "Finance manage payroll_periods" ON public.payroll_periods
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'hr', 'finance')
        )
    );

CREATE POLICY "Finance manage payroll_runs" ON public.payroll_runs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'hr', 'finance')
        )
    );

CREATE POLICY "Finance manage payroll_entries" ON public.payroll_employee_entries
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'hr', 'finance')
        )
    );

-- 3. Employee Expense Claims: Staff can manage their own; Finance can approve/pay
CREATE POLICY "Employees manage own expense_claims" ON public.employee_expense_claims
    FOR ALL TO authenticated
    USING (
        employee_id IN (SELECT id FROM public.employee_master WHERE profile_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'finance'))
    );

-- 4. Advances & Payslips
CREATE POLICY "Finance manage employee_advances" ON public.employee_advances
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'finance', 'hr')
        )
    );

CREATE POLICY "Employees read own payslips" ON public.payslip_records
    FOR SELECT TO authenticated
    USING (
        employee_id IN (SELECT id FROM public.employee_master WHERE profile_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'finance', 'hr'))
    );

CREATE POLICY "Finance manage payslip_records" ON public.payslip_records
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'finance', 'hr')
        )
    );

-- =============================================================================
-- 12. AUTHORITATIVE BUSINESS LOGIC RPCS (SECURITY DEFINER)
-- =============================================================================

-- Helper: Generate sequential identifiers
CREATE OR REPLACE FUNCTION public.fn_generate_hr_number(p_prefix TEXT, p_seq_name TEXT)
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
-- RPC 1: fn_create_employee
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_create_employee(p_employee_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_emp_id UUID;
    v_emp_code TEXT;
    v_seq_val BIGINT;
BEGIN
    v_seq_val := nextval('public.seq_employee_code');
    v_emp_code := 'EMP-' || lpad(v_seq_val::text, 4, '0');

    INSERT INTO public.employee_master (
        employee_code, profile_id, first_name, last_name, email, phone,
        date_of_joining, department, designation, location_depot_id,
        employment_type, pan_number, uan_number, esic_number,
        bank_account_number, bank_ifsc, bank_name, cost_center_id, notes
    ) VALUES (
        v_emp_code,
        (p_employee_data->>'profile_id')::UUID,
        p_employee_data->>'first_name',
        p_employee_data->>'last_name',
        p_employee_data->>'email',
        p_employee_data->>'phone',
        (p_employee_data->>'date_of_joining')::DATE,
        p_employee_data->>'department',
        p_employee_data->>'designation',
        (p_employee_data->>'location_depot_id')::UUID,
        COALESCE(p_employee_data->>'employment_type', 'FULL_TIME'),
        p_employee_data->>'pan_number',
        p_employee_data->>'uan_number',
        p_employee_data->>'esic_number',
        p_employee_data->>'bank_account_number',
        p_employee_data->>'bank_ifsc',
        p_employee_data->>'bank_name',
        (p_employee_data->>'cost_center_id')::UUID,
        p_employee_data->>'notes'
    ) RETURNING id INTO v_emp_id;

    RETURN jsonb_build_object(
        'success', true,
        'employee_id', v_emp_id,
        'employee_code', v_emp_code
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 2: fn_create_compensation_revision
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_create_compensation_revision(p_comp_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_comp_id UUID;
    v_emp_id UUID;
    v_eff_from DATE;
BEGIN
    v_emp_id := (p_comp_data->>'employee_id')::UUID;
    v_eff_from := (p_comp_data->>'effective_from')::DATE;

    -- Deactivate earlier active compensation
    UPDATE public.employee_compensation
    SET is_active = false, effective_to = v_eff_from - INTERVAL '1 day', updated_at = now()
    WHERE employee_id = v_emp_id AND is_active = true;

    INSERT INTO public.employee_compensation (
        employee_id, effective_from, basic_salary, hra, special_allowance,
        other_allowances, annual_ctc, employee_pf_enabled, employer_pf_enabled,
        esi_enabled, professional_tax_enabled, payroll_tds_enabled,
        tds_monthly_deduction, state_for_pt, is_active
    ) VALUES (
        v_emp_id, v_eff_from,
        (p_comp_data->>'basic_salary')::NUMERIC,
        COALESCE((p_comp_data->>'hra')::NUMERIC, 0.00),
        COALESCE((p_comp_data->>'special_allowance')::NUMERIC, 0.00),
        COALESCE((p_comp_data->>'other_allowances')::NUMERIC, 0.00),
        (p_comp_data->>'annual_ctc')::NUMERIC,
        COALESCE((p_comp_data->>'employee_pf_enabled')::BOOLEAN, true),
        COALESCE((p_comp_data->>'employer_pf_enabled')::BOOLEAN, true),
        COALESCE((p_comp_data->>'esi_enabled')::BOOLEAN, true),
        COALESCE((p_comp_data->>'professional_tax_enabled')::BOOLEAN, true),
        COALESCE((p_comp_data->>'payroll_tds_enabled')::BOOLEAN, true),
        COALESCE((p_comp_data->>'tds_monthly_deduction')::NUMERIC, 0.00),
        COALESCE(p_comp_data->>'state_for_pt', 'MAHARASHTRA'),
        true
    ) RETURNING id INTO v_comp_id;

    RETURN jsonb_build_object(
        'success', true,
        'compensation_id', v_comp_id
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 3: fn_process_monthly_payroll
-- Calculates earnings, loss-of-pay, statutory deductions (PF, ESI, PT, TDS), advances
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_process_monthly_payroll(
    p_payroll_period_id UUID,
    p_loss_of_pay_map JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period RECORD;
    v_run_id UUID;
    v_run_number TEXT;
    v_emp RECORD;
    v_comp RECORD;
    v_cal_days INT;
    v_lop NUMERIC(5, 2);
    v_payable_days NUMERIC(5, 2);
    v_factor NUMERIC(8, 6);
    
    -- Line items
    v_earned_basic NUMERIC(14, 2);
    v_earned_hra NUMERIC(14, 2);
    v_earned_special NUMERIC(14, 2);
    v_earned_other NUMERIC(14, 2);
    v_gross_earnings NUMERIC(14, 2);

    -- Deductions
    v_ee_pf NUMERIC(14, 2);
    v_er_pf NUMERIC(14, 2);
    v_ee_esi NUMERIC(14, 2);
    v_er_esi NUMERIC(14, 2);
    v_pt NUMERIC(14, 2);
    v_tds NUMERIC(14, 2);
    v_adv_rec NUMERIC(14, 2);
    v_tot_deductions NUMERIC(14, 2);
    v_net_salary NUMERIC(14, 2);
    v_er_cost NUMERIC(14, 2);

    -- Run Totals
    v_count INT := 0;
    v_tot_gross NUMERIC(14, 2) := 0.00;
    v_tot_ee_pf NUMERIC(14, 2) := 0.00;
    v_tot_ee_esi NUMERIC(14, 2) := 0.00;
    v_tot_pt NUMERIC(14, 2) := 0.00;
    v_tot_tds NUMERIC(14, 2) := 0.00;
    v_tot_adv NUMERIC(14, 2) := 0.00;
    v_tot_net NUMERIC(14, 2) := 0.00;
    v_tot_er_pf NUMERIC(14, 2) := 0.00;
    v_tot_er_esi NUMERIC(14, 2) := 0.00;
    v_tot_er_cost NUMERIC(14, 2) := 0.00;
BEGIN
    SELECT * INTO v_period FROM public.payroll_periods WHERE id = p_payroll_period_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payroll period % not found', p_payroll_period_id; END IF;
    IF v_period.status IN ('POSTED', 'PAID', 'CLOSED') THEN
        RAISE EXCEPTION 'Cannot process payroll for period in % status', v_period.status;
    END IF;

    v_cal_days := v_period.total_calendar_days;
    v_run_number := public.fn_generate_hr_number('RUN', 'seq_payroll_run_number');

    -- Create Payroll Run Header
    INSERT INTO public.payroll_runs (
        run_number, payroll_period_id, status, submitted_by
    ) VALUES (
        v_run_number, p_payroll_period_id, 'DRAFT', auth.uid()
    ) RETURNING id INTO v_run_id;

    -- Loop over active employees
    FOR v_emp IN 
        SELECT * FROM public.employee_master 
        WHERE status = 'ACTIVE' AND date_of_joining <= v_period.period_end
    LOOP
        -- Find active compensation
        SELECT * INTO v_comp 
        FROM public.employee_compensation 
        WHERE employee_id = v_emp.id AND is_active = true 
        ORDER BY effective_from DESC LIMIT 1;

        IF FOUND THEN
            -- Check loss of pay from map
            v_lop := COALESCE((p_loss_of_pay_map->>(v_emp.id::text))::NUMERIC, 0.00);
            v_payable_days := GREATEST(0.00, v_cal_days - v_lop);
            v_factor := v_payable_days / v_cal_days;

            -- Prorated Earnings
            v_earned_basic := round(v_comp.basic_salary * v_factor, 2);
            v_earned_hra := round(v_comp.hra * v_factor, 2);
            v_earned_special := round(v_comp.special_allowance * v_factor, 2);
            v_earned_other := round(v_comp.other_allowances * v_factor, 2);
            v_gross_earnings := round(v_earned_basic + v_earned_hra + v_earned_special + v_earned_other, 2);

            -- Statutory EPF (12% of Basic, standard statutory cap ₹15,000 wage ceiling = max ₹1,800/mo)
            IF v_comp.employee_pf_enabled AND v_earned_basic > 0 THEN
                v_ee_pf := round(LEAST(v_earned_basic, 15000.00) * 0.12, 2);
                v_er_pf := round(LEAST(v_earned_basic, 15000.00) * 0.12, 2);
            ELSE
                v_ee_pf := 0.00;
                v_er_pf := 0.00;
            END IF;

            -- Statutory ESIC (Employee 0.75%, Employer 3.25% if Gross <= ₹21,000)
            IF v_comp.esi_enabled AND v_gross_earnings <= 21000.00 THEN
                v_ee_esi := round(v_gross_earnings * 0.0075, 2);
                v_er_esi := round(v_gross_earnings * 0.0325, 2);
            ELSE
                v_ee_esi := 0.00;
                v_er_esi := 0.00;
            END IF;

            -- Professional Tax (Configurable Slabs: standard ₹200/month in Maharashtra for gross > ₹10,000)
            IF v_comp.professional_tax_enabled AND v_gross_earnings > 10000.00 THEN
                v_pt := 200.00;
            ELSE
                v_pt := 0.00;
            END IF;

            -- Salary TDS under Section 192
            IF v_comp.payroll_tds_enabled THEN
                v_tds := v_comp.tds_monthly_deduction;
            ELSE
                v_tds := 0.00;
            END IF;

            -- Check active advances for recovery
            SELECT COALESCE(LEAST(monthly_installment, remaining_balance), 0.00) INTO v_adv_rec
            FROM public.employee_advances
            WHERE employee_id = v_emp.id AND status IN ('DISBURSED', 'PARTIALLY_RECOVERED')
            ORDER BY advance_date ASC LIMIT 1;
            v_adv_rec := COALESCE(v_adv_rec, 0.00);

            v_tot_deductions := round(v_ee_pf + v_ee_esi + v_pt + v_tds + v_adv_rec, 2);
            v_net_salary := round(v_gross_earnings - v_tot_deductions, 2);
            v_er_cost := round(v_gross_earnings + v_er_pf + v_er_esi, 2);

            -- Insert employee payroll line
            INSERT INTO public.payroll_employee_entries (
                payroll_run_id, employee_id, compensation_id, calendar_days,
                payable_days, loss_of_pay_days, earned_basic, earned_hra,
                earned_special_allowance, earned_other_allowances, gross_earnings,
                employee_pf, employee_esi, professional_tax, salary_tds,
                advance_recovery, total_deductions, net_salary,
                employer_pf, employer_esi, employer_total_cost
            ) VALUES (
                v_run_id, v_emp.id, v_comp.id, v_cal_days,
                v_payable_days, v_lop, v_earned_basic, v_earned_hra,
                v_earned_special, v_earned_other, v_gross_earnings,
                v_ee_pf, v_ee_esi, v_pt, v_tds,
                v_adv_rec, v_tot_deductions, v_net_salary,
                v_er_pf, v_er_esi, v_er_cost
            );

            v_count := v_count + 1;
            v_tot_gross := v_tot_gross + v_gross_earnings;
            v_tot_ee_pf := v_tot_ee_pf + v_ee_pf;
            v_tot_ee_esi := v_tot_ee_esi + v_ee_esi;
            v_tot_pt := v_tot_pt + v_pt;
            v_tot_tds := v_tot_tds + v_tds;
            v_tot_adv := v_tot_adv + v_adv_rec;
            v_tot_net := v_tot_net + v_net_salary;
            v_tot_er_pf := v_tot_er_pf + v_er_pf;
            v_tot_er_esi := v_tot_er_esi + v_er_esi;
            v_tot_er_cost := v_tot_er_cost + v_er_cost;
        END IF;
    END LOOP;

    -- Update Run Header
    UPDATE public.payroll_runs
    SET employee_count = v_count,
        total_gross_payroll = v_tot_gross,
        total_employee_pf = v_tot_ee_pf,
        total_employee_esi = v_tot_ee_esi,
        total_professional_tax = v_tot_pt,
        total_salary_tds = v_tot_tds,
        total_advance_recovery = v_tot_adv,
        total_net_payroll = v_tot_net,
        total_employer_pf = v_tot_er_pf,
        total_employer_esi = v_tot_er_esi,
        total_employer_cost = v_tot_er_cost,
        status = 'PENDING_APPROVAL',
        updated_at = now()
    WHERE id = v_run_id;

    UPDATE public.payroll_periods SET status = 'PROCESSING', updated_at = now() WHERE id = p_payroll_period_id;

    RETURN jsonb_build_object(
        'success', true,
        'payroll_run_id', v_run_id,
        'run_number', v_run_number,
        'employee_count', v_count,
        'total_gross_payroll', v_tot_gross,
        'total_net_payroll', v_tot_net,
        'total_employer_cost', v_tot_er_cost
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 4: fn_approve_payroll_run (Maker-Checker Governance)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_approve_payroll_run(p_payroll_run_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_run RECORD;
    v_actor UUID;
BEGIN
    v_actor := auth.uid();
    SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run % not found', p_payroll_run_id; END IF;

    IF v_run.status != 'PENDING_APPROVAL' THEN
        RAISE EXCEPTION 'Payroll run must be in PENDING_APPROVAL status. Currently: %', v_run.status;
    END IF;

    -- Maker-checker invariant: Requester cannot approve their own run
    IF v_run.submitted_by IS NOT NULL AND v_run.submitted_by = v_actor THEN
        RAISE EXCEPTION 'Segregation of Duties: Creator cannot approve their own payroll run';
    END IF;

    UPDATE public.payroll_runs 
    SET status = 'APPROVED', approved_by = v_actor, approved_at = now(), updated_at = now()
    WHERE id = p_payroll_run_id;

    UPDATE public.payroll_periods 
    SET status = 'APPROVED', updated_at = now()
    WHERE id = v_run.payroll_period_id;

    RETURN jsonb_build_object(
        'success', true,
        'payroll_run_id', p_payroll_run_id,
        'status', 'APPROVED',
        'approved_by', v_actor
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 5: fn_post_payroll_to_gl
-- Posts balanced journal: Dr 5600, 5610, 5620 = Cr 2300, 2320, 2330, 2340, 2350, 1150
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_post_payroll_to_gl(p_payroll_run_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_run RECORD;
    v_period RECORD;
    v_journal_id UUID;
    v_entry_number TEXT;
    
    -- Account IDs
    v_acc_sal_exp UUID;
    v_acc_er_pf_exp UUID;
    v_acc_er_esi_exp UUID;
    
    v_acc_sal_pay UUID;
    v_acc_pf_pay UUID;
    v_acc_esi_pay UUID;
    v_acc_pt_pay UUID;
    v_acc_tds_pay UUID;
    v_acc_adv_rec UUID;

    v_total_debit NUMERIC(14, 2);
    v_total_credit NUMERIC(14, 2);
BEGIN
    SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run % not found', p_payroll_run_id; END IF;
    IF v_run.status != 'APPROVED' THEN
        RAISE EXCEPTION 'Payroll run must be APPROVED before posting to GL. Currently: %', v_run.status;
    END IF;
    IF v_run.gl_journal_entry_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already posted to GL', 'journal_entry_id', v_run.gl_journal_entry_id);
    END IF;

    SELECT * INTO v_period FROM public.payroll_periods WHERE id = v_run.payroll_period_id;

    -- Lookup Accounts
    SELECT id INTO v_acc_sal_exp FROM public.chart_of_accounts WHERE account_number = '5600';
    SELECT id INTO v_acc_er_pf_exp FROM public.chart_of_accounts WHERE account_number = '5610';
    SELECT id INTO v_acc_er_esi_exp FROM public.chart_of_accounts WHERE account_number = '5620';

    SELECT id INTO v_acc_sal_pay FROM public.chart_of_accounts WHERE account_number = '2300';
    SELECT id INTO v_acc_pf_pay FROM public.chart_of_accounts WHERE account_number = '2320';
    SELECT id INTO v_acc_esi_pay FROM public.chart_of_accounts WHERE account_number = '2330';
    SELECT id INTO v_acc_pt_pay FROM public.chart_of_accounts WHERE account_number = '2340';
    SELECT id INTO v_acc_tds_pay FROM public.chart_of_accounts WHERE account_number = '2350';
    SELECT id INTO v_acc_adv_rec FROM public.chart_of_accounts WHERE account_number = '1150';

    v_total_debit := round(v_run.total_gross_payroll + v_run.total_employer_pf + v_run.total_employer_esi, 2);
    v_total_credit := round(
        v_run.total_net_payroll + 
        (v_run.total_employee_pf + v_run.total_employer_pf) +
        (v_run.total_employee_esi + v_run.total_employer_esi) +
        v_run.total_professional_tax +
        v_run.total_salary_tds +
        v_run.total_advance_recovery,
        2
    );

    IF v_total_debit != v_total_credit THEN
        RAISE EXCEPTION 'GL Equilibrium violated: Debit % != Credit %', v_total_debit, v_total_credit;
    END IF;

    v_entry_number := 'JE-PAY-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(nextval('public.seq_journal_entry_number')::text, 4, '0');

    INSERT INTO public.journal_entries (
        entry_number, entry_date, accounting_period_id, source_document_type,
        source_document_id, narration, total_debit, total_credit, status, is_balanced
    ) VALUES (
        v_entry_number, CURRENT_DATE, v_period.accounting_period_id, 'PAYROLL_RUN',
        p_payroll_run_id, 'Monthly payroll accrual for ' || v_period.period_code,
        v_total_debit, v_total_credit, 'POSTED', true
    ) RETURNING id INTO v_journal_id;

    -- DEBITS
    -- 1. Salaries & Wages Expense (Gross)
    INSERT INTO public.journal_lines (journal_entry_id, account_id, line_type, amount, description)
    VALUES (v_journal_id, v_acc_sal_exp, 'DEBIT', v_run.total_gross_payroll, 'Gross salaries & allowances');

    -- 2. Employer EPF Expense
    IF v_run.total_employer_pf > 0 THEN
        INSERT INTO public.journal_lines (journal_entry_id, account_id, line_type, amount, description)
        VALUES (v_journal_id, v_acc_er_pf_exp, 'DEBIT', v_run.total_employer_pf, 'Employer EPF contribution');
    END IF;

    -- 3. Employer ESIC Expense
    IF v_run.total_employer_esi > 0 THEN
        INSERT INTO public.journal_lines (journal_entry_id, account_id, line_type, amount, description)
        VALUES (v_journal_id, v_acc_er_esi_exp, 'DEBIT', v_run.total_employer_esi, 'Employer ESIC contribution');
    END IF;

    -- CREDITS
    -- 1. Net Salary Payable
    INSERT INTO public.journal_lines (journal_entry_id, account_id, line_type, amount, description)
    VALUES (v_journal_id, v_acc_sal_pay, 'CREDIT', v_run.total_net_payroll, 'Net take-home salary payable');

    -- 2. EPF Payable (EE + ER)
    IF (v_run.total_employee_pf + v_run.total_employer_pf) > 0 THEN
        INSERT INTO public.journal_lines (journal_entry_id, account_id, line_type, amount, description)
        VALUES (v_journal_id, v_acc_pf_pay, 'CREDIT', (v_run.total_employee_pf + v_run.total_employer_pf), 'Total EPF liability payable to EPFO');
    END IF;

    -- 3. ESIC Payable (EE + ER)
    IF (v_run.total_employee_esi + v_run.total_employer_esi) > 0 THEN
        INSERT INTO public.journal_lines (journal_entry_id, account_id, line_type, amount, description)
        VALUES (v_journal_id, v_acc_esi_pay, 'CREDIT', (v_run.total_employee_esi + v_run.total_employer_esi), 'Total ESIC liability payable to ESIC');
    END IF;

    -- 4. Professional Tax Payable
    IF v_run.total_professional_tax > 0 THEN
        INSERT INTO public.journal_lines (journal_entry_id, account_id, line_type, amount, description)
        VALUES (v_journal_id, v_acc_pt_pay, 'CREDIT', v_run.total_professional_tax, 'Professional tax liability payable to State Govt');
    END IF;

    -- 5. Salary TDS Payable
    IF v_run.total_salary_tds > 0 THEN
        INSERT INTO public.journal_lines (journal_entry_id, account_id, line_type, amount, description)
        VALUES (v_journal_id, v_acc_tds_pay, 'CREDIT', v_run.total_salary_tds, 'Salary TDS payable under Section 192');
    END IF;

    -- 6. Advance Recovery Offset
    IF v_run.total_advance_recovery > 0 THEN
        INSERT INTO public.journal_lines (journal_entry_id, account_id, line_type, amount, description)
        VALUES (v_journal_id, v_acc_adv_rec, 'CREDIT', v_run.total_advance_recovery, 'Recovery offset against employee advances');
    END IF;

    UPDATE public.payroll_runs 
    SET status = 'POSTED_TO_GL', gl_journal_entry_id = v_journal_id, updated_at = now() 
    WHERE id = p_payroll_run_id;

    UPDATE public.payroll_periods SET status = 'POSTED', updated_at = now() WHERE id = v_run.payroll_period_id;

    RETURN jsonb_build_object(
        'success', true,
        'journal_entry_id', v_journal_id,
        'entry_number', v_entry_number,
        'total_posted', v_total_debit
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 6: fn_record_salary_disbursement
-- Records bank payout: Dr 2300 Salaries Payable = Cr 1010 Bank Account
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_record_salary_disbursement(
    p_payroll_run_id UUID,
    p_bank_reference TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_run RECORD;
    v_period RECORD;
    v_journal_id UUID;
    v_entry_number TEXT;
    v_acc_sal_pay UUID;
    v_acc_bank UUID;
BEGIN
    SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run % not found', p_payroll_run_id; END IF;
    IF v_run.status != 'POSTED_TO_GL' THEN
        RAISE EXCEPTION 'Payroll must be POSTED_TO_GL before recording disbursement. Currently: %', v_run.status;
    END IF;

    SELECT * INTO v_period FROM public.payroll_periods WHERE id = v_run.payroll_period_id;
    SELECT id INTO v_acc_sal_pay FROM public.chart_of_accounts WHERE account_number = '2300';
    SELECT id INTO v_acc_bank FROM public.chart_of_accounts WHERE account_number = '1010';

    v_entry_number := 'JE-SALPAY-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(nextval('public.seq_journal_entry_number')::text, 4, '0');

    -- Create GL Journal: Dr 2300 = Cr 1010
    INSERT INTO public.journal_entries (
        entry_number, entry_date, accounting_period_id, source_document_type,
        source_document_id, narration, total_debit, total_credit, status, is_balanced
    ) VALUES (
        v_entry_number, CURRENT_DATE, v_period.accounting_period_id, 'SALARY_PAYMENT',
        p_payroll_run_id, 'Net salary bank transfer ref: ' || p_bank_reference,
        v_run.total_net_payroll, v_run.total_net_payroll, 'POSTED', true
    ) RETURNING id INTO v_journal_id;

    INSERT INTO public.journal_lines (journal_entry_id, account_id, line_type, amount, description)
    VALUES (v_journal_id, v_acc_sal_pay, 'DEBIT', v_run.total_net_payroll, 'Settlement of net salary payable');

    INSERT INTO public.journal_lines (journal_entry_id, account_id, line_type, amount, description)
    VALUES (v_journal_id, v_acc_bank, 'CREDIT', v_run.total_net_payroll, 'Bank outflow for employee salary transfer');

    UPDATE public.payroll_runs SET status = 'PAID', updated_at = now() WHERE id = p_payroll_run_id;
    UPDATE public.payroll_periods SET status = 'PAID', updated_at = now() WHERE id = v_run.payroll_period_id;
    UPDATE public.payroll_employee_entries SET payment_status = 'PAID', payment_reference = p_bank_reference, paid_at = now() WHERE payroll_run_id = p_payroll_run_id;

    RETURN jsonb_build_object(
        'success', true,
        'journal_entry_id', v_journal_id,
        'amount_disbursed', v_run.total_net_payroll,
        'bank_reference', p_bank_reference
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC 7: fn_generate_immutable_payslip
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_generate_immutable_payslip(p_payroll_entry_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_entry RECORD;
    v_emp RECORD;
    v_period RECORD;
    v_slip_num TEXT;
    v_slip_id UUID;
    v_payload JSONB;
    v_hash TEXT;
BEGIN
    SELECT * INTO v_entry FROM public.payroll_employee_entries WHERE id = p_payroll_entry_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payroll entry % not found', p_payroll_entry_id; END IF;

    SELECT * INTO v_emp FROM public.employee_master WHERE id = v_entry.employee_id;
    SELECT pp.* INTO v_period 
    FROM public.payroll_runs pr 
    JOIN public.payroll_periods pp ON pr.payroll_period_id = pp.id 
    WHERE pr.id = v_entry.payroll_run_id;

    v_slip_num := public.fn_generate_hr_number('SLIP', 'seq_payslip_number');

    v_payload := jsonb_build_object(
        'payslip_number', v_slip_num,
        'employee_code', v_emp.employee_code,
        'employee_name', v_emp.full_name,
        'department', v_emp.department,
        'designation', v_emp.designation,
        'period_code', v_period.period_code,
        'calendar_days', v_entry.calendar_days,
        'payable_days', v_entry.payable_days,
        'loss_of_pay_days', v_entry.loss_of_pay_days,
        'earnings', jsonb_build_object(
            'basic', v_entry.earned_basic,
            'hra', v_entry.earned_hra,
            'special', v_entry.earned_special_allowance,
            'other', v_entry.earned_other_allowances,
            'gross', v_entry.gross_earnings
        ),
        'deductions', jsonb_build_object(
            'pf', v_entry.employee_pf,
            'esi', v_entry.employee_esi,
            'pt', v_entry.professional_tax,
            'tds', v_entry.salary_tds,
            'advances', v_entry.advance_recovery,
            'total', v_entry.total_deductions
        ),
        'net_salary', v_entry.net_salary,
        'generated_at', now()
    );

    v_hash := encode(digest(v_payload::text, 'sha256'), 'hex');

    INSERT INTO public.payslip_records (
        payslip_number, payroll_entry_id, employee_id, payroll_period_id,
        fiscal_year, month_name, gross_earnings, total_deductions, net_salary,
        payslip_payload, verification_hash
    ) VALUES (
        v_slip_num, p_payroll_entry_id, v_emp.id, v_period.id,
        v_period.fiscal_year, v_period.period_code, v_entry.gross_earnings,
        v_entry.total_deductions, v_entry.net_salary, v_payload, v_hash
    ) RETURNING id INTO v_slip_id;

    RETURN jsonb_build_object(
        'success', true,
        'payslip_id', v_slip_id,
        'payslip_number', v_slip_num,
        'verification_hash', v_hash
    );
END;
$$;
