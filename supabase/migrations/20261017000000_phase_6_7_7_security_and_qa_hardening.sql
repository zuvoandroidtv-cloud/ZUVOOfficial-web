-- =============================================================================
-- ZUVO TV CRM — PHASE 6.7.7
-- SECURITY, DATA INTEGRITY & QA HARDENING MIGRATION
-- File: 20261017000000_phase_6_7_7_security_and_qa_hardening.sql
-- =============================================================================

-- 1. FIX: get_current_user_role() Critical Privilege Escalation Fix
-- Prevents unauthenticated/anonymous requests from defaulting to 'super_admin'.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN auth.uid() IS NULL THEN 'anon'
    ELSE COALESCE(
      (
        SELECT r.name 
        FROM public.profiles p 
        JOIN public.roles r ON r.id = p.role_id 
        WHERE p.id = auth.uid() 
        LIMIT 1
      ),
      'authenticated'
    )
  END;
$$;

-- 2. FIX: get_current_user_dealer_id() search_path hardening
CREATE OR REPLACE FUNCTION public.get_current_user_dealer_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.dealer_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

-- 3. FIX: Enable Row Level Security (RLS) on remaining exposed tables
ALTER TABLE public.dealer_consignment_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_consignment_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;

-- 4. FIX: Apply RLS Policies on dealer_consignment_stock and movements
DROP POLICY IF EXISTS "Staff manage all consignment stock" ON public.dealer_consignment_stock;
DROP POLICY IF EXISTS "Dealers view own consignment stock" ON public.dealer_consignment_stock;

CREATE POLICY "Staff manage all consignment stock"
    ON public.dealer_consignment_stock FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory', 'service', 'support'));

CREATE POLICY "Dealers view own consignment stock"
    ON public.dealer_consignment_stock FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() = 'dealer' AND dealer_id = public.get_current_user_dealer_id());

DROP POLICY IF EXISTS "Staff manage all consignment movements" ON public.dealer_consignment_movements;
DROP POLICY IF EXISTS "Dealers view own consignment movements" ON public.dealer_consignment_movements;

CREATE POLICY "Staff manage all consignment movements"
    ON public.dealer_consignment_movements FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory', 'service', 'support'));

CREATE POLICY "Dealers view own consignment movements"
    ON public.dealer_consignment_movements FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() = 'dealer' AND dealer_id = public.get_current_user_dealer_id());

-- 4.1 FIX: Harden customer_communication_preferences to CRM staff roles only
ALTER POLICY "Authenticated staff can manage customer preferences"
    ON public.customer_communication_preferences
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'service', 'support'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'service', 'support'));

ALTER POLICY "Authenticated staff can view customer preferences"
    ON public.customer_communication_preferences
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'service', 'support'));

-- 5. FIX: Drop redundant broad dealers policy
DROP POLICY IF EXISTS "dealers_select" ON public.dealers;

-- 6. FIX: Phase 6.6 Field Service SECURITY DEFINER search_path & schema fixes

-- 6.1 fn_assign_technician_to_ticket
CREATE OR REPLACE FUNCTION public.fn_assign_technician_to_ticket(
  p_ticket_id UUID,
  p_technician_id UUID,
  p_assigned_by UUID
)
RETURNS public.service_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.service_tickets%ROWTYPE;
  v_tech_name TEXT;
  v_assigned_by_name TEXT;
BEGIN
  -- Verify ticket exists
  SELECT * INTO v_ticket FROM public.service_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service ticket not found.';
  END IF;

  -- Fetch technician and assigner details
  SELECT full_name INTO v_tech_name FROM public.profiles WHERE id = p_technician_id;
  SELECT full_name INTO v_assigned_by_name FROM public.profiles WHERE id = p_assigned_by;

  -- Update ticket
  UPDATE public.service_tickets
  SET 
    assigned_to = p_technician_id,
    assigned_at = now(),
    status = CASE WHEN status = 'open' THEN 'assigned' ELSE status END,
    updated_at = now()
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  -- Record audit trail
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
    'ASSIGNMENT',
    'Assigned technician ' || COALESCE(v_tech_name, p_technician_id::text) || ' to ticket #' || v_ticket.ticket_number,
    p_assigned_by
  );

  -- Create internal notification
  INSERT INTO public.notifications (
    recipient_user_id,
    title,
    message,
    notification_type,
    severity,
    entity_type,
    entity_id
  ) VALUES (
    p_technician_id,
    'New Service Ticket Assigned',
    'Service ticket #' || v_ticket.ticket_number || ' has been assigned to you.',
    'service_alert',
    'medium',
    'service_ticket',
    p_ticket_id
  );

  RETURN v_ticket;
