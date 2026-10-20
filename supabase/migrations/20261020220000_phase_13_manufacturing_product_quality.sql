-- =============================================================================
-- ZUVO TV CRM — PHASE 13 MASTER DATABASE MIGRATION
-- Enterprise Manufacturing, Product Lifecycle & Quality Intelligence
-- Filename: 20261020220000_phase_13_manufacturing_product_quality.sql
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. EXTEND PRODUCT_VARIANTS FOR ENTERPRISE PRODUCT & MODEL LIFECYCLE
-- =============================================================================

DO $$
BEGIN
    -- Product Family (e.g., OLED Master, 4K Google TV, Smart Series)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'product_family'
    ) THEN
        ALTER TABLE public.product_variants ADD COLUMN product_family TEXT NOT NULL DEFAULT '4K Google TV';
    END IF;

    -- Screen resolution (4K UHD, Full HD, HD Ready)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'resolution'
    ) THEN
        ALTER TABLE public.product_variants ADD COLUMN resolution TEXT NOT NULL DEFAULT '4K UHD (3840x2160)';
    END IF;

    -- Panel display technology (DLED, QLED, OLED, Mini-LED)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'panel_type'
    ) THEN
        ALTER TABLE public.product_variants ADD COLUMN panel_type TEXT NOT NULL DEFAULT 'DLED IPS';
    END IF;

    -- Operating system platform (Google TV Android 14, Android TV 11)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'os_platform'
    ) THEN
        ALTER TABLE public.product_variants ADD COLUMN os_platform TEXT NOT NULL DEFAULT 'Google TV (Android 14)';
    END IF;

    -- Generation code (GEN-1, GEN-2, GEN-3)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'product_generation'
    ) THEN
        ALTER TABLE public.product_variants ADD COLUMN product_generation TEXT NOT NULL DEFAULT 'GEN-2';
    END IF;

    -- Lifecycle State: DRAFT -> ENGINEERING -> PILOT -> ACTIVE -> SUSPENDED -> END_OF_LIFE
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'lifecycle_status'
    ) THEN
        ALTER TABLE public.product_variants ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (lifecycle_status IN ('DRAFT', 'ENGINEERING', 'PILOT', 'ACTIVE', 'SUSPENDED', 'END_OF_LIFE'));
    END IF;

    -- Launch Date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'launch_date'
    ) THEN
        ALTER TABLE public.product_variants ADD COLUMN launch_date DATE DEFAULT CURRENT_DATE;
    END IF;

    -- End-of-life Date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'eol_date'
    ) THEN
        ALTER TABLE public.product_variants ADD COLUMN eol_date DATE NULL;
    END IF;

    -- Successor / Replacement Model Reference
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'successor_variant_id'
    ) THEN
        ALTER TABLE public.product_variants ADD COLUMN successor_variant_id UUID NULL REFERENCES public.product_variants(id) ON DELETE SET NULL;
    END IF;

    -- Standard factory manufacturing cost
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'standard_manufacturing_cost'
    ) THEN
        ALTER TABLE public.product_variants ADD COLUMN standard_manufacturing_cost NUMERIC(15, 2) NOT NULL DEFAULT 16500.00;
    END IF;

    -- Standard warranty duration months (e.g. 24 or 36)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'standard_warranty_months'
    ) THEN
        ALTER TABLE public.product_variants ADD COLUMN standard_warranty_months INTEGER NOT NULL DEFAULT 24;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_variants_lifecycle ON public.product_variants(lifecycle_status);

-- =============================================================================
-- 2. SEQUENCES FOR ECO, SERIAL GENEALOGY & QUALITY INSPECTIONS
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS public.seq_eco_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_mfg_inspection_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_ncr_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_recall_campaign_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 3. TABLE: ENGINEERING CHANGE ORDERS (ECO / ECM Governance)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mfg_engineering_change_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    eco_number TEXT NOT NULL UNIQUE,
    product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    change_reason TEXT NOT NULL,
    from_bom_id UUID REFERENCES public.bill_of_materials(id) ON DELETE RESTRICT,
    to_bom_id UUID REFERENCES public.bill_of_materials(id) ON DELETE RESTRICT,
    risk_classification TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (risk_classification IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    approved_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'IMPLEMENTED', 'CANCELLED')),
    implementation_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_eco_maker_checker CHECK (status != 'APPROVED' OR approved_by != requested_by)
);

