-- =============================================================================
-- ZUVO TV CRM — PHASE 7.5
-- DEFECTIVE CORE RETURN, FIELD UNIT SWAP & RMA REVERSE LOGISTICS
-- File: 20261017150000_phase_7_5_defective_core_rma_reverse_logistics.sql
-- =============================================================================

-- 1. Table: technician_defective_cores
-- Tracks defective components or replaced TV units physically in technician custody
CREATE TABLE IF NOT EXISTS public.technician_defective_cores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    core_tag_number TEXT UNIQUE NOT NULL,
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    service_ticket_id UUID REFERENCES public.service_tickets(id) ON DELETE SET NULL,
    service_visit_id UUID REFERENCES public.service_visits(id) ON DELETE SET NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('SPARE_PART_CORE', 'WHOLE_TV_UNIT')),
    spare_part_id UUID REFERENCES public.spare_parts(id) ON DELETE SET NULL,
    product_unit_id UUID REFERENCES public.product_units(id) ON DELETE SET NULL,
    serial_number TEXT,
    barcode TEXT,
    defect_symptom TEXT NOT NULL,
    custody_status TEXT NOT NULL DEFAULT 'IN_TECHNICIAN_CUSTODY' CHECK (
        custody_status IN (
            'IN_TECHNICIAN_CUSTODY',
            'MANIFESTED_FOR_RETURN',
            'RECEIVED_AT_DEPOT',
            'QUARANTINE_INSPECTION',
            'APPROVED_FOR_REFURB',
            'SCRAPPED',
            'SETTLED_CORE_CREDIT'
        )
    ),
    harvested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    quarantine_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    quarantine_notes TEXT,
    core_credit_amount NUMERIC NOT NULL DEFAULT 0 CHECK (core_credit_amount >= 0),
    is_warranty_covered BOOLEAN NOT NULL DEFAULT true,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tech_def_cores_tech ON public.technician_defective_cores(technician_id);
CREATE INDEX IF NOT EXISTS idx_tech_def_cores_status ON public.technician_defective_cores(custody_status);
CREATE INDEX IF NOT EXISTS idx_tech_def_cores_ticket ON public.technician_defective_cores(service_ticket_id);
CREATE INDEX IF NOT EXISTS idx_tech_def_cores_tag ON public.technician_defective_cores(core_tag_number);

-- 2. Table: rma_reverse_manifests
-- Manifest header for technician batch returns to central depot
CREATE TABLE IF NOT EXISTS public.rma_reverse_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_number TEXT UNIQUE NOT NULL,
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    destination_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN ('DRAFT', 'DISPATCHED', 'RECEIVED', 'RECONCILED', 'CANCELLED')
    ),
    total_items_count INT NOT NULL DEFAULT 0 CHECK (total_items_count >= 0),
    received_items_count INT NOT NULL DEFAULT 0 CHECK (received_items_count >= 0),
    discrepant_items_count INT NOT NULL DEFAULT 0 CHECK (discrepant_items_count >= 0),
    carrier_tracking_number TEXT,
    technician_notes TEXT,
    warehouse_intake_notes TEXT,
    dispatched_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    reconciled_at TIMESTAMPTZ,
    received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rma_rev_man_tech ON public.rma_reverse_manifests(technician_id);
CREATE INDEX IF NOT EXISTS idx_rma_rev_man_wh ON public.rma_reverse_manifests(destination_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_rma_rev_man_status ON public.rma_reverse_manifests(status);

-- 3. Table: rma_reverse_manifest_items
-- Manifest line items linking defective cores to the manifest
CREATE TABLE IF NOT EXISTS public.rma_reverse_manifest_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_id UUID NOT NULL REFERENCES public.rma_reverse_manifests(id) ON DELETE CASCADE,
    defective_core_id UUID NOT NULL REFERENCES public.technician_defective_cores(id) ON DELETE RESTRICT,
    item_status TEXT NOT NULL DEFAULT 'MANIFESTED' CHECK (
        item_status IN ('MANIFESTED', 'RECEIVED', 'MISSING', 'DAMAGED_IN_TRANSIT', 'REJECTED')
    ),
    received_condition TEXT,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_manifest_core UNIQUE (manifest_id, defective_core_id)
);

CREATE INDEX IF NOT EXISTS idx_rma_rev_items_man ON public.rma_reverse_manifest_items(manifest_id);
CREATE INDEX IF NOT EXISTS idx_rma_rev_items_core ON public.rma_reverse_manifest_items(defective_core_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.technician_defective_cores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rma_reverse_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rma_reverse_manifest_items ENABLE ROW LEVEL SECURITY;

-- 4.1 RLS for technician_defective_cores
DROP POLICY IF EXISTS "Management manage defective cores" ON public.technician_defective_cores;
DROP POLICY IF EXISTS "Technicians view own defective cores" ON public.technician_defective_cores;

CREATE POLICY "Management manage defective cores"
ON public.technician_defective_cores
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'service', 'inventory')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'service', 'inventory')
  )
);

CREATE POLICY "Technicians view own defective cores"
ON public.technician_defective_cores
FOR SELECT
TO authenticated
USING (
  technician_id = auth.uid()
);

