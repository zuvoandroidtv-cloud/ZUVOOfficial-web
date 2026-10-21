-- =============================================================================
-- ZUVO TV CRM — PHASE 16 MASTER DATABASE MIGRATION
-- Enterprise Execution, Workforce Productivity & Management Control Center
-- Filename: 20261021180000_phase_16_enterprise_execution_productivity.sql
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. SEQUENCES FOR OPERATIONAL EXECUTION IDENTIFIERS
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_enterprise_work_item_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_enterprise_campaign_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_enterprise_sla_event_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 2. TABLE: public.enterprise_sla_policies
-- Configurable Service Level Agreements Across All 10 Enterprise Domains
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_code TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    module_code TEXT NOT NULL CHECK (
        module_code IN (
            'SALES', 'SERVICE', 'WARRANTY', 'INVENTORY', 'PROCUREMENT',
            'MANUFACTURING', 'QUALITY', 'FINANCE', 'DEALER', 'SECURITY', 'GENERAL'
        )
    ),
    priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    response_sla_hours NUMERIC(6, 2) NOT NULL CHECK (response_sla_hours >= 0),
    resolution_sla_hours NUMERIC(6, 2) NOT NULL CHECK (resolution_sla_hours > 0),
    escalation_tier_1_hours NUMERIC(6, 2) NOT NULL CHECK (escalation_tier_1_hours > 0),
    escalation_tier_2_hours NUMERIC(6, 2) NOT NULL CHECK (escalation_tier_2_hours > escalation_tier_1_hours),
    escalation_tier_3_hours NUMERIC(6, 2) NOT NULL CHECK (escalation_tier_3_hours > escalation_tier_2_hours),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_sla_policy_tenant_module_priority UNIQUE (tenant_id, module_code, priority)
);

CREATE INDEX IF NOT EXISTS idx_ent_sla_tenant_module ON public.enterprise_sla_policies(tenant_id, module_code, priority);

