-- ==============================================================================
-- PHASE 6.7.5 — CUSTOMER SATISFACTION (CSAT) MODULE
-- Migration: 20261015000000_phase_6_7_5_csat_feedback.sql
-- Description: Adds normalized CSAT survey, response, and follow-up schemas,
--              secure cryptographic token access, low-score alerts,
--              communication logging with opt-out checks, and reporting views.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- 2. UPDATE NOTIFICATIONS CHECK CONSTRAINT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_notifications_type' AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications DROP CONSTRAINT chk_notifications_type;
  END IF;
  
  ALTER TABLE public.notifications ADD CONSTRAINT chk_notifications_type CHECK (
    notification_type = ANY (ARRAY[
      'sale_created'::text, 'sale_completed'::text, 'payment_received'::text,
      'inventory_low'::text, 'inventory_transfer'::text, 'warranty_registered'::text,
      'warranty_expiring'::text, 'service_created'::text, 'service_updated'::text,
      'service_completed'::text, 'spare_part_low_stock'::text, 'rma_created'::text,
      'system_alert'::text, 'PO_SUBMITTED'::text, 'GOODS_RECEIVED'::text,
      'csat_low_rating'::text, 'csat_followup'::text, 'csat_followup_resolved'::text
    ])
  );
END $$;

-- 3. COMMUNICATION TEMPLATES FOR CSAT
INSERT INTO public.communication_templates (template_key, template_name, channel, event_type, subject, message_body, is_active)
VALUES
  ('CSAT_SURVEY_INVITATION', 'CSAT Survey Invitation (SMS)', 'sms', 'service_completed', NULL, 
   'Dear {{customer_name}}, thank you for choosing ZUVO TV. Your service (Ticket #{{ticket_number}}) is complete. Please rate your experience: {{survey_url}}', true),
  ('CSAT_SURVEY_INVITATION', 'CSAT Survey Invitation (WhatsApp)', 'whatsapp', 'service_completed', NULL, 
   'Hello {{customer_name}}! 📺 Your ZUVO TV service (Ticket #{{ticket_number}}) is marked completed. We value your feedback. Tap here to rate our service: {{survey_url}}', true),
  ('CSAT_SURVEY_INVITATION', 'CSAT Customer Satisfaction Survey (Email)', 'email', 'service_completed', 
   'How did we do? Rate your ZUVO TV Service Experience (Ticket #{{ticket_number}})', 
   'Dear {{customer_name}},<br><br>Thank you for choosing ZUVO TV. We recently completed service on your {{product_model}} (Ticket #{{ticket_number}}).<br><br>Please take 60 seconds to share your feedback so we can continue improving:<br><a href="{{survey_url}}">Click here to rate your service</a><br><br>Best regards,<br>ZUVO TV Customer Care Team', true)
ON CONFLICT (template_key, channel) DO NOTHING;

-- 4. CSAT SURVEYS TABLE
CREATE TABLE IF NOT EXISTS public.csat_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_number text UNIQUE NOT NULL,
  ticket_id uuid NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.service_visits(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dealer_id uuid REFERENCES public.dealers(id) ON DELETE SET NULL,
  service_center_id uuid REFERENCES public.service_centers(id) ON DELETE SET NULL,
  technician_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  survey_trigger text NOT NULL CHECK (survey_trigger IN ('service_completed', 'installation_completed', 'warranty_support')),
  token_hash text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'expired', 'cancelled')),
  sent_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_csat_ticket_trigger UNIQUE (ticket_id, survey_trigger)
);

CREATE INDEX IF NOT EXISTS idx_csat_surveys_token_hash ON public.csat_surveys(token_hash);
CREATE INDEX IF NOT EXISTS idx_csat_surveys_customer ON public.csat_surveys(customer_id);
CREATE INDEX IF NOT EXISTS idx_csat_surveys_ticket ON public.csat_surveys(ticket_id);
CREATE INDEX IF NOT EXISTS idx_csat_surveys_technician ON public.csat_surveys(technician_id);
CREATE INDEX IF NOT EXISTS idx_csat_surveys_dealer ON public.csat_surveys(dealer_id);
CREATE INDEX IF NOT EXISTS idx_csat_surveys_status ON public.csat_surveys(status);

