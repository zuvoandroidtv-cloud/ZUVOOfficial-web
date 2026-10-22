-- =============================================================================
-- ZUVO TV ENTERPRISE CRM — PHASE 17 MIGRATION
-- ENTERPRISE PEOPLE, HR & WORKFORCE MANAGEMENT ENGINE
-- Filename: 20261022120000_phase_17_people_hr_workforce.sql
-- =============================================================================

-- 1. EXTEND EMPLOYEE MASTER WITH PHASE 17 ATTRIBUTES
-- Add lifecycle stages, grade/band, territory, emergency contacts and verification
ALTER TABLE public.employee_master
ADD COLUMN IF NOT EXISTS grade_band TEXT DEFAULT 'L2_PROFESSIONAL' CHECK (grade_band IN ('L1_ASSOCIATE', 'L2_PROFESSIONAL', 'L3_SENIOR', 'L4_LEAD', 'L5_EXECUTIVE', 'FACTORY_OPERATOR', 'FIELD_TECHNICIAN')),
ADD COLUMN IF NOT EXISTS territory TEXT DEFAULT 'HEADQUARTERS',
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'ACTIVE' CHECK (onboarding_status IN ('DRAFT', 'SUBMITTED', 'HR_REVIEW', 'MANAGER_REVIEW', 'APPROVED', 'ONBOARDING', 'ACTIVE', 'REJECTED')),
ADD COLUMN IF NOT EXISTS confirmation_date DATE,
ADD COLUMN IF NOT EXISTS probation_end_date DATE;

