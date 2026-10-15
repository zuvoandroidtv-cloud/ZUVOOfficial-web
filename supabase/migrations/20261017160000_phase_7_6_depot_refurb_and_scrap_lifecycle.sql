-- =============================================================================
-- ZUVO TV CRM — PHASE 7.6
-- DEPOT QUARANTINE ENGINEERING REWORK, COMPONENT REFURBISHMENT & RESTOCK / SCRAP
-- File: 20261017160000_phase_7_6_depot_refurb_and_scrap_lifecycle.sql
-- =============================================================================

-- 1. Extend custody_status on technician_defective_cores
ALTER TABLE public.technician_defective_cores DROP CONSTRAINT IF EXISTS technician_defective_cores_custody_status_check;
ALTER TABLE public.technician_defective_cores ADD CONSTRAINT technician_defective_cores_custody_status_check CHECK (
    custody_status IN (
        'IN_TECHNICIAN_CUSTODY',
        'WITH_TECHNICIAN',
        'MANIFESTED_FOR_RETURN',
        'DISPATCHED_TO_DEPOT',
        'RECEIVED_AT_DEPOT',
        'QUARANTINE_INSPECTION',
        'APPROVED_FOR_REFURB',
        'REFURB_APPROVED',
        'IN_REWORK',
        'RESTOCKED',
        'SCRAPPED',
        'SCRAP_DISPOSED',
        'SETTLED_CORE_CREDIT',
        'DISCREPANCY_FLAGGED'
    )
);

-- 2. Table: core_refurbishment_work_orders
-- Workshop bench repair order tracking diagnostics, electrical rails, burn-in, and certification
CREATE TABLE IF NOT EXISTS public.core_refurbishment_work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_number TEXT UNIQUE NOT NULL,
    defective_core_id UUID NOT NULL REFERENCES public.technician_defective_cores(id) ON DELETE RESTRICT,
    assigned_engineer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK (
        status IN ('ASSIGNED', 'DIAGNOSING', 'PARTS_REPLACED', 'BURN_IN_TESTING', 'QA_CERTIFIED', 'FAILED_SCRAP')
    ),
    rail_12v_tested BOOLEAN NOT NULL DEFAULT false,
    rail_24v_tested BOOLEAN NOT NULL DEFAULT false,
    rail_5v_tested BOOLEAN NOT NULL DEFAULT false,
    burn_in_duration_hours NUMERIC NOT NULL DEFAULT 0 CHECK (burn_in_duration_hours >= 0),
    burn_in_passed BOOLEAN NOT NULL DEFAULT false,
    optical_panel_passed BOOLEAN NOT NULL DEFAULT false,
    audio_chassis_passed BOOLEAN NOT NULL DEFAULT false,
    diagnostics_notes TEXT,
    labor_minutes INT NOT NULL DEFAULT 0 CHECK (labor_minutes >= 0),
    certified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    certified_at TIMESTAMPTZ,
    restocked_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refurb_wo_core ON public.core_refurbishment_work_orders(defective_core_id);
CREATE INDEX IF NOT EXISTS idx_refurb_wo_eng ON public.core_refurbishment_work_orders(assigned_engineer_id);
CREATE INDEX IF NOT EXISTS idx_refurb_wo_status ON public.core_refurbishment_work_orders(status);