-- 5. CSAT RESPONSES TABLE
CREATE TABLE IF NOT EXISTS public.csat_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.csat_surveys(id) ON DELETE CASCADE CONSTRAINT uq_csat_response_survey UNIQUE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text text,
  followup_preferred boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csat_responses_survey ON public.csat_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_csat_responses_rating ON public.csat_responses(rating);

-- 6. CSAT FOLLOW-UPS TABLE (LOW RATING TASK TRACKING)
CREATE TABLE IF NOT EXISTS public.csat_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.csat_surveys(id) ON DELETE CASCADE CONSTRAINT uq_csat_followup_survey UNIQUE,
  response_id uuid NOT NULL REFERENCES public.csat_responses(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dealer_id uuid REFERENCES public.dealers(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'escalated')),
  priority text NOT NULL DEFAULT 'high' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  contact_attempted boolean NOT NULL DEFAULT false,
  contact_notes text,
  resolution_notes text,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csat_followups_survey ON public.csat_followups(survey_id);
CREATE INDEX IF NOT EXISTS idx_csat_followups_status ON public.csat_followups(status);
CREATE INDEX IF NOT EXISTS idx_csat_followups_assigned ON public.csat_followups(assigned_to);

-- 7. CSAT OUTBOX DISPATCH QUEUE (Privileged, ephemeral delivery queue)
CREATE TABLE IF NOT EXISTS public.csat_dispatch_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.csat_surveys(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  survey_url text, -- Contains usable token link; PURGED upon dispatch
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'dispatched', 'failed')),
  dispatch_attempts integer NOT NULL DEFAULT 0,
  failure_reason text DEFAULT NULL,
  dispatched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_csat_dispatch_queue_status ON public.csat_dispatch_queue(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_csat_dispatch_queue_survey ON public.csat_dispatch_queue(survey_id);

ALTER TABLE public.csat_dispatch_queue ENABLE ROW LEVEL SECURITY;
-- Note: No SELECT or ALL policies are granted to authenticated staff or anon.
-- Only service_role and security definer dispatch RPCs can read or manipulate this table.

-- 7. RLS CONFIGURATION
ALTER TABLE public.csat_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_followups ENABLE ROW LEVEL SECURITY;

-- csat_surveys policies
CREATE POLICY "csat_surveys_staff_select" ON public.csat_surveys
  FOR SELECT TO authenticated
  USING (get_current_user_role() = ANY (ARRAY['super_admin', 'admin', 'service', 'support']));

CREATE POLICY "csat_surveys_staff_all" ON public.csat_surveys
  FOR ALL TO authenticated
  USING (get_current_user_role() = ANY (ARRAY['super_admin', 'admin']));

CREATE POLICY "csat_surveys_dealer_select" ON public.csat_surveys
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = 'dealer' AND
    dealer_id IS NOT NULL AND
    dealer_id = get_current_user_dealer_id()
  );

-- csat_responses policies
CREATE POLICY "csat_responses_staff_select" ON public.csat_responses
  FOR SELECT TO authenticated
  USING (get_current_user_role() = ANY (ARRAY['super_admin', 'admin', 'service', 'support']));

CREATE POLICY "csat_responses_staff_all" ON public.csat_responses
  FOR ALL TO authenticated
  USING (get_current_user_role() = ANY (ARRAY['super_admin', 'admin']));

CREATE POLICY "csat_responses_dealer_select" ON public.csat_responses
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = 'dealer' AND
    survey_id IN (
      SELECT id FROM public.csat_surveys WHERE dealer_id IS NOT NULL AND dealer_id = get_current_user_dealer_id()
    )
  );

-- csat_followups policies
CREATE POLICY "csat_followups_staff_select" ON public.csat_followups
  FOR SELECT TO authenticated
  USING (get_current_user_role() = ANY (ARRAY['super_admin', 'admin', 'service', 'support']));

CREATE POLICY "csat_followups_staff_update" ON public.csat_followups
  FOR UPDATE TO authenticated
  USING (get_current_user_role() = ANY (ARRAY['super_admin', 'admin', 'service', 'support']))
  WITH CHECK (get_current_user_role() = ANY (ARRAY['super_admin', 'admin', 'service', 'support']));

CREATE POLICY "csat_followups_dealer_select" ON public.csat_followups
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = 'dealer' AND
    dealer_id IS NOT NULL AND
    dealer_id = get_current_user_dealer_id()
  );

