-- ==============================================================================
-- ZUVO TV CRM — PHASE 7.8
-- Advanced Service Level Agreement (SLA) Tracking, Field Service Escalation Matrix
-- & Customer CSAT Closed-Loop Resolution Lifecycle
-- Migration: 20261017180000_phase_7_8_sla_escalation_csat_lifecycle.sql
-- ==============================================================================

-- 1. SLA POLICIES TABLE
CREATE TABLE IF NOT EXISTS public.service_sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_code TEXT UNIQUE NOT NULL,
    policy_name TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    service_type TEXT NOT NULL DEFAULT 'ALL' CHECK (service_type IN ('ALL', 'on_site', 'carry_in', 'installation', 'repair')),
    first_response_hours INTEGER NOT NULL CHECK (first_response_hours > 0),
    assignment_hours INTEGER NOT NULL CHECK (assignment_hours > 0),
    visit_schedule_hours INTEGER NOT NULL CHECK (visit_schedule_hours > 0),
    resolution_hours INTEGER NOT NULL CHECK (resolution_hours > 0),
    warning_threshold_pct INTEGER NOT NULL DEFAULT 80 CHECK (warning_threshold_pct BETWEEN 50 AND 95),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Default Production SLA Policies (if not present)
INSERT INTO public.service_sla_policies 
(policy_code, policy_name, priority, service_type, first_response_hours, assignment_hours, visit_schedule_hours, resolution_hours, warning_threshold_pct)
VALUES
('SLA-URGENT-ONSITE', 'Urgent On-Site Service SLA', 'urgent', 'ALL', 2, 4, 12, 24, 75),
('SLA-HIGH-ONSITE', 'High Priority On-Site SLA', 'high', 'ALL', 4, 8, 24, 48, 80),
('SLA-MEDIUM-ONSITE', 'Standard Medium Priority SLA', 'medium', 'ALL', 8, 16, 48, 72, 80),
('SLA-LOW-ONSITE', 'Low / Preventive Service SLA', 'low', 'ALL', 24, 48, 72, 120, 85)
ON CONFLICT (policy_code) DO NOTHING;

-- 2. ESCALATION RULES TABLE
CREATE TABLE IF NOT EXISTS public.service_escalation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code TEXT UNIQUE NOT NULL,
    rule_name TEXT NOT NULL,
    escalation_level INTEGER NOT NULL CHECK (escalation_level BETWEEN 1 AND 4),
    trigger_condition TEXT NOT NULL CHECK (trigger_condition IN ('APPROACHING_BREACH', 'BREACHED', 'PROLONGED_BREACH', 'POOR_CSAT', 'REPEAT_FAILURE')),
    hours_past_breach INTEGER NOT NULL DEFAULT 0 CHECK (hours_past_breach >= 0),
    target_role TEXT NOT NULL CHECK (target_role IN ('service', 'admin', 'super_admin')),
    notify_email BOOLEAN NOT NULL DEFAULT true,
    notify_sms BOOLEAN NOT NULL DEFAULT false,
    action_description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Default Escalation Rules
INSERT INTO public.service_escalation_rules
(rule_code, rule_name, escalation_level, trigger_condition, hours_past_breach, target_role, notify_email, action_description)
VALUES
('ESC-LVL1-APPROACHING', 'Level 1: SLA Approaching Warning (80% Elapsed)', 1, 'APPROACHING_BREACH', 0, 'service', true, 'Alert service coordinator and assigned field technician'),
('ESC-LVL2-BREACHED', 'Level 2: SLA Overdue Breach', 2, 'BREACHED', 0, 'service', true, 'Supervisor escalation; prioritize immediate visit dispatch'),
('ESC-LVL3-PROLONGED', 'Level 3: Critical Prolonged SLA Breach (>24h Overdue)', 3, 'PROLONGED_BREACH', 24, 'admin', true, 'Regional Service Manager escalation; authorize customer loaner unit or unit swap'),
('ESC-LVL4-POOR-CSAT', 'Level 4: Severe Low Customer Rating Escalation (<=2 Stars)', 4, 'POOR_CSAT', 0, 'super_admin', true, 'Executive leadership escalation for closed-loop dispute recovery')
ON CONFLICT (rule_code) DO NOTHING;