-- 3. Table: core_refurbishment_parts_used
-- Micro-components and sub-assemblies consumed during board rework
CREATE TABLE IF NOT EXISTS public.core_refurbishment_parts_used (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES public.core_refurbishment_work_orders(id) ON DELETE CASCADE,
    spare_part_id UUID REFERENCES public.spare_parts(id) ON DELETE RESTRICT,
    part_description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refurb_parts_wo ON public.core_refurbishment_parts_used(work_order_id);
CREATE INDEX IF NOT EXISTS idx_refurb_parts_part ON public.core_refurbishment_parts_used(spare_part_id);

-- 4. Table: core_scrap_disposition_records
-- Formal e-waste disposition manifest tracking scrap vendors, batch weights, and write-off values
CREATE TABLE IF NOT EXISTS public.core_scrap_disposition_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scrap_batch_number TEXT UNIQUE NOT NULL,
    recycler_vendor_name TEXT NOT NULL,
    authorized_cpcb_id TEXT,
    total_cores_count INT NOT NULL DEFAULT 0 CHECK (total_cores_count >= 0),
    total_weight_kg NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (total_weight_kg >= 0),
    salvage_credit_realized NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (salvage_credit_realized >= 0),
    disposition_notes TEXT,
    disposed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    disposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.core_refurbishment_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_refurbishment_parts_used ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_scrap_disposition_records ENABLE ROW LEVEL SECURITY;

-- 5.1 RLS Policies for core_refurbishment_work_orders
DROP POLICY IF EXISTS "Management view refurb work orders" ON public.core_refurbishment_work_orders;
DROP POLICY IF EXISTS "Management manage refurb work orders" ON public.core_refurbishment_work_orders;

CREATE POLICY "Management view refurb work orders"
ON public.core_refurbishment_work_orders
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
          AND r.name IN ('super_admin', 'admin', 'service', 'inventory', 'technician')
    )
);

CREATE POLICY "Management manage refurb work orders"
ON public.core_refurbishment_work_orders
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

-- 5.2 RLS Policies for core_refurbishment_parts_used
DROP POLICY IF EXISTS "Staff view refurb parts" ON public.core_refurbishment_parts_used;
DROP POLICY IF EXISTS "Staff manage refurb parts" ON public.core_refurbishment_parts_used;

CREATE POLICY "Staff view refurb parts"
ON public.core_refurbishment_parts_used
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
          AND r.name IN ('super_admin', 'admin', 'service', 'inventory')
    )
);

CREATE POLICY "Staff manage refurb parts"
ON public.core_refurbishment_parts_used
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

-- 5.3 RLS Policies for core_scrap_disposition_records
DROP POLICY IF EXISTS "Staff view scrap disposition" ON public.core_scrap_disposition_records;
DROP POLICY IF EXISTS "Staff manage scrap disposition" ON public.core_scrap_disposition_records;

CREATE POLICY "Staff view scrap disposition"
ON public.core_scrap_disposition_records
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
          AND r.name IN ('super_admin', 'admin', 'service', 'inventory')
    )
);

CREATE POLICY "Staff manage scrap disposition"
ON public.core_scrap_disposition_records
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

-- =============================================================================
-- 6. ATOMIC SECURITY DEFINER RPCS FOR REWORK & RESTOCKING
-- =============================================================================

-- 6.1 Create Refurb Work Order
CREATE OR REPLACE FUNCTION public.fn_create_refurb_work_order(
    p_core_id UUID,
    p_assigned_engineer_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS public.core_refurbishment_work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_caller_role TEXT;
    v_core public.technician_defective_cores%ROWTYPE;
    v_wo public.core_refurbishment_work_orders%ROWTYPE;
    v_wo_number TEXT;
    v_engineer_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    v_caller_role := public.get_current_user_role();
    IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'inventory') THEN
        RAISE EXCEPTION 'Access denied. Insufficient permissions to create refurbishment work orders.';
    END IF;

    SELECT * INTO v_core FROM public.technician_defective_cores WHERE id = p_core_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Defective core not found.';
    END IF;

    IF v_core.custody_status NOT IN ('APPROVED_FOR_REFURB', 'REFURB_APPROVED') THEN
        RAISE EXCEPTION 'Core must be in APPROVED_FOR_REFURB custody status to create a rework order (current: %).', v_core.custody_status;
    END IF;

    -- Default assigned engineer to caller if not provided
    v_engineer_id := COALESCE(p_assigned_engineer_id, auth.uid());

    v_wo_number := 'RWO-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 6));

    INSERT INTO public.core_refurbishment_work_orders (
        work_order_number,
        defective_core_id,
        assigned_engineer_id,
        status,
        diagnostics_notes
    ) VALUES (
        v_wo_number,
        p_core_id,
        v_engineer_id,
        'ASSIGNED',
        p_notes
    ) RETURNING * INTO v_wo;

    UPDATE public.technician_defective_cores
    SET
        custody_status = 'IN_REWORK',
        updated_at = now()
    WHERE id = p_core_id;

    RETURN v_wo;
