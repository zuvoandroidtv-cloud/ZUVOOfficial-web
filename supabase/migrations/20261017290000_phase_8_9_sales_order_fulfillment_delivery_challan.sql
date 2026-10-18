-- =============================================================================
-- ZUVO TV CRM — PHASE 8.9 MASTER DATABASE MIGRATION
-- Enterprise B2B Sales Order Management, Warehouse Pick-Pack-Ship Fulfillment
-- & Statutory Delivery Challan / E-Way Bill Governance Engine
-- Filename: 20261017290000_phase_8_9_sales_order_fulfillment_delivery_challan.sql
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. SEQUENCES FOR CONCURRENCY-SAFE SO AND DELIVERY CHALLAN NUMBERING
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_b2b_sales_order_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_delivery_challan_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 2. TABLE: public.sales_orders (Enterprise B2B Sales Orders)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    so_number TEXT NOT NULL,
    dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
    customer_id UUID NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE NULL,
    payment_terms TEXT NOT NULL DEFAULT 'NET_30' CHECK (payment_terms IN ('IMMEDIATE', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'ADVANCE')),
    billing_address TEXT NULL,
    shipping_address TEXT NOT NULL,
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN (
            'DRAFT',
            'CONFIRMED',
            'CREDIT_HOLD',
            'ALLOCATED',
            'PICKED',
            'PACKED',
            'DISPATCHED',
            'DELIVERED',
            'CANCELLED'
        )
    ),
    credit_hold_reason TEXT NULL,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    confirmed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT so_number_tenant_unique UNIQUE (tenant_id, so_number),
    CONSTRAINT chk_so_party_required CHECK (dealer_id IS NOT NULL OR customer_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_tenant ON public.sales_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_dealer ON public.sales_orders(dealer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON public.sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON public.sales_orders(order_date);

-- =============================================================================
-- 3. TABLE: public.sales_order_items (Line Items with Lifecycle Progress)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    quantity_ordered INT NOT NULL CHECK (quantity_ordered > 0),
    quantity_allocated INT NOT NULL DEFAULT 0 CHECK (quantity_allocated >= 0),
    quantity_shipped INT NOT NULL DEFAULT 0 CHECK (quantity_shipped >= 0),
    quantity_invoiced INT NOT NULL DEFAULT 0 CHECK (quantity_invoiced >= 0),
    unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 18.00 CHECK (tax_rate_pct >= 0),
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    line_total NUMERIC(14, 2) NOT NULL CHECK (line_total >= 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'PARTIALLY_ALLOCATED', 'ALLOCATED', 'PICKED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_so_item_alloc_le_ordered CHECK (quantity_allocated <= quantity_ordered),
    CONSTRAINT chk_so_item_shipped_le_alloc CHECK (quantity_shipped <= quantity_allocated),
    CONSTRAINT chk_so_item_invoiced_le_shipped CHECK (quantity_invoiced <= quantity_shipped)
);

CREATE INDEX IF NOT EXISTS idx_so_items_order ON public.sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_so_items_variant ON public.sales_order_items(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_so_items_status ON public.sales_order_items(status);

-- =============================================================================
-- 4. TABLE: public.sales_order_reservations (Serialized Hard Inventory Allocation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sales_order_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    sales_order_item_id UUID NOT NULL REFERENCES public.sales_order_items(id) ON DELETE CASCADE,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    reservation_status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (
        reservation_status IN ('RESERVED', 'PICKED', 'PACKED', 'DISPATCHED', 'DELIVERED', 'RELEASED')
    ),
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    picked_at TIMESTAMPTZ NULL,
    packed_at TIMESTAMPTZ NULL,
    dispatched_at TIMESTAMPTZ NULL,
    delivered_at TIMESTAMPTZ NULL,
    released_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index protecting serialized product unit from being actively reserved across multiple open orders
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_serialized_reservation 
ON public.sales_order_reservations (product_unit_id) 
WHERE (reservation_status IN ('RESERVED', 'PICKED', 'PACKED', 'DISPATCHED'));

CREATE INDEX IF NOT EXISTS idx_so_reservations_so ON public.sales_order_reservations(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_so_reservations_item ON public.sales_order_reservations(sales_order_item_id);
CREATE INDEX IF NOT EXISTS idx_so_reservations_unit ON public.sales_order_reservations(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_so_reservations_wh ON public.sales_order_reservations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_so_reservations_status ON public.sales_order_reservations(reservation_status);

-- =============================================================================
-- 5. TABLE: public.delivery_challans (Statutory GST Delivery Challans & E-Way Bills)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_challans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    challan_number TEXT NOT NULL,
    sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE RESTRICT,
    dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
    customer_id UUID NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    from_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    transporter_name TEXT NOT NULL,
    transporter_id TEXT NULL,
    vehicle_number TEXT NOT NULL,
    lr_number TEXT NULL,
    eway_bill_number TEXT NOT NULL,
    eway_bill_valid_until TIMESTAMPTZ NOT NULL,
    distance_km NUMERIC(8, 2) NOT NULL CHECK (distance_km > 0),
    total_quantity INT NOT NULL CHECK (total_quantity > 0),
    total_taxable_value NUMERIC(14, 2) NOT NULL CHECK (total_taxable_value >= 0),
    total_tax_amount NUMERIC(14, 2) NOT NULL CHECK (total_tax_amount >= 0),
    total_challan_value NUMERIC(14, 2) NOT NULL CHECK (total_challan_value >= 0),
    status TEXT NOT NULL DEFAULT 'GENERATED' CHECK (
        status IN ('GENERATED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')
    ),
    dispatched_at TIMESTAMPTZ NULL,
    dispatched_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    pod_receiver_name TEXT NULL,
    pod_contact_phone TEXT NULL,
    pod_signature_ref TEXT NULL,
    pod_notes TEXT NULL,
    delivered_at TIMESTAMPTZ NULL,
    commercial_tax_invoice_id UUID NULL REFERENCES public.commercial_tax_invoices(id) ON DELETE SET NULL,
    journal_entry_id UUID NULL REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT delivery_challan_number_tenant_unique UNIQUE (tenant_id, challan_number)
);

CREATE INDEX IF NOT EXISTS idx_delivery_challans_tenant ON public.delivery_challans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_so ON public.delivery_challans(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_dealer ON public.delivery_challans(dealer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_status ON public.delivery_challans(status);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_eway ON public.delivery_challans(eway_bill_number);

-- =============================================================================
-- 6. TABLE: public.delivery_challan_items (Challan Line Manifest)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_challan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    delivery_challan_id UUID NOT NULL REFERENCES public.delivery_challans(id) ON DELETE CASCADE,
    sales_order_item_id UUID NOT NULL REFERENCES public.sales_order_items(id) ON DELETE RESTRICT,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity = 1),
    unit_value NUMERIC(14, 2) NOT NULL CHECK (unit_value >= 0),
    taxable_value NUMERIC(14, 2) NOT NULL CHECK (taxable_value >= 0),
    tax_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 18.00 CHECK (tax_rate_pct >= 0),
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_dc_item_unit UNIQUE (delivery_challan_id, product_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_dc_items_challan ON public.delivery_challan_items(delivery_challan_id);
CREATE INDEX IF NOT EXISTS idx_dc_items_so_item ON public.delivery_challan_items(sales_order_item_id);
CREATE INDEX IF NOT EXISTS idx_dc_items_unit ON public.delivery_challan_items(product_unit_id);

-- =============================================================================
-- 7. TABLE: public.sales_order_audit_events (Append-Only Audit Trail)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sales_order_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    previous_status TEXT NULL,
    new_status TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_so_audit_order ON public.sales_order_audit_events(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_so_audit_type ON public.sales_order_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_so_audit_created ON public.sales_order_audit_events(created_at);

-- =============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_challan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_audit_events ENABLE ROW LEVEL SECURITY;

-- Revoke public & anon access
REVOKE ALL ON TABLE public.sales_orders FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.sales_order_items FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.sales_order_reservations FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.delivery_challans FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.delivery_challan_items FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.sales_order_audit_events FROM PUBLIC, anon;

-- Grant authenticated roles
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_order_reservations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_challans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_challan_items TO authenticated;
GRANT SELECT, INSERT ON TABLE public.sales_order_audit_events TO authenticated;

-- Policies: sales_orders
CREATE POLICY "so_staff_and_dealers_select" ON public.sales_orders
    FOR SELECT TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory', 'finance') OR
        (public.get_current_user_role() = 'dealer' AND dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid()))
    );

CREATE POLICY "so_staff_manage" ON public.sales_orders
    FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory'));

-- Policies: sales_order_items
CREATE POLICY "so_items_select" ON public.sales_order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sales_orders so
            WHERE so.id = sales_order_items.sales_order_id AND (
                public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory', 'finance') OR
                (public.get_current_user_role() = 'dealer' AND so.dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid()))
            )
        )
    );

CREATE POLICY "so_items_staff_manage" ON public.sales_order_items
    FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory'));

-- Policies: sales_order_reservations
CREATE POLICY "so_reservations_staff_select" ON public.sales_order_reservations
    FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory'));

CREATE POLICY "so_reservations_staff_manage" ON public.sales_order_reservations
    FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory'));

-- Policies: delivery_challans
CREATE POLICY "dc_select" ON public.delivery_challans
    FOR SELECT TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory', 'finance') OR
        (public.get_current_user_role() = 'dealer' AND dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid()))
    );

CREATE POLICY "dc_staff_manage" ON public.delivery_challans
    FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory'));

-- Policies: delivery_challan_items
CREATE POLICY "dc_items_select" ON public.delivery_challan_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.delivery_challans dc
            WHERE dc.id = delivery_challan_items.delivery_challan_id AND (
                public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory', 'finance') OR
                (public.get_current_user_role() = 'dealer' AND dc.dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid()))
            )
        )
    );