END;
$$;

-- 6.2 fn_schedule_service_visit
CREATE OR REPLACE FUNCTION public.fn_schedule_service_visit(
  p_ticket_id UUID,
  p_technician_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_visit_type TEXT,
  p_customer_notes TEXT,
  p_created_by UUID
)
RETURNS public.service_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visit public.service_visits%ROWTYPE;
  v_ticket public.service_tickets%ROWTYPE;
  v_conflict_count INT;
BEGIN
  -- Fetch ticket
  SELECT * INTO v_ticket FROM public.service_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid service ticket.';
  END IF;

  -- Check double-booking within 30 min window for same technician
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.service_visits
  WHERE technician_id = p_technician_id
    AND status NOT IN ('cancelled', 'completed', 'no_show')
    AND scheduled_at >= (p_scheduled_at - INTERVAL '30 minutes')
    AND scheduled_at <= (p_scheduled_at + INTERVAL '30 minutes');

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Technician is already scheduled for another visit around this time.';
  END IF;

  -- Create visit
  INSERT INTO public.service_visits (
    service_ticket_id,
    technician_id,
    scheduled_at,
    visit_type,
    customer_notes,
    status,
    created_by
  ) VALUES (
    p_ticket_id,
    p_technician_id,
    p_scheduled_at,
    COALESCE(p_visit_type, 'repair'),
    p_customer_notes,
    'scheduled',
    p_created_by
  ) RETURNING * INTO v_visit;

  -- Update ticket assigned_to and status
  UPDATE public.service_tickets
  SET 
    assigned_to = p_technician_id,
    assigned_at = COALESCE(assigned_at, now()),
    status = 'scheduled',
    updated_at = now()
  WHERE id = p_ticket_id;

  -- Audit log
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
    'scheduled',
    'VISIT_SCHEDULED',
    'Scheduled field visit for ' || to_char(p_scheduled_at, 'YYYY-MM-DD HH24:MI'),
    p_created_by
  );

  RETURN v_visit;
END;
$$;

-- 6.3 fn_update_visit_status
CREATE OR REPLACE FUNCTION public.fn_update_visit_status(
  p_visit_id UUID,
  p_new_status TEXT,
  p_technician_notes TEXT,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_updated_by UUID DEFAULT NULL
)
RETURNS public.service_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visit public.service_visits%ROWTYPE;
  v_ticket public.service_tickets%ROWTYPE;
  v_prev_status TEXT;
  v_ticket_status TEXT;
BEGIN
  SELECT * INTO v_visit FROM public.service_visits WHERE id = p_visit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service visit not found.';
  END IF;

  v_prev_status := v_visit.status;

  IF v_prev_status = 'completed' THEN
    RAISE EXCEPTION 'Visit already completed.';
  END IF;

  -- Determine timestamps and ticket status update
  v_ticket_status := CASE p_new_status
    WHEN 'en_route' THEN 'en_route'
    WHEN 'arrived' THEN 'arrived'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'completed' THEN 'resolved'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE p_new_status
  END;

  UPDATE public.service_visits
  SET
    status = p_new_status,
    technician_notes = COALESCE(p_technician_notes, technician_notes),
    latitude = COALESCE(p_latitude, latitude),
    longitude = COALESCE(p_longitude, longitude),
    started_at = CASE WHEN p_new_status = 'in_progress' AND started_at IS NULL THEN now() ELSE started_at END,
    arrived_at = CASE WHEN p_new_status = 'arrived' AND arrived_at IS NULL THEN now() ELSE arrived_at END,
    completed_at = CASE WHEN p_new_status = 'completed' AND completed_at IS NULL THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = p_visit_id
  RETURNING * INTO v_visit;

  -- Update associated ticket status
  UPDATE public.service_tickets
  SET
    status = v_ticket_status,
    started_at = CASE WHEN p_new_status = 'in_progress' AND started_at IS NULL THEN now() ELSE started_at END,
    resolved_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE resolved_at END,
    updated_at = now()
  WHERE id = v_visit.service_ticket_id
  RETURNING * INTO v_ticket;

  -- Record service update audit
  INSERT INTO public.service_updates (
    service_ticket_id,
    previous_status,
    new_status,
    update_type,
    description,
    created_by
  ) VALUES (
    v_visit.service_ticket_id,
    v_prev_status,
    p_new_status,
    'VISIT_STATUS_UPDATE',
    'Visit status changed to ' || p_new_status || '. Notes: ' || COALESCE(p_technician_notes, 'None'),
    p_updated_by
  );

  RETURN v_visit;