CREATE INDEX IF NOT EXISTS idx_mfg_eco_variant ON public.mfg_engineering_change_orders(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_mfg_eco_status ON public.mfg_engineering_change_orders(status);

-- =============================================================================
-- 4. TABLE: WIP STAGES & STATION BOTTLENECK TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mfg_wip_stage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    work_order_id UUID NOT NULL REFERENCES public.production_work_orders(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL CHECK (stage_name IN (
        'SMT_PCBA_FEED',
        'CHASSIS_MECHANICAL_ASSEMBLY',
        'OPEN_CELL_PANEL_MOUNT',
        'MAINBOARD_SMPS_INTEGRATION',
        'BURN_IN_STRESS_CHAMBER',
        'OPTICAL_CALIBRATION_WHITE_BALANCE',
        'FINAL_QA_SAFETY_HI_POT',
        'PACKAGING_BARCODE_SEAL'
    )),
    workstation_id TEXT NOT NULL,
    quantity_in INTEGER NOT NULL CHECK (quantity_in >= 0),
    quantity_completed INTEGER NOT NULL DEFAULT 0 CHECK (quantity_completed >= 0),
    quantity_rejected INTEGER NOT NULL DEFAULT 0 CHECK (quantity_rejected >= 0),
    quantity_reworked INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reworked >= 0),
    operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    bottleneck_detected BOOLEAN NOT NULL DEFAULT false,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfg_wip_wo ON public.mfg_wip_stage_tracking(work_order_id);
CREATE INDEX IF NOT EXISTS idx_mfg_wip_stage ON public.mfg_wip_stage_tracking(stage_name);

-- =============================================================================
-- 5. TABLE: TELEVISION SERIAL GENEALOGY (Deep Component & Lot Traceability)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mfg_tv_genealogy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    tv_serial_number TEXT NOT NULL,
    tv_unit_id UUID REFERENCES public.product_units(id) ON DELETE SET NULL,
    work_order_id UUID NOT NULL REFERENCES public.production_work_orders(id) ON DELETE RESTRICT,
    bom_id UUID NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE RESTRICT,
    assembly_line TEXT NOT NULL DEFAULT 'LINE_1',
    component_category TEXT NOT NULL CHECK (component_category IN (
        'PANEL', 'MOTHERBOARD', 'POWER_SUPPLY', 'BACKLIGHT_LED', 'T_CON_BOARD', 'SPEAKERS', 'WIFI_BLUETOOTH_MODULE', 'CHASSIS'
    )),
    component_part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE RESTRICT,
    component_part_code TEXT NOT NULL,
    component_serial_number TEXT,
    component_batch_lot TEXT NOT NULL,
    supplier_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    assembled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tv_comp_serial UNIQUE (tv_serial_number, component_category)
);

CREATE INDEX IF NOT EXISTS idx_tv_genealogy_serial ON public.mfg_tv_genealogy(tv_serial_number);
CREATE INDEX IF NOT EXISTS idx_tv_genealogy_lot ON public.mfg_tv_genealogy(component_batch_lot);
CREATE INDEX IF NOT EXISTS idx_tv_genealogy_comp_part ON public.mfg_tv_genealogy(component_part_id);
CREATE INDEX IF NOT EXISTS idx_tv_genealogy_supplier ON public.mfg_tv_genealogy(supplier_id);

