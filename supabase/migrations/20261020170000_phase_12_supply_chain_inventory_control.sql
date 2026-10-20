-- =============================================================================
-- ZUVO TV CRM — PHASE 12 MASTER DATABASE MIGRATION
-- Enterprise Supply Chain, Inventory & Warehouse Control Center
-- Filename: 20261020170000_phase_12_supply_chain_inventory_control.sql
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. EXTEND EXISTING PRODUCT_UNITS FOR SUPPLY CHAIN & WAREHOUSE CONTROL
-- =============================================================================

DO $$
BEGIN
    -- Location bin reference within warehouse
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_units' AND column_name = 'location_bin'
    ) THEN
        ALTER TABLE public.product_units ADD COLUMN location_bin TEXT NULL;
    END IF;

    -- Batch / Lot number tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_units' AND column_name = 'batch_number'
    ) THEN
        ALTER TABLE public.product_units ADD COLUMN batch_number TEXT NULL;
    END IF;

    -- Manufacturing serial reference
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_units' AND column_name = 'manufacturing_ref'
    ) THEN
        ALTER TABLE public.product_units ADD COLUMN manufacturing_ref TEXT NULL;
    END IF;

    -- Current allocated order ID
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_units' AND column_name = 'allocated_order_id'
    ) THEN
        ALTER TABLE public.product_units ADD COLUMN allocated_order_id UUID NULL;
    END IF;

    -- QC inspection status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_units' AND column_name = 'qc_status'
    ) THEN
        ALTER TABLE public.product_units ADD COLUMN qc_status TEXT NOT NULL DEFAULT 'PASSED';
    END IF;

    -- Landed cost component
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_units' AND column_name = 'landed_cost'
    ) THEN
        ALTER TABLE public.product_units ADD COLUMN landed_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
    END IF;
END $$;

-- Extend product_units status check to support full enterprise supply chain lifecycle
ALTER TABLE public.product_units DROP CONSTRAINT IF EXISTS product_units_status_check;
ALTER TABLE public.product_units ADD CONSTRAINT product_units_status_check 
CHECK (status IN (
    'in_stock',
    'reserved',
    'allocated',
    'in_transit',
    'sold',
    'returned',
    'in_service',
    'damaged',
    'quarantine',
    'refurbishment',
    'refurbished',
    'scrap',
    'return_pending'
));

-- Extend inventory_transactions transaction_type check to cover Phase 12 supply chain movements
ALTER TABLE public.inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;
ALTER TABLE public.inventory_transactions ADD CONSTRAINT inventory_transactions_transaction_type_check 
CHECK (transaction_type IN (
    'stock_received', 'reserved', 'allocated', 'released', 'sale', 'return', 'service', 
    'service_completed', 'damaged', 'quarantine', 'refurbishment', 'refurbished', 'scrap',
    'stock_adjustment', 'warehouse_transfer', 'cycle_count_adjustment',
    'DISPATCH_TO_DEALER', 'DEALER_SALE', 'DEALER_RECEIPT', 'DEALER_DISCREPANCY',
    'CONSIGNMENT_RECALL', 'DEALER_TRANSFER', 'CONSIGNMENT_SETTLEMENT', 'RECONCILIATION',
    'GOODS_RECEIPT', 'VENDOR_RETURN'
));

-- =============================================================================
-- 2. SEQUENCES FOR SUPPLY CHAIN CONCURRENCY-SAFE IDENTIFIERS
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS public.seq_scm_cycle_count_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_scm_qc_inspection_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_scm_scrap_writeoff_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 3. TABLE: WAREHOUSE LOCATIONS & BINS (Bin Master)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.warehouse_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    zone TEXT NOT NULL,
    rack TEXT NOT NULL,
    shelf TEXT NOT NULL,
    bin TEXT NOT NULL,
    location_code TEXT NOT NULL,
    location_type TEXT NOT NULL DEFAULT 'STORAGE' CHECK (
        location_type IN ('STORAGE', 'RECEIVING_DOCK', 'STAGING', 'QC_QUARANTINE', 'REFURB_WORKSHOP', 'SCRAP_HOLD')
    ),
    max_tv_capacity INT NOT NULL DEFAULT 50 CHECK (max_tv_capacity >= 0),
    current_tv_count INT NOT NULL DEFAULT 0 CHECK (current_tv_count >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_wh_location_code UNIQUE (warehouse_id, location_code),
    CONSTRAINT chk_tv_count_capacity CHECK (current_tv_count <= max_tv_capacity)
);

