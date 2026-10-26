-- =============================================================================
-- ZUVO TV ENTERPRISE CRM — PHASE 20 MASTER DATABASE MIGRATION
-- Enterprise Governance, Workflow Engine, Notifications & Observability Architecture
-- Filename: 20261025181000_phase_20_enterprise_governance_workflow_notifications_observability.sql
-- Baseline: Phase 17 Integration (0639837) / Phase 19 (a052043) — FORWARD-ONLY, NON-DESTRUCTIVE
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. ENTERPRISE GOVERNANCE: POLICY REGISTRY & VERSIONING
-- Central policy lifecycle with module scoping, versioning, validity windows & owners
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gov_policy_registry (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    policy_code         TEXT NOT NULL,
    policy_name         TEXT NOT NULL,
    module_code         TEXT NOT NULL CHECK (module_code IN (
                            'FINANCE', 'SALES', 'PROCUREMENT', 'INVENTORY', 'MANUFACTURING',
                            'SERVICE', 'WARRANTY', 'HR', 'SECURITY', 'INTEGRATION', 'EXECUTION'
                        )),
    severity            TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status              TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'DEPRECATED', 'ARCHIVED')),
    effective_from      TIMESTAMPTZ NOT NULL,
    effective_to        TIMESTAMPTZ NULL,
    owner_role          TEXT NOT NULL DEFAULT 'admin',
    owner_id            UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    version             INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    description         TEXT NOT NULL,
    policy_rules        JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, policy_code, version),
    CONSTRAINT chk_gov_policy_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);

ALTER TABLE public.gov_policy_registry ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gov_policy_tenant_mod ON public.gov_policy_registry(tenant_id, module_code);
CREATE INDEX IF NOT EXISTS idx_gov_policy_status ON public.gov_policy_registry(status);
CREATE INDEX IF NOT EXISTS idx_gov_policy_code ON public.gov_policy_registry(policy_code);

-- Policy Version History & Audit Trail
CREATE TABLE IF NOT EXISTS public.gov_policy_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id           UUID NOT NULL REFERENCES public.gov_policy_registry(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    version             INTEGER NOT NULL,
    change_summary      TEXT NOT NULL,
    changed_by          UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by         UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    snapshot_rules      JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.gov_policy_versions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gov_policy_ver_policy ON public.gov_policy_versions(policy_id);

-- =============================================================================
-- 2. ENTERPRISE WORKFLOW ENGINE: DEFINITIONS, INSTANCES, STEPS & AUDIT
-- Deterministic state machines with maker-checker, reassignments & immutable transitions
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gov_workflow_definitions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    workflow_code       TEXT NOT NULL,
    workflow_name       TEXT NOT NULL,
    module_code         TEXT NOT NULL,
    trigger_entity_type TEXT NOT NULL,
    version             INTEGER NOT NULL DEFAULT 1,
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'DRAFT')),
    steps_config        JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, workflow_code, version)
);

ALTER TABLE public.gov_workflow_definitions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gov_wf_def_tenant_code ON public.gov_workflow_definitions(tenant_id, workflow_code);

CREATE TABLE IF NOT EXISTS public.gov_workflow_instances (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    instance_number     TEXT NOT NULL,
    workflow_def_id     UUID NOT NULL REFERENCES public.gov_workflow_definitions(id) ON DELETE RESTRICT,
    target_entity_type  TEXT NOT NULL,
    target_entity_id    TEXT NOT NULL,
    target_reference    TEXT NOT NULL,
    initiated_by        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    current_step_index  INTEGER NOT NULL DEFAULT 1,
    status              TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN (
                            'PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED', 'ESCALATED', 'COMPLETED'
                        )),
    idempotency_key     TEXT NULL,
    context_data        JSONB NOT NULL DEFAULT '{}'::JSONB,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, instance_number)
);

ALTER TABLE public.gov_workflow_instances ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gov_wf_inst_tenant_status ON public.gov_workflow_instances(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_gov_wf_inst_target ON public.gov_workflow_instances(target_entity_type, target_entity_id);

CREATE TABLE IF NOT EXISTS public.gov_workflow_steps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID NOT NULL REFERENCES public.gov_workflow_instances(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    step_index          INTEGER NOT NULL,
    step_name           TEXT NOT NULL,
    assigned_role       TEXT NOT NULL,
    assigned_user_id    UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    status              TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'SKIPPED', 'DELEGATED')),
    decision_reason     TEXT NULL,
    decided_by          UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    decided_at          TIMESTAMPTZ NULL,
    sla_target_at       TIMESTAMPTZ NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workflow_instance_id, step_index)
);