-- =============================================================================
-- 6. TABLE: ENTERPRISE QUALITY INSPECTIONS (Incoming, In-Process, Final, Pre-Dispatch)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mfg_quality_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    inspection_number TEXT NOT NULL UNIQUE,
    inspection_type TEXT NOT NULL CHECK (inspection_type IN (
        'INCOMING_SUPPLIER_QC',
        'IN_PROCESS_WIP_QC',
        'FINAL_FINISHED_GOODS_QC',
        'PRE_DISPATCH_AUDIT',
        'SUPPLIER_FACTORY_AUDIT'
    )),
    work_order_id UUID REFERENCES public.production_work_orders(id) ON DELETE SET NULL,
    tv_serial_number TEXT,
    component_batch_lot TEXT,
    supplier_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    sample_size INTEGER NOT NULL CHECK (sample_size > 0),
    defects_found INTEGER NOT NULL DEFAULT 0 CHECK (defects_found >= 0),
    verdict TEXT NOT NULL CHECK (verdict IN (
        'PASS', 'FAIL', 'CONDITIONAL_PASS', 'REWORK_REQUIRED', 'QUARANTINE'
    )),
    defect_classification TEXT CHECK (defect_classification IN (
        'OPTICAL_PANEL_BLEED',
        'DEAD_PIXELS',
        'SMPS_VOLTAGE_DRIFT',
        'HI_POT_LEAKAGE',
        'COLD_SOLDER_CRACK',
        'FRAME_WARPAGE',
        'AUDIO_DISTORTION',
        'FIRMWARE_CRASH',
        'COSMETIC_BLEMISH'
    )),
    inspector_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    calibration_equipment_id UUID REFERENCES public.fixed_assets(id) ON DELETE SET NULL,
    remarks TEXT,
    inspected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfg_qc_type ON public.mfg_quality_inspections(inspection_type);
CREATE INDEX IF NOT EXISTS idx_mfg_qc_verdict ON public.mfg_quality_inspections(verdict);
CREATE INDEX IF NOT EXISTS idx_mfg_qc_serial ON public.mfg_quality_inspections(tv_serial_number);
CREATE INDEX IF NOT EXISTS idx_mfg_qc_batch ON public.mfg_quality_inspections(component_batch_lot);

-- =============================================================================
-- 7. TABLE: NON-CONFORMANCE REPORTS (NCR), REWORK & DISPOSITION
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mfg_non_conformance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    ncr_number TEXT NOT NULL UNIQUE,
    work_order_id UUID REFERENCES public.production_work_orders(id) ON DELETE SET NULL,
    tv_serial_number TEXT,
    component_part_id UUID REFERENCES public.spare_parts(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    defect_code TEXT NOT NULL,
    root_cause_analysis TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('MINOR', 'MAJOR', 'CRITICAL')),
    containment_action TEXT NOT NULL,
    corrective_action TEXT NOT NULL,
    preventive_action TEXT NOT NULL,
    disposition TEXT NOT NULL CHECK (disposition IN (
        'REWORK', 'RETEST', 'RELEASE', 'SCRAP', 'RETURN_TO_SUPPLIER', 'QUARANTINE'
    )),
    rework_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    scrap_loss_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    responsible_dept TEXT NOT NULL DEFAULT 'MANUFACTURING',
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'UNDER_REVIEW', 'CLOSED', 'CANCELLED')),
    raised_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ncr_severity ON public.mfg_non_conformance_reports(severity);
CREATE INDEX IF NOT EXISTS idx_ncr_status ON public.mfg_non_conformance_reports(status);
CREATE INDEX IF NOT EXISTS idx_ncr_serial ON public.mfg_non_conformance_reports(tv_serial_number);

