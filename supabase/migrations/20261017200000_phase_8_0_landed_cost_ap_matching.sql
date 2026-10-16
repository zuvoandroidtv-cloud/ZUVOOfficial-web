-- =============================================================================
-- ZUVO TV CRM — PHASE 8.0 MASTER DATABASE MIGRATION
-- Enterprise Landed Cost Accounting, 3-Way Procurement Matching & Vendor Accounts Payable Ledger
-- Filename: 20261017200000_phase_8_0_landed_cost_ap_matching.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. TABLE: vendor_invoices
-- Commercial Tax Invoices issued by vendors against Purchase Orders and GRNs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
    purchase_receipt_id UUID NULL REFERENCES public.purchase_receipts(id) ON DELETE SET NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    subtotal NUMERIC(14, 2) NOT NULL CHECK (subtotal >= 0),
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount >= 0),
    payment_terms TEXT NOT NULL DEFAULT 'NET_30' CHECK (payment_terms IN ('ADVANCE', 'IMMEDIATE', 'NET_15', 'NET_30', 'NET_60', 'NET_90', 'CONSIGNMENT')),
    match_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (match_status IN (
        'PENDING', 'MATCHED', 'MATCHED_WITHIN_TOLERANCE', 'PRICE_VARIANCE',
        'QUANTITY_VARIANCE', 'BOTH_VARIANCE', 'MISSING_GRN', 'MISSING_PO',
        'CFO_APPROVAL_REQUIRED', 'APPROVED_EXCEPTION', 'REJECTED'
    )),
    price_variance_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    price_variance_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    qty_variance_units INT NOT NULL DEFAULT 0,
    variance_reason TEXT NULL,
    approved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NULL,
    cfo_approval_notes TEXT NULL,
    status TEXT NOT NULL DEFAULT 'UNPOSTED' CHECK (status IN (
        'DRAFT', 'UNPOSTED', 'POSTED_TO_AP', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'DISPUTED'
    )),
    notes TEXT NULL,
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_vendor_invoice_vendor_num UNIQUE (vendor_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_vendor_invoices_vendor ON public.vendor_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_po ON public.vendor_invoices(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_match ON public.vendor_invoices(match_status);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_status ON public.vendor_invoices(status);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_due ON public.vendor_invoices(due_date);

-- -----------------------------------------------------------------------------
-- 2. TABLE: vendor_invoice_items
-- Line items on the vendor commercial invoice matched to PO line items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_invoice_id UUID NOT NULL REFERENCES public.vendor_invoices(id) ON DELETE CASCADE,
    purchase_order_item_id UUID NULL REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
    product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    invoiced_quantity INT NOT NULL CHECK (invoiced_quantity > 0),
    unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
    tax_rate NUMERIC(6, 2) NOT NULL DEFAULT 18.00 CHECK (tax_rate >= 0),
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    line_total NUMERIC(14, 2) NOT NULL CHECK (line_total >= 0),
    po_unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    grn_received_qty INT NOT NULL DEFAULT 0,
    variance_flag TEXT NOT NULL DEFAULT 'OK' CHECK (variance_flag IN ('OK', 'PRICE_MISMATCH', 'QTY_MISMATCH', 'BOTH_MISMATCH')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_invoice_items_inv ON public.vendor_invoice_items(vendor_invoice_id);

-- -----------------------------------------------------------------------------
-- 3. TABLE: landed_cost_vouchers
-- Supplemental inbound freight, customs, duty, insurance, and handling charges
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.landed_cost_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_number TEXT UNIQUE NOT NULL, -- e.g. LCV-20261017-0001
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
    purchase_receipt_id UUID NULL REFERENCES public.purchase_receipts(id) ON DELETE SET NULL,
    service_provider_vendor_id UUID NULL REFERENCES public.vendors(id) ON DELETE SET NULL,
    cost_category TEXT NOT NULL CHECK (cost_category IN ('FREIGHT', 'CUSTOMS_DUTY', 'PORT_HANDLING', 'TRANSIT_INSURANCE', 'CLEARING_AGENT', 'OTHER')),
    reference_bill_number TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_cost NUMERIC(14, 2) NOT NULL CHECK (total_cost > 0),
    allocation_method TEXT NOT NULL DEFAULT 'VALUE_BASED' CHECK (allocation_method IN ('VALUE_BASED', 'QUANTITY_BASED')),
    allocation_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (allocation_status IN ('DRAFT', 'ALLOCATED', 'CANCELLED')),
    allocated_units_count INT NOT NULL DEFAULT 0,
    allocated_at TIMESTAMPTZ NULL,
    allocated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landed_vouchers_po ON public.landed_cost_vouchers(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_landed_vouchers_status ON public.landed_cost_vouchers(allocation_status);

-- -----------------------------------------------------------------------------
-- 4. TABLE: landed_cost_unit_allocations
-- Itemized allocation log tracking economic cost increase per serialized unit
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.landed_cost_unit_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id UUID NOT NULL REFERENCES public.landed_cost_vouchers(id) ON DELETE CASCADE,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    cost_category TEXT NOT NULL,
    allocated_amount NUMERIC(12, 2) NOT NULL CHECK (allocated_amount >= 0),
    prior_purchase_cost NUMERIC(12, 2) NOT NULL CHECK (prior_purchase_cost >= 0),
    new_purchase_cost NUMERIC(12, 2) NOT NULL CHECK (new_purchase_cost >= 0),
    allocation_basis_pct NUMERIC(8, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_lcv_unit_allocation UNIQUE (voucher_id, product_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_lcv_unit_allocations_unit ON public.landed_cost_unit_allocations(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_lcv_unit_allocations_voucher ON public.landed_cost_unit_allocations(voucher_id);

-- -----------------------------------------------------------------------------
-- 5. TABLE: vendor_ap_ledger
-- Open Accounts Payable liabilities for approved vendor invoices
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_ap_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_invoice_id UUID UNIQUE NOT NULL REFERENCES public.vendor_invoices(id) ON DELETE RESTRICT,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    original_amount NUMERIC(14, 2) NOT NULL CHECK (original_amount >= 0),
    debit_offset_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (debit_offset_amount >= 0),
    paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    outstanding_balance NUMERIC(14, 2) NOT NULL CHECK (outstanding_balance >= 0),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'DISPUTED')),
    payment_terms TEXT NOT NULL DEFAULT 'NET_30',
    posted_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_ap_balance_integrity CHECK (outstanding_balance = round(original_amount - debit_offset_amount - paid_amount, 2))
);

CREATE INDEX IF NOT EXISTS idx_vendor_ap_ledger_vendor ON public.vendor_ap_ledger(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_ap_ledger_due ON public.vendor_ap_ledger(due_date);
CREATE INDEX IF NOT EXISTS idx_vendor_ap_ledger_status ON public.vendor_ap_ledger(status);

-- -----------------------------------------------------------------------------
-- 6. TABLE: vendor_ap_transactions
-- Granular ledger payments, debit memo offsets, and settlement history
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_ap_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ap_ledger_id UUID NOT NULL REFERENCES public.vendor_ap_ledger(id) ON DELETE RESTRICT,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('DEBIT_MEMO_OFFSET', 'PAYMENT', 'ADJUSTMENT')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    reference_type TEXT NOT NULL CHECK (reference_type IN ('VENDOR_DEBIT_MEMO', 'BANK_TRANSFER', 'CHEQUE', 'NEFT_RTGS', 'MANUAL_CREDIT')),
    reference_id TEXT NOT NULL, -- e.g. Debit Memo Number or Bank UTR #
    notes TEXT NULL,
    processed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ap_tx_ledger ON public.vendor_ap_transactions(ap_ledger_id);
CREATE INDEX IF NOT EXISTS idx_ap_tx_vendor ON public.vendor_ap_transactions(vendor_id);

-- -----------------------------------------------------------------------------
-- 7. TABLE: vendor_debit_memo_applications
-- Tracking exact offsets of Phase 7.2 vendor_debit_memos against vendor AP
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_debit_memo_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debit_memo_id UUID NOT NULL REFERENCES public.vendor_debit_memos(id) ON DELETE RESTRICT,
    ap_ledger_id UUID NOT NULL REFERENCES public.vendor_ap_ledger(id) ON DELETE RESTRICT,
    applied_amount NUMERIC(14, 2) NOT NULL CHECK (applied_amount > 0),
    applied_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_app_memo ON public.vendor_debit_memo_applications(debit_memo_id);
CREATE INDEX IF NOT EXISTS idx_dm_app_ledger ON public.vendor_debit_memo_applications(ap_ledger_id);

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.vendor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landed_cost_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landed_cost_unit_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_ap_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_ap_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_debit_memo_applications ENABLE ROW LEVEL SECURITY;

-- Block public & anonymous access completely
REVOKE ALL ON TABLE public.vendor_invoices FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.vendor_invoice_items FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.landed_cost_vouchers FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.landed_cost_unit_allocations FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.vendor_ap_ledger FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.vendor_ap_transactions FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.vendor_debit_memo_applications FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vendor_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vendor_invoice_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.landed_cost_vouchers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.landed_cost_unit_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vendor_ap_ledger TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vendor_ap_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vendor_debit_memo_applications TO authenticated;

-- RLS Policies: Finance, Inventory & Super Admin
CREATE POLICY "Finance & Inventory view vendor invoices"
    ON public.vendor_invoices FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Finance & Inventory manage vendor invoices"
    ON public.vendor_invoices FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Finance & Inventory view invoice items"
    ON public.vendor_invoice_items FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Finance & Inventory manage invoice items"
    ON public.vendor_invoice_items FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Finance & Inventory view landed cost vouchers"
    ON public.landed_cost_vouchers FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Finance & Inventory manage landed cost vouchers"
    ON public.landed_cost_vouchers FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Finance & Inventory view unit allocations"
    ON public.landed_cost_unit_allocations FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Finance & Inventory manage unit allocations"
    ON public.landed_cost_unit_allocations FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Finance view vendor AP ledger"
    ON public.vendor_ap_ledger FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Finance manage vendor AP ledger"
    ON public.vendor_ap_ledger FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Finance view AP transactions"
    ON public.vendor_ap_transactions FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Finance manage AP transactions"
    ON public.vendor_ap_transactions FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Finance view debit memo applications"
    ON public.vendor_debit_memo_applications FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

CREATE POLICY "Finance manage debit memo applications"
    ON public.vendor_debit_memo_applications FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory'));

-- -----------------------------------------------------------------------------
-- 9. RPC: fn_evaluate_three_way_match
-- Evaluates PO vs GRN vs Vendor Invoice with +-0.5% variance tolerance
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_evaluate_three_way_match(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inv RECORD;
    v_po RECORD;
    v_grn_accepted_qty INT := 0;
    v_po_total NUMERIC(14, 2) := 0;
    v_po_item_count INT := 0;
    v_price_var_pct NUMERIC(6, 2) := 0.00;
    v_price_var_amount NUMERIC(14, 2) := 0.00;
    v_qty_var INT := 0;
    v_match_status TEXT;
    v_var_reason TEXT := NULL;
    v_item RECORD;
    v_has_price_mismatch BOOLEAN := false;
    v_has_qty_mismatch BOOLEAN := false;
    v_due_days INT := 30;
    v_calculated_due_date DATE;
BEGIN
    SELECT * INTO v_inv FROM public.vendor_invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Vendor invoice not found');
    END IF;

    SELECT * INTO v_po FROM public.purchase_orders WHERE id = v_inv.purchase_order_id;
    IF NOT FOUND THEN
        UPDATE public.vendor_invoices 
        SET match_status = 'MISSING_PO', status = 'DISPUTED'
        WHERE id = p_invoice_id;
        RETURN jsonb_build_object('success', false, 'error', 'Purchase order reference missing');
    END IF;

    -- Aggregate total accepted quantity from GRN if linked
    IF v_inv.purchase_receipt_id IS NOT NULL THEN
        SELECT COALESCE(SUM(accepted_quantity), 0) INTO v_grn_accepted_qty
        FROM public.purchase_receipt_items
        WHERE purchase_receipt_id = v_inv.purchase_receipt_id;
    ELSE
        -- Fall back to all receipts for this PO
        SELECT COALESCE(SUM(pri.accepted_quantity), 0) INTO v_grn_accepted_qty
        FROM public.purchase_receipt_items pri
        JOIN public.purchase_receipts pr ON pri.purchase_receipt_id = pr.id
        WHERE pr.purchase_order_id = v_inv.purchase_order_id AND pr.status = 'completed';
    END IF;

    IF v_grn_accepted_qty = 0 THEN
        UPDATE public.vendor_invoices 
        SET match_status = 'MISSING_GRN'
        WHERE id = p_invoice_id;
        RETURN jsonb_build_object(
            'success', true, 
            'match_status', 'MISSING_GRN', 
            'message', 'No accepted goods receipt found for purchase order'
        );
    END IF;

    -- Evaluate each line item against PO item
    FOR v_item IN 
        SELECT vii.id, vii.invoiced_quantity, vii.unit_price, poi.ordered_quantity, poi.unit_cost,
               COALESCE((
                   SELECT SUM(pri.accepted_quantity)
                   FROM public.purchase_receipt_items pri
                   WHERE pri.purchase_order_item_id = poi.id
               ), 0) as line_grn_qty
        FROM public.vendor_invoice_items vii
        JOIN public.purchase_order_items poi ON vii.purchase_order_item_id = poi.id
        WHERE vii.vendor_invoice_id = p_invoice_id
    LOOP
        v_qty_var := v_qty_var + (v_item.invoiced_quantity - v_item.line_grn_qty);
        v_price_var_amount := v_price_var_amount + ((v_item.unit_price - v_item.unit_cost) * v_item.invoiced_quantity);
        
        IF v_item.unit_price <> v_item.unit_cost THEN
            v_has_price_mismatch := true;
        END IF;
        IF v_item.invoiced_quantity <> v_item.line_grn_qty THEN
            v_has_qty_mismatch := true;
        END IF;

        UPDATE public.vendor_invoice_items
        SET po_unit_price = v_item.unit_cost,
            grn_received_qty = v_item.line_grn_qty,
            variance_flag = CASE 
                WHEN v_item.unit_price <> v_item.unit_cost AND v_item.invoiced_quantity <> v_item.line_grn_qty THEN 'BOTH_MISMATCH'
                WHEN v_item.unit_price <> v_item.unit_cost THEN 'PRICE_MISMATCH'
                WHEN v_item.invoiced_quantity <> v_item.line_grn_qty THEN 'QTY_MISMATCH'
                ELSE 'OK'
            END
        WHERE id = v_item.id;
    END LOOP;

    -- Calculate price variance percentage relative to PO subtotal
    IF v_po.subtotal > 0 THEN
        v_price_var_pct := ROUND((v_price_var_amount / v_po.subtotal) * 100.0, 2);
    ELSE
        v_price_var_pct := 0.00;
    END IF;

    -- Determine Match Status based on +-0.5% tolerance
    IF v_qty_var = 0 AND ABS(v_price_var_pct) = 0.00 THEN
        v_match_status := 'MATCHED';
    ELSIF v_qty_var = 0 AND ABS(v_price_var_pct) <= 0.50 THEN
        v_match_status := 'MATCHED_WITHIN_TOLERANCE';
        v_var_reason := 'Price variance of ' || v_price_var_pct || '% is within acceptable 0.5% tolerance threshold.';
    ELSIF v_qty_var <> 0 AND ABS(v_price_var_pct) > 0.50 THEN
        v_match_status := 'BOTH_VARIANCE';
        v_var_reason := 'Price variance (' || v_price_var_pct || '%) exceeds 0.5% and Quantity variance (' || v_qty_var || ' units). Requires CFO approval.';
    ELSIF v_qty_var <> 0 THEN
        v_match_status := 'QUANTITY_VARIANCE';
        v_var_reason := 'Quantity variance detected: Invoiced qty differs from GRN accepted by ' || v_qty_var || ' units. Requires CFO approval.';
    ELSE
        v_match_status := 'PRICE_VARIANCE';
        v_var_reason := 'Price variance (' || v_price_var_pct || '%) exceeds 0.5% threshold. Requires CFO approval.';
    END IF;

    -- If match is within tolerance or exact, automatically post to AP ledger
    IF v_match_status IN ('MATCHED', 'MATCHED_WITHIN_TOLERANCE') THEN
        -- Compute contractual due date
        v_due_days := CASE v_inv.payment_terms
            WHEN 'IMMEDIATE' THEN 0
            WHEN 'NET_15' THEN 15
            WHEN 'NET_30' THEN 30
            WHEN 'NET_60' THEN 60
            WHEN 'NET_90' THEN 90
            ELSE 30
        END;
        v_calculated_due_date := v_inv.invoice_date + v_due_days;

        UPDATE public.vendor_invoices
        SET match_status = v_match_status,
            price_variance_pct = v_price_var_pct,
            price_variance_amount = v_price_var_amount,
            qty_variance_units = v_qty_var,
            variance_reason = v_var_reason,
            due_date = v_calculated_due_date,
            status = 'POSTED_TO_AP',
            updated_at = now()
        WHERE id = p_invoice_id;

        -- Upsert into vendor AP ledger
        INSERT INTO public.vendor_ap_ledger (
            vendor_invoice_id, vendor_id, invoice_number, invoice_date, due_date,
            original_amount, debit_offset_amount, paid_amount, outstanding_balance,
            status, payment_terms, posted_by
        ) VALUES (
            p_invoice_id, v_inv.vendor_id, v_inv.invoice_number, v_inv.invoice_date, v_calculated_due_date,
            v_inv.total_amount, 0.00, 0.00, v_inv.total_amount,
            'OPEN', v_inv.payment_terms, auth.uid()
        )
        ON CONFLICT (vendor_invoice_id) DO UPDATE SET
            original_amount = EXCLUDED.original_amount,
            outstanding_balance = round(EXCLUDED.original_amount - vendor_ap_ledger.debit_offset_amount - vendor_ap_ledger.paid_amount, 2),
            due_date = EXCLUDED.due_date,
            status = 'OPEN';
    ELSE
        -- Flag invoice for CFO Approval Gate
        UPDATE public.vendor_invoices
        SET match_status = v_match_status,
            price_variance_pct = v_price_var_pct,
            price_variance_amount = v_price_var_amount,
            qty_variance_units = v_qty_var,
            variance_reason = v_var_reason,
            status = 'UNPOSTED',
            updated_at = now()
        WHERE id = p_invoice_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', p_invoice_id,
        'match_status', v_match_status,
        'price_variance_pct', v_price_var_pct,
        'price_variance_amount', v_price_var_amount,
        'qty_variance_units', v_qty_var,
        'variance_reason', v_var_reason,
        'auto_posted_to_ap', v_match_status IN ('MATCHED', 'MATCHED_WITHIN_TOLERANCE')
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. RPC: fn_adjudicate_invoice_variance_cfo
-- CFO Gate to approve or reject invoices with price or quantity discrepancies
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_adjudicate_invoice_variance_cfo(
    p_invoice_id UUID,
    p_action TEXT, -- 'APPROVE' or 'REJECT'
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_inv RECORD;
    v_due_days INT := 30;
    v_calculated_due_date DATE;
BEGIN
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permission denied: CFO or Executive Admin required');
    END IF;

    SELECT * INTO v_inv FROM public.vendor_invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Vendor invoice not found');
    END IF;

    IF v_inv.status = 'POSTED_TO_AP' AND v_inv.match_status IN ('APPROVED_EXCEPTION', 'MATCHED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice already approved and posted');
    END IF;

    IF p_action = 'APPROVE' THEN
        v_due_days := CASE v_inv.payment_terms
            WHEN 'IMMEDIATE' THEN 0
            WHEN 'NET_15' THEN 15
            WHEN 'NET_30' THEN 30
            WHEN 'NET_60' THEN 60
            WHEN 'NET_90' THEN 90
            ELSE 30
        END;
        v_calculated_due_date := v_inv.invoice_date + v_due_days;

        UPDATE public.vendor_invoices
        SET match_status = 'APPROVED_EXCEPTION',
            status = 'POSTED_TO_AP',
            approved_by = auth.uid(),
            approved_at = now(),
            cfo_approval_notes = COALESCE(p_notes, 'Approved by CFO/Executive Admin'),
            due_date = v_calculated_due_date,
            updated_at = now()
        WHERE id = p_invoice_id;

        -- Post to AP ledger
        INSERT INTO public.vendor_ap_ledger (
            vendor_invoice_id, vendor_id, invoice_number, invoice_date, due_date,
            original_amount, debit_offset_amount, paid_amount, outstanding_balance,
            status, payment_terms, posted_by
        ) VALUES (
            p_invoice_id, v_inv.vendor_id, v_inv.invoice_number, v_inv.invoice_date, v_calculated_due_date,
            v_inv.total_amount, 0.00, 0.00, v_inv.total_amount,
            'OPEN', v_inv.payment_terms, auth.uid()
        )
        ON CONFLICT (vendor_invoice_id) DO UPDATE SET
            original_amount = EXCLUDED.original_amount,
            outstanding_balance = round(EXCLUDED.original_amount - vendor_ap_ledger.debit_offset_amount - vendor_ap_ledger.paid_amount, 2),
            status = 'OPEN';

        RETURN jsonb_build_object('success', true, 'action', 'APPROVED', 'invoice_id', p_invoice_id);
    ELSIF p_action = 'REJECT' THEN
        UPDATE public.vendor_invoices
        SET match_status = 'REJECTED',
            status = 'DISPUTED',
            approved_by = auth.uid(),
            approved_at = now(),
            cfo_approval_notes = COALESCE(p_notes, 'Rejected by CFO due to unresolvable variance'),
            updated_at = now()
        WHERE id = p_invoice_id;

        RETURN jsonb_build_object('success', true, 'action', 'REJECTED', 'invoice_id', p_invoice_id);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action: must be APPROVE or REJECT');
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. RPC: fn_allocate_landed_costs
-- Apportions freight, customs, duty, and transit insurance into product_units.purchase_cost
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_allocate_landed_costs(p_voucher_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_voucher RECORD;
    v_total_basis NUMERIC(14, 2) := 0;
    v_unit_count INT := 0;
    v_unit RECORD;
    v_allocated_share NUMERIC(12, 2);
    v_new_cost NUMERIC(12, 2);
    v_basis_pct NUMERIC(8, 4);
    v_cumulative_allocated NUMERIC(14, 2) := 0;
BEGIN
    SELECT * INTO v_voucher FROM public.landed_cost_vouchers WHERE id = p_voucher_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Landed cost voucher not found');
    END IF;

    IF v_voucher.allocation_status = 'ALLOCATED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Landed cost voucher already allocated');
    END IF;

    -- Count eligible serialized product units received under this PO
    IF v_voucher.purchase_receipt_id IS NOT NULL THEN
        SELECT COUNT(*), COALESCE(SUM(purchase_cost), 0)
        INTO v_unit_count, v_total_basis
        FROM public.product_units pu
        WHERE pu.purchase_order_id = v_voucher.purchase_order_id
          AND pu.purchase_receipt_id = v_voucher.purchase_receipt_id;
    ELSE
        SELECT COUNT(*), COALESCE(SUM(purchase_cost), 0)
        INTO v_unit_count, v_total_basis
        FROM public.product_units pu
        WHERE pu.purchase_order_id = v_voucher.purchase_order_id;
    END IF;

    IF v_unit_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No serialized units found to absorb landed cost');
    END IF;

    -- Allocate across units
    FOR v_unit IN 
        SELECT pu.id, pu.purchase_cost
        FROM public.product_units pu
        WHERE pu.purchase_order_id = v_voucher.purchase_order_id
          AND (v_voucher.purchase_receipt_id IS NULL OR pu.purchase_receipt_id = v_voucher.purchase_receipt_id)
        ORDER BY pu.id
    LOOP
        IF v_voucher.allocation_method = 'VALUE_BASED' AND v_total_basis > 0 THEN
            v_basis_pct := ROUND((v_unit.purchase_cost / v_total_basis), 4);
            v_allocated_share := ROUND((v_voucher.total_cost * (v_unit.purchase_cost / v_total_basis)), 2);
        ELSE
            -- QUANTITY_BASED uniform split
            v_basis_pct := ROUND((1.0 / v_unit_count), 4);
            v_allocated_share := ROUND((v_voucher.total_cost / v_unit_count), 2);
        END IF;

        v_new_cost := v_unit.purchase_cost + v_allocated_share;
        v_cumulative_allocated := v_cumulative_allocated + v_allocated_share;

        -- Record unit allocation entry
        INSERT INTO public.landed_cost_unit_allocations (
            voucher_id, product_unit_id, cost_category, allocated_amount,
            prior_purchase_cost, new_purchase_cost, allocation_basis_pct
        ) VALUES (
            p_voucher_id, v_unit.id, v_voucher.cost_category, v_allocated_share,
            v_unit.purchase_cost, v_new_cost, v_basis_pct
        );

        -- Atomically update true economic cost in product_units
        UPDATE public.product_units
        SET purchase_cost = v_new_cost,
            updated_at = now()
        WHERE id = v_unit.id;
    END LOOP;

    -- Update voucher status to ALLOCATED
    UPDATE public.landed_cost_vouchers
    SET allocation_status = 'ALLOCATED',
        allocated_units_count = v_unit_count,
        allocated_at = now(),
        allocated_by = auth.uid(),
        updated_at = now()
    WHERE id = p_voucher_id;

    RETURN jsonb_build_object(
        'success', true,
        'voucher_id', p_voucher_id,
        'allocated_units', v_unit_count,
        'total_cost_allocated', v_cumulative_allocated,
        'allocation_method', v_voucher.allocation_method
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 12. RPC: fn_apply_debit_memo_to_ap
-- Applies Phase 7.2 Vendor Debit Memos against open Accounts Payable liability
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_apply_debit_memo_to_ap(
    p_debit_memo_id UUID,
    p_ap_ledger_id UUID,
    p_amount NUMERIC(14, 2) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_memo RECORD;
    v_ap RECORD;
    v_already_applied NUMERIC(14, 2) := 0;
    v_available_debit NUMERIC(14, 2);
    v_apply_amt NUMERIC(14, 2);
    v_new_debit_offset NUMERIC(14, 2);
    v_new_balance NUMERIC(14, 2);
    v_new_status TEXT;
BEGIN
    SELECT * INTO v_memo FROM public.vendor_debit_memos WHERE id = p_debit_memo_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Vendor debit memo not found');
    END IF;

    SELECT * INTO v_ap FROM public.vendor_ap_ledger WHERE id = p_ap_ledger_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'AP ledger entry not found');
    END IF;

    IF v_memo.vendor_id <> v_ap.vendor_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Vendor mismatch: Debit memo and AP invoice belong to different vendors');
    END IF;

    IF v_memo.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot apply a cancelled debit memo');
    END IF;

    -- Calculate remaining available debit from memo
    SELECT COALESCE(SUM(applied_amount), 0) INTO v_already_applied
    FROM public.vendor_debit_memo_applications
    WHERE debit_memo_id = p_debit_memo_id;

    v_available_debit := v_memo.total_debit_amount - v_already_applied;
    IF v_available_debit <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Debit memo fully consumed');
    END IF;

    -- Determine amount to apply
    IF p_amount IS NULL OR p_amount <= 0 THEN
        v_apply_amt := LEAST(v_available_debit, v_ap.outstanding_balance);
    ELSE
        IF p_amount > v_available_debit THEN
            RETURN jsonb_build_object('success', false, 'error', 'Requested amount exceeds available debit memo balance');
        END IF;
        IF p_amount > v_ap.outstanding_balance THEN
            RETURN jsonb_build_object('success', false, 'error', 'Requested amount exceeds AP outstanding balance');
        END IF;
        v_apply_amt := p_amount;
    END IF;

    IF v_apply_amt <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Outstanding balance on invoice is zero');
    END IF;

    -- Insert application record
    INSERT INTO public.vendor_debit_memo_applications (
        debit_memo_id, ap_ledger_id, applied_amount, applied_by
    ) VALUES (
        p_debit_memo_id, p_ap_ledger_id, v_apply_amt, auth.uid()
    );

    -- Log transaction in AP transactions ledger
    INSERT INTO public.vendor_ap_transactions (
        ap_ledger_id, vendor_id, transaction_type, amount, reference_type, reference_id, notes, processed_by
    ) VALUES (
        p_ap_ledger_id, v_ap.vendor_id, 'DEBIT_MEMO_OFFSET', v_apply_amt,
        'VENDOR_DEBIT_MEMO', v_memo.debit_memo_number,
        'Applied vendor debit memo against invoice ' || v_ap.invoice_number, auth.uid()
    );

    -- Update AP ledger balance
    v_new_debit_offset := v_ap.debit_offset_amount + v_apply_amt;
    v_new_balance := round(v_ap.original_amount - v_new_debit_offset - v_ap.paid_amount, 2);
    v_new_status := CASE 
        WHEN v_new_balance <= 0 THEN 'SETTLED'
        ELSE 'PARTIALLY_SETTLED'
    END;

    UPDATE public.vendor_ap_ledger
    SET debit_offset_amount = v_new_debit_offset,
        outstanding_balance = v_new_balance,
        status = v_new_status,
        settled_at = CASE WHEN v_new_balance <= 0 THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = p_ap_ledger_id;

    -- If debit memo is now 100% utilized, update debit memo status to settled
    IF (v_available_debit - v_apply_amt) <= 0 THEN
        UPDATE public.vendor_debit_memos
        SET status = 'settled',
            settled_at = now(),
            updated_at = now()
        WHERE id = p_debit_memo_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'applied_amount', v_apply_amt,
        'remaining_debit_memo_balance', v_available_debit - v_apply_amt,
        'new_ap_outstanding_balance', v_new_balance,
        'ap_status', v_new_status
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 13. RPC: fn_record_vendor_ap_payment
-- Logs bank / RTGS / cheque payments against AP ledger and settles outstanding
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_record_vendor_ap_payment(
    p_ap_ledger_id UUID,
    p_payment_amount NUMERIC(14, 2),
    p_payment_method TEXT, -- 'NEFT_RTGS', 'BANK_TRANSFER', 'CHEQUE'
    p_reference_id TEXT, -- Bank UTR / Cheque #
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ap RECORD;
    v_new_paid NUMERIC(14, 2);
    v_new_balance NUMERIC(14, 2);
    v_new_status TEXT;
BEGIN
    SELECT * INTO v_ap FROM public.vendor_ap_ledger WHERE id = p_ap_ledger_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'AP ledger entry not found');
    END IF;

    IF p_payment_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment amount must be greater than zero');
    END IF;

    IF p_payment_amount > v_ap.outstanding_balance THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment amount exceeds outstanding balance of ₹' || v_ap.outstanding_balance);
    END IF;

    -- Record transaction
    INSERT INTO public.vendor_ap_transactions (
        ap_ledger_id, vendor_id, transaction_type, amount, reference_type, reference_id, notes, processed_by
    ) VALUES (
        p_ap_ledger_id, v_ap.vendor_id, 'PAYMENT', p_payment_amount,
        p_payment_method, p_reference_id, p_notes, auth.uid()
    );

    v_new_paid := v_ap.paid_amount + p_payment_amount;
    v_new_balance := round(v_ap.original_amount - v_ap.debit_offset_amount - v_new_paid, 2);
    v_new_status := CASE 
        WHEN v_new_balance <= 0 THEN 'SETTLED'
        ELSE 'PARTIALLY_SETTLED'
    END;

    UPDATE public.vendor_ap_ledger
    SET paid_amount = v_new_paid,
        outstanding_balance = v_new_balance,
        status = v_new_status,
        settled_at = CASE WHEN v_new_balance <= 0 THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = p_ap_ledger_id;

    -- Update linked invoice status
    UPDATE public.vendor_invoices
    SET status = CASE WHEN v_new_balance <= 0 THEN 'PAID' ELSE 'PARTIALLY_PAID' END,
        updated_at = now()
    WHERE id = v_ap.vendor_invoice_id;

    RETURN jsonb_build_object(
        'success', true,
        'paid_amount', p_payment_amount,
        'new_outstanding_balance', v_new_balance,
        'ap_status', v_new_status
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 14. RPC: fn_get_vendor_ap_aging_summary
-- Generates contractual AP Aging schedule (0-30, 31-60, 61-90, 90+ days past due)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_vendor_ap_aging_summary()
RETURNS TABLE (
    vendor_id UUID,
    vendor_code TEXT,
    vendor_name TEXT,
    total_payable NUMERIC,
    current_payable NUMERIC,
    days_1_30 NUMERIC,
    days_31_60 NUMERIC,
    days_61_90 NUMERIC,
    days_90_plus NUMERIC,
    oldest_overdue_days INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        v.id AS vendor_id,
        v.vendor_code,
        v.display_name AS vendor_name,
        COALESCE(SUM(ap.outstanding_balance), 0) AS total_payable,
        COALESCE(SUM(CASE WHEN ap.due_date >= CURRENT_DATE THEN ap.outstanding_balance ELSE 0 END), 0) AS current_payable,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - ap.due_date BETWEEN 1 AND 30 THEN ap.outstanding_balance ELSE 0 END), 0) AS days_1_30,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - ap.due_date BETWEEN 31 AND 60 THEN ap.outstanding_balance ELSE 0 END), 0) AS days_31_60,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - ap.due_date BETWEEN 61 AND 90 THEN ap.outstanding_balance ELSE 0 END), 0) AS days_61_90,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - ap.due_date > 90 THEN ap.outstanding_balance ELSE 0 END), 0) AS days_90_plus,
        COALESCE(MAX(CASE WHEN ap.due_date < CURRENT_DATE THEN (CURRENT_DATE - ap.due_date) ELSE 0 END), 0) AS oldest_overdue_days
    FROM public.vendors v
    LEFT JOIN public.vendor_ap_ledger ap ON v.id = ap.vendor_id AND ap.status IN ('OPEN', 'PARTIALLY_SETTLED')
    GROUP BY v.id, v.vendor_code, v.display_name
    HAVING COALESCE(SUM(ap.outstanding_balance), 0) > 0
    ORDER BY total_payable DESC;
$$;