ALTER TABLE public.gov_workflow_steps ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gov_wf_steps_inst ON public.gov_workflow_steps(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_gov_wf_steps_assigned ON public.gov_workflow_steps(assigned_role, status);

CREATE TABLE IF NOT EXISTS public.gov_workflow_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID NOT NULL REFERENCES public.gov_workflow_instances(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    actor_id            UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type         TEXT NOT NULL,
    from_status         TEXT NOT NULL,
    to_status           TEXT NOT NULL,
    comments            TEXT NULL,
    evidence_payload    JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.gov_workflow_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gov_wf_hist_inst ON public.gov_workflow_history(workflow_instance_id);

-- =============================================================================
-- 3. ENTERPRISE NOTIFICATION CENTER & QUEUE ORCHESTRATION
-- Real-time in-app, SMS, WhatsApp and Email outbox pipeline with retry & dead-letter
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gov_notification_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    template_code       TEXT NOT NULL,
    template_name       TEXT NOT NULL,
    channel             TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP')),
    subject_template    TEXT NULL,
    body_template       TEXT NOT NULL,
    variables           JSONB NOT NULL DEFAULT '[]'::JSONB,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, template_code)
);

ALTER TABLE public.gov_notification_templates ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gov_notif_tmpl_code ON public.gov_notification_templates(tenant_id, template_code);

CREATE TABLE IF NOT EXISTS public.gov_notification_preferences (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    sms_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    whatsapp_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_start   TIME NULL,
    quiet_hours_end     TIME NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id)
);

ALTER TABLE public.gov_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.gov_notification_queue (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    notification_number TEXT NOT NULL,
    recipient_user_id   UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    recipient_target    TEXT NOT NULL, -- Email, phone, or in-app profile identifier (masked on display)
    channel             TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP')),
    priority            TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'URGENT')),
    subject             TEXT NULL,
    body                TEXT NOT NULL,
    source_module       TEXT NOT NULL,
    source_event        TEXT NOT NULL,
    source_reference    TEXT NULL,
    status              TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN (
                            'QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'DEAD_LETTER'
                        )),
    delivery_attempts   INTEGER NOT NULL DEFAULT 0 CHECK (delivery_attempts >= 0),
    max_retries         INTEGER NOT NULL DEFAULT 3,
    next_retry_at       TIMESTAMPTZ NULL,
    last_error          TEXT NULL,
    idempotency_key     TEXT NULL,
    metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at             TIMESTAMPTZ NULL,
    delivered_at        TIMESTAMPTZ NULL,
    UNIQUE (tenant_id, notification_number)
);

ALTER TABLE public.gov_notification_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gov_notif_q_tenant_status ON public.gov_notification_queue(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_gov_notif_q_user ON public.gov_notification_queue(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_gov_notif_q_channel ON public.gov_notification_queue(channel);

-- =============================================================================
-- 4. ENTERPRISE EXCEPTION CENTER
-- Aggregated multi-module exception intelligence with root cause and corrective action
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gov_enterprise_exceptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    exception_number    TEXT NOT NULL,
    source_module       TEXT NOT NULL CHECK (source_module IN (
                            'SALES', 'PROCUREMENT', 'FINANCE', 'INVENTORY', 'MANUFACTURING',
                            'QUALITY', 'SERVICE', 'WARRANTY', 'HR', 'SECURITY', 'INTEGRATION', 'O2C'
                        )),
    severity            TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    entity_type         TEXT NOT NULL,
    entity_id           TEXT NOT NULL,
    entity_reference    TEXT NOT NULL,
    exception_type      TEXT NOT NULL,
    summary             TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN (
                            'OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED'
                        )),
    detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at              TIMESTAMPTZ NOT NULL,
    assigned_owner_id   UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    root_cause          TEXT NULL,
    corrective_action   TEXT NULL,
    resolution_notes    TEXT NULL,
    enterprise_work_item_id UUID NULL REFERENCES public.enterprise_work_items(id) ON DELETE SET NULL,
    resolved_at         TIMESTAMPTZ NULL,
    closed_at           TIMESTAMPTZ NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, exception_number)
);