-- =============================================================================
-- 8. TABLE: PRODUCT QUALITY CONTAINMENT & RECALL CAMPAIGNS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mfg_recall_containment_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    campaign_number TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    defective_component_category TEXT NOT NULL,
    defective_batch_lot TEXT NOT NULL,
    supplier_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    risk_classification TEXT NOT NULL CHECK (risk_classification IN ('LOW', 'MEDIUM', 'HIGH', 'SAFETY_CRITICAL')),
    affected_serial_count INTEGER NOT NULL DEFAULT 0,
    warehouse_units_quarantined INTEGER NOT NULL DEFAULT 0,
    dealer_stock_quarantined INTEGER NOT NULL DEFAULT 0,
    customer_units_affected INTEGER NOT NULL DEFAULT 0,
    containment_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (containment_status IN (
        'ACTIVE', 'CONTAINED', 'SERVICED', 'CLOSED', 'CANCELLED'
    )),
    action_plan TEXT NOT NULL,
    authorized_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recall_variant ON public.mfg_recall_containment_campaigns(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_recall_status ON public.mfg_recall_containment_campaigns(containment_status);

-- =============================================================================
-- 9. RPC 1: fn_approve_engineering_change_order (Maker-Checker Enforced)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_approve_engineering_change_order(
    p_eco_id UUID,
    p_approver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_eco RECORD;
    v_new_bom_id UUID;
    v_old_bom_id UUID;
BEGIN
    SELECT * INTO v_eco FROM public.mfg_engineering_change_orders WHERE id = p_eco_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'ECO record not found.');
    END IF;

    IF v_eco.status != 'SUBMITTED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ECO is not in SUBMITTED state.');
    END IF;

    -- Strict Maker-Checker Segregation
    IF v_eco.requested_by = p_approver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maker-Checker Violation: Requester cannot self-approve an ECO.');
    END IF;

    -- Activate the new BOM revision and supersede the old BOM
    IF v_eco.to_bom_id IS NOT NULL THEN
        UPDATE public.bill_of_materials
        SET status = 'ACTIVE', approved_by = p_approver_id, approved_at = now(), updated_at = now()
        WHERE id = v_eco.to_bom_id;
    END IF;

    IF v_eco.from_bom_id IS NOT NULL THEN
        UPDATE public.bill_of_materials
        SET status = 'OBSOLETE', updated_at = now()
        WHERE id = v_eco.from_bom_id;
    END IF;

    UPDATE public.mfg_engineering_change_orders
    SET status = 'APPROVED', approved_by = p_approver_id, approved_at = now(), updated_at = now()
    WHERE id = p_eco_id;

    RETURN jsonb_build_object(
        'success', true,
        'eco_number', v_eco.eco_number,
        'status', 'APPROVED',
        'approved_by', p_approver_id
    );
END;
$$;

-- =============================================================================
-- 10. RPC 2: fn_register_tv_serial_genealogy
-- Stores full BOM component batches linked to a manufactured TV serial
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_register_tv_serial_genealogy(
    p_serial_number TEXT,
    p_work_order_id UUID,
    p_components JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_comp JSONB;
    v_wo RECORD;
    v_count INTEGER := 0;
BEGIN
    SELECT * INTO v_wo FROM public.production_work_orders WHERE id = p_work_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Production work order not found.');
    END IF;

    FOR v_comp IN SELECT * FROM jsonb_array_elements(p_components)
    LOOP
        INSERT INTO public.mfg_tv_genealogy (
            tenant_id,
            tv_serial_number,
            work_order_id,
            bom_id,
            assembly_line,
            component_category,
            component_part_id,
            component_part_code,
            component_serial_number,
            component_batch_lot,
            supplier_id
        ) VALUES (
            v_wo.tenant_id,
            p_serial_number,
            p_work_order_id,
            v_wo.bom_id,
            v_wo.assembly_line,
            v_comp->>'component_category',
            (v_comp->>'component_part_id')::uuid,
            v_comp->>'component_part_code',
            v_comp->>'component_serial_number',
            v_comp->>'component_batch_lot',
            (v_comp->>'supplier_id')::uuid
        ) ON CONFLICT (tv_serial_number, component_category) DO UPDATE
        SET component_batch_lot = EXCLUDED.component_batch_lot,
            component_serial_number = EXCLUDED.component_serial_number;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'serial_number', p_serial_number,
        'components_registered', v_count
    );
END;
$$;