CREATE POLICY "dc_items_staff_manage" ON public.delivery_challan_items
    FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory'));

-- Policies: sales_order_audit_events
CREATE POLICY "so_audit_select" ON public.sales_order_audit_events
    FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory', 'finance'));

CREATE POLICY "so_audit_insert" ON public.sales_order_audit_events
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'sales', 'inventory', 'finance'));

-- =============================================================================
-- 9. RPC 1: fn_create_b2b_sales_order
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_create_b2b_sales_order(p_order_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_role TEXT;
    v_tenant_id UUID;
    v_dealer_id UUID;
    v_customer_id UUID;
    v_order_date DATE;
    v_expected_date DATE;
    v_payment_terms TEXT;
    v_shipping_addr TEXT;
    v_billing_addr TEXT;
    v_notes TEXT;
    v_items JSONB;
    v_item JSONB;
    v_so_number TEXT;
    v_seq_val BIGINT;
    v_so_id UUID;
    v_subtotal NUMERIC(14, 2) := 0.00;
    v_discount NUMERIC(14, 2) := 0.00;
    v_tax NUMERIC(14, 2) := 0.00;
    v_total NUMERIC(14, 2) := 0.00;
    v_item_subtotal NUMERIC(14, 2);
    v_item_tax NUMERIC(14, 2);
    v_item_total NUMERIC(14, 2);
    v_item_qty INT;
    v_unit_price NUMERIC(14, 2);
    v_item_disc NUMERIC(14, 2);
    v_item_tax_rate NUMERIC(5, 2);
    v_variant_id UUID;
BEGIN
    v_actor_id := auth.uid();
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'sales', 'inventory') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Sales, Inventory or Admin can create B2B sales orders');
    END IF;

    v_tenant_id := COALESCE((p_order_data->>'tenant_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid);
    v_dealer_id := (p_order_data->>'dealer_id')::uuid;
    v_customer_id := (p_order_data->>'customer_id')::uuid;
    v_order_date := COALESCE((p_order_data->>'order_date')::date, CURRENT_DATE);
    v_expected_date := (p_order_data->>'expected_delivery_date')::date;
    v_payment_terms := COALESCE(p_order_data->>'payment_terms', 'NET_30');
    v_shipping_addr := TRIM(COALESCE(p_order_data->>'shipping_address', ''));
    v_billing_addr := p_order_data->>'billing_address';
    v_notes := p_order_data->>'notes';
    v_items := p_order_data->'items';

    IF v_dealer_id IS NULL AND v_customer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Either dealer_id or customer_id is required');
    END IF;

    IF v_shipping_addr = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Shipping address is required');
    END IF;

    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'At least one line item is required');
    END IF;

    -- Validate dealer existence
    IF v_dealer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.dealers WHERE id = v_dealer_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Specified dealer not found');
    END IF;

    -- Generate sequential SO number: SO-YYYYMM-XXXX
    v_seq_val := nextval('public.seq_b2b_sales_order_number');
    v_so_number := 'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(v_seq_val::TEXT, 4, '0');

    -- Create Sales Order Header in DRAFT
    INSERT INTO public.sales_orders (
        tenant_id, so_number, dealer_id, customer_id,
        order_date, expected_delivery_date, payment_terms,
        billing_address, shipping_address,
        subtotal, discount_amount, tax_amount, total_amount,
        status, notes, created_by
    ) VALUES (
        v_tenant_id, v_so_number, v_dealer_id, v_customer_id,
        v_order_date, v_expected_date, v_payment_terms,
        v_billing_addr, v_shipping_addr,
        0.00, 0.00, 0.00, 0.00,
        'DRAFT', v_notes, v_actor_id
    ) RETURNING id INTO v_so_id;

    -- Process Line Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_variant_id := (v_item->>'product_variant_id')::uuid;
        v_item_qty := COALESCE((v_item->>'quantity_ordered')::int, 0);
        v_unit_price := COALESCE((v_item->>'unit_price')::numeric, 0.00);
        v_item_disc := COALESCE((v_item->>'discount_amount')::numeric, 0.00);
        v_item_tax_rate := COALESCE((v_item->>'tax_rate_pct')::numeric, 18.00);

        IF v_item_qty <= 0 THEN
            RAISE EXCEPTION 'Quantity ordered must be greater than zero';
        END IF;

        IF v_unit_price < 0 THEN
            RAISE EXCEPTION 'Unit price cannot be negative';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = v_variant_id) THEN
            RAISE EXCEPTION 'Product variant % does not exist', v_variant_id;
        END IF;

        v_item_subtotal := round(v_item_qty * v_unit_price, 2);
        v_item_tax := round((v_item_subtotal - v_item_disc) * (v_item_tax_rate / 100.0), 2);
        v_item_total := round(v_item_subtotal - v_item_disc + v_item_tax, 2);

        INSERT INTO public.sales_order_items (
            tenant_id, sales_order_id, product_variant_id,
            quantity_ordered, quantity_allocated, quantity_shipped, quantity_invoiced,
            unit_price, discount_amount, tax_rate_pct, tax_amount, line_total,
            status
        ) VALUES (
            v_tenant_id, v_so_id, v_variant_id,
            v_item_qty, 0, 0, 0,
            v_unit_price, v_item_disc, v_item_tax_rate, v_item_tax, v_item_total,
            'PENDING'
        );

        v_subtotal := v_subtotal + v_item_subtotal;
        v_discount := v_discount + v_item_disc;
        v_tax := v_tax + v_item_tax;
        v_total := v_total + v_item_total;
    END LOOP;

    -- Update Order Totals
    UPDATE public.sales_orders
    SET subtotal = v_subtotal,
        discount_amount = v_discount,
        tax_amount = v_tax,
        total_amount = v_total,
        updated_at = now()
    WHERE id = v_so_id;

    -- Record Audit Event
    INSERT INTO public.sales_order_audit_events (
        tenant_id, sales_order_id, event_type, actor_id,
        previous_status, new_status, payload
    ) VALUES (
        v_tenant_id, v_so_id, 'ORDER_CREATED', v_actor_id,
        NULL, 'DRAFT',
        jsonb_build_object('so_number', v_so_number, 'total_amount', v_total, 'lines_count', jsonb_array_length(v_items))
    );

    RETURN jsonb_build_object(
        'success', true,
        'sales_order_id', v_so_id,
        'so_number', v_so_number,
        'status', 'DRAFT',
        'subtotal', v_subtotal,
        'tax_amount', v_tax,
        'total_amount', v_total
    );