-- 3. TICKET SLA & ESCALATION EXTENSIONS (Safe schema additions to service_tickets)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'service_tickets' 
          AND column_name = 'sla_policy_id'
    ) THEN
        ALTER TABLE public.service_tickets
        ADD COLUMN sla_policy_id UUID REFERENCES public.service_sla_policies(id) ON DELETE SET NULL,
        ADD COLUMN sla_first_response_due_at TIMESTAMPTZ,
        ADD COLUMN sla_first_response_at TIMESTAMPTZ,
        ADD COLUMN sla_assignment_due_at TIMESTAMPTZ,
        ADD COLUMN sla_visit_due_at TIMESTAMPTZ,
        ADD COLUMN sla_resolution_due_at TIMESTAMPTZ,
        ADD COLUMN sla_status TEXT NOT NULL DEFAULT 'WITHIN_SLA' 
            CHECK (sla_status IN ('WITHIN_SLA', 'WARNING_APPROACHING', 'BREACHED', 'MET', 'EXEMPT')),
        ADD COLUMN sla_breached_at TIMESTAMPTZ,
        ADD COLUMN escalation_level INTEGER NOT NULL DEFAULT 0 CHECK (escalation_level BETWEEN 0 AND 4),
        ADD COLUMN escalated_at TIMESTAMPTZ;
    END IF;
END $$;

-- 4. TICKET ESCALATION EVENTS / AUDIT HISTORY
CREATE TABLE IF NOT EXISTS public.service_escalation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_number TEXT UNIQUE NOT NULL,
    service_ticket_id UUID NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
    escalation_rule_id UUID REFERENCES public.service_escalation_rules(id) ON DELETE SET NULL,
    from_level INTEGER NOT NULL DEFAULT 0,
    to_level INTEGER NOT NULL CHECK (to_level BETWEEN 1 AND 4),
    reason TEXT NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('AUTO_SLA_ENGINE', 'AUTO_CSAT', 'MANUAL_SUPERVISOR', 'TECHNICIAN_DISTRESS')),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_taken TEXT,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalation_events_ticket ON public.service_escalation_events(service_ticket_id);
CREATE INDEX IF NOT EXISTS idx_escalation_events_level ON public.service_escalation_events(to_level);
CREATE INDEX IF NOT EXISTS idx_escalation_events_created ON public.service_escalation_events(created_at);

-- 5. EXTEND CSAT FOLLOWUPS TABLE FOR CLOSED-LOOP RESOLUTION
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'csat_followups' 
          AND column_name = 'case_number'
    ) THEN
        ALTER TABLE public.csat_followups
        ADD COLUMN case_number TEXT,
        ADD COLUMN root_cause_category TEXT 
            CHECK (root_cause_category IN ('TECHNICIAN_BEHAVIOR', 'PART_DEFECT', 'REPEATED_VISIT', 'DELAYED_RESPONSE', 'IMPROPER_DIAGNOSIS', 'OTHER')),
        ADD COLUMN resolution_action TEXT 
            CHECK (resolution_action IN ('FREE_SERVICE_VISIT', 'EXTENDED_WARRANTY_OFFER', 'REPLACEMENT_SWAP', 'APOLOGY_EXPLANATION', 'NO_ACTION_REQUIRED')),
        ADD COLUMN customer_satisfaction_recovered BOOLEAN DEFAULT false,
        ADD COLUMN closed_at TIMESTAMPTZ,
        ADD COLUMN closed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.service_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_escalation_events ENABLE ROW LEVEL SECURITY;

-- Anonymous denial
REVOKE ALL ON public.service_sla_policies FROM anon;
REVOKE ALL ON public.service_escalation_rules FROM anon;
REVOKE ALL ON public.service_escalation_events FROM anon;

-- Staff Read/Write policies
CREATE POLICY "service_sla_policies_staff_select" ON public.service_sla_policies
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "service_sla_policies_admin_manage" ON public.service_sla_policies
    FOR ALL TO authenticated
    USING (get_current_user_role() IN ('super_admin', 'admin', 'service'));

