-- =============================================================================
-- ZUVO TV CRM — PHASE 7.2
-- AUTOMATED REORDER POINTS, REPLENISHMENT PO & QA INSPECTION
-- File: 20261017120000_phase_7_2_reorder_points_and_qa_inspection.sql
-- =============================================================================

-- 1. Table: inventory_reorder_policies
-- Configurable safety stock, minimum threshold, and default replenishment quantity
-- per Product Variant and Warehouse facility.
CREATE TABLE IF NOT EXISTS public.inventory_reorder_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    reorder_point INT NOT NULL DEFAULT 5 CHECK (reorder_point >= 0),
    safety_stock_level INT NOT NULL DEFAULT 2 CHECK (safety_stock_level >= 0),
    replenishment_quantity INT NOT NULL DEFAULT 10 CHECK (replenishment_quantity > 0),
    preferred_vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    is_auto_reorder_enabled BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_wh_variant_reorder UNIQUE (warehouse_id, product_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_reorder_policies_wh ON public.inventory_reorder_policies(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_reorder_policies_variant ON public.inventory_reorder_policies(product_variant_id);

-- 2. Table: factory_intake_inspections
-- Multi-stage intake QA for factory lots & shipments
CREATE TABLE IF NOT EXISTS public.factory_intake_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_number TEXT UNIQUE NOT NULL,
    purchase_receipt_id UUID REFERENCES public.purchase_receipts(id) ON DELETE SET NULL,
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
    batch_lot_number TEXT NOT NULL,
    total_batch_quantity INT NOT NULL CHECK (total_batch_quantity > 0),
    sample_size INT NOT NULL CHECK (sample_size > 0 AND sample_size <= total_batch_quantity),
    passed_quantity INT NOT NULL DEFAULT 0 CHECK (passed_quantity >= 0),
    rejected_quantity INT NOT NULL DEFAULT 0 CHECK (rejected_quantity >= 0),
    quarantine_quantity INT NOT NULL DEFAULT 0 CHECK (quarantine_quantity >= 0),
    inspection_stage TEXT NOT NULL DEFAULT 'initial_dock' CHECK (
        inspection_stage IN (
            'initial_dock',
            'optical_inspection',
            'power_on_test',
            'burn_in_chamber',
            'packaging_audit',
            'final_acceptance'
        )
    ),
    inspection_verdict TEXT NOT NULL DEFAULT 'pending' CHECK (
        inspection_verdict IN ('pending', 'passed', 'rejected', 'quarantine', 'conditional_pass')
    ),
    visual_display_check BOOLEAN NOT NULL DEFAULT false,
    audio_chassis_check BOOLEAN NOT NULL DEFAULT false,
    remote_accessories_check BOOLEAN NOT NULL DEFAULT false,
    panel_dead_pixels_count INT NOT NULL DEFAULT 0 CHECK (panel_dead_pixels_count >= 0),
    inspector_notes TEXT,
    inspected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    inspected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_inspection_wh ON public.factory_intake_inspections(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_intake_inspection_vendor ON public.factory_intake_inspections(vendor_id);
CREATE INDEX IF NOT EXISTS idx_intake_inspection_verdict ON public.factory_intake_inspections(inspection_verdict);

-- 3. Table: vendor_debit_memos
-- Supplier debit memos generated when batch inspections or QA intake fails
CREATE TABLE IF NOT EXISTS public.vendor_debit_memos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debit_memo_number TEXT UNIQUE NOT NULL,
    inspection_id UUID REFERENCES public.factory_intake_inspections(id) ON DELETE SET NULL,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    debit_amount NUMERIC(12, 2) NOT NULL CHECK (debit_amount >= 0),
    tax_reversed NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_reversed >= 0),
    total_debit_amount NUMERIC(12, 2) NOT NULL CHECK (total_debit_amount >= 0),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'acknowledged', 'settled', 'cancelled')),
    issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debit_memos_vendor ON public.vendor_debit_memos(vendor_id);