-- 4.2 RLS for rma_reverse_manifests & items
DROP POLICY IF EXISTS "Management manage reverse manifests" ON public.rma_reverse_manifests;
DROP POLICY IF EXISTS "Technicians view own reverse manifests" ON public.rma_reverse_manifests;

CREATE POLICY "Management manage reverse manifests"
ON public.rma_reverse_manifests
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'service', 'inventory')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'service', 'inventory')
  )
);

CREATE POLICY "Technicians view own reverse manifests"
ON public.rma_reverse_manifests
FOR SELECT
TO authenticated
USING (
  technician_id = auth.uid()
);

DROP POLICY IF EXISTS "Management manage reverse manifest items" ON public.rma_reverse_manifest_items;
DROP POLICY IF EXISTS "Technicians view own reverse manifest items" ON public.rma_reverse_manifest_items;

CREATE POLICY "Management manage reverse manifest items"
ON public.rma_reverse_manifest_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'service', 'inventory')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'service', 'inventory')
  )
);

CREATE POLICY "Technicians view own reverse manifest items"
ON public.rma_reverse_manifest_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rma_reverse_manifests rrm
    WHERE rrm.id = manifest_id
      AND rrm.technician_id = auth.uid()
  )
);


-- =============================================================================
-- 5. ATOMIC SECURITY DEFINER RPCS FOR REVERSE LOGISTICS
-- =============================================================================

-- 5.1 Harvest Defective Core on Site
CREATE OR REPLACE FUNCTION public.fn_harvest_defective_core(
  p_ticket_id UUID,
  p_visit_id UUID,
  p_item_type TEXT, -- 'SPARE_PART_CORE' or 'WHOLE_TV_UNIT'
  p_spare_part_id UUID DEFAULT NULL,
  p_product_unit_id UUID DEFAULT NULL,
  p_defect_symptom TEXT DEFAULT 'Defective component harvested during field swap',
  p_serial_number TEXT DEFAULT NULL,
  p_barcode TEXT DEFAULT NULL,
  p_is_warranty_covered BOOLEAN DEFAULT true,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS public.technician_defective_cores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_visit public.service_visits%ROWTYPE;
  v_core public.technician_defective_cores%ROWTYPE;
  v_core_tag TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'technician') THEN
    RAISE EXCEPTION 'Access denied. Insufficient permissions to harvest defective cores.';
  END IF;

  -- Verify visit
  SELECT * INTO v_visit FROM public.service_visits WHERE id = p_visit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service visit not found.';
  END IF;

  IF v_caller_role = 'technician' AND v_visit.technician_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied. You can only log defective cores for your assigned visits.';
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_core FROM public.technician_defective_cores WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_core;
    END IF;
  END IF;

  -- Generate Tag
  v_core_tag := 'CORE-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 6));

  INSERT INTO public.technician_defective_cores (
    core_tag_number,
    technician_id,
    service_ticket_id,
    service_visit_id,
    item_type,
    spare_part_id,
    product_unit_id,
    serial_number,
    barcode,
    defect_symptom,
    custody_status,
    is_warranty_covered,
    idempotency_key
  ) VALUES (
    v_core_tag,
    v_visit.technician_id,
    p_ticket_id,
    p_visit_id,
    p_item_type,
    p_spare_part_id,
    p_product_unit_id,
    p_serial_number,
    p_barcode,
    p_defect_symptom,
    'IN_TECHNICIAN_CUSTODY',
    COALESCE(p_is_warranty_covered, true),
    p_idempotency_key
  ) RETURNING * INTO v_core;

  -- If swapping whole unit, update unit status to 'in_service' or 'damaged'
  IF p_item_type = 'WHOLE_TV_UNIT' AND p_product_unit_id IS NOT NULL THEN
    UPDATE public.product_units
    SET status = 'damaged', updated_at = now()
    WHERE id = p_product_unit_id;
  END IF;

  RETURN v_core;
END;
$$;