-- 8. REPORTING VIEWS (security_invoker = true)
CREATE OR REPLACE VIEW public.vw_csat_summary WITH (security_invoker = true) AS
SELECT
  COUNT(s.id) AS total_surveys_sent,
  COUNT(r.id) AS total_responses,
  ROUND(
    CASE 
      WHEN COUNT(s.id) > 0 THEN (COUNT(r.id)::numeric / COUNT(s.id)::numeric) * 100 
      ELSE 0 
    END, 1
  ) AS response_rate_percentage,
  ROUND(COALESCE(AVG(r.rating), 0)::numeric, 2) AS average_rating,
  COUNT(r.id) FILTER (WHERE r.rating = 5) AS rating_5_count,
  COUNT(r.id) FILTER (WHERE r.rating = 4) AS rating_4_count,
  COUNT(r.id) FILTER (WHERE r.rating = 3) AS rating_3_count,
  COUNT(r.id) FILTER (WHERE r.rating = 2) AS rating_2_count,
  COUNT(r.id) FILTER (WHERE r.rating = 1) AS rating_1_count,
  COUNT(r.id) FILTER (WHERE r.rating <= 2) AS low_rating_count,
  COUNT(f.id) FILTER (WHERE f.status IN ('pending', 'in_progress')) AS pending_followups_count,
  COUNT(f.id) FILTER (WHERE f.status = 'resolved') AS resolved_followups_count
FROM public.csat_surveys s
LEFT JOIN public.csat_responses r ON r.survey_id = s.id
LEFT JOIN public.csat_followups f ON f.survey_id = s.id;

CREATE OR REPLACE VIEW public.vw_csat_rating_distribution WITH (security_invoker = true) AS
WITH totals AS (
  SELECT COUNT(*)::numeric AS overall_total FROM public.csat_responses
)
SELECT
  star.rating,
  COUNT(r.id) AS count,
  ROUND(
    CASE 
      WHEN t.overall_total > 0 THEN (COUNT(r.id)::numeric / t.overall_total) * 100 
      ELSE 0 
    END, 1
  ) AS percentage
FROM (VALUES (1), (2), (3), (4), (5)) AS star(rating)
CROSS JOIN totals t
LEFT JOIN public.csat_responses r ON r.rating = star.rating
GROUP BY star.rating, t.overall_total
ORDER BY star.rating DESC;

CREATE OR REPLACE VIEW public.vw_csat_technician_summary WITH (security_invoker = true) AS
SELECT
  p.id AS technician_id,
  p.full_name AS technician_name,
  p.employee_code AS technician_code,
  COUNT(s.id) AS surveys_assigned,
  COUNT(r.id) AS responses_received,
  ROUND(COALESCE(AVG(r.rating), 0)::numeric, 2) AS average_rating,
  COUNT(r.id) FILTER (WHERE r.rating <= 2) AS low_ratings_count
FROM public.profiles p
JOIN public.csat_surveys s ON s.technician_id = p.id
LEFT JOIN public.csat_responses r ON r.survey_id = s.id
GROUP BY p.id, p.full_name, p.employee_code
ORDER BY responses_received DESC, average_rating DESC;

CREATE OR REPLACE VIEW public.vw_csat_service_center_summary WITH (security_invoker = true) AS
SELECT
  sc.id AS service_center_id,
  sc.center_name,
  sc.center_code,
  COUNT(s.id) AS surveys_sent,
  COUNT(r.id) AS responses_received,
  ROUND(COALESCE(AVG(r.rating), 0)::numeric, 2) AS average_rating,
  COUNT(r.id) FILTER (WHERE r.rating <= 2) AS low_ratings_count
FROM public.service_centers sc
JOIN public.csat_surveys s ON s.service_center_id = sc.id
LEFT JOIN public.csat_responses r ON r.survey_id = s.id
GROUP BY sc.id, sc.center_name, sc.center_code
ORDER BY responses_received DESC, average_rating DESC;

CREATE OR REPLACE VIEW public.vw_csat_followup_summary WITH (security_invoker = true) AS
SELECT
  status,
  priority,
  COUNT(*) AS total_count,
  ROUND(
    COALESCE(
      AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (WHERE status = 'resolved'), 
      0
    )::numeric, 1
  ) AS avg_resolution_hours
FROM public.csat_followups
GROUP BY status, priority;

