-- =============================================================================
-- ZUVO TV CRM — PHASE 8.10 MASTER DATABASE MIGRATION
-- Enterprise B2B Reverse Logistics, Commercial Sales Returns (RMA),
-- Dock Rejection & Statutory GST Credit/Debit Note Governance Engine
-- Filename: 20261017300000_phase_8_10_commercial_returns_credit_notes.sql
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. SEQUENCES FOR CONCURRENCY-SAFE NUMBERING
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_commercial_return_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_reverse_delivery_challan_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_statutory_credit_note_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_carrier_transit_claim_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 2. TABLE: public.commercial_sales_returns
-- Enterprise B2B Commercial Sales Return / RMA Header
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.commercial_sales_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    return_number TEXT NOT NULL,
    sales_order_id UUID NULL REFERENCES public.sales_orders(id) ON DELETE RESTRICT,
    delivery_challan_id UUID NULL REFERENCES public.delivery_challans(id) ON DELETE RESTRICT,
    commercial_tax_invoice_id UUID NULL REFERENCES public.commercial_tax_invoices(id) ON DELETE RESTRICT,
    dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
    customer_id UUID NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    return_type TEXT NOT NULL DEFAULT 'COMMERCIAL_RETURN' CHECK (
        return_type IN ('DOCK_REJECTION', 'COMMERCIAL_RETURN', 'TRANSIT_DAMAGE', 'BILLING_CORRECTION')
    ),
    return_reason TEXT NOT NULL CHECK (
        return_reason IN (
            'TRANSIT_DAMAGE',
            'TRANSIT_WATER_DAMAGE',
            'DEFECTIVE_ON_ARRIVAL',
            'WRONG_MODEL_SHIPPED',
            'EXCESS_DISPATCH',
            'DEALER_OVERSTOCK_RETURN',
            'CUSTOMER_ORDER_CANCELLED',
            'PRICING_DISCREPANCY'
        )
    ),
    rdc_number TEXT NULL,
    carrier_name TEXT NULL,
    carrier_lr_number TEXT NULL,
    tracking_reference TEXT NULL,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    requested_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_date DATE NULL,
    status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (
        status IN (
            'REQUESTED',
            'APPROVED',
            'RDC_ISSUED',
            'IN_TRANSIT',
            'RECEIVED',
            'UNDER_INSPECTION',
            'ACCEPTED',
            'PARTIALLY_ACCEPTED',
            'REJECTED',
            'CREDIT_NOTE_PENDING',
            'CREDIT_NOTE_ISSUED',
            'SETTLED',
            'CANCELLED'
        )
    ),
    inspection_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
        inspection_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'WAIVED')
    ),
    approval_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (
        approval_status IN ('NOT_REQUIRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')
    ),
    financial_status TEXT NOT NULL DEFAULT 'PENDING_CREDIT' CHECK (
        financial_status IN ('NOT_APPLICABLE', 'PENDING_CREDIT', 'CREDIT_ISSUED', 'SETTLED')
    ),
    total_items_requested INT NOT NULL DEFAULT 0 CHECK (total_items_requested >= 0),
    total_items_received INT NOT NULL DEFAULT 0 CHECK (total_items_received >= 0),
    total_items_accepted INT NOT NULL DEFAULT 0 CHECK (total_items_accepted >= 0),
    total_taxable_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_taxable_value >= 0),
    total_tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_tax_amount >= 0),
    total_credit_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_credit_amount >= 0),
    notes TEXT NULL,
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_commercial_return_number_tenant UNIQUE (tenant_id, return_number),
    CONSTRAINT chk_commercial_return_party CHECK (dealer_id IS NOT NULL OR customer_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_commercial_returns_tenant ON public.commercial_sales_returns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commercial_returns_dealer ON public.commercial_sales_returns(dealer_id);
CREATE INDEX IF NOT EXISTS idx_commercial_returns_so ON public.commercial_sales_returns(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_commercial_returns_invoice ON public.commercial_sales_returns(commercial_tax_invoice_id);
CREATE INDEX IF NOT EXISTS idx_commercial_returns_status ON public.commercial_sales_returns(status);
CREATE INDEX IF NOT EXISTS idx_commercial_returns_rdc ON public.commercial_sales_returns(rdc_number);

-- =============================================================================
-- 3. TABLE: public.commercial_sales_return_items
-- Serialized Item-Level Returns & Inspection Triage Dispositions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.commercial_sales_return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    commercial_return_id UUID NOT NULL REFERENCES public.commercial_sales_returns(id) ON DELETE CASCADE,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    serial_number TEXT NOT NULL,
    barcode TEXT NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity = 1),
    original_unit_price NUMERIC(14, 2) NOT NULL CHECK (original_unit_price >= 0),
    return_taxable_value NUMERIC(14, 2) NOT NULL CHECK (return_taxable_value >= 0),
    tax_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 18.00 CHECK (tax_rate_pct >= 0),
    cgst_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (cgst_amount >= 0),
    sgst_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (sgst_amount >= 0),
    igst_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (igst_amount >= 0),
    line_total_credit NUMERIC(14, 2) NOT NULL CHECK (line_total_credit >= 0),
    item_status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (
        item_status IN ('REQUESTED', 'RECEIVED', 'INSPECTED', 'ACCEPTED', 'REJECTED')
    ),
    inspection_result TEXT NULL CHECK (
        inspection_result IN ('MINT_UNOPENED', 'OPEN_BOX_UNDAMAGED', 'MINOR_COSMETIC_BLEMISH', 'MAJOR_PHYSICAL_DAMAGE', 'ELECTRONIC_FAILURE', 'WATER_DAMAGED')
    ),
    disposition TEXT NOT NULL DEFAULT 'QUARANTINE' CHECK (
        disposition IN (
            'QUARANTINE',
            'RESTOCK',
            'REFURBISH',
            'SCRAP',
            'CARRIER_CLAIM',
            'REJECT_RETURN'
        )
    ),
    packaging_intact BOOLEAN NOT NULL DEFAULT true,
    accessories_included BOOLEAN NOT NULL DEFAULT true,
    panel_undamaged BOOLEAN NOT NULL DEFAULT true,
    power_on_passed BOOLEAN NOT NULL DEFAULT true,
    rejection_reason TEXT NULL,
    inspector_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    inspected_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_return_item_unit UNIQUE (commercial_return_id, product_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_return_items_return ON public.commercial_sales_return_items(commercial_return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_unit ON public.commercial_sales_return_items(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_return_items_serial ON public.commercial_sales_return_items(serial_number);
CREATE INDEX IF NOT EXISTS idx_return_items_disposition ON public.commercial_sales_return_items(disposition);

-- =============================================================================
-- 4. TABLE: public.statutory_credit_notes
-- Authoritative Statutory GST Credit Notes (HSN 8528)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.statutory_credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    credit_note_number TEXT NOT NULL,
    credit_note_date DATE NOT NULL DEFAULT CURRENT_DATE,
    commercial_return_id UUID NOT NULL REFERENCES public.commercial_sales_returns(id) ON DELETE RESTRICT,
    original_invoice_id UUID NOT NULL REFERENCES public.commercial_tax_invoices(id) ON DELETE RESTRICT,
    dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
    customer_id UUID NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    seller_gstin TEXT NOT NULL DEFAULT '27AAACZ8901D1Z5',
    buyer_gstin TEXT NULL,
    place_of_supply TEXT NOT NULL,
    hsn_sac TEXT NOT NULL DEFAULT '8528',
    is_inter_state BOOLEAN NOT NULL DEFAULT false,
    taxable_amount NUMERIC(14, 2) NOT NULL CHECK (taxable_amount > 0),
    tax_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 18.00 CHECK (tax_rate_pct >= 0),
    cgst_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (cgst_amount >= 0),
    sgst_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (sgst_amount >= 0),
    igst_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (igst_amount >= 0),
    total_tax NUMERIC(14, 2) NOT NULL CHECK (total_tax >= 0),
    grand_total NUMERIC(14, 2) NOT NULL CHECK (grand_total > 0),
    reason TEXT NOT NULL DEFAULT 'SALES_RETURN' CHECK (
        reason IN ('SALES_RETURN', 'POST_SALE_DISCOUNT', 'DEFICIENCY_IN_SERVICE', 'CORRECTION_IN_INVOICE')
    ),
    statutory_status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (
        statutory_status IN ('DRAFT', 'ISSUED', 'CANCELLED')
    ),
    e_credit_note_status TEXT NOT NULL DEFAULT 'PENDING_PROVIDER' CHECK (
        e_credit_note_status IN ('PENDING_PROVIDER', 'PROVIDER_SUBMITTED', 'IRN_GENERATED', 'FAILED')
    ),
    irn TEXT NULL,
    e_credit_note_hash TEXT NULL,
    acknowledgement_number TEXT NULL,
    acknowledgement_date TIMESTAMPTZ NULL,
    journal_entry_id UUID NULL REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    ar_transaction_id UUID NULL REFERENCES public.customer_ar_transactions(id) ON DELETE SET NULL,
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_statutory_credit_note_tenant UNIQUE (tenant_id, credit_note_number),
    CONSTRAINT chk_cn_tax_split_integrity CHECK (
        (is_inter_state = true AND cgst_amount = 0 AND sgst_amount = 0 AND igst_amount = total_tax) OR
        (is_inter_state = false AND igst_amount = 0 AND round(cgst_amount + sgst_amount, 2) = total_tax)
    )
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant ON public.statutory_credit_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_return ON public.statutory_credit_notes(commercial_return_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON public.statutory_credit_notes(original_invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_dealer ON public.statutory_credit_notes(dealer_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_date ON public.statutory_credit_notes(credit_note_date);

-- =============================================================================
-- 5. TABLE: public.carrier_transit_damage_claims
-- In-Transit Logistics Carrier Damage & Insurance Recovery Claims
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.carrier_transit_damage_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    claim_number TEXT NOT NULL,
    commercial_return_id UUID NOT NULL REFERENCES public.commercial_sales_returns(id) ON DELETE RESTRICT,
    delivery_challan_id UUID NULL REFERENCES public.delivery_challans(id) ON DELETE SET NULL,
    carrier_name TEXT NOT NULL,
    tracking_lr_number TEXT NOT NULL,
    damaged_serial_units INT NOT NULL CHECK (damaged_serial_units > 0),
    declared_consignment_value NUMERIC(14, 2) NOT NULL CHECK (declared_consignment_value >= 0),
    claimed_amount NUMERIC(14, 2) NOT NULL CHECK (claimed_amount > 0),
    approved_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (approved_amount >= 0),
    settled_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (settled_amount >= 0),
    claim_status TEXT NOT NULL DEFAULT 'OPEN' CHECK (
        claim_status IN (
            'OPEN',
            'SUBMITTED',
            'UNDER_REVIEW',
            'APPROVED',
            'PARTIALLY_APPROVED',
            'REJECTED',
            'SETTLED',
            'CLOSED'
        )
    ),
    incident_description TEXT NOT NULL,
    carrier_survey_report_ref TEXT NULL,
    carrier_debit_note_ref TEXT NULL,
    settlement_date DATE NULL,
    journal_entry_id UUID NULL REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_carrier_claim_number_tenant UNIQUE (tenant_id, claim_number),
    CONSTRAINT chk_claim_settled_le_approved CHECK (settled_amount <= approved_amount)
);

CREATE INDEX IF NOT EXISTS idx_carrier_claims_tenant ON public.carrier_transit_damage_claims(tenant_id);
CREATE INDEX IF NOT EXISTS idx_carrier_claims_return ON public.carrier_transit_damage_claims(commercial_return_id);
CREATE INDEX IF NOT EXISTS idx_carrier_claims_status ON public.carrier_transit_damage_claims(claim_status);

-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.commercial_sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_sales_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statutory_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrier_transit_damage_claims ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.commercial_sales_returns FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.commercial_sales_return_items FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.statutory_credit_notes FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.carrier_transit_damage_claims FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.commercial_sales_returns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.commercial_sales_return_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.statutory_credit_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.carrier_transit_damage_claims TO authenticated;

-- Dealer Isolation Policy: Dealers can only view their own commercial returns and credit notes
CREATE POLICY p_dealer_commercial_returns_select ON public.commercial_sales_returns
    FOR SELECT TO authenticated
    USING (
        (auth.jwt()->>'role') IN ('super_admin', 'admin', 'finance', 'inventory', 'sales') OR
        (dealer_id IN (SELECT id FROM public.dealers WHERE email = auth.jwt()->>'email'))
    );

CREATE POLICY p_dealer_credit_notes_select ON public.statutory_credit_notes
    FOR SELECT TO authenticated
    USING (
        (auth.jwt()->>'role') IN ('super_admin', 'admin', 'finance', 'sales') OR
        (dealer_id IN (SELECT id FROM public.dealers WHERE email = auth.jwt()->>'email'))
    );

-- Corporate access for carrier claims and return items
CREATE POLICY p_staff_return_items_select ON public.commercial_sales_return_items
    FOR SELECT TO authenticated
    USING (
        (auth.jwt()->>'role') IN ('super_admin', 'admin', 'finance', 'inventory', 'sales') OR
        (commercial_return_id IN (
            SELECT id FROM public.commercial_sales_returns 
            WHERE dealer_id IN (SELECT id FROM public.dealers WHERE email = auth.jwt()->>'email')
        ))
    );

CREATE POLICY p_staff_carrier_claims_all ON public.carrier_transit_damage_claims
    FOR ALL TO authenticated
    USING ((auth.jwt()->>'role') IN ('super_admin', 'admin', 'finance', 'inventory'));

-- =============================================================================
-- 7. RPC: fn_initiate_b2b_sales_return
-- Initiates commercial sales return and allocates serialized units to return items
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_initiate_b2b_sales_return(p_return_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_sales_order_id UUID;
    v_invoice_id UUID;
    v_dealer_id UUID;
    v_warehouse_id UUID;
    v_return_reason TEXT;
    v_return_type TEXT;
    v_notes TEXT;
    v_items JSONB;
    v_item JSONB;
    v_return_id UUID;
    v_return_number TEXT;
    v_seq_val BIGINT;
    v_total_taxable NUMERIC(14, 2) := 0.00;
    v_total_tax NUMERIC(14, 2) := 0.00;
    v_total_credit NUMERIC(14, 2) := 0.00;
    v_item_count INT := 0;
    v_unit_rec RECORD;
    v_invoice_rec RECORD;
    v_so_rec RECORD;
    v_is_inter_state BOOLEAN;
    v_item_taxable NUMERIC(14, 2);
    v_cgst NUMERIC(14, 2) := 0.00;
    v_sgst NUMERIC(14, 2) := 0.00;
    v_igst NUMERIC(14, 2) := 0.00;
    v_line_total NUMERIC(14, 2);
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'sales', 'inventory', 'finance')
        ) THEN
            RAISE EXCEPTION 'Access denied: Only authorized sales, inventory, or finance staff may initiate returns.';
        END IF;
    END IF;

    v_sales_order_id := (p_return_data->>'sales_order_id')::uuid;
    v_invoice_id := (p_return_data->>'commercial_tax_invoice_id')::uuid;
    v_dealer_id := (p_return_data->>'dealer_id')::uuid;
    v_warehouse_id := (p_return_data->>'warehouse_id')::uuid;
    v_return_reason := p_return_data->>'return_reason';
    v_return_type := COALESCE(p_return_data->>'return_type', 'COMMERCIAL_RETURN');
    v_notes := p_return_data->>'notes';
    v_items := p_return_data->'items';

    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RAISE EXCEPTION 'Return initiation requires at least one serialized product unit.';
    END IF;

    -- Validate originating commercial invoice
    IF v_invoice_id IS NOT NULL THEN
        SELECT * INTO v_invoice_rec FROM public.commercial_tax_invoices WHERE id = v_invoice_id;
        IF v_invoice_rec.id IS NULL THEN
            RAISE EXCEPTION 'Invalid invoice reference: Commercial tax invoice not found.';
        END IF;
        IF v_invoice_rec.invoice_status = 'CANCELLED' THEN
            RAISE EXCEPTION 'Commercial return cannot be initiated against a CANCELLED tax invoice.';
        END IF;
        v_is_inter_state := v_invoice_rec.is_inter_state;
        IF v_dealer_id IS NULL THEN
            v_dealer_id := v_invoice_rec.dealer_id;
        END IF;
    ELSE
        v_is_inter_state := false;
    END IF;

    -- Fallback warehouse if not specified
    IF v_warehouse_id IS NULL THEN
        SELECT id INTO v_warehouse_id FROM public.warehouses WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
        IF v_warehouse_id IS NULL THEN
            RAISE EXCEPTION 'No active destination warehouse found to receive commercial returns.';
        END IF;
    END IF;

    -- Generate sequential return number
    v_seq_val := nextval('public.seq_commercial_return_number');
    v_return_number := 'RET-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_seq_val::text, 4, '0');

    -- Insert return header
    INSERT INTO public.commercial_sales_returns (
        return_number,
        sales_order_id,
        commercial_tax_invoice_id,
        dealer_id,
        warehouse_id,
        return_type,
        return_reason,
        notes,
        created_by
    ) VALUES (
        v_return_number,
        v_sales_order_id,
        v_invoice_id,
        v_dealer_id,
        v_warehouse_id,
        v_return_type,
        v_return_reason,
        v_notes,
        v_actor_id
    ) RETURNING id INTO v_return_id;

    -- Loop through serialized items and validate
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        -- Look up product unit by serial number or ID
        IF v_item->>'product_unit_id' IS NOT NULL THEN
            SELECT pu.*, pv.id as var_id, pv.mrp, pv.dealer_price INTO v_unit_rec
            FROM public.product_units pu
            JOIN public.product_variants pv ON pu.variant_id = pv.id
            WHERE pu.id = (v_item->>'product_unit_id')::uuid;
        ELSE
            SELECT pu.*, pv.id as var_id, pv.mrp, pv.dealer_price INTO v_unit_rec
            FROM public.product_units pu
            JOIN public.product_variants pv ON pu.variant_id = pv.id
            WHERE pu.serial_number = (v_item->>'serial_number');
        END IF;

        IF v_unit_rec.id IS NULL THEN
            RAISE EXCEPTION 'Serialized product unit % not found in database.', COALESCE(v_item->>'serial_number', v_item->>'product_unit_id');
        END IF;

        -- Prevent duplicate return of the same unit under an active open return
        IF EXISTS (
            SELECT 1 FROM public.commercial_sales_return_items ri
            JOIN public.commercial_sales_returns r ON ri.commercial_return_id = r.id
            WHERE ri.product_unit_id = v_unit_rec.id
              AND r.status NOT IN ('CANCELLED', 'REJECTED')
        ) THEN
            RAISE EXCEPTION 'Product unit % (Serial %) is already enrolled in an active commercial return.', v_unit_rec.id, v_unit_rec.serial_number;
        END IF;

        v_item_taxable := COALESCE((v_item->>'return_taxable_value')::numeric, v_unit_rec.dealer_price, 15000.00);
        IF v_is_inter_state THEN
            v_igst := round(v_item_taxable * 0.18, 2);
            v_cgst := 0.00;
            v_sgst := 0.00;
        ELSE
            v_cgst := round(v_item_taxable * 0.09, 2);
            v_sgst := round(v_item_taxable * 0.09, 2);
            v_igst := 0.00;
        END IF;
        v_line_total := v_item_taxable + v_cgst + v_sgst + v_igst;

        INSERT INTO public.commercial_sales_return_items (
            commercial_return_id,
            product_unit_id,
            product_variant_id,
            serial_number,
            barcode,
            quantity,
            original_unit_price,
            return_taxable_value,
            tax_rate_pct,
            cgst_amount,
            sgst_amount,
            igst_amount,
            line_total_credit
        ) VALUES (
            v_return_id,
            v_unit_rec.id,
            v_unit_rec.var_id,
            v_unit_rec.serial_number,
            v_unit_rec.barcode,
            1,
            v_item_taxable,
            v_item_taxable,
            18.00,
            v_cgst,
            v_sgst,
            v_igst,
            v_line_total
        );

        v_total_taxable := v_total_taxable + v_item_taxable;
        v_total_tax := v_total_tax + v_cgst + v_sgst + v_igst;
        v_total_credit := v_total_credit + v_line_total;
        v_item_count := v_item_count + 1;
    END LOOP;

    -- Update header aggregates
    UPDATE public.commercial_sales_returns
    SET total_items_requested = v_item_count,
        total_taxable_value = v_total_taxable,
        total_tax_amount = v_total_tax,
        total_credit_amount = v_total_credit,
        approval_status = CASE WHEN v_total_credit > 50000.00 THEN 'PENDING_APPROVAL' ELSE 'APPROVED' END,
        status = CASE WHEN v_total_credit > 50000.00 THEN 'REQUESTED' ELSE 'APPROVED' END
    WHERE id = v_return_id;

    RETURN jsonb_build_object(
        'success', true,
        'return_id', v_return_id,
        'return_number', v_return_number,
        'item_count', v_item_count,
        'total_credit_amount', v_total_credit,
        'requires_approval', (v_total_credit > 50000.00)
    );
END;
$$;

-- =============================================================================
-- 8. RPC: fn_generate_reverse_delivery_challan
-- Generates an authoritative RDC for dealer dock return shipment
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_generate_reverse_delivery_challan(
    p_return_id UUID,
    p_transporter_name TEXT,
    p_vehicle_number TEXT,
    p_lr_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_return_rec RECORD;
    v_rdc_number TEXT;
    v_seq_val BIGINT;
BEGIN
    SELECT * INTO v_return_rec FROM public.commercial_sales_returns WHERE id = p_return_id;
    IF v_return_rec.id IS NULL THEN
        RAISE EXCEPTION 'Commercial return not found.';
    END IF;

    IF v_return_rec.status NOT IN ('REQUESTED', 'APPROVED') THEN
        RAISE EXCEPTION 'Cannot issue RDC for return in status %.', v_return_rec.status;
    END IF;

    v_seq_val := nextval('public.seq_reverse_delivery_challan_number');
    v_rdc_number := 'RDC-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_seq_val::text, 4, '0');

    UPDATE public.commercial_sales_returns
    SET rdc_number = v_rdc_number,
        carrier_name = p_transporter_name,
        carrier_lr_number = p_lr_number,
        tracking_reference = p_vehicle_number,
        status = 'RDC_ISSUED',
        updated_at = now()
    WHERE id = p_return_id;

    RETURN jsonb_build_object(
        'success', true,
        'return_id', p_return_id,
        'rdc_number', v_rdc_number,
        'carrier_name', p_transporter_name
    );
END;
$$;

-- =============================================================================
-- 9. RPC: fn_inspect_and_triage_commercial_return
-- Records warehouse dock intake, physical testing, and serialized disposition
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_inspect_and_triage_commercial_return(p_inspection_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_return_id UUID;
    v_inspections JSONB;
    v_insp JSONB;
    v_return_rec RECORD;
    v_accepted_count INT := 0;
    v_carrier_claim_needed BOOLEAN := false;
    v_carrier_claim_id UUID;
    v_carrier_claim_number TEXT;
    v_claim_seq BIGINT;
    v_claim_amount NUMERIC(14, 2) := 0.00;
    v_claim_unit_count INT := 0;
    v_unit_rec RECORD;
    v_item_rec RECORD;
    v_disp TEXT;
    v_result TEXT;
BEGIN
    v_actor_id := auth.uid();
    v_return_id := (p_inspection_data->>'commercial_return_id')::uuid;
    v_inspections := p_inspection_data->'inspections';

    SELECT * INTO v_return_rec FROM public.commercial_sales_returns WHERE id = v_return_id;
    IF v_return_rec.id IS NULL THEN
        RAISE EXCEPTION 'Commercial return not found.';
    END IF;

    IF v_return_rec.status IN ('ACCEPTED', 'CREDIT_NOTE_ISSUED', 'SETTLED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Return % is already finalized in status %.', v_return_rec.return_number, v_return_rec.status;
    END IF;

    -- Process each inspected item
    FOR v_insp IN SELECT * FROM jsonb_array_elements(v_inspections)
    LOOP
        v_disp := v_insp->>'disposition';
        v_result := v_insp->>'inspection_result';

        IF v_disp NOT IN ('RESTOCK', 'REFURBISH', 'SCRAP', 'QUARANTINE', 'CARRIER_CLAIM', 'REJECT_RETURN') THEN
            RAISE EXCEPTION 'Invalid disposition % specified.', v_disp;
        END IF;

        SELECT ri.*, pu.status as unit_status INTO v_item_rec
        FROM public.commercial_sales_return_items ri
        JOIN public.product_units pu ON ri.product_unit_id = pu.id
        WHERE ri.commercial_return_id = v_return_id
          AND (ri.product_unit_id = (v_insp->>'product_unit_id')::uuid OR ri.serial_number = v_insp->>'serial_number')
        LIMIT 1;

        IF v_item_rec.id IS NULL THEN
            RAISE EXCEPTION 'Serialized unit not found on return item manifest.';
        END IF;

        UPDATE public.commercial_sales_return_items
        SET item_status = CASE WHEN v_disp = 'REJECT_RETURN' THEN 'REJECTED' ELSE 'ACCEPTED' END,
            inspection_result = v_result,
            disposition = v_disp,
            packaging_intact = COALESCE((v_insp->>'packaging_intact')::boolean, true),
            accessories_included = COALESCE((v_insp->>'accessories_included')::boolean, true),
            panel_undamaged = COALESCE((v_insp->>'panel_undamaged')::boolean, true),
            power_on_passed = COALESCE((v_insp->>'power_on_passed')::boolean, true),
            rejection_reason = v_insp->>'rejection_reason',
            inspector_id = v_actor_id,
            inspected_at = now()
        WHERE id = v_item_rec.id;

        -- Apply inventory state update through existing product_units architecture
        IF v_disp = 'RESTOCK' THEN
            UPDATE public.product_units
            SET status = 'in_stock',
                warehouse_id = v_return_rec.warehouse_id,
                updated_at = now()
            WHERE id = v_item_rec.product_unit_id;

            -- Replenish FIFO inventory cost layer using existing Phase 8.6 table
            INSERT INTO public.inventory_cost_layers (
                product_id,
                product_unit_id,
                warehouse_id,
                source_type,
                source_reference_id,
                quantity_received,
                quantity_remaining,
                unit_cost,
                total_layer_cost,
                status
            ) VALUES (
                v_item_rec.product_variant_id,
                v_item_rec.product_unit_id,
                v_return_rec.warehouse_id,
                'RETURN',
                v_return_rec.id,
                1.00,
                1.00,
                v_item_rec.return_taxable_value,
                v_item_rec.return_taxable_value,
                'OPEN'
            );
            v_accepted_count := v_accepted_count + 1;

        ELSIF v_disp IN ('REFURBISH', 'QUARANTINE') THEN
            UPDATE public.product_units
            SET status = 'maintenance',
                warehouse_id = v_return_rec.warehouse_id,
                updated_at = now()
            WHERE id = v_item_rec.product_unit_id;
            v_accepted_count := v_accepted_count + 1;

        ELSIF v_disp = 'SCRAP' THEN
            UPDATE public.product_units
            SET status = 'scrapped',
                warehouse_id = v_return_rec.warehouse_id,
                updated_at = now()
            WHERE id = v_item_rec.product_unit_id;
            v_accepted_count := v_accepted_count + 1;

        ELSIF v_disp = 'CARRIER_CLAIM' THEN
            UPDATE public.product_units
            SET status = 'damaged',
                warehouse_id = v_return_rec.warehouse_id,
                updated_at = now()
            WHERE id = v_item_rec.product_unit_id;
            v_carrier_claim_needed := true;
            v_claim_amount := v_claim_amount + v_item_rec.return_taxable_value;
            v_claim_unit_count := v_claim_unit_count + 1;
            v_accepted_count := v_accepted_count + 1;
        END IF;
    END LOOP;

    -- If carrier claim items detected, automatically spawn carrier transit claim subledger record
    IF v_carrier_claim_needed THEN
        v_claim_seq := nextval('public.seq_carrier_transit_claim_number');
        v_carrier_claim_number := 'CLM-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_claim_seq::text, 4, '0');

        INSERT INTO public.carrier_transit_damage_claims (
            claim_number,
            commercial_return_id,
            delivery_challan_id,
            carrier_name,
            tracking_lr_number,
            damaged_serial_units,
            declared_consignment_value,
            claimed_amount,
            incident_description,
            created_by
        ) VALUES (
            v_carrier_claim_number,
            v_return_id,
            v_return_rec.delivery_challan_id,
            COALESCE(v_return_rec.carrier_name, 'Logistics Freight Carrier'),
            COALESCE(v_return_rec.carrier_lr_number, 'LR-PENDING'),
            v_claim_unit_count,
            v_claim_amount,
            v_claim_amount,
            'Commercial return inspection confirmed transit damage eligible for carrier liability claim.',
            v_actor_id
        ) RETURNING id INTO v_carrier_claim_id;
    END IF;

    -- Update return header status
    UPDATE public.commercial_sales_returns
    SET status = CASE 
            WHEN v_accepted_count = total_items_requested THEN 'ACCEPTED'
            WHEN v_accepted_count > 0 THEN 'PARTIALLY_ACCEPTED'
            ELSE 'REJECTED'
        END,
        inspection_status = 'COMPLETED',
        received_date = CURRENT_DATE,
        total_items_received = jsonb_array_length(v_inspections),
        total_items_accepted = v_accepted_count,
        financial_status = CASE WHEN v_accepted_count > 0 THEN 'PENDING_CREDIT' ELSE 'NOT_APPLICABLE' END,
        updated_at = now()
    WHERE id = v_return_id;

    RETURN jsonb_build_object(
        'success', true,
        'return_id', v_return_id,
        'accepted_items', v_accepted_count,
        'carrier_claim_id', v_carrier_claim_id,
        'carrier_claim_number', v_carrier_claim_number
    );
END;
$$;

-- =============================================================================
-- 10. RPC: fn_issue_statutory_credit_note_and_post_gl
-- Issues GST credit note, relieves customer AR, and commits balanced double-entry GL journal
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_issue_statutory_credit_note_and_post_gl(p_cn_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_return_id UUID;
    v_return_rec RECORD;
    v_invoice_rec RECORD;
    v_ar_rec RECORD;
    v_cn_number TEXT;
    v_seq_val BIGINT;
    v_credit_note_id UUID;
    v_taxable NUMERIC(14, 2) := 0.00;
    v_cgst NUMERIC(14, 2) := 0.00;
    v_sgst NUMERIC(14, 2) := 0.00;
    v_igst NUMERIC(14, 2) := 0.00;
    v_total_credit NUMERIC(14, 2) := 0.00;
    v_journal_entry_id UUID;
    v_ar_tx_id UUID;
    v_gl_lines JSONB := '[]'::jsonb;
    v_ar_account_id UUID;
    v_rev_account_id UUID;
    v_cgst_account_id UUID;
    v_sgst_account_id UUID;
    v_igst_account_id UUID;
    v_gl_post_res JSONB;
BEGIN
    v_actor_id := auth.uid();
    v_return_id := (p_cn_data->>'commercial_return_id')::uuid;

    SELECT * INTO v_return_rec FROM public.commercial_sales_returns WHERE id = v_return_id;
    IF v_return_rec.id IS NULL THEN
        RAISE EXCEPTION 'Commercial return not found.';
    END IF;

    IF v_return_rec.status NOT IN ('ACCEPTED', 'PARTIALLY_ACCEPTED') THEN
        RAISE EXCEPTION 'Credit note can only be issued for ACCEPTED or PARTIALLY_ACCEPTED commercial returns.';
    END IF;

    -- Prevent duplicate credit note issuance for the same return
    IF EXISTS (SELECT 1 FROM public.statutory_credit_notes WHERE commercial_return_id = v_return_id) THEN
        RAISE EXCEPTION 'Statutory credit note has already been issued for commercial return %.', v_return_rec.return_number;
    END IF;

    SELECT * INTO v_invoice_rec FROM public.commercial_tax_invoices WHERE id = v_return_rec.commercial_tax_invoice_id;
    IF v_invoice_rec.id IS NULL THEN
        RAISE EXCEPTION 'Original commercial tax invoice not found on return record.';
    END IF;

    -- Aggregate eligible accepted return items
    SELECT 
        COALESCE(SUM(return_taxable_value), 0.00),
        COALESCE(SUM(cgst_amount), 0.00),
        COALESCE(SUM(sgst_amount), 0.00),
        COALESCE(SUM(igst_amount), 0.00),
        COALESCE(SUM(line_total_credit), 0.00)
    INTO v_taxable, v_cgst, v_sgst, v_igst, v_total_credit
    FROM public.commercial_sales_return_items
    WHERE commercial_return_id = v_return_id AND item_status = 'ACCEPTED';

    IF v_total_credit <= 0 THEN
        RAISE EXCEPTION 'No eligible accepted items available for credit note generation.';
    END IF;

    -- Guard against over-crediting original invoice
    IF v_total_credit > v_invoice_rec.grand_total THEN
        RAISE EXCEPTION 'Credit note total % cannot exceed original tax invoice amount %.', v_total_credit, v_invoice_rec.grand_total;
    END IF;

    -- Concurrency-safe sequential credit note number
    v_seq_val := nextval('public.seq_statutory_credit_note_number');
    v_cn_number := 'CN-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_seq_val::text, 4, '0');

    -- Insert statutory credit note header
    INSERT INTO public.statutory_credit_notes (
        credit_note_number,
        commercial_return_id,
        original_invoice_id,
        dealer_id,
        customer_id,
        seller_gstin,
        buyer_gstin,
        place_of_supply,
        hsn_sac,
        is_inter_state,
        taxable_amount,
        tax_rate_pct,
        cgst_rate_pct,
        cgst_amount,
        sgst_rate_pct,
        sgst_amount,
        igst_rate_pct,
        igst_amount,
        total_tax,
        grand_total,
        reason,
        created_by
    ) VALUES (
        v_cn_number,
        v_return_id,
        v_invoice_rec.id,
        v_return_rec.dealer_id,
        v_return_rec.customer_id,
        v_invoice_rec.seller_gstin,
        v_invoice_rec.buyer_gstin,
        v_invoice_rec.place_of_supply,
        '8528',
        v_invoice_rec.is_inter_state,
        v_taxable,
        18.00,
        CASE WHEN v_invoice_rec.is_inter_state THEN 0.00 ELSE 9.00 END,
        v_cgst,
        CASE WHEN v_invoice_rec.is_inter_state THEN 0.00 ELSE 9.00 END,
        v_sgst,
        CASE WHEN v_invoice_rec.is_inter_state THEN 18.00 ELSE 0.00 END,
        v_igst,
        (v_cgst + v_sgst + v_igst),
        v_total_credit,
        'SALES_RETURN',
        v_actor_id
    ) RETURNING id INTO v_credit_note_id;

    -- 1. Apply Customer Accounts Receivable (AR) reduction
    SELECT * INTO v_ar_rec 
    FROM public.customer_ar_ledger 
    WHERE invoice_number = v_invoice_rec.invoice_number
    LIMIT 1;

    IF v_ar_rec.id IS NOT NULL THEN
        -- Insert immutable AR credit transaction
        INSERT INTO public.customer_ar_transactions (
            ar_ledger_id,
            transaction_type,
            amount,
            reference_id,
            actor,
            notes
        ) VALUES (
            v_ar_rec.id,
            'CREDIT_MEMO_OFFSET',
            v_total_credit,
            v_cn_number,
            v_actor_id,
            'Statutory credit note issued for commercial return ' || v_return_rec.return_number
        ) RETURNING id INTO v_ar_tx_id;

        -- Atomically adjust AR balance
        UPDATE public.customer_ar_ledger
        SET settled_amount = round(settled_amount + v_total_credit, 2),
            remaining_balance = round(GREATEST(remaining_balance - v_total_credit, 0.00), 2),
            status = CASE WHEN (remaining_balance - v_total_credit) <= 0 THEN 'SETTLED' ELSE 'PARTIALLY_SETTLED' END,
            updated_at = now()
        WHERE id = v_ar_rec.id;
    END IF;

    -- 2. Build double-entry GL journal entry through existing Phase 8.3 Chart of Accounts
    -- Dr Sales Returns / Revenue Adjustment (4000)
    -- Dr Output CGST (2210)
    -- Dr Output SGST (2220)
    -- Dr Output IGST (2230)
    -- Cr Accounts Receivable Control (1100)
    SELECT id INTO v_ar_account_id FROM public.chart_of_accounts WHERE account_number = '1100';
    SELECT id INTO v_rev_account_id FROM public.chart_of_accounts WHERE account_number = '4000';
    SELECT id INTO v_cgst_account_id FROM public.chart_of_accounts WHERE account_number = '2210';
    SELECT id INTO v_sgst_account_id FROM public.chart_of_accounts WHERE account_number = '2220';
    SELECT id INTO v_igst_account_id FROM public.chart_of_accounts WHERE account_number = '2230';

    v_gl_lines := jsonb_build_array(
        jsonb_build_object(
            'account_id', v_rev_account_id,
            'debit_amount', v_taxable,
            'credit_amount', 0.00,
            'description', 'Sales Revenue Reversal for Return ' || v_return_rec.return_number
        )
    );

    IF v_invoice_rec.is_inter_state THEN
        v_gl_lines := v_gl_lines || jsonb_build_object(
            'account_id', v_igst_account_id,
            'debit_amount', v_igst,
            'credit_amount', 0.00,
            'description', 'Output IGST Reversal on Credit Note ' || v_cn_number
        );
    ELSE
        v_gl_lines := v_gl_lines || jsonb_build_object(
            'account_id', v_cgst_account_id,
            'debit_amount', v_cgst,
            'credit_amount', 0.00,
            'description', 'Output CGST Reversal on Credit Note ' || v_cn_number
        ) || jsonb_build_object(
            'account_id', v_sgst_account_id,
            'debit_amount', v_sgst,
            'credit_amount', 0.00,
            'description', 'Output SGST Reversal on Credit Note ' || v_cn_number
        );
    END IF;

    v_gl_lines := v_gl_lines || jsonb_build_object(
        'account_id', v_ar_account_id,
        'debit_amount', 0.00,
        'credit_amount', v_total_credit,
        'description', 'AR Ledger Credit for ' || v_cn_number
    );

    -- Post balanced journal entry via Phase 8.3 authoritative RPC
    v_gl_post_res := public.fn_post_journal_entry(jsonb_build_object(
        'entry_date', CURRENT_DATE,
        'source_document_type', 'COMMERCIAL_INVOICE',
        'source_document_reference_id', v_credit_note_id,
        'narration', 'Statutory GST Credit Note ' || v_cn_number || ' against invoice ' || v_invoice_rec.invoice_number,
        'lines', v_gl_lines
    ));

    v_journal_entry_id := (v_gl_post_res->>'journal_entry_id')::uuid;

    -- Link GL and AR references to Credit Note
    UPDATE public.statutory_credit_notes
    SET journal_entry_id = v_journal_entry_id,
        ar_transaction_id = v_ar_tx_id,
        updated_at = now()
    WHERE id = v_credit_note_id;

    -- Update commercial return status
    UPDATE public.commercial_sales_returns
    SET status = 'CREDIT_NOTE_ISSUED',
        financial_status = 'CREDIT_ISSUED',
        updated_at = now()
    WHERE id = v_return_id;

    RETURN jsonb_build_object(
        'success', true,
        'credit_note_id', v_credit_note_id,
        'credit_note_number', v_cn_number,
        'grand_total', v_total_credit,
        'journal_entry_id', v_journal_entry_id,
        'ar_transaction_id', v_ar_tx_id
    );
END;
$$;

-- =============================================================================
-- 11. RPC: fn_settle_transit_damage_claim
-- Settles carrier liability insurance claim and commits GL financial recovery
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_settle_transit_damage_claim(
    p_claim_id UUID,
    p_approved_amount NUMERIC(14, 2),
    p_settled_amount NUMERIC(14, 2),
    p_carrier_debit_note_ref TEXT,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_claim_rec RECORD;
    v_bank_acc_id UUID;
    v_scrap_gain_loss_acc_id UUID;
    v_gl_lines JSONB;
    v_gl_res JSONB;
    v_journal_entry_id UUID;
BEGIN
    SELECT * INTO v_claim_rec FROM public.carrier_transit_damage_claims WHERE id = p_claim_id;
    IF v_claim_rec.id IS NULL THEN
        RAISE EXCEPTION 'Carrier claim not found.';
    END IF;

    IF v_claim_rec.claim_status = 'SETTLED' THEN
        RAISE EXCEPTION 'Carrier claim % is already SETTLED.', v_claim_rec.claim_number;
    END IF;

    IF p_settled_amount > p_approved_amount THEN
        RAISE EXCEPTION 'Settled amount % cannot exceed approved amount %.', p_settled_amount, p_approved_amount;
    END IF;

    -- Dr Bank Account (1010)
    -- Cr Scrap / Transit Loss Recovery (5300)
    SELECT id INTO v_bank_acc_id FROM public.chart_of_accounts WHERE account_number = '1010';
    SELECT id INTO v_scrap_gain_loss_acc_id FROM public.chart_of_accounts WHERE account_number = '5300';

    v_gl_lines := jsonb_build_array(
        jsonb_build_object(
            'account_id', v_bank_acc_id,
            'debit_amount', p_settled_amount,
            'credit_amount', 0.00,
            'description', 'Carrier Claim Settlement ' || v_claim_rec.claim_number
        ),
        jsonb_build_object(
            'account_id', v_scrap_gain_loss_acc_id,
            'debit_amount', 0.00,
            'credit_amount', p_settled_amount,
            'description', 'Transit Damage Insurance Recovery ' || v_claim_rec.claim_number
        )
    );

    v_gl_res := public.fn_post_journal_entry(jsonb_build_object(
        'entry_date', CURRENT_DATE,
        'source_document_type', 'COMMERCIAL_INVOICE',
        'source_document_reference_id', p_claim_id,
        'narration', 'Transit Damage Claim Settlement ' || v_claim_rec.claim_number || ' from carrier ' || v_claim_rec.carrier_name,
        'lines', v_gl_lines
    ));

    v_journal_entry_id := (v_gl_res->>'journal_entry_id')::uuid;

    UPDATE public.carrier_transit_damage_claims
    SET approved_amount = p_approved_amount,
        settled_amount = p_settled_amount,
        carrier_debit_note_ref = p_carrier_debit_note_ref,
        settlement_date = CURRENT_DATE,
        claim_status = 'SETTLED',
        journal_entry_id = v_journal_entry_id,
        updated_at = now()
    WHERE id = p_claim_id;

    RETURN jsonb_build_object(
        'success', true,
        'claim_id', p_claim_id,
        'settled_amount', p_settled_amount,
        'journal_entry_id', v_journal_entry_id
    );
END;
$$;
