-- =============================================================================
-- ZUVO TV CRM — PHASE 7.4
-- TECHNICIAN SPARE PARTS TRUNK STOCK & VAN INVENTORY RECONCILIATION
-- File: 20261017140000_phase_7_4_technician_trunk_stock_reconciliation.sql
-- =============================================================================

-- 1. Table: technician_trunk_inventory
-- Authoritative per-technician, per-spare-part physical balance in field van/trunk
CREATE TABLE IF NOT EXISTS public.technician_trunk_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    spare_part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE RESTRICT,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
    quantity_reserved INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
    min_trunk_threshold INTEGER NOT NULL DEFAULT 1 CHECK (min_trunk_threshold >= 0),
    last_reconciled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tech_spare_part UNIQUE (technician_id, spare_part_id)
);

CREATE INDEX IF NOT EXISTS idx_tech_trunk_inv_tech ON public.technician_trunk_inventory(technician_id);
CREATE INDEX IF NOT EXISTS idx_tech_trunk_inv_part ON public.technician_trunk_inventory(spare_part_id);

-- 2. Table: technician_trunk_movements
-- Immutable custody ledger tracking all stock changes
CREATE TABLE IF NOT EXISTS public.technician_trunk_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    spare_part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE RESTRICT,
    movement_type TEXT NOT NULL CHECK (
        movement_type IN (
            'STOCK_ISSUED',
            'STOCK_RECEIVED',
            'PART_CONSUMED',
            'PART_RETURNED',
            'PART_DAMAGED',
            'PART_LOST',
            'STOCK_ADJUSTMENT',
            'RECONCILIATION_ADJUSTMENT'
        )
    ),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    service_ticket_id UUID REFERENCES public.service_tickets(id) ON DELETE SET NULL,
    service_visit_id UUID REFERENCES public.service_visits(id) ON DELETE SET NULL,
    reconciliation_id UUID,
    reason TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tech_trunk_mov_tech ON public.technician_trunk_movements(technician_id);
CREATE INDEX IF NOT EXISTS idx_tech_trunk_mov_part ON public.technician_trunk_movements(spare_part_id);
CREATE INDEX IF NOT EXISTS idx_tech_trunk_mov_type ON public.technician_trunk_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_tech_trunk_mov_ticket ON public.technician_trunk_movements(service_ticket_id);

-- 3. Table: technician_van_reconciliations (Header)
CREATE TABLE IF NOT EXISTS public.technician_van_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_number TEXT UNIQUE NOT NULL,
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    total_items_counted INTEGER NOT NULL DEFAULT 0,
    discrepancy_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (
        status IN ('COMPLETED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')
    ),
    technician_notes TEXT,
    review_notes TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_van_reconcile_tech ON public.technician_van_reconciliations(technician_id);
CREATE INDEX IF NOT EXISTS idx_van_reconcile_status ON public.technician_van_reconciliations(status);

-- 4. Table: technician_van_reconciliation_lines (Items)
CREATE TABLE IF NOT EXISTS public.technician_van_reconciliation_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL REFERENCES public.technician_van_reconciliations(id) ON DELETE CASCADE,
    spare_part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE RESTRICT,
    system_quantity INTEGER NOT NULL CHECK (system_quantity >= 0),
    physical_count INTEGER NOT NULL CHECK (physical_count >= 0),
    variance INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_van_reconcile_lines_rec ON public.technician_van_reconciliation_lines(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_van_reconcile_lines_part ON public.technician_van_reconciliation_lines(spare_part_id);

-- Foreign key link from movements to reconciliations
ALTER TABLE public.technician_trunk_movements
ADD CONSTRAINT fk_movement_reconciliation
FOREIGN KEY (reconciliation_id) REFERENCES public.technician_van_reconciliations(id) ON DELETE SET NULL;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.technician_trunk_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_trunk_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_van_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_van_reconciliation_lines ENABLE ROW LEVEL SECURITY;

-- 5.1 RLS Policies for technician_trunk_inventory
DROP POLICY IF EXISTS "Management manage technician trunk inventory" ON public.technician_trunk_inventory;
DROP POLICY IF EXISTS "Technicians view own trunk inventory" ON public.technician_trunk_inventory;

CREATE POLICY "Management manage technician trunk inventory"
ON public.technician_trunk_inventory
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'service', 'inventory', 'support')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'service', 'inventory', 'support')
  )
);