-- =============================================================================
-- 3. TABLE: public.enterprise_work_items
-- Master Enterprise Work Queue Aggregating All Actionable Work
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_work_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_number TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    title TEXT NOT NULL,
    description TEXT,
    module_code TEXT NOT NULL CHECK (
        module_code IN (
            'SALES', 'SERVICE', 'WARRANTY', 'INVENTORY', 'PROCUREMENT',
            'MANUFACTURING', 'QUALITY', 'FINANCE', 'DEALER', 'SECURITY', 'GENERAL'
        )
    ),
    department TEXT NOT NULL CHECK (
        department IN ('SALES', 'SERVICE', 'SUPPLY_CHAIN', 'MANUFACTURING', 'FINANCE', 'QUALITY', 'EXECUTIVE', 'SECURITY')
    ),
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (
        status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'BLOCKED', 'COMPLETED', 'CANCELLED')
    ),
    source_entity_type TEXT NOT NULL, -- 'sales_orders', 'leads', 'service_tickets', 'fin_margin_exceptions', etc.
    source_entity_id TEXT NOT NULL,
    source_reference TEXT NOT NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_role TEXT NOT NULL DEFAULT 'admin',
    assigned_at TIMESTAMPTZ,
    due_date TIMESTAMPTZ NOT NULL,
    response_due_at TIMESTAMPTZ,
    resolution_due_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completion_outcome TEXT,
    cancellation_reason TEXT,
    reopen_count INT NOT NULL DEFAULT 0 CHECK (reopen_count >= 0),
    reopen_reason TEXT,
    sla_status TEXT NOT NULL DEFAULT 'WITHIN_SLA' CHECK (
        sla_status IN ('WITHIN_SLA', 'AT_RISK', 'RESPONSE_BREACHED', 'RESOLUTION_BREACHED', 'COMPLETED_ON_TIME', 'COMPLETED_LATE')
    ),
    escalation_tier INT NOT NULL DEFAULT 0 CHECK (escalation_tier BETWEEN 0 AND 3),
    escalation_state TEXT NOT NULL DEFAULT 'NONE' CHECK (
        escalation_state IN ('NONE', 'WARNING', 'ESCALATED_TIER_1', 'ESCALATED_TIER_2', 'ESCALATED_TIER_3')
    ),
    last_escalated_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ent_work_tenant_status ON public.enterprise_work_items(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ent_work_tenant_module ON public.enterprise_work_items(tenant_id, module_code);
CREATE INDEX IF NOT EXISTS idx_ent_work_tenant_assigned ON public.enterprise_work_items(tenant_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_ent_work_due_date ON public.enterprise_work_items(due_date);
CREATE INDEX IF NOT EXISTS idx_ent_work_source ON public.enterprise_work_items(tenant_id, source_entity_type, source_entity_id);

-- =============================================================================
-- 4. TABLE: public.enterprise_work_item_history
-- Immutable Audit Trail of Every Operational State Transition
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_work_item_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id UUID NOT NULL REFERENCES public.enterprise_work_items(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    action_type TEXT NOT NULL CHECK (
        action_type IN (
            'CREATED', 'ASSIGNED', 'REASSIGNED', 'STATUS_CHANGED', 'PRIORITY_CHANGED',
            'DUE_DATE_EXTENDED', 'BLOCKED', 'UNBLOCKED', 'ESCALATED', 'COMPLETED',
            'REOPENED', 'CANCELLED', 'APPROVAL_REQUESTED', 'APPROVED', 'REJECTED'
        )
    ),
    previous_state JSONB NOT NULL DEFAULT '{}'::JSONB,
    new_state JSONB NOT NULL DEFAULT '{}'::JSONB,
    comment TEXT,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ent_work_history_item ON public.enterprise_work_item_history(work_item_id, performed_at DESC);

-- =============================================================================
-- 5. TABLE: public.enterprise_task_dependencies
-- Pre-Requisite Blocking and Dependency Execution Graph
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    work_item_id UUID NOT NULL REFERENCES public.enterprise_work_items(id) ON DELETE CASCADE,
    prerequisite_work_item_id UUID NOT NULL REFERENCES public.enterprise_work_items(id) ON DELETE RESTRICT,
    dependency_type TEXT NOT NULL DEFAULT 'FINISH_TO_START' CHECK (
        dependency_type IN ('FINISH_TO_START', 'START_TO_START')
    ),
    is_blocking BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ent_task_dep UNIQUE (work_item_id, prerequisite_work_item_id),
    CONSTRAINT chk_no_self_dependency CHECK (work_item_id != prerequisite_work_item_id)
);

CREATE INDEX IF NOT EXISTS idx_ent_task_dep_item ON public.enterprise_task_dependencies(work_item_id);
CREATE INDEX IF NOT EXISTS idx_ent_task_dep_prereq ON public.enterprise_task_dependencies(prerequisite_work_item_id);

-- =============================================================================
-- 6. TABLE: public.enterprise_sla_events
-- SLA Sweep Logs, Breach Telemetry & Escalation Lineage
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_sla_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_number TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    work_item_id UUID NOT NULL REFERENCES public.enterprise_work_items(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (
        event_type IN ('SLA_WARNING', 'RESPONSE_BREACH', 'RESOLUTION_BREACH', 'ESCALATED', 'MANUAL_OVERRIDE')
    ),
    escalation_tier INT NOT NULL CHECK (escalation_tier BETWEEN 1 AND 3),
    escalated_to_role TEXT NOT NULL,
    escalated_to_user UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ent_sla_events_item ON public.enterprise_sla_events(work_item_id);

-- =============================================================================
-- 7. TABLE: public.enterprise_workload_snapshots
-- Workforce Capacity, Employee Workload & Team Utilization Metrics
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_workload_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    department TEXT NOT NULL CHECK (
        department IN ('SALES', 'SERVICE', 'SUPPLY_CHAIN', 'MANUFACTURING', 'FINANCE', 'QUALITY', 'EXECUTIVE', 'SECURITY')
    ),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    total_assigned_tasks INT NOT NULL DEFAULT 0 CHECK (total_assigned_tasks >= 0),
    open_tasks INT NOT NULL DEFAULT 0 CHECK (open_tasks >= 0),
    overdue_tasks INT NOT NULL DEFAULT 0 CHECK (overdue_tasks >= 0),
    completed_tasks INT NOT NULL DEFAULT 0 CHECK (completed_tasks >= 0),
    capacity_limit INT NOT NULL DEFAULT 20 CHECK (capacity_limit > 0),
    capacity_utilization_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    productivity_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00 CHECK (productivity_score BETWEEN 0 AND 100),
    load_status TEXT NOT NULL DEFAULT 'OPTIMAL' CHECK (
        load_status IN ('UNDER_UTILIZED', 'OPTIMAL', 'NEAR_CAPACITY', 'OVERLOADED')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_workload_user_date UNIQUE (tenant_id, user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ent_workload_dept_date ON public.enterprise_workload_snapshots(tenant_id, department, snapshot_date);

-- =============================================================================
-- 8. TABLE: public.enterprise_action_campaigns
-- Targeted Execution Drives (Retention, Dealer Growth, Collections, Recalls)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_action_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_number TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    campaign_name TEXT NOT NULL,
    campaign_type TEXT NOT NULL CHECK (
        campaign_type IN (
            'CUSTOMER_RETENTION', 'DEALER_GROWTH', 'AR_COLLECTION_DRIVE',
            'WARRANTY_EXPIRY_RENEWAL', 'RECALL_REMEDIATION', 'MARGIN_LEAKAGE_CLEANUP'
        )
    ),
    target_criteria JSONB NOT NULL DEFAULT '{}'::JSONB,
    total_targets INT NOT NULL DEFAULT 0 CHECK (total_targets >= 0),
    converted_targets INT NOT NULL DEFAULT 0 CHECK (converted_targets >= 0),
    revenue_recovered NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (revenue_recovered >= 0),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')
    ),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Members / Entities enrolled in campaign
CREATE TABLE IF NOT EXISTS public.enterprise_action_campaign_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.enterprise_action_campaigns(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    entity_type TEXT NOT NULL, -- 'customers', 'dealers', 'invoices', etc.
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    assigned_work_item_id UUID REFERENCES public.enterprise_work_items(id) ON DELETE SET NULL,
    stage TEXT NOT NULL DEFAULT 'IDENTIFIED' CHECK (
        stage IN ('IDENTIFIED', 'CONTACTED', 'IN_NEGOTIATION', 'CONVERTED', 'LOST', 'DROPPED')
    ),
    outcome_notes TEXT,
    converted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_campaign_member UNIQUE (campaign_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_ent_camp_member ON public.enterprise_action_campaign_members(campaign_id, stage);

-- =============================================================================
-- 9. TABLE: public.enterprise_approvals_register
-- Consolidated Dual-Control & Maker-Checker Unified Approval Queue
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_approvals_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_code TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    approval_type TEXT NOT NULL CHECK (
        approval_type IN (
            'QUOTATION_DISCOUNT', 'DEALER_ONBOARDING', 'PAYROLL_BATCH', 'PAYMENT_DISBURSEMENT',
            'COMMERCIAL_PRICING_FLOOR', 'PROCUREMENT_PO', 'SCRAP_WRITE_OFF', 'CREDIT_LIMIT_EXPANSION'
        )
    ),
    source_entity_type TEXT NOT NULL,
    source_entity_id TEXT NOT NULL,
    source_reference TEXT NOT NULL,
    financial_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (financial_amount >= 0),
    requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    assigned_approver_role TEXT NOT NULL DEFAULT 'admin',
    assigned_approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    maker_checker_valid BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_maker_checker_segregation CHECK (status != 'APPROVED' OR requested_by != approved_by)
);

CREATE INDEX IF NOT EXISTS idx_ent_approvals_tenant_status ON public.enterprise_approvals_register(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ent_approvals_type ON public.enterprise_approvals_register(approval_type);

-- =============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.enterprise_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_work_item_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_sla_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_workload_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_action_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_action_campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_approvals_register ENABLE ROW LEVEL SECURITY;

-- Revoke all from anon/public
REVOKE ALL ON TABLE public.enterprise_sla_policies FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.enterprise_work_items FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.enterprise_work_item_history FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.enterprise_task_dependencies FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.enterprise_sla_events FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.enterprise_workload_snapshots FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.enterprise_action_campaigns FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.enterprise_action_campaign_members FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.enterprise_approvals_register FROM PUBLIC, anon;

-- Grant authorized operations
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enterprise_sla_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enterprise_work_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.enterprise_work_item_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enterprise_task_dependencies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.enterprise_sla_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enterprise_workload_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enterprise_action_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enterprise_action_campaign_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enterprise_approvals_register TO authenticated;

-- RLS Policies with Tenant Isolation
CREATE POLICY p_sla_policies_tenant ON public.enterprise_sla_policies
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')))
    WITH CHECK (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')));

CREATE POLICY p_work_items_tenant ON public.enterprise_work_items
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')))
    WITH CHECK (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')));

CREATE POLICY p_work_history_tenant ON public.enterprise_work_item_history
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')))
    WITH CHECK (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')));

CREATE POLICY p_task_dep_tenant ON public.enterprise_task_dependencies
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')))
    WITH CHECK (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')));

CREATE POLICY p_sla_events_tenant ON public.enterprise_sla_events
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')))
    WITH CHECK (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')));

CREATE POLICY p_workload_tenant ON public.enterprise_workload_snapshots
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')))
    WITH CHECK (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')));

CREATE POLICY p_campaigns_tenant ON public.enterprise_action_campaigns
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')))
    WITH CHECK (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')));

CREATE POLICY p_campaign_members_tenant ON public.enterprise_action_campaign_members
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')))
    WITH CHECK (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')));

CREATE POLICY p_approvals_tenant ON public.enterprise_approvals_register
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')))
    WITH CHECK (tenant_id = (SELECT coalesce(auth.jwt() ->> 'tenant_id', 'default')));

-- =============================================================================
-- 11. SERVER-AUTHORITATIVE STORED PROCEDURES & RPCS
-- =============================================================================

-- 11.1 Create Work Item
CREATE OR REPLACE FUNCTION public.fn_create_enterprise_work_item(
    p_tenant_id TEXT,
    p_title TEXT,
    p_description TEXT,
    p_module_code TEXT,
    p_department TEXT,
    p_priority TEXT,
    p_source_entity_type TEXT,
    p_source_entity_id TEXT,
    p_source_reference TEXT,
    p_assigned_to UUID,
    p_assigned_role TEXT,
    p_due_date TIMESTAMPTZ,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_work_item_id UUID;
    v_item_number TEXT;
    v_sla RECORD;
    v_resp_due TIMESTAMPTZ;
    v_resol_due TIMESTAMPTZ;
    v_caller_role TEXT;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS NOT NULL AND v_caller_role NOT IN ('super_admin', 'admin', 'sales', 'inventory', 'service', 'finance') THEN
        RAISE EXCEPTION 'Access Denied: Role % unauthorized to create enterprise work items', v_caller_role;
    END IF;

    -- Lookup SLA Policy
    SELECT * INTO v_sla
    FROM public.enterprise_sla_policies
    WHERE tenant_id = p_tenant_id AND module_code = p_module_code AND priority = p_priority AND is_active = true
    LIMIT 1;

    IF v_sla.id IS NOT NULL THEN
        v_resp_due := now() + (v_sla.response_sla_hours || ' hours')::INTERVAL;
        v_resol_due := now() + (v_sla.resolution_sla_hours || ' hours')::INTERVAL;
    ELSE
        v_resol_due := p_due_date;
        v_resp_due := now() + INTERVAL '4 hours';
    END IF;

    v_item_number := 'WRK-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(nextval('public.seq_enterprise_work_item_number')::TEXT, 4, '0');

    INSERT INTO public.enterprise_work_items (
        work_item_number, tenant_id, title, description, module_code, department,
        priority, status, source_entity_type, source_entity_id, source_reference,
        assigned_to, assigned_role, assigned_at, due_date, response_due_at,
        resolution_due_at, metadata, created_by
    ) VALUES (
        v_item_number, p_tenant_id, p_title, p_description, p_module_code, p_department,
        p_priority, CASE WHEN p_assigned_to IS NOT NULL THEN 'ASSIGNED' ELSE 'OPEN' END,
        p_source_entity_type, p_source_entity_id, p_source_reference,
        p_assigned_to, p_assigned_role, CASE WHEN p_assigned_to IS NOT NULL THEN now() ELSE NULL END,
        p_due_date, v_resp_due, v_resol_due, p_metadata, auth.uid()
    ) RETURNING id INTO v_work_item_id;

    -- Audit Creation
    INSERT INTO public.enterprise_work_item_history (
        work_item_id, tenant_id, action_type, new_state, comment, performed_by
    ) VALUES (
        v_work_item_id, p_tenant_id, 'CREATED',
        jsonb_build_object('number', v_item_number, 'priority', p_priority, 'department', p_department),
        'Work item initialized', auth.uid()
    );

    RETURN jsonb_build_object(
        'success', true,
        'work_item_id', v_work_item_id,
        'work_item_number', v_item_number,
        'status', CASE WHEN p_assigned_to IS NOT NULL THEN 'ASSIGNED' ELSE 'OPEN' END,
        'due_date', p_due_date,
        'resolution_due_at', v_resol_due
    );
END;
$$;

-- 11.2 Complete Work Item
CREATE OR REPLACE FUNCTION public.fn_complete_enterprise_work_item(
    p_work_item_id UUID,
    p_completion_outcome TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_work RECORD;
    v_blocking_deps INT;
    v_on_time BOOLEAN;
BEGIN
    SELECT * INTO v_work FROM public.enterprise_work_items WHERE id = p_work_item_id FOR UPDATE;
    IF v_work.id IS NULL THEN
        RAISE EXCEPTION 'Work item not found';
    END IF;

    IF v_work.status = 'COMPLETED' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already completed', 'work_item_number', v_work.work_item_number);
    END IF;

    -- Verify dependencies
    SELECT COUNT(*) INTO v_blocking_deps
    FROM public.enterprise_task_dependencies d
    JOIN public.enterprise_work_items p ON d.prerequisite_work_item_id = p.id
    WHERE d.work_item_id = p_work_item_id AND d.is_blocking = true AND p.status != 'COMPLETED';

    IF v_blocking_deps > 0 THEN
        RAISE EXCEPTION 'Cannot complete task: % prerequisite task(s) are not completed', v_blocking_deps;
    END IF;

    v_on_time := (now() <= v_work.resolution_due_at);

    UPDATE public.enterprise_work_items
    SET status = 'COMPLETED',
        completed_at = now(),
        completed_by = auth.uid(),
        completion_outcome = p_completion_outcome,
        sla_status = CASE WHEN v_on_time THEN 'COMPLETED_ON_TIME' ELSE 'COMPLETED_LATE' END,
        updated_at = now()
    WHERE id = p_work_item_id;

    -- Audit
    INSERT INTO public.enterprise_work_item_history (
        work_item_id, tenant_id, action_type, previous_state, new_state, comment, performed_by
    ) VALUES (
        p_work_item_id, v_work.tenant_id, 'COMPLETED',
        jsonb_build_object('status', v_work.status),
        jsonb_build_object('status', 'COMPLETED', 'outcome', p_completion_outcome, 'on_time', v_on_time),
        'Work item successfully completed', auth.uid()
    );

    RETURN jsonb_build_object(
        'success', true,
        'work_item_number', v_work.work_item_number,
        'status', 'COMPLETED',
        'completed_at', now(),
        'on_time', v_on_time
    );
END;
$$;

-- 11.3 Evaluate SLA & Escalate Work Items
CREATE OR REPLACE FUNCTION public.fn_evaluate_enterprise_sla_sweeps(p_tenant_id TEXT DEFAULT 'default')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    r_item RECORD;
    v_escalated_count INT := 0;
    v_breached_count INT := 0;
    v_new_tier INT;
    v_event_number TEXT;
BEGIN
    FOR r_item IN (
        SELECT w.*, p.escalation_tier_1_hours, p.escalation_tier_2_hours, p.escalation_tier_3_hours
        FROM public.enterprise_work_items w
        LEFT JOIN public.enterprise_sla_policies p
            ON w.tenant_id = p.tenant_id AND w.module_code = p.module_code AND w.priority = p.priority
        WHERE w.tenant_id = p_tenant_id AND w.status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS')
    ) LOOP
        -- Check Breach
        IF r_item.resolution_due_at IS NOT NULL AND now() > r_item.resolution_due_at AND r_item.sla_status != 'RESOLUTION_BREACHED' THEN
            UPDATE public.enterprise_work_items
            SET sla_status = 'RESOLUTION_BREACHED', updated_at = now()
            WHERE id = r_item.id;
            v_breached_count := v_breached_count + 1;
        END IF;

        -- Check Escalation
        IF r_item.resolution_due_at IS NOT NULL AND now() > r_item.resolution_due_at THEN
            v_new_tier := LEAST(3, r_item.escalation_tier + 1);
            IF v_new_tier > r_item.escalation_tier THEN
                v_event_number := 'SLA-EVT-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(nextval('public.seq_enterprise_sla_event_number')::TEXT, 4, '0');
                
                INSERT INTO public.enterprise_sla_events (
                    event_number, tenant_id, work_item_id, event_type, escalation_tier,
                    escalated_to_role, reason
                ) VALUES (
                    v_event_number, p_tenant_id, r_item.id, 'ESCALATED', v_new_tier,
                    CASE v_new_tier WHEN 1 THEN 'team_lead' WHEN 2 THEN 'dept_head' ELSE 'super_admin' END,
                    'Automated escalation: Task resolution SLA breached'
                );

                UPDATE public.enterprise_work_items
                SET escalation_tier = v_new_tier,
                    escalation_state = 'ESCALATED_TIER_' || v_new_tier,
                    last_escalated_at = now(),
                    updated_at = now()
                WHERE id = r_item.id;

                v_escalated_count := v_escalated_count + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'tenant_id', p_tenant_id,
        'breached_count', v_breached_count,
        'escalated_count', v_escalated_count,
        'evaluated_at', now()
    );
END;
$$;

-- 11.4 Unified Approval Execution (Maker-Checker Strict Enforcement)
CREATE OR REPLACE FUNCTION public.fn_process_enterprise_approval(
    p_approval_id UUID,
    p_action TEXT, -- 'APPROVED' or 'REJECTED'
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_app RECORD;
    v_approver_id UUID := auth.uid();
BEGIN
    SELECT * INTO v_app FROM public.enterprise_approvals_register WHERE id = p_approval_id FOR UPDATE;
    IF v_app.id IS NULL THEN
        RAISE EXCEPTION 'Approval record not found';
    END IF;

    IF v_app.status != 'PENDING' THEN
        RAISE EXCEPTION 'Approval already decided: %', v_app.status;
    END IF;

    -- Strict Maker-Checker Guard
    IF p_action = 'APPROVED' AND v_app.requested_by = v_approver_id THEN
        RAISE EXCEPTION 'Maker-Checker Violation: Requesting user cannot self-approve';
    END IF;

    IF p_action = 'REJECTED' AND (p_rejection_reason IS NULL OR trim(p_rejection_reason) = '') THEN
        RAISE EXCEPTION 'Rejection reason is mandatory';
    END IF;

    UPDATE public.enterprise_approvals_register
    SET status = p_action,
        approved_by = CASE WHEN p_action = 'APPROVED' THEN v_approver_id ELSE NULL END,
        approved_at = CASE WHEN p_action = 'APPROVED' THEN now() ELSE NULL END,
        rejection_reason = CASE WHEN p_action = 'REJECTED' THEN p_rejection_reason ELSE NULL END,
        updated_at = now()
    WHERE id = p_approval_id;

    RETURN jsonb_build_object(
        'success', true,
        'approval_code', v_app.approval_code,
        'status', p_action,
        'decided_by', v_approver_id,
        'decided_at', now()
    );
END;
$$;

-- =============================================================================
-- 12. OPERATIONAL REPORTING VIEWS (security_invoker = true)
-- =============================================================================
CREATE OR REPLACE VIEW public.vw_enterprise_action_center_cockpit
WITH (security_invoker = true)
AS
SELECT
    w.tenant_id,
    COUNT(w.id) FILTER (WHERE w.status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS')) AS active_work_items,
    COUNT(w.id) FILTER (WHERE w.status = 'COMPLETED') AS completed_work_items,
    COUNT(w.id) FILTER (WHERE w.due_date < now() AND w.status NOT IN ('COMPLETED', 'CANCELLED')) AS overdue_work_items,
    COUNT(w.id) FILTER (WHERE w.priority = 'CRITICAL' AND w.status NOT IN ('COMPLETED', 'CANCELLED')) AS critical_active_items,
    COUNT(w.id) FILTER (WHERE w.sla_status IN ('RESPONSE_BREACHED', 'RESOLUTION_BREACHED')) AS breached_sla_items,
    COUNT(a.id) FILTER (WHERE a.status = 'PENDING') AS pending_approvals_count,
    ROUND(
        (COUNT(w.id) FILTER (WHERE w.sla_status = 'COMPLETED_ON_TIME')::NUMERIC /
         NULLIF(COUNT(w.id) FILTER (WHERE w.status = 'COMPLETED'), 0)) * 100, 2
    ) AS sla_compliance_pct
FROM public.enterprise_work_items w
LEFT JOIN public.enterprise_approvals_register a ON w.tenant_id = a.tenant_id
GROUP BY w.tenant_id;

CREATE OR REPLACE VIEW public.vw_enterprise_department_productivity
WITH (security_invoker = true)
AS
SELECT
    department,
    tenant_id,
    COUNT(id) AS total_tasks,
    COUNT(id) FILTER (WHERE status = 'COMPLETED') AS completed_tasks,
    COUNT(id) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED') AND due_date < now()) AS overdue_tasks,
    ROUND(
        (COUNT(id) FILTER (WHERE status = 'COMPLETED')::NUMERIC / NULLIF(COUNT(id), 0)) * 100, 2
    ) AS completion_rate_pct,
    ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600)::NUMERIC, 2) AS avg_resolution_hours
FROM public.enterprise_work_items
GROUP BY department, tenant_id;
