-- =============================================================================
-- ZUVO TV CRM — PHASE 7.9 MASTER DATABASE MIGRATION
-- Technician Real-Time Geo-Breadcrumbs, Travel Economics, Territory Optimization & Customer ETA
-- Filename: 20261017190000_phase_7_9_geo_tracking_travel_territory_eta.sql
-- =============================================================================

-- Enable uuid-ossp if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. TABLE: technician_geo_breadcrumbs
-- Granular, privacy-protected GPS breadcrumb stream for mobile field technicians
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.technician_geo_breadcrumbs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_uuid UUID NOT NULL, -- Client-generated idempotency key
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    service_visit_id UUID NULL REFERENCES public.service_visits(id) ON DELETE SET NULL,
    service_ticket_id UUID NULL REFERENCES public.service_tickets(id) ON DELETE SET NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    accuracy NUMERIC(8, 2) NOT NULL, -- In meters
    speed NUMERIC(6, 2) NULL, -- In m/s
    heading NUMERIC(6, 2) NULL, -- Degrees (0 - 360)
    altitude NUMERIC(8, 2) NULL, -- In meters
    battery_level NUMERIC(4, 1) NULL, -- Percentage (0 - 100)
    is_charging BOOLEAN NOT NULL DEFAULT false,
    network_status TEXT NOT NULL DEFAULT 'online' CHECK (network_status IN ('online', 'reconnected_sync')),
    captured_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tech_breadcrumb_client_uuid UNIQUE (client_uuid),
    CONSTRAINT chk_breadcrumb_latitude CHECK (latitude >= -90.0 AND latitude <= 90.0),
    CONSTRAINT chk_breadcrumb_longitude CHECK (longitude >= -180.0 AND longitude <= 180.0),
    CONSTRAINT chk_breadcrumb_accuracy CHECK (accuracy >= 0.0 AND accuracy <= 5000.0)
);