-- =============================================================================
-- 11. RPC 3: fn_query_affected_serials_by_component_lot
-- Instant backward trace: Component Batch -> All impacted finished TVs
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_query_affected_serials_by_component_lot(
    p_component_batch_lot TEXT
)
RETURNS TABLE (
    tv_serial_number TEXT,
    work_order_number TEXT,
    product_name TEXT,
    component_category TEXT,
    component_batch_lot TEXT,
    assembled_at TIMESTAMPTZ,
    current_tv_status TEXT,
    customer_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT 
        g.tv_serial_number,
        wo.work_order_number,
        pv.product_name,
        g.component_category,
        g.component_batch_lot,
        g.assembled_at,
        COALESCE(pu.status, 'IN_PRODUCTION') AS current_tv_status,
        pu.customer_id
    FROM public.mfg_tv_genealogy g
    JOIN public.production_work_orders wo ON wo.id = g.work_order_id
    JOIN public.product_variants pv ON pv.id = wo.product_variant_id
    LEFT JOIN public.product_units pu ON pu.serial_number = g.tv_serial_number
    WHERE g.component_batch_lot = p_component_batch_lot
    ORDER BY g.assembled_at DESC;
$$;

-- =============================================================================
-- 12. VIEWS (security_invoker = true)
-- =============================================================================

-- View 1: Manufacturing Quality & Yield Intelligence
CREATE OR REPLACE VIEW public.vw_mfg_production_yield_intelligence
WITH (security_invoker = true) AS
SELECT 
    wo.id AS work_order_id,
    wo.work_order_number,
    wo.tenant_id,
    pv.product_name,
    pv.product_code,
    wo.planned_quantity,
    wo.completed_quantity,
    wo.scrapped_quantity,
    wo.status AS work_order_status,
    ROUND((wo.completed_quantity::numeric / NULLIF(wo.planned_quantity, 0)) * 100, 2) AS completion_pct,
    ROUND((wo.scrapped_quantity::numeric / NULLIF(wo.planned_quantity, 0)) * 100, 2) AS scrap_rate_pct,
    COALESCE(SUM(qc.units_passed), 0) AS total_qc_passed,
    COALESCE(SUM(qc.units_failed), 0) AS total_qc_failed,
    CASE 
        WHEN COALESCE(SUM(qc.units_tested), 0) = 0 THEN 100.00
        ELSE ROUND((SUM(qc.units_passed)::numeric / SUM(qc.units_tested)::numeric) * 100, 2)
    END AS first_pass_yield_pct,
    wo.assembly_line,
    wo.planned_start_date,
    wo.actual_completion_date
FROM public.production_work_orders wo
JOIN public.product_variants pv ON pv.id = wo.product_variant_id
LEFT JOIN public.production_quality_checks qc ON qc.work_order_id = wo.id
GROUP BY wo.id, wo.work_order_number, wo.tenant_id, pv.product_name, pv.product_code, 
         wo.planned_quantity, wo.completed_quantity, wo.scrapped_quantity, wo.status, 
         wo.assembly_line, wo.planned_start_date, wo.actual_completion_date;

-- View 2: Supplier Component Quality & Defect Rate
CREATE OR REPLACE VIEW public.vw_mfg_supplier_quality_scorecard
WITH (security_invoker = true) AS
SELECT 
    v.id AS supplier_id,
    v.name AS supplier_name,
    COUNT(qi.id) AS total_inspections,
    SUM(qi.sample_size) AS total_units_inspected,
    SUM(qi.defects_found) AS total_defects_found,
    ROUND((SUM(qi.defects_found)::numeric / NULLIF(SUM(qi.sample_size), 0)) * 100, 2) AS defect_rate_pct,
    COUNT(CASE WHEN qi.verdict = 'FAIL' OR qi.verdict = 'QUARANTINE' THEN 1 END) AS rejected_batches_count,
    CASE 
        WHEN ROUND((SUM(qi.defects_found)::numeric / NULLIF(SUM(qi.sample_size), 0)) * 100, 2) < 1.0 THEN 'EXCELLENT'
        WHEN ROUND((SUM(qi.defects_found)::numeric / NULLIF(SUM(qi.sample_size), 0)) * 100, 2) < 3.0 THEN 'ACCEPTABLE'
        WHEN ROUND((SUM(qi.defects_found)::numeric / NULLIF(SUM(qi.sample_size), 0)) * 100, 2) < 5.0 THEN 'WATCHLIST'
        ELSE 'HIGH_RISK_SUPPLIER'
    END AS supplier_risk_classification
FROM public.vendors v
JOIN public.mfg_quality_inspections qi ON qi.supplier_id = v.id
GROUP BY v.id, v.name;

-- View 3: Closed-Loop Warranty Failure to Manufacturing Genealogy Link
CREATE OR REPLACE VIEW public.vw_service_warranty_mfg_feedback_loop
WITH (security_invoker = true) AS
SELECT 
    st.id AS ticket_id,
    st.ticket_number,
    st.serial_number,
    st.root_cause_code,
    st.complaint_category,
    st.total_service_cost,
    g.component_category,
    g.component_part_code,
    g.component_batch_lot,
    v.name AS supplier_name,
    wo.work_order_number,
    wo.assembly_line,
    pv.product_name,
    pv.product_code
FROM public.service_tickets st
JOIN public.mfg_tv_genealogy g ON g.tv_serial_number = st.serial_number
JOIN public.production_work_orders wo ON wo.id = g.work_order_id
JOIN public.product_variants pv ON pv.id = wo.product_variant_id
LEFT JOIN public.vendors v ON v.id = g.supplier_id
WHERE st.status IN ('resolved', 'closed');

-- =============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.mfg_engineering_change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfg_wip_stage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfg_tv_genealogy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfg_quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfg_non_conformance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfg_recall_containment_campaigns ENABLE ROW LEVEL SECURITY;

-- Read policies for authenticated CRM staff
CREATE POLICY p_mfg_eco_read ON public.mfg_engineering_change_orders
    FOR SELECT TO authenticated USING (true);

CREATE POLICY p_mfg_wip_read ON public.mfg_wip_stage_tracking
    FOR SELECT TO authenticated USING (true);

CREATE POLICY p_mfg_genealogy_read ON public.mfg_tv_genealogy
    FOR SELECT TO authenticated USING (true);

CREATE POLICY p_mfg_qc_read ON public.mfg_quality_inspections
    FOR SELECT TO authenticated USING (true);

CREATE POLICY p_mfg_ncr_read ON public.mfg_non_conformance_reports
    FOR SELECT TO authenticated USING (true);

CREATE POLICY p_mfg_recall_read ON public.mfg_recall_containment_campaigns
    FOR SELECT TO authenticated USING (true);

-- Write policies for authorized manufacturing and admin roles
CREATE POLICY p_mfg_eco_write ON public.mfg_engineering_change_orders
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = auth.uid() 
              AND ur.role_name IN ('super_admin', 'admin', 'manufacturing')
        )
    );

