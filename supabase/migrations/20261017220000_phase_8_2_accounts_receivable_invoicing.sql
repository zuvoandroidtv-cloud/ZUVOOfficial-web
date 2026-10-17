-- ============================================================================
-- PHASE 8.2 — ENTERPRISE ACCOUNTS RECEIVABLE (AR) LEDGER,
-- AUTOMATED GST E-INVOICING & B2B/B2C CASH RECONCILIATION ENGINE
-- ZUVO TV CRM Unified Architecture
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLE: customer_ar_ledger
-- Authoritative Accounts Receivable ledger tracking commercial customer & dealer receivables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_ar_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NULL REFERENCES public.customers(id) ON DELETE SET NULL,
    dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE SET NULL,
    sale_id UUID NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
    tax_invoice_id UUID NULL, -- Forward-referenced; constraint added below
    invoice_number TEXT NOT NULL,
    billed_amount NUMERIC(14, 2) NOT NULL CHECK (billed_amount >= 0),
    settled_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (settled_amount >= 0),
    remaining_balance NUMERIC(14, 2) NOT NULL CHECK (remaining_balance >= 0),
    due_date DATE NOT NULL,
    credit_terms_days INT NOT NULL DEFAULT 30 CHECK (credit_terms_days >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'DISPUTED', 'WRITTEN_OFF')),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_customer_ar_balance_integrity CHECK (remaining_balance = round(billed_amount - settled_amount, 2)),
    CONSTRAINT chk_customer_ar_settled_le_billed CHECK (settled_amount <= billed_amount)
);

CREATE INDEX IF NOT EXISTS idx_customer_ar_ledger_customer ON public.customer_ar_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_ar_ledger_dealer ON public.customer_ar_ledger(dealer_id);
CREATE INDEX IF NOT EXISTS idx_customer_ar_ledger_sale ON public.customer_ar_ledger(sale_id);
CREATE INDEX IF NOT EXISTS idx_customer_ar_ledger_due ON public.customer_ar_ledger(due_date);
CREATE INDEX IF NOT EXISTS idx_customer_ar_ledger_status ON public.customer_ar_ledger(status);

-- -----------------------------------------------------------------------------
-- 2. TABLE: customer_ar_transactions
-- Immutable financial audit history of AR debits, credits, and offsets
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_ar_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ar_ledger_id UUID NOT NULL REFERENCES public.customer_ar_ledger(id) ON DELETE RESTRICT,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('INVOICE_BILLED', 'PAYMENT_APPLIED', 'CREDIT_MEMO_OFFSET', 'BAD_DEBT_WRITE_OFF')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    transaction_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    reference_id TEXT NOT NULL, -- e.g. Tax Invoice #, Payment ID, Credit Memo #
    actor UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT NULL,
    idempotency_key UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT customer_ar_tx_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_customer_ar_tx_ledger ON public.customer_ar_transactions(ar_ledger_id);
CREATE INDEX IF NOT EXISTS idx_customer_ar_tx_type ON public.customer_ar_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_customer_ar_tx_ref ON public.customer_ar_transactions(reference_id);

-- -----------------------------------------------------------------------------
-- 3. TABLE: commercial_tax_invoices
-- Authoritative Commercial GST Tax Invoices (HSN 8528, CGST/SGST vs IGST)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_tax_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
    customer_id UUID NULL REFERENCES public.customers(id) ON DELETE SET NULL,
    dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    invoice_type TEXT NOT NULL DEFAULT 'B2C' CHECK (invoice_type IN ('B2B', 'B2C')),
    place_of_supply TEXT NOT NULL,
    seller_gstin TEXT NOT NULL DEFAULT '27AAACZ8901D1Z5', -- Maharashtra
    buyer_gstin TEXT NULL,
    hsn_sac TEXT NOT NULL DEFAULT '8528', -- Television sets & monitors
    taxable_value NUMERIC(14, 2) NOT NULL CHECK (taxable_value >= 0),
    tax_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 18.00 CHECK (tax_rate_pct >= 0),
    is_inter_state BOOLEAN NOT NULL DEFAULT false,
    cgst_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (cgst_amount >= 0),
    sgst_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (sgst_amount >= 0),
    igst_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (igst_amount >= 0),
    total_tax NUMERIC(14, 2) NOT NULL CHECK (total_tax >= 0),
    grand_total NUMERIC(14, 2) NOT NULL CHECK (grand_total >= 0),
    irn TEXT NULL,
    e_invoice_hash TEXT NULL,
    acknowledgement_number TEXT NULL,
    acknowledgement_date TIMESTAMPTZ NULL,
    e_invoice_status TEXT NOT NULL DEFAULT 'PENDING_PROVIDER' CHECK (e_invoice_status IN ('PENDING_PROVIDER', 'PROVIDER_SUBMITTED', 'IRN_GENERATED', 'FAILED')),
    invoice_status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (invoice_status IN ('DRAFT', 'ISSUED', 'CANCELLED')),
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_tax_split_integrity CHECK (
        (is_inter_state = true AND cgst_amount = 0 AND sgst_amount = 0 AND igst_amount = total_tax) OR
        (is_inter_state = false AND igst_amount = 0 AND round(cgst_amount + sgst_amount, 2) = total_tax)
    )
);

