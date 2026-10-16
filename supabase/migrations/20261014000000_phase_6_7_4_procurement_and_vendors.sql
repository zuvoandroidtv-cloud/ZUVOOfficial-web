-- =============================================================================
-- PHASE 6.7.4 — VENDOR / PROCUREMENT / PURCHASE ORDERS
-- MIGRATION: 20261014000000_phase_6_7_4_procurement_and_vendors.sql
-- =============================================================================

-- 1. Extend inventory_transactions & notifications check constraints
ALTER TABLE public.inventory_transactions 
  DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

ALTER TABLE public.inventory_transactions 
  ADD CONSTRAINT inventory_transactions_transaction_type_check 
  CHECK (transaction_type IN (
    'stock_received', 'reserved', 'sale', 'return', 'service', 
    'service_completed', 'damaged', 'stock_adjustment', 'warehouse_transfer',
    'DISPATCH_TO_DEALER', 'DEALER_SALE', 'DEALER_RECEIPT', 'DEALER_DISCREPANCY',
    'CONSIGNMENT_RECALL', 'DEALER_TRANSFER', 'CONSIGNMENT_SETTLEMENT', 'RECONCILIATION',
    'GOODS_RECEIPT', 'VENDOR_RETURN'
  ));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS chk_notifications_type;
ALTER TABLE public.notifications ADD CONSTRAINT chk_notifications_type 
CHECK (notification_type IN (
    'sale_created', 'sale_completed', 'payment_received', 'inventory_low', 'inventory_transfer', 
    'warranty_registered', 'warranty_expiring', 'service_created', 'service_updated', 'service_completed', 
    'spare_part_low_stock', 'rma_created', 'system_alert', 'PO_SUBMITTED', 'GOODS_RECEIVED'
));

ALTER TABLE public.product_units DROP CONSTRAINT IF EXISTS product_units_status_check;
ALTER TABLE public.product_units ADD CONSTRAINT product_units_status_check 
CHECK (status IN (
    'in_stock', 'reserved', 'in_transit', 'sold', 'returned', 'in_service', 'damaged', 'return_pending'
));

-- 2. VENDORS MASTER TABLE
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_code TEXT NOT NULL UNIQUE,
    legal_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    vendor_type TEXT NOT NULL DEFAULT 'manufacturer' CHECK (vendor_type IN ('manufacturer', 'distributor', 'importer', 'component_supplier', 'other')),
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    country TEXT NOT NULL DEFAULT 'India',
    gstin TEXT,
    tax_identifier TEXT,
    payment_terms TEXT NOT NULL DEFAULT 'NET_30' CHECK (payment_terms IN ('ADVANCE', 'IMMEDIATE', 'NET_15', 'NET_30', 'NET_60', 'NET_90', 'CONSIGNMENT')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. VENDOR CONTACTS TABLE
CREATE TABLE IF NOT EXISTS public.vendor_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    designation TEXT,
    phone TEXT,
    email TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PURCHASE ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number TEXT NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    po_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'partially_received', 'fully_received', 'cancelled', 'closed')),
    currency TEXT NOT NULL DEFAULT 'INR',
    subtotal NUMERIC NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax_amount NUMERIC NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_amount NUMERIC NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. PURCHASE ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    ordered_quantity INTEGER NOT NULL CHECK (ordered_quantity > 0),
    received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
    unit_cost NUMERIC NOT NULL CHECK (unit_cost >= 0),
    tax_rate NUMERIC NOT NULL DEFAULT 18.00 CHECK (tax_rate >= 0),
    tax_amount NUMERIC NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    line_total NUMERIC NOT NULL DEFAULT 0.00 CHECK (line_total >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. PURCHASE RECEIPTS TABLE
CREATE TABLE IF NOT EXISTS public.purchase_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number TEXT NOT NULL UNIQUE,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('draft', 'received', 'partially_received', 'completed', 'cancelled')),
    delivery_note_number TEXT,
    vendor_invoice_reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. PURCHASE RECEIPT ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.purchase_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_receipt_id UUID NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
    purchase_order_item_id UUID NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE RESTRICT,
    product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    expected_quantity INTEGER NOT NULL DEFAULT 0 CHECK (expected_quantity >= 0),
    received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
    accepted_quantity INTEGER NOT NULL DEFAULT 0 CHECK (accepted_quantity >= 0),
    rejected_quantity INTEGER NOT NULL DEFAULT 0 CHECK (rejected_quantity >= 0),
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. VENDOR RETURNS TABLE
CREATE TABLE IF NOT EXISTS public.vendor_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number TEXT NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    purchase_receipt_id UUID REFERENCES public.purchase_receipts(id) ON DELETE SET NULL,
    return_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'in_transit', 'returned', 'rejected', 'cancelled')),
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    returned_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. INDEXES FOR PROCUREMENT PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_vendors_code ON public.vendors(vendor_code);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON public.vendors(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON public.purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_wh ON public.purchase_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_po ON public.purchase_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_vendor ON public.purchase_receipts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_returns_unit ON public.vendor_returns(product_unit_id);

-- 10. ENABLE RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_returns ENABLE ROW LEVEL SECURITY;

-- Staff Read Policy for Vendors and Procurement
CREATE POLICY "Staff read procurement data"
  ON public.vendors FOR SELECT
  USING (
    public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'sales', 'service', 'support')
  );

