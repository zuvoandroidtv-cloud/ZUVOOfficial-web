-- =====================================================================
-- ZUVO TV CRM — PHASE 3 MASTER DATABASE EXPANSION
-- Migration: 20261006010000_phase_3_master_expansion.sql
-- Project: axpryvuknepqeflymzlv (ZUVO Android TV)
--
-- Contents:
-- 1. Phase 3.1: Warehouses & Stock Locations
-- 2. Phase 3.2: Dealers & Distribution Network
-- 3. Phase 3.3: Spare Parts Master & Inventory
-- 4. Phase 3.4 & 3.4B: Service Centers & Technician Territories (Pincodes)
-- 5. Phase 3.5: Media / Document Attachments & Storage Bucket
-- 6. Phase 3.6: Row Level Security (RLS) on all Phase 3 Tables & Storage
-- 7. Phase 3.7: Analytical & Reporting Views (WITH security_invoker = true)
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. PHASE 3.1: WAREHOUSES & STOCK LOCATIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_code TEXT UNIQUE NOT NULL,
    warehouse_name TEXT NOT NULL,
    warehouse_type TEXT NOT NULL,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_warehouse_type CHECK (
        warehouse_type IN (
            'central_warehouse',
            'regional_warehouse',
            'showroom',
            'service_center',
            'dealer_location',
            'other'
        )
    )
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'product_units' 
          AND column_name = 'warehouse_id'
    ) THEN
        ALTER TABLE public.product_units 
        ADD COLUMN warehouse_id UUID NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'inventory_transactions' 
          AND column_name = 'from_warehouse_id'
    ) THEN
        ALTER TABLE public.inventory_transactions 
        ADD COLUMN from_warehouse_id UUID NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'inventory_transactions' 
          AND column_name = 'to_warehouse_id'
    ) THEN
        ALTER TABLE public.inventory_transactions 
        ADD COLUMN to_warehouse_id UUID NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'inventory_transactions' 
          AND column_name = 'movement_reason'
    ) THEN
        ALTER TABLE public.inventory_transactions 
        ADD COLUMN movement_reason TEXT NULL;
    END IF;
END $$;

DO $$
BEGIN
    ALTER TABLE public.inventory_transactions 
    DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

    ALTER TABLE public.inventory_transactions 
    ADD CONSTRAINT inventory_transactions_transaction_type_check 
    CHECK (transaction_type IN (
        'stock_received',
        'reserved',
        'sale',
        'return',
        'service',
        'service_completed',
        'damaged',
        'stock_adjustment',
        'warehouse_transfer'
    ));
END $$;

DROP TRIGGER IF EXISTS trg_warehouses_updated_at ON public.warehouses;
CREATE TRIGGER trg_warehouses_updated_at
    BEFORE UPDATE ON public.warehouses
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_warehouses_code ON public.warehouses(warehouse_code);
CREATE INDEX IF NOT EXISTS idx_warehouses_type ON public.warehouses(warehouse_type);
CREATE INDEX IF NOT EXISTS idx_product_units_warehouse_id ON public.product_units(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_from_warehouse ON public.inventory_transactions(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_to_warehouse ON public.inventory_transactions(to_warehouse_id);

-- =====================================================================
-- 2. PHASE 3.2: DEALERS & DISTRIBUTION NETWORK
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.dealers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_code TEXT UNIQUE NOT NULL,
    dealer_name TEXT NOT NULL,
    legal_name TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    gst_number TEXT,
    dealer_type TEXT NOT NULL DEFAULT 'dealer',
    credit_limit NUMERIC NOT NULL DEFAULT 0,
    payment_terms TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_dealer_type CHECK (
        dealer_type IN (
            'distributor',
            'dealer',
            'retailer',
            'sub_dealer',
            'other'
        )
    ),
    CONSTRAINT chk_dealer_credit_limit CHECK (credit_limit >= 0)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'sales' 
          AND column_name = 'dealer_id'
    ) THEN
        ALTER TABLE public.sales 
        ADD COLUMN dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'warranties' 
          AND column_name = 'dealer_id'
    ) THEN
        ALTER TABLE public.warranties 
        ADD COLUMN dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE RESTRICT;
    END IF;