END;
$$;

-- =============================================================================
-- 10. RPC 2: fn_confirm_sales_order (Validates Dealer Credit via Phase 8.1)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_confirm_sales_order(p_sales_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_role TEXT;
    v_so RECORD;
    v_credit_eval JSONB;
    v_current_exposure NUMERIC;
    v_credit_limit NUMERIC;
    v_projected_exposure NUMERIC;
    v_dispatch_allowed BOOLEAN;
    v_blocking_reason TEXT;
    v_risk_state TEXT;
    v_new_status TEXT;
BEGIN
    v_actor_id := auth.uid();
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'sales', 'inventory', 'finance') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Insufficient permissions to confirm sales orders');
    END IF;

    SELECT * INTO v_so FROM public.sales_orders WHERE id = p_sales_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sales order not found');
    END IF;

    -- Idempotency check
    IF v_so.status IN ('CONFIRMED', 'ALLOCATED', 'PICKED', 'PACKED', 'DISPATCHED', 'DELIVERED') THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true, 'sales_order_id', v_so.id, 'status', v_so.status);
    END IF;

    IF v_so.status = 'CANCELLED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot confirm a cancelled sales order');
    END IF;

    -- Credit limit evaluation if dealer is present
    IF v_so.dealer_id IS NOT NULL THEN
        -- Evaluate credit via Phase 8.1 credit engine
        v_credit_eval := public.fn_evaluate_dealer_credit_exposure(v_so.dealer_id);
        v_current_exposure := COALESCE((v_credit_eval->>'current_exposure')::numeric, 0.00);
        v_credit_limit := COALESCE((v_credit_eval->>'credit_limit')::numeric, 0.00);
        v_dispatch_allowed := COALESCE((v_credit_eval->>'dispatch_allowed')::boolean, true);
        v_blocking_reason := v_credit_eval->>'blocking_reason';
        v_risk_state := v_credit_eval->>'risk_state';

        v_projected_exposure := v_current_exposure + v_so.total_amount;

        IF (NOT v_dispatch_allowed) OR (v_credit_limit > 0 AND v_projected_exposure > v_credit_limit) THEN
            v_new_status := 'CREDIT_HOLD';
            v_blocking_reason := COALESCE(v_blocking_reason, 'Projected exposure (₹' || v_projected_exposure || ') exceeds approved credit limit (₹' || v_credit_limit || ')');

            UPDATE public.sales_orders
            SET status = 'CREDIT_HOLD',
                credit_hold_reason = v_blocking_reason,
                updated_at = now()
            WHERE id = v_so.id;

            INSERT INTO public.sales_order_audit_events (
                tenant_id, sales_order_id, event_type, actor_id,
                previous_status, new_status, payload
            ) VALUES (
                v_so.tenant_id, v_so.id, 'CREDIT_HOLD_ENFORCED', v_actor_id,
                v_so.status, 'CREDIT_HOLD',
                jsonb_build_object('reason', v_blocking_reason, 'projected_exposure', v_projected_exposure, 'credit_limit', v_credit_limit)
            );

            RETURN jsonb_build_object(
                'success', false,
                'status', 'CREDIT_HOLD',
                'credit_hold', true,
                'reason', v_blocking_reason,
                'current_exposure', v_current_exposure,
                'credit_limit', v_credit_limit,
                'projected_exposure', v_projected_exposure
            );
        END IF;
    END IF;

    -- Pass credit check -> CONFIRMED
    UPDATE public.sales_orders
    SET status = 'CONFIRMED',
        credit_hold_reason = NULL,
        confirmed_by = v_actor_id,
        confirmed_at = now(),
        updated_at = now()
    WHERE id = v_so.id;

    INSERT INTO public.sales_order_audit_events (
        tenant_id, sales_order_id, event_type, actor_id,
        previous_status, new_status, payload
    ) VALUES (
        v_so.tenant_id, v_so.id, 'ORDER_CONFIRMED', v_actor_id,
        v_so.status, 'CONFIRMED',
        jsonb_build_object('confirmed_at', now(), 'total_amount', v_so.total_amount)
    );

    RETURN jsonb_build_object(
        'success', true,
        'sales_order_id', v_so.id,
        'status', 'CONFIRMED',
        'message', 'Sales order successfully confirmed'
    );