CREATE POLICY "service_escalation_rules_staff_select" ON public.service_escalation_rules
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "service_escalation_rules_admin_manage" ON public.service_escalation_rules
    FOR ALL TO authenticated
    USING (get_current_user_role() IN ('super_admin', 'admin', 'service'));

CREATE POLICY "service_escalation_events_staff_select" ON public.service_escalation_events
    FOR SELECT TO authenticated
    USING (
        get_current_user_role() IN ('super_admin', 'admin', 'service', 'support')
        OR (
            get_current_user_role() = 'technician' 
            AND service_ticket_id IN (
                SELECT id FROM public.service_tickets WHERE assigned_to = auth.uid()
            )
        )
        OR (
            get_current_user_role() = 'dealer'
            AND service_ticket_id IN (
                SELECT id FROM public.service_tickets WHERE dealer_id = get_current_user_dealer_id()
            )
        )
    );

CREATE POLICY "service_escalation_events_staff_insert" ON public.service_escalation_events
    FOR INSERT TO authenticated
    WITH CHECK (get_current_user_role() IN ('super_admin', 'admin', 'service', 'support'));

CREATE POLICY "service_escalation_events_staff_update" ON public.service_escalation_events
    FOR UPDATE TO authenticated
    USING (get_current_user_role() IN ('super_admin', 'admin', 'service', 'support'));

-- 7. REVOLUTIONARY SERVER-SIDE TRANSACTIONAL RPCS