END $$;

DROP TRIGGER IF EXISTS trg_dealers_updated_at ON public.dealers;
CREATE TRIGGER trg_dealers_updated_at
    BEFORE UPDATE ON public.dealers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_dealers_code ON public.dealers(dealer_code);
CREATE INDEX IF NOT EXISTS idx_dealers_type ON public.dealers(dealer_type);
CREATE INDEX IF NOT EXISTS idx_sales_dealer_id ON public.sales(dealer_id);
CREATE INDEX IF NOT EXISTS idx_warranties_dealer_id ON public.warranties(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealers_gst_number ON public.dealers(gst_number) WHERE gst_number IS NOT NULL;

-- =====================================================================
-- 3. PHASE 3.3: SPARE PARTS MASTER & INVENTORY
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.spare_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_code TEXT UNIQUE NOT NULL,
    part_name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    unit_of_measure TEXT NOT NULL DEFAULT 'piece',
    standard_cost NUMERIC NOT NULL DEFAULT 0,
    selling_price NUMERIC NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_spare_part_category CHECK (
        category IN (
            'panel',
            'main_board',
            'power_board',
            'remote',
            'speaker',
            'cable',
            'stand',
            'accessory',
            'other'
        )
    ),
    CONSTRAINT chk_spare_part_costs CHECK (
        standard_cost >= 0 AND selling_price >= 0 AND reorder_level >= 0
    )
);

CREATE TABLE IF NOT EXISTS public.spare_part_compatibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spare_part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_spare_part_variant UNIQUE (spare_part_id, variant_id)
);

CREATE TABLE IF NOT EXISTS public.spare_part_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spare_part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_spare_part_inv_quantities CHECK (
        quantity_on_hand >= 0 AND quantity_reserved >= 0 AND reorder_level >= 0
    ),
    CONSTRAINT uq_spare_part_warehouse UNIQUE (spare_part_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS public.spare_part_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spare_part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE RESTRICT,
    from_warehouse_id UUID NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    to_warehouse_id UUID NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    transaction_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC NULL,
    reference_ticket_id UUID NULL REFERENCES public.service_tickets(id) ON DELETE SET NULL,
    reference_note TEXT,
    performed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_spare_part_tx_type CHECK (
        transaction_type IN (
            'stock_received',
            'stock_transfer',
            'stock_adjustment',
            'reserved',
            'consumed',
            'returned',
            'damaged'
        )
    ),
    CONSTRAINT chk_spare_part_tx_qty CHECK (quantity > 0),
    CONSTRAINT chk_spare_part_tx_cost CHECK (unit_cost IS NULL OR unit_cost >= 0)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'service_parts' 
          AND column_name = 'spare_part_id'
    ) THEN
        ALTER TABLE public.service_parts 
        ADD COLUMN spare_part_id UUID NULL REFERENCES public.spare_parts(id) ON DELETE RESTRICT;
    END IF;
END $$;

DROP TRIGGER IF EXISTS trg_spare_parts_updated_at ON public.spare_parts;
CREATE TRIGGER trg_spare_parts_updated_at
    BEFORE UPDATE ON public.spare_parts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_spare_part_inventory_updated_at ON public.spare_part_inventory;