END;
$$;

-- =============================================================================
-- 11. RPC 3: fn_allocate_and_pick_sales_order
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_allocate_and_pick_sales_order(
    p_sales_order_id UUID,
    p_allocations JSONB, -- Array of { sales_order_item_id, warehouse_id, product_unit_ids: [] }
    p_action TEXT DEFAULT 'ALLOCATE' -- 'ALLOCATE', 'PICK', 'PACK'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_role TEXT;
    v_so RECORD;
    v_alloc_elem JSONB;
    v_so_item_id UUID;
    v_wh_id UUID;
    v_unit_ids UUID[];
    v_unit_id UUID;
    v_so_item RECORD;
    v_unit RECORD;
    v_total_allocated INT := 0;
    v_all_items_full BOOLEAN := true;
BEGIN
    v_actor_id := auth.uid();
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'inventory', 'sales') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Inventory or Admin can allocate or pick sales orders');
    END IF;

    SELECT * INTO v_so FROM public.sales_orders WHERE id = p_sales_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sales order not found');
    END IF;

    IF v_so.status = 'CANCELLED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot process a cancelled order');
    END IF;

    IF v_so.status = 'CREDIT_HOLD' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order is on CREDIT_HOLD. Resolve credit before warehouse processing');
    END IF;

    IF p_action = 'ALLOCATE' THEN
        IF v_so.status NOT IN ('CONFIRMED', 'ALLOCATED') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Order must be CONFIRMED or ALLOCATED before allocating inventory');
        END IF;

        FOR v_alloc_elem IN SELECT * FROM jsonb_array_elements(p_allocations)
        LOOP
            v_so_item_id := (v_alloc_elem->>'sales_order_item_id')::uuid;
            v_wh_id := (v_alloc_elem->>'warehouse_id')::uuid;
            
            SELECT * INTO v_so_item FROM public.sales_order_items WHERE id = v_so_item_id AND sales_order_id = v_so.id FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Sales order item % does not belong to order %', v_so_item_id, v_so.id;
            END IF;

            -- Convert jsonb array of uuid strings to UUID array
            SELECT ARRAY_AGG(x::uuid) INTO v_unit_ids FROM jsonb_array_elements_text(v_alloc_elem->'product_unit_ids') x;

            IF v_unit_ids IS NULL OR array_length(v_unit_ids, 1) = 0 THEN
                CONTINUE;
            END IF;

            -- Check if adding these units exceeds ordered qty
            IF v_so_item.quantity_allocated + array_length(v_unit_ids, 1) > v_so_item.quantity_ordered THEN
                RAISE EXCEPTION 'Cannot allocate % units to item %: ordered %, already allocated %',
                    array_length(v_unit_ids, 1), v_so_item_id, v_so_item.quantity_ordered, v_so_item.quantity_allocated;
            END IF;

            FOREACH v_unit_id IN ARRAY v_unit_ids
            LOOP
                -- Lock unit row
                SELECT * INTO v_unit FROM public.product_units WHERE id = v_unit_id FOR UPDATE;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Product unit % not found', v_unit_id;
                END IF;

                -- Ensure variant matches
                IF v_unit.variant_id != v_so_item.product_variant_id THEN
                    RAISE EXCEPTION 'Unit % variant (%) does not match order item variant (%)',
                        v_unit.barcode, v_unit.variant_id, v_so_item.product_variant_id;
                END IF;

                -- Check unit availability: Must be in_stock, IN_STOCK, or available and not sold/damaged
                IF LOWER(v_unit.status) NOT IN ('in_stock', 'available') THEN
                    RAISE EXCEPTION 'Product unit % is in status % and cannot be reserved', v_unit.barcode, v_unit.status;
                END IF;

                -- Check if active reservation already exists
                IF EXISTS (
                    SELECT 1 FROM public.sales_order_reservations
                    WHERE product_unit_id = v_unit_id AND reservation_status IN ('RESERVED', 'PICKED', 'PACKED', 'DISPATCHED')
                ) THEN
                    RAISE EXCEPTION 'Product unit % is already reserved by another sales order', v_unit.barcode;
                END IF;

                -- Insert hard reservation
                INSERT INTO public.sales_order_reservations (
                    tenant_id, sales_order_id, sales_order_item_id,
                    product_unit_id, warehouse_id, reservation_status,
                    reserved_at
                ) VALUES (
                    v_so.tenant_id, v_so.id, v_so_item.id,
                    v_unit_id, COALESCE(v_wh_id, v_unit.warehouse_id), 'RESERVED',
                    now()
                );

                -- Update unit status to 'reserved'
                UPDATE public.product_units
                SET status = 'reserved',
                    updated_at = now()
                WHERE id = v_unit_id;

                v_total_allocated := v_total_allocated + 1;
            END LOOP;

            -- Update item allocation quantity
            UPDATE public.sales_order_items
            SET quantity_allocated = quantity_allocated + array_length(v_unit_ids, 1),
                status = CASE 
                    WHEN quantity_allocated + array_length(v_unit_ids, 1) = quantity_ordered THEN 'ALLOCATED'
                    ELSE 'PARTIALLY_ALLOCATED'
                END,
                updated_at = now()
            WHERE id = v_so_item.id;
        END LOOP;

        -- Check overall order allocation status
        SELECT bool_and(quantity_allocated = quantity_ordered) INTO v_all_items_full
        FROM public.sales_order_items WHERE sales_order_id = v_so.id;

        UPDATE public.sales_orders
        SET status = 'ALLOCATED',
            updated_at = now()
        WHERE id = v_so.id;

        INSERT INTO public.sales_order_audit_events (
            tenant_id, sales_order_id, event_type, actor_id,
            previous_status, new_status, payload
        ) VALUES (
            v_so.tenant_id, v_so.id, 'INVENTORY_ALLOCATED', v_actor_id,
            v_so.status, 'ALLOCATED',
            jsonb_build_object('units_allocated', v_total_allocated, 'all_items_full', v_all_items_full)
        );

        RETURN jsonb_build_object(
            'success', true,
            'sales_order_id', v_so.id,
            'status', 'ALLOCATED',
            'units_allocated', v_total_allocated,
            'all_items_full', v_all_items_full
        );

    ELSIF p_action = 'PICK' THEN
        IF v_so.status NOT IN ('ALLOCATED', 'PICKED') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Order must be in ALLOCATED status to proceed with picking');
        END IF;

        UPDATE public.sales_order_reservations
        SET reservation_status = 'PICKED',
            picked_at = now(),
            updated_at = now()
        WHERE sales_order_id = v_so.id AND reservation_status = 'RESERVED';

        UPDATE public.sales_order_items
        SET status = 'PICKED', updated_at = now()
        WHERE sales_order_id = v_so.id AND status = 'ALLOCATED';

        UPDATE public.sales_orders
        SET status = 'PICKED', updated_at = now()
        WHERE id = v_so.id;

        INSERT INTO public.sales_order_audit_events (
            tenant_id, sales_order_id, event_type, actor_id,
            previous_status, new_status, payload
        ) VALUES (
            v_so.tenant_id, v_so.id, 'WAREHOUSE_PICKED', v_actor_id,
            v_so.status, 'PICKED',
            jsonb_build_object('picked_at', now())
        );

        RETURN jsonb_build_object('success', true, 'sales_order_id', v_so.id, 'status', 'PICKED');

    ELSIF p_action = 'PACK' THEN
        IF v_so.status NOT IN ('PICKED', 'PACKED') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Order must be in PICKED status to proceed with packing');
        END IF;

        UPDATE public.sales_order_reservations
        SET reservation_status = 'PACKED',
            packed_at = now(),
            updated_at = now()
        WHERE sales_order_id = v_so.id AND reservation_status = 'PICKED';

        UPDATE public.sales_order_items
        SET status = 'PACKED', updated_at = now()
        WHERE sales_order_id = v_so.id AND status = 'PICKED';

        UPDATE public.sales_orders
        SET status = 'PACKED', updated_at = now()
        WHERE id = v_so.id;

        INSERT INTO public.sales_order_audit_events (
            tenant_id, sales_order_id, event_type, actor_id,
            previous_status, new_status, payload
        ) VALUES (
            v_so.tenant_id, v_so.id, 'WAREHOUSE_PACKED', v_actor_id,
            v_so.status, 'PACKED',
            jsonb_build_object('packed_at', now())
        );

        RETURN jsonb_build_object('success', true, 'sales_order_id', v_so.id, 'status', 'PACKED');
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action: must be ALLOCATE, PICK, or PACK');
    END IF;