CREATE INDEX IF NOT EXISTS idx_wh_locations_wh ON public.warehouse_locations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wh_locations_type ON public.warehouse_locations(location_type);
CREATE INDEX IF NOT EXISTS idx_wh_locations_active ON public.warehouse_locations(is_active);

-- =============================================================================
-- 4. TABLE: QUALITY INSPECTIONS (Enterprise Inbound & Reverse QA Workflow)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.scm_quality_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    inspection_number TEXT NOT NULL UNIQUE,
    inspection_source TEXT NOT NULL CHECK (inspection_source IN ('INBOUND_GRN', 'CUSTOMER_RETURN', 'DEALER_RETURN', 'DEPOT_REFURB')),
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    inspector_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_INSPECTION', 'PASSED', 'QUARANTINED', 'REJECTED_SCRAP')),
    display_panel_ok BOOLEAN NOT NULL DEFAULT true,
    audio_chassis_ok BOOLEAN NOT NULL DEFAULT true,
    ports_connectivity_ok BOOLEAN NOT NULL DEFAULT true,
    accessories_remote_ok BOOLEAN NOT NULL DEFAULT true,
    packaging_condition TEXT NOT NULL DEFAULT 'GOOD' CHECK (packaging_condition IN ('INTACT', 'DAMAGED', 'MISSING_BOX')),
    defect_classification TEXT NULL,
    defect_notes TEXT NULL,
    verdict_reason TEXT NULL,
    inspected_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scm_qc_unit ON public.scm_quality_inspections(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_scm_qc_wh ON public.scm_quality_inspections(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_scm_qc_status ON public.scm_quality_inspections(status);

-- =============================================================================
-- 5. TABLE: INVENTORY CYCLE COUNTS & PHYSICAL AUDITS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.scm_cycle_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    count_number TEXT NOT NULL UNIQUE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    count_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'RECONCILED', 'CANCELLED')),
    total_expected_units INT NOT NULL DEFAULT 0 CHECK (total_expected_units >= 0),
    total_counted_units INT NOT NULL DEFAULT 0 CHECK (total_counted_units >= 0),
    variance_count INT NOT NULL DEFAULT 0,
    counter_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scm_cycle_count_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    cycle_count_id UUID NOT NULL REFERENCES public.scm_cycle_counts(id) ON DELETE CASCADE,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    expected_status TEXT NOT NULL,
    counted_status TEXT NOT NULL,
    is_variance BOOLEAN NOT NULL DEFAULT false,
    variance_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cycle_counts_wh ON public.scm_cycle_counts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_cycle_counts_status ON public.scm_cycle_counts(status);
CREATE INDEX IF NOT EXISTS idx_cycle_count_items_cc ON public.scm_cycle_count_items(cycle_count_id);
CREATE INDEX IF NOT EXISTS idx_cycle_count_items_unit ON public.scm_cycle_count_items(product_unit_id);

