-- =============================================================================
-- ZUVO TV CRM — PHASE 8.7 MIGRATION
-- Enterprise Manufacturing Execution, Multi-Level BOM, Factory Production Work Orders & WIP Costing
-- Target Environment: Supabase PostgreSQL
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. EXTEND CHART OF ACCOUNTS FOR MANUFACTURING & WIP
-- =============================================================================
DO $$
BEGIN
    -- 1320: Raw Materials & Component Inventory
    INSERT INTO public.chart_of_accounts (
        account_number, account_name, account_type, account_subtype, normal_balance,
        is_active, system_control_type, description
    ) VALUES (
        '1320', 'Raw Materials & Components Inventory', 'ASSET', 'INVENTORY', 'DEBIT',
        true, 'INVENTORY', 'Electronic panels, boards, SMPS and chassis raw components stock'
    ) ON CONFLICT (account_number) DO NOTHING;

    -- 1330: Factory Work-in-Progress (WIP) Inventory
    INSERT INTO public.chart_of_accounts (
        account_number, account_name, account_type, account_subtype, normal_balance,
        is_active, system_control_type, description
    ) VALUES (
        '1330', 'Factory Work-in-Progress (WIP) Inventory', 'ASSET', 'INVENTORY', 'DEBIT',
        true, 'INVENTORY', 'Active production work order floor inventory, direct labor and absorbed overhead'
    ) ON CONFLICT (account_number) DO NOTHING;

    -- 5010: Production Scrap & Material Variance Expense
    INSERT INTO public.chart_of_accounts (
        account_number, account_name, account_type, account_subtype, normal_balance,
        is_active, system_control_type, description
    ) VALUES (
        '5010', 'Production Scrap & Material Variance', 'EXPENSE', 'COGS', 'DEBIT',
        true, 'COGS', 'Variance between standard BOM allowance and actual component scrap/losses'
    ) ON CONFLICT (account_number) DO NOTHING;

    -- 5350: Manufacturing Overhead Absorbed Clearing
    INSERT INTO public.chart_of_accounts (
        account_number, account_name, account_type, account_subtype, normal_balance,
        is_active, system_control_type, description
    ) VALUES (
        '5350', 'Manufacturing Overhead Absorbed', 'EXPENSE', 'OPERATING_EXPENSE', 'CREDIT',
        true, NULL, 'Credit contra clearing account for absorbed factory overhead and burn-in power'
    ) ON CONFLICT (account_number) DO NOTHING;
END;
$$;

-- =============================================================================
-- 2. SEQUENCES FOR CONCURRENCY-SAFE BOM & WORK ORDER NUMBERING
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_bom_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_production_work_order_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 3. TABLE: public.bill_of_materials
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bill_of_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    bom_number TEXT NOT NULL UNIQUE,
    product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    revision TEXT NOT NULL DEFAULT 'A',
    description TEXT,
    yield_expected_pct NUMERIC(5, 2) NOT NULL DEFAULT 98.00 CHECK (yield_expected_pct > 0 AND yield_expected_pct <= 100),
    standard_labor_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (standard_labor_cost >= 0),
    standard_overhead_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (standard_overhead_cost >= 0),
    total_standard_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_standard_cost >= 0),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'REVISED', 'OBSOLETE')),
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_variant_revision UNIQUE (tenant_id, product_variant_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_bom_tenant ON public.bill_of_materials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bom_variant ON public.bill_of_materials(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_bom_status ON public.bill_of_materials(status);

-- =============================================================================
-- 4. TABLE: public.bom_items
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    bom_id UUID NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE CASCADE,
    component_part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE RESTRICT,
    quantity_per_unit NUMERIC(10, 4) NOT NULL CHECK (quantity_per_unit > 0),
    scrap_allowance_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (scrap_allowance_pct >= 0 AND scrap_allowance_pct <= 100),
    component_category TEXT NOT NULL CHECK (
        component_category IN ('PANEL', 'MOTHERBOARD', 'POWER_SUPPLY', 'BACKLIGHT', 'CHASSIS', 'REMOTE', 'PACKAGING', 'OTHER')
    ),
    is_serialized_component BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_bom_component UNIQUE (bom_id, component_part_id)
);

CREATE INDEX IF NOT EXISTS idx_bom_items_bom ON public.bom_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_part ON public.bom_items(component_part_id);

-- =============================================================================
-- 5. TABLE: public.production_work_orders
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.production_work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    work_order_number TEXT NOT NULL UNIQUE,
    bom_id UUID NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE RESTRICT,
    product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    source_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    destination_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    planned_quantity INTEGER NOT NULL CHECK (planned_quantity > 0),
    completed_quantity INTEGER NOT NULL DEFAULT 0 CHECK (completed_quantity >= 0),
    scrapped_quantity INTEGER NOT NULL DEFAULT 0 CHECK (scrapped_quantity >= 0),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN ('DRAFT', 'RELEASED', 'IN_PRODUCTION', 'QUALITY_HOLD', 'COMPLETED', 'CANCELLED')
    ),
    assembly_line TEXT NOT NULL DEFAULT 'LINE_1',
    planned_start_date DATE NOT NULL,
    actual_start_at TIMESTAMPTZ,
    actual_completion_date TIMESTAMPTZ,
    supervisor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_wo_completion_limit CHECK (completed_quantity + scrapped_quantity <= planned_quantity)
);