CREATE POLICY "Technicians view own trunk inventory"
ON public.technician_trunk_inventory
FOR SELECT
TO authenticated
USING (
  technician_id = auth.uid()
);

-- 5.2 RLS Policies for technician_trunk_movements
DROP POLICY IF EXISTS "Management view all trunk movements" ON public.technician_trunk_movements;
DROP POLICY IF EXISTS "Technicians view own trunk movements" ON public.technician_trunk_movements;

CREATE POLICY "Management view all trunk movements"
ON public.technician_trunk_movements
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

CREATE POLICY "Technicians view own trunk movements"
ON public.technician_trunk_movements
FOR SELECT
TO authenticated
USING (
  technician_id = auth.uid()
);

-- 5.3 RLS Policies for technician_van_reconciliations & lines
DROP POLICY IF EXISTS "Management manage van reconciliations" ON public.technician_van_reconciliations;
DROP POLICY IF EXISTS "Technicians view and submit own van reconciliations" ON public.technician_van_reconciliations;

CREATE POLICY "Management manage van reconciliations"
ON public.technician_van_reconciliations
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

CREATE POLICY "Technicians view and submit own van reconciliations"
ON public.technician_van_reconciliations
FOR SELECT
TO authenticated
USING (
  technician_id = auth.uid()
);

DROP POLICY IF EXISTS "Management manage van reconciliation lines" ON public.technician_van_reconciliation_lines;
DROP POLICY IF EXISTS "Technicians view own van reconciliation lines" ON public.technician_van_reconciliation_lines;

CREATE POLICY "Management manage van reconciliation lines"
ON public.technician_van_reconciliation_lines
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

CREATE POLICY "Technicians view own van reconciliation lines"
ON public.technician_van_reconciliation_lines
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.technician_van_reconciliations tvr
    WHERE tvr.id = reconciliation_id
      AND tvr.technician_id = auth.uid()
  )
);


-- =============================================================================
-- 6. RPC TRANSACTIONS (ATOMIC INVENTORY MOVEMENTS)
-- =============================================================================

-- 6.1 RPC: fn_issue_spare_part_to_technician
CREATE OR REPLACE FUNCTION public.fn_issue_spare_part_to_technician(
  p_technician_id UUID,
  p_warehouse_id UUID,
  p_spare_part_id UUID,
  p_quantity INT,
  p_reason TEXT DEFAULT 'Issuance to field van',
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS public.technician_trunk_inventory
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_wh_inv public.spare_part_inventory%ROWTYPE;
  v_part public.spare_parts%ROWTYPE;
  v_trunk public.technician_trunk_inventory%ROWTYPE;
  v_bal_before INT := 0;
  v_bal_after INT := 0;
BEGIN
  -- 1. Authorization
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'inventory', 'service') THEN
    RAISE EXCEPTION 'Access denied. Only inventory or service administrators can issue stock to technicians.';
  END IF;

  -- 2. Input validation
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero.';
  END IF;

  -- 3. Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.technician_trunk_movements WHERE idempotency_key = p_idempotency_key) THEN
      SELECT * INTO v_trunk FROM public.technician_trunk_inventory
      WHERE technician_id = p_technician_id AND spare_part_id = p_spare_part_id;
      RETURN v_trunk;
    END IF;
  END IF;

  -- 4. Lock warehouse inventory
  SELECT * INTO v_wh_inv FROM public.spare_part_inventory
  WHERE spare_part_id = p_spare_part_id AND warehouse_id = p_warehouse_id
  FOR UPDATE;

  IF NOT FOUND OR v_wh_inv.quantity_on_hand < p_quantity THEN
    RAISE EXCEPTION 'Insufficient spare part stock in source warehouse.';
  END IF;

  SELECT * INTO v_part FROM public.spare_parts WHERE id = p_spare_part_id;

  -- 5. Deduct warehouse inventory
  UPDATE public.spare_part_inventory
  SET
    quantity_on_hand = quantity_on_hand - p_quantity,
    updated_at = now()
  WHERE spare_part_id = p_spare_part_id AND warehouse_id = p_warehouse_id;

  -- 6. Lock / Upsert technician trunk inventory
  SELECT * INTO v_trunk FROM public.technician_trunk_inventory
  WHERE technician_id = p_technician_id AND spare_part_id = p_spare_part_id
  FOR UPDATE;

  IF FOUND THEN
    v_bal_before := v_trunk.quantity_on_hand;
    v_bal_after := v_bal_before + p_quantity;

    UPDATE public.technician_trunk_inventory
    SET
      quantity_on_hand = v_bal_after,
      updated_at = now()
    WHERE id = v_trunk.id
    RETURNING * INTO v_trunk;
  ELSE
    v_bal_before := 0;
    v_bal_after := p_quantity;

    INSERT INTO public.technician_trunk_inventory (
      technician_id,
      spare_part_id,
      quantity_on_hand,
      updated_at
    ) VALUES (
      p_technician_id,
      p_spare_part_id,
      p_quantity,
      now()
    ) RETURNING * INTO v_trunk;
  END IF;

  -- 7. Record immutable trunk movement
  INSERT INTO public.technician_trunk_movements (
    technician_id,
    spare_part_id,
    movement_type,
    quantity,
    balance_before,
    balance_after,
    warehouse_id,
    reason,
    idempotency_key,
    performed_by
  ) VALUES (
    p_technician_id,
    p_spare_part_id,
    'STOCK_ISSUED',
    p_quantity,
    v_bal_before,
    v_bal_after,
    p_warehouse_id,
    COALESCE(p_reason, 'Stock issued from warehouse to technician field van'),
    p_idempotency_key,
    auth.uid()
  );

  RETURN v_trunk;