CREATE INDEX IF NOT EXISTS idx_tech_breadcrumbs_tech_captured 
    ON public.technician_geo_breadcrumbs(technician_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_tech_breadcrumbs_visit_id 
    ON public.technician_geo_breadcrumbs(service_visit_id) WHERE service_visit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tech_breadcrumbs_ticket_id 
    ON public.technician_geo_breadcrumbs(service_ticket_id) WHERE service_ticket_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. TABLE: service_territories
-- Geographic regions / operational territories for dispatch & geofencing
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_territories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    territory_code TEXT UNIQUE NOT NULL, -- e.g. 'TERR-MUM-CENTRAL'
    territory_name TEXT NOT NULL, -- e.g. 'Mumbai Central District'
    region_type TEXT NOT NULL DEFAULT 'METRO' CHECK (region_type IN ('METRO', 'URBAN', 'SUBURBAN', 'RURAL')),
    center_latitude NUMERIC(10, 7) NOT NULL,
    center_longitude NUMERIC(10, 7) NOT NULL,
    radius_km NUMERIC(6, 2) NOT NULL DEFAULT 15.00,
    pincodes TEXT[] NOT NULL DEFAULT '{}',
    out_of_territory_policy TEXT NOT NULL DEFAULT 'REQUIRE_APPROVAL' 
        CHECK (out_of_territory_policy IN ('ALLOW', 'WARN', 'REQUIRE_APPROVAL', 'BLOCK')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_territories_active ON public.service_territories(is_active);

-- -----------------------------------------------------------------------------
-- 3. TABLE: technician_territory_assignments
-- Mapping technicians to primary/secondary operational territories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.technician_territory_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    territory_id UUID NOT NULL REFERENCES public.service_territories(id) ON DELETE CASCADE,
    assignment_type TEXT NOT NULL DEFAULT 'PRIMARY' CHECK (assignment_type IN ('PRIMARY', 'SECONDARY', 'BACKUP')),
    priority INT NOT NULL DEFAULT 1,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tech_territory_assignment UNIQUE (technician_id, territory_id)
);

CREATE INDEX IF NOT EXISTS idx_tech_territory_tech_id ON public.technician_territory_assignments(technician_id);
CREATE INDEX IF NOT EXISTS idx_tech_territory_territory_id ON public.technician_territory_assignments(territory_id);

-- -----------------------------------------------------------------------------
-- 4. TABLE: service_route_segments
-- Logical trip segments connecting technician base, customer visits, and depot
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_route_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    service_visit_id UUID NULL REFERENCES public.service_visits(id) ON DELETE SET NULL,
    segment_type TEXT NOT NULL CHECK (segment_type IN (
        'TECHNICIAN_BASE_TO_VISIT',
        'VISIT_TO_VISIT',
        'VISIT_TO_DEPOT',
        'DEPOT_TO_BASE',
        'RETURN_TO_BASE'
    )),
    start_latitude NUMERIC(10, 7) NOT NULL,
    start_longitude NUMERIC(10, 7) NOT NULL,
    end_latitude NUMERIC(10, 7) NULL,
    end_longitude NUMERIC(10, 7) NULL,
    distance_km NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    travel_duration_minutes INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_segments_tech_visit ON public.service_route_segments(technician_id, service_visit_id);

-- -----------------------------------------------------------------------------
-- 5. TABLE: technician_travel_policies
-- Configurable organizational policy for travel allowance (TA/DA) and per-km fuel
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.technician_travel_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_code TEXT UNIQUE NOT NULL, -- e.g. 'POL-TRAVEL-TWO-WHEELER'
    policy_name TEXT NOT NULL,
    vehicle_type TEXT NOT NULL DEFAULT 'TWO_WHEELER' CHECK (vehicle_type IN ('TWO_WHEELER', 'FOUR_WHEELER', 'PUBLIC_TRANSIT')),
    rate_per_km NUMERIC(6, 2) NOT NULL DEFAULT 4.50, -- in INR per km
    daily_allowance_amount NUMERIC(8, 2) NOT NULL DEFAULT 250.00, -- Base daily allowance
    min_visits_for_daily_allowance INT NOT NULL DEFAULT 2, -- Min completed visits to unlock full DA
    max_daily_reimbursement_cap NUMERIC(8, 2) NOT NULL DEFAULT 1500.00, -- Maximum cap per day
    is_active BOOLEAN NOT NULL DEFAULT true,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 6. TABLE: technician_travel_claims
-- Daily travel reimbursement claims submitted by technicians or auto-calculated
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.technician_travel_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_number TEXT UNIQUE NOT NULL, -- e.g. 'TRV-20261017-0001'
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    travel_policy_id UUID NOT NULL REFERENCES public.technician_travel_policies(id) ON DELETE RESTRICT,
    claim_date DATE NOT NULL,
    total_distance_km NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    eligible_km NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    per_km_amount NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    daily_allowance_amount NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    total_claim_amount NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    approved_amount NUMERIC(8, 2) NULL,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN (
        'CALCULATED',
        'SUBMITTED',
        'MANAGER_REVIEW',
        'APPROVED',
        'REJECTED',
        'SETTLED'
    )),
    settlement_reference TEXT NULL, -- e.g. 'PAY-EXP-20261017-0045'
    rejection_reason TEXT NULL,
    reviewed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    idempotency_key TEXT UNIQUE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tech_claim_date UNIQUE (technician_id, claim_date)
);

CREATE INDEX IF NOT EXISTS idx_travel_claims_tech_date ON public.technician_travel_claims(technician_id, claim_date DESC);
CREATE INDEX IF NOT EXISTS idx_travel_claims_status ON public.technician_travel_claims(status);

-- -----------------------------------------------------------------------------
-- 7. TABLE: technician_eta_events
-- Privacy-safe customer ETA events (no raw lat/long exposure to public)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.technician_eta_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_visit_id UUID NOT NULL REFERENCES public.service_visits(id) ON DELETE CASCADE,
    service_ticket_id UUID NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
    eta_status TEXT NOT NULL CHECK (eta_status IN (
        'TECHNICIAN_ASSIGNED',
        'EN_ROUTE',
        'ESTIMATED_WINDOW',
        'DELAYED',
        'ARRIVED',
        'COMPLETED'
    )),
    estimated_arrival_window_start TIMESTAMPTZ NULL,
    estimated_arrival_window_end TIMESTAMPTZ NULL,
    estimated_minutes_remaining INT NULL,
    delay_reason TEXT NULL,
    distance_remaining_km NUMERIC(6, 2) NULL,
    is_gps_stale BOOLEAN NOT NULL DEFAULT false,
    published_to_customer_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eta_events_visit_id ON public.technician_eta_events(service_visit_id);