CREATE INDEX IF NOT EXISTS idx_prod_wo_tenant ON public.production_work_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prod_wo_bom ON public.production_work_orders(bom_id);
CREATE INDEX IF NOT EXISTS idx_prod_wo_variant ON public.production_work_orders(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_prod_wo_status ON public.production_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_prod_wo_date ON public.production_work_orders(planned_start_date);

-- =============================================================================
-- 6. TABLE: public.work_order_component_issues
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.work_order_component_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    work_order_id UUID NOT NULL REFERENCES public.production_work_orders(id) ON DELETE CASCADE,
    component_part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE RESTRICT,
    planned_quantity NUMERIC(12, 4) NOT NULL CHECK (planned_quantity > 0),
    issued_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0.00 CHECK (issued_quantity >= 0),
    returned_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0.00 CHECK (returned_quantity >= 0),
    unit_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
    total_issued_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_issued_cost >= 0),
    status TEXT NOT NULL DEFAULT 'STAGED' CHECK (status IN ('STAGED', 'ISSUED_TO_WIP', 'RETURNED_TO_STOCK')),
    issued_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_wo_issue_part UNIQUE (work_order_id, component_part_id)
);

CREATE INDEX IF NOT EXISTS idx_wo_issues_wo ON public.work_order_component_issues(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_issues_part ON public.work_order_component_issues(component_part_id);
CREATE INDEX IF NOT EXISTS idx_wo_issues_status ON public.work_order_component_issues(status);

-- =============================================================================
-- 7. TABLE: public.production_quality_checks
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.production_quality_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    work_order_id UUID NOT NULL REFERENCES public.production_work_orders(id) ON DELETE CASCADE,
    station_type TEXT NOT NULL CHECK (
        station_type IN ('ELECTRICAL_HI_POT', 'OPTICAL_CALIBRATION', 'BURN_IN_STRESS_4H', 'FINAL_PACKAGING_QA')
    ),
    units_tested INTEGER NOT NULL CHECK (units_tested > 0),
    units_passed INTEGER NOT NULL DEFAULT 0 CHECK (units_passed >= 0),
    units_failed INTEGER NOT NULL DEFAULT 0 CHECK (units_failed >= 0),
    calibration_equipment_id UUID REFERENCES public.fixed_assets(id) ON DELETE SET NULL,
    inspector_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    inspected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_station_pass_fail CHECK (units_passed + units_failed <= units_tested)
);

CREATE INDEX IF NOT EXISTS idx_qc_work_order ON public.production_quality_checks(work_order_id);
CREATE INDEX IF NOT EXISTS idx_qc_station ON public.production_quality_checks(station_type);
CREATE INDEX IF NOT EXISTS idx_qc_asset ON public.production_quality_checks(calibration_equipment_id);

-- =============================================================================
-- 8. TABLE: public.production_cost_records
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.production_cost_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    work_order_id UUID NOT NULL UNIQUE REFERENCES public.production_work_orders(id) ON DELETE RESTRICT,
    raw_material_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (raw_material_cost >= 0),
    direct_labor_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (direct_labor_cost >= 0),
    overhead_absorbed_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (overhead_absorbed_cost >= 0),
    scrap_variance_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (scrap_variance_cost >= 0),
    total_production_cost NUMERIC(15, 2) NOT NULL CHECK (total_production_cost > 0),
    completed_quantity INTEGER NOT NULL CHECK (completed_quantity > 0),
    unit_cost_basis NUMERIC(15, 2) NOT NULL CHECK (unit_cost_basis > 0),
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_unit_cost_math CHECK (
        round(unit_cost_basis, 2) = round(total_production_cost / completed_quantity, 2)
    )
);

CREATE INDEX IF NOT EXISTS idx_prod_cost_wo ON public.production_cost_records(work_order_id);
CREATE INDEX IF NOT EXISTS idx_prod_cost_je ON public.production_cost_records(journal_entry_id);