CREATE TRIGGER trg_spare_part_inventory_updated_at
    BEFORE UPDATE ON public.spare_part_inventory
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_spare_parts_code ON public.spare_parts(part_code);
CREATE INDEX IF NOT EXISTS idx_spare_parts_category ON public.spare_parts(category);
CREATE INDEX IF NOT EXISTS idx_spare_part_compat_part ON public.spare_part_compatibility(spare_part_id);
CREATE INDEX IF NOT EXISTS idx_spare_part_compat_variant ON public.spare_part_compatibility(variant_id);
CREATE INDEX IF NOT EXISTS idx_spare_part_inv_part ON public.spare_part_inventory(spare_part_id);
CREATE INDEX IF NOT EXISTS idx_spare_part_inv_warehouse ON public.spare_part_inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_spare_part_tx_part ON public.spare_part_transactions(spare_part_id);
CREATE INDEX IF NOT EXISTS idx_spare_part_tx_from_wh ON public.spare_part_transactions(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_spare_part_tx_to_wh ON public.spare_part_transactions(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_spare_part_tx_ticket ON public.spare_part_transactions(reference_ticket_id);
CREATE INDEX IF NOT EXISTS idx_service_parts_spare_part_id ON public.service_parts(spare_part_id);

-- =====================================================================
-- 4. PHASE 3.4 & 3.4B: SERVICE CENTERS & TECHNICIAN TERRITORIES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.service_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_code TEXT UNIQUE NOT NULL,
    center_name TEXT NOT NULL,
    center_type TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    latitude NUMERIC NULL,
    longitude NUMERIC NULL,
    warehouse_id UUID NULL REFERENCES public.warehouses(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_service_center_type CHECK (
        center_type IN (
            'company_owned',
            'authorized_service_center',
            'third_party',
            'other'
        )
    )
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'service_tickets' 
          AND column_name = 'service_center_id'
    ) THEN
        ALTER TABLE public.service_tickets 
        ADD COLUMN service_center_id UUID NULL REFERENCES public.service_centers(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.service_center_technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_center_id UUID NOT NULL REFERENCES public.service_centers(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    active_from DATE NOT NULL DEFAULT CURRENT_DATE,
    active_to DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_center_technician UNIQUE (service_center_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.service_center_pincodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_center_id UUID NOT NULL REFERENCES public.service_centers(id) ON DELETE CASCADE,
    pincode TEXT NOT NULL,
    state TEXT,
    district TEXT,
    city TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_center_pincode UNIQUE (service_center_id, pincode)
);

DROP TRIGGER IF EXISTS trg_service_centers_updated_at ON public.service_centers;
CREATE TRIGGER trg_service_centers_updated_at
    BEFORE UPDATE ON public.service_centers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_service_centers_code ON public.service_centers(center_code);
CREATE INDEX IF NOT EXISTS idx_service_centers_type ON public.service_centers(center_type);
CREATE INDEX IF NOT EXISTS idx_service_tickets_center_id ON public.service_tickets(service_center_id);
CREATE INDEX IF NOT EXISTS idx_sc_technicians_center ON public.service_center_technicians(service_center_id);
CREATE INDEX IF NOT EXISTS idx_sc_technicians_profile ON public.service_center_technicians(profile_id);
CREATE INDEX IF NOT EXISTS idx_sc_pincodes_pincode ON public.service_center_pincodes(pincode);
CREATE INDEX IF NOT EXISTS idx_sc_pincodes_center ON public.service_center_pincodes(service_center_id);

-- =====================================================================
-- 5. PHASE 3.5: MEDIA / DOCUMENT ATTACHMENTS & PRIVATE STORAGE BUCKET
-- =====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'crm-attachments',
    'crm-attachments',
    false,
    20971520, -- 20 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/heic']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.media_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_bucket TEXT NOT NULL DEFAULT 'crm-attachments',
    storage_path TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT CHECK (file_size IS NULL OR file_size >= 0),
    attachment_type TEXT NOT NULL,
    customer_id UUID NULL REFERENCES public.customers(id) ON DELETE SET NULL,
    product_unit_id UUID NULL REFERENCES public.product_units(id) ON DELETE SET NULL,
    sale_id UUID NULL REFERENCES public.sales(id) ON DELETE SET NULL,
    warranty_id UUID NULL REFERENCES public.warranties(id) ON DELETE SET NULL,
    service_ticket_id UUID NULL REFERENCES public.service_tickets(id) ON DELETE SET NULL,
    service_update_id UUID NULL REFERENCES public.service_updates(id) ON DELETE SET NULL,
    uploaded_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT,
    CONSTRAINT chk_attachment_type CHECK (
        attachment_type IN (
            'serial_photo',
            'barcode_photo',
            'invoice',
            'warranty_document',
            'damage_photo',
            'service_photo',
            'repair_document',
            'customer_document',
            'other'
        )
    ),
    CONSTRAINT chk_media_target_exists CHECK (
        customer_id IS NOT NULL 
        OR product_unit_id IS NOT NULL 
        OR sale_id IS NOT NULL 
        OR warranty_id IS NOT NULL 
        OR service_ticket_id IS NOT NULL 
        OR service_update_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_media_customer_id ON public.media_attachments(customer_id);
CREATE INDEX IF NOT EXISTS idx_media_unit_id ON public.media_attachments(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_media_sale_id ON public.media_attachments(sale_id);
CREATE INDEX IF NOT EXISTS idx_media_warranty_id ON public.media_attachments(warranty_id);
CREATE INDEX IF NOT EXISTS idx_media_ticket_id ON public.media_attachments(service_ticket_id);
CREATE INDEX IF NOT EXISTS idx_media_update_id ON public.media_attachments(service_update_id);
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON public.media_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_storage_path ON public.media_attachments(storage_bucket, storage_path);

-- =====================================================================
-- 6. PHASE 3.6: ROW LEVEL SECURITY (RLS) ON ALL PHASE 3 TABLES & STORAGE
-- =====================================================================

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_part_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_part_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_part_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_center_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_center_pincodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_attachments ENABLE ROW LEVEL SECURITY;

-- WAREHOUSES POLICIES
DROP POLICY IF EXISTS "warehouses_select" ON public.warehouses;
CREATE POLICY "warehouses_select" ON public.warehouses
    FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'sales', 'service', 'support'));

DROP POLICY IF EXISTS "warehouses_insert" ON public.warehouses;
CREATE POLICY "warehouses_insert" ON public.warehouses
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

DROP POLICY IF EXISTS "warehouses_update" ON public.warehouses;
CREATE POLICY "warehouses_update" ON public.warehouses
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

DROP POLICY IF EXISTS "warehouses_delete" ON public.warehouses;
CREATE POLICY "warehouses_delete" ON public.warehouses
    FOR DELETE TO authenticated
    USING (public.get_current_user_role() = 'super_admin');

-- DEALERS POLICIES
DROP POLICY IF EXISTS "dealers_select" ON public.dealers;
CREATE POLICY "dealers_select" ON public.dealers
    FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory', 'service', 'support'));

DROP POLICY IF EXISTS "dealers_insert" ON public.dealers;
CREATE POLICY "dealers_insert" ON public.dealers
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'sales'));

DROP POLICY IF EXISTS "dealers_update" ON public.dealers;
CREATE POLICY "dealers_update" ON public.dealers
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'sales'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'sales'));