CREATE INDEX IF NOT EXISTS idx_debit_memos_po ON public.vendor_debit_memos(purchase_order_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.inventory_reorder_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_intake_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_debit_memos ENABLE ROW LEVEL SECURITY;

-- Staff Read Policies
CREATE POLICY "Staff read reorder policies"
    ON public.inventory_reorder_policies FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service', 'sales'));

CREATE POLICY "Staff read factory inspections"
    ON public.factory_intake_inspections FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service'));

CREATE POLICY "Staff read vendor debit memos"
    ON public.vendor_debit_memos FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

-- Inventory / Admin Write Policies
CREATE POLICY "Inventory staff manage reorder policies"
    ON public.inventory_reorder_policies FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Inventory staff manage factory inspections"
    ON public.factory_intake_inspections FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Inventory staff manage vendor debit memos"
    ON public.vendor_debit_memos FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

REVOKE ALL ON TABLE public.inventory_reorder_policies FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.factory_intake_inspections FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.vendor_debit_memos FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_reorder_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.factory_intake_inspections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vendor_debit_memos TO authenticated;

-- 5. RPC: fn_evaluate_inventory_reorder_points
-- Evaluates live warehouse stock against configured reorder thresholds and returns replenishment recommendations.
CREATE OR REPLACE FUNCTION public.fn_evaluate_inventory_reorder_points(
    p_warehouse_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_results JSONB;
BEGIN
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'inventory') THEN
        RAISE EXCEPTION 'Unauthorized: Only inventory staff and administrators can evaluate stock reorder thresholds.';
    END IF;

    WITH current_stock AS (
        SELECT 
            pu.warehouse_id,
            pu.variant_id,
            COUNT(*) FILTER (WHERE pu.status = 'in_stock') as in_stock_count,
            COUNT(*) FILTER (WHERE pu.status = 'in_transit') as in_transit_count
        FROM public.product_units pu
        WHERE pu.status IN ('in_stock', 'in_transit')
        GROUP BY pu.warehouse_id, pu.variant_id
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'warehouse_id', w.id,
            'warehouse_code', w.warehouse_code,
            'warehouse_name', w.warehouse_name,
            'product_variant_id', pv.id,
            'product_name', pv.product_name,
            'product_code', pv.product_code,
            'in_stock_count', COALESCE(cs.in_stock_count, 0),
            'in_transit_count', COALESCE(cs.in_transit_count, 0),
            'effective_stock', COALESCE(cs.in_stock_count, 0) + COALESCE(cs.in_transit_count, 0),
            'reorder_point', COALESCE(irp.reorder_point, 5),
            'safety_stock_level', COALESCE(irp.safety_stock_level, 2),
            'suggested_reorder_qty', COALESCE(irp.replenishment_quantity, 10),
            'preferred_vendor_id', irp.preferred_vendor_id,
            'preferred_vendor_name', v.display_name,
            'is_below_reorder', (COALESCE(cs.in_stock_count, 0) + COALESCE(cs.in_transit_count, 0)) <= COALESCE(irp.reorder_point, 5),
            'is_critical_shortage', COALESCE(cs.in_stock_count, 0) <= COALESCE(irp.safety_stock_level, 2)
        )
    ) INTO v_results
    FROM public.warehouses w
    CROSS JOIN public.product_variants pv
    LEFT JOIN public.inventory_reorder_policies irp 
        ON irp.warehouse_id = w.id AND irp.product_variant_id = pv.id
    LEFT JOIN current_stock cs 
        ON cs.warehouse_id = w.id AND cs.variant_id = pv.id
    LEFT JOIN public.vendors v 
        ON v.id = irp.preferred_vendor_id
    WHERE w.is_active = true 
      AND pv.is_active = true
      AND (p_warehouse_id IS NULL OR w.id = p_warehouse_id);

    RETURN COALESCE(v_results, '[]'::jsonb);
END;
$$;