CREATE INDEX IF NOT EXISTS idx_eta_events_ticket_id ON public.technician_eta_events(service_ticket_id);

-- -----------------------------------------------------------------------------
-- 8. EXTEND service_tickets & service_visits
-- -----------------------------------------------------------------------------
ALTER TABLE public.service_tickets
ADD COLUMN IF NOT EXISTS territory_id UUID NULL REFERENCES public.service_territories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_out_of_territory BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS out_of_territory_approved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.service_visits
ADD COLUMN IF NOT EXISTS current_eta_minutes INT NULL,
ADD COLUMN IF NOT EXISTS eta_status TEXT NOT NULL DEFAULT 'TECHNICIAN_ASSIGNED';

-- -----------------------------------------------------------------------------
-- 9. DEFAULT SEEDS FOR TRAVEL POLICIES & TERRITORIES
-- -----------------------------------------------------------------------------
INSERT INTO public.technician_travel_policies (
    id, policy_code, policy_name, vehicle_type, rate_per_km, daily_allowance_amount, min_visits_for_daily_allowance, max_daily_reimbursement_cap
) VALUES 
(
    '00000000-0000-0000-0000-000000000071',
    'POL-TRAVEL-2W-METRO',
    'Metro Two-Wheeler Field Executive Policy',
    'TWO_WHEELER',
    4.50,
    250.00,
    2,
    1500.00
),
(
    '00000000-0000-0000-0000-000000000072',
    'POL-TRAVEL-4W-SUBURBAN',
    'Suburban Four-Wheeler Service Van Policy',
    'FOUR_WHEELER',
    9.50,
    400.00,
    3,
    3000.00
)
ON CONFLICT (policy_code) DO NOTHING;

INSERT INTO public.service_territories (
    id, territory_code, territory_name, region_type, center_latitude, center_longitude, radius_km, pincodes, out_of_territory_policy
) VALUES 
(
    '00000000-0000-0000-0000-000000000081',
    'TERR-MUM-CENTRAL',
    'Mumbai Central & South Hub',
    'METRO',
    18.9690,
    72.8210,
    15.00,
    ARRAY['400001', '400002', '400004', '400007', '400008', '400011', '400012', '400013', '400014', '400018'],
    'REQUIRE_APPROVAL'
),
(
    '00000000-0000-0000-0000-000000000082',
    'TERR-MUM-SUBURB-NORTH',
    'Mumbai North & Thane Suburbs',
    'SUBURBAN',
    19.2183,
    72.9781,
    25.00,
    ARRAY['400068', '400092', '400097', '400101', '400601', '400602', '400604', '400607'],
    'WARN'
)
ON CONFLICT (territory_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.technician_geo_breadcrumbs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_territory_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_route_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_travel_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_travel_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_eta_events ENABLE ROW LEVEL SECURITY;

-- Deny Anonymous on everything
REVOKE ALL ON public.technician_geo_breadcrumbs FROM anon;
REVOKE ALL ON public.service_territories FROM anon;
REVOKE ALL ON public.technician_territory_assignments FROM anon;
REVOKE ALL ON public.service_route_segments FROM anon;
REVOKE ALL ON public.technician_travel_policies FROM anon;
REVOKE ALL ON public.technician_travel_claims FROM anon;
REVOKE ALL ON public.technician_eta_events FROM anon;

-- Staff Policy: Managers and Admins
CREATE POLICY "Staff have full access to geo breadcrumbs"
ON public.technician_geo_breadcrumbs FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'service', 'support')
  )
);

CREATE POLICY "Technicians can insert their own breadcrumbs"
ON public.technician_geo_breadcrumbs FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = technician_id
);

CREATE POLICY "Technicians can view only their own breadcrumbs"
ON public.technician_geo_breadcrumbs FOR SELECT TO authenticated
USING (
  auth.uid() = technician_id
);

-- Territory Policies
CREATE POLICY "Staff have full access to territories"
ON public.service_territories FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'service', 'support', 'technician')
  )
);

CREATE POLICY "Staff have full access to territory assignments"
ON public.technician_territory_assignments FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'service', 'support', 'technician')
  )
);