END;
$$;

-- 6.2 Log Refurb Bench Testing & Burn-In
CREATE OR REPLACE FUNCTION public.fn_log_refurb_bench_test(
    p_work_order_id UUID,
    p_rail_12v_tested BOOLEAN,
    p_rail_24v_tested BOOLEAN,
    p_rail_5v_tested BOOLEAN,
    p_burn_in_duration_hours NUMERIC,
    p_optical_panel_passed BOOLEAN DEFAULT true,
    p_audio_chassis_passed BOOLEAN DEFAULT true,
    p_labor_minutes INT DEFAULT 45,
    p_diagnostics_notes TEXT DEFAULT NULL
)
RETURNS public.core_refurbishment_work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_caller_role TEXT;
    v_wo public.core_refurbishment_work_orders%ROWTYPE;
    v_all_rails_pass BOOLEAN;
    v_burn_in_pass BOOLEAN;
    v_next_status TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    v_caller_role := public.get_current_user_role();
    IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'inventory') THEN
        RAISE EXCEPTION 'Access denied. Insufficient permissions to log bench test results.';
    END IF;

    SELECT * INTO v_wo FROM public.core_refurbishment_work_orders WHERE id = p_work_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Refurbishment work order not found.';
    END IF;

    IF v_wo.status = 'QA_CERTIFIED' THEN
        RAISE EXCEPTION 'Cannot modify tests on an already QA_CERTIFIED work order.';
    END IF;

    v_all_rails_pass := (p_rail_12v_tested AND p_rail_24v_tested AND p_rail_5v_tested);
    v_burn_in_pass := (COALESCE(p_burn_in_duration_hours, 0) >= 1.5 AND v_all_rails_pass);

    IF v_burn_in_pass THEN
        v_next_status := 'BURN_IN_TESTING';
    ELSE
        v_next_status := 'DIAGNOSING';
    END IF;

    UPDATE public.core_refurbishment_work_orders
    SET
        rail_12v_tested = p_rail_12v_tested,
        rail_24v_tested = p_rail_24v_tested,
        rail_5v_tested = p_rail_5v_tested,
        burn_in_duration_hours = COALESCE(p_burn_in_duration_hours, 0),
        burn_in_passed = v_burn_in_pass,
        optical_panel_passed = COALESCE(p_optical_panel_passed, true),
        audio_chassis_passed = COALESCE(p_audio_chassis_passed, true),
        labor_minutes = COALESCE(p_labor_minutes, 45),
        diagnostics_notes = COALESCE(p_diagnostics_notes, diagnostics_notes),
        status = v_next_status,
        updated_at = now()
    WHERE id = p_work_order_id
    RETURNING * INTO v_wo;

    RETURN v_wo;
END;
$$;