ALTER TABLE public.gov_enterprise_exceptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gov_exc_tenant_status ON public.gov_enterprise_exceptions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_gov_exc_module ON public.gov_enterprise_exceptions(source_module);
CREATE INDEX IF NOT EXISTS idx_gov_exc_severity ON public.gov_enterprise_exceptions(severity);

-- =============================================================================
-- 5. OBSERVABILITY, AUTOMATION HEALTH & AUDIT
-- Tracking telemetry, failure rates, dead-letter replays, and health bands
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gov_automation_health (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    automation_code     TEXT NOT NULL,
    automation_name     TEXT NOT NULL,
    module_code         TEXT NOT NULL,
    schedule_or_trigger TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'DEGRADED', 'DISABLED')),
    health_band         TEXT NOT NULL DEFAULT 'HEALTHY' CHECK (health_band IN ('HEALTHY', 'DEGRADED', 'WARNING', 'CRITICAL')),
    total_executions    BIGINT NOT NULL DEFAULT 0,
    successful_runs     BIGINT NOT NULL DEFAULT 0,
    failed_runs         BIGINT NOT NULL DEFAULT 0,
    retry_count         BIGINT NOT NULL DEFAULT 0,
    dead_letter_count   BIGINT NOT NULL DEFAULT 0,
    last_run_at         TIMESTAMPTZ NULL,
    next_scheduled_run  TIMESTAMPTZ NULL,
    last_error_message  TEXT NULL,
    owner_id            UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, automation_code)
);

ALTER TABLE public.gov_automation_health ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gov_auto_health ON public.gov_automation_health(tenant_id, health_band);

CREATE TABLE IF NOT EXISTS public.gov_observability_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    event_type          TEXT NOT NULL,
    module_code         TEXT NOT NULL,
    severity            TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    source_component    TEXT NOT NULL,
    message             TEXT NOT NULL,
    execution_latency_ms INTEGER NULL CHECK (execution_latency_ms >= 0),
    correlation_id      UUID NULL,
    payload_masked      JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.gov_observability_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gov_obs_tenant_sev ON public.gov_observability_events(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_gov_obs_time ON public.gov_observability_events(created_at DESC);

-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict multi-tenant isolation with role boundaries (Internal Staff Only)
-- =============================================================================

-- Policy Registry RLS
DROP POLICY IF EXISTS "gov_policy_staff_manage" ON public.gov_policy_registry;
CREATE POLICY "gov_policy_staff_manage" ON public.gov_policy_registry
    FOR ALL USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'finance', 'sales', 'service')
    );

DROP POLICY IF EXISTS "gov_policy_versions_staff" ON public.gov_policy_versions;
CREATE POLICY "gov_policy_versions_staff" ON public.gov_policy_versions
    FOR ALL USING (
        public.get_current_user_role() IN ('super_admin', 'admin')
    );

-- Workflow RLS
DROP POLICY IF EXISTS "gov_wf_def_staff" ON public.gov_workflow_definitions;
CREATE POLICY "gov_wf_def_staff" ON public.gov_workflow_definitions
    FOR ALL USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'finance', 'sales', 'service', 'inventory')
    );

DROP POLICY IF EXISTS "gov_wf_inst_staff" ON public.gov_workflow_instances;
CREATE POLICY "gov_wf_inst_staff" ON public.gov_workflow_instances
    FOR ALL USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'finance', 'sales', 'service', 'inventory', 'support')
    );

DROP POLICY IF EXISTS "gov_wf_steps_staff" ON public.gov_workflow_steps;
CREATE POLICY "gov_wf_steps_staff" ON public.gov_workflow_steps
    FOR ALL USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'finance', 'sales', 'service', 'inventory')
    );

DROP POLICY IF EXISTS "gov_wf_hist_staff" ON public.gov_workflow_history;
CREATE POLICY "gov_wf_hist_staff" ON public.gov_workflow_history
    FOR ALL USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'finance', 'sales', 'service')
    );

-- Notification Queue RLS
DROP POLICY IF EXISTS "gov_notif_q_staff" ON public.gov_notification_queue;
CREATE POLICY "gov_notif_q_staff" ON public.gov_notification_queue
    FOR ALL USING (
        public.get_current_user_role() IN ('super_admin', 'admin')
        OR recipient_user_id = auth.uid()
    );