DROP POLICY IF EXISTS "dealers_delete" ON public.dealers;
CREATE POLICY "dealers_delete" ON public.dealers
    FOR DELETE TO authenticated
    USING (public.get_current_user_role() = 'super_admin');

-- SPARE PARTS POLICIES
DROP POLICY IF EXISTS "spare_parts_select" ON public.spare_parts;
CREATE POLICY "spare_parts_select" ON public.spare_parts
    FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service', 'sales', 'support'));

DROP POLICY IF EXISTS "spare_parts_insert" ON public.spare_parts;
CREATE POLICY "spare_parts_insert" ON public.spare_parts
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service'));

DROP POLICY IF EXISTS "spare_parts_update" ON public.spare_parts;
CREATE POLICY "spare_parts_update" ON public.spare_parts
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service'));

DROP POLICY IF EXISTS "spare_parts_delete" ON public.spare_parts;
CREATE POLICY "spare_parts_delete" ON public.spare_parts
    FOR DELETE TO authenticated
    USING (public.get_current_user_role() = 'super_admin');

-- SPARE PART COMPATIBILITY POLICIES
DROP POLICY IF EXISTS "spare_part_compatibility_select" ON public.spare_part_compatibility;
CREATE POLICY "spare_part_compatibility_select" ON public.spare_part_compatibility
    FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service', 'sales', 'support'));

DROP POLICY IF EXISTS "spare_part_compatibility_insert" ON public.spare_part_compatibility;
CREATE POLICY "spare_part_compatibility_insert" ON public.spare_part_compatibility
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service'));

DROP POLICY IF EXISTS "spare_part_compatibility_update" ON public.spare_part_compatibility;
CREATE POLICY "spare_part_compatibility_update" ON public.spare_part_compatibility
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service'));

DROP POLICY IF EXISTS "spare_part_compatibility_delete" ON public.spare_part_compatibility;
CREATE POLICY "spare_part_compatibility_delete" ON public.spare_part_compatibility
    FOR DELETE TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin'));