-- 9. RPC: TRIGGER SERVICE CSAT SURVEY
CREATE OR REPLACE FUNCTION public.fn_trigger_service_csat_survey(
  p_ticket_id uuid,
  p_survey_trigger text DEFAULT 'service_completed'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.service_tickets%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_visit public.service_visits%ROWTYPE;
  v_prefs public.customer_communication_preferences%ROWTYPE;
  v_existing_id uuid;
  v_raw_token text;
  v_token_hash text;
  v_survey_number text;
  v_new_survey public.csat_surveys%ROWTYPE;
  v_survey_url text;
  v_technician_id uuid;
BEGIN
  -- 1. Fetch ticket and validate eligibility
  SELECT * INTO v_ticket FROM public.service_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'TICKET_NOT_FOUND');
  END IF;

  IF v_ticket.status NOT IN ('resolved', 'closed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INELIGIBLE_STATUS', 'message', 'Survey can only be triggered for resolved or closed tickets');
  END IF;

  -- 2. Prevent duplicate survey for this ticket and trigger
  SELECT id INTO v_existing_id 
  FROM public.csat_surveys 
  WHERE ticket_id = p_ticket_id AND survey_trigger = p_survey_trigger;
  
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'DUPLICATE_SURVEY_PREVENTED', 
      'survey_id', v_existing_id,
      'message', 'A survey has already been generated for this ticket and event.'
    );
  END IF;

  -- 3. Fetch customer
  SELECT * INTO v_customer FROM public.customers WHERE id = v_ticket.customer_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CUSTOMER_NOT_FOUND');
  END IF;

  -- 4. Check opt-out in customer communication preferences
  SELECT * INTO v_prefs FROM public.customer_communication_preferences WHERE customer_id = v_customer.id;
  IF FOUND AND v_prefs.service_updates_enabled = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'CUSTOMER_OPTED_OUT', 'message', 'Customer opted out of service communication updates');
  END IF;

  -- 5. Detect technician from visit or ticket assignment
  SELECT * INTO v_visit 
  FROM public.service_visits 
  WHERE service_ticket_id = p_ticket_id AND status = 'completed' 
  ORDER BY completed_at DESC LIMIT 1;

  v_technician_id := COALESCE(v_visit.technician_id, v_ticket.assigned_to);

  -- 6. Generate unguessable 32-byte cryptographic token
  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

  -- Generate survey number (e.g. CSAT-YYYYMMDD-XXXX)
  v_survey_number := 'CSAT-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(encode(extensions.gen_random_bytes(3), 'hex') from 1 for 4));

  -- 7. Insert survey
  INSERT INTO public.csat_surveys (
    survey_number,
    ticket_id,
    visit_id,
    customer_id,
    dealer_id,
    service_center_id,
    technician_id,
    survey_trigger,
    token_hash,
    status,
    sent_at,
    expires_at
  ) VALUES (
    v_survey_number,
    v_ticket.id,
    v_visit.id,
    v_customer.id,
    v_ticket.dealer_id,
    v_ticket.service_center_id,
    v_technician_id,
    p_survey_trigger,
    v_token_hash,
    'pending',
    now(),
    now() + interval '7 days'
  ) RETURNING * INTO v_new_survey;

  -- 8. Survey URLs:
  -- The full URL is returned ONLY in the memory response of this function call for delivery dispatch.
  v_survey_url := '/?token=' || v_raw_token;
  -- The staff-visible database log MUST redact the raw token so no staff member can steal/reuse survey links.
  v_masked_url := '/?token=' || substring(v_raw_token from 1 for 6) || '...[REDACTED_FOR_SECURITY]';

  -- Insert staff-visible audit log with REDACTED token
  INSERT INTO public.communication_logs (
    customer_id,
    product_unit_id,
    service_ticket_id,
    channel,
    message_type,
    recipient,
    subject,
    message_body,
    provider_name,
    status,
    sent_at,
    delivered_at
  ) VALUES (
    v_customer.id,
    v_ticket.product_unit_id,
    v_ticket.id,
    CASE WHEN v_customer.phone IS NOT NULL AND length(v_customer.phone) > 5 THEN 'sms' ELSE 'email' END,
    'service_completed',
    COALESCE(v_customer.phone, v_customer.email, 'unknown'),
    'ZUVO TV Service Feedback Survey',
    'Thank you for choosing ZUVO TV. Your service (Ticket #' || v_ticket.ticket_number || ') is complete. Please rate your experience: ' || v_masked_url,
    'SIMULATION_MODE_PROVIDER',
    'delivered',
    now(),
    now()
  );

  -- 9. Enqueue in privileged Outbox Dispatch Queue (Ephemeral, RLS-isolated)
  INSERT INTO public.csat_dispatch_queue (
    survey_id,
    ticket_id,
    customer_id,
    recipient,
    channel,
    survey_url,
    status,
    expires_at
  ) VALUES (
    v_new_survey.id,
    v_ticket.id,
    v_customer.id,
    COALESCE(v_customer.phone, v_customer.email, 'unknown'),
    CASE WHEN v_customer.phone IS NOT NULL AND length(v_customer.phone) > 5 THEN 'sms' ELSE 'email' END,
    v_survey_url,
    'queued',
    v_new_survey.expires_at
  );

  -- 10. Return ephemeral raw_token and survey_url to caller in-memory ONLY
  RETURN jsonb_build_object(
    'success', true,
    'survey_id', v_new_survey.id,
    'survey_number', v_new_survey.survey_number,
    'raw_token', v_raw_token,
    'survey_url', v_survey_url,
    'expires_at', v_new_survey.expires_at
  );