DROP POLICY IF EXISTS "gov_notif_tmpl_staff" ON public.gov_notification_templates;
CREATE POLICY "gov_notif_tmpl_staff" ON public.gov_notification_templates
    FOR ALL USING (
        public.get_current_user_role() IN ('super_admin', 'admin')
    );

DROP POLICY IF EXISTS "gov_notif_pref_user" ON public.gov_notification_preferences;
CREATE POLICY "gov_notif_pref_user" ON public.gov_notification_preferences
    FOR ALL USING (
        user_id = auth.uid()
    );

-- Exceptions RLS
DROP POLICY IF EXISTS "gov_exc_staff" ON public.gov_enterprise_exceptions;
CREATE POLICY "gov_exc_staff" ON public.gov_enterprise_exceptions
    FOR ALL USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'finance', 'sales', 'service', 'inventory')
    );

-- Automation & Observability RLS
DROP POLICY IF EXISTS "gov_auto_health_staff" ON public.gov_automation_health;
CREATE POLICY "gov_auto_health_staff" ON public.gov_automation_health
    FOR ALL USING (
        public.get_current_user_role() IN ('super_admin', 'admin')
    );

DROP POLICY IF EXISTS "gov_obs_events_staff" ON public.gov_observability_events;
CREATE POLICY "gov_obs_events_staff" ON public.gov_observability_events
    FOR ALL USING (
        public.get_current_user_role() IN ('super_admin', 'admin')
    );

-- =============================================================================
-- 7. ENTERPRISE VIEWS: CONTROL COCKPIT & UNIFIED APPROVALS
-- =============================================================================

CREATE OR REPLACE VIEW public.vw_gov_unified_approvals AS
SELECT
    ar.id AS approval_id,
    ar.approval_code,
    ar.tenant_id,
    ar.approval_type,
    ar.source_entity_type,
    ar.source_entity_id,
    ar.source_reference,
    ar.financial_amount,
    ar.requested_by,
    p_req.full_name AS requester_name,
    ar.assigned_approver_role,
    ar.assigned_approver_id,
    p_app.full_name AS approver_name,
    ar.status,
    ar.approved_by,
    ar.approved_at,
    ar.rejection_reason,
    ar.maker_checker_valid,
    ar.created_at,
    CASE 
        WHEN ar.financial_amount > 500000.00 THEN 'CRITICAL'
        WHEN ar.financial_amount > 100000.00 THEN 'HIGH'
        ELSE 'MEDIUM'
    END AS risk_tier
FROM public.enterprise_approvals_register ar
LEFT JOIN public.profiles p_req ON p_req.id = ar.requested_by
LEFT JOIN public.profiles p_app ON p_app.id = ar.assigned_approver_id;

CREATE OR REPLACE VIEW public.vw_gov_system_health_cockpit AS
SELECT
    ah.tenant_id,
    COUNT(*) AS total_automations,
    COUNT(*) FILTER (WHERE ah.health_band = 'HEALTHY') AS healthy_automations,
    COUNT(*) FILTER (WHERE ah.health_band = 'DEGRADED') AS degraded_automations,
    COUNT(*) FILTER (WHERE ah.health_band IN ('WARNING', 'CRITICAL')) AS critical_automations,
    SUM(ah.failed_runs) AS aggregate_failed_runs,
    SUM(ah.dead_letter_count) AS aggregate_dead_letters,
    COUNT(DISTINCT exc.id) FILTER (WHERE exc.status NOT IN ('RESOLVED', 'CLOSED')) AS open_enterprise_exceptions,
    COUNT(DISTINCT nq.id) FILTER (WHERE nq.status = 'DEAD_LETTER') AS dead_letter_notifications,
    MAX(ah.last_run_at) AS latest_automation_heartbeat
FROM public.gov_automation_health ah
LEFT JOIN public.gov_enterprise_exceptions exc ON exc.tenant_id = ah.tenant_id
LEFT JOIN public.gov_notification_queue nq ON nq.tenant_id = ah.tenant_id
GROUP BY ah.tenant_id;

-- =============================================================================
-- 8. SERVER-AUTHORITATIVE RPCs (SECURITY DEFINER + FIXED SEARCH PATH)
-- =============================================================================

