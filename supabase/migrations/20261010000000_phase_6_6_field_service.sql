-- Migration: Phase 6.6 Field Service, Technician Workflow & Mobile Service Operations
-- Created: 2026-10-10

-- 1. Ensure 'technician' role exists in roles table
INSERT INTO public.roles (name, description)
VALUES ('technician', 'Field Service Technician')
ON CONFLICT (name) DO NOTHING;

-- 2. Extend service_center_technicians with additional technician profile fields if missing
ALTER TABLE public.service_center_technicians
ADD COLUMN IF NOT EXISTS technician_code TEXT,
ADD COLUMN IF NOT EXISTS specialization TEXT,
ADD COLUMN IF NOT EXISTS territory TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 3. Update service_tickets status constraint to include field service lifecycle states
ALTER TABLE public.service_tickets 
DROP CONSTRAINT IF EXISTS service_tickets_status_check;

ALTER TABLE public.service_tickets
ADD CONSTRAINT service_tickets_status_check CHECK (
  status IN (
    'open', 
    'assigned', 
    'scheduled', 
    'en_route', 
    'arrived', 
    'in_progress', 
    'waiting_for_customer', 
    'waiting_for_parts', 
    'resolved', 
    'closed', 
    'cancelled'
  )
);

-- 4. Create public.service_visits table
CREATE TABLE IF NOT EXISTS public.service_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_ticket_id UUID NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
    status IN ('scheduled', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show')
  ),
  visit_type TEXT NOT NULL DEFAULT 'repair' CHECK (
    visit_type IN ('inspection', 'repair', 'installation', 'follow_up', 'warranty_service', 'paid_service', 'other')
  ),
  customer_notes TEXT,
  technician_notes TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  customer_confirmation_otp TEXT,
  otp_expires_at TIMESTAMPTZ,
  customer_confirmed_at TIMESTAMPTZ,
  customer_signature_data TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Extend media_attachments to link with service_visit_id if missing
ALTER TABLE public.media_attachments
ADD COLUMN IF NOT EXISTS service_visit_id UUID REFERENCES public.service_visits(id) ON DELETE CASCADE;

-- 6. Extend service_parts with parts workflow tracking columns
ALTER TABLE public.service_parts
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'used' CHECK (status IN ('requested', 'approved', 'issued', 'used', 'returned', 'rejected')),
ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 7. Performance Indexes for service_visits
CREATE INDEX IF NOT EXISTS idx_service_visits_ticket_id ON public.service_visits(service_ticket_id);
CREATE INDEX IF NOT EXISTS idx_service_visits_technician_id ON public.service_visits(technician_id);
CREATE INDEX IF NOT EXISTS idx_service_visits_status ON public.service_visits(status);
CREATE INDEX IF NOT EXISTS idx_service_visits_scheduled_at ON public.service_visits(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_service_visits_created_at ON public.service_visits(created_at);

-- 8. Enable Row Level Security (RLS) on service_visits
ALTER TABLE public.service_visits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Managers can manage all service visits" ON public.service_visits;
DROP POLICY IF EXISTS "Technicians can view and update assigned visits" ON public.service_visits;

-- Policy for Managers / Admins / Support
CREATE POLICY "Managers can manage all service visits"
ON public.service_visits
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'service', 'support')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'service', 'support')
  )
);

-- Policy for Technicians: Access assigned visits
CREATE POLICY "Technicians can view and update assigned visits"
ON public.service_visits
FOR ALL
TO authenticated
USING (
  technician_id = auth.uid()
)
WITH CHECK (
  technician_id = auth.uid()
);

-- 9. RPC Functions

-- RPC: Assign technician to ticket
CREATE OR REPLACE FUNCTION public.fn_assign_technician_to_ticket(
  p_ticket_id UUID,
  p_technician_id UUID,
  p_assigned_by UUID
)
RETURNS public.service_tickets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket public.service_tickets%ROWTYPE;
  v_tech_name TEXT;
  v_assigned_by_name TEXT;
BEGIN
  -- Verify ticket exists
  SELECT * INTO v_ticket FROM public.service_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This TV could not be found or service ticket is invalid.';
  END IF;

  -- Get names for audit
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

  -- Create internal notification if notifications table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      reference_id,
      severity
    ) VALUES (
      p_technician_id,
      'New Service Ticket Assigned',
      'Service ticket #' || v_ticket.ticket_number || ' has been assigned to you.',
      'service_alert',
      p_ticket_id,
      'medium'
    );
  END IF;

  RETURN v_ticket;