CREATE INDEX IF NOT EXISTS idx_commercial_tax_invoices_sale ON public.commercial_tax_invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_commercial_tax_invoices_customer ON public.commercial_tax_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_commercial_tax_invoices_dealer ON public.commercial_tax_invoices(dealer_id);
CREATE INDEX IF NOT EXISTS idx_commercial_tax_invoices_e_status ON public.commercial_tax_invoices(e_invoice_status);

-- Add foreign key constraint back to customer_ar_ledger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_customer_ar_tax_invoice' AND table_name = 'customer_ar_ledger'
    ) THEN
        ALTER TABLE public.customer_ar_ledger
            ADD CONSTRAINT fk_customer_ar_tax_invoice 
            FOREIGN KEY (tax_invoice_id) REFERENCES public.commercial_tax_invoices(id) ON DELETE SET NULL;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. TABLE: payment_receipts_unallocated
-- Staging and matching incoming NEFT/RTGS/UPI/Bank Transfer receipts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_receipts_unallocated (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_reference TEXT NOT NULL UNIQUE,
    external_transaction_ref TEXT NOT NULL, -- UTR / UPI Ref / Bank IMPS ID
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('UPI', 'NEFT', 'RTGS', 'IMPS', 'BANK_TRANSFER', 'CHEQUE', 'CARD')),
    payer_name TEXT NOT NULL,
    payer_account_ref TEXT NULL,
    matched_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (matched_amount >= 0),
    remaining_amount NUMERIC(14, 2) NOT NULL CHECK (remaining_amount >= 0),
    status TEXT NOT NULL DEFAULT 'UNALLOCATED' CHECK (status IN ('UNALLOCATED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED', 'REJECTED')),
    notes TEXT NULL,
    idempotency_key UUID NULL,
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_receipt_balance_integrity CHECK (remaining_amount = round(amount - matched_amount, 2)),
    CONSTRAINT chk_receipt_matched_le_total CHECK (matched_amount <= amount),
    CONSTRAINT payment_receipts_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_status ON public.payment_receipts_unallocated(status);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_date ON public.payment_receipts_unallocated(received_date);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_ext_ref ON public.payment_receipts_unallocated(external_transaction_ref);

-- -----------------------------------------------------------------------------
-- 5. TABLE: ar_dunning_cases
-- Automated collection escalation, dunning notices & service suspension reviews
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ar_dunning_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ar_ledger_id UUID NOT NULL REFERENCES public.customer_ar_ledger(id) ON DELETE CASCADE,
    customer_id UUID NULL REFERENCES public.customers(id) ON DELETE SET NULL,
    dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    days_overdue INT NOT NULL CHECK (days_overdue >= 0),
    overdue_amount NUMERIC(14, 2) NOT NULL CHECK (overdue_amount >= 0),
    tier TEXT NOT NULL CHECK (tier IN ('TIER_1', 'TIER_2', 'TIER_3')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CONTACTED', 'PROMISED', 'ESCALATED', 'RESOLVED', 'SUSPENDED')),
    notice_count INT NOT NULL DEFAULT 1 CHECK (notice_count >= 1),
    last_notice_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    service_suspension_flag BOOLEAN NOT NULL DEFAULT false,
    suspension_reason TEXT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ar_dunning_cases_ledger_unique UNIQUE (ar_ledger_id)
);

CREATE INDEX IF NOT EXISTS idx_ar_dunning_cases_tier ON public.ar_dunning_cases(tier);
CREATE INDEX IF NOT EXISTS idx_ar_dunning_cases_status ON public.ar_dunning_cases(status);

-- -----------------------------------------------------------------------------
-- 6. CONCURRENCY-SAFE INVOICE NUMBER SEQUENCE / GENERATOR
-- INV-YYYYMM-XXXX format
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.seq_commercial_tax_invoice_number START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_unallocated_receipt_number START WITH 1 INCREMENT BY 1;

-- -----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.customer_ar_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_ar_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_tax_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts_unallocated ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_dunning_cases ENABLE ROW LEVEL SECURITY;