-- =============================================================================
-- 9. RPC 1: fn_create_bill_of_materials
-- Validates components, rolls up standard costs, and creates BOM revision
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_create_bill_of_materials(
    p_bom_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_tenant_id TEXT;
    v_variant RECORD;
    v_variant_id UUID;
    v_bom_num TEXT;
    v_revision TEXT;
    v_desc TEXT;
    v_yield NUMERIC(5, 2);
    v_labor NUMERIC(15, 2);
    v_overhead NUMERIC(15, 2);
    v_items JSONB;
    v_item JSONB;
    v_bom_id UUID;
    v_part RECORD;
    v_item_qty NUMERIC(10, 4);
    v_item_scrap NUMERIC(5, 2);
    v_cat TEXT;
    v_tot_mat NUMERIC(15, 2) := 0.00;
    v_item_cost NUMERIC(15, 2);
    v_status TEXT;
BEGIN
    -- 1. Authorization check
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'inventory', 'finance')
        ) THEN
            RAISE EXCEPTION 'Unauthorized: only administration and inventory roles can create BOMs.';
        END IF;
    END IF;

    -- 2. Validate Variant
    v_variant_id := (p_bom_data->>'product_variant_id')::uuid;
    SELECT * INTO v_variant FROM public.product_variants WHERE id = v_variant_id;
    IF v_variant.id IS NULL THEN
        RAISE EXCEPTION 'Product variant % not found.', v_variant_id;
    END IF;

    v_tenant_id := COALESCE(p_bom_data->>'tenant_id', 'ZUVO_MAIN');
    v_revision := UPPER(COALESCE(p_bom_data->>'revision', 'A'));
    v_desc := p_bom_data->>'description';
    v_yield := round(COALESCE((p_bom_data->>'yield_expected_pct')::numeric, 98.00), 2);
    v_labor := round(COALESCE((p_bom_data->>'standard_labor_cost')::numeric, 450.00), 2);
    v_overhead := round(COALESCE((p_bom_data->>'standard_overhead_cost')::numeric, 350.00), 2);
    v_status := UPPER(COALESCE(p_bom_data->>'status', 'DRAFT'));
    v_items := p_bom_data->'items';

    IF v_yield <= 0 OR v_yield > 100 THEN
        RAISE EXCEPTION 'Expected yield must be between 0.01 and 100.00 percent.';
    END IF;
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RAISE EXCEPTION 'BOM must contain at least one component part.';
    END IF;

    -- Unique revision check
    IF EXISTS (
        SELECT 1 FROM public.bill_of_materials 
        WHERE tenant_id = v_tenant_id AND product_variant_id = v_variant_id AND revision = v_revision
    ) THEN
        RAISE EXCEPTION 'BOM revision % already exists for variant %.', v_revision, v_variant.product_name;
    END IF;

    v_bom_num := 'BOM-' || v_variant.product_code || '-REV' || v_revision;

    -- 3. Calculate Material Rollup Cost
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
        SELECT * INTO v_part FROM public.spare_parts WHERE id = (v_item->>'component_part_id')::uuid;
        IF v_part.id IS NULL THEN
            RAISE EXCEPTION 'Component part % not found.', v_item->>'component_part_id';
        END IF;

        v_item_qty := (v_item->>'quantity_per_unit')::numeric;
        v_item_scrap := COALESCE((v_item->>'scrap_allowance_pct')::numeric, 0.00);
        IF v_item_qty <= 0 THEN
            RAISE EXCEPTION 'Quantity per unit must be greater than zero.';
        END IF;

        v_item_cost := round(v_item_qty * v_part.standard_cost * (1 + (v_item_scrap / 100.00)), 2);
        v_tot_mat := round(v_tot_mat + v_item_cost, 2);
    END LOOP;

    -- 4. Insert BOM
    INSERT INTO public.bill_of_materials (
        tenant_id, bom_number, product_variant_id, revision, description,
        yield_expected_pct, standard_labor_cost, standard_overhead_cost, total_standard_cost,
        status, approved_by, approved_at
    ) VALUES (
        v_tenant_id, v_bom_num, v_variant_id, v_revision, v_desc,
        v_yield, v_labor, v_overhead, round(v_tot_mat + v_labor + v_overhead, 2),
        v_status, CASE WHEN v_status = 'ACTIVE' THEN v_actor_id ELSE NULL END,
        CASE WHEN v_status = 'ACTIVE' THEN now() ELSE NULL END
    ) RETURNING id INTO v_bom_id;

    -- 5. Insert BOM Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
        v_cat := UPPER(COALESCE(v_item->>'component_category', 'OTHER'));
        INSERT INTO public.bom_items (
            tenant_id, bom_id, component_part_id, quantity_per_unit,
            scrap_allowance_pct, component_category, is_serialized_component
        ) VALUES (
            v_tenant_id, v_bom_id, (v_item->>'component_part_id')::uuid,
            (v_item->>'quantity_per_unit')::numeric,
            COALESCE((v_item->>'scrap_allowance_pct')::numeric, 0.00),
            v_cat,
            COALESCE((v_item->>'is_serialized_component')::boolean, false)
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'bom_id', v_bom_id,
        'bom_number', v_bom_num,
        'revision', v_revision,
        'total_standard_cost', round(v_tot_mat + v_labor + v_overhead, 2),
        'status', v_status
    );