-- Route Segments Policy
CREATE POLICY "Staff can view route segments"
ON public.service_route_segments FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'service', 'support')
  ) OR auth.uid() = technician_id
);

-- Travel Policies Policy
CREATE POLICY "Authenticated users can view active travel policies"
ON public.technician_travel_policies FOR SELECT TO authenticated
USING (is_active = true);

-- Travel Claims Policy
CREATE POLICY "Staff can view and manage all travel claims"
ON public.technician_travel_claims FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'service')
  )
);

CREATE POLICY "Technicians can view their own travel claims"
ON public.technician_travel_claims FOR SELECT TO authenticated
USING (auth.uid() = technician_id);

CREATE POLICY "Technicians can submit their own travel claims"
ON public.technician_travel_claims FOR INSERT TO authenticated
WITH CHECK (auth.uid() = technician_id);

-- Customer ETA Events Policy
CREATE POLICY "Staff can manage ETA events"
ON public.technician_eta_events FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'service', 'support', 'technician')
  )
);

-- -----------------------------------------------------------------------------
-- 11. RPC: fn_record_technician_geo_breadcrumb
-- Transactional insert of verified technician GPS coordinates with idempotency
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_record_technician_geo_breadcrumb(
    p_client_uuid UUID,
    p_technician_id UUID,
    p_service_visit_id UUID DEFAULT NULL,
    p_latitude NUMERIC DEFAULT NULL,
    p_longitude NUMERIC DEFAULT NULL,
    p_accuracy NUMERIC DEFAULT NULL,
    p_speed NUMERIC DEFAULT NULL,
    p_heading NUMERIC DEFAULT NULL,
    p_altitude NUMERIC DEFAULT NULL,
    p_battery_level NUMERIC DEFAULT NULL,
    p_is_charging BOOLEAN DEFAULT false,
    p_captured_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_ticket_id UUID;
    v_breadcrumb_id UUID;
BEGIN
    v_caller_id := auth.uid();
    
    -- Validate caller role
    SELECT r.name INTO v_caller_role
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = v_caller_id;

    IF v_caller_role IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required to submit GPS breadcrumbs.';
    END IF;

    -- Ensure technician can only submit their own location unless admin
    IF v_caller_role = 'technician' AND v_caller_id != p_technician_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Technicians cannot log locations for other staff members.';
    END IF;

    -- Check coordinate validity
    IF p_latitude IS NULL OR p_longitude IS NULL OR 
       p_latitude < -90.0 OR p_latitude > 90.0 OR 
       p_longitude < -180.0 OR p_longitude > 180.0 THEN
        RAISE EXCEPTION 'INVALID_COORDINATES: Latitude must be [-90, 90] and Longitude [-180, 180].';
    END IF;

    -- Accuracy sanity check
    IF p_accuracy IS NULL OR p_accuracy < 0.0 OR p_accuracy > 5000.0 THEN
        RAISE EXCEPTION 'INVALID_ACCURACY: GPS accuracy must be between 0 and 5000 meters.';
    END IF;

    -- Fetch linked service ticket if visit provided
    IF p_service_visit_id IS NOT NULL THEN
        SELECT service_ticket_id INTO v_ticket_id
        FROM public.service_visits
        WHERE id = p_service_visit_id;
    END IF;

    -- Idempotent insert: return existing record if client_uuid already stored
    SELECT id INTO v_breadcrumb_id
    FROM public.technician_geo_breadcrumbs
    WHERE client_uuid = p_client_uuid;

    IF v_breadcrumb_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'is_duplicate', true,
            'breadcrumb_id', v_breadcrumb_id,
            'message', 'Breadcrumb already recorded (idempotent replay)'
        );
    END IF;

    INSERT INTO public.technician_geo_breadcrumbs (
        client_uuid,
        technician_id,
        service_visit_id,
        service_ticket_id,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        altitude,
        battery_level,
        is_charging,
        network_status,
        captured_at
    ) VALUES (
        p_client_uuid,
        p_technician_id,
        p_service_visit_id,
        v_ticket_id,
        p_latitude,
        p_longitude,
        p_accuracy,
        p_speed,
        p_heading,
        p_altitude,
        p_battery_level,
        p_is_charging,
        'online',
        p_captured_at
    )
    RETURNING id INTO v_breadcrumb_id;

    RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', false,
        'breadcrumb_id', v_breadcrumb_id,
        'captured_at', p_captured_at
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 12. RPC: fn_calculate_daily_travel_claim
-- Server-side authoritative calculation of daily distance and travel allowance
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_calculate_daily_travel_claim(
    p_technician_id UUID,
    p_claim_date DATE DEFAULT CURRENT_DATE,
    p_policy_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_policy public.technician_travel_policies%ROWTYPE;
    v_total_distance NUMERIC(8, 2) := 0.00;
    v_prev_lat NUMERIC;
    v_prev_lon NUMERIC;
    v_curr_lat NUMERIC;
    v_curr_lon NUMERIC;
    v_dlat NUMERIC;
    v_dlon NUMERIC;
    v_a NUMERIC;
    v_c NUMERIC;
    v_d NUMERIC;
    v_completed_visits INT := 0;
    v_da_amount NUMERIC(8, 2) := 0.00;
    v_per_km_amount NUMERIC(8, 2) := 0.00;
    v_total_claim NUMERIC(8, 2) := 0.00;
    v_claim_id UUID;
    v_claim_number TEXT;
    r RECORD;
BEGIN
    -- Select policy
    IF p_policy_id IS NOT NULL THEN
        SELECT * INTO v_policy FROM public.technician_travel_policies WHERE id = p_policy_id AND is_active = true;
    ELSE
        SELECT * INTO v_policy FROM public.technician_travel_policies WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
    END IF;

    IF v_policy.id IS NULL THEN
        RAISE EXCEPTION 'POLICY_NOT_FOUND: Active travel reimbursement policy required.';
    END IF;

    -- Count completed visits for technician on given date
    SELECT COUNT(*) INTO v_completed_visits
    FROM public.service_visits sv
    WHERE sv.technician_id = p_technician_id
      AND DATE(sv.completed_at) = p_claim_date
      AND sv.status = 'completed';

    -- Authoritative server-side haversine distance over captured breadcrumbs for this date
    v_prev_lat := NULL;
    v_prev_lon := NULL;

    FOR r IN (
        SELECT latitude, longitude
        FROM public.technician_geo_breadcrumbs
        WHERE technician_id = p_technician_id
          AND DATE(captured_at) = p_claim_date
        ORDER BY captured_at ASC
    ) LOOP
        v_curr_lat := r.latitude;
        v_curr_lon := r.longitude;

        IF v_prev_lat IS NOT NULL AND v_prev_lon IS NOT NULL THEN
            -- Approximate haversine distance in KM
            v_dlat := radians(v_curr_lat - v_prev_lat);
            v_dlon := radians(v_curr_lon - v_prev_lon);
            v_a := sin(v_dlat/2)^2 + cos(radians(v_prev_lat)) * cos(radians(v_curr_lat)) * sin(v_dlon/2)^2;
            v_c := 2 * asin(sqrt(v_a));
            v_d := 6371.0 * v_c; -- Earth radius in KM

            -- Filter out noise (>50 meters, <200 km per single hop)
            IF v_d >= 0.05 AND v_d <= 200.0 THEN
                v_total_distance := v_total_distance + v_d;
            END IF;
        END IF;

        v_prev_lat := v_curr_lat;
        v_prev_lon := v_curr_lon;
    END LOOP;

    -- Check if daily allowance unlocked
    IF v_completed_visits >= v_policy.min_visits_for_daily_allowance THEN
        v_da_amount := v_policy.daily_allowance_amount;
    ELSE
        v_da_amount := 0.00;
    END IF;

    -- Calculate per-km reimbursement
    v_per_km_amount := ROUND((v_total_distance * v_policy.rate_per_km), 2);
    v_total_claim := v_per_km_amount + v_da_amount;

    -- Apply maximum reimbursement cap
    IF v_total_claim > v_policy.max_daily_reimbursement_cap THEN
        v_total_claim := v_policy.max_daily_reimbursement_cap;
    END IF;

    -- Upsert claim record
    v_claim_number := 'TRV-' || to_char(p_claim_date, 'YYYYMMDD') || '-' || substring(p_technician_id::text from 1 for 4);

    INSERT INTO public.technician_travel_claims (
        claim_number,
        technician_id,
        travel_policy_id,
        claim_date,
        total_distance_km,
        eligible_km,
        per_km_amount,
        daily_allowance_amount,
        total_claim_amount,
        status,
        updated_at
    ) VALUES (
        v_claim_number,
        p_technician_id,
        v_policy.id,
        p_claim_date,
        v_total_distance,
        v_total_distance,
        v_per_km_amount,
        v_da_amount,
        v_total_claim,
        'CALCULATED',
        now()
    )
    ON CONFLICT (technician_id, claim_date) DO UPDATE SET
        total_distance_km = EXCLUDED.total_distance_km,
        eligible_km = EXCLUDED.eligible_km,
        per_km_amount = EXCLUDED.per_km_amount,
        daily_allowance_amount = EXCLUDED.daily_allowance_amount,
        total_claim_amount = EXCLUDED.total_claim_amount,
        updated_at = now()
    RETURNING id INTO v_claim_id;

    RETURN jsonb_build_object(
        'success', true,
        'claim_id', v_claim_id,
        'claim_number', v_claim_number,
        'claim_date', p_claim_date,
        'total_distance_km', v_total_distance,
        'completed_visits', v_completed_visits,
        'per_km_amount', v_per_km_amount,
        'daily_allowance_amount', v_da_amount,
        'total_claim_amount', v_total_claim,
        'status', 'CALCULATED'
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 13. RPC: fn_adjudicate_travel_claim
-- Manager approval, rejection, or settlement of travel claims
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_adjudicate_travel_claim(
    p_claim_id UUID,
    p_action TEXT, -- 'APPROVE', 'REJECT', 'SETTLE'
    p_approved_amount NUMERIC DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL,
    p_settlement_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_claim public.technician_travel_claims%ROWTYPE;
    v_target_status TEXT;
    v_target_amount NUMERIC;
BEGIN
    v_caller_id := auth.uid();
    
    SELECT r.name INTO v_caller_role
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = v_caller_id;

    IF v_caller_role NOT IN ('super_admin', 'admin', 'service') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Only managers and administrators can adjudicate travel claims.';
    END IF;

    SELECT * INTO v_claim FROM public.technician_travel_claims WHERE id = p_claim_id;
    IF v_claim.id IS NULL THEN
        RAISE EXCEPTION 'CLAIM_NOT_FOUND: Travel claim % does not exist.', p_claim_id;
    END IF;

    IF p_action = 'APPROVE' THEN
        v_target_status := 'APPROVED';
        v_target_amount := COALESCE(p_approved_amount, v_claim.total_claim_amount);
        
        UPDATE public.technician_travel_claims SET
            status = v_target_status,
            approved_amount = v_target_amount,
            reviewed_by = v_caller_id,
            reviewed_at = now(),
            updated_at = now()
        WHERE id = p_claim_id;

    ELSIF p_action = 'REJECT' THEN
        IF p_rejection_reason IS NULL OR trim(p_rejection_reason) = '' THEN
            RAISE EXCEPTION 'REASON_REQUIRED: Rejection requires a descriptive explanation.';
        END IF;

        v_target_status := 'REJECTED';
        UPDATE public.technician_travel_claims SET
            status = v_target_status,
            rejection_reason = p_rejection_reason,
            reviewed_by = v_caller_id,
            reviewed_at = now(),
            updated_at = now()
        WHERE id = p_claim_id;

    ELSIF p_action = 'SETTLE' THEN
        IF v_claim.status != 'APPROVED' THEN
            RAISE EXCEPTION 'INVALID_TRANSITION: Claim must be APPROVED before it can be SETTLED.';
        END IF;

        v_target_status := 'SETTLED';
        UPDATE public.technician_travel_claims SET
            status = v_target_status,
            settlement_reference = COALESCE(p_settlement_reference, 'PAY-EXP-' || to_char(now(), 'YYYYMMDD-HH24MI')),
            updated_at = now()
        WHERE id = p_claim_id;
    ELSE
        RAISE EXCEPTION 'INVALID_ACTION: Action must be APPROVE, REJECT, or SETTLE.';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'claim_id', p_claim_id,
        'new_status', v_target_status,
        'approved_amount', v_target_amount,
        'settlement_reference', p_settlement_reference
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 14. RPC: fn_publish_customer_eta
-- Calculates proximity-based customer ETA without exposing raw GPS coordinates
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_publish_customer_eta(
    p_service_visit_id UUID,
    p_eta_status TEXT, -- 'TECHNICIAN_ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'DELAYED', 'COMPLETED'
    p_estimated_minutes INT DEFAULT NULL,
    p_delay_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_visit public.service_visits%ROWTYPE;
    v_window_start TIMESTAMPTZ;
    v_window_end TIMESTAMPTZ;
    v_event_id UUID;
BEGIN
    SELECT * INTO v_visit FROM public.service_visits WHERE id = p_service_visit_id;
    IF v_visit.id IS NULL THEN
        RAISE EXCEPTION 'VISIT_NOT_FOUND: Service visit % does not exist.', p_service_visit_id;
    END IF;

    IF p_estimated_minutes IS NOT NULL THEN
        v_window_start := now() + ((p_estimated_minutes - 10) * INTERVAL '1 minute');
        v_window_end := now() + ((p_estimated_minutes + 15) * INTERVAL '1 minute');
    ELSE
        v_window_start := NULL;
        v_window_end := NULL;
    END IF;

    INSERT INTO public.technician_eta_events (
        service_visit_id,
        service_ticket_id,
        eta_status,
        estimated_arrival_window_start,
        estimated_arrival_window_end,
        estimated_minutes_remaining,
        delay_reason,
        is_gps_stale,
        published_to_customer_at
    ) VALUES (
        p_service_visit_id,
        v_visit.service_ticket_id,
        p_eta_status,
        v_window_start,
        v_window_end,
        p_estimated_minutes,
        p_delay_reason,
        false,
        now()
    )
    RETURNING id INTO v_event_id;

    -- Update parent service visit
    UPDATE public.service_visits SET
        current_eta_minutes = p_estimated_minutes,
        eta_status = p_eta_status
    WHERE id = p_service_visit_id;

    RETURN jsonb_build_object(
        'success', true,
        'event_id', v_event_id,
        'visit_id', p_service_visit_id,
        'eta_status', p_eta_status,
        'estimated_minutes', p_estimated_minutes,
        'window_start', v_window_start,
        'window_end', v_window_end
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 15. RPC: fn_evaluate_service_ticket_territory
-- Evaluates customer pincode/coordinates against technician territory assignments
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_evaluate_service_ticket_territory(
    p_ticket_id UUID,
    p_technician_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer_pincode TEXT;
    v_matched_territory_id UUID;
    v_territory_policy TEXT := 'ALLOW';
    v_is_assigned_to_territory BOOLEAN := false;
    v_is_out_of_territory BOOLEAN := false;
BEGIN
    -- Get customer pincode from ticket
    SELECT c.postal_code INTO v_customer_pincode
    FROM public.service_tickets st
    JOIN public.customers c ON st.customer_id = c.id
    WHERE st.id = p_ticket_id;

    -- Match territory by customer pincode
    IF v_customer_pincode IS NOT NULL THEN
        SELECT id, out_of_territory_policy INTO v_matched_territory_id, v_territory_policy
        FROM public.service_territories
        WHERE v_customer_pincode = ANY(pincodes) AND is_active = true
        LIMIT 1;
    END IF;

    -- Fallback to default territory if unmatched
    IF v_matched_territory_id IS NULL THEN
        SELECT id, out_of_territory_policy INTO v_matched_territory_id, v_territory_policy
        FROM public.service_territories
        WHERE is_active = true
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    -- Check if technician is assigned to this territory
    SELECT EXISTS (
        SELECT 1 FROM public.technician_territory_assignments
        WHERE technician_id = p_technician_id 
          AND territory_id = v_matched_territory_id
          AND is_active = true
    ) INTO v_is_assigned_to_territory;

    IF NOT v_is_assigned_to_territory THEN
        v_is_out_of_territory := true;
    ELSE
        v_is_out_of_territory := false;
    END IF;

    -- Update ticket territory fields
    UPDATE public.service_tickets SET
        territory_id = v_matched_territory_id,
        is_out_of_territory = v_is_out_of_territory
    WHERE id = p_ticket_id;

    RETURN jsonb_build_object(
        'success', true,
        'ticket_id', p_ticket_id,
        'territory_id', v_matched_territory_id,
        'is_out_of_territory', v_is_out_of_territory,
        'out_of_territory_policy', v_territory_policy
    );
END;
$$;