-- 7.1 RPC: Compute and Attach Authoritative SLA Deadlines to a Service Ticket
CREATE OR REPLACE FUNCTION public.fn_compute_and_attach_ticket_sla(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket public.service_tickets%ROWTYPE;
    v_policy public.service_sla_policies%ROWTYPE;
    v_opened_at TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_ticket FROM public.service_tickets WHERE id = p_ticket_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service ticket % not found', p_ticket_id;
    END IF;

    -- Look up best matching SLA policy by priority
    SELECT * INTO v_policy
    FROM public.service_sla_policies
    WHERE priority = v_ticket.priority AND is_active = true
    LIMIT 1;

    -- Fallback to default medium if not found
    IF NOT FOUND THEN
        SELECT * INTO v_policy
        FROM public.service_sla_policies
        WHERE priority = 'medium' AND is_active = true
        LIMIT 1;
    END IF;

    v_opened_at := COALESCE(v_ticket.opened_at, v_ticket.created_at, now());

    UPDATE public.service_tickets
    SET 
        sla_policy_id = v_policy.id,
        sla_first_response_due_at = v_opened_at + (v_policy.first_response_hours || ' hours')::INTERVAL,
        sla_assignment_due_at = v_opened_at + (v_policy.assignment_hours || ' hours')::INTERVAL,
        sla_visit_due_at = v_opened_at + (v_policy.visit_schedule_hours || ' hours')::INTERVAL,
        sla_resolution_due_at = v_opened_at + (v_policy.resolution_hours || ' hours')::INTERVAL,
        sla_status = 'WITHIN_SLA',
        updated_at = now()
    WHERE id = p_ticket_id;

    RETURN jsonb_build_object(
        'success', true,
        'ticket_id', p_ticket_id,
        'policy_code', v_policy.policy_code,
        'first_response_due', v_opened_at + (v_policy.first_response_hours || ' hours')::INTERVAL,
        'resolution_due', v_opened_at + (v_policy.resolution_hours || ' hours')::INTERVAL,
        'message', 'SLA deadlines successfully calculated and attached'
    );
END;
$$;

-- 7.2 RPC: Authoritative SLA Evaluation & Auto-Escalation Engine
CREATE OR REPLACE FUNCTION public.fn_evaluate_ticket_sla_and_escalations(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket public.service_tickets%ROWTYPE;
    v_policy public.service_sla_policies%ROWTYPE;
    v_now TIMESTAMPTZ := now();
    v_new_sla_status TEXT;
    v_breached_at TIMESTAMPTZ;
    v_escalate_to INTEGER := 0;
    v_escalation_reason TEXT;
    v_event_num TEXT;
    v_event_id UUID;
    v_rule_id UUID;
BEGIN
    SELECT * INTO v_ticket FROM public.service_tickets WHERE id = p_ticket_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service ticket % not found', p_ticket_id;
    END IF;

    -- If ticket is already closed/resolved, mark SLA MET if within deadline or preserve state
    IF v_ticket.status IN ('resolved', 'closed') THEN
        IF v_ticket.sla_status <> 'BREACHED' THEN
            UPDATE public.service_tickets
            SET sla_status = 'MET', updated_at = now()
            WHERE id = p_ticket_id;
        END IF;
        RETURN jsonb_build_object(
            'success', true,
            'ticket_id', p_ticket_id,
            'sla_status', v_ticket.sla_status,
            'is_terminal', true
        );
    END IF;

    -- Fetch policy
    SELECT * INTO v_policy FROM public.service_sla_policies WHERE id = v_ticket.sla_policy_id;
    IF NOT FOUND THEN
        -- Attach SLA first if missing
        PERFORM public.fn_compute_and_attach_ticket_sla(p_ticket_id);
        SELECT * INTO v_ticket FROM public.service_tickets WHERE id = p_ticket_id;
        SELECT * INTO v_policy FROM public.service_sla_policies WHERE id = v_ticket.sla_policy_id;
    END IF;

    -- Evaluate breach vs warning
    IF v_now > v_ticket.sla_resolution_due_at THEN
        v_new_sla_status := 'BREACHED';
        v_breached_at := COALESCE(v_ticket.sla_breached_at, v_now);
        
        -- Check prolonged breach (>24h)
        IF v_now > (v_ticket.sla_resolution_due_at + INTERVAL '24 hours') THEN
            v_escalate_to := 3;
            v_escalation_reason := 'Ticket resolution overdue by more than 24 hours (Prolonged Breach)';
            SELECT id INTO v_rule_id FROM public.service_escalation_rules WHERE rule_code = 'ESC-LVL3-PROLONGED';
        ELSE
            v_escalate_to := 2;
            v_escalation_reason := 'Ticket resolution deadline exceeded SLA threshold';
            SELECT id INTO v_rule_id FROM public.service_escalation_rules WHERE rule_code = 'ESC-LVL2-BREACHED';
        END IF;
    ELSIF v_now > (v_ticket.opened_at + ((v_ticket.sla_resolution_due_at - v_ticket.opened_at) * (v_policy.warning_threshold_pct / 100.0))) THEN
        v_new_sla_status := 'WARNING_APPROACHING';
        v_breached_at := NULL;
        IF v_ticket.escalation_level < 1 THEN
            v_escalate_to := 1;
            v_escalation_reason := 'SLA threshold approaching (' || v_policy.warning_threshold_pct || '% of elapsed resolution window)';
            SELECT id INTO v_rule_id FROM public.service_escalation_rules WHERE rule_code = 'ESC-LVL1-APPROACHING';
        END IF;
    ELSE
        v_new_sla_status := 'WITHIN_SLA';
        v_breached_at := NULL;
    END IF;

    -- Update ticket status
    UPDATE public.service_tickets
    SET 
        sla_status = v_new_sla_status,
        sla_breached_at = CASE WHEN v_new_sla_status = 'BREACHED' THEN COALESCE(sla_breached_at, v_now) ELSE sla_breached_at END,
        escalation_level = GREATEST(escalation_level, v_escalate_to),
        escalated_at = CASE WHEN v_escalate_to > escalation_level THEN v_now ELSE escalated_at END,
        updated_at = v_now
    WHERE id = p_ticket_id;

    -- If a new escalation level is reached, log escalation event and notify
    IF v_escalate_to > v_ticket.escalation_level THEN
        v_event_num := 'ESC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');
        
        INSERT INTO public.service_escalation_events (
            event_number,
            service_ticket_id,
            escalation_rule_id,
            from_level,
            to_level,
            reason,
            trigger_type,
            actor_id,
            action_taken
        ) VALUES (
            v_event_num,
            p_ticket_id,
            v_rule_id,
            v_ticket.escalation_level,
            v_escalate_to,
            v_escalation_reason,
            'AUTO_SLA_ENGINE',
            auth.uid(),
            'Automated Level ' || v_escalate_to || ' system escalation triggered'
        ) RETURNING id INTO v_event_id;

        -- Record audit update in service_updates
        INSERT INTO public.service_updates (
            service_ticket_id,
            previous_status,
            new_status,
            update_type,
            description,
            created_by
        ) VALUES (
            p_ticket_id,
            v_ticket.status,
            v_ticket.status,
            'ESCALATION',
            'Service ticket escalated to Level ' || v_escalate_to || ': ' || v_escalation_reason,
            auth.uid()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'ticket_id', p_ticket_id,
        'sla_status', v_new_sla_status,
        'escalation_level', GREATEST(v_ticket.escalation_level, v_escalate_to),
        'escalated', (v_escalate_to > v_ticket.escalation_level),
        'event_id', v_event_id,
        'message', 'Ticket SLA and escalation evaluated successfully'
    );
END;
$$;

-- 7.3 RPC: Manual Supervisor Escalation Override
CREATE OR REPLACE FUNCTION public.fn_escalate_service_ticket_manual(
    p_ticket_id UUID,
    p_to_level INTEGER,
    p_reason TEXT,
    p_action_taken TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_role TEXT;
    v_ticket public.service_tickets%ROWTYPE;
    v_event_num TEXT;
    v_event_id UUID;
BEGIN
    v_caller_role := get_current_user_role();
    IF v_caller_role NOT IN ('super_admin', 'admin', 'service') THEN
        RAISE EXCEPTION 'Access denied. Only supervisors and service managers can manually escalate tickets.';
    END IF;

    IF p_to_level < 1 OR p_to_level > 4 THEN
        RAISE EXCEPTION 'Invalid escalation level %. Must be between 1 and 4.', p_to_level;
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'A comprehensive justification (at least 5 characters) is required for manual escalation.';
    END IF;

    SELECT * INTO v_ticket FROM public.service_tickets WHERE id = p_ticket_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service ticket % not found', p_ticket_id;
    END IF;

    IF p_to_level <= v_ticket.escalation_level THEN
        RAISE EXCEPTION 'Ticket is already at or above Level % (Current: Level %)', p_to_level, v_ticket.escalation_level;
    END IF;

    v_event_num := 'ESC-MANUAL-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

    -- Insert escalation event
    INSERT INTO public.service_escalation_events (
        event_number,
        service_ticket_id,
        from_level,
        to_level,
        reason,
        trigger_type,
        actor_id,
        action_taken
    ) VALUES (
        v_event_num,
        p_ticket_id,
        v_ticket.escalation_level,
        p_to_level,
        trim(p_reason),
        'MANUAL_SUPERVISOR',
        auth.uid(),
        trim(p_action_taken)
    ) RETURNING id INTO v_event_id;

    -- Update ticket
    UPDATE public.service_tickets
    SET 
        escalation_level = p_to_level,
        escalated_at = now(),
        updated_at = now()
    WHERE id = p_ticket_id;

    -- Insert service update
    INSERT INTO public.service_updates (
        service_ticket_id,
        previous_status,
        new_status,
        update_type,
        description,
        created_by
    ) VALUES (
        p_ticket_id,
        v_ticket.status,
        v_ticket.status,
        'ESCALATION',
        'Supervisor manually escalated ticket to Level ' || p_to_level || ': ' || trim(p_reason),
        auth.uid()
    );

    RETURN jsonb_build_object(
        'success', true,
        'ticket_id', p_ticket_id,
        'event_id', v_event_id,
        'event_number', v_event_num,
        'escalation_level', p_to_level,
        'message', 'Service ticket successfully escalated to Level ' || p_to_level
    );
END;
$$;

-- 7.4 RPC: Closed-Loop CSAT Follow-up Resolution Engine
CREATE OR REPLACE FUNCTION public.fn_resolve_csat_closed_loop_case(
    p_followup_id UUID,
    p_root_cause TEXT,
    p_resolution_action TEXT,
    p_resolution_notes TEXT,
    p_customer_recovered BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_role TEXT;
    v_followup public.csat_followups%ROWTYPE;
BEGIN
    v_caller_role := get_current_user_role();
    IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'support') THEN
        RAISE EXCEPTION 'Access denied. Resolving CSAT follow-up cases requires staff authorization.';
    END IF;

    IF p_resolution_notes IS NULL OR length(trim(p_resolution_notes)) < 5 THEN
        RAISE EXCEPTION 'Detailed resolution notes (at least 5 characters) are mandatory.';
    END IF;

    SELECT * INTO v_followup FROM public.csat_followups WHERE id = p_followup_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'CSAT follow-up case % not found', p_followup_id;
    END IF;

    IF v_followup.status = 'resolved' THEN
        RAISE EXCEPTION 'CSAT follow-up case is already marked as resolved.';
    END IF;

    UPDATE public.csat_followups
    SET
        status = 'resolved',
        root_cause_category = p_root_cause,
        resolution_action = p_resolution_action,
        resolution_notes = trim(p_resolution_notes),
        customer_satisfaction_recovered = COALESCE(p_customer_recovered, true),
        resolved_by = auth.uid(),
        resolved_at = now(),
        closed_by = auth.uid(),
        closed_at = now(),
        updated_at = now()
    WHERE id = p_followup_id;

    -- De-escalate any linked Level 4 escalation event if exists
    UPDATE public.service_escalation_events
    SET 
        is_resolved = true,
        resolved_at = now(),
        resolved_by = auth.uid(),
        action_taken = 'Closed-loop CSAT resolved: ' || trim(p_resolution_notes)
    WHERE service_ticket_id = v_followup.ticket_id
      AND to_level = 4
      AND is_resolved = false;

    RETURN jsonb_build_object(
        'success', true,
        'followup_id', p_followup_id,
        'status', 'resolved',
        'customer_recovered', COALESCE(p_customer_recovered, true),
        'message', 'CSAT closed-loop case resolved successfully'
    );
END;
$$;

-- 8. EXTENDED TRIGGER TO INTEGRATE POOR CSAT AUTOMATIC ESCALATION
CREATE OR REPLACE FUNCTION public.trg_fn_csat_low_rating_auto_escalate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket public.service_tickets%ROWTYPE;
    v_event_num TEXT;
BEGIN
    -- If low rating (<= 2 stars), auto-escalate linked service ticket to Level 4
    IF NEW.priority IN ('urgent', 'high') AND NEW.ticket_id IS NOT NULL THEN
        SELECT * INTO v_ticket FROM public.service_tickets WHERE id = NEW.ticket_id FOR UPDATE;
        IF FOUND AND v_ticket.escalation_level < 4 THEN
            v_event_num := 'ESC-CSAT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');
            
            INSERT INTO public.service_escalation_events (
                event_number,
                service_ticket_id,
                from_level,
                to_level,
                reason,
                trigger_type,
                action_taken
            ) VALUES (
                v_event_num,
                NEW.ticket_id,
                v_ticket.escalation_level,
                4,
                'Customer submitted poor CSAT feedback requiring executive closed-loop recovery',
                'AUTO_CSAT',
                'Automated Level 4 management escalation dispatched'
            );

            UPDATE public.service_tickets
            SET 
                escalation_level = 4,
                escalated_at = now(),
                updated_at = now()
            WHERE id = NEW.ticket_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_csat_low_rating_escalate ON public.csat_followups;
CREATE TRIGGER trg_csat_low_rating_escalate
    AFTER INSERT ON public.csat_followups
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_csat_low_rating_auto_escalate();

-- 9. PERMISSIONS GRANT & REVOCATION
GRANT EXECUTE ON FUNCTION public.fn_compute_and_attach_ticket_sla(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_evaluate_ticket_sla_and_escalations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_escalate_service_ticket_manual(UUID, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_resolve_csat_closed_loop_case(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_compute_and_attach_ticket_sla(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_evaluate_ticket_sla_and_escalations(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_escalate_service_ticket_manual(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_resolve_csat_closed_loop_case(UUID, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