-- =============================================================================
-- 6. TABLE: SCRAP & WRITE-OFF DISPOSITION RECORDS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.scm_scrap_writeoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    writeoff_number TEXT NOT NULL UNIQUE,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    scrap_reason TEXT NOT NULL CHECK (scrap_reason IN ('PANEL_CRACKED', 'LIGHTNING_SURGE', 'WATER_FLOOD', 'UNECONOMIC_REPAIR', 'TOTAL_LOSS')),
    scrap_condition TEXT NOT NULL,
    salvage_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (salvage_value >= 0),
    book_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (book_value >= 0),
    net_writeoff_loss NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (net_writeoff_loss >= 0),
    gl_scrap_journal_id UUID NULL REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'DISPOSED', 'REJECTED')),
    requested_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NULL,
    disposal_vendor TEXT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrap_unit ON public.scm_scrap_writeoffs(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_scrap_wh ON public.scm_scrap_writeoffs(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_scrap_status ON public.scm_scrap_writeoffs(status);

-- =============================================================================
-- 7. SERVER-AUTHORITATIVE RPC: fn_allocate_serialized_inventory
-- Allocates specific in-stock TV unit to a Sales Order line item safely
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_allocate_serialized_inventory(
    p_sales_order_id UUID,
    p_sales_order_item_id UUID,
    p_product_unit_id UUID,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_unit RECORD;
    v_so RECORD;
    v_item RECORD;
BEGIN
    -- Verify Sales Order
    SELECT * INTO v_so FROM public.sales_orders WHERE id = p_sales_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales order % not found.', p_sales_order_id;
    END IF;

    IF v_so.status IN ('CANCELLED', 'DELIVERED') THEN
        RAISE EXCEPTION 'Cannot allocate stock to sales order in status %', v_so.status;
    END IF;

    -- Verify Sales Order Item
    SELECT * INTO v_item FROM public.sales_order_items WHERE id = p_sales_order_item_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales order item % not found.', p_sales_order_item_id;
    END IF;

    IF v_item.quantity_allocated >= v_item.quantity_ordered THEN
        RAISE EXCEPTION 'Sales order item is already fully allocated (%/%).', v_item.quantity_allocated, v_item.quantity_ordered;
    END IF;

    -- Verify Product Unit
    SELECT * INTO v_unit FROM public.product_units WHERE id = p_product_unit_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product unit % not found.', p_product_unit_id;
    END IF;

    -- Unit must be strictly in_stock
    IF v_unit.status != 'in_stock' THEN
        RAISE EXCEPTION 'Product unit % is in status %, cannot allocate unless in_stock.', v_unit.serial_number, v_unit.status;
    END IF;

    -- Must not already be reserved/allocated
    IF EXISTS (
        SELECT 1 FROM public.sales_order_reservations 
        WHERE product_unit_id = p_product_unit_id 
          AND reservation_status IN ('RESERVED', 'PICKED', 'PACKED', 'DISPATCHED')
    ) THEN
        RAISE EXCEPTION 'Product unit % is already actively allocated to an existing order.', v_unit.serial_number;
    END IF;

    -- Create reservation record
    INSERT INTO public.sales_order_reservations (
        tenant_id, sales_order_id, sales_order_item_id, product_unit_id,
        warehouse_id, reservation_status, reserved_at
    ) VALUES (
        v_so.tenant_id, p_sales_order_id, p_sales_order_item_id, p_product_unit_id,
        v_unit.warehouse_id, 'RESERVED', now()
    );

    -- Update Product Unit status to allocated
    UPDATE public.product_units
    SET status = 'allocated', allocated_order_id = p_sales_order_id, updated_at = now()
    WHERE id = p_product_unit_id;

    -- Update Sales Order Item quantity
    UPDATE public.sales_order_items
    SET quantity_allocated = quantity_allocated + 1,
        status = CASE 
            WHEN quantity_allocated + 1 >= quantity_ordered THEN 'ALLOCATED'
            ELSE 'PARTIALLY_ALLOCATED'
        END,
        updated_at = now()
    WHERE id = p_sales_order_item_id;

    -- Log transaction
    INSERT INTO public.inventory_transactions (
        product_unit_id, transaction_type, previous_status, new_status,
        from_warehouse_id, to_warehouse_id, movement_reason, reference_note, performed_by
    ) VALUES (
        p_product_unit_id, 'allocated', 'in_stock', 'allocated',
        v_unit.warehouse_id, v_unit.warehouse_id, 'Sales Order Allocation',
        'Allocated to SO ' || v_so.so_number, p_actor_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'so_number', v_so.so_number,
        'serial_number', v_unit.serial_number,
        'allocated_quantity', v_item.quantity_allocated + 1
    );
END;
$$;

-- =============================================================================
-- 8. SERVER-AUTHORITATIVE RPC: fn_quarantine_defective_unit
-- Moves TV unit into quarantine with formal QC inspection record
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_quarantine_defective_unit(
    p_product_unit_id UUID,
    p_defect_classification TEXT,
    p_defect_notes TEXT,
    p_inspector_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_unit RECORD;
    v_qc_num TEXT;
BEGIN
    SELECT * INTO v_unit FROM public.product_units WHERE id = p_product_unit_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product unit % not found.', p_product_unit_id;
    END IF;

    IF v_unit.status IN ('sold', 'scrap') THEN
        RAISE EXCEPTION 'Cannot quarantine unit in status %', v_unit.status;
    END IF;

    v_qc_num := 'QC-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || nextval('public.seq_scm_qc_inspection_number')::text;

    -- Create Inspection Record
    INSERT INTO public.scm_quality_inspections (
        inspection_number, inspection_source, product_unit_id, warehouse_id,
        inspector_id, status, defect_classification, defect_notes, inspected_at
    ) VALUES (
        v_qc_num, 'INBOUND_GRN', p_product_unit_id, v_unit.warehouse_id,
        p_inspector_id, 'QUARANTINED', p_defect_classification, p_defect_notes, now()
    );

    -- Update unit status to quarantine
    UPDATE public.product_units
    SET status = 'quarantine', qc_status = 'QUARANTINED', updated_at = now()
    WHERE id = p_product_unit_id;

    -- Log transaction
    INSERT INTO public.inventory_transactions (
        product_unit_id, transaction_type, previous_status, new_status,
        from_warehouse_id, to_warehouse_id, movement_reason, reference_note, performed_by
    ) VALUES (
        p_product_unit_id, 'quarantine', v_unit.status, 'quarantine',
        v_unit.warehouse_id, v_unit.warehouse_id, 'QC Defect Quarantine',
        'Quarantined under ' || v_qc_num || ': ' || p_defect_classification, p_inspector_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'inspection_number', v_qc_num,
        'serial_number', v_unit.serial_number,
        'status', 'quarantine'
    );
END;
$$;

-- =============================================================================
-- 9. SERVER-AUTHORITATIVE RPC: fn_approve_scrap_disposition
-- Authorizes scrapping of damaged/uneconomic unit with maker-checker guard
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_approve_scrap_disposition(
    p_writeoff_id UUID,
    p_approver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_scrap RECORD;
    v_unit RECORD;
BEGIN
    SELECT * INTO v_scrap FROM public.scm_scrap_writeoffs WHERE id = p_writeoff_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scrap record % not found.', p_writeoff_id;
    END IF;

    IF v_scrap.status != 'PENDING' THEN
        RAISE EXCEPTION 'Cannot approve scrap disposition in status %', v_scrap.status;
    END IF;

    -- Maker-checker guard
    IF v_scrap.requested_by IS NOT NULL AND v_scrap.requested_by = p_approver_id THEN
        RAISE EXCEPTION 'Maker-checker violation: Requesting technician cannot approve their own scrap write-off.';
    END IF;

    SELECT * INTO v_unit FROM public.product_units WHERE id = v_scrap.product_unit_id FOR UPDATE;

    -- Update unit status to scrap
    UPDATE public.product_units
    SET status = 'scrap', qc_status = 'SCRAPPED', updated_at = now()
    WHERE id = v_scrap.product_unit_id;

    -- Update write-off record
    UPDATE public.scm_scrap_writeoffs
    SET status = 'APPROVED', approved_by = p_approver_id, approved_at = now(), updated_at = now()
    WHERE id = p_writeoff_id;

    -- Log transaction
    INSERT INTO public.inventory_transactions (
        product_unit_id, transaction_type, previous_status, new_status,
        from_warehouse_id, to_warehouse_id, movement_reason, reference_note, performed_by
    ) VALUES (
        v_scrap.product_unit_id, 'scrap', v_unit.status, 'scrap',
        v_unit.warehouse_id, v_unit.warehouse_id, 'Formal Scrap Disposal',
        'Write-off approved: ' || v_scrap.writeoff_number, p_approver_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'writeoff_number', v_scrap.writeoff_number,
        'serial_number', v_unit.serial_number,
        'status', 'APPROVED'
    );
END;
$$;

-- =============================================================================
-- 10. REPORTING & INTELLIGENCE VIEWS (security_invoker = true)
-- =============================================================================

CREATE OR REPLACE VIEW public.vw_scm_warehouse_inventory_control
WITH (security_invoker = true)
AS
SELECT 
    w.id AS warehouse_id,
    w.warehouse_code,
    w.warehouse_name,
    w.warehouse_type,
    w.city,
    w.state,
    COUNT(pu.id) AS total_units,
    COUNT(pu.id) FILTER (WHERE pu.status = 'in_stock') AS available_units,
    COUNT(pu.id) FILTER (WHERE pu.status = 'allocated' OR pu.status = 'reserved') AS reserved_allocated_units,
    COUNT(pu.id) FILTER (WHERE pu.status = 'in_transit') AS in_transit_units,
    COUNT(pu.id) FILTER (WHERE pu.status = 'quarantine') AS quarantine_units,
    COUNT(pu.id) FILTER (WHERE pu.status = 'damaged') AS damaged_units,
    COUNT(pu.id) FILTER (WHERE pu.status = 'refurbishment' OR pu.status = 'refurbished') AS refurbishment_units,
    COUNT(pu.id) FILTER (WHERE pu.status = 'scrap') AS scrap_units,
    COALESCE(SUM(pu.purchase_cost) FILTER (WHERE pu.status = 'in_stock'), 0) AS available_valuation,
    COALESCE(SUM(pu.purchase_cost), 0) AS total_inventory_valuation
FROM public.warehouses w
LEFT JOIN public.product_units pu ON w.id = pu.warehouse_id
GROUP BY w.id, w.warehouse_code, w.warehouse_name, w.warehouse_type, w.city, w.state;

CREATE OR REPLACE VIEW public.vw_scm_serialized_traceability_timeline
WITH (security_invoker = true)
AS
SELECT 
    pu.id AS unit_id,
    pu.serial_number,
    pu.barcode,
    pu.status AS current_status,
    pu.location_bin,
    pu.qc_status,
    pu.purchase_cost,
    pu.landed_cost,
    pu.received_at,
    w.warehouse_code,
    w.warehouse_name,
    pv.model_name,
    pv.screen_size,
    so.so_number AS allocated_so_number,
    d.dealer_name,
    c.full_name AS customer_name,
    wp.policy_number AS warranty_policy_number,
    wp.status AS warranty_status
FROM public.product_units pu
JOIN public.warehouses w ON pu.warehouse_id = w.id
JOIN public.product_variants pv ON pu.variant_id = pv.id
LEFT JOIN public.sales_orders so ON pu.allocated_order_id = so.id
LEFT JOIN public.dealers d ON so.dealer_id = d.id
LEFT JOIN public.customers c ON so.customer_id = c.id
LEFT JOIN public.warranty_policies wp ON pu.id = wp.product_unit_id;

-- =============================================================================
-- 11. ENABLE ROW LEVEL SECURITY (RLS) ON ALL PHASE 12 TABLES
-- =============================================================================

ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scm_quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scm_cycle_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scm_cycle_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scm_scrap_writeoffs ENABLE ROW LEVEL SECURITY;

-- 11.1 warehouse_locations Policies
DROP POLICY IF EXISTS "Staff view warehouse locations" ON public.warehouse_locations;
CREATE POLICY "Staff view warehouse locations" ON public.warehouse_locations
    FOR SELECT TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'sales', 'service', 'operations')
    );

DROP POLICY IF EXISTS "Inventory managers manage warehouse locations" ON public.warehouse_locations;
CREATE POLICY "Inventory managers manage warehouse locations" ON public.warehouse_locations
    FOR ALL TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'inventory')
    );

-- 11.2 scm_quality_inspections Policies
DROP POLICY IF EXISTS "Staff view quality inspections" ON public.scm_quality_inspections;
CREATE POLICY "Staff view quality inspections" ON public.scm_quality_inspections
    FOR SELECT TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service', 'operations')
    );