END;
$$;

-- 6.2 RPC: fn_consume_technician_trunk_part
CREATE OR REPLACE FUNCTION public.fn_consume_technician_trunk_part(
  p_ticket_id UUID,
  p_visit_id UUID,
  p_spare_part_id UUID,
  p_quantity INT,
  p_warranty_covered BOOLEAN DEFAULT true,
  p_technician_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS public.service_parts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_visit public.service_visits%ROWTYPE;
  v_ticket public.service_tickets%ROWTYPE;
  v_part public.spare_parts%ROWTYPE;
  v_trunk public.technician_trunk_inventory%ROWTYPE;
  v_service_part public.service_parts%ROWTYPE;
  v_bal_before INT;
  v_bal_after INT;
  v_unit_cost NUMERIC;
BEGIN
  -- 1. Authorization
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'technician') THEN
    RAISE EXCEPTION 'Access denied. Insufficient permissions to consume technician spare parts.';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Consumption quantity must be greater than zero.';
  END IF;

  -- 2. Verify visit & ticket
  SELECT * INTO v_visit FROM public.service_visits WHERE id = p_visit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service visit not found.';
  END IF;

  IF v_caller_role = 'technician' AND v_visit.technician_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied. You can only consume parts for visits assigned to you.';
  END IF;

  -- 3. Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.technician_trunk_movements WHERE idempotency_key = p_idempotency_key) THEN
      SELECT * INTO v_service_part FROM public.service_parts
      WHERE service_ticket_id = p_ticket_id AND spare_part_id = p_spare_part_id
      ORDER BY created_at DESC LIMIT 1;
      RETURN v_service_part;
    END IF;
  END IF;

  -- 4. Lock technician trunk inventory
  SELECT * INTO v_trunk FROM public.technician_trunk_inventory
  WHERE technician_id = v_visit.technician_id AND spare_part_id = p_spare_part_id
  FOR UPDATE;

  IF NOT FOUND OR v_trunk.quantity_on_hand < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock in technician trunk. Please request warehouse stock issuance.';
  END IF;

  SELECT * INTO v_part FROM public.spare_parts WHERE id = p_spare_part_id;
  v_unit_cost := COALESCE(v_part.selling_price, v_part.standard_cost, 0);

  v_bal_before := v_trunk.quantity_on_hand;
  v_bal_after := v_bal_before - p_quantity;

  -- 5. Deduct from technician trunk
  UPDATE public.technician_trunk_inventory
  SET
    quantity_on_hand = v_bal_after,
    updated_at = now()
  WHERE id = v_trunk.id;

  -- 6. Insert service part record for customer sheet & billing
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
    auth.uid(),
    auth.uid(),
    now(),
    now()
  ) RETURNING * INTO v_service_part;

  -- 7. Record immutable movement
  INSERT INTO public.technician_trunk_movements (
    technician_id,
    spare_part_id,
    movement_type,
    quantity,
    balance_before,
    balance_after,
    service_ticket_id,
    service_visit_id,
    reason,
    idempotency_key,
    performed_by
  ) VALUES (
    v_visit.technician_id,
    p_spare_part_id,
    'PART_CONSUMED',
    p_quantity,
    v_bal_before,
    v_bal_after,
    p_ticket_id,
    p_visit_id,
    COALESCE(p_technician_notes, 'Part installed during on-site field service'),
    p_idempotency_key,
    auth.uid()
  );

  RETURN v_service_part;