END;
$$;

-- =============================================================================
-- 12. RPC 4: fn_generate_delivery_challan
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_generate_delivery_challan(p_challan_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_role TEXT;
    v_so_id UUID;
    v_so RECORD;
    v_wh_id UUID;
    v_transporter TEXT;
    v_vehicle TEXT;
    v_lr_num TEXT;
    v_eway_bill TEXT;
    v_eway_valid TIMESTAMPTZ;
    v_distance NUMERIC(8, 2);
    v_dc_number TEXT;
    v_seq_val BIGINT;
    v_dc_id UUID;
    v_res RECORD;
    v_tot_qty INT := 0;
    v_tot_taxable NUMERIC(14, 2) := 0.00;
    v_tot_tax NUMERIC(14, 2) := 0.00;
    v_tot_value NUMERIC(14, 2) := 0.00;
    v_item_taxable NUMERIC(14, 2);
    v_item_tax NUMERIC(14, 2);
BEGIN
    v_actor_id := auth.uid();
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'inventory', 'sales') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Inventory or Admin can generate delivery challans');
    END IF;

    v_so_id := (p_challan_data->>'sales_order_id')::uuid;
    v_wh_id := (p_challan_data->>'warehouse_id')::uuid;
    v_transporter := TRIM(COALESCE(p_challan_data->>'transporter_name', ''));
    v_vehicle := TRIM(COALESCE(p_challan_data->>'vehicle_number', ''));
    v_lr_num := p_challan_data->>'lr_number';
    v_eway_bill := TRIM(COALESCE(p_challan_data->>'eway_bill_number', ''));
    v_eway_valid := (p_challan_data->>'eway_bill_valid_until')::timestamptz;
    v_distance := COALESCE((p_challan_data->>'distance_km')::numeric, 0.00);

    IF v_transporter = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transporter name is required');
    END IF;

    IF v_vehicle = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Vehicle registration number is required');
    END IF;

    IF v_eway_bill = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'E-Way Bill number is required');
    END IF;

    IF v_eway_valid IS NULL OR v_eway_valid <= now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'E-Way Bill validity must be in the future');
    END IF;

    IF v_distance <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Distance must be greater than zero');
    END IF;

    SELECT * INTO v_so FROM public.sales_orders WHERE id = v_so_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sales order not found');
    END IF;

    IF v_so.status NOT IN ('PACKED', 'PICKED', 'ALLOCATED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sales order must have packed/allocated units to generate Delivery Challan');
    END IF;

    -- Default warehouse
    IF v_wh_id IS NULL THEN
        SELECT warehouse_id INTO v_wh_id FROM public.sales_order_reservations WHERE sales_order_id = v_so.id LIMIT 1;
        IF v_wh_id IS NULL THEN
            SELECT id INTO v_wh_id FROM public.warehouses WHERE is_active = true LIMIT 1;
        END IF;
    END IF;

    -- Concurrency-safe DC number: DC-YYYYMM-XXXX
    v_seq_val := nextval('public.seq_delivery_challan_number');
    v_dc_number := 'DC-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(v_seq_val::TEXT, 4, '0');

    -- Insert Delivery Challan Header
    INSERT INTO public.delivery_challans (
        tenant_id, challan_number, sales_order_id,
        dealer_id, customer_id, from_warehouse_id,
        transporter_name, vehicle_number, lr_number,
        eway_bill_number, eway_bill_valid_until, distance_km,
        total_quantity, total_taxable_value, total_tax_amount, total_challan_value,
        status, created_by
    ) VALUES (
        v_so.tenant_id, v_dc_number, v_so.id,
        v_so.dealer_id, v_so.customer_id, v_wh_id,
        v_transporter, v_vehicle, v_lr_num,
        v_eway_bill, v_eway_valid, v_distance,
        0, 0.00, 0.00, 0.00,
        'GENERATED', v_actor_id
    ) RETURNING id INTO v_dc_id;

    -- Populate manifest from active reservations
    FOR v_res IN 
        SELECT r.*, soi.unit_price, soi.discount_amount, soi.tax_rate_pct 
        FROM public.sales_order_reservations r
        JOIN public.sales_order_items soi ON soi.id = r.sales_order_item_id
        WHERE r.sales_order_id = v_so.id AND r.reservation_status IN ('PACKED', 'PICKED', 'RESERVED')
    LOOP
        v_item_taxable := round(v_res.unit_price, 2);
        v_item_tax := round(v_item_taxable * (v_res.tax_rate_pct / 100.0), 2);

        INSERT INTO public.delivery_challan_items (
            tenant_id, delivery_challan_id, sales_order_item_id,
            product_unit_id, quantity, unit_value,
            taxable_value, tax_rate_pct, tax_amount
        ) VALUES (
            v_so.tenant_id, v_dc_id, v_res.sales_order_item_id,
            v_res.product_unit_id, 1, v_res.unit_price,
            v_item_taxable, v_res.tax_rate_pct, v_item_tax
        );

        v_tot_qty := v_tot_qty + 1;
        v_tot_taxable := v_tot_taxable + v_item_taxable;
        v_tot_tax := v_tot_tax + v_item_tax;
        v_tot_value := v_tot_value + v_item_taxable + v_item_tax;
    END LOOP;

    IF v_tot_qty = 0 THEN
        RAISE EXCEPTION 'No packed or reserved units available for this sales order';
    END IF;

    -- Update Delivery Challan totals
    UPDATE public.delivery_challans
    SET total_quantity = v_tot_qty,
        total_taxable_value = v_tot_taxable,
        total_tax_amount = v_tot_tax,
        total_challan_value = v_tot_value,
        updated_at = now()
    WHERE id = v_dc_id;

    -- Audit event
    INSERT INTO public.sales_order_audit_events (
        tenant_id, sales_order_id, event_type, actor_id,
        previous_status, new_status, payload
    ) VALUES (
        v_so.tenant_id, v_so.id, 'CHALLAN_GENERATED', v_actor_id,
        v_so.status, v_so.status,
        jsonb_build_object('challan_id', v_dc_id, 'challan_number', v_dc_number, 'eway_bill', v_eway_bill, 'total_value', v_tot_value)
    );

    RETURN jsonb_build_object(
        'success', true,
        'delivery_challan_id', v_dc_id,
        'challan_number', v_dc_number,
        'total_quantity', v_tot_qty,
        'total_challan_value', v_tot_value,
        'eway_bill_number', v_eway_bill,
        'status', 'GENERATED'
    );