END;
$$;

-- =============================================================================
-- 10. RPC 2: fn_release_production_work_order
-- Validates active BOM, checks component inventory and reserves parts
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_release_production_work_order(
    p_work_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_wo RECORD;
    v_bom RECORD;
    v_item RECORD;
    v_req_qty NUMERIC(12, 4);
    v_inv RECORD;
    v_issues JSONB := '[]'::jsonb;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'inventory')
        ) THEN
            RAISE EXCEPTION 'Unauthorized: only inventory and administration roles can release work orders.';
        END IF;
    END IF;

    SELECT * INTO v_wo FROM public.production_work_orders WHERE id = p_work_order_id FOR UPDATE;
    IF v_wo.id IS NULL THEN
        RAISE EXCEPTION 'Production work order % not found.', p_work_order_id;
    END IF;
    IF v_wo.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Work order % cannot be released because it is in % status.', v_wo.work_order_number, v_wo.status;
    END IF;

    SELECT * INTO v_bom FROM public.bill_of_materials WHERE id = v_wo.bom_id;
    IF v_bom.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'BOM % must be in ACTIVE status before releasing work order.', v_bom.bom_number;
    END IF;

    -- Verify inventory availability for every BOM component
    FOR v_item IN SELECT * FROM public.bom_items WHERE bom_id = v_bom.id LOOP
        v_req_qty := round(v_wo.planned_quantity * v_item.quantity_per_unit * (1 + (v_item.scrap_allowance_pct / 100.00)), 4);

        SELECT * INTO v_inv 
        FROM public.spare_part_inventory 
        WHERE spare_part_id = v_item.component_part_id AND warehouse_id = v_wo.source_warehouse_id
        FOR UPDATE;

        IF v_inv.id IS NULL OR (v_inv.quantity_on_hand - v_inv.quantity_reserved) < v_req_qty THEN
            RAISE EXCEPTION 'Insufficient stock in source warehouse for component part %: requested %, available %',
                v_item.component_part_id, v_req_qty, COALESCE((v_inv.quantity_on_hand - v_inv.quantity_reserved), 0);
        END IF;

        -- Reserve stock
        UPDATE public.spare_part_inventory
        SET quantity_reserved = quantity_reserved + v_req_qty, updated_at = now()
        WHERE id = v_inv.id;

        -- Create staged component issue record
        INSERT INTO public.work_order_component_issues (
            tenant_id, work_order_id, component_part_id, planned_quantity, issued_quantity,
            unit_cost, total_issued_cost, status
        ) VALUES (
            v_wo.tenant_id, v_wo.id, v_item.component_part_id, v_req_qty, 0.00,
            (SELECT standard_cost FROM public.spare_parts WHERE id = v_item.component_part_id),
            0.00, 'STAGED'
        ) ON CONFLICT (work_order_id, component_part_id) DO UPDATE
        SET planned_quantity = v_req_qty, status = 'STAGED', updated_at = now();
    END LOOP;

    -- Transition status
    UPDATE public.production_work_orders
    SET status = 'RELEASED', updated_at = now()
    WHERE id = p_work_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'work_order_id', p_work_order_id,
        'work_order_number', v_wo.work_order_number,
        'status', 'RELEASED'
    );
END;
$$;