END;
$$;

-- 6.3 RPC: fn_return_technician_part
CREATE OR REPLACE FUNCTION public.fn_return_technician_part(
  p_technician_id UUID,
  p_warehouse_id UUID,
  p_spare_part_id UUID,
  p_quantity INT,
  p_reason TEXT DEFAULT 'Unused part returned to main stock',
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS public.technician_trunk_inventory
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_trunk public.technician_trunk_inventory%ROWTYPE;
  v_bal_before INT;
  v_bal_after INT;
BEGIN
  -- 1. Authorization
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role = 'technician' AND p_technician_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied. You can only return parts from your own assigned inventory.';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Return quantity must be greater than zero.';
  END IF;

  -- 2. Idempotency
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.technician_trunk_movements WHERE idempotency_key = p_idempotency_key) THEN
      SELECT * INTO v_trunk FROM public.technician_trunk_inventory
      WHERE technician_id = p_technician_id AND spare_part_id = p_spare_part_id;
      RETURN v_trunk;
    END IF;
  END IF;

  -- 3. Lock technician inventory
  SELECT * INTO v_trunk FROM public.technician_trunk_inventory
  WHERE technician_id = p_technician_id AND spare_part_id = p_spare_part_id
  FOR UPDATE;

  IF NOT FOUND OR v_trunk.quantity_on_hand < p_quantity THEN
    RAISE EXCEPTION 'Cannot return more parts than currently on hand in trunk.';
  END IF;

  v_bal_before := v_trunk.quantity_on_hand;
  v_bal_after := v_bal_before - p_quantity;

  -- 4. Deduct from trunk
  UPDATE public.technician_trunk_inventory
  SET
    quantity_on_hand = v_bal_after,
    updated_at = now()
  WHERE id = v_trunk.id
  RETURNING * INTO v_trunk;

  -- 5. Return to warehouse inventory
  INSERT INTO public.spare_part_inventory (
    spare_part_id,
    warehouse_id,
    quantity_on_hand,
    updated_at
  ) VALUES (
    p_spare_part_id,
    p_warehouse_id,
    p_quantity,
    now()
  )
  ON CONFLICT (spare_part_id, warehouse_id) DO UPDATE
  SET
    quantity_on_hand = spare_part_inventory.quantity_on_hand + p_quantity,
    updated_at = now();

  -- 6. Record movement
  INSERT INTO public.technician_trunk_movements (
    technician_id,
    spare_part_id,
    movement_type,
    quantity,
    balance_before,
    balance_after,
    warehouse_id,
    reason,
    idempotency_key,
    performed_by
  ) VALUES (
    p_technician_id,
    p_spare_part_id,
    'PART_RETURNED',
    p_quantity,
    v_bal_before,
    v_bal_after,
    p_warehouse_id,
    COALESCE(p_reason, 'Unused part returned from field van'),
    p_idempotency_key,
    auth.uid()
  );

  RETURN v_trunk;
END;
$$;