END;
$$;

-- 10. RPC: GET MINIMAL SURVEY CONTEXT BY TOKEN (ANONYMOUS SAFE)
CREATE OR REPLACE FUNCTION public.fn_get_survey_by_token(p_raw_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token_hash text;
  v_survey public.csat_surveys%ROWTYPE;
  v_ticket public.service_tickets%ROWTYPE;
  v_product_model text;
  v_existing_response public.csat_responses%ROWTYPE;
BEGIN
  IF p_raw_token IS NULL OR length(p_raw_token) < 16 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'INVALID_TOKEN');
  END IF;

  v_token_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

  SELECT * INTO v_survey FROM public.csat_surveys WHERE token_hash = v_token_hash;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'TOKEN_NOT_FOUND');
  END IF;

  -- Check expiry
  IF v_survey.expires_at < now() OR v_survey.status = 'expired' THEN
    IF v_survey.status != 'expired' THEN
      UPDATE public.csat_surveys SET status = 'expired', updated_at = now() WHERE id = v_survey.id;
    END IF;
    RETURN jsonb_build_object('valid', false, 'error', 'SURVEY_EXPIRED', 'expires_at', v_survey.expires_at);
  END IF;

  -- Check already submitted
  IF v_survey.status = 'submitted' THEN
    SELECT * INTO v_existing_response FROM public.csat_responses WHERE survey_id = v_survey.id;
    RETURN jsonb_build_object(
      'valid', false, 
      'error', 'ALREADY_SUBMITTED', 
      'submitted_at', v_survey.submitted_at,
      'rating', v_existing_response.rating
    );
  END IF;

  -- Minimal context only: Ticket number, service type, product model, service date
  SELECT * INTO v_ticket FROM public.service_tickets WHERE id = v_survey.ticket_id;
  
  IF v_ticket.product_unit_id IS NOT NULL THEN
    SELECT pm.model_name INTO v_product_model
    FROM public.product_units pu
    JOIN public.product_variants pv ON pv.id = pu.variant_id
    JOIN public.product_models pm ON pm.id = pv.model_id
    WHERE pu.id = v_ticket.product_unit_id;
  END IF;
  v_product_model := COALESCE(v_product_model, 'ZUVO Smart TV');

  RETURN jsonb_build_object(
    'valid', true,
    'ticket_number', v_ticket.ticket_number,
    'service_type', v_ticket.service_type,
    'product_model', v_product_model,
    'service_date', COALESCE(v_ticket.resolved_at, v_ticket.closed_at, v_ticket.updated_at),
    'expires_at', v_survey.expires_at
  );
END;
$$;