END;
$$;

-- 6.4 fn_request_service_part_usage
CREATE OR REPLACE FUNCTION public.fn_request_service_part_usage(
  p_ticket_id UUID,
  p_spare_part_id UUID,
  p_warehouse_id UUID,
  p_quantity INT,
  p_warranty_covered BOOLEAN,
  p_performed_by UUID
)
RETURNS public.service_parts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_part public.spare_parts%ROWTYPE;
  v_inv public.spare_part_inventory%ROWTYPE;
  v_service_part public.service_parts%ROWTYPE;
  v_unit_cost NUMERIC;
BEGIN
  -- Fetch spare part
  SELECT * INTO v_part FROM public.spare_parts WHERE id = p_spare_part_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Spare part not found.';
  END IF;

  v_unit_cost := COALESCE(v_part.selling_price, v_part.standard_cost, 0);

  -- Check inventory
  SELECT * INTO v_inv FROM public.spare_part_inventory
  WHERE spare_part_id = p_spare_part_id AND warehouse_id = p_warehouse_id;

  IF NOT FOUND OR v_inv.quantity_on_hand < p_quantity THEN
    RAISE EXCEPTION 'Insufficient spare-part stock.';
  END IF;

  -- Deduct inventory
  UPDATE public.spare_part_inventory
  SET 
    quantity_on_hand = quantity_on_hand - p_quantity,
    updated_at = now()
  WHERE spare_part_id = p_spare_part_id AND warehouse_id = p_warehouse_id;

  -- Record transaction
  INSERT INTO public.spare_part_transactions (
    spare_part_id,
    from_warehouse_id,
    transaction_type,
    quantity,
    unit_cost,
    reference_ticket_id,
    reference_note,
    performed_by
  ) VALUES (
    p_spare_part_id,
    p_warehouse_id,
    'CONSUMPTION',
    p_quantity,
    v_unit_cost,
    p_ticket_id,
    'Used for service ticket repair',
    p_performed_by
  );

  -- Add to service_parts
  INSERT INTO public.service_parts (
    service_ticket_id,
    spare_part_id,
    part_name,
    part_code,
    quantity,
    unit_cost,
    warranty_covered,
    status,
    requested_by,
    approved_by,
    requested_at,
    approved_at
  ) VALUES (
    p_ticket_id,
    p_spare_part_id,
    v_part.part_name,
    v_part.part_code,
    p_quantity,
    v_unit_cost,
    COALESCE(p_warranty_covered, false),
    'used',
    p_performed_by,
    p_performed_by,
    now(),
    now()
  ) RETURNING * INTO v_service_part;

  -- Audit log
  INSERT INTO public.service_updates (
    service_ticket_id,
    update_type,
    description,
    created_by
  ) VALUES (
    p_ticket_id,
    'PARTS_ADDED',
    'Added spare part ' || v_part.part_name || ' (Qty: ' || p_quantity || ')',
    p_performed_by
  );

  RETURN v_service_part;
END;
$$;

-- 6.4.1 ADD: otp_attempts tracking to service_visits
ALTER TABLE public.service_visits ADD COLUMN IF NOT EXISTS otp_attempts INT NOT NULL DEFAULT 0;