END;
$$;

-- =============================================================================
-- 13. RPC 5: fn_dispatch_delivery_challan
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_dispatch_delivery_challan(p_delivery_challan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_role TEXT;
    v_dc RECORD;
    v_so RECORD;
    v_item RECORD;
BEGIN
    v_actor_id := auth.uid();
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'inventory', 'sales') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Inventory or Admin can dispatch delivery challans');
    END IF;

    SELECT * INTO v_dc FROM public.delivery_challans WHERE id = p_delivery_challan_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Delivery challan not found');
    END IF;

    -- Idempotency check
    IF v_dc.status IN ('DISPATCHED', 'IN_TRANSIT', 'DELIVERED') THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true, 'delivery_challan_id', v_dc.id, 'status', v_dc.status);
    END IF;

    IF v_dc.eway_bill_valid_until <= now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot dispatch: E-Way Bill has expired. Renew validity first');
    END IF;

    SELECT * INTO v_so FROM public.sales_orders WHERE id = v_dc.sales_order_id FOR UPDATE;

    -- Transition Delivery Challan status
    UPDATE public.delivery_challans
    SET status = 'IN_TRANSIT',
        dispatched_at = now(),
        dispatched_by = v_actor_id,
        updated_at = now()
    WHERE id = v_dc.id;

    -- Transition linked product units to 'in_transit'
    FOR v_item IN SELECT * FROM public.delivery_challan_items WHERE delivery_challan_id = v_dc.id
    LOOP
        UPDATE public.product_units
        SET status = 'in_transit',
            dealer_id = COALESCE(v_dc.dealer_id, dealer_id),
            updated_at = now()
        WHERE id = v_item.product_unit_id;

        UPDATE public.sales_order_reservations
        SET reservation_status = 'DISPATCHED',
            dispatched_at = now(),
            updated_at = now()
        WHERE sales_order_id = v_dc.sales_order_id AND product_unit_id = v_item.product_unit_id;

        UPDATE public.sales_order_items
        SET quantity_shipped = quantity_shipped + 1,
            status = 'SHIPPED',
            updated_at = now()
        WHERE id = v_item.sales_order_item_id;
    END LOOP;

    -- Transition Sales Order to DISPATCHED
    UPDATE public.sales_orders
    SET status = 'DISPATCHED',
        updated_at = now()
    WHERE id = v_so.id;

    INSERT INTO public.sales_order_audit_events (
        tenant_id, sales_order_id, event_type, actor_id,
        previous_status, new_status, payload
    ) VALUES (
        v_so.tenant_id, v_so.id, 'ORDER_DISPATCHED', v_actor_id,
        v_so.status, 'DISPATCHED',
        jsonb_build_object('challan_id', v_dc.id, 'challan_number', v_dc.challan_number, 'vehicle_number', v_dc.vehicle_number)
    );

    RETURN jsonb_build_object(
        'success', true,
        'delivery_challan_id', v_dc.id,
        'sales_order_id', v_so.id,
        'status', 'IN_TRANSIT'
    );