-- =============================================================================
-- 11. RPC 3: fn_issue_materials_to_wip
-- Atomically deducts inventory, moves stock to WIP, and posts GL Debit 1330 / Credit 1320
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_issue_materials_to_wip(
    p_work_order_id UUID,
    p_issues JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_wo RECORD;
    v_issue RECORD;
    v_item JSONB;
    v_part_id UUID;
    v_qty NUMERIC(12, 4);
    v_inv RECORD;
    v_part RECORD;
    v_line_cost NUMERIC(15, 2);
    v_tot_material_cost NUMERIC(15, 2) := 0.00;
    v_gl_1330 UUID;
    v_gl_1320 UUID;
    v_je_result JSONB;
    v_lines JSONB := '[]'::jsonb;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'inventory', 'finance')
        ) THEN
            RAISE EXCEPTION 'Unauthorized: only inventory and administration roles can issue materials to WIP.';
        END IF;
    END IF;

    SELECT * INTO v_wo FROM public.production_work_orders WHERE id = p_work_order_id FOR UPDATE;
    IF v_wo.id IS NULL THEN
        RAISE EXCEPTION 'Work order % not found.', p_work_order_id;
    END IF;
    IF v_wo.status NOT IN ('RELEASED', 'IN_PRODUCTION') THEN
        RAISE EXCEPTION 'Work order must be in RELEASED or IN_PRODUCTION status to issue materials.';
    END IF;

    -- Process each issue
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_issues) LOOP
        v_part_id := (v_item->>'component_part_id')::uuid;
        v_qty := (v_item->>'quantity')::numeric;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Issue quantity must be greater than zero.';
        END IF;

        SELECT * INTO v_part FROM public.spare_parts WHERE id = v_part_id;
        SELECT * INTO v_inv FROM public.spare_part_inventory 
        WHERE spare_part_id = v_part_id AND warehouse_id = v_wo.source_warehouse_id
        FOR UPDATE;

        IF v_inv.id IS NULL OR v_inv.quantity_on_hand < v_qty THEN
            RAISE EXCEPTION 'Insufficient stock on hand for %: requested %, available %',
                v_part.part_name, v_qty, COALESCE(v_inv.quantity_on_hand, 0);
        END IF;

        -- Decrement physical stock and clear reserved
        UPDATE public.spare_part_inventory
        SET quantity_on_hand = quantity_on_hand - v_qty,
            quantity_reserved = GREATEST(0, quantity_reserved - v_qty),
            updated_at = now()
        WHERE id = v_inv.id;

        v_line_cost := round(v_qty * v_part.standard_cost, 2);
        v_tot_material_cost := round(v_tot_material_cost + v_line_cost, 2);

        -- Update component issue record
        UPDATE public.work_order_component_issues
        SET issued_quantity = issued_quantity + v_qty,
            unit_cost = v_part.standard_cost,
            total_issued_cost = total_issued_cost + v_line_cost,
            status = 'ISSUED_TO_WIP',
            issued_at = now()
        WHERE work_order_id = v_wo.id AND component_part_id = v_part_id;
    END LOOP;

    -- Post Balanced Double-Entry GL Journal:
    -- DEBIT 1330 Factory Work-in-Progress (WIP)
    -- CREDIT 1320 Raw Materials & Components Inventory
    SELECT id INTO v_gl_1330 FROM public.chart_of_accounts WHERE account_number = '1330';
    SELECT id INTO v_gl_1320 FROM public.chart_of_accounts WHERE account_number = '1320';

    IF v_gl_1330 IS NOT NULL AND v_gl_1320 IS NOT NULL AND v_tot_material_cost > 0 THEN
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_gl_1330,
            'debit_amount', v_tot_material_cost,
            'credit_amount', 0.00,
            'description', 'Factory WIP material issue for WO ' || v_wo.work_order_number
        );
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_gl_1320,
            'debit_amount', 0.00,
            'credit_amount', v_tot_material_cost,
            'description', 'Raw material issue from warehouse stock'
        );

        v_je_result := public.fn_post_journal_entry(
            jsonb_build_object(
                'entry_date', CURRENT_DATE,
                'source_document_type', 'MANUFACTURING_WIP',
                'source_document_reference_id', v_wo.id,
                'narration', 'Material Issued to Factory WIP for ' || v_wo.work_order_number,
                'lines', v_lines
            )
        );
    END IF;

    -- Transition work order to IN_PRODUCTION
    UPDATE public.production_work_orders
    SET status = 'IN_PRODUCTION',
        actual_start_at = COALESCE(actual_start_at, now()),
        updated_at = now()
    WHERE id = p_work_order_id;

    -- Emit Financial Audit Event
    INSERT INTO public.financial_audit_events (
        event_type, severity, entity_type, entity_id, entity_reference, event_payload, actor_id
    ) VALUES (
        'WIP_MATERIAL_ISSUED', 'INFO', 'PRODUCTION_WORK_ORDER', v_wo.id, v_wo.work_order_number,
        jsonb_build_object(
            'total_material_cost', v_tot_material_cost,
            'items_count', jsonb_array_length(p_issues)
        ),
        v_actor_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'work_order_id', p_work_order_id,
        'work_order_number', v_wo.work_order_number,
        'total_material_cost', v_tot_material_cost,
        'status', 'IN_PRODUCTION'
    );
END;
$$;