-- 6. RPC: fn_auto_generate_replenishment_po
-- Atomically generates a draft Purchase Order based on low stock evaluation
CREATE OR REPLACE FUNCTION public.fn_auto_generate_replenishment_po(
    p_warehouse_id UUID,
    p_vendor_id UUID,
    p_variant_id UUID,
    p_order_quantity INT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_actor_id UUID;
    v_pv RECORD;
    v_po_num TEXT;
    v_po_id UUID;
    v_qty INT;
    v_unit_cost NUMERIC;
    v_tax_rate NUMERIC := 18.00;
    v_tax_amt NUMERIC;
    v_line_total NUMERIC;
    v_policy RECORD;
BEGIN
    v_role := public.get_current_user_role();
    v_actor_id := auth.uid();

    IF v_role NOT IN ('super_admin', 'admin', 'inventory') THEN
        RAISE EXCEPTION 'Unauthorized: Only inventory staff can auto-generate replenishment purchase orders.';
    END IF;

    -- Lookup variant
    SELECT * INTO v_pv FROM public.product_variants WHERE id = p_variant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product variant not found.';
    END IF;

    -- Determine quantity from policy if not passed
    IF p_order_quantity IS NOT NULL AND p_order_quantity > 0 THEN
        v_qty := p_order_quantity;
    ELSE
        SELECT * INTO v_policy 
        FROM public.inventory_reorder_policies 
        WHERE warehouse_id = p_warehouse_id AND product_variant_id = p_variant_id;
        
        IF FOUND AND v_policy.replenishment_quantity > 0 THEN
            v_qty := v_policy.replenishment_quantity;
        ELSE
            v_qty := 10;
        END IF;
    END IF;

    v_unit_cost := COALESCE(v_pv.base_price * 0.70, 15000.00);
    v_tax_amt := round((v_qty * v_unit_cost * (v_tax_rate / 100.00)), 2);
    v_line_total := round((v_qty * v_unit_cost) + v_tax_amt, 2);

    -- Generate PO Number
    v_po_num := 'PO-REPLENISH-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 4));

    -- Insert PO Header
    INSERT INTO public.purchase_orders (
        po_number,
        vendor_id,
        warehouse_id,
        po_date,
        expected_delivery_date,
        status,
        currency,
        subtotal,
        tax_amount,
        total_amount,
        notes,
        created_by
    ) VALUES (
        v_po_num,
        p_vendor_id,
        p_warehouse_id,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '7 days',
        'draft',
        'INR',
        round(v_qty * v_unit_cost, 2),
        v_tax_amt,
        v_line_total,
        COALESCE(p_notes, 'Automated replenishment purchase order triggered by reorder point threshold'),
        v_actor_id
    ) RETURNING id INTO v_po_id;

    -- Insert PO Item
    INSERT INTO public.purchase_order_items (
        purchase_order_id,
        product_variant_id,
        ordered_quantity,
        received_quantity,
        unit_cost,
        tax_rate,
        tax_amount,
        line_total,
        notes
    ) VALUES (
        v_po_id,
        p_variant_id,
        v_qty,
        0,
        v_unit_cost,
        v_tax_rate,
        v_tax_amt,
        v_line_total,
        'Automated safety stock replenishment'
    );

    -- Update last_triggered_at on policy if exists
    UPDATE public.inventory_reorder_policies
    SET last_triggered_at = now()
    WHERE warehouse_id = p_warehouse_id AND product_variant_id = p_variant_id;

    RETURN jsonb_build_object(
        'success', true,
        'po_id', v_po_id,
        'po_number', v_po_num,
        'ordered_quantity', v_qty,
        'total_amount', v_line_total
    );
END;
$$;

-- 7. RPC: fn_record_factory_intake_inspection
-- Records factory intake QA inspection verdict and generates debit memo on rejected lots
CREATE OR REPLACE FUNCTION public.fn_record_factory_intake_inspection(
    p_warehouse_id UUID,
    p_vendor_id UUID,
    p_batch_lot_number TEXT,
    p_total_batch_quantity INT,
    p_sample_size INT,
    p_passed_quantity INT,
    p_rejected_quantity INT,
    p_quarantine_quantity INT,
    p_inspection_stage TEXT,
    p_inspection_verdict TEXT,
    p_visual_display_check BOOLEAN,
    p_audio_chassis_check BOOLEAN,
    p_remote_accessories_check BOOLEAN,
    p_panel_dead_pixels_count INT DEFAULT 0,
    p_purchase_order_id UUID DEFAULT NULL,
    p_inspector_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_insp_id UUID;
    v_insp_num TEXT;
    v_debit_memo_num TEXT;
    v_debit_id UUID;
    v_debit_amt NUMERIC(12, 2) := 0.00;
BEGIN
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'inventory') THEN
        RAISE EXCEPTION 'Unauthorized: Only inventory staff can record factory intake inspections.';
    END IF;

    IF p_passed_quantity + p_rejected_quantity + p_quarantine_quantity > p_sample_size THEN
        RAISE EXCEPTION 'Sum of inspection tallies (% + % + %) cannot exceed sample size (%).',
            p_passed_quantity, p_rejected_quantity, p_quarantine_quantity, p_sample_size;
    END IF;

    v_insp_num := 'QA-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6));

    INSERT INTO public.factory_intake_inspections (
        inspection_number,
        warehouse_id,
        vendor_id,
        purchase_order_id,
        batch_lot_number,
        total_batch_quantity,
        sample_size,
        passed_quantity,
        rejected_quantity,
        quarantine_quantity,
        inspection_stage,
        inspection_verdict,
        visual_display_check,
        audio_chassis_check,
        remote_accessories_check,
        panel_dead_pixels_count,
        inspector_notes,
        inspected_by,
        inspected_at
    ) VALUES (
        v_insp_num,
        p_warehouse_id,
        p_vendor_id,
        p_purchase_order_id,
        trim(p_batch_lot_number),
        p_total_batch_quantity,
        p_sample_size,
        p_passed_quantity,
        p_rejected_quantity,
        p_quarantine_quantity,
        p_inspection_stage,
        p_inspection_verdict,
        p_visual_display_check,
        p_audio_chassis_check,
        p_remote_accessories_check,
        p_panel_dead_pixels_count,
        p_inspector_notes,
        auth.uid(),
        now()
    ) RETURNING id INTO v_insp_id;

    -- Automatically generate vendor debit memo if inspection failed with rejected units
    IF p_inspection_verdict = 'rejected' AND p_rejected_quantity > 0 THEN
        v_debit_amt := round(p_rejected_quantity * 12500.00, 2);
        v_debit_memo_num := 'DM-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6));

        INSERT INTO public.vendor_debit_memos (
            debit_memo_number,
            inspection_id,
            vendor_id,
            purchase_order_id,
            debit_amount,
            tax_reversed,
            total_debit_amount,
            reason,
            status,
            issued_by
        ) VALUES (
            v_debit_memo_num,
            v_insp_id,
            p_vendor_id,
            p_purchase_order_id,
            v_debit_amt,
            round(v_debit_amt * 0.18, 2),
            round(v_debit_amt * 1.18, 2),
            'QA Intake Batch Failure: ' || p_rejected_quantity || ' units rejected during ' || p_inspection_stage,
            'issued',
            auth.uid()
        ) RETURNING id INTO v_debit_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'inspection_id', v_insp_id,
        'inspection_number', v_insp_num,
        'verdict', p_inspection_verdict,
        'debit_memo_number', v_debit_memo_num,
        'debit_memo_id', v_debit_id
    );
END;
$$;

-- 8. Explicit RPC execution security boundaries
REVOKE EXECUTE ON FUNCTION public.fn_evaluate_inventory_reorder_points FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_auto_generate_replenishment_po FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_record_factory_intake_inspection FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_evaluate_inventory_reorder_points TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_auto_generate_replenishment_po TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_record_factory_intake_inspection TO authenticated;