-- 11. RPC: SUBMIT CSAT FEEDBACK (ANONYMOUS SAFE WITH ATOMIC VALIDATION)
CREATE OR REPLACE FUNCTION public.fn_submit_csat_feedback(
  p_raw_token text,
  p_rating integer,
  p_feedback text DEFAULT NULL,
  p_followup_preferred boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token_hash text;
  v_survey public.csat_surveys%ROWTYPE;
  v_ticket public.service_tickets%ROWTYPE;
  v_response public.csat_responses%ROWTYPE;
  v_followup public.csat_followups%ROWTYPE;
  v_admin record;
BEGIN
  -- Validate rating range
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_RATING', 'message', 'Rating must be an integer between 1 and 5');
  END IF;

  IF p_raw_token IS NULL OR length(p_raw_token) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TOKEN');
  END IF;

  v_token_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

  -- Lock row to prevent race condition or duplicate submissions
  SELECT * INTO v_survey 
  FROM public.csat_surveys 
  WHERE token_hash = v_token_hash 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOKEN_NOT_FOUND');
  END IF;

  IF v_survey.status = 'submitted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_SUBMITTED', 'message', 'This survey has already been submitted');
  END IF;

  IF v_survey.expires_at < now() OR v_survey.status = 'expired' THEN
    UPDATE public.csat_surveys SET status = 'expired', updated_at = now() WHERE id = v_survey.id;
    RETURN jsonb_build_object('success', false, 'error', 'SURVEY_EXPIRED', 'message', 'This survey link has expired');
  END IF;

  -- Insert atomic response
  INSERT INTO public.csat_responses (
    survey_id,
    rating,
    feedback_text,
    followup_preferred,
    submitted_at
  ) VALUES (
    v_survey.id,
    p_rating,
    trim(p_feedback),
    COALESCE(p_followup_preferred, false),
    now()
  ) RETURNING * INTO v_response;

  -- Update survey status
  UPDATE public.csat_surveys
  SET 
    status = 'submitted',
    submitted_at = now(),
    updated_at = now()
  WHERE id = v_survey.id;

  SELECT * INTO v_ticket FROM public.service_tickets WHERE id = v_survey.ticket_id;

  -- STEP 7: Check low rating threshold (rating <= 2) or explicit followup requested
  IF p_rating <= 2 OR p_followup_preferred = true THEN
    -- Create CSAT follow-up record
    INSERT INTO public.csat_followups (
      survey_id,
      response_id,
      ticket_id,
      customer_id,
      dealer_id,
      priority,
      status
    ) VALUES (
      v_survey.id,
      v_response.id,
      v_survey.ticket_id,
      v_survey.customer_id,
      v_survey.dealer_id,
      CASE WHEN p_rating = 1 THEN 'urgent' ELSE 'high' END,
      'pending'
    ) RETURNING * INTO v_followup;

    -- STEP 9: Notify authorized staff (Super Admin, Admins, Service Managers)
    FOR v_admin IN (
      SELECT p.id 
      FROM public.profiles p 
      JOIN public.roles r ON r.id = p.role_id 
      WHERE r.name IN ('super_admin', 'admin', 'service')
    ) LOOP
      INSERT INTO public.notifications (
        recipient_user_id,
        title,
        message,
        notification_type,
        severity,
        entity_type,
        entity_id,
        action_url
      ) VALUES (
        v_admin.id,
        'CSAT Low Rating Alert (' || p_rating || '/5)',
        'Customer submitted ' || p_rating || '-star rating for Ticket #' || v_ticket.ticket_number || '. Follow-up task created.',
        'csat_low_rating',
        'warning',
        'csat_followup',
        v_followup.id,
        '/#/csat'
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Thank you! Your feedback has been recorded successfully.',
    'response_id', v_response.id,
    'rating', v_response.rating,
    'followup_created', (p_rating <= 2 OR p_followup_preferred = true)
  );
END;
$$;

-- 12. RPC: ASSIGN CSAT FOLLOW-UP
CREATE OR REPLACE FUNCTION public.fn_assign_csat_followup(
  p_followup_id uuid,
  p_assigned_to uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_followup public.csat_followups%ROWTYPE;
  v_role text;
BEGIN
  v_role := get_current_user_role();
  IF v_role NOT IN ('super_admin', 'admin', 'service', 'support') THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  SELECT * INTO v_followup FROM public.csat_followups WHERE id = p_followup_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'FOLLOWUP_NOT_FOUND');
  END IF;

  UPDATE public.csat_followups
  SET
    assigned_to = p_assigned_to,
    status = 'in_progress',
    updated_at = now()
  WHERE id = p_followup_id
  RETURNING * INTO v_followup;

  -- Notify assigned staff
  IF p_assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_user_id,
      title,
      message,
      notification_type,
      severity,
      entity_type,
      entity_id,
      action_url
    ) VALUES (
      p_assigned_to,
      'CSAT Follow-Up Assigned',
      'You have been assigned to resolve a low-rating CSAT ticket inquiry.',
      'csat_followup',
      'info',
      'csat_followup',
      v_followup.id,
      '/#/csat'
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'followup', row_to_json(v_followup));
END;
$$;

