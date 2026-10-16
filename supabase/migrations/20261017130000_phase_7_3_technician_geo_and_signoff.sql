-- =============================================================================
-- ZUVO TV CRM — PHASE 7.3
-- FIELD SERVICE TECHNICIAN GEO-LOCATION AUDIT & DIGITAL SIGN-OFF GLASS
-- File: 20261017130000_phase_7_3_technician_geo_and_signoff.sql
-- =============================================================================

-- 1. Table: service_visit_locations
-- Captures discrete ARRIVAL and DEPARTURE event locations
CREATE TABLE IF NOT EXISTS public.service_visit_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_visit_id UUID NOT NULL REFERENCES public.service_visits(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    event_type TEXT NOT NULL CHECK (event_type IN ('ARRIVAL', 'DEPARTURE', 'CHECK_IN', 'DIAGNOSIS_START')),
    latitude NUMERIC,
    longitude NUMERIC,
    accuracy NUMERIC,
    is_gps_available BOOLEAN NOT NULL DEFAULT true,
    gps_error_reason TEXT,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_locations_visit_id ON public.service_visit_locations(service_visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_locations_tech_id ON public.service_visit_locations(technician_id);
CREATE INDEX IF NOT EXISTS idx_visit_locations_event_type ON public.service_visit_locations(event_type);

-- 2. Extend service_visits table if columns missing
ALTER TABLE public.service_visits
ADD COLUMN IF NOT EXISTS customer_signature_data TEXT,
ADD COLUMN IF NOT EXISTS departure_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS departure_longitude NUMERIC,
ADD COLUMN IF NOT EXISTS departed_at TIMESTAMPTZ;

-- 3. Enable RLS on service_visit_locations
ALTER TABLE public.service_visit_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view all visit locations" ON public.service_visit_locations;
DROP POLICY IF EXISTS "Technicians can insert locations for assigned visits" ON public.service_visit_locations;
DROP POLICY IF EXISTS "Technicians can view locations for assigned visits" ON public.service_visit_locations;

-- Managers / Admin policy
CREATE POLICY "Managers can view all visit locations"
ON public.service_visit_locations
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

-- Technicians policy: can only view own visit locations
CREATE POLICY "Technicians can view locations for assigned visits"
ON public.service_visit_locations
FOR SELECT
TO authenticated
USING (
  technician_id = auth.uid()
);

-- Technicians policy: can insert location only if assigned to that visit
CREATE POLICY "Technicians can insert locations for assigned visits"
ON public.service_visit_locations
FOR INSERT
TO authenticated
WITH CHECK (
  technician_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.service_visits sv
    WHERE sv.id = service_visit_id
      AND sv.technician_id = auth.uid()
  )
);

-- 4. RPC: fn_record_visit_location
-- Validates technician assignment, logs location, and updates visit record coordinates
CREATE OR REPLACE FUNCTION public.fn_record_visit_location(
  p_visit_id UUID,
  p_event_type TEXT,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_accuracy NUMERIC DEFAULT NULL,
  p_is_gps_available BOOLEAN DEFAULT true,
  p_gps_error_reason TEXT DEFAULT NULL
)
RETURNS public.service_visit_locations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_visit public.service_visits%ROWTYPE;
  v_caller_role TEXT;
  v_loc public.service_visit_locations%ROWTYPE;
BEGIN
  -- 1. Authentication check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to record visit location.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'technician') THEN
    RAISE EXCEPTION 'Access denied. Insufficient permissions to record visit location.';
  END IF;

  -- 2. Validate visit exists with row lock
  SELECT * INTO v_visit FROM public.service_visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service visit not found.';
  END IF;

  -- 3. Enforce technician tenancy: only assigned technician (or admin) can submit
  IF v_caller_role = 'technician' AND v_visit.technician_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied. You can only record location events for visits assigned to you.';
  END IF;

  -- 4. Validate event type
  IF p_event_type NOT IN ('ARRIVAL', 'DEPARTURE', 'CHECK_IN', 'DIAGNOSIS_START') THEN
    RAISE EXCEPTION 'Invalid location event type.';
  END IF;

  -- 5. Insert location record
  INSERT INTO public.service_visit_locations (
    service_visit_id,
    technician_id,
    event_type,
    latitude,
    longitude,
    accuracy,
    is_gps_available,
    gps_error_reason,
    captured_at
  ) VALUES (
    p_visit_id,
    v_visit.technician_id,
    p_event_type,
    p_latitude,
    p_longitude,
    p_accuracy,
    COALESCE(p_is_gps_available, true),
    p_gps_error_reason,
    now()
  ) RETURNING * INTO v_loc;

  -- 6. Update coordinates directly on service_visits for quick lookup
  IF p_event_type = 'ARRIVAL' THEN
    UPDATE public.service_visits
    SET
      latitude = COALESCE(p_latitude, latitude),
      longitude = COALESCE(p_longitude, longitude),
      arrived_at = COALESCE(arrived_at, now()),
      updated_at = now()
    WHERE id = p_visit_id;
  ELSIF p_event_type = 'DEPARTURE' THEN
    UPDATE public.service_visits
    SET
      departure_latitude = p_latitude,
      departure_longitude = p_longitude,
      departed_at = now(),
      updated_at = now()
    WHERE id = p_visit_id;
  END IF;

  RETURN v_loc;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_record_visit_location(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_record_visit_location(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, TEXT) TO authenticated;

-- 5. RPC: fn_submit_visit_customer_signature
-- Binds customer digital signature data securely to service visit
CREATE OR REPLACE FUNCTION public.fn_submit_visit_customer_signature(
  p_visit_id UUID,
  p_signature_data TEXT
)
RETURNS public.service_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_visit public.service_visits%ROWTYPE;
  v_caller_role TEXT;
BEGIN
  -- 1. Authentication check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit customer signature.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'technician') THEN
    RAISE EXCEPTION 'Access denied. Insufficient permissions to record customer signature.';
  END IF;

  -- 2. Validate signature presence
  IF p_signature_data IS NULL OR length(trim(p_signature_data)) < 100 THEN
    RAISE EXCEPTION 'Invalid or empty customer signature.';
  END IF;

  -- 3. Validate visit exists with row lock
  SELECT * INTO v_visit FROM public.service_visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service visit not found.';
  END IF;

  -- 4. Tenancy check
  IF v_caller_role = 'technician' AND v_visit.technician_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied. You can only submit customer signature for visits assigned to you.';
  END IF;

  -- 5. Update visit record with customer signature
  UPDATE public.service_visits
  SET
    customer_signature_data = p_signature_data,
    updated_at = now()
  WHERE id = p_visit_id
  RETURNING * INTO v_visit;

  -- 6. Audit update
  INSERT INTO public.service_updates (
    service_ticket_id,
    previous_status,
    new_status,
    update_type,
    description,
    created_by
  ) VALUES (
    v_visit.service_ticket_id,
    v_visit.status,
    v_visit.status,
    'CUSTOMER_SIGNATURE_CAPTURED',
    'Customer digital signature captured on technician glass display.',
    auth.uid()
  );

  RETURN v_visit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_submit_visit_customer_signature(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_submit_visit_customer_signature(UUID, TEXT) TO authenticated;