-- SPARE PART INVENTORY POLICIES
DROP POLICY IF EXISTS "spare_part_inventory_select" ON public.spare_part_inventory;
CREATE POLICY "spare_part_inventory_select" ON public.spare_part_inventory
    FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service', 'sales', 'support'));

DROP POLICY IF EXISTS "spare_part_inventory_insert" ON public.spare_part_inventory;
CREATE POLICY "spare_part_inventory_insert" ON public.spare_part_inventory
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service'));

DROP POLICY IF EXISTS "spare_part_inventory_update" ON public.spare_part_inventory;
CREATE POLICY "spare_part_inventory_update" ON public.spare_part_inventory
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service'));

DROP POLICY IF EXISTS "spare_part_inventory_delete" ON public.spare_part_inventory;
CREATE POLICY "spare_part_inventory_delete" ON public.spare_part_inventory
    FOR DELETE TO authenticated
    USING (public.get_current_user_role() = 'super_admin');

-- SPARE PART TRANSACTIONS POLICIES
DROP POLICY IF EXISTS "spare_part_transactions_select" ON public.spare_part_transactions;
CREATE POLICY "spare_part_transactions_select" ON public.spare_part_transactions
    FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service', 'sales', 'support'));

DROP POLICY IF EXISTS "spare_part_transactions_insert" ON public.spare_part_transactions;
CREATE POLICY "spare_part_transactions_insert" ON public.spare_part_transactions
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'service'));

DROP POLICY IF EXISTS "spare_part_transactions_update" ON public.spare_part_transactions;
CREATE POLICY "spare_part_transactions_update" ON public.spare_part_transactions
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() = 'super_admin')
    WITH CHECK (public.get_current_user_role() = 'super_admin');

DROP POLICY IF EXISTS "spare_part_transactions_delete" ON public.spare_part_transactions;
CREATE POLICY "spare_part_transactions_delete" ON public.spare_part_transactions
    FOR DELETE TO authenticated
    USING (public.get_current_user_role() = 'super_admin');

-- SERVICE CENTERS POLICIES
DROP POLICY IF EXISTS "service_centers_select" ON public.service_centers;
CREATE POLICY "service_centers_select" ON public.service_centers
    FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'service', 'support', 'inventory', 'sales'));

DROP POLICY IF EXISTS "service_centers_insert" ON public.service_centers;
CREATE POLICY "service_centers_insert" ON public.service_centers
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'service'));

DROP POLICY IF EXISTS "service_centers_update" ON public.service_centers;
CREATE POLICY "service_centers_update" ON public.service_centers
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'service'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'service'));

DROP POLICY IF EXISTS "service_centers_delete" ON public.service_centers;
CREATE POLICY "service_centers_delete" ON public.service_centers
    FOR DELETE TO authenticated
    USING (public.get_current_user_role() = 'super_admin');

-- SERVICE CENTER TECHNICIANS POLICIES
DROP POLICY IF EXISTS "sc_technicians_select" ON public.service_center_technicians;
CREATE POLICY "sc_technicians_select" ON public.service_center_technicians
    FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'service', 'support'));

DROP POLICY IF EXISTS "sc_technicians_insert" ON public.service_center_technicians;
CREATE POLICY "sc_technicians_insert" ON public.service_center_technicians
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'service'));

DROP POLICY IF EXISTS "sc_technicians_update" ON public.service_center_technicians;
CREATE POLICY "sc_technicians_update" ON public.service_center_technicians
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'service'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'service'));

DROP POLICY IF EXISTS "sc_technicians_delete" ON public.service_center_technicians;
CREATE POLICY "sc_technicians_delete" ON public.service_center_technicians
    FOR DELETE TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin'));

-- SERVICE CENTER PINCODES POLICIES
DROP POLICY IF EXISTS "sc_pincodes_select" ON public.service_center_pincodes;
CREATE POLICY "sc_pincodes_select" ON public.service_center_pincodes
    FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'service', 'support', 'sales', 'inventory'));

DROP POLICY IF EXISTS "sc_pincodes_insert" ON public.service_center_pincodes;
CREATE POLICY "sc_pincodes_insert" ON public.service_center_pincodes
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'service'));