-- 13. RPC: RESOLVE CSAT FOLLOW-UP
CREATE OR REPLACE FUNCTION public.fn_resolve_csat_followup(
  p_followup_id uuid,
  p_resolution_notes text,
  p_contact_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_followup public.csat_followups%ROWTYPE;
  v_role text;
BEGIN
  v_role := get_current_user_role();
  IF v_role NOT IN ('super_admin', 'admin', 'service', 'support') THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  IF p_resolution_notes IS NULL OR length(trim(p_resolution_notes)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_NOTES', 'message', 'Resolution notes are required.');
  END IF;

  SELECT * INTO v_followup FROM public.csat_followups WHERE id = p_followup_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'FOLLOWUP_NOT_FOUND');
  END IF;

  UPDATE public.csat_followups
  SET
    status = 'resolved',
    resolution_notes = trim(p_resolution_notes),
    contact_notes = COALESCE(trim(p_contact_notes), contact_notes),
    contact_attempted = true,
    resolved_by = auth.uid(),
    resolved_at = now(),
    updated_at = now()
  WHERE id = p_followup_id
  RETURNING * INTO v_followup;

  RETURN jsonb_build_object('success', true, 'followup', row_to_json(v_followup));
END;
$$;

-- 14. AUTOMATIC DATABASE TRIGGER
CREATE OR REPLACE FUNCTION public.trg_auto_trigger_csat_survey()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('resolved', 'closed') AND (OLD.status IS NULL OR OLD.status NOT IN ('resolved', 'closed')) THEN
    PERFORM public.fn_trigger_service_csat_survey(NEW.id, 'service_completed');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_trigger_csat_survey ON public.service_tickets;
CREATE TRIGGER trg_auto_trigger_csat_survey
  AFTER UPDATE OF status ON public.service_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_trigger_csat_survey();

-- 15. SECURE OUTBOX DISPATCH WORKER RPC (SIMULATION / WORKER DISPATCH)
CREATE OR REPLACE FUNCTION public.fn_process_simulated_csat_dispatch(
  p_batch_size integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_item RECORD;
  v_dispatched_count integer := 0;
  v_failed_count integer := 0;
  v_dispatches jsonb := '[]'::jsonb;
  v_masked_recipient text;
  v_is_permanent_error boolean;
  v_sanitized_reason text;
  c_max_attempts CONSTANT integer := 3;
BEGIN
  -- Security: verify authorized caller
  v_role := get_current_user_role();
  IF v_role NOT IN ('super_admin', 'admin', 'service') AND auth.role() != 'service_role' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'UNAUTHORIZED', 
      'message', 'Insufficient privileges to process outbox dispatch'
    );
  END IF;

  FOR v_item IN
    SELECT 
      q.id, 
      q.survey_id, 
      q.ticket_id, 
      q.customer_id, 
      q.recipient, 
      q.channel, 
      q.survey_url, 
      q.dispatch_attempts,
      s.survey_number
    FROM public.csat_dispatch_queue q
    JOIN public.csat_surveys s ON s.id = q.survey_id
    WHERE q.status = 'queued' AND q.expires_at > now()
    ORDER BY q.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    v_is_permanent_error := false;
    v_sanitized_reason := NULL;
    
    BEGIN
      -- Format masked recipient for privacy in administrative audit logs
      IF length(v_item.recipient) >= 7 THEN
        v_masked_recipient := substring(v_item.recipient from 1 for 3) || '****' || substring(v_item.recipient from length(v_item.recipient)-2);
      ELSE
        v_masked_recipient := '***';
      END IF;

      -- 1. Check for PERMANENT / UNRECOVERABLE validation defects:
      -- A. Malformed or missing survey URL
      IF v_item.survey_url IS NULL OR length(v_item.survey_url) < 16 OR v_item.survey_url NOT LIKE '/?token=%' THEN
        v_is_permanent_error := true;
        v_sanitized_reason := 'PERMANENT_ERROR: Malformed or missing survey token URL';
        RAISE EXCEPTION '%', v_sanitized_reason;
      END IF;

      -- B. Invalid recipient format
      IF v_item.recipient IS NULL OR length(trim(v_item.recipient)) < 3 OR v_item.recipient = 'unknown' THEN
        v_is_permanent_error := true;
        v_sanitized_reason := 'PERMANENT_ERROR: Missing or unroutable recipient contact';
        RAISE EXCEPTION '%', v_sanitized_reason;
      END IF;

      -- 2. SIMULATION MODE: Outbound transmission simulated.
      -- IMPORTANT: NEVER output or return v_item.survey_url to the calling browser!
      v_dispatches := v_dispatches || jsonb_build_object(
        'queue_id', v_item.id,
        'survey_number', v_item.survey_number,
        'recipient_masked', v_masked_recipient,
        'channel', v_item.channel,
        'status', 'simulated_dispatched',
        'dispatched_at', now()
      );

      -- 3. Successful simulation processing:
      -- - Status marked 'dispatched'
      -- - survey_url is PURGED to NULL immediately (zero permanent token retention)
      -- - dispatch_attempts incremented
      -- - failure_reason cleared
      UPDATE public.csat_dispatch_queue
      SET
        status = 'dispatched',
        dispatched_at = now(),
        survey_url = NULL, -- Raw token purged immediately upon dispatch
        dispatch_attempts = dispatch_attempts + 1,
        failure_reason = NULL
      WHERE id = v_item.id;

      -- Update csat_surveys sent timestamp
      UPDATE public.csat_surveys
      SET sent_at = now()
      WHERE id = v_item.survey_id;

      v_dispatched_count := v_dispatched_count + 1;

    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      
      -- Classify failure: permanent errors fail immediately, transient errors retry up to c_max_attempts
      IF v_is_permanent_error IS TRUE THEN
        UPDATE public.csat_dispatch_queue
        SET
          status = 'failed',
          survey_url = NULL, -- Purge unroutable/corrupted payload
          dispatch_attempts = dispatch_attempts + 1,
          failure_reason = v_sanitized_reason
        WHERE id = v_item.id;
      ELSE
        -- Transient failure: preserve survey_url for retry until max attempts reached
        v_sanitized_reason := 'TRANSIENT_ERROR: Simulation provider dispatch attempt failed';
        UPDATE public.csat_dispatch_queue
        SET
          dispatch_attempts = dispatch_attempts + 1,
          failure_reason = v_sanitized_reason,
          status = CASE WHEN dispatch_attempts + 1 >= c_max_attempts THEN 'failed' ELSE 'queued' END
        WHERE id = v_item.id;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'mode', 'Simulated — not delivered externally',
    'dispatched_count', v_dispatched_count,
    'failed_count', v_failed_count,
    'dispatches', v_dispatches
  );