DROP POLICY IF EXISTS "QC inspectors manage inspections" ON public.scm_quality_inspections;
CREATE POLICY "QC inspectors manage inspections" ON public.scm_quality_inspections
    FOR ALL TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service')
    );

-- 11.3 scm_cycle_counts Policies
DROP POLICY IF EXISTS "Staff view cycle counts" ON public.scm_cycle_counts;
CREATE POLICY "Staff view cycle counts" ON public.scm_cycle_counts
    FOR SELECT TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'finance')
    );

DROP POLICY IF EXISTS "Inventory managers manage cycle counts" ON public.scm_cycle_counts;
CREATE POLICY "Inventory managers manage cycle counts" ON public.scm_cycle_counts
    FOR ALL TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'inventory')
    );

-- 11.4 scm_cycle_count_items Policies
DROP POLICY IF EXISTS "Staff view cycle count items" ON public.scm_cycle_count_items;
CREATE POLICY "Staff view cycle count items" ON public.scm_cycle_count_items
    FOR SELECT TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'finance')
    );

DROP POLICY IF EXISTS "Inventory managers manage cycle count items" ON public.scm_cycle_count_items;
CREATE POLICY "Inventory managers manage cycle count items" ON public.scm_cycle_count_items
    FOR ALL TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'inventory')
    );