CREATE POLICY "Staff read vendor contacts"
  ON public.vendor_contacts FOR SELECT
  USING (
    public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'sales', 'service', 'support')
  );

CREATE POLICY "Staff read purchase orders"
  ON public.purchase_orders FOR SELECT
  USING (
    public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'sales', 'service', 'support')
  );

CREATE POLICY "Staff read purchase order items"
  ON public.purchase_order_items FOR SELECT
  USING (
    public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'sales', 'service', 'support')
  );

CREATE POLICY "Staff read purchase receipts"
  ON public.purchase_receipts FOR SELECT
  USING (
    public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'sales', 'service', 'support')
  );

CREATE POLICY "Staff read purchase receipt items"
  ON public.purchase_receipt_items FOR SELECT
  USING (
    public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'sales', 'service', 'support')
  );

CREATE POLICY "Staff read vendor returns"
  ON public.vendor_returns FOR SELECT
  USING (
    public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'sales', 'service', 'support')
  );

-- Procurement Management Write Policies (Admin, Super Admin, Inventory)
CREATE POLICY "Procurement staff manage vendors"
  ON public.vendors FOR ALL
  USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'))
  WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Procurement staff manage vendor contacts"
  ON public.vendor_contacts FOR ALL
  USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'))
  WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Procurement staff manage purchase orders"
  ON public.purchase_orders FOR ALL
  USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'))
  WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Procurement staff manage purchase order items"
  ON public.purchase_order_items FOR ALL
  USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'))
  WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Procurement staff manage purchase receipts"
  ON public.purchase_receipts FOR ALL
  USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'))
  WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Procurement staff manage purchase receipt items"
  ON public.purchase_receipt_items FOR ALL
  USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'))
  WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Procurement staff manage vendor returns"
  ON public.vendor_returns FOR ALL
  USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'))
  WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));


-- =============================================================================
-- 11. PROCUREMENT SECURITY DEFINER RPCS
-- =============================================================================