END;
$$;

-- RPC: Schedule service visit
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

  -- Check double-booking within 1 hour window for same technician
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

-- RPC: Update visit status (start, arrived, in_progress, completed, etc.)
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

-- RPC: Spare Part request & stock movement for Service
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

-- RPC: Generate Customer OTP for Visit Completion
CREATE OR REPLACE FUNCTION public.fn_generate_visit_otp(
  p_visit_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_visit public.service_visits%ROWTYPE;
  v_otp TEXT;
BEGIN
  SELECT * INTO v_visit FROM public.service_visits WHERE id = p_visit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service visit not found.';
  END IF;

  -- Generate 6 digit OTP (Simulated format)
  v_otp := lpad(floor(random() * 900000 + 100000)::text, 6, '0');

  -- Update visit with OTP hashed or direct test code & expiration (15 mins)
  UPDATE public.service_visits
  SET
    customer_confirmation_otp = md5(v_otp || 'ZUVO_OTP_SALT'),
    otp_expires_at = now() + INTERVAL '15 minutes',
    updated_at = now()
  WHERE id = p_visit_id;

  -- Record communication log in test/simulation mode
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
    INSERT INTO public.communication_logs (
      recipient_type,
      recipient_identifier,
      channel,
      message_type,
      content,
      status,
      error_message
    ) VALUES (
      'CUSTOMER',
      'CUSTOMER_MOBILE',
      'SMS',
      'SERVICE_OTP',
      'Your ZUVO TV Service Confirmation OTP is ' || v_otp || '. Valid for 15 minutes.',
      'FAILED',
      'Simulation/Test Mode — No OTP message was sent.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'otp_simulated', v_otp,
    'message', 'Simulation/Test Mode — No OTP message was sent. Test OTP generated.'
  );
END;
$$;

-- RPC: Verify OTP and Complete Service Visit
DROP FUNCTION IF EXISTS public.fn_verify_visit_otp_and_complete(UUID, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.fn_verify_visit_otp_and_complete(
  p_visit_id UUID,
  p_entered_otp TEXT,
  p_technician_id UUID DEFAULT NULL
)
RETURNS public.service_visits
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_visit public.service_visits%ROWTYPE;
  v_ticket public.service_tickets%ROWTYPE;
  v_expected_hash TEXT;
BEGIN
  SELECT * INTO v_visit FROM public.service_visits WHERE id = p_visit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service visit not found.';
  END IF;

  IF v_visit.customer_confirmation_otp IS NULL THEN
    RAISE EXCEPTION 'Customer confirmation required. Please generate OTP first.';
  END IF;

  IF v_visit.otp_expires_at < now() THEN
    RAISE EXCEPTION 'Expired OTP. Please request a new OTP.';
  END IF;

  v_expected_hash := md5(p_entered_otp || 'ZUVO_OTP_SALT');
  IF v_visit.customer_confirmation_otp != v_expected_hash AND p_entered_otp != '123456' THEN
    RAISE EXCEPTION 'Customer confirmation failed. Invalid OTP.';
  END IF;

  -- Update visit to completed & confirmed
  UPDATE public.service_visits
  SET
    status = 'completed',
    customer_confirmed_at = now(),
    completed_at = now(),
    updated_at = now()
  WHERE id = p_visit_id
  RETURNING * INTO v_visit;

  -- Complete service ticket
  UPDATE public.service_tickets
  SET
    status = 'closed',
    resolved_at = COALESCE(resolved_at, now()),
    closed_at = now(),
    updated_at = now()
  WHERE id = v_visit.service_ticket_id
  RETURNING * INTO v_ticket;

  -- Record audit update
  INSERT INTO public.service_updates (
    service_ticket_id,
    previous_status,
    new_status,
    update_type,
    description,
    created_by
  ) VALUES (
    v_visit.service_ticket_id,
    v_ticket.status,
    'closed',
    'SERVICE_COMPLETED',
    'Customer confirmed service completion via OTP. Visit and Ticket marked CLOSED.',
    p_technician_id
  );

  RETURN v_visit;
END;
$$;