-- 5.2 Create RMA Reverse Manifest (Batch Return)
CREATE OR REPLACE FUNCTION public.fn_create_rma_reverse_manifest(
  p_destination_warehouse_id UUID,
  p_core_ids UUID[],
  p_technician_notes TEXT DEFAULT NULL
)
RETURNS public.rma_reverse_manifests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_manifest public.rma_reverse_manifests%ROWTYPE;
  v_manifest_no TEXT;
  v_core_id UUID;
  v_count INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'technician') THEN
    RAISE EXCEPTION 'Access denied. Insufficient permissions to create reverse logistics manifest.';
  END IF;

  IF p_core_ids IS NULL OR array_length(p_core_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Reverse manifest requires at least one defective core item.';
  END IF;

  v_manifest_no := 'RLM-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 6));
  v_count := array_length(p_core_ids, 1);

  INSERT INTO public.rma_reverse_manifests (
    manifest_number,
    technician_id,
    destination_warehouse_id,
    status,
    total_items_count,
    technician_notes,
    dispatched_at
  ) VALUES (
    v_manifest_no,
    auth.uid(),
    p_destination_warehouse_id,
    'DISPATCHED',
    v_count,
    p_technician_notes,
    now()
  ) RETURNING * INTO v_manifest;

  -- Attach items and update core status
  FOREACH v_core_id IN ARRAY p_core_ids
  LOOP
    INSERT INTO public.rma_reverse_manifest_items (
      manifest_id,
      defective_core_id,
      item_status
    ) VALUES (
      v_manifest.id,
      v_core_id,
      'MANIFESTED'
    );

    UPDATE public.technician_defective_cores
    SET
      custody_status = 'MANIFESTED_FOR_RETURN',
      quarantine_warehouse_id = p_destination_warehouse_id,
      updated_at = now()
    WHERE id = v_core_id AND technician_id = auth.uid();
  END LOOP;

  RETURN v_manifest;
END;
$$;

-- 5.3 Receive Reverse Manifest at Depot Quarantine
CREATE OR REPLACE FUNCTION public.fn_receive_rma_reverse_manifest(
  p_manifest_id UUID,
  p_received_core_ids UUID[],
  p_warehouse_intake_notes TEXT DEFAULT NULL
)
RETURNS public.rma_reverse_manifests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_manifest public.rma_reverse_manifests%ROWTYPE;
  v_rec_count INT := 0;
  v_discrepancy_count INT := 0;
  v_core_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'inventory') THEN
    RAISE EXCEPTION 'Access denied. Only warehouse or inventory staff can receive reverse manifests.';
  END IF;

  SELECT * INTO v_manifest FROM public.rma_reverse_manifests WHERE id = p_manifest_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reverse manifest not found.';
  END IF;

  v_rec_count := COALESCE(array_length(p_received_core_ids, 1), 0);
  v_discrepancy_count := v_manifest.total_items_count - v_rec_count;

  -- Mark received items
  FOREACH v_core_id IN ARRAY p_received_core_ids
  LOOP
    UPDATE public.rma_reverse_manifest_items
    SET item_status = 'RECEIVED', received_at = now()
    WHERE manifest_id = p_manifest_id AND defective_core_id = v_core_id;

    UPDATE public.technician_defective_cores
    SET
      custody_status = 'QUARANTINE_INSPECTION',
      updated_at = now()
    WHERE id = v_core_id;
  END LOOP;

  -- Mark any missing items
  UPDATE public.rma_reverse_manifest_items
  SET item_status = 'MISSING'
  WHERE manifest_id = p_manifest_id AND item_status = 'MANIFESTED';

  UPDATE public.rma_reverse_manifests
  SET
    status = CASE WHEN v_discrepancy_count = 0 THEN 'RECEIVED' ELSE 'RECONCILED' END,
    received_items_count = v_rec_count,
    discrepant_items_count = abs(v_discrepancy_count),
    warehouse_intake_notes = p_warehouse_intake_notes,
    received_at = now(),
    received_by = auth.uid(),
    updated_at = now()
  WHERE id = p_manifest_id
  RETURNING * INTO v_manifest;

  RETURN v_manifest;
END;
$$;

-- 5.4 Inspect Core and Issue Core Credit / Scrapping
CREATE OR REPLACE FUNCTION public.fn_inspect_and_settle_defective_core(
  p_core_id UUID,
  p_action TEXT, -- 'APPROVE_REFURB' or 'SCRAP'
  p_core_credit_amount NUMERIC DEFAULT 0,
  p_quarantine_notes TEXT DEFAULT NULL
)
RETURNS public.technician_defective_cores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_core public.technician_defective_cores%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'inventory') THEN
    RAISE EXCEPTION 'Access denied. Insufficient permissions to inspect and settle defective cores.';
  END IF;

  IF p_action NOT IN ('APPROVE_REFURB', 'SCRAP') THEN
    RAISE EXCEPTION 'Invalid action. Must be APPROVE_REFURB or SCRAP.';
  END IF;

  SELECT * INTO v_core FROM public.technician_defective_cores WHERE id = p_core_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Defective core not found.';
  END IF;

  UPDATE public.technician_defective_cores
  SET
    custody_status = CASE WHEN p_action = 'APPROVE_REFURB' THEN 'APPROVED_FOR_REFURB' ELSE 'SCRAPPED' END,
    core_credit_amount = COALESCE(p_core_credit_amount, 0),
    quarantine_notes = p_quarantine_notes,
    updated_at = now()
  WHERE id = p_core_id
  RETURNING * INTO v_core;

  RETURN v_core;
END;
$$;

-- 6. Permissions
REVOKE ALL ON FUNCTION public.fn_harvest_defective_core FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_harvest_defective_core TO authenticated;

REVOKE ALL ON FUNCTION public.fn_create_rma_reverse_manifest FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_rma_reverse_manifest TO authenticated;

REVOKE ALL ON FUNCTION public.fn_receive_rma_reverse_manifest FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_receive_rma_reverse_manifest TO authenticated;

REVOKE ALL ON FUNCTION public.fn_inspect_and_settle_defective_core FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_inspect_and_settle_defective_core TO authenticated;