END;
$$;

-- 16. HELPER RPC TO QUERY QUEUE STATS WITHOUT EXPOSING TOKENS
CREATE OR REPLACE FUNCTION public.fn_get_csat_dispatch_queue_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_queued integer;
  v_dispatched integer;
  v_failed integer;
BEGIN
  v_role := get_current_user_role();
  IF v_role NOT IN ('super_admin', 'admin', 'service') AND auth.role() != 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  SELECT COUNT(*) INTO v_queued FROM public.csat_dispatch_queue WHERE status = 'queued' AND expires_at > now();
  SELECT COUNT(*) INTO v_dispatched FROM public.csat_dispatch_queue WHERE status = 'dispatched';
  SELECT COUNT(*) INTO v_failed FROM public.csat_dispatch_queue WHERE status = 'failed' OR (status = 'queued' AND expires_at <= now());

  RETURN jsonb_build_object(
    'success', true,
    'queued_count', v_queued,
    'dispatched_count', v_dispatched,
    'failed_count', v_failed
  );
END;
$$;

-- 17. PERMISSIONS GRANT
GRANT EXECUTE ON FUNCTION public.fn_get_survey_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_submit_csat_feedback(text, integer, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_trigger_service_csat_survey(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_assign_csat_followup(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_resolve_csat_followup(uuid, text, text) TO authenticated;

-- Disallow public / anon access to outbox functions
REVOKE EXECUTE ON FUNCTION public.fn_process_simulated_csat_dispatch(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_get_csat_dispatch_queue_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_process_simulated_csat_dispatch(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_csat_dispatch_queue_stats() TO authenticated, service_role;