-- 6.4 RPC: fn_record_damaged_or_lost_part
CREATE OR REPLACE FUNCTION public.fn_record_damaged_or_lost_part(
  p_technician_id UUID,
  p_spare_part_id UUID,
  p_quantity INT,
  p_status_type TEXT, -- 'PART_DAMAGED' or 'PART_LOST'
  p_reason TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS public.technician_trunk_inventory
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_trunk public.technician_trunk_inventory%ROWTYPE;
  v_bal_before INT;
  v_bal_after INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role = 'technician' AND p_technician_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied. You can only report damaged/lost items from your own trunk.';
  END IF;

  IF p_status_type NOT IN ('PART_DAMAGED', 'PART_LOST') THEN
    RAISE EXCEPTION 'Invalid status type. Must be PART_DAMAGED or PART_LOST.';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero.';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A detailed justification reason is mandatory when reporting damaged or lost parts.';
  END IF;

  -- Lock trunk
  SELECT * INTO v_trunk FROM public.technician_trunk_inventory
  WHERE technician_id = p_technician_id AND spare_part_id = p_spare_part_id
  FOR UPDATE;

  IF NOT FOUND OR v_trunk.quantity_on_hand < p_quantity THEN
    RAISE EXCEPTION 'Reported quantity exceeds current trunk balance.';
  END IF;

  v_bal_before := v_trunk.quantity_on_hand;
  v_bal_after := v_bal_before - p_quantity;

  -- Deduct from trunk
  UPDATE public.technician_trunk_inventory
  SET
    quantity_on_hand = v_bal_after,
    updated_at = now()
  WHERE id = v_trunk.id
  RETURNING * INTO v_trunk;

  -- Record movement
  INSERT INTO public.technician_trunk_movements (
    technician_id,
    spare_part_id,
    movement_type,
    quantity,
    balance_before,
    balance_after,
    reason,
    idempotency_key,
    performed_by
  ) VALUES (
    p_technician_id,
    p_spare_part_id,
    p_status_type,
    p_quantity,
    v_bal_before,
    v_bal_after,
    p_reason,
    p_idempotency_key,
    auth.uid()
  );

  RETURN v_trunk;
END;
$$;

-- 6.5 RPC: fn_submit_van_reconciliation
CREATE OR REPLACE FUNCTION public.fn_submit_van_reconciliation(
  p_technician_id UUID,
  p_items JSONB, -- Array of { spare_part_id, physical_count, reason }
  p_technician_notes TEXT DEFAULT NULL
)
RETURNS public.technician_van_reconciliations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_rec public.technician_van_reconciliations%ROWTYPE;
  v_rec_no TEXT;
  v_item JSONB;
  v_part_id UUID;
  v_phys_count INT;
  v_reason TEXT;
  v_sys_count INT;
  v_variance INT;
  v_total_items INT := 0;
  v_discrepancies INT := 0;
  v_trunk public.technician_trunk_inventory%ROWTYPE;
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role = 'technician' AND p_technician_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied. You can only perform reconciliation for your own assigned van.';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Reconciliation requires at least one inspected spare part line item.';
  END IF;

  -- Generate unique reconciliation number
  v_rec_no := 'REC-VAN-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 6));

  -- Initial check to count discrepancies
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_part_id := (v_item->>'spare_part_id')::UUID;
    v_phys_count := (v_item->>'physical_count')::INT;

    SELECT COALESCE(quantity_on_hand, 0) INTO v_sys_count
    FROM public.technician_trunk_inventory
    WHERE technician_id = p_technician_id AND spare_part_id = v_part_id;

    v_variance := v_phys_count - COALESCE(v_sys_count, 0);
    IF v_variance != 0 THEN
      v_discrepancies := v_discrepancies + 1;
    END IF;
    v_total_items := v_total_items + 1;
  END LOOP;

  -- If zero discrepancies, auto-complete; otherwise require manager review
  v_status := CASE WHEN v_discrepancies = 0 THEN 'COMPLETED' ELSE 'PENDING_REVIEW' END;

  -- Create header
  INSERT INTO public.technician_van_reconciliations (
    reconciliation_number,
    technician_id,
    total_items_counted,
    discrepancy_count,
    status,
    technician_notes,
    submitted_at
  ) VALUES (
    v_rec_no,
    p_technician_id,
    v_total_items,
    v_discrepancies,
    v_status,
    p_technician_notes,
    now()
  ) RETURNING * INTO v_rec;

  -- Insert detail lines and update last_reconciled_at if perfect match
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_part_id := (v_item->>'spare_part_id')::UUID;
    v_phys_count := (v_item->>'physical_count')::INT;
    v_reason := v_item->>'reason';

    SELECT COALESCE(quantity_on_hand, 0) INTO v_sys_count
    FROM public.technician_trunk_inventory
    WHERE technician_id = p_technician_id AND spare_part_id = v_part_id;

    v_variance := v_phys_count - COALESCE(v_sys_count, 0);

    INSERT INTO public.technician_van_reconciliation_lines (
      reconciliation_id,
      spare_part_id,
      system_quantity,
      physical_count,
      variance,
      reason
    ) VALUES (
      v_rec.id,
      v_part_id,
      COALESCE(v_sys_count, 0),
      v_phys_count,
      v_variance,
      v_reason
    );

    IF v_variance = 0 THEN
      UPDATE public.technician_trunk_inventory
      SET last_reconciled_at = now()
      WHERE technician_id = p_technician_id AND spare_part_id = v_part_id;
    END IF;
  END LOOP;

  RETURN v_rec;
END;
$$;

-- 6.6 RPC: fn_review_van_reconciliation (Approve / Reject)
CREATE OR REPLACE FUNCTION public.fn_review_van_reconciliation(
  p_reconciliation_id UUID,
  p_action TEXT, -- 'APPROVE' or 'REJECT'
  p_review_notes TEXT DEFAULT NULL
)
RETURNS public.technician_van_reconciliations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_rec public.technician_van_reconciliations%ROWTYPE;
  v_line public.technician_van_reconciliation_lines%ROWTYPE;
  v_trunk public.technician_trunk_inventory%ROWTYPE;
  v_bal_before INT;
  v_bal_after INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'inventory') THEN
    RAISE EXCEPTION 'Access denied. Only service or inventory managers can review van reconciliations.';
  END IF;

  IF p_action NOT IN ('APPROVE', 'REJECT') THEN
    RAISE EXCEPTION 'Invalid review action. Must be APPROVE or REJECT.';
  END IF;

  -- Lock reconciliation header
  SELECT * INTO v_rec FROM public.technician_van_reconciliations
  WHERE id = p_reconciliation_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reconciliation record not found.';
  END IF;

  IF v_rec.status != 'PENDING_REVIEW' THEN
    RAISE EXCEPTION 'Only reconciliations with status PENDING_REVIEW can be approved or rejected.';
  END IF;

  -- Technicians cannot approve their own reconciliation
  IF v_rec.technician_id = auth.uid() AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Segregation of duties violation: Technicians cannot approve their own inventory discrepancies.';
  END IF;

  IF p_action = 'APPROVE' THEN
    -- Apply discrepancy adjustments
    FOR v_line IN
      SELECT * FROM public.technician_van_reconciliation_lines
      WHERE reconciliation_id = p_reconciliation_id AND variance != 0
    LOOP
      SELECT * INTO v_trunk FROM public.technician_trunk_inventory
      WHERE technician_id = v_rec.technician_id AND spare_part_id = v_line.spare_part_id
      FOR UPDATE;

      v_bal_before := COALESCE(v_trunk.quantity_on_hand, 0);
      v_bal_after := v_line.physical_count;

      IF FOUND THEN
        UPDATE public.technician_trunk_inventory
        SET
          quantity_on_hand = v_bal_after,
          last_reconciled_at = now(),
          updated_at = now()
        WHERE id = v_trunk.id;
      ELSE
        INSERT INTO public.technician_trunk_inventory (
          technician_id,
          spare_part_id,
          quantity_on_hand,
          last_reconciled_at,
          updated_at
        ) VALUES (
          v_rec.technician_id,
          v_line.spare_part_id,
          v_bal_after,
          now(),
          now()
        );
      END IF;

      -- Write adjustment ledger movement
      INSERT INTO public.technician_trunk_movements (
        technician_id,
        spare_part_id,
        movement_type,
        quantity,
        balance_before,
        balance_after,
        reconciliation_id,
        reason,
        performed_by
      ) VALUES (
        v_rec.technician_id,
        v_line.spare_part_id,
        'RECONCILIATION_ADJUSTMENT',
        abs(v_line.variance),
        v_bal_before,
        v_bal_after,
        v_rec.id,
        COALESCE(p_review_notes, 'Approved van reconciliation physical count adjustment'),
        auth.uid()
      );
    END LOOP;

    UPDATE public.technician_van_reconciliations
    SET
      status = 'APPROVED',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = p_review_notes
    WHERE id = p_reconciliation_id
    RETURNING * INTO v_rec;

  ELSE -- REJECT
    UPDATE public.technician_van_reconciliations
    SET
      status = 'REJECTED',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = p_review_notes
    WHERE id = p_reconciliation_id
    RETURNING * INTO v_rec;
  END IF;

  RETURN v_rec;
END;
$$;

-- 7. Grant / Revoke Permissions
REVOKE EXECUTE ON FUNCTION public.fn_issue_spare_part_to_technician(UUID, UUID, UUID, INT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_issue_spare_part_to_technician(UUID, UUID, UUID, INT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_consume_technician_trunk_part(UUID, UUID, UUID, INT, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_consume_technician_trunk_part(UUID, UUID, UUID, INT, BOOLEAN, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_return_technician_part(UUID, UUID, UUID, INT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_return_technician_part(UUID, UUID, UUID, INT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_record_damaged_or_lost_part(UUID, UUID, INT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_record_damaged_or_lost_part(UUID, UUID, INT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_submit_van_reconciliation(UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_submit_van_reconciliation(UUID, JSONB, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_review_van_reconciliation(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_review_van_reconciliation(UUID, TEXT, TEXT) TO authenticated;