-- 11.5 scm_scrap_writeoffs Policies
DROP POLICY IF EXISTS "Staff view scrap writeoffs" ON public.scm_scrap_writeoffs;
CREATE POLICY "Staff view scrap writeoffs" ON public.scm_scrap_writeoffs
    FOR SELECT TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'finance', 'service')
    );

DROP POLICY IF EXISTS "Authorized staff manage scrap writeoffs" ON public.scm_scrap_writeoffs;
CREATE POLICY "Authorized staff manage scrap writeoffs" ON public.scm_scrap_writeoffs
    FOR ALL TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'finance')
    );

-- Grant privileges to authenticated users (least privilege scoped by RLS)
GRANT SELECT ON public.vw_scm_warehouse_inventory_control TO authenticated;
GRANT SELECT ON public.vw_scm_serialized_traceability_timeline TO authenticated;

GRANT EXECUTE ON FUNCTION public.fn_allocate_serialized_inventory(UUID, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_quarantine_defective_unit(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_approve_scrap_disposition(UUID, UUID) TO authenticated;

REVOKE ALL ON public.warehouse_locations FROM anon;
REVOKE ALL ON public.scm_quality_inspections FROM anon;
REVOKE ALL ON public.scm_cycle_counts FROM anon;
REVOKE ALL ON public.scm_cycle_count_items FROM anon;
REVOKE ALL ON public.scm_scrap_writeoffs FROM anon;