-- =============================================================================
-- 12. RPC 4: fn_log_production_quality_gate
-- Logs station quality inspections, burn-in runs, and validates against Phase 8.5 assets
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_log_production_quality_gate(
    p_work_order_id UUID,
    p_check_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_wo RECORD;
    v_station TEXT;
    v_tested INT;
    v_passed INT;
    v_failed INT;
    v_asset_id UUID;
    v_asset RECORD;
    v_notes TEXT;
    v_check_id UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'inventory', 'service')
        ) THEN
            RAISE EXCEPTION 'Unauthorized: only quality and administration roles can log quality gates.';
        END IF;
    END IF;

    SELECT * INTO v_wo FROM public.production_work_orders WHERE id = p_work_order_id FOR UPDATE;
    IF v_wo.id IS NULL THEN
        RAISE EXCEPTION 'Work order % not found.', p_work_order_id;
    END IF;

    v_station := UPPER(p_check_data->>'station_type');
    v_tested := (p_check_data->>'units_tested')::int;
    v_passed := (p_check_data->>'units_passed')::int;
    v_failed := (p_check_data->>'units_failed')::int;
    v_asset_id := (p_check_data->>'calibration_equipment_id')::uuid;
    v_notes := p_check_data->>'notes';

    IF v_station NOT IN ('ELECTRICAL_HI_POT', 'OPTICAL_CALIBRATION', 'BURN_IN_STRESS_4H', 'FINAL_PACKAGING_QA') THEN
        RAISE EXCEPTION 'Invalid station type: %', v_station;
    END IF;
    IF v_tested <= 0 OR v_passed < 0 OR v_failed < 0 OR (v_passed + v_failed > v_tested) THEN
        RAISE EXCEPTION 'Inconsistent inspection counts (tested %, passed %, failed %).', v_tested, v_passed, v_failed;
    END IF;

    -- Validate Phase 8.5 Fixed Asset if referenced
    IF v_asset_id IS NOT NULL THEN
        SELECT * INTO v_asset FROM public.fixed_assets WHERE id = v_asset_id;
        IF v_asset.id IS NULL THEN
            RAISE EXCEPTION 'Referenced capital testing equipment % not found.', v_asset_id;
        END IF;
        IF v_asset.status <> 'ACTIVE' THEN
            RAISE EXCEPTION 'Testing equipment % is in % status and cannot be used for production.',
                v_asset.asset_tag, v_asset.status;
        END IF;
    END IF;

    -- Insert Quality Record
    INSERT INTO public.production_quality_checks (
        tenant_id, work_order_id, station_type, units_tested, units_passed, units_failed,
        calibration_equipment_id, inspector_id, notes
    ) VALUES (
        v_wo.tenant_id, v_wo.id, v_station, v_tested, v_passed, v_failed,
        v_asset_id, v_actor_id, v_notes
    ) RETURNING id INTO v_check_id;

    -- Critical failure logic: if failures exceed 10% or burn-in has fails, place on QUALITY_HOLD
    IF v_failed > 0 AND (v_station = 'BURN_IN_STRESS_4H' OR (v_failed::numeric / v_tested::numeric) > 0.10) THEN
        UPDATE public.production_work_orders
        SET status = 'QUALITY_HOLD', updated_at = now()
        WHERE id = p_work_order_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'quality_check_id', v_check_id,
        'station_type', v_station,
        'units_passed', v_passed,
        'units_failed', v_failed,
        'work_order_status', (SELECT status FROM public.production_work_orders WHERE id = p_work_order_id)
    );
END;
$$;