DROP POLICY IF EXISTS "sc_pincodes_update" ON public.service_center_pincodes;
CREATE POLICY "sc_pincodes_update" ON public.service_center_pincodes
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'service'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'service'));

DROP POLICY IF EXISTS "sc_pincodes_delete" ON public.service_center_pincodes;
CREATE POLICY "sc_pincodes_delete" ON public.service_center_pincodes
    FOR DELETE TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin'));

-- MEDIA ATTACHMENTS POLICIES
DROP POLICY IF EXISTS "media_attachments_select" ON public.media_attachments;
CREATE POLICY "media_attachments_select" ON public.media_attachments
    FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'service', 'support', 'sales', 'inventory'));

DROP POLICY IF EXISTS "media_attachments_insert" ON public.media_attachments;
CREATE POLICY "media_attachments_insert" ON public.media_attachments
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'service', 'support', 'sales', 'inventory'));

DROP POLICY IF EXISTS "media_attachments_update" ON public.media_attachments;
CREATE POLICY "media_attachments_update" ON public.media_attachments
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'service'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'service'));

DROP POLICY IF EXISTS "media_attachments_delete" ON public.media_attachments;
CREATE POLICY "media_attachments_delete" ON public.media_attachments
    FOR DELETE TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin'));

-- STORAGE OBJECTS POLICIES FOR 'crm-attachments'
DROP POLICY IF EXISTS "storage_crm_attachments_select" ON storage.objects;
CREATE POLICY "storage_crm_attachments_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'crm-attachments' AND public.get_current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "storage_crm_attachments_insert" ON storage.objects;
CREATE POLICY "storage_crm_attachments_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'crm-attachments' AND public.get_current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "storage_crm_attachments_update" ON storage.objects;
CREATE POLICY "storage_crm_attachments_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'crm-attachments' AND public.get_current_user_role() IN ('super_admin', 'admin', 'service'))
    WITH CHECK (bucket_id = 'crm-attachments' AND public.get_current_user_role() IN ('super_admin', 'admin', 'service'));

DROP POLICY IF EXISTS "storage_crm_attachments_delete" ON storage.objects;
CREATE POLICY "storage_crm_attachments_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'crm-attachments' AND public.get_current_user_role() IN ('super_admin', 'admin'));

-- =====================================================================
-- 7. PHASE 3.7: REPORTING & ANALYTICAL VIEWS (SECURITY_INVOKER = TRUE)
-- =====================================================================

CREATE OR REPLACE VIEW public.stock_by_warehouse
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
    COUNT(CASE WHEN pu.status = 'in_stock' THEN 1 END) AS in_stock_units,
    COUNT(CASE WHEN pu.status = 'reserved' THEN 1 END) AS reserved_units,
    COUNT(CASE WHEN pu.status = 'sold' THEN 1 END) AS sold_units,
    COUNT(CASE WHEN pu.status = 'in_service' THEN 1 END) AS in_service_units,
    COUNT(CASE WHEN pu.status = 'returned' THEN 1 END) AS returned_units,
    COUNT(CASE WHEN pu.status = 'damaged' THEN 1 END) AS damaged_units
FROM public.warehouses w
LEFT JOIN public.product_units pu ON pu.warehouse_id = w.id
GROUP BY w.id, w.warehouse_code, w.warehouse_name, w.warehouse_type, w.city, w.state;

CREATE OR REPLACE VIEW public.dealer_sales_summary
WITH (security_invoker = true)
AS
SELECT 
    d.id AS dealer_id,
    d.dealer_code,
    d.dealer_name,
    d.dealer_type,
    d.city,
    d.state,
    COUNT(s.id) AS total_orders,
    COALESCE(SUM(s.total_amount), 0) AS total_sales_value,
    COALESCE(SUM(CASE WHEN s.payment_status = 'paid' THEN s.total_amount ELSE 0 END), 0) AS total_paid_value,
    COALESCE(SUM(CASE WHEN s.payment_status IN ('pending', 'partial') THEN s.total_amount ELSE 0 END), 0) AS total_outstanding_value,
    COUNT(DISTINCT w.id) AS total_warranties_registered