-- 6.3 Certify Rework & Restock into Usable Warehouse Inventory
CREATE OR REPLACE FUNCTION public.fn_certify_and_restock_refurb_item(
    p_work_order_id UUID,
    p_destination_warehouse_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_caller_role TEXT;
    v_wo public.core_refurbishment_work_orders%ROWTYPE;
    v_core public.technician_defective_cores%ROWTYPE;
    v_wh_exists BOOLEAN;
    v_restocked_summary JSONB;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    v_caller_role := public.get_current_user_role();
    IF v_caller_role NOT IN ('super_admin', 'admin', 'service', 'inventory') THEN
        RAISE EXCEPTION 'Access denied. Insufficient permissions to certify and restock refurbished inventory.';
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.warehouses WHERE id = p_destination_warehouse_id) INTO v_wh_exists;
    IF NOT v_wh_exists THEN
        RAISE EXCEPTION 'Destination warehouse not found.';
    END IF;

    SELECT * INTO v_wo FROM public.core_refurbishment_work_orders WHERE id = p_work_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Refurbishment work order not found.';
    END IF;

    IF v_wo.status = 'QA_CERTIFIED' THEN
        RAISE EXCEPTION 'This work order has already been certified and restocked.';
    END IF;

    IF NOT (v_wo.rail_12v_tested AND v_wo.rail_24v_tested AND v_wo.rail_5v_tested) THEN
        RAISE EXCEPTION 'Cannot certify rework: All voltage rails (12V, 24V, 5V) must pass testing.';
    END IF;

    IF NOT v_wo.burn_in_passed THEN
        RAISE EXCEPTION 'Cannot certify rework: Unit has not completed or passed burn-in testing.';
    END IF;

    SELECT * INTO v_core FROM public.technician_defective_cores WHERE id = v_wo.defective_core_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated defective core not found.';
    END IF;

    -- Update work order
    UPDATE public.core_refurbishment_work_orders
    SET
        status = 'QA_CERTIFIED',
        certified_by = auth.uid(),
        certified_at = now(),
        restocked_warehouse_id = p_destination_warehouse_id,
        updated_at = now()
    WHERE id = p_work_order_id;

    -- Update core custody status
    UPDATE public.technician_defective_cores
    SET
        custody_status = 'RESTOCKED',
        quarantine_notes = COALESCE(quarantine_notes, '') || ' | Rework Certified and Restocked via ' || v_wo.work_order_number,
        updated_at = now()
    WHERE id = v_core.id;

    -- Restock logic based on item_type
    IF v_core.item_type = 'SPARE_PART_CORE' AND v_core.spare_part_id IS NOT NULL THEN
        -- Atomically increment warehouse stock
        INSERT INTO public.spare_part_inventory (
            spare_part_id,
            warehouse_id,
            quantity_on_hand,
            updated_at
        ) VALUES (
            v_core.spare_part_id,
            p_destination_warehouse_id,
            1,
            now()
        )
        ON CONFLICT (spare_part_id, warehouse_id) DO UPDATE
        SET
            quantity_on_hand = spare_part_inventory.quantity_on_hand + 1,
            updated_at = now();

        v_restocked_summary := jsonb_build_object(
            'item_type', 'SPARE_PART_CORE',
            'spare_part_id', v_core.spare_part_id,
            'warehouse_id', p_destination_warehouse_id,
            'quantity_added', 1,
            'work_order_number', v_wo.work_order_number
        );
    ELSIF v_core.item_type = 'WHOLE_TV_UNIT' AND v_core.product_unit_id IS NOT NULL THEN
        -- Re-certify TV unit to in_stock
        UPDATE public.product_units
        SET
            status = 'in_stock',
            warehouse_id = p_destination_warehouse_id,
            notes = COALESCE(notes, '') || ' | Certified Factory Refurbished via ' || v_wo.work_order_number,
            updated_at = now()
        WHERE id = v_core.product_unit_id;

        v_restocked_summary := jsonb_build_object(
            'item_type', 'WHOLE_TV_UNIT',
            'product_unit_id', v_core.product_unit_id,
            'warehouse_id', p_destination_warehouse_id,
            'new_status', 'in_stock',
            'work_order_number', v_wo.work_order_number
        );
    ELSE
        v_restocked_summary := jsonb_build_object(
            'item_type', v_core.item_type,
            'warehouse_id', p_destination_warehouse_id,
            'status', 'RESTOCKED_WITHOUT_SPECIFIC_LINK'
        );
    END IF;

    RETURN v_restocked_summary;
END;
$$;