-- RPC 1: Create Purchase Order (Draft)
CREATE OR REPLACE FUNCTION public.fn_create_purchase_order(
    p_vendor_id UUID,
    p_warehouse_id UUID,
    p_expected_delivery_date DATE,
    p_notes TEXT,
    p_items JSONB -- Array of { product_variant_id, ordered_quantity, unit_cost, tax_rate, notes }
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_role TEXT;
    v_actor_id UUID;
    v_po_id UUID;
    v_po_number TEXT;
    v_item JSONB;
    v_variant_id UUID;
    v_qty INT;
    v_unit_cost NUMERIC;
    v_tax_rate NUMERIC;
    v_tax_amt NUMERIC;
    v_line_total NUMERIC;
    v_subtotal NUMERIC := 0.00;
    v_total_tax NUMERIC := 0.00;
    v_total_amt NUMERIC := 0.00;
BEGIN
    v_actor_id := auth.uid();
    v_user_role := public.get_current_user_role();

    IF v_user_role NOT IN ('super_admin', 'admin', 'inventory') THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized: Insufficient permissions for procurement PO creation');
    END IF;

    -- Validate Vendor & Warehouse
    IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE id = p_vendor_id AND status = 'active') THEN
        RETURN json_build_object('success', false, 'message', 'Invalid or inactive vendor specified');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = p_warehouse_id AND is_active = true) THEN
        RETURN json_build_object('success', false, 'message', 'Invalid or inactive warehouse specified');
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN json_build_object('success', false, 'message', 'Purchase Order must contain at least one product line item');
    END IF;

    -- Generate PO Number: PO-YYYYMMDD-XXXX
    v_po_number := 'PO-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

    -- Insert PO Header in Draft status
    INSERT INTO public.purchase_orders (
        po_number, vendor_id, warehouse_id, po_date, expected_delivery_date,
        status, currency, subtotal, tax_amount, total_amount, notes, created_by
    ) VALUES (
        v_po_number, p_vendor_id, p_warehouse_id, CURRENT_DATE, p_expected_delivery_date,
        'draft', 'INR', 0, 0, 0, p_notes, v_actor_id
    ) RETURNING id INTO v_po_id;

    -- Process Line Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_variant_id := (v_item->>'product_variant_id')::UUID;
        v_qty := (v_item->>'ordered_quantity')::INT;
        v_unit_cost := (v_item->>'unit_cost')::NUMERIC;
        v_tax_rate := COALESCE((v_item->>'tax_rate')::NUMERIC, 18.00);

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Ordered quantity must be greater than zero';
        END IF;
        IF v_unit_cost < 0 THEN
            RAISE EXCEPTION 'Unit cost cannot be negative';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = v_variant_id) THEN
            RAISE EXCEPTION 'Invalid product variant ID %', v_variant_id;
        END IF;

        v_tax_amt := round((v_qty * v_unit_cost * (v_tax_rate / 100.00)), 2);
        v_line_total := round((v_qty * v_unit_cost) + v_tax_amt, 2);

        v_subtotal := v_subtotal + (v_qty * v_unit_cost);
        v_total_tax := v_total_tax + v_tax_amt;
        v_total_amt := v_total_amt + v_line_total;

        INSERT INTO public.purchase_order_items (
            purchase_order_id, product_variant_id, ordered_quantity, received_quantity,
            unit_cost, tax_rate, tax_amount, line_total, notes
        ) VALUES (
            v_po_id, v_variant_id, v_qty, 0,
            v_unit_cost, v_tax_rate, v_tax_amt, v_line_total, v_item->>'notes'
        );
    END LOOP;

    -- Update PO Totals
    UPDATE public.purchase_orders
    SET subtotal = round(v_subtotal, 2),
        tax_amount = round(v_total_tax, 2),
        total_amount = round(v_total_amt, 2)
    WHERE id = v_po_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Purchase Order created successfully in Draft status',
        'po_id', v_po_id,
        'po_number', v_po_number,
        'total_amount', v_total_amt
    );
END;
$$;