-- Block public & anonymous access completely
REVOKE ALL ON TABLE public.customer_ar_ledger FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.customer_ar_transactions FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.commercial_tax_invoices FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.payment_receipts_unallocated FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ar_dunning_cases FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_ar_ledger TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_ar_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.commercial_tax_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_receipts_unallocated TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ar_dunning_cases TO authenticated;

-- Policies: Super Admin, Admin, and Finance have full access to AR ledger
CREATE POLICY "Finance & Admin view customer AR ledger"
    ON public.customer_ar_ledger FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'finance', 'sales') OR
        (public.get_current_user_role() = 'dealer' AND dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid()))
    );

CREATE POLICY "Finance & Admin manage customer AR ledger"
    ON public.customer_ar_ledger FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'finance'));

-- Policies: AR Transactions (Append-Only / Immutable)
CREATE POLICY "Finance & Admin view AR transactions"
    ON public.customer_ar_transactions FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'finance'));

CREATE POLICY "Finance & Admin insert AR transactions"
    ON public.customer_ar_transactions FOR INSERT
    TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'finance'));

-- Policies: Commercial Tax Invoices
CREATE POLICY "Authorized view commercial tax invoices"
    ON public.commercial_tax_invoices FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() IN ('super_admin', 'admin', 'finance', 'sales') OR
        (public.get_current_user_role() = 'dealer' AND dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid()))
    );

CREATE POLICY "Finance & Admin manage commercial tax invoices"
    ON public.commercial_tax_invoices FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'finance'));

-- Policies: Payment Receipts Unallocated
CREATE POLICY "Finance & Admin view and manage unallocated receipts"
    ON public.payment_receipts_unallocated FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'finance'));

-- Policies: AR Dunning Cases
CREATE POLICY "Finance & Admin manage dunning cases"
    ON public.ar_dunning_cases FOR ALL
    TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'finance'));