-- =============================================================================
-- 13. RPC 5: fn_complete_production_and_capitalize
-- Derives unit cost, creates serialized finished TVs in product_units, and posts balanced GL
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_complete_production_and_capitalize(
    p_work_order_id UUID,
    p_completion_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_wo RECORD;
    v_bom RECORD;
    v_variant RECORD;
    v_completed_qty INT;
    v_scrapped_qty INT;
    v_raw_cost NUMERIC(15, 2);
    v_labor_rate NUMERIC(15, 2);
    v_overhead_rate NUMERIC(15, 2);
    v_direct_labor NUMERIC(15, 2);
    v_overhead_cost NUMERIC(15, 2);
    v_scrap_variance NUMERIC(15, 2) := 0.00;
    v_tot_prod_cost NUMERIC(15, 2);
    v_unit_cost NUMERIC(15, 2);
    v_cost_id UUID;
    v_gl_1300 UUID;
    v_gl_1330 UUID;
    v_gl_5010 UUID;
    v_gl_5350 UUID;
    v_lines JSONB := '[]'::jsonb;
    v_je_result JSONB;
    v_je_id UUID;
    v_i INT;
    v_serial TEXT;
    v_barcode TEXT;
    v_unit_id UUID;
    v_mandatory_gates_passed BOOLEAN;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'finance')
        ) THEN
            RAISE EXCEPTION 'Unauthorized: only finance leadership and administration can capitalize production.';
        END IF;
    END IF;

    SELECT * INTO v_wo FROM public.production_work_orders WHERE id = p_work_order_id FOR UPDATE;
    IF v_wo.id IS NULL THEN
        RAISE EXCEPTION 'Work order % not found.', p_work_order_id;
    END IF;
    IF v_wo.status = 'COMPLETED' THEN
        RAISE EXCEPTION 'Work order % is already completed and capitalized.', v_wo.work_order_number;
    END IF;
    IF v_wo.status = 'QUALITY_HOLD' THEN
        RAISE EXCEPTION 'Work order % is on QUALITY_HOLD and cannot be capitalized.', v_wo.work_order_number;
    END IF;

    -- Validate that mandatory quality gates have been recorded and passed
    SELECT (
        COUNT(DISTINCT station_type) >= 3 AND SUM(units_failed) = 0
    ) INTO v_mandatory_gates_passed
    FROM public.production_quality_checks
    WHERE work_order_id = p_work_order_id;

    IF NOT COALESCE(v_mandatory_gates_passed, false) THEN
        RAISE EXCEPTION 'Work order % has not passed mandatory quality gates (Electrical, Optical, Burn-In).', v_wo.work_order_number;
    END IF;

    v_completed_qty := (p_completion_data->>'completed_quantity')::int;
    v_scrapped_qty := COALESCE((p_completion_data->>'scrapped_quantity')::int, 0);

    IF v_completed_qty <= 0 THEN
        RAISE EXCEPTION 'Completed quantity must be greater than zero.';
    END IF;
    IF (v_completed_qty + v_scrapped_qty) > v_wo.planned_quantity THEN
        RAISE EXCEPTION 'Total completed plus scrapped exceeds planned quantity.';
    END IF;

    SELECT * INTO v_bom FROM public.bill_of_materials WHERE id = v_wo.bom_id;
    SELECT * INTO v_variant FROM public.product_variants WHERE id = v_wo.product_variant_id;

    -- 1. Calculate actual raw material cost consumed from WIP
    SELECT COALESCE(SUM(total_issued_cost), 0.00) INTO v_raw_cost
    FROM public.work_order_component_issues
    WHERE work_order_id = p_work_order_id;

    IF v_raw_cost <= 0 THEN
        RAISE EXCEPTION 'No raw materials have been issued to WIP for this work order.';
    END IF;

    -- 2. Direct Labor & Factory Overhead absorption
    v_labor_rate := v_bom.standard_labor_cost;
    v_overhead_rate := v_bom.standard_overhead_cost;
    v_direct_labor := round(v_completed_qty * v_labor_rate, 2);
    v_overhead_cost := round(v_completed_qty * v_overhead_rate, 2);

    -- Scrap variance if units were rejected
    IF v_scrapped_qty > 0 THEN
        v_scrap_variance := round((v_raw_cost / v_wo.planned_quantity) * v_scrapped_qty, 2);
        v_raw_cost := v_raw_cost - v_scrap_variance;
    END IF;

    v_tot_prod_cost := round(v_raw_cost + v_direct_labor + v_overhead_cost, 2);
    v_unit_cost := round(v_tot_prod_cost / v_completed_qty, 2);

    -- 3. Atomically Insert Serialized Product Units into existing product_units
    FOR v_i IN 1..v_completed_qty LOOP
        v_serial := 'SN-' || v_variant.product_code || '-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad((nextval('public.seq_production_work_order_number') * 10 + v_i)::text, 6, '0');
        v_barcode := 'BAR-' || md5(v_serial || v_wo.id::text);

        INSERT INTO public.product_units (
            variant_id, warehouse_id, serial_number, barcode, status, ownership_type,
            purchase_cost, notes
        ) VALUES (
            v_variant.id, v_wo.destination_warehouse_id, v_serial, v_barcode, 'in_stock', 'zuvo_owned',
            v_unit_cost, 'Manufactured via WO ' || v_wo.work_order_number
        );
    END LOOP;

    -- 4. Post Balanced Double-Entry GL Journal
    SELECT id INTO v_gl_1300 FROM public.chart_of_accounts WHERE account_number = '1300'; -- Finished Goods
    SELECT id INTO v_gl_1330 FROM public.chart_of_accounts WHERE account_number = '1330'; -- Factory WIP
    SELECT id INTO v_gl_5010 FROM public.chart_of_accounts WHERE account_number = '5010'; -- Scrap Variance
    SELECT id INTO v_gl_5350 FROM public.chart_of_accounts WHERE account_number = '5350'; -- Overhead Absorbed

    -- Line 1: DEBIT Finished Goods TV Inventory
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_gl_1300,
        'debit_amount', v_tot_prod_cost,
        'credit_amount', 0.00,
        'description', 'Finished Goods TV Capitalization: ' || v_wo.work_order_number
    );

    -- Line 2: If scrap variance exists, DEBIT Scrap Expense
    IF v_scrap_variance > 0 AND v_gl_5010 IS NOT NULL THEN
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_gl_5010,
            'debit_amount', v_scrap_variance,
            'credit_amount', 0.00,
            'description', 'Production scrap variance on ' || v_wo.work_order_number
        );
    END IF;

    -- Line 3: CREDIT Factory WIP Inventory (Exhausting material issue)
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_gl_1330,
        'debit_amount', 0.00,
        'credit_amount', round(v_raw_cost + v_scrap_variance, 2),
        'description', 'WIP Inventory cleared for finished assembly'
    );

    -- Line 4: CREDIT Manufacturing Overhead Absorbed
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_gl_5350,
        'debit_amount', 0.00,
        'credit_amount', round(v_direct_labor + v_overhead_cost, 2),
        'description', 'Direct labor & factory overhead absorbed'
    );

    v_je_result := public.fn_post_journal_entry(
        jsonb_build_object(
            'entry_date', CURRENT_DATE,
            'source_document_type', 'MANUFACTURING_COMPLETION',
            'source_document_reference_id', v_wo.id,
            'narration', 'Production Capitalization for ' || v_wo.work_order_number || ' (' || v_completed_qty || ' units)',
            'lines', v_lines
        )
    );

    IF (v_je_result->>'success')::boolean THEN
        v_je_id := (v_je_result->>'journal_entry_id')::uuid;
    END IF;

    -- 5. Create Production Cost Record
    INSERT INTO public.production_cost_records (
        tenant_id, work_order_id, raw_material_cost, direct_labor_cost, overhead_absorbed_cost,
        scrap_variance_cost, total_production_cost, completed_quantity, unit_cost_basis, journal_entry_id
    ) VALUES (
        v_wo.tenant_id, v_wo.id, v_raw_cost, v_direct_labor, v_overhead_cost,
        v_scrap_variance, v_tot_prod_cost, v_completed_qty, v_unit_cost, v_je_id
    ) RETURNING id INTO v_cost_id;

    -- 6. Transition Work Order to COMPLETED
    UPDATE public.production_work_orders
    SET completed_quantity = v_completed_qty,
        scrapped_quantity = v_scrapped_qty,
        status = 'COMPLETED',
        actual_completion_date = now(),
        updated_at = now()
    WHERE id = p_work_order_id;

    -- 7. Emit Financial Audit Event
    INSERT INTO public.financial_audit_events (
        event_type, severity, entity_type, entity_id, entity_reference, event_payload, actor_id
    ) VALUES (
        'PRODUCTION_WORK_ORDER_COMPLETED', 'INFO', 'PRODUCTION_WORK_ORDER', v_wo.id, v_wo.work_order_number,
        jsonb_build_object(
            'completed_quantity', v_completed_qty,
            'scrapped_quantity', v_scrapped_qty,
            'unit_cost_basis', v_unit_cost,
            'total_production_cost', v_tot_prod_cost,
            'journal_entry_id', v_je_id
        ),
        v_actor_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'work_order_id', p_work_order_id,
        'work_order_number', v_wo.work_order_number,
        'completed_quantity', v_completed_qty,
        'unit_cost_basis', v_unit_cost,
        'total_production_cost', v_tot_prod_cost,
        'status', 'COMPLETED'
    );
