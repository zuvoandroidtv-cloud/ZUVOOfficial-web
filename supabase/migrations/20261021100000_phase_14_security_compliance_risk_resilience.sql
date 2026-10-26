-- =============================================================================
-- ZUVO TV CRM — PHASE 14 MASTER DATABASE MIGRATION
-- Enterprise Security, Compliance, Risk & Resilience Engine
-- Filename: 20261021100000_phase_14_security_compliance_risk_resilience.sql
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. CENTRALIZED ENTERPRISE SECURITY & AUDIT EVENT ARCHITECTURE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sec_enterprise_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    event_category TEXT NOT NULL CHECK (event_category IN (
        'AUTH_SECURITY',
        'PRIVILEGE_CHANGE',
        'SENSITIVE_DATA_ACCESS',
        'FINANCIAL_APPROVAL',
        'PAYROLL_DISBURSEMENT',
        'TREASURY_TRANSFER',
        'MANUFACTURING_ECO',
        'WARRANTY_SETTLEMENT',
        'DEALER_CREDIT_MUTATION',
        'ADMIN_CONFIG_CHANGE',
        'SECURITY_INCIDENT',
        'DR_RESILIENCE_EVENT'
    )),
    event_type TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role TEXT NOT NULL DEFAULT 'SYSTEM',
    actor_ip_address TEXT,
    entity_name TEXT NOT NULL,
    entity_id TEXT,
    action_performed TEXT NOT NULL,
    old_state JSONB,
    new_state JSONB,
    is_sensitive BOOLEAN NOT NULL DEFAULT false,
    severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sec_audit_tenant ON public.sec_enterprise_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sec_audit_category ON public.sec_enterprise_audit_log(event_category);
CREATE INDEX IF NOT EXISTS idx_sec_audit_severity ON public.sec_enterprise_audit_log(severity);
CREATE INDEX IF NOT EXISTS idx_sec_audit_actor ON public.sec_enterprise_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_sec_audit_entity ON public.sec_enterprise_audit_log(entity_name, entity_id);

-- Enforce append-only immutability
CREATE OR REPLACE FUNCTION public.fn_prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries are strictly append-only and immutable. UPDATE/DELETE prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_sec_audit_immutable ON public.sec_enterprise_audit_log;
CREATE TRIGGER trg_sec_audit_immutable
BEFORE UPDATE OR DELETE ON public.sec_enterprise_audit_log
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_audit_log_mutation();

-- =============================================================================
-- 2. ENTERPRISE DATA GOVERNANCE & PRIVACY COMPLIANCE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sec_data_governance_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    dataset_name TEXT NOT NULL UNIQUE,
    data_classification TEXT NOT NULL CHECK (data_classification IN (
        'PUBLIC',
        'INTERNAL',
        'CONFIDENTIAL',
        'RESTRICTED_PII',
        'FINANCIAL_CRITICAL'
    )),
    table_name TEXT NOT NULL,
    sensitive_columns TEXT[] NOT NULL DEFAULT '{}',
    legal_basis TEXT NOT NULL DEFAULT 'CONTRACTUAL_NECESSITY',
    retention_period_days INTEGER NOT NULL DEFAULT 2555 CHECK (retention_period_days > 0), -- Default 7 years statutory
    encryption_enforced BOOLEAN NOT NULL DEFAULT true,
    masking_rule TEXT NOT NULL DEFAULT 'FULL_REDACTION',
    owner_role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sec_data_access_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    dataset_id UUID REFERENCES public.sec_data_governance_registry(id) ON DELETE CASCADE,
    accessor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    accessor_role TEXT NOT NULL,
    purpose TEXT NOT NULL,
    record_count_accessed INTEGER NOT NULL DEFAULT 1 CHECK (record_count_accessed >= 0),
    sensitive_fields_revealed TEXT[] DEFAULT '{}',
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3. ENTERPRISE RISK MANAGEMENT (ERM)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sec_risk_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    risk_code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN (
        'OPERATIONAL',
        'FINANCIAL',
        'CYBERSECURITY',
        'COMPLIANCE_STATUTORY',
        'SUPPLY_CHAIN',
        'MANUFACTURING_QUALITY',
        'WARRANTY_EXPOSURE',
        'BUSINESS_CONTINUITY'
    )),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    likelihood_score INTEGER NOT NULL CHECK (likelihood_score BETWEEN 1 AND 5),
    impact_score INTEGER NOT NULL CHECK (impact_score BETWEEN 1 AND 5),
    inherent_risk_score INTEGER GENERATED ALWAYS AS (likelihood_score * impact_score) STORED,
    risk_owner UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    mitigation_strategy TEXT NOT NULL,
    residual_likelihood INTEGER NOT NULL CHECK (residual_likelihood BETWEEN 1 AND 5),
    residual_impact INTEGER NOT NULL CHECK (residual_impact BETWEEN 1 AND 5),
    residual_risk_score INTEGER GENERATED ALWAYS AS (residual_likelihood * residual_impact) STORED,
    status TEXT NOT NULL DEFAULT 'IDENTIFIED' CHECK (status IN (
        'IDENTIFIED', 'EVALUATING', 'TREATMENT_IN_PROGRESS', 'MONITORING', 'CLOSED_RESOLVED', 'ACCEPTED'
    )),
    target_resolution_date DATE,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sec_risk_cat ON public.sec_risk_register(category);