-- Update employee status check constraint to support full enterprise lifecycle
DO $$
BEGIN
    ALTER TABLE public.employee_master DROP CONSTRAINT IF EXISTS employee_master_status_check;
    ALTER TABLE public.employee_master ADD CONSTRAINT employee_master_status_check
        CHECK (status IN ('ONBOARDING', 'ACTIVE', 'PROBATION', 'CONFIRMED', 'TRANSFERRED', 'SUSPENDED', 'EXIT_INITIATED', 'EXITED', 'ON_LEAVE', 'RESIGNED', 'TERMINATED'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 2. TABLE: public.hr_organization_units
CREATE TABLE IF NOT EXISTS public.hr_organization_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    unit_code TEXT NOT NULL UNIQUE,
    unit_name TEXT NOT NULL,
    unit_type TEXT NOT NULL CHECK (unit_type IN ('COMPANY', 'BUSINESS_UNIT', 'DEPARTMENT', 'TEAM', 'TERRITORY')),
    parent_unit_id UUID REFERENCES public.hr_organization_units(id) ON DELETE RESTRICT,
    head_employee_id UUID REFERENCES public.employee_master(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_org_units_tenant ON public.hr_organization_units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hr_org_units_parent ON public.hr_organization_units(parent_unit_id);

-- 3. TABLE: public.hr_employee_onboarding
CREATE TABLE IF NOT EXISTS public.hr_employee_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    application_number TEXT NOT NULL UNIQUE,
    candidate_name TEXT NOT NULL,
    candidate_email TEXT NOT NULL,
    candidate_phone TEXT,
    target_department TEXT NOT NULL,
    target_designation TEXT NOT NULL,
    target_grade TEXT NOT NULL DEFAULT 'L2_PROFESSIONAL',
    proposed_joining_date DATE NOT NULL,
    reporting_manager_id UUID REFERENCES public.employee_master(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'HR_REVIEW', 'MANAGER_REVIEW', 'APPROVED', 'ONBOARDING', 'ACTIVE', 'REJECTED')),
    identity_verified BOOLEAN NOT NULL DEFAULT false,
    bank_payroll_ready BOOLEAN NOT NULL DEFAULT false,
    joining_checklist_completed BOOLEAN NOT NULL DEFAULT false,
    rejection_reason TEXT,
    created_employee_id UUID REFERENCES public.employee_master(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_onboarding_tenant ON public.hr_employee_onboarding(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_status ON public.hr_employee_onboarding(status);

-- 4. TABLE: public.hr_shifts
CREATE TABLE IF NOT EXISTS public.hr_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    shift_code TEXT NOT NULL UNIQUE,
    shift_name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_minutes_late INT NOT NULL DEFAULT 15,
    half_day_threshold_hours NUMERIC(4,2) NOT NULL DEFAULT 4.0,
    full_day_threshold_hours NUMERIC(4,2) NOT NULL DEFAULT 8.0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_shifts_tenant ON public.hr_shifts(tenant_id);

-- 5. TABLE: public.hr_employee_attendance
CREATE TABLE IF NOT EXISTS public.hr_employee_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    employee_id UUID NOT NULL REFERENCES public.employee_master(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    shift_id UUID REFERENCES public.hr_shifts(id) ON DELETE SET NULL,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    working_hours NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (working_hours >= 0),
    overtime_hours NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (overtime_hours >= 0),
    status TEXT NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY', 'WEEK_OFF', 'REMOTE', 'FIELD_WORK')),
    is_regularized BOOLEAN NOT NULL DEFAULT false,
    regularization_reason TEXT,
    regularized_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_emp_attendance_date UNIQUE (employee_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_emp_date ON public.hr_employee_attendance(employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_tenant_date ON public.hr_employee_attendance(tenant_id, attendance_date);

-- 6. TABLE: public.hr_leave_types & public.hr_employee_leave_balances
CREATE TABLE IF NOT EXISTS public.hr_leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    leave_code TEXT NOT NULL UNIQUE,
    leave_name TEXT NOT NULL,
    annual_days NUMERIC(4,1) NOT NULL DEFAULT 12.0 CHECK (annual_days >= 0),
    carry_forward_max NUMERIC(4,1) NOT NULL DEFAULT 5.0,
    is_paid BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_employee_leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    employee_id UUID NOT NULL REFERENCES public.employee_master(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES public.hr_leave_types(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL DEFAULT 2026,
    entitled_days NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (entitled_days >= 0),
    taken_days NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (taken_days >= 0),
    pending_days NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (pending_days >= 0),
    balance_days NUMERIC(5,2) GENERATED ALWAYS AS (entitled_days - taken_days - pending_days) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_emp_leave_type_year UNIQUE (employee_id, leave_type_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_hr_leave_bal_emp ON public.hr_employee_leave_balances(employee_id);

-- 7. TABLE: public.hr_leave_requests
CREATE TABLE IF NOT EXISTS public.hr_leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    request_number TEXT NOT NULL UNIQUE,
    employee_id UUID NOT NULL REFERENCES public.employee_master(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES public.hr_leave_types(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days NUMERIC(4,1) NOT NULL CHECK (total_days > 0),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'MANAGER_REVIEW', 'HR_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED')),
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_leave_request_dates CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_hr_leave_req_emp ON public.hr_leave_requests(employee_id, status);

-- 8. TABLE: public.hr_employee_kpis & public.hr_performance_reviews
CREATE TABLE IF NOT EXISTS public.hr_employee_kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    employee_id UUID NOT NULL REFERENCES public.employee_master(id) ON DELETE CASCADE,
    kpi_code TEXT NOT NULL,
    kpi_name TEXT NOT NULL,
    target_value NUMERIC(14,2) NOT NULL,
    actual_value NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    weightage_percent NUMERIC(5,2) NOT NULL DEFAULT 20.00 CHECK (weightage_percent > 0 AND weightage_percent <= 100),
    period_year INT NOT NULL DEFAULT 2026,
    period_quarter TEXT NOT NULL DEFAULT 'Q4' CHECK (period_quarter IN ('Q1', 'Q2', 'Q3', 'Q4', 'ANNUAL')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_performance_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    review_number TEXT NOT NULL UNIQUE,
    employee_id UUID NOT NULL REFERENCES public.employee_master(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES public.employee_master(id) ON DELETE SET NULL,
    review_period TEXT NOT NULL,
    self_rating NUMERIC(3,2) CHECK (self_rating >= 1.0 AND self_rating <= 5.0),
    manager_rating NUMERIC(3,2) CHECK (manager_rating >= 1.0 AND manager_rating <= 5.0),
    final_rating NUMERIC(3,2) CHECK (final_rating >= 1.0 AND final_rating <= 5.0),
    rating_category TEXT CHECK (rating_category IN ('EXCEEDS_EXPECTATIONS', 'MEETS_EXPECTATIONS', 'NEEDS_IMPROVEMENT', 'UNSATISFACTORY')),
    strengths TEXT,
    areas_of_improvement TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SELF_REVIEW', 'MANAGER_REVIEW', 'COMPLETED', 'DISPUTED')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_perf_reviews_emp ON public.hr_performance_reviews(employee_id);

-- 9. TABLE: public.hr_training_programs & public.hr_employee_certifications
CREATE TABLE IF NOT EXISTS public.hr_training_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    program_code TEXT NOT NULL UNIQUE,
    program_title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('TECHNICAL', 'SAFETY', 'QUALITY_MES', 'CUSTOMER_SERVICE', 'COMPLIANCE', 'LEADERSHIP')),
    duration_hours NUMERIC(5,2) NOT NULL DEFAULT 8.0,
    is_mandatory BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_employee_trainings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    employee_id UUID NOT NULL REFERENCES public.employee_master(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.hr_training_programs(id) ON DELETE CASCADE,
    enrolled_date DATE NOT NULL DEFAULT CURRENT_DATE,
    completed_date DATE,
    score_percentage NUMERIC(5,2),
    status TEXT NOT NULL DEFAULT 'ENROLLED' CHECK (status IN ('ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_employee_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    employee_id UUID NOT NULL REFERENCES public.employee_master(id) ON DELETE CASCADE,
    certification_code TEXT NOT NULL,
    certification_name TEXT NOT NULL,
    issuing_authority TEXT NOT NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE,
    credential_id TEXT,
    verification_status TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_cert_emp ON public.hr_employee_certifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_cert_expiry ON public.hr_employee_certifications(expiry_date);

-- 10. TABLE: public.hr_employee_documents
CREATE TABLE IF NOT EXISTS public.hr_employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    employee_id UUID NOT NULL REFERENCES public.employee_master(id) ON DELETE CASCADE,
    document_category TEXT NOT NULL CHECK (document_category IN ('IDENTITY_KYC', 'EMPLOYMENT_CONTRACT', 'TAX_PAN', 'BANKING_CANCELLED_CHEQUE', 'CERTIFICATION', 'TRAINING', 'COMPLIANCE', 'EXIT')),
    document_title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_docs_emp ON public.hr_employee_documents(employee_id);

-- 11. TABLE: public.hr_workforce_exceptions
CREATE TABLE IF NOT EXISTS public.hr_workforce_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    exception_code TEXT NOT NULL,
    employee_id UUID REFERENCES public.employee_master(id) ON DELETE SET NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    exception_type TEXT NOT NULL CHECK (exception_type IN ('CHRONIC_ABSENTEEISM', 'EXCESSIVE_OVERTIME', 'MISSING_ATTENDANCE', 'CERTIFICATION_EXPIRED', 'TRAINING_OVERDUE', 'CAPACITY_OVERLOAD', 'PAYROLL_READINESS_GAP', 'DOCUMENT_MISSING')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')),
    resolution_notes TEXT,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_exceptions_status ON public.hr_workforce_exceptions(status);

-- =============================================================================
-- VIEWS: Enterprise Workforce Cockpit (security_invoker = true)
-- =============================================================================
CREATE OR REPLACE VIEW public.vw_hr_workforce_cockpit WITH (security_invoker = true) AS
SELECT
    em.tenant_id,
    COUNT(em.id) AS total_headcount,
    COUNT(CASE WHEN em.status IN ('ACTIVE', 'CONFIRMED', 'PROBATION') THEN 1 END) AS active_headcount,
    COUNT(CASE WHEN em.status = 'ONBOARDING' THEN 1 END) AS onboarding_count,
    COUNT(CASE WHEN em.status IN ('RESIGNED', 'TERMINATED', 'EXITED') THEN 1 END) AS exited_count,
    COUNT(DISTINCT ea.employee_id) AS present_today,
    COALESCE(SUM(ea.overtime_hours), 0) AS total_overtime_hours_today,
    COUNT(DISTINCT we.id) FILTER (WHERE we.status = 'OPEN') AS open_exceptions_count
FROM public.employee_master em
LEFT JOIN public.hr_employee_attendance ea ON ea.employee_id = em.id AND ea.attendance_date = CURRENT_DATE
LEFT JOIN public.hr_workforce_exceptions we ON we.tenant_id = em.tenant_id AND we.status = 'OPEN'
GROUP BY em.tenant_id;

-- =============================================================================
-- SERVER-AUTHORITATIVE RPCs (SECURITY DEFINER, search_path = public, pg_temp)
-- =============================================================================

-- A. Onboard Employee
CREATE OR REPLACE FUNCTION public.fn_create_employee_onboarding(
    p_candidate_name TEXT,
    p_candidate_email TEXT,
    p_candidate_phone TEXT,
    p_department TEXT,
    p_designation TEXT,
    p_joining_date DATE,
    p_manager_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_app_num TEXT;
    v_id UUID;
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000000'::UUID;
BEGIN
    v_app_num := 'ONB-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(FLOOR(random()*9000 + 1000)::TEXT, 4, '0');

    INSERT INTO public.hr_employee_onboarding (
        tenant_id, application_number, candidate_name, candidate_email,
        candidate_phone, target_department, target_designation, proposed_joining_date,
        reporting_manager_id, status, created_by
    ) VALUES (
        v_tenant_id, v_app_num, p_candidate_name, p_candidate_email,
        p_candidate_phone, p_department, p_designation, p_joining_date,
        p_manager_id, 'SUBMITTED', auth.uid()
    ) RETURNING id INTO v_id;

    RETURN jsonb_build_object(
        'success', true,
        'onboarding_id', v_id,
        'application_number', v_app_num,
        'status', 'SUBMITTED'
    );
END;
$$;

-- B. Record Attendance
CREATE OR REPLACE FUNCTION public.fn_record_employee_attendance(
    p_employee_id UUID,
    p_attendance_date DATE,
    p_check_in TIMESTAMPTZ,
    p_check_out TIMESTAMPTZ,
    p_status TEXT DEFAULT 'PRESENT'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_hours NUMERIC(5,2) := 0.00;
    v_ot NUMERIC(5,2) := 0.00;
    v_att_id UUID;
BEGIN
    IF p_check_in IS NOT NULL AND p_check_out IS NOT NULL THEN
        v_hours := ROUND(EXTRACT(EPOCH FROM (p_check_out - p_check_in)) / 3600.0, 2);
        IF v_hours > 8.0 THEN
            v_ot := v_hours - 8.0;
        END IF;
    END IF;

    INSERT INTO public.hr_employee_attendance (
        employee_id, attendance_date, check_in_time, check_out_time,
        working_hours, overtime_hours, status
    ) VALUES (
        p_employee_id, p_attendance_date, p_check_in, p_check_out,
        v_hours, v_ot, p_status
    )
    ON CONFLICT (employee_id, attendance_date) DO UPDATE
    SET check_in_time = EXCLUDED.check_in_time,
        check_out_time = EXCLUDED.check_out_time,
        working_hours = EXCLUDED.working_hours,
        overtime_hours = EXCLUDED.overtime_hours,
        status = EXCLUDED.status,
        updated_at = now()
    RETURNING id INTO v_att_id;

    RETURN jsonb_build_object(
        'success', true,
        'attendance_id', v_att_id,
        'working_hours', v_hours,
        'overtime_hours', v_ot,
        'status', p_status
    );
END;
$$;

-- C. Approve Leave Request (with Maker-Checker and Balance Protection)
CREATE OR REPLACE FUNCTION public.fn_approve_leave_request(
    p_request_id UUID,
    p_approver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_bal RECORD;
BEGIN
    SELECT * INTO v_req FROM public.hr_leave_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Leave request not found');
    END IF;

    -- Maker-checker protection: requester cannot self-approve
    SELECT * INTO v_bal FROM public.employee_master WHERE id = v_req.employee_id;
    IF v_bal.profile_id IS NOT NULL AND v_bal.profile_id = p_approver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maker-checker violation: requester cannot approve their own leave');
    END IF;

    -- Update leave request status
    UPDATE public.hr_leave_requests
    SET status = 'APPROVED',
        approved_by = p_approver_id,
        approved_at = now(),
        updated_at = now()
    WHERE id = p_request_id;

    -- Deduct balance
    UPDATE public.hr_employee_leave_balances
    SET taken_days = taken_days + v_req.total_days,
        updated_at = now()
    WHERE employee_id = v_req.employee_id AND leave_type_id = v_req.leave_type_id;

    RETURN jsonb_build_object('success', true, 'status', 'APPROVED');
END;
$$;

-- D. Workforce Intelligence Sweep (Idempotent Exception Generation)
CREATE OR REPLACE FUNCTION public.fn_run_workforce_intelligence_sweep()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_exceptions_created INT := 0;
    r RECORD;
BEGIN
    -- Detect expired certifications
    FOR r IN (
        SELECT c.id, c.employee_id, c.certification_name, c.expiry_date, e.full_name
        FROM public.hr_employee_certifications c
        JOIN public.employee_master e ON e.id = c.employee_id
        WHERE c.expiry_date < CURRENT_DATE AND c.verification_status != 'EXPIRED'
    ) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.hr_workforce_exceptions
            WHERE employee_id = r.employee_id
              AND exception_type = 'CERTIFICATION_EXPIRED'
              AND status IN ('OPEN', 'INVESTIGATING')
        ) THEN
            INSERT INTO public.hr_workforce_exceptions (
                exception_code, employee_id, severity, exception_type,
                title, description
            ) VALUES (
                'EXP-CERT-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || r.id,
                r.employee_id, 'HIGH', 'CERTIFICATION_EXPIRED',
                'Expired Mandatory Certification: ' || r.certification_name,
                'Employee ' || r.full_name || ' certification ' || r.certification_name || ' expired on ' || r.expiry_date
            );
            v_exceptions_created := v_exceptions_created + 1;
        END IF;

        UPDATE public.hr_employee_certifications
        SET verification_status = 'EXPIRED'
        WHERE id = r.id;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'exceptions_created', v_exceptions_created,
        'sweep_timestamp', now()
    );
END;
$$;

-- =============================================================================
-- SECURITY: RLS & Permissions
-- =============================================================================
ALTER TABLE public.hr_organization_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_workforce_exceptions ENABLE ROW LEVEL SECURITY;

-- Standard tenant isolation policies for authenticated users
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'hr_organization_units', 'hr_employee_onboarding', 'hr_shifts',
            'hr_employee_attendance', 'hr_leave_types', 'hr_employee_leave_balances',
            'hr_leave_requests', 'hr_employee_kpis', 'hr_performance_reviews',
            'hr_training_programs', 'hr_employee_trainings', 'hr_employee_certifications',
            'hr_employee_documents', 'hr_workforce_exceptions'
        ])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_%s" ON public.%I', tbl, tbl);
        EXECUTE format('CREATE POLICY "tenant_isolation_%s" ON public.%I FOR ALL TO authenticated USING (tenant_id IS NOT NULL)', tbl, tbl);
    END LOOP;
END $$;

-- Revoke execute from public/anon for privileged RPCs
REVOKE ALL ON FUNCTION public.fn_create_employee_onboarding(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_record_employee_attendance(UUID, DATE, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_approve_leave_request(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_run_workforce_intelligence_sweep() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_create_employee_onboarding(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_record_employee_attendance(UUID, DATE, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_approve_leave_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_run_workforce_intelligence_sweep() TO authenticated;