-- RPC 1: fn_create_governance_policy
CREATE OR REPLACE FUNCTION public.fn_create_governance_policy(
    p_policy_code       TEXT,
    p_policy_name       TEXT,
    p_module_code       TEXT,
    p_severity          TEXT,
    p_effective_from    TIMESTAMPTZ,
    p_effective_to      TIMESTAMPTZ,
    p_description       TEXT,
    p_rules             JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id     UUID;
    v_caller_role   TEXT;
    v_caller_id     UUID := auth.uid();
    v_policy_id     UUID;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM public.profiles WHERE id = v_caller_id;

    IF v_caller_role NOT IN ('super_admin', 'admin') THEN
        RAISE EXCEPTION 'Access Denied: Only super_admin or admin can register governance policies' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.gov_policy_registry (
        tenant_id, policy_code, policy_name, module_code, severity,
        status, effective_from, effective_to, owner_role, owner_id,
        version, description, policy_rules
    ) VALUES (
        v_tenant_id, p_policy_code, p_policy_name, p_module_code, p_severity,
        'ACTIVE', p_effective_from, p_effective_to, v_caller_role, v_caller_id,
        1, p_description, p_rules
    ) RETURNING id INTO v_policy_id;

    -- Record Version Snapshot
    INSERT INTO public.gov_policy_versions (
        policy_id, tenant_id, version, change_summary, changed_by, snapshot_rules
    ) VALUES (
        v_policy_id, v_tenant_id, 1, 'Initial policy baseline creation', v_caller_id, p_rules
    );

    RETURN jsonb_build_object(
        'success', true,
        'policy_id', v_policy_id,
        'policy_code', p_policy_code,
        'message', 'Governance policy registered successfully'
    );
END;
$$;

-- RPC 2: fn_initiate_workflow_instance
CREATE OR REPLACE FUNCTION public.fn_initiate_workflow_instance(
    p_workflow_code     TEXT,
    p_target_type       TEXT,
    p_target_id         TEXT,
    p_target_ref        TEXT,
    p_context_data      JSONB DEFAULT '{}'::JSONB,
    p_idempotency_key   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id     UUID;
    v_caller_id     UUID := auth.uid();
    v_wf_def        RECORD;
    v_instance_id   UUID;
    v_instance_num  TEXT;
    v_step          JSONB;
    v_idx           INTEGER := 1;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_caller_id;

    -- Idempotency check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, instance_number INTO v_instance_id, v_instance_num
        FROM public.gov_workflow_instances
        WHERE tenant_id = v_tenant_id AND idempotency_key = p_idempotency_key;

        IF v_instance_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'instance_id', v_instance_id,
                'instance_number', v_instance_num,
                'idempotent', true
            );
        END IF;
    END IF;

    SELECT * INTO v_wf_def
    FROM public.gov_workflow_definitions
    WHERE tenant_id = v_tenant_id AND workflow_code = p_workflow_code AND status = 'ACTIVE'
    ORDER BY version DESC LIMIT 1;

    IF v_wf_def.id IS NULL THEN
        RAISE EXCEPTION 'Active workflow definition % not found', p_workflow_code USING ERRCODE = 'P0002';
    END IF;

    v_instance_num := 'WFI-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 90000 + 10000)::TEXT, 5, '0');

    INSERT INTO public.gov_workflow_instances (
        tenant_id, instance_number, workflow_def_id, target_entity_type,
        target_entity_id, target_reference, initiated_by, current_step_index,
        status, idempotency_key, context_data
    ) VALUES (
        v_tenant_id, v_instance_num, v_wf_def.id, p_target_type,
        p_target_id, p_target_ref, v_caller_id, 1,
        'IN_PROGRESS', p_idempotency_key, p_context_data
    ) RETURNING id INTO v_instance_id;

    -- Expand steps from config
    FOR v_step IN SELECT * FROM jsonb_array_elements(v_wf_def.steps_config)
    LOOP
        INSERT INTO public.gov_workflow_steps (
            workflow_instance_id, tenant_id, step_index, step_name,
            assigned_role, status, sla_target_at
        ) VALUES (
            v_instance_id, v_tenant_id, v_idx,
            COALESCE(v_step->>'step_name', 'Step ' || v_idx),
            COALESCE(v_step->>'assigned_role', 'admin'),
            CASE WHEN v_idx = 1 THEN 'IN_PROGRESS' ELSE 'PENDING' END,
            NOW() + INTERVAL '24 hours'
        );
        v_idx := v_idx + 1;
    END LOOP;

    -- Record immutable initiation history
    INSERT INTO public.gov_workflow_history (
        workflow_instance_id, tenant_id, actor_id, action_type,
        from_status, to_status, comments
    ) VALUES (
        v_instance_id, v_tenant_id, v_caller_id, 'INITIATE',
        'PENDING', 'IN_PROGRESS', 'Workflow initiated by user'
    );

    RETURN jsonb_build_object(
        'success', true,
        'instance_id', v_instance_id,
        'instance_number', v_instance_num,
        'steps_created', (v_idx - 1),
        'message', 'Workflow instance started successfully'
    );
END;
$$;

-- RPC 3: fn_transition_workflow_step
CREATE OR REPLACE FUNCTION public.fn_transition_workflow_step(
    p_instance_id       UUID,
    p_step_index        INTEGER,
    p_decision          TEXT, -- 'APPROVED' or 'REJECTED'
    p_reason            TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id     UUID := auth.uid();
    v_caller_role   TEXT;
    v_inst          RECORD;
    v_step          RECORD;
    v_total_steps   INTEGER;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

    SELECT * INTO v_inst FROM public.gov_workflow_instances WHERE id = p_instance_id;
    IF v_inst.id IS NULL THEN
        RAISE EXCEPTION 'Workflow instance not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_step FROM public.gov_workflow_steps
    WHERE workflow_instance_id = p_instance_id AND step_index = p_step_index;

    IF v_step.id IS NULL THEN
        RAISE EXCEPTION 'Workflow step not found' USING ERRCODE = 'P0002';
    END IF;

    -- Maker-checker enforcement: Initiator cannot approve step
    IF p_decision = 'APPROVED' AND v_inst.initiated_by = v_caller_id AND v_caller_role != 'super_admin' THEN
        RAISE EXCEPTION 'Maker-Checker Violation: Initiator cannot approve their own workflow step' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total_steps FROM public.gov_workflow_steps WHERE workflow_instance_id = p_instance_id;

    IF p_decision = 'APPROVED' THEN
        UPDATE public.gov_workflow_steps
        SET status = 'APPROVED', decided_by = v_caller_id, decided_at = NOW(), decision_reason = p_reason
        WHERE id = v_step.id;

        IF p_step_index < v_total_steps THEN
            -- Advance to next step
            UPDATE public.gov_workflow_steps
            SET status = 'IN_PROGRESS'
            WHERE workflow_instance_id = p_instance_id AND step_index = (p_step_index + 1);

            UPDATE public.gov_workflow_instances
            SET current_step_index = (p_step_index + 1), updated_at = NOW()
            WHERE id = p_instance_id;
        ELSE
            -- Final step approved -> Complete workflow
            UPDATE public.gov_workflow_instances
            SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
            WHERE id = p_instance_id;
        END IF;
    ELSIF p_decision = 'REJECTED' THEN
        UPDATE public.gov_workflow_steps
        SET status = 'REJECTED', decided_by = v_caller_id, decided_at = NOW(), decision_reason = p_reason
        WHERE id = v_step.id;

        UPDATE public.gov_workflow_instances
        SET status = 'REJECTED', completed_at = NOW(), updated_at = NOW()
        WHERE id = p_instance_id;
    END IF;

    INSERT INTO public.gov_workflow_history (
        workflow_instance_id, tenant_id, actor_id, action_type,
        from_status, to_status, comments
    ) VALUES (
        p_instance_id, v_inst.tenant_id, v_caller_id, p_decision,
        v_step.status, p_decision, p_reason
    );

    RETURN jsonb_build_object(
        'success', true,
        'workflow_status', (SELECT status FROM public.gov_workflow_instances WHERE id = p_instance_id),
        'step_index', p_step_index,
        'decision', p_decision
    );
END;
$$;

-- RPC 4: fn_queue_enterprise_notification
CREATE OR REPLACE FUNCTION public.fn_queue_enterprise_notification(
    p_recipient_target  TEXT,
    p_channel           TEXT,
    p_priority          TEXT,
    p_subject           TEXT,
    p_body              TEXT,
    p_source_module     TEXT,
    p_source_event      TEXT,
    p_recipient_user_id UUID DEFAULT NULL,
    p_idempotency_key   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id     UUID;
    v_caller_id     UUID := auth.uid();
    v_notif_id      UUID;
    v_notif_num     TEXT;
BEGIN
    IF v_caller_id IS NOT NULL THEN
        SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_caller_id;
    ELSE
        SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
    END IF;

    -- Idempotency Check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, notification_number INTO v_notif_id, v_notif_num
        FROM public.gov_notification_queue
        WHERE tenant_id = v_tenant_id AND idempotency_key = p_idempotency_key;

        IF v_notif_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'notification_id', v_notif_id,
                'notification_number', v_notif_num,
                'idempotent', true
            );
        END IF;
    END IF;

    v_notif_num := 'NOTIF-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 90000 + 10000)::TEXT, 5, '0');

    INSERT INTO public.gov_notification_queue (
        tenant_id, notification_number, recipient_user_id, recipient_target,
        channel, priority, subject, body, source_module, source_event,
        status, idempotency_key
    ) VALUES (
        v_tenant_id, v_notif_num, p_recipient_user_id, p_recipient_target,
        p_channel, p_priority, p_subject, p_body, p_source_module, p_source_event,
        'QUEUED', p_idempotency_key
    ) RETURNING id INTO v_notif_id;

    RETURN jsonb_build_object(
        'success', true,
        'notification_id', v_notif_id,
        'notification_number', v_notif_num,
        'status', 'QUEUED'
    );
END;
$$;

-- RPC 5: fn_log_enterprise_exception
CREATE OR REPLACE FUNCTION public.fn_log_enterprise_exception(
    p_source_module     TEXT,
    p_severity          TEXT,
    p_entity_type       TEXT,
    p_entity_id         TEXT,
    p_entity_ref        TEXT,
    p_exception_type    TEXT,
    p_summary           TEXT,
    p_due_hours         INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id     UUID;
    v_caller_id     UUID := auth.uid();
    v_exc_id        UUID;
    v_exc_num       TEXT;
    v_due_at        TIMESTAMPTZ := NOW() + (p_due_hours || ' hours')::INTERVAL;
    v_work_item_res JSONB;
    v_work_item_id  UUID := NULL;
BEGIN
    IF v_caller_id IS NOT NULL THEN
        SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_caller_id;
    ELSE
        SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
    END IF;

    v_exc_num := 'EXC-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');

    INSERT INTO public.gov_enterprise_exceptions (
        tenant_id, exception_number, source_module, severity,
        entity_type, entity_id, entity_reference, exception_type,
        summary, status, detected_at, due_at
    ) VALUES (
        v_tenant_id, v_exc_num, p_source_module, p_severity,
        p_entity_type, p_entity_id, p_entity_ref, p_exception_type,
        p_summary, 'OPEN', NOW(), v_due_at
    ) RETURNING id INTO v_exc_id;

    -- If CRITICAL, auto-generate Phase 16 enterprise work item
    IF p_severity = 'CRITICAL' THEN
        BEGIN
            v_work_item_res := public.fn_create_enterprise_work_item(
                v_tenant_id::TEXT,
                'CRITICAL EXCEPTION: ' || p_exception_type || ' (' || v_exc_num || ')',
                p_summary,
                p_source_module,
                'OPERATIONS',
                'CRITICAL',
                'ENTERPRISE_EXCEPTION',
                v_exc_id::TEXT,
                v_exc_num,
                NULL,
                'admin',
                v_due_at,
                jsonb_build_object('exception_id', v_exc_id)
            );
            IF v_work_item_res ? 'work_item_id' THEN
                v_work_item_id := (v_work_item_res->>'work_item_id')::UUID;
                UPDATE public.gov_enterprise_exceptions SET enterprise_work_item_id = v_work_item_id WHERE id = v_exc_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'exception_id', v_exc_id,
        'exception_number', v_exc_num,
        'enterprise_work_item_id', v_work_item_id,
        'due_at', v_due_at
    );
END;
$$;

-- RPC 6: fn_run_enterprise_governance_sweep
CREATE OR REPLACE FUNCTION public.fn_run_enterprise_governance_sweep(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target_tenant_id  UUID;
    v_retried_notifs    INTEGER := 0;
    v_dead_letters      INTEGER := 0;
    v_overdue_steps     INTEGER := 0;
    r_notif             RECORD;
    r_step              RECORD;
BEGIN
    v_target_tenant_id := COALESCE(p_tenant_id, '00000000-0000-0000-0000-000000000000'::UUID);

    -- 1. Retry failed notifications with attempts < max_retries
    FOR r_notif IN
        SELECT id, delivery_attempts, max_retries
        FROM public.gov_notification_queue
        WHERE status = 'FAILED' AND delivery_attempts < max_retries
    LOOP
        UPDATE public.gov_notification_queue
        SET status = 'RETRYING', delivery_attempts = delivery_attempts + 1, next_retry_at = NOW() + INTERVAL '5 minutes'
        WHERE id = r_notif.id;
        v_retried_notifs := v_retried_notifs + 1;
    END LOOP;

    -- 2. Transition failed notifications exceeding max_retries to DEAD_LETTER
    FOR r_notif IN
        SELECT id FROM public.gov_notification_queue
        WHERE status IN ('FAILED', 'RETRYING') AND delivery_attempts >= max_retries
    LOOP
        UPDATE public.gov_notification_queue
        SET status = 'DEAD_LETTER', last_error = 'Max delivery attempts exceeded'
        WHERE id = r_notif.id;
        v_dead_letters := v_dead_letters + 1;
    END LOOP;

    -- 3. Detect overdue workflow steps and escalate
    FOR r_step IN
        SELECT s.id, s.workflow_instance_id
        FROM public.gov_workflow_steps s
        JOIN public.gov_workflow_instances i ON i.id = s.workflow_instance_id
        WHERE s.status = 'IN_PROGRESS' AND s.sla_target_at IS NOT NULL AND NOW() > s.sla_target_at
    LOOP
        UPDATE public.gov_workflow_instances
        SET status = 'ESCALATED', updated_at = NOW()
        WHERE id = r_step.workflow_instance_id;
        v_overdue_steps := v_overdue_steps + 1;
    END LOOP;

    -- 4. Record Observability Heartbeat
    INSERT INTO public.gov_observability_events (
        tenant_id, event_type, module_code, severity, source_component,
        message, execution_latency_ms
    ) VALUES (
        v_target_tenant_id, 'GOVERNANCE_SWEEP', 'GOVERNANCE', 'INFO', 'fn_run_enterprise_governance_sweep',
        'Governance automation sweep completed: ' || v_retried_notifs || ' retried, ' || v_dead_letters || ' dead-lettered, ' || v_overdue_steps || ' escalated',
        25
    );

    RETURN jsonb_build_object(
        'success', true,
        'retried_notifications', v_retried_notifs,
        'dead_letter_notifications', v_dead_letters,
        'escalated_workflow_instances', v_overdue_steps,
        'timestamp', NOW()
    );
END;
$$;

-- =============================================================================
-- 9. PERMISSIONS & LEAST PRIVILEGE REVOCATIONS
-- =============================================================================

REVOKE ALL ON FUNCTION public.fn_create_governance_policy(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_governance_policy(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, JSONB) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_initiate_workflow_instance(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_initiate_workflow_instance(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_transition_workflow_step(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_transition_workflow_step(UUID, INTEGER, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_queue_enterprise_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_queue_enterprise_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_log_enterprise_exception(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_log_enterprise_exception(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_run_enterprise_governance_sweep(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_run_enterprise_governance_sweep(UUID) TO authenticated, service_role;

GRANT ALL ON TABLE public.gov_policy_registry TO authenticated, service_role;
GRANT ALL ON TABLE public.gov_policy_versions TO authenticated, service_role;
GRANT ALL ON TABLE public.gov_workflow_definitions TO authenticated, service_role;
GRANT ALL ON TABLE public.gov_workflow_instances TO authenticated, service_role;
GRANT ALL ON TABLE public.gov_workflow_steps TO authenticated, service_role;
GRANT ALL ON TABLE public.gov_workflow_history TO authenticated, service_role;
GRANT ALL ON TABLE public.gov_notification_templates TO authenticated, service_role;
GRANT ALL ON TABLE public.gov_notification_preferences TO authenticated, service_role;
GRANT ALL ON TABLE public.gov_notification_queue TO authenticated, service_role;
GRANT ALL ON TABLE public.gov_enterprise_exceptions TO authenticated, service_role;
GRANT ALL ON TABLE public.gov_automation_health TO authenticated, service_role;
GRANT ALL ON TABLE public.gov_observability_events TO authenticated, service_role;
GRANT SELECT ON public.vw_gov_unified_approvals TO authenticated, service_role;
GRANT SELECT ON public.vw_gov_system_health_cockpit TO authenticated, service_role;