CREATE POLICY p_mfg_wip_write ON public.mfg_wip_stage_tracking
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = auth.uid() 
              AND ur.role_name IN ('super_admin', 'admin', 'manufacturing', 'quality')
        )
    );

CREATE POLICY p_mfg_genealogy_write ON public.mfg_tv_genealogy
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = auth.uid() 
              AND ur.role_name IN ('super_admin', 'admin', 'manufacturing')
        )
    );

CREATE POLICY p_mfg_qc_write ON public.mfg_quality_inspections
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = auth.uid() 
              AND ur.role_name IN ('super_admin', 'admin', 'quality', 'manufacturing')
        )
    );

CREATE POLICY p_mfg_ncr_write ON public.mfg_non_conformance_reports
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = auth.uid() 
              AND ur.role_name IN ('super_admin', 'admin', 'quality', 'manufacturing')
        )
    );

CREATE POLICY p_mfg_recall_write ON public.mfg_recall_containment_campaigns
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = auth.uid() 
              AND ur.role_name IN ('super_admin', 'admin', 'management')
        )
    );

-- Revoke public access
REVOKE ALL ON public.mfg_engineering_change_orders FROM anon, PUBLIC;
REVOKE ALL ON public.mfg_wip_stage_tracking FROM anon, PUBLIC;
REVOKE ALL ON public.mfg_tv_genealogy FROM anon, PUBLIC;
REVOKE ALL ON public.mfg_quality_inspections FROM anon, PUBLIC;
REVOKE ALL ON public.mfg_non_conformance_reports FROM anon, PUBLIC;
REVOKE ALL ON public.mfg_recall_containment_campaigns FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE ON public.mfg_engineering_change_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mfg_wip_stage_tracking TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mfg_tv_genealogy TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mfg_quality_inspections TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mfg_non_conformance_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mfg_recall_containment_campaigns TO authenticated;