FROM public.dealers d
LEFT JOIN public.sales s ON s.dealer_id = d.id
LEFT JOIN public.warranties w ON w.dealer_id = d.id
GROUP BY d.id, d.dealer_code, d.dealer_name, d.dealer_type, d.city, d.state;

CREATE OR REPLACE VIEW public.spare_parts_stock_summary
WITH (security_invoker = true)
AS
SELECT 
    sp.id AS spare_part_id,
    sp.part_code,
    sp.part_name,
    sp.category,
    sp.unit_of_measure,
    sp.standard_cost,
    sp.selling_price,
    sp.reorder_level AS global_reorder_level,
    COALESCE(SUM(spi.quantity_on_hand), 0) AS total_quantity_on_hand,
    COALESCE(SUM(spi.quantity_reserved), 0) AS total_quantity_reserved,
    COALESCE(SUM(spi.quantity_on_hand - spi.quantity_reserved), 0) AS total_quantity_available,
    CASE 
        WHEN COALESCE(SUM(spi.quantity_on_hand), 0) <= sp.reorder_level THEN 'reorder_needed'
        ELSE 'in_stock'
    END AS stock_health_status
FROM public.spare_parts sp
LEFT JOIN public.spare_part_inventory spi ON spi.spare_part_id = sp.id
GROUP BY sp.id, sp.part_code, sp.part_name, sp.category, sp.unit_of_measure, sp.standard_cost, sp.selling_price, sp.reorder_level;

CREATE OR REPLACE VIEW public.spare_parts_consumption
WITH (security_invoker = true)
AS
SELECT 
    sp.id AS spare_part_id,
    sp.part_code,
    sp.part_name,
    sp.category,
    COUNT(stp.id) AS usage_count,
    COALESCE(SUM(stp.quantity), 0) AS total_quantity_used,
    COALESCE(SUM(CASE WHEN stp.warranty_covered THEN stp.quantity * stp.unit_cost ELSE 0 END), 0) AS warranty_covered_cost,
    COALESCE(SUM(CASE WHEN NOT stp.warranty_covered THEN stp.quantity * stp.unit_cost ELSE 0 END), 0) AS chargeable_cost,
    COALESCE(SUM(stp.quantity * stp.unit_cost), 0) AS total_cost
FROM public.spare_parts sp
LEFT JOIN public.service_parts stp ON stp.spare_part_id = sp.id
GROUP BY sp.id, sp.part_code, sp.part_name, sp.category;

CREATE OR REPLACE VIEW public.service_center_workload
WITH (security_invoker = true)
AS
SELECT 
    sc.id AS service_center_id,
    sc.center_code,
    sc.center_name,
    sc.center_type,
    sc.city,
    sc.state,
    COUNT(st.id) AS total_tickets,
    COUNT(CASE WHEN st.status IN ('open', 'assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_parts') THEN 1 END) AS active_tickets,
    COUNT(CASE WHEN st.status = 'resolved' THEN 1 END) AS resolved_tickets,
    COUNT(CASE WHEN st.status = 'closed' THEN 1 END) AS closed_tickets,
    COUNT(CASE WHEN st.priority = 'urgent' AND st.status NOT IN ('resolved', 'closed', 'cancelled') THEN 1 END) AS urgent_open_tickets,
    COUNT(DISTINCT sct.profile_id) AS assigned_technicians_count
FROM public.service_centers sc
LEFT JOIN public.service_tickets st ON st.service_center_id = sc.id
LEFT JOIN public.service_center_technicians sct ON sct.service_center_id = sc.id
GROUP BY sc.id, sc.center_code, sc.center_name, sc.center_type, sc.city, sc.state;

CREATE OR REPLACE VIEW public.service_territory_coverage
WITH (security_invoker = true)
AS
SELECT 
    scp.id AS coverage_id,
    scp.pincode,
    scp.city,
    scp.district,
    scp.state,
    scp.is_active AS coverage_active,
    sc.id AS service_center_id,
    sc.center_code,
    sc.center_name,
    sc.center_type,
    sc.phone AS center_phone,
    sc.email AS center_email
FROM public.service_center_pincodes scp
JOIN public.service_centers sc ON sc.id = scp.service_center_id;

COMMIT;