CREATE INDEX IF NOT EXISTS idx_sec_risk_status ON public.sec_risk_register(status);

-- =============================================================================
-- 4. SECURITY INCIDENT MANAGEMENT
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS public.seq_sec_incident_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE IF NOT EXISTS public.sec_security_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    incident_number TEXT NOT NULL UNIQUE,
    severity TEXT NOT NULL CHECK (severity IN ('P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW')),
    detection_source TEXT NOT NULL CHECK (detection_source IN (
        'AUTOMATED_SYSTEM_GUARD',
        'INTERNAL_STAFF_REPORT',
        'DEALER_PORTAL_TRIGGER',
        'FAILED_LOGIN_ANOMALY',
        'CROSS_TENANT_BLOCK_AUDIT',
        'FINANCIAL_RECONCILIATION_ALARM'
    )),
    affected_module TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    containment_action TEXT,
    investigation_findings TEXT,
    root_cause TEXT,
    corrective_action TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN (
        'OPEN', 'CONTAINED', 'INVESTIGATING', 'REMEDIATED', 'CLOSED', 'FALSE_POSITIVE'
    )),
    incident_commander UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    contained_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sec_incidents_sev ON public.sec_security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_sec_incidents_status ON public.sec_security_incidents(status);

-- =============================================================================
-- 5. BUSINESS CONTINUITY & DISASTER RECOVERY (BCM / DR)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sec_bcm_critical_processes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    process_name TEXT NOT NULL UNIQUE,
    module_code TEXT NOT NULL,
    rpo_hours NUMERIC(5, 2) NOT NULL DEFAULT 1.00 CHECK (rpo_hours >= 0),
    rto_hours NUMERIC(5, 2) NOT NULL DEFAULT 4.00 CHECK (rto_hours >= 0),
    recovery_priority TEXT NOT NULL CHECK (recovery_priority IN ('TIER_1_MISSION_CRITICAL', 'TIER_2_BUSINESS_VITAL', 'TIER_3_OPERATIONAL')),
    recovery_procedure_doc TEXT NOT NULL,
    owner_role TEXT NOT NULL DEFAULT 'admin',
    last_dr_test_date DATE,
    dr_test_result TEXT CHECK (dr_test_result IN ('PASS', 'CONDITIONAL_PASS', 'FAIL')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sec_bcm_backup_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    backup_type TEXT NOT NULL CHECK (backup_type IN ('FULL_DATABASE', 'WAL_STREAMING', 'CONFIGURATION_EXPORT', 'POINT_IN_TIME_SNAPSHOT')),
    backup_scope TEXT NOT NULL,
    backup_size_bytes BIGINT NOT NULL CHECK (backup_size_bytes > 0),
    checksum_sha256 TEXT NOT NULL,
    storage_destination TEXT NOT NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN ('VERIFIED_READABLE', 'RESTORE_TESTED', 'CORRUPT_FLAGGED')),
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 6. AUTOMATION RESILIENCE & DEAD-LETTER QUEUE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sec_automation_execution_journal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    idempotency_key TEXT NOT NULL UNIQUE,
    job_name TEXT NOT NULL,
    execution_scope TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
    max_retries INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'STARTED' CHECK (status IN ('STARTED', 'SUCCESS', 'RETRY_SCHEDULED', 'DEAD_LETTER', 'RECOVERED')),
    payload JSONB NOT NULL DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    dead_letter_logged BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_sec_automation_key ON public.sec_automation_execution_journal(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_sec_automation_status ON public.sec_automation_execution_journal(status);

-- =============================================================================
-- 7. RPC 1: fn_log_security_audit_event (Strict, append-only, tenant-scoped)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_log_security_audit_event(
    p_category TEXT,
    p_event_type TEXT,
    p_entity_name TEXT,
    p_entity_id TEXT,
    p_action TEXT,
    p_old_state JSONB DEFAULT NULL,
    p_new_state JSONB DEFAULT NULL,
    p_severity TEXT DEFAULT 'INFO'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT := 'SYSTEM';
    v_log_id UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        SELECT role_name INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;
        IF v_actor_role IS NULL THEN
            v_actor_role := 'authenticated';
        END IF;
    END IF;

    INSERT INTO public.sec_enterprise_audit_log (
        tenant_id,
        event_category,
        event_type,
        actor_id,
        actor_role,
        entity_name,
        entity_id,
        action_performed,
        old_state,
        new_state,
        severity
    ) VALUES (
        'ZUVO_MAIN',
        p_category,
        p_event_type,
        v_actor_id,
        v_actor_role,
        p_entity_name,
        p_entity_id,
        p_action,
        p_old_state,
        p_new_state,
        p_severity
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- =============================================================================
-- 8. RPC 2: fn_execute_idempotent_job (Prevents double transactions)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_execute_idempotent_job(
    p_idempotency_key TEXT,
    p_job_name TEXT,
    p_scope TEXT,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record RECORD;
BEGIN
    SELECT * INTO v_record FROM public.sec_automation_execution_journal
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        IF v_record.status = 'SUCCESS' THEN
            RETURN jsonb_build_object(
                'status', 'ALREADY_COMPLETED',
                'idempotency_key', p_idempotency_key,
                'completed_at', v_record.completed_at,
                'message', 'Job already executed idempotently. Duplicate execution skipped.'
            );
        ELSE
            -- Increment attempt
            UPDATE public.sec_automation_execution_journal
            SET attempt_count = attempt_count + 1,
                error_message = NULL,
                started_at = now()
            WHERE idempotency_key = p_idempotency_key;
        END IF;
    ELSE
        INSERT INTO public.sec_automation_execution_journal (
            idempotency_key, job_name, execution_scope, payload, status
        ) VALUES (
            p_idempotency_key, p_job_name, p_scope, p_payload, 'STARTED'
        );
    END IF;

    -- Return approval to proceed with task
    RETURN jsonb_build_object(
        'status', 'PROCEED',
        'idempotency_key', p_idempotency_key
    );
END;
$$;

-- =============================================================================
-- 9. RPC 3: fn_complete_idempotent_job
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_complete_idempotent_job(
    p_idempotency_key TEXT,
    p_success BOOLEAN,
    p_error TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_success THEN
        UPDATE public.sec_automation_execution_journal
        SET status = 'SUCCESS',
            completed_at = now(),
            error_message = NULL
        WHERE idempotency_key = p_idempotency_key;
    ELSE
        UPDATE public.sec_automation_execution_journal
        SET status = CASE WHEN attempt_count >= max_retries THEN 'DEAD_LETTER' ELSE 'RETRY_SCHEDULED' END,
            dead_letter_logged = (attempt_count >= max_retries),
            error_message = p_error
        WHERE idempotency_key = p_idempotency_key;
    END IF;

    RETURN jsonb_build_object('success', true, 'idempotency_key', p_idempotency_key);
END;
$$;

-- =============================================================================
-- 10. SECURITY & COMPLIANCE REPORTING VIEWS (security_invoker = true)
-- =============================================================================

-- View 1: Master Security Command Cockpit
CREATE OR REPLACE VIEW public.vw_sec_compliance_cockpit
WITH (security_invoker = true) AS
SELECT 
    (SELECT COUNT(*) FROM public.sec_security_incidents WHERE status IN ('OPEN', 'INVESTIGATING')) AS open_security_incidents,
    (SELECT COUNT(*) FROM public.sec_security_incidents WHERE severity = 'P1_CRITICAL' AND status != 'CLOSED') AS critical_p1_incidents,
    (SELECT COUNT(*) FROM public.sec_risk_register WHERE status != 'CLOSED_RESOLVED') AS active_enterprise_risks,
    (SELECT COUNT(*) FROM public.sec_risk_register WHERE inherent_risk_score >= 15 AND status != 'CLOSED_RESOLVED') AS high_severity_risks,
    (SELECT COUNT(*) FROM public.sec_automation_execution_journal WHERE status = 'DEAD_LETTER') AS dead_letter_automation_failures,
    (SELECT COUNT(*) FROM public.sec_bcm_critical_processes WHERE is_active = true) AS protected_critical_processes,
    (SELECT COUNT(*) FROM public.sec_bcm_critical_processes WHERE dr_test_result = 'PASS') AS dr_verified_processes,
    (SELECT COUNT(*) FROM public.sec_enterprise_audit_log WHERE severity IN ('HIGH', 'CRITICAL') AND created_at >= (now() - interval '24 hours')) AS critical_audits_24h;

-- View 2: High Risk Items & Residual Treatment
CREATE OR REPLACE VIEW public.vw_sec_high_risk_register
WITH (security_invoker = true) AS
SELECT 
    id AS risk_id,
    risk_code,
    category,
    title,
    inherent_risk_score,
    residual_risk_score,
    status,
    mitigation_strategy,
    target_resolution_date
FROM public.sec_risk_register
WHERE inherent_risk_score >= 12
ORDER BY inherent_risk_score DESC;

-- View 3: Automation Dead-Letter Monitor
CREATE OR REPLACE VIEW public.vw_sec_automation_dead_letters
WITH (security_invoker = true) AS
SELECT 
    id AS journal_id,
    idempotency_key,
    job_name,
    execution_scope,
    attempt_count,
    error_message,
    started_at
FROM public.sec_automation_execution_journal
WHERE status = 'DEAD_LETTER'
ORDER BY started_at DESC;

-- =============================================================================
-- 11. ROW LEVEL SECURITY (RLS) & PRIVILEGES
-- =============================================================================

ALTER TABLE public.sec_enterprise_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sec_data_governance_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sec_data_access_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sec_risk_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sec_security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sec_bcm_critical_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sec_bcm_backup_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sec_automation_execution_journal ENABLE ROW LEVEL SECURITY;

-- Read policies for authenticated staff
DROP POLICY IF EXISTS p_sec_audit_read ON public.sec_enterprise_audit_log;
CREATE POLICY p_sec_audit_read ON public.sec_enterprise_audit_log
    FOR SELECT TO authenticated USING (
        public.get_current_user_role() IN ('super_admin', 'admin')
    );

DROP POLICY IF EXISTS p_sec_governance_read ON public.sec_data_governance_registry;
CREATE POLICY p_sec_governance_read ON public.sec_data_governance_registry
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS p_sec_risk_read ON public.sec_risk_register;
CREATE POLICY p_sec_risk_read ON public.sec_risk_register
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS p_sec_incidents_read ON public.sec_security_incidents;
CREATE POLICY p_sec_incidents_read ON public.sec_security_incidents
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS p_sec_bcm_read ON public.sec_bcm_critical_processes;
CREATE POLICY p_sec_bcm_read ON public.sec_bcm_critical_processes
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS p_sec_backup_read ON public.sec_bcm_backup_evidence;
CREATE POLICY p_sec_backup_read ON public.sec_bcm_backup_evidence
    FOR SELECT TO authenticated USING (
        public.get_current_user_role() IN ('super_admin', 'admin')
    );

DROP POLICY IF EXISTS p_sec_automation_read ON public.sec_automation_execution_journal;
CREATE POLICY p_sec_automation_read ON public.sec_automation_execution_journal
    FOR SELECT TO authenticated USING (
        public.get_current_user_role() IN ('super_admin', 'admin')
    );

-- Write policies strictly restricted to Super Admin & Admin
DROP POLICY IF EXISTS p_sec_risk_write ON public.sec_risk_register;
CREATE POLICY p_sec_risk_write ON public.sec_risk_register
    FOR ALL TO authenticated USING (
        public.get_current_user_role() IN ('super_admin', 'admin')
    );

DROP POLICY IF EXISTS p_sec_incidents_write ON public.sec_security_incidents;
CREATE POLICY p_sec_incidents_write ON public.sec_security_incidents
    FOR ALL TO authenticated USING (
        public.get_current_user_role() IN ('super_admin', 'admin')
    );

DROP POLICY IF EXISTS p_sec_bcm_write ON public.sec_bcm_critical_processes;
CREATE POLICY p_sec_bcm_write ON public.sec_bcm_critical_processes
    FOR ALL TO authenticated USING (
        public.get_current_user_role() IN ('super_admin', 'admin')
    );

-- Revoke all permissions from anonymous / public users
REVOKE ALL ON public.sec_enterprise_audit_log FROM anon, PUBLIC;
REVOKE ALL ON public.sec_data_governance_registry FROM anon, PUBLIC;
REVOKE ALL ON public.sec_data_access_audit FROM anon, PUBLIC;
REVOKE ALL ON public.sec_risk_register FROM anon, PUBLIC;
REVOKE ALL ON public.sec_security_incidents FROM anon, PUBLIC;
REVOKE ALL ON public.sec_bcm_critical_processes FROM anon, PUBLIC;
REVOKE ALL ON public.sec_bcm_backup_evidence FROM anon, PUBLIC;
REVOKE ALL ON public.sec_automation_execution_journal FROM anon, PUBLIC;

GRANT SELECT ON public.sec_enterprise_audit_log TO authenticated;
GRANT SELECT ON public.sec_data_governance_registry TO authenticated;
GRANT SELECT ON public.sec_data_access_audit TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sec_risk_register TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sec_security_incidents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sec_bcm_critical_processes TO authenticated;
GRANT SELECT ON public.sec_bcm_backup_evidence TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sec_automation_execution_journal TO authenticated;