END;
$$;

-- =============================================================================
-- 14. RPC 6: fn_confirm_challan_delivery_and_invoice
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_confirm_challan_delivery_and_invoice(
    p_delivery_challan_id UUID,
    p_pod_data JSONB -- { receiver_name, contact_phone, signature_ref, notes, delivery_timestamp }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_role TEXT;
    v_dc RECORD;
    v_so RECORD;
    v_receiver TEXT;
    v_phone TEXT;
    v_sig TEXT;
    v_notes TEXT;
    v_delivery_time TIMESTAMPTZ;
    v_item RECORD;
    v_active_period RECORD;
    v_sale_id UUID;
    v_sale_num TEXT;
    v_inv_result JSONB;
    v_cogs_result JSONB;
    v_je_id UUID;
    v_tax_inv_id UUID;
BEGIN
    v_actor_id := auth.uid();
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'inventory', 'sales', 'finance') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Insufficient permissions to confirm delivery and trigger commercial invoicing');
    END IF;

    SELECT * INTO v_dc FROM public.delivery_challans WHERE id = p_delivery_challan_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Delivery challan not found');
    END IF;

    -- Idempotency check: Already delivered?
    IF v_dc.status = 'DELIVERED' THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'delivery_challan_id', v_dc.id,
            'sales_order_id', v_dc.sales_order_id,
            'commercial_tax_invoice_id', v_dc.commercial_tax_invoice_id,
            'journal_entry_id', v_dc.journal_entry_id,
            'status', 'DELIVERED',
            'message', 'Delivery and invoicing was already completed previously.'
        );
    END IF;

    -- Validate POD data
    v_receiver := TRIM(COALESCE(p_pod_data->>'receiver_name', ''));
    v_phone := TRIM(COALESCE(p_pod_data->>'contact_phone', ''));
    v_sig := p_pod_data->>'signature_ref';
    v_notes := p_pod_data->>'notes';
    v_delivery_time := COALESCE((p_pod_data->>'delivery_timestamp')::timestamptz, now());

    IF v_receiver = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Proof of Delivery requires receiver name');
    END IF;

    -- Verify active financial period
    SELECT * INTO v_active_period FROM public.accounting_periods 
    WHERE status = 'OPEN' AND CURRENT_DATE BETWEEN start_date AND end_date LIMIT 1;
    
    IF v_active_period.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No open accounting period found for current date. Invoicing blocked.');
    END IF;

    SELECT * INTO v_so FROM public.sales_orders WHERE id = v_dc.sales_order_id FOR UPDATE;

    -- 1. Create or Find Canonical Commercial Sale record in public.sales
    v_sale_num := 'B2BSL-' || v_dc.challan_number;
    SELECT id INTO v_sale_id FROM public.sales WHERE sale_number = v_sale_num LIMIT 1;

    IF v_sale_id IS NULL THEN
        INSERT INTO public.sales (
            sale_number, customer_id, dealer_id, sale_date,
            subtotal, discount_amount, tax_amount, total_amount,
            payment_status, sale_status, notes
        ) VALUES (
            v_sale_num, v_dc.customer_id, v_dc.dealer_id, CURRENT_DATE,
            v_dc.total_taxable_value, 0.00, v_dc.total_tax_amount, v_dc.total_challan_value,
            'pending', 'completed', 'B2B Sales Order: ' || v_so.so_number || ' via DC: ' || v_dc.challan_number
        ) RETURNING id INTO v_sale_id;

        -- Attach sale items with product_unit_id links for COGS engine
        FOR v_item IN SELECT * FROM public.delivery_challan_items WHERE delivery_challan_id = v_dc.id
        LOOP
            INSERT INTO public.sale_items (
                sale_id, product_unit_id, quantity, unit_price,
                discount_amount, tax_amount, total_price
            ) VALUES (
                v_sale_id, v_item.product_unit_id, 1, v_item.unit_value,
                0.00, v_item.tax_amount, v_item.unit_value + v_item.tax_amount
            );
        END LOOP;
    END IF;

    -- 2. Trigger Phase 8.2 Commercial Invoicing & AR Ledger Posting
    v_inv_result := public.fn_generate_commercial_tax_invoice(v_sale_id);
    IF NOT (v_inv_result->>'success')::boolean THEN
        RETURN jsonb_build_object('success', false, 'error', 'Commercial invoicing failed: ' || (v_inv_result->>'error'));
    END IF;

    v_tax_inv_id := (v_inv_result->>'invoice_id')::uuid;

    -- 3. Trigger Phase 8.6 Inventory Valuation Relief & COGS Recognition
    v_cogs_result := public.fn_recognize_cogs_and_relief(v_sale_id);
    IF (v_cogs_result->>'success')::boolean THEN
        v_je_id := (v_cogs_result->>'journal_entry_id')::uuid;
    END IF;

    -- 4. Mark Product Units as 'sold'
    FOR v_item IN SELECT * FROM public.delivery_challan_items WHERE delivery_challan_id = v_dc.id
    LOOP
        UPDATE public.product_units
        SET status = 'sold',
            updated_at = now()
        WHERE id = v_item.product_unit_id;

        UPDATE public.sales_order_reservations
        SET reservation_status = 'DELIVERED',
            delivered_at = v_delivery_time,
            updated_at = now()
        WHERE sales_order_id = v_dc.sales_order_id AND product_unit_id = v_item.product_unit_id;

        UPDATE public.sales_order_items
        SET quantity_invoiced = quantity_invoiced + 1,
            status = 'DELIVERED',
            updated_at = now()
        WHERE id = v_item.sales_order_item_id;
    END LOOP;

    -- 5. Mark Delivery Challan as DELIVERED
    UPDATE public.delivery_challans
    SET status = 'DELIVERED',
        pod_receiver_name = v_receiver,
        pod_contact_phone = v_phone,
        pod_signature_ref = v_sig,
        pod_notes = v_notes,
        delivered_at = v_delivery_time,
        commercial_tax_invoice_id = v_tax_inv_id,
        journal_entry_id = v_je_id,
        updated_at = now()
    WHERE id = v_dc.id;

    -- 6. Mark Sales Order as DELIVERED
    UPDATE public.sales_orders
    SET status = 'DELIVERED',
        updated_at = now()
    WHERE id = v_so.id;

    -- Audit Event
    INSERT INTO public.sales_order_audit_events (
        tenant_id, sales_order_id, event_type, actor_id,
        previous_status, new_status, payload
    ) VALUES (
        v_so.tenant_id, v_so.id, 'ORDER_DELIVERED_AND_INVOICED', v_actor_id,
        v_so.status, 'DELIVERED',
        jsonb_build_object(
            'challan_id', v_dc.id,
            'receiver', v_receiver,
            'tax_invoice_id', v_tax_inv_id,
            'journal_entry_id', v_je_id
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'delivery_challan_id', v_dc.id,
        'sales_order_id', v_so.id,
        'commercial_tax_invoice_id', v_tax_inv_id,
        'journal_entry_id', v_je_id,
        'invoice_number', v_inv_result->>'invoice_number',
        'cogs_recognized', v_cogs_result->>'total_cogs',
        'status', 'DELIVERED'
    );
END;
$$;