-- RPC 2: Submit Purchase Order
CREATE OR REPLACE FUNCTION public.fn_submit_purchase_order(
    p_po_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_role TEXT;
    v_po RECORD;
BEGIN
    v_user_role := public.get_current_user_role();

    IF v_user_role NOT IN ('super_admin', 'admin', 'inventory') THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized to submit purchase orders');
    END IF;

    SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Purchase Order not found');
    END IF;

    IF v_po.status != 'draft' THEN
        RETURN json_build_object('success', false, 'message', 'Only DRAFT Purchase Orders can be submitted');
    END IF;

    UPDATE public.purchase_orders
    SET status = 'submitted',
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = p_po_id;

    -- Trigger Notification
    PERFORM public.create_notification(
        p_recipient_user_id := (SELECT id FROM auth.users LIMIT 1),
        p_title := 'Purchase Order Submitted',
        p_message := 'Purchase Order ' || v_po.po_number || ' submitted for approval.',
        p_notification_type := 'PO_SUBMITTED',
        p_severity := 'info',
        p_entity_type := 'purchase_order',
        p_entity_id := p_po_id,
        p_action_url := '/purchase-orders'
    );

    RETURN json_build_object('success', true, 'message', 'Purchase Order submitted for approval', 'po_number', v_po.po_number);
END;
$$;


-- RPC 3: Approve Purchase Order
CREATE OR REPLACE FUNCTION public.fn_approve_purchase_order(
    p_po_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_role TEXT;
    v_actor_id UUID;
    v_po RECORD;
BEGIN
    v_actor_id := auth.uid();
    v_user_role := public.get_current_user_role();

    IF v_user_role NOT IN ('super_admin', 'admin') THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized: Only Admin or Super Admin can approve Purchase Orders');
    END IF;

    SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Purchase Order not found');
    END IF;

    IF v_po.status NOT IN ('draft', 'submitted') THEN
        RETURN json_build_object('success', false, 'message', 'Only DRAFT or SUBMITTED Purchase Orders can be approved');
    END IF;

    UPDATE public.purchase_orders
    SET status = 'approved',
        approved_by = v_actor_id,
        approved_at = now(),
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = p_po_id;

    RETURN json_build_object('success', true, 'message', 'Purchase Order approved successfully', 'po_number', v_po.po_number);
END;
$$;


-- RPC 4: Cancel Purchase Order
CREATE OR REPLACE FUNCTION public.fn_cancel_purchase_order(
    p_po_id UUID,
    p_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_role TEXT;
    v_actor_id UUID;
    v_po RECORD;
BEGIN
    v_actor_id := auth.uid();
    v_user_role := public.get_current_user_role();

    IF v_user_role NOT IN ('super_admin', 'admin', 'inventory') THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized to cancel purchase orders');
    END IF;

    SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Purchase Order not found');
    END IF;

    IF v_po.status IN ('fully_received', 'closed', 'cancelled') THEN
        RETURN json_build_object('success', false, 'message', 'Cannot cancel a fully received, closed, or already cancelled PO');
    END IF;

    UPDATE public.purchase_orders
    SET status = 'cancelled',
        cancelled_by = v_actor_id,
        cancelled_at = now(),
        cancellation_reason = p_reason,
        updated_at = now()
    WHERE id = p_po_id;

    RETURN json_build_object('success', true, 'message', 'Purchase Order cancelled successfully', 'po_number', v_po.po_number);
END;
$$;


-- RPC 5: Goods Receipt Atomic Workflow (fn_receive_purchase_goods)
CREATE OR REPLACE FUNCTION public.fn_receive_purchase_goods(
    p_po_id UUID,
    p_delivery_note_number TEXT,
    p_vendor_invoice_reference TEXT,
    p_received_items JSONB, -- Array of { po_item_id, accepted_quantity, rejected_quantity, rejection_reason, notes }
    p_serials_barcodes JSONB, -- Array of { po_item_id, serial_number, barcode } (optional barcode)
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID;
    v_user_role TEXT;
    v_po RECORD;
    v_receipt_id UUID;
    v_receipt_number TEXT;
    v_item JSONB;
    v_po_item_id UUID;
    v_accepted_qty INT;
    v_rejected_qty INT;
    v_total_rec INT;
    v_po_item RECORD;
    v_new_unit_id UUID;
    v_serial TEXT;
    v_barcode TEXT;
    v_unit_elem JSONB;
    v_unit_idx INT;
    v_all_po_items RECORD;
    v_any_remaining BOOLEAN := false;
    v_all_received BOOLEAN := true;
BEGIN
    v_actor_id := auth.uid();
    v_user_role := public.get_current_user_role();

    IF v_user_role NOT IN ('super_admin', 'admin', 'inventory') THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized: Insufficient permissions for goods receiving');
    END IF;

    SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Purchase Order not found');
    END IF;

    IF v_po.status NOT IN ('approved', 'partially_received') THEN
        RETURN json_build_object('success', false, 'message', 'Goods can only be received against APPROVED or PARTIALLY_RECEIVED purchase orders');
    END IF;

    IF p_received_items IS NULL OR jsonb_array_length(p_received_items) = 0 THEN
        RETURN json_build_object('success', false, 'message', 'No receiving items supplied');
    END IF;

    -- Generate Receipt Number: GRN-YYYYMMDD-XXXX
    v_receipt_number := 'GRN-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

    -- Create Purchase Receipt Header
    INSERT INTO public.purchase_receipts (
        receipt_number, purchase_order_id, vendor_id, warehouse_id,
        received_at, received_by, status, delivery_note_number, vendor_invoice_reference, notes
    ) VALUES (
        v_receipt_number, p_po_id, v_po.vendor_id, v_po.warehouse_id,
        now(), v_actor_id, 'completed', p_delivery_note_number, p_vendor_invoice_reference, p_notes
    ) RETURNING id INTO v_receipt_id;

    -- Process Each Item Receipt Line
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_received_items)
    LOOP
        v_po_item_id := (v_item->>'po_item_id')::UUID;
        v_accepted_qty := COALESCE((v_item->>'accepted_quantity')::INT, 0);
        v_rejected_qty := COALESCE((v_item->>'rejected_quantity')::INT, 0);
        v_total_rec := v_accepted_qty + v_rejected_qty;

        IF v_accepted_qty < 0 OR v_rejected_qty < 0 THEN
            RAISE EXCEPTION 'Received quantities cannot be negative';
        END IF;

        SELECT * INTO v_po_item FROM public.purchase_order_items WHERE id = v_po_item_id AND purchase_order_id = p_po_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'PO Line item % not found for this Purchase Order', v_po_item_id;
        END IF;

        IF (v_po_item.received_quantity + v_total_rec) > v_po_item.ordered_quantity THEN
            RAISE EXCEPTION 'Over-receipt error: Total received quantity (%) exceeds ordered quantity (%) for item %',
                (v_po_item.received_quantity + v_total_rec), v_po_item.ordered_quantity, v_po_item.product_variant_id;
        END IF;

        -- Record Purchase Receipt Item
        INSERT INTO public.purchase_receipt_items (
            purchase_receipt_id, purchase_order_item_id, product_variant_id,
            expected_quantity, received_quantity, accepted_quantity, rejected_quantity,
            rejection_reason, notes
        ) VALUES (
            v_receipt_id, v_po_item_id, v_po_item.product_variant_id,
            (v_po_item.ordered_quantity - v_po_item.received_quantity), v_total_rec,
            v_accepted_qty, v_rejected_qty, v_item->>'rejection_reason', v_item->>'notes'
        );

        -- Create Product Units for Accepted Items
        IF v_accepted_qty > 0 THEN
            FOR v_unit_idx IN 1..v_accepted_qty LOOP
                v_serial := NULL;
                v_barcode := NULL;

                -- Extract custom serial/barcode if provided
                IF p_serials_barcodes IS NOT NULL AND jsonb_array_length(p_serials_barcodes) >= v_unit_idx THEN
                    SELECT (elem->>'serial_number'), (elem->>'barcode') 
                    INTO v_serial, v_barcode
                    FROM jsonb_array_elements(p_serials_barcodes) elem
                    WHERE (elem->>'po_item_id')::UUID = v_po_item_id
                    LIMIT 1 OFFSET (v_unit_idx - 1);
                END IF;

                IF v_serial IS NULL OR trim(v_serial) = '' THEN
                    v_serial := 'SN-' || to_char(now(), 'YYMMDD') || '-' || lpad(floor(random() * 100000)::text, 5, '0');
                END IF;

                IF v_barcode IS NULL OR trim(v_barcode) = '' THEN
                    v_barcode := public.generate_product_unit_barcode();
                END IF;

                -- Check Duplicate Barcode/Serial
                IF EXISTS (SELECT 1 FROM public.product_units WHERE serial_number = v_serial OR barcode = v_barcode) THEN
                    v_serial := v_serial || '-' || floor(random() * 1000)::text;
                    v_barcode := public.generate_product_unit_barcode();
                END IF;

                -- Insert Accepted Unit into Inventory
                INSERT INTO public.product_units (
                    variant_id, serial_number, barcode, status, ownership_type,
                    purchase_cost, warehouse_id, received_at, notes
                ) VALUES (
                    v_po_item.product_variant_id, v_serial, v_barcode, 'in_stock', 'zuvo_owned',
                    v_po_item.unit_cost, v_po.warehouse_id, now(), 'Received via GRN ' || v_receipt_number
                ) RETURNING id INTO v_new_unit_id;

                -- Create Inventory Transaction
                INSERT INTO public.inventory_transactions (
                    product_unit_id, transaction_type, previous_status, new_status,
                    reference_note, performed_by, to_warehouse_id, movement_reason
                ) VALUES (
                    v_new_unit_id, 'GOODS_RECEIPT', 'unreceived', 'in_stock',
                    'GRN ' || v_receipt_number || ' | PO ' || v_po.po_number, v_actor_id, v_po.warehouse_id, 'PO Goods Receipt'
                );
            END LOOP;
        END IF;

        -- Update PO Line Item Received Qty
        UPDATE public.purchase_order_items
        SET received_quantity = received_quantity + v_total_rec,
            updated_at = now()
        WHERE id = v_po_item_id;
    END LOOP;

    -- Evaluate PO Status (Partially vs Fully Received)
    FOR v_all_po_items IN SELECT ordered_quantity, received_quantity FROM public.purchase_order_items WHERE purchase_order_id = p_po_id
    LOOP
        IF v_all_po_items.received_quantity < v_all_po_items.ordered_quantity THEN
            v_all_received := false;
            v_any_remaining := true;
        END IF;
    END LOOP;

    IF v_all_received THEN
        UPDATE public.purchase_orders SET status = 'fully_received', updated_at = now() WHERE id = p_po_id;
    ELSE
        UPDATE public.purchase_orders SET status = 'partially_received', updated_at = now() WHERE id = p_po_id;
    END IF;

    -- Notification
    PERFORM public.create_notification(
        p_recipient_user_id := (SELECT id FROM auth.users LIMIT 1),
        p_title := 'Goods Received',
        p_message := 'Goods Receipt ' || v_receipt_number || ' processed for PO ' || v_po.po_number,
        p_notification_type := 'GOODS_RECEIVED',
        p_severity := 'info',
        p_entity_type := 'purchase_receipt',
        p_entity_id := v_receipt_id,
        p_action_url := '/purchase-receipts'
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Goods received and inventory units created successfully',
        'receipt_id', v_receipt_id,
        'receipt_number', v_receipt_number,
        'po_status', CASE WHEN v_all_received THEN 'fully_received' ELSE 'partially_received' END
    );
END;
$$;


-- RPC 6: Create Vendor Return (fn_create_vendor_return)
CREATE OR REPLACE FUNCTION public.fn_create_vendor_return(
    p_vendor_id UUID,
    p_product_unit_id UUID,
    p_return_reason TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID;
    v_user_role TEXT;
    v_unit RECORD;
    v_return_id UUID;
    v_return_number TEXT;
BEGIN
    v_actor_id := auth.uid();
    v_user_role := public.get_current_user_role();

    IF v_user_role NOT IN ('super_admin', 'admin', 'inventory') THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized to initiate vendor returns');
    END IF;

    SELECT * INTO v_unit FROM public.product_units WHERE id = p_product_unit_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Product unit not found');
    END IF;

    IF v_unit.status = 'sold' THEN
        RETURN json_build_object('success', false, 'message', 'Cannot return a customer-sold unit directly to vendor without RMA return');
    END IF;

    v_return_number := 'VR-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

    INSERT INTO public.vendor_returns (
        return_number, vendor_id, product_unit_id, return_reason, status, requested_by, notes
    ) VALUES (
        v_return_number, p_vendor_id, p_product_unit_id, p_return_reason, 'requested', v_actor_id, p_notes
    ) RETURNING id INTO v_return_id;

    -- Update unit status
    UPDATE public.product_units
    SET status = 'return_pending', notes = COALESCE(notes, '') || ' | Vendor Return Requested ' || v_return_number
    WHERE id = p_product_unit_id;

    -- Create Inventory Transaction
    INSERT INTO public.inventory_transactions (
        product_unit_id, transaction_type, previous_status, new_status,
        reference_note, performed_by, movement_reason
    ) VALUES (
        p_product_unit_id, 'VENDOR_RETURN', v_unit.status, 'return_pending',
        'Vendor Return ' || v_return_number, v_actor_id, p_return_reason
    );

    RETURN json_build_object('success', true, 'message', 'Vendor return requested successfully', 'return_number', v_return_number);
END;
$$;


-- =============================================================================
-- 12. PROCUREMENT REPORTING VIEWS (security_invoker = true)
-- =============================================================================

CREATE OR REPLACE VIEW public.vw_vendor_purchase_summary
WITH (security_invoker = true)
AS
SELECT 
    v.id AS vendor_id,
    v.vendor_code,
    v.legal_name AS vendor_name,
    v.vendor_type,
    v.status AS vendor_status,
    COUNT(DISTINCT po.id) AS total_purchase_orders,
    COALESCE(SUM(po.total_amount), 0.00) AS total_purchase_value,
    COALESCE(SUM(poi.ordered_quantity), 0) AS total_units_ordered,
    COALESCE(SUM(poi.received_quantity), 0) AS total_units_received
FROM public.vendors v
LEFT JOIN public.purchase_orders po ON po.vendor_id = v.id AND po.status != 'cancelled'
LEFT JOIN public.purchase_order_items poi ON poi.purchase_order_id = po.id
GROUP BY v.id, v.vendor_code, v.legal_name, v.vendor_type, v.status;


CREATE OR REPLACE VIEW public.vw_vendor_receiving_performance
WITH (security_invoker = true)
AS
SELECT 
    v.id AS vendor_id,
    v.vendor_code,
    v.legal_name AS vendor_name,
    COUNT(DISTINCT pr.id) AS total_receipts,
    COALESCE(SUM(pri.accepted_quantity), 0) AS total_accepted_units,
    COALESCE(SUM(pri.rejected_quantity), 0) AS total_rejected_units,
    CASE 
        WHEN COALESCE(SUM(pri.received_quantity), 0) > 0 
        THEN round((SUM(pri.rejected_quantity)::numeric / SUM(pri.received_quantity)::numeric * 100.0), 2)
        ELSE 0.00 
    END AS rejection_rate_percentage
FROM public.vendors v
LEFT JOIN public.purchase_receipts pr ON pr.vendor_id = v.id
LEFT JOIN public.purchase_receipt_items pri ON pri.purchase_receipt_id = pr.id
GROUP BY v.id, v.vendor_code, v.legal_name;


CREATE OR REPLACE VIEW public.vw_vendor_discrepancy_summary
WITH (security_invoker = true)
AS
SELECT 
    v.id AS vendor_id,
    v.legal_name AS vendor_name,
    pv.id AS product_variant_id,
    pv.product_name,
    pv.product_code,
    SUM(pri.expected_quantity) AS total_expected,
    SUM(pri.received_quantity) AS total_received,
    SUM(pri.accepted_quantity) AS total_accepted,
    SUM(pri.rejected_quantity) AS total_rejected,
    STRING_AGG(DISTINCT pri.rejection_reason, ', ') AS rejection_reasons
FROM public.purchase_receipt_items pri
JOIN public.purchase_receipts pr ON pr.id = pri.purchase_receipt_id
JOIN public.vendors v ON v.id = pr.vendor_id
JOIN public.product_variants pv ON pv.id = pri.product_variant_id
WHERE pri.rejected_quantity > 0 OR pri.expected_quantity != pri.received_quantity
GROUP BY v.id, v.legal_name, pv.id, pv.product_name, pv.product_code;


CREATE OR REPLACE VIEW public.vw_vendor_purchase_history
WITH (security_invoker = true)
AS
SELECT 
    po.id AS purchase_order_id,
    po.po_number,
    po.po_date,
    po.status AS po_status,
    v.id AS vendor_id,
    v.vendor_code,
    v.legal_name AS vendor_name,
    w.id AS warehouse_id,
    w.warehouse_name,
    pv.product_name,
    pv.product_code,
    poi.ordered_quantity,
    poi.received_quantity,
    poi.unit_cost,
    poi.line_total
FROM public.purchase_orders po
JOIN public.vendors v ON v.id = po.vendor_id
JOIN public.warehouses w ON w.id = po.warehouse_id
JOIN public.purchase_order_items poi ON poi.purchase_order_id = po.id
JOIN public.product_variants pv ON pv.id = poi.product_variant_id;