-- 6.4 Batch Scrap Disposition Manifest
CREATE OR REPLACE FUNCTION public.fn_scrap_defective_cores_batch(
    p_core_ids UUID[],
    p_recycler_vendor_name TEXT,
    p_authorized_cpcb_id TEXT DEFAULT NULL,
    p_total_weight_kg NUMERIC DEFAULT 0,
    p_salvage_credit_realized NUMERIC DEFAULT 0,
    p_disposition_notes TEXT DEFAULT NULL
)
RETURNS public.core_scrap_disposition_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_caller_role TEXT;
    v_batch_record public.core_scrap_disposition_records%ROWTYPE;
    v_batch_no TEXT;
    v_count INT;
    v_core_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    v_caller_role := public.get_current_user_role();
    IF v_caller_role NOT IN ('super_admin', 'admin', 'inventory') THEN
        RAISE EXCEPTION 'Access denied. Only Inventory Managers or Admins can batch dispose scrapped cores.';
    END IF;

    IF p_core_ids IS NULL OR array_length(p_core_ids, 1) = 0 THEN
        RAISE EXCEPTION 'At least one scrapped core is required for e-waste disposition.';
    END IF;

    v_count := array_length(p_core_ids, 1);
    v_batch_no := 'SCRAP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 6));

    INSERT INTO public.core_scrap_disposition_records (
        scrap_batch_number,
        recycler_vendor_name,
        authorized_cpcb_id,
        total_cores_count,
        total_weight_kg,
        salvage_credit_realized,
        disposition_notes,
        disposed_by
    ) VALUES (
        v_batch_no,
        p_recycler_vendor_name,
        p_authorized_cpcb_id,
        v_count,
        COALESCE(p_total_weight_kg, 0),
        COALESCE(p_salvage_credit_realized, 0),
        p_disposition_notes,
        auth.uid()
    ) RETURNING * INTO v_batch_record;

    FOREACH v_core_id IN ARRAY p_core_ids
    LOOP
        UPDATE public.technician_defective_cores
        SET
            custody_status = 'SCRAP_DISPOSED',
            quarantine_notes = COALESCE(quarantine_notes, '') || ' | Disposed via batch ' || v_batch_no,
            updated_at = now()
        WHERE id = v_core_id;
    END LOOP;

    RETURN v_batch_record;
END;
$$;

-- 6.5 Backward-compatible overload for fn_inspect_and_settle_defective_core (UI adapter)
CREATE OR REPLACE FUNCTION public.fn_inspect_and_settle_defective_core(
    p_defective_core_id UUID,
    p_action TEXT,
    p_qa_passed BOOLEAN DEFAULT true,
    p_condition_grading TEXT DEFAULT 'GRADE_B',
    p_core_credit_amount NUMERIC DEFAULT 0,
    p_inspection_notes TEXT DEFAULT NULL
)
RETURNS public.technician_defective_cores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_target_action TEXT;
BEGIN
    IF p_action IN ('APPROVED_FOR_REFURB', 'APPROVE_REFURB') THEN
        v_target_action := 'APPROVE_REFURB';
    ELSE
        v_target_action := 'SCRAP';
    END IF;

    RETURN public.fn_inspect_and_settle_defective_core(
        p_core_id => p_defective_core_id,
        p_action => v_target_action,
        p_core_credit_amount => p_core_credit_amount,
        p_quarantine_notes => COALESCE(p_inspection_notes, '') || ' [Grade: ' || COALESCE(p_condition_grading, 'N/A') || ']'
    );
END;
$$;

-- 7. Grant Permissions
REVOKE ALL ON FUNCTION public.fn_create_refurb_work_order FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_refurb_work_order TO authenticated;

REVOKE ALL ON FUNCTION public.fn_log_refurb_bench_test FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_log_refurb_bench_test TO authenticated;

REVOKE ALL ON FUNCTION public.fn_certify_and_restock_refurb_item FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_certify_and_restock_refurb_item TO authenticated;

REVOKE ALL ON FUNCTION public.fn_scrap_defective_cores_batch FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_scrap_defective_cores_batch TO authenticated;
