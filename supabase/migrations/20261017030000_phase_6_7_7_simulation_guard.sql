-- =============================================================================
-- ZUVO TV CRM — PHASE 6.7.7 FORWARD-ONLY SIMULATION GUARD MIGRATION
-- File: 20261017030000_phase_6_7_7_simulation_guard.sql
-- Description:
--   Enforces environment-aware output in fn_generate_visit_otp:
--   - In production (app.environment = 'production'), otp_simulated is strictly NULL.
--   - In development/testing, otp_simulated is returned with explicit simulation metadata.
--   - Preserves HMAC-SHA-256 storage, row locking, 60s cooldown, masked communication logs.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_generate_visit_otp(
  p_visit_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_otp_secret TEXT;
  v_visit public.service_visits%ROWTYPE;
  v_ticket public.service_tickets%ROWTYPE;
  v_cust public.customers%ROWTYPE;
  v_otp TEXT;
  v_otp_hmac TEXT;
  v_caller_role TEXT;
  v_is_production BOOLEAN;
BEGIN
  -- 1. Authorization check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to generate OTP.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'technician') THEN
    RAISE EXCEPTION 'Access denied. Insufficient permissions to generate visit OTP.';
  END IF;

  -- 2. Validate visit exists with row lock
  SELECT * INTO v_visit FROM public.service_visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service visit not found.';
  END IF;

  -- 3. Technician tenancy/assignment check
  IF v_caller_role = 'technician' AND v_visit.technician_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied. You can only generate OTP for visits assigned to you.';
  END IF;

  -- 4. Status check
  IF v_visit.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot generate OTP for an already completed visit.';
  END IF;

  -- 5. Rate limiting: enforce 60 seconds minimum cooldown between OTP generations
  IF v_visit.otp_generated_at IS NOT NULL AND now() < (v_visit.otp_generated_at + INTERVAL '60 seconds') THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait 60 seconds before requesting another OTP.';
  END IF;

  -- 6. Retrieve secret securely from Supabase Vault
  SELECT decrypted_secret INTO v_otp_secret
  FROM vault.decrypted_secrets
  WHERE name = 'field_service_otp_hmac_secret'
  LIMIT 1;

  IF v_otp_secret IS NULL THEN
    RAISE EXCEPTION 'Field service OTP secret not configured in Vault.';
  END IF;

  -- Fetch ticket and customer metadata
  SELECT * INTO v_ticket FROM public.service_tickets WHERE id = v_visit.service_ticket_id;
  IF FOUND AND v_ticket.customer_id IS NOT NULL THEN
    SELECT * INTO v_cust FROM public.customers WHERE id = v_ticket.customer_id;
  END IF;

  -- 7. Generate cryptographically secure 6-digit numeric OTP using unsigned 32-bit bigint (overflow-safe)
  v_otp := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 900000 + 100000))::text, 6, '0');

  -- 8. Compute keyed HMAC-SHA-256 hash using Vault secret
  v_otp_hmac := encode(extensions.hmac(v_otp, v_otp_secret, 'sha256'), 'hex');

  -- 9. Store hashed OTP, set generation timestamp and 15-minute expiry, reset attempts counter
  UPDATE public.service_visits
  SET
    customer_confirmation_otp = v_otp_hmac,
    otp_generated_at = now(),
    otp_expires_at = now() + INTERVAL '15 minutes',
    otp_attempts = 0,
    updated_at = now()
  WHERE id = p_visit_id;

  -- 10. Record non-sensitive audit log in communication_logs without persisting plaintext OTP
  INSERT INTO public.communication_logs (
    customer_id,
    service_ticket_id,
    channel,
    message_type,
    recipient,
    subject,
    message_body,
    provider_name,
    status,
    failure_reason
  ) VALUES (
    v_ticket.customer_id,
    v_visit.service_ticket_id,
    'sms',
    'service_visit_otp',
    COALESCE(v_cust.phone, 'CUSTOMER_MOBILE'),
    'ZUVO TV Service Confirmation OTP (Simulation)',
    'Field service confirmation OTP dispatched via simulated SMS channel. (6-digit code masked: ***-***). Valid for 15 minutes.',
    'SIMULATION_MOCK',
    'queued',
    'SMS gateway unconfigured — simulated mode'
  );

  -- 11. Environment-aware response: restrict otp_simulated to non-production workflows
  v_is_production := COALESCE(current_setting('app.environment', true), 'development') = 'production';

  IF v_is_production THEN
    RETURN jsonb_build_object(
      'success', true,
      'simulation_mode', false,
      'otp_simulated', NULL,
      'message', 'Confirmation OTP generated and queued for customer delivery.'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'simulation_mode', true,
      'otp_simulated', v_otp,
      'message', 'Simulation Mode: OTP generated in memory for testing. No external SMS dispatched.'
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_generate_visit_otp(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_generate_visit_otp(UUID) TO authenticated;