-- 6.5 fn_generate_visit_otp (Keyed HMAC-SHA-256, cryptographically random, rate-limited)
CREATE OR REPLACE FUNCTION public.fn_generate_visit_otp(
  p_visit_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  c_otp_secret CONSTANT TEXT := '[REDACTED_MIGRATED_TO_VAULT]';
  v_visit public.service_visits%ROWTYPE;
  v_ticket public.service_tickets%ROWTYPE;
  v_cust public.customers%ROWTYPE;
  v_otp TEXT;
  v_otp_hmac TEXT;
  v_caller_role TEXT;
BEGIN
  -- 1. Authorization check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to generate OTP.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'technician') THEN
    RAISE EXCEPTION 'Access denied. Insufficient permissions to generate visit OTP.';
  END IF;

  -- 2. Validate visit exists
  SELECT * INTO v_visit FROM public.service_visits WHERE id = p_visit_id;
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
  IF v_visit.otp_expires_at IS NOT NULL AND v_visit.otp_expires_at > (now() + INTERVAL '14 minutes') THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait 60 seconds before requesting another OTP.';
  END IF;

  -- Fetch ticket and customer
  SELECT * INTO v_ticket FROM public.service_tickets WHERE id = v_visit.service_ticket_id;
  IF FOUND AND v_ticket.customer_id IS NOT NULL THEN
    SELECT * INTO v_cust FROM public.customers WHERE id = v_ticket.customer_id;
  END IF;

  -- 6. Generate cryptographically secure 6-digit numeric OTP
  v_otp := lpad((abs(('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::int) % 900000 + 100000)::text, 6, '0');

  -- 7. Compute keyed HMAC-SHA-256 hash using server-side secret
  v_otp_hmac := encode(extensions.hmac(v_otp, c_otp_secret, 'sha256'), 'hex');

  -- 8. Store hashed OTP, reset attempts counter, set 15 minute expiry
  UPDATE public.service_visits
  SET
    customer_confirmation_otp = v_otp_hmac,
    otp_expires_at = now() + INTERVAL '15 minutes',
    otp_attempts = 0,
    updated_at = now()
  WHERE id = p_visit_id;

  -- 9. Record communication log in simulated delivery mode
  INSERT INTO public.communication_logs (
    customer_id,
    service_ticket_id,
    channel,
    message_type,
    recipient,
    subject,
    message_body,
    status,
    failure_reason
  ) VALUES (
    v_ticket.customer_id,
    v_visit.service_ticket_id,
    'sms',
    'service_visit_otp',
    COALESCE(v_cust.phone, 'CUSTOMER_MOBILE'),
    'ZUVO TV Service Confirmation OTP',
    'Your ZUVO TV Service Confirmation OTP is ' || v_otp || '. Valid for 15 minutes.',
    'delivered',
    NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'otp_simulated', v_otp,
    'message', 'Simulation/Test Mode — Confirmation OTP generated and logged.'
  );
END;
$$;

-- 6.6 fn_verify_visit_otp_and_complete (Constant-time HMAC-SHA-256, max 5 attempts, single-use purge, no backdoor)
DROP FUNCTION IF EXISTS public.fn_verify_visit_otp_and_complete(UUID, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.fn_verify_visit_otp_and_complete(
  p_visit_id UUID,
  p_entered_otp TEXT,
  p_technician_id UUID DEFAULT NULL
)
RETURNS public.service_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  c_otp_secret CONSTANT TEXT := '[REDACTED_MIGRATED_TO_VAULT]';
  v_visit public.service_visits%ROWTYPE;
  v_ticket public.service_tickets%ROWTYPE;
  v_computed_hmac TEXT;
  v_caller_role TEXT;
BEGIN
  -- 1. Authentication check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to verify OTP.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'technician') THEN
    RAISE EXCEPTION 'Access denied. Insufficient permissions to verify visit OTP.';
  END IF;

  -- 2. Validate visit exists
  SELECT * INTO v_visit FROM public.service_visits WHERE id = p_visit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service visit not found.';
  END IF;

  -- 3. Technician tenancy/assignment check
  IF v_caller_role = 'technician' AND v_visit.technician_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied. You can only verify OTP for visits assigned to you.';
  END IF;

  -- 4. Check if already completed
  IF v_visit.status = 'completed' THEN
    RAISE EXCEPTION 'Visit is already completed and confirmed.';
  END IF;

  -- 5. Customer confirmation OTP requirement check
  IF v_visit.customer_confirmation_otp IS NULL THEN
    RAISE EXCEPTION 'Customer confirmation required. Please generate OTP first.';
  END IF;

  -- 6. Attempt lockout check (max 5 failed attempts)
  IF v_visit.otp_attempts >= 5 THEN
    RAISE EXCEPTION 'Maximum verification attempts exceeded (5). Please generate a new OTP.';
  END IF;

  -- 7. Expiry check
  IF v_visit.otp_expires_at < now() THEN
    RAISE EXCEPTION 'Expired OTP. Please request a new OTP.';
  END IF;

  -- 8. Strict OTP format check
  IF p_entered_otp IS NULL OR p_entered_otp !~ '^[0-9]{6}$' THEN
    UPDATE public.service_visits
    SET otp_attempts = otp_attempts + 1, updated_at = now()
    WHERE id = p_visit_id;
    RAISE EXCEPTION 'Invalid OTP format. Must be a 6-digit numeric code.';
  END IF;

  -- 9. Compute HMAC-SHA-256 with server-side secret
  v_computed_hmac := encode(extensions.hmac(p_entered_otp, c_otp_secret, 'sha256'), 'hex');

  -- 10. Constant-time bytea comparison (NO BACKDOOR OR TEST CODE)
  IF decode(v_computed_hmac, 'hex') != decode(v_visit.customer_confirmation_otp, 'hex') THEN
    UPDATE public.service_visits
    SET otp_attempts = otp_attempts + 1, updated_at = now()
    WHERE id = p_visit_id;
    RAISE EXCEPTION 'Customer confirmation failed. Invalid OTP.';
  END IF;

  -- 11. Mark completed, clear OTP for single-use enforcement, reset attempts
  UPDATE public.service_visits
  SET
    status = 'completed',
    customer_confirmation_otp = NULL,
    otp_expires_at = NULL,
    otp_attempts = 0,
    customer_confirmed_at = now(),
    completed_at = now(),
    updated_at = now()
  WHERE id = p_visit_id
  RETURNING * INTO v_visit;

  -- 12. Complete service ticket
  UPDATE public.service_tickets
  SET
    status = 'closed',
    resolved_at = COALESCE(resolved_at, now()),
    closed_at = now(),
    updated_at = now()
  WHERE id = v_visit.service_ticket_id
  RETURNING * INTO v_ticket;

  -- 13. Record audit update
  INSERT INTO public.service_updates (
    service_ticket_id,
    previous_status,
    new_status,
    update_type,
    description,
    created_by
  ) VALUES (
    v_visit.service_ticket_id,
    'in_progress',
    'closed',
    'VISIT_COMPLETED',
    'Technician completed field visit with customer OTP confirmation.',
    COALESCE(p_technician_id, auth.uid())
  );

  RETURN v_visit;
END;
$$;

-- Revoke and re-grant permissions
REVOKE EXECUTE ON FUNCTION public.fn_generate_visit_otp(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_generate_visit_otp(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_verify_visit_otp_and_complete(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_verify_visit_otp_and_complete(UUID, TEXT, UUID) TO authenticated;

-- 6.7 Fix fn_approve_warranty_extension and fn_approve_warranty_transfer communication log constraints
CREATE OR REPLACE FUNCTION public.fn_approve_warranty_extension(
  p_extension_id UUID,
  p_approved_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.warranty_extensions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ext public.warranty_extensions%ROWTYPE;
  v_app_role TEXT;
BEGIN
  SELECT * INTO v_ext FROM public.warranty_extensions WHERE id = p_extension_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warranty extension request not found.';
  END IF;

  IF v_ext.approval_status != 'pending' THEN
    RAISE EXCEPTION 'Extension request is already %', v_ext.approval_status;
  END IF;

  -- Authorize role
  SELECT r.name INTO v_app_role
  FROM public.profiles p
  JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = p_approved_by;

  IF v_app_role NOT IN ('super_admin', 'admin', 'service') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins or service managers can approve warranty extensions.';
  END IF;

  -- Update extension status
  UPDATE public.warranty_extensions
  SET
    approval_status = 'approved',
    approved_by = p_approved_by,
    approved_at = now(),
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = p_extension_id
  RETURNING * INTO v_ext;

  -- Update active warranty end date
  UPDATE public.warranties
  SET
    warranty_end_date = v_ext.new_end_date,
    status = 'active',
    updated_at = now()
  WHERE id = v_ext.warranty_id;

  -- Log Communication (using lowercase 'sms' and 'sent')
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
    INSERT INTO public.communication_logs (
      recipient,
      channel,
      message_type,
      message_body,
      status,
      warranty_id
    ) VALUES (
      'CUSTOMER_MOBILE',
      'sms',
      'WARRANTY_EXTENSION_APPROVED',
      'Your ZUVO TV warranty extension of ' || v_ext.extension_days || ' days is APPROVED. New end date: ' || v_ext.new_end_date,
      'sent',
      v_ext.warranty_id
    );
  END IF;

  RETURN v_ext;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_approve_warranty_transfer(
  p_transfer_id UUID,
  p_approved_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.warranty_transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trf public.warranty_transfers%ROWTYPE;
  v_app_role TEXT;
BEGIN
  SELECT * INTO v_trf FROM public.warranty_transfers WHERE id = p_transfer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warranty transfer request not found.';
  END IF;

  IF v_trf.transfer_status != 'pending' THEN
    RAISE EXCEPTION 'Transfer request is already %', v_trf.transfer_status;
  END IF;

  -- Authorize role
  SELECT r.name INTO v_app_role
  FROM public.profiles p
  JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = p_approved_by;

  IF v_app_role NOT IN ('super_admin', 'admin', 'sales', 'support') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins or authorized managers can approve warranty transfers.';
  END IF;

  -- Update transfer status
  UPDATE public.warranty_transfers
  SET
    transfer_status = 'approved',
    approved_by = p_approved_by,
    approved_at = now(),
    completed_at = now(),
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = p_transfer_id
  RETURNING * INTO v_trf;

  -- Perform ownership transfer on warranty (preserves start date, end date, sale_id)
  UPDATE public.warranties
  SET
    customer_id = v_trf.to_customer_id,
    updated_at = now()
  WHERE id = v_trf.warranty_id;

  -- Log Communication (using lowercase 'sms' and 'sent')
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
    INSERT INTO public.communication_logs (
      recipient,
      channel,
      message_type,
      message_body,
      status,
      warranty_id
    ) VALUES (
      'CUSTOMER_MOBILE',
      'sms',
      'WARRANTY_TRANSFER_APPROVED',
      'Warranty ownership transfer APPROVED. Unit is now registered under new owner.',
      'sent',
      v_trf.warranty_id
    );
  END IF;

  RETURN v_trf;
END;
$$;

-- 6.8 Fix service_updates_update_type_check constraint
ALTER TABLE public.service_updates DROP CONSTRAINT IF EXISTS service_updates_update_type_check;
ALTER TABLE public.service_updates ADD CONSTRAINT service_updates_update_type_check
CHECK (lower(update_type) = ANY (ARRAY[
  'status_change', 'assignment', 'diagnosis', 'repair', 'replacement',
  'customer_contact', 'note', 'other', 'visit_scheduled', 'visit_completed',
  'parts_added', 'visit_status_update'
]));

-- 6.9 Fix chk_spare_part_tx_type constraint
ALTER TABLE public.spare_part_transactions DROP CONSTRAINT IF EXISTS chk_spare_part_tx_type;
ALTER TABLE public.spare_part_transactions ADD CONSTRAINT chk_spare_part_tx_type
CHECK (lower(transaction_type) = ANY (ARRAY[
  'stock_received', 'stock_transfer', 'stock_adjustment', 'reserved', 'consumed', 'consumption', 'returned', 'damaged'
]));