-- -----------------------------------------------------------------------------
-- 8. RPC: fn_generate_commercial_tax_invoice
-- Generates concurrency-safe GST invoice (HSN 8528), posts to AR ledger & writes INVOICE_BILLED tx
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_generate_commercial_tax_invoice(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_sale RECORD;
    v_customer RECORD;
    v_dealer RECORD;
    v_existing_inv RECORD;
    v_is_b2b BOOLEAN := false;
    v_buyer_gstin TEXT := NULL;
    v_place_of_supply TEXT := 'Maharashtra';
    v_is_inter_state BOOLEAN := false;
    v_taxable_val NUMERIC(14, 2);
    v_cgst NUMERIC(14, 2) := 0.00;
    v_sgst NUMERIC(14, 2) := 0.00;
    v_igst NUMERIC(14, 2) := 0.00;
    v_total_tax NUMERIC(14, 2) := 0.00;
    v_grand_total NUMERIC(14, 2) := 0.00;
    v_seq_num BIGINT;
    v_inv_number TEXT;
    v_tax_invoice_id UUID;
    v_ar_ledger_id UUID;
BEGIN
    -- 1. Authorization check
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'finance', 'sales') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Finance or Admin can generate tax invoices');
    END IF;

    -- 2. Validate Sale
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sale record not found');
    END IF;

    -- 3. Idempotency Check: Existing invoice?
    SELECT * INTO v_existing_inv FROM public.commercial_tax_invoices WHERE sale_id = p_sale_id;
    IF FOUND THEN
        SELECT id INTO v_ar_ledger_id FROM public.customer_ar_ledger WHERE tax_invoice_id = v_existing_inv.id;
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'invoice_id', v_existing_inv.id,
            'invoice_number', v_existing_inv.invoice_number,
            'ar_ledger_id', v_ar_ledger_id,
            'grand_total', v_existing_inv.grand_total,
            'taxable_value', v_existing_inv.taxable_value,
            'total_tax', v_existing_inv.total_tax,
            'is_inter_state', v_existing_inv.is_inter_state,
            'e_invoice_status', v_existing_inv.e_invoice_status
        );
    END IF;

    -- 4. Identity & B2B vs B2C determination
    IF v_sale.dealer_id IS NOT NULL THEN
        v_is_b2b := true;
        SELECT * INTO v_dealer FROM public.dealers WHERE id = v_sale.dealer_id;
        IF FOUND THEN
            v_buyer_gstin := v_dealer.gst_number;
            IF v_dealer.state IS NOT NULL AND TRIM(v_dealer.state) != '' THEN
                v_place_of_supply := v_dealer.state;
            END IF;
        END IF;
    ELSIF v_sale.customer_id IS NOT NULL THEN
        SELECT * INTO v_customer FROM public.customers WHERE id = v_sale.customer_id;
        IF FOUND THEN
            IF v_customer.state IS NOT NULL AND TRIM(v_customer.state) != '' THEN
                v_place_of_supply := v_customer.state;
            END IF;
        END IF;
    END IF;

    -- 5. Taxation Determination: Intra-state (MH) vs Inter-state
    -- Seller is registered in Maharashtra (GSTIN starts with 27)
    IF LOWER(TRIM(v_place_of_supply)) = 'maharashtra' OR LOWER(TRIM(v_place_of_supply)) = 'mh' THEN
        v_is_inter_state := false;
    ELSE
        v_is_inter_state := true;
    END IF;

    -- 6. Server-Side Tax Calculations (HSN 8528 - 18% standard rate)
    v_taxable_val := round(COALESCE(v_sale.subtotal, v_sale.total_amount) - COALESCE(v_sale.discount_amount, 0), 2);
    IF v_taxable_val < 0 THEN
        v_taxable_val := 0;
    END IF;

    IF v_is_inter_state THEN
        v_igst := round(v_taxable_val * 0.18, 2);
        v_cgst := 0.00;
        v_sgst := 0.00;
        v_total_tax := v_igst;
    ELSE
        v_cgst := round(v_taxable_val * 0.09, 2);
        v_sgst := round(v_taxable_val * 0.09, 2);
        v_igst := 0.00;
        v_total_tax := round(v_cgst + v_sgst, 2);
    END IF;
    v_grand_total := round(v_taxable_val + v_total_tax, 2);

    -- 7. Sequential concurrency-safe invoice numbering: INV-YYYYMM-XXXX
    v_seq_num := nextval('public.seq_commercial_tax_invoice_number');
    v_inv_number := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(v_seq_num::TEXT, 4, '0');

    -- 8. Insert Commercial Tax Invoice
    INSERT INTO public.commercial_tax_invoices (
        sale_id,
        customer_id,
        dealer_id,
        invoice_number,
        invoice_date,
        invoice_type,
        place_of_supply,
        seller_gstin,
        buyer_gstin,
        hsn_sac,
        taxable_value,
        tax_rate_pct,
        is_inter_state,
        cgst_rate_pct,
        cgst_amount,
        sgst_rate_pct,
        sgst_amount,
        igst_rate_pct,
        igst_amount,
        total_tax,
        grand_total,
        e_invoice_status,
        invoice_status,
        created_by
    ) VALUES (
        p_sale_id,
        v_sale.customer_id,
        v_sale.dealer_id,
        v_inv_number,
        CURRENT_DATE,
        CASE WHEN v_is_b2b THEN 'B2B' ELSE 'B2C' END,
        v_place_of_supply,
        '27AAACZ8901D1Z5',
        v_buyer_gstin,
        '8528',
        v_taxable_val,
        18.00,
        v_is_inter_state,
        CASE WHEN v_is_inter_state THEN 0.00 ELSE 9.00 END,
        v_cgst,
        CASE WHEN v_is_inter_state THEN 0.00 ELSE 9.00 END,
        v_sgst,
        CASE WHEN v_is_inter_state THEN 18.00 ELSE 0.00 END,
        v_igst,
        v_total_tax,
        v_grand_total,
        'PENDING_PROVIDER',
        'ISSUED',
        auth.uid()
    ) RETURNING id INTO v_tax_invoice_id;

    -- 9. Create Authoritative Customer AR Ledger Entry
    INSERT INTO public.customer_ar_ledger (
        customer_id,
        dealer_id,
        sale_id,
        tax_invoice_id,
        invoice_number,
        billed_amount,
        settled_amount,
        remaining_balance,
        due_date,
        credit_terms_days,
        currency,
        status,
        notes
    ) VALUES (
        v_sale.customer_id,
        v_sale.dealer_id,
        p_sale_id,
        v_tax_invoice_id,
        v_inv_number,
        v_grand_total,
        0.00,
        v_grand_total,
        CURRENT_DATE + INTERVAL '30 days',
        30,
        'INR',
        'OPEN',
        'Automated initial AR posting from commercial tax invoice'
    ) RETURNING id INTO v_ar_ledger_id;

    -- 10. Record Immutable AR Transaction: INVOICE_BILLED
    INSERT INTO public.customer_ar_transactions (
        ar_ledger_id,
        transaction_type,
        amount,
        reference_id,
        actor,
        notes
    ) VALUES (
        v_ar_ledger_id,
        'INVOICE_BILLED',
        v_grand_total,
        v_inv_number,
        auth.uid(),
        'Authoritative commercial GST tax invoice posted to AR ledger'
    );

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'invoice_id', v_tax_invoice_id,
        'invoice_number', v_inv_number,
        'ar_ledger_id', v_ar_ledger_id,
        'grand_total', v_grand_total,
        'taxable_value', v_taxable_val,
        'cgst', v_cgst,
        'sgst', v_sgst,
        'igst', v_igst,
        'total_tax', v_total_tax,
        'is_inter_state', v_is_inter_state,
        'e_invoice_status', 'PENDING_PROVIDER'
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. RPC: fn_apply_payment_to_ar_invoice
-- Atomically applies payment/unallocated receipt to open AR invoice
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_apply_payment_to_ar_invoice(
    p_ar_ledger_id UUID,
    p_payment_id UUID,
    p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_ar RECORD;
    v_receipt RECORD;
    v_new_settled NUMERIC(14, 2);
    v_new_remaining NUMERIC(14, 2);
    v_new_status TEXT;
    v_new_matched NUMERIC(14, 2);
    v_new_receipt_rem NUMERIC(14, 2);
    v_new_receipt_status TEXT;
BEGIN
    -- 1. Authenticate and authorize
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'finance') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Finance or Admin can allocate payments to AR');
    END IF;

    -- 2. Validate positive amount
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Allocation amount must be strictly greater than zero');
    END IF;

    -- 3. Lock AR and Receipt rows
    SELECT * INTO v_ar FROM public.customer_ar_ledger WHERE id = p_ar_ledger_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'AR ledger entry not found');
    END IF;

    SELECT * INTO v_receipt FROM public.payment_receipts_unallocated WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unallocated payment receipt not found');
    END IF;

    -- 4. Check eligibility & balances
    IF v_ar.status IN ('SETTLED', 'WRITTEN_OFF') THEN
        RETURN jsonb_build_object('success', false, 'error', 'AR invoice is already settled or written off');
    END IF;

    IF v_receipt.remaining_amount < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment receipt has insufficient remaining balance');
    END IF;

    IF v_ar.remaining_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment amount exceeds invoice remaining balance');
    END IF;

    -- 5. Calculate new balances
    v_new_settled := round(v_ar.settled_amount + p_amount, 2);
    v_new_remaining := round(v_ar.billed_amount - v_new_settled, 2);
    v_new_status := CASE 
        WHEN v_new_remaining <= 0 THEN 'SETTLED'
        ELSE 'PARTIALLY_SETTLED'
    END;

    v_new_matched := round(v_receipt.matched_amount + p_amount, 2);
    v_new_receipt_rem := round(v_receipt.amount - v_new_matched, 2);
    v_new_receipt_status := CASE
        WHEN v_new_receipt_rem <= 0 THEN 'FULLY_ALLOCATED'
        ELSE 'PARTIALLY_ALLOCATED'
    END;

    -- 6. Update AR Ledger
    UPDATE public.customer_ar_ledger
    SET settled_amount = v_new_settled,
        remaining_balance = v_new_remaining,
        status = v_new_status,
        updated_at = now()
    WHERE id = p_ar_ledger_id;

    -- 7. Update Unallocated Payment Receipt
    UPDATE public.payment_receipts_unallocated
    SET matched_amount = v_new_matched,
        remaining_amount = v_new_receipt_rem,
        status = v_new_receipt_status,
        updated_at = now()
    WHERE id = p_payment_id;

    -- 8. Record Immutable AR Transaction: PAYMENT_APPLIED
    INSERT INTO public.customer_ar_transactions (
        ar_ledger_id,
        transaction_type,
        amount,
        reference_id,
        actor,
        notes
    ) VALUES (
        p_ar_ledger_id,
        'PAYMENT_APPLIED',
        p_amount,
        v_receipt.receipt_reference,
        auth.uid(),
        'Payment allocated from receipt ' || v_receipt.receipt_reference || ' (Ext Ref: ' || v_receipt.external_transaction_ref || ')'
    );

    RETURN jsonb_build_object(
        'success', true,
        'ar_ledger_id', p_ar_ledger_id,
        'allocated_amount', p_amount,
        'new_ar_balance', v_new_remaining,
        'ar_status', v_new_status,
        'receipt_remaining', v_new_receipt_rem,
        'receipt_status', v_new_receipt_status
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. RPC: fn_reconcile_unallocated_bank_receipt
-- Reconciles one incoming bank/UPI receipt across multiple open AR invoices
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_reconcile_unallocated_bank_receipt(
    p_unallocated_id UUID,
    p_ar_ledger_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_receipt RECORD;
    v_target_id UUID;
    v_ar RECORD;
    v_alloc_amt NUMERIC(14, 2);
    v_rem_to_allocate NUMERIC(14, 2);
    v_total_allocated NUMERIC(14, 2) := 0.00;
    v_inv_count INT := 0;
BEGIN
    -- 1. Authorization check
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'finance') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Finance or Admin can reconcile receipts');
    END IF;

    -- 2. Lock receipt
    SELECT * INTO v_receipt FROM public.payment_receipts_unallocated WHERE id = p_unallocated_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unallocated receipt not found');
    END IF;

    IF v_receipt.remaining_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Receipt has no remaining unallocated balance');
    END IF;

    v_rem_to_allocate := v_receipt.remaining_amount;

    -- 3. Iterate through AR invoices in order
    FOREACH v_target_id IN ARRAY p_ar_ledger_ids LOOP
        IF v_rem_to_allocate <= 0 THEN
            EXIT;
        END IF;

        SELECT * INTO v_ar FROM public.customer_ar_ledger WHERE id = v_target_id FOR UPDATE;
        IF FOUND AND v_ar.status IN ('OPEN', 'PARTIALLY_SETTLED') AND v_ar.remaining_balance > 0 THEN
            v_alloc_amt := LEAST(v_rem_to_allocate, v_ar.remaining_balance);

            -- Apply allocation
            UPDATE public.customer_ar_ledger
            SET settled_amount = round(settled_amount + v_alloc_amt, 2),
                remaining_balance = round(billed_amount - (settled_amount + v_alloc_amt), 2),
                status = CASE WHEN round(billed_amount - (settled_amount + v_alloc_amt), 2) <= 0 THEN 'SETTLED' ELSE 'PARTIALLY_SETTLED' END,
                updated_at = now()
            WHERE id = v_target_id;

            -- Record AR transaction
            INSERT INTO public.customer_ar_transactions (
                ar_ledger_id,
                transaction_type,
                amount,
                reference_id,
                actor,
                notes
            ) VALUES (
                v_target_id,
                'PAYMENT_APPLIED',
                v_alloc_amt,
                v_receipt.receipt_reference,
                auth.uid(),
                'Batch multi-invoice reconciliation from receipt ' || v_receipt.receipt_reference
            );

            v_rem_to_allocate := round(v_rem_to_allocate - v_alloc_amt, 2);
            v_total_allocated := round(v_total_allocated + v_alloc_amt, 2);
            v_inv_count := v_inv_count + 1;
        END IF;
    END LOOP;

    -- 4. Update Receipt matched & remaining
    UPDATE public.payment_receipts_unallocated
    SET matched_amount = round(matched_amount + v_total_allocated, 2),
        remaining_amount = round(amount - (matched_amount + v_total_allocated), 2),
        status = CASE 
            WHEN round(amount - (matched_amount + v_total_allocated), 2) <= 0 THEN 'FULLY_ALLOCATED'
            ELSE 'PARTIALLY_ALLOCATED'
        END,
        updated_at = now()
    WHERE id = p_unallocated_id;

    RETURN jsonb_build_object(
        'success', true,
        'receipt_id', p_unallocated_id,
        'allocated_total', v_total_allocated,
        'invoices_reconciled', v_inv_count,
        'receipt_remaining', round(v_receipt.amount - (v_receipt.matched_amount + v_total_allocated), 2)
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. RPC: fn_apply_credit_memo_to_ar
-- Offsets an approved credit memo against an open customer/dealer AR balance
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_apply_credit_memo_to_ar(
    p_ar_ledger_id UUID,
    p_credit_memo_ref TEXT,
    p_offset_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_ar RECORD;
    v_new_settled NUMERIC(14, 2);
    v_new_balance NUMERIC(14, 2);
    v_new_status TEXT;
BEGIN
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'finance') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Finance or Admin can apply credit memo offsets');
    END IF;

    IF p_offset_amount IS NULL OR p_offset_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Credit memo offset amount must be greater than zero');
    END IF;

    SELECT * INTO v_ar FROM public.customer_ar_ledger WHERE id = p_ar_ledger_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'AR ledger entry not found');
    END IF;

    IF v_ar.status IN ('SETTLED', 'WRITTEN_OFF') THEN
        RETURN jsonb_build_object('success', false, 'error', 'AR ledger invoice is already settled or written off');
    END IF;

    IF p_offset_amount > v_ar.remaining_balance THEN
        RETURN jsonb_build_object('success', false, 'error', 'Credit memo offset exceeds open AR balance');
    END IF;

    v_new_settled := round(v_ar.settled_amount + p_offset_amount, 2);
    v_new_balance := round(v_ar.billed_amount - v_new_settled, 2);
    v_new_status := CASE WHEN v_new_balance <= 0 THEN 'SETTLED' ELSE 'PARTIALLY_SETTLED' END;

    UPDATE public.customer_ar_ledger
    SET settled_amount = v_new_settled,
        remaining_balance = v_new_balance,
        status = v_new_status,
        updated_at = now()
    WHERE id = p_ar_ledger_id;

    INSERT INTO public.customer_ar_transactions (
        ar_ledger_id,
        transaction_type,
        amount,
        reference_id,
        actor,
        notes
    ) VALUES (
        p_ar_ledger_id,
        'CREDIT_MEMO_OFFSET',
        p_offset_amount,
        p_credit_memo_ref,
        auth.uid(),
        'Credit memo offset applied: ' || p_credit_memo_ref
    );

    RETURN jsonb_build_object(
        'success', true,
        'ar_ledger_id', p_ar_ledger_id,
        'offset_amount', p_offset_amount,
        'remaining_balance', v_new_balance,
        'status', v_new_status
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 12. RPC: fn_write_off_ar_bad_debt
-- Formally writes off an uncollectible AR balance with audit justification
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_write_off_ar_bad_debt(
    p_ar_ledger_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_ar RECORD;
    v_write_off_amount NUMERIC(14, 2);
BEGIN
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'finance') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Finance or Admin can authorize bad debt write-offs');
    END IF;

    SELECT * INTO v_ar FROM public.customer_ar_ledger WHERE id = p_ar_ledger_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'AR ledger entry not found');
    END IF;

    IF v_ar.status IN ('SETTLED', 'WRITTEN_OFF') THEN
        RETURN jsonb_build_object('success', false, 'error', 'AR invoice already settled or written off');
    END IF;

    v_write_off_amount := v_ar.remaining_balance;

    UPDATE public.customer_ar_ledger
    SET remaining_balance = 0.00,
        status = 'WRITTEN_OFF',
        notes = COALESCE(notes, '') || ' | Bad debt write-off: ' || p_reason,
        updated_at = now()
    WHERE id = p_ar_ledger_id;

    INSERT INTO public.customer_ar_transactions (
        ar_ledger_id,
        transaction_type,
        amount,
        reference_id,
        actor,
        notes
    ) VALUES (
        p_ar_ledger_id,
        'BAD_DEBT_WRITE_OFF',
        v_write_off_amount,
        'WO-' || v_ar.invoice_number,
        auth.uid(),
        'Authorized write-off: ' || p_reason
    );

    RETURN jsonb_build_object(
        'success', true,
        'ar_ledger_id', p_ar_ledger_id,
        'written_off_amount', v_write_off_amount,
        'status', 'WRITTEN_OFF'
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 13. RPC: fn_get_customer_ar_aging_summary
-- Server-authoritative AR aging buckets based on due_date (CURRENT, 1-30, 31-60, 61-90, 90+)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_customer_ar_aging_summary()
RETURNS TABLE (
    entity_id UUID,
    entity_type TEXT,
    entity_code TEXT,
    entity_name TEXT,
    total_outstanding NUMERIC,
    current_amount NUMERIC,
    days_1_30 NUMERIC,
    days_31_60 NUMERIC,
    days_61_90 NUMERIC,
    days_90_plus NUMERIC,
    oldest_overdue_days INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    -- Combine Customers and Dealers with open AR balances
    WITH open_ar AS (
        SELECT 
            ar.id,
            COALESCE(ar.customer_id, ar.dealer_id) AS entity_id,
            CASE WHEN ar.dealer_id IS NOT NULL THEN 'DEALER' ELSE 'CUSTOMER' END AS entity_type,
            COALESCE(d.dealer_code, c.customer_code) AS entity_code,
            COALESCE(d.dealer_name, c.full_name) AS entity_name,
            ar.remaining_balance,
            ar.due_date,
            GREATEST(CURRENT_DATE - ar.due_date, 0) AS overdue_days
        FROM public.customer_ar_ledger ar
        LEFT JOIN public.customers c ON ar.customer_id = c.id
        LEFT JOIN public.dealers d ON ar.dealer_id = d.id
        WHERE ar.status IN ('OPEN', 'PARTIALLY_SETTLED') AND ar.remaining_balance > 0
    )
    SELECT 
        entity_id,
        entity_type,
        entity_code,
        entity_name,
        COALESCE(SUM(remaining_balance), 0) AS total_outstanding,
        COALESCE(SUM(CASE WHEN due_date >= CURRENT_DATE THEN remaining_balance ELSE 0 END), 0) AS current_amount,
        COALESCE(SUM(CASE WHEN overdue_days BETWEEN 1 AND 30 THEN remaining_balance ELSE 0 END), 0) AS days_1_30,
        COALESCE(SUM(CASE WHEN overdue_days BETWEEN 31 AND 60 THEN remaining_balance ELSE 0 END), 0) AS days_31_60,
        COALESCE(SUM(CASE WHEN overdue_days BETWEEN 61 AND 90 THEN remaining_balance ELSE 0 END), 0) AS days_61_90,
        COALESCE(SUM(CASE WHEN overdue_days > 90 THEN remaining_balance ELSE 0 END), 0) AS days_90_plus,
        COALESCE(MAX(overdue_days), 0) AS oldest_overdue_days
    FROM open_ar
    GROUP BY entity_id, entity_type, entity_code, entity_name
    HAVING COALESCE(SUM(remaining_balance), 0) > 0
    ORDER BY total_outstanding DESC;
$$;

-- -----------------------------------------------------------------------------
-- 14. RPC: fn_evaluate_ar_dunning_pipeline
-- Evaluates overdue open AR invoices and transitions dunning cases across Tiers
-- Tier 1 (1-30 days overdue): Reminder Notice
-- Tier 2 (31-60 days overdue): Urgent Notice
-- Tier 3 (61+ days overdue): Legal / Service Suspension Review
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_evaluate_ar_dunning_pipeline()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_rec RECORD;
    v_days_overdue INT;
    v_tier TEXT;
    v_cases_created INT := 0;
    v_cases_escalated INT := 0;
    v_existing RECORD;
BEGIN
    v_role := public.get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'finance') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Finance or Admin can evaluate dunning pipeline');
    END IF;

    FOR v_rec IN 
        SELECT ar.* 
        FROM public.customer_ar_ledger ar
        WHERE ar.status IN ('OPEN', 'PARTIALLY_SETTLED')
          AND ar.due_date < CURRENT_DATE
          AND ar.remaining_balance > 0
    LOOP
        v_days_overdue := CURRENT_DATE - v_rec.due_date;
        
        IF v_days_overdue <= 30 THEN
            v_tier := 'TIER_1';
        ELSIF v_days_overdue <= 60 THEN
            v_tier := 'TIER_2';
        ELSE
            v_tier := 'TIER_3';
        END IF;

        SELECT * INTO v_existing FROM public.ar_dunning_cases WHERE ar_ledger_id = v_rec.id;
        IF NOT FOUND THEN
            -- Create new dunning case
            INSERT INTO public.ar_dunning_cases (
                ar_ledger_id,
                customer_id,
                dealer_id,
                invoice_number,
                days_overdue,
                overdue_amount,
                tier,
                status,
                notice_count,
                last_notice_sent_at,
                service_suspension_flag,
                notes
            ) VALUES (
                v_rec.id,
                v_rec.customer_id,
                v_rec.dealer_id,
                v_rec.invoice_number,
                v_days_overdue,
                v_rec.remaining_balance,
                v_tier,
                'OPEN',
                1,
                now(),
                CASE WHEN v_tier = 'TIER_3' THEN true ELSE false END,
                'Automated initial dunning case opened at ' || v_tier
            );
            v_cases_created := v_cases_created + 1;
        ELSE
            -- Update existing case
            IF v_existing.tier != v_tier THEN
                UPDATE public.ar_dunning_cases
                SET tier = v_tier,
                    days_overdue = v_days_overdue,
                    overdue_amount = v_rec.remaining_balance,
                    notice_count = notice_count + 1,
                    last_notice_sent_at = now(),
                    status = 'ESCALATED',
                    service_suspension_flag = CASE WHEN v_tier = 'TIER_3' THEN true ELSE service_suspension_flag END,
                    notes = COALESCE(notes, '') || ' | Escalated to ' || v_tier,
                    updated_at = now()
                WHERE id = v_existing.id;
                v_cases_escalated := v_cases_escalated + 1;
            ELSE
                UPDATE public.ar_dunning_cases
                SET days_overdue = v_days_overdue,
                    overdue_amount = v_rec.remaining_balance,
                    updated_at = now()
                WHERE id = v_existing.id;
            END IF;
        END IF;
    END LOOP;

    -- Auto-resolve dunning cases if invoice has been settled
    UPDATE public.ar_dunning_cases d
    SET status = 'RESOLVED',
        service_suspension_flag = false,
        notes = COALESCE(notes, '') || ' | Resolved: Balance settled',
        updated_at = now()
    FROM public.customer_ar_ledger ar
    WHERE d.ar_ledger_id = ar.id 
      AND ar.status IN ('SETTLED', 'WRITTEN_OFF')
      AND d.status NOT IN ('RESOLVED');

    RETURN jsonb_build_object(
        'success', true,
        'cases_created', v_cases_created,
        'cases_escalated', v_cases_escalated
    );
END;
$$;