END;
$$;

-- =============================================================================
-- 14. ROW-LEVEL SECURITY POLICIES
-- =============================================================================
ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_component_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_cost_records ENABLE ROW LEVEL SECURITY;

-- Management access for Admin & Inventory
CREATE POLICY "bom_admin_inventory" ON public.bill_of_materials
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'inventory', 'finance')
        )
    );

CREATE POLICY "bom_items_admin_inventory" ON public.bom_items
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'inventory', 'finance')
        )
    );

CREATE POLICY "work_orders_manage" ON public.production_work_orders
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'inventory', 'finance')
        )
    );

CREATE POLICY "wo_issues_manage" ON public.work_order_component_issues
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'inventory', 'finance')
        )
    );

CREATE POLICY "qc_checks_manage" ON public.production_quality_checks
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'inventory', 'service', 'finance')
        )
    );

CREATE POLICY "cost_records_finance" ON public.production_cost_records
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- Revoke all permissions from anon
REVOKE ALL ON public.bill_of_materials FROM anon;
REVOKE ALL ON public.bom_items FROM anon;
REVOKE ALL ON public.production_work_orders FROM anon;
REVOKE ALL ON public.work_order_component_issues FROM anon;
REVOKE ALL ON public.production_quality_checks FROM anon;
REVOKE ALL ON public.production_cost_records FROM anon;

-- Grant execution on RPCs to authenticated users
GRANT EXECUTE ON FUNCTION public.fn_create_bill_of_materials(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_release_production_work_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_issue_materials_to_wip(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_log_production_quality_gate(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_complete_production_and_capitalize(UUID, JSONB) TO authenticated;

-- =============================================================================
-- END OF PHASE 8.7 MIGRATION
-- =============================================================================
