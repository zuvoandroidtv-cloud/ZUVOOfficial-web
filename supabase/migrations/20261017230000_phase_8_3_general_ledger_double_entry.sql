-- =============================================================================
-- ZUVO TV CRM — PHASE 8.3 MIGRATION
-- Enterprise General Ledger (GL), Double-Entry Accounting Core, Chart of Accounts & Automated Financial Statements
-- Target Environment: Supabase PostgreSQL
-- =============================================================================

-- Ensure clean execution context
SET search_path = public, pg_temp;

-- =============================================================================
-- 1. SEQUENCES FOR CONCURRENCY-SAFE JOURNAL ENTRY NUMBERING
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_journal_entry_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 2. TABLE: public.chart_of_accounts
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_number TEXT NOT NULL UNIQUE,
    account_name TEXT NOT NULL,
    parent_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    account_subtype TEXT NOT NULL,
    normal_balance TEXT NOT NULL CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
    currency TEXT NOT NULL DEFAULT 'INR',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system_account BOOLEAN NOT NULL DEFAULT false,
    system_control_type TEXT CHECK (
        system_control_type IN (
            'AR_CONTROL',
            'AP_CONTROL',
            'BANK',
            'CASH',
            'INVENTORY',
            'CONSIGNMENT_INVENTORY',
            'INPUT_GST',
            'OUTPUT_GST',
            'SALES_REVENUE',
            'COGS',
            'WARRANTY_EXPENSE',
            'BAD_DEBT_EXPENSE',
            'SCRAP_GAIN_LOSS',
            'RETAINED_EARNINGS'
        )
    ),
    gst_tax_code TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_number ON public.chart_of_accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type ON public.chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_system_type ON public.chart_of_accounts(system_control_type);

-- =============================================================================
-- 3. TABLE: public.accounting_periods
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_name TEXT NOT NULL UNIQUE,
    fiscal_year TEXT NOT NULL,
    period_number INT NOT NULL CHECK (period_number BETWEEN 1 AND 12),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'SOFT_CLOSED', 'LOCKED')),
    closed_by UUID REFERENCES auth.users(id),
    closed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_period_dates CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_dates ON public.accounting_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_status ON public.accounting_periods(status);

-- =============================================================================
-- 4. TABLE: public.journal_entries
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number TEXT NOT NULL UNIQUE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    accounting_period_id UUID REFERENCES public.accounting_periods(id),
    source_document_type TEXT NOT NULL CHECK (
        source_document_type IN (
            'COMMERCIAL_INVOICE',
            'PAYMENT_RECEIPT',
            'AP_INVOICE',
            'AP_PAYMENT',
            'CONSIGNMENT_SETTLEMENT',
            'WARRANTY_SETTLEMENT',
            'BAD_DEBT_WRITE_OFF',
            'MANUAL_JOURNAL',
            'PERIOD_CLOSING_REVERSAL'
        )
    ),
    source_document_reference_id UUID,
    status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('DRAFT', 'POSTED', 'VOID')),
    total_debit NUMERIC(15, 2) NOT NULL CHECK (total_debit >= 0),
    total_credit NUMERIC(15, 2) NOT NULL CHECK (total_credit >= 0),
    narration TEXT NOT NULL,
    posted_by UUID REFERENCES auth.users(id),
    posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_journal_balanced CHECK (total_debit = total_credit)
);

-- Unique index for idempotent auto-journalization
CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_source_document ON public.journal_entries(source_document_type, source_document_reference_id)
WHERE source_document_reference_id IS NOT NULL AND status = 'POSTED';

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_period ON public.journal_entries(accounting_period_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON public.journal_entries(status);

-- =============================================================================
-- 5. TABLE: public.journal_entry_lines
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
    line_number INT NOT NULL,
    account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
    debit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (debit_amount >= 0),
    credit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (credit_amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    entity_type TEXT CHECK (entity_type IN ('CUSTOMER', 'DEALER', 'VENDOR', 'WAREHOUSE', 'INTERNAL')),
    entity_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_line_not_both CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR
        (credit_amount > 0 AND debit_amount = 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_entry_lines(account_id);

-- =============================================================================
-- 6. TABLE: public.gl_account_balances
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.gl_account_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE,
    accounting_period_id UUID NOT NULL REFERENCES public.accounting_periods(id) ON DELETE CASCADE,
    opening_debit NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (opening_debit >= 0),
    opening_credit NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (opening_credit >= 0),
    net_period_debit NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (net_period_debit >= 0),
    net_period_credit NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (net_period_credit >= 0),
    closing_debit NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (closing_debit >= 0),
    closing_credit NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (closing_credit >= 0),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_gl_account_period UNIQUE (account_id, accounting_period_id)
);

CREATE INDEX IF NOT EXISTS idx_gl_account_balances_acc_per ON public.gl_account_balances(account_id, accounting_period_id);

-- =============================================================================
-- 7. SEED: STANDARD INDIAN CORPORATE CHART OF ACCOUNTS (AS / Ind AS)
-- =============================================================================
INSERT INTO public.chart_of_accounts 
(account_number, account_name, account_type, account_subtype, normal_balance, is_system_account, system_control_type, description)
VALUES
-- 1000s Assets
('1000', 'Current Assets', 'ASSET', 'SUMMARY_GROUP', 'DEBIT', true, NULL, 'Master current assets group'),
('1010', 'Operating Bank Account (HDFC/ICICI)', 'ASSET', 'CASH_AND_EQUIVALENTS', 'DEBIT', true, 'BANK', 'Central operational settlement bank account'),
('1020', 'Cash & Scrap Clearing', 'ASSET', 'CASH_AND_EQUIVALENTS', 'DEBIT', true, 'CASH', 'Physical cash and scrap disposal receivables'),
('1100', 'Accounts Receivable Control', 'ASSET', 'RECEIVABLES', 'DEBIT', true, 'AR_CONTROL', 'Customer and dealer commercial trade receivables control account'),
('1200', 'GST Input Tax Credit (ITC) Control', 'ASSET', 'TAX_RECOVERABLE', 'DEBIT', true, 'INPUT_GST', 'Total input GST recoverable from procurement'),
('1210', 'CGST Input ITC', 'ASSET', 'TAX_RECOVERABLE', 'DEBIT', true, 'INPUT_GST', 'Central GST 9% input tax credit on purchases'),
('1220', 'SGST Input ITC', 'ASSET', 'TAX_RECOVERABLE', 'DEBIT', true, 'INPUT_GST', 'State GST 9% input tax credit on purchases'),
('1230', 'IGST Input ITC', 'ASSET', 'TAX_RECOVERABLE', 'DEBIT', true, 'INPUT_GST', 'Integrated GST 18% input tax credit on inter-state purchases'),
('1300', 'Finished Goods TV Inventory', 'ASSET', 'INVENTORY', 'DEBIT', true, 'INVENTORY', 'Central warehouse inventory valued at landed purchase cost'),
('1310', 'Dealer Consignment Inventory', 'ASSET', 'INVENTORY', 'DEBIT', true, 'CONSIGNMENT_INVENTORY', 'Consignment stock placed in dealer physical custody'),

-- 2000s Liabilities
('2000', 'Current Liabilities', 'LIABILITY', 'SUMMARY_GROUP', 'CREDIT', true, NULL, 'Master current liabilities group'),
('2100', 'Accounts Payable Control', 'LIABILITY', 'PAYABLES', 'CREDIT', true, 'AP_CONTROL', 'Vendor commercial accounts payable control account'),
('2200', 'GST Output Tax Liability Control', 'LIABILITY', 'TAX_PAYABLE', 'CREDIT', true, 'OUTPUT_GST', 'Total GST collected and payable to government'),
('2210', 'CGST Output Liability', 'LIABILITY', 'TAX_PAYABLE', 'CREDIT', true, 'OUTPUT_GST', 'Central GST 9% liability on intra-state TV sales'),
('2220', 'SGST Output Liability', 'LIABILITY', 'TAX_PAYABLE', 'CREDIT', true, 'OUTPUT_GST', 'State GST 9% liability on intra-state TV sales'),
('2230', 'IGST Output Liability', 'LIABILITY', 'TAX_PAYABLE', 'CREDIT', true, 'OUTPUT_GST', 'Integrated GST 18% liability on inter-state TV sales'),

-- 3000s Equity
('3000', 'Stockholders Equity', 'EQUITY', 'SUMMARY_GROUP', 'CREDIT', true, NULL, 'Master equity group'),
('3100', 'Share Capital', 'EQUITY', 'CONTRIBUTED_CAPITAL', 'CREDIT', true, NULL, 'Paid-up equity share capital'),
('3200', 'Retained Earnings', 'EQUITY', 'ACCUMULATED_EARNINGS', 'CREDIT', true, 'RETAINED_EARNINGS', 'Accumulated prior and current fiscal year earnings'),

-- 4000s Revenue
('4000', 'Television Commercial Sales Revenue', 'REVENUE', 'OPERATING_REVENUE', 'CREDIT', true, 'SALES_REVENUE', 'Net commercial sales revenue from ZUVO TVs'),
('4100', 'Other Operating Revenue', 'REVENUE', 'OTHER_REVENUE', 'CREDIT', true, NULL, 'Extended warranty premiums and ancillary fees'),

-- 5000s Costs & Expenses
('5000', 'Cost of Goods Sold (COGS)', 'EXPENSE', 'DIRECT_COST', 'DEBIT', true, 'COGS', 'Landed cost basis of television units sold'),
('5100', 'Operating & Administrative Expenses', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, NULL, 'General operating, depot handling and facility expenses'),
('5200', 'Warranty & Customer Service Expense', 'EXPENSE', 'SERVICE_EXPENSE', 'DEBIT', true, 'WARRANTY_EXPENSE', 'Parts, technician claims, and dealer warranty reimbursements'),
('5300', 'Scrap & Refurbishment Gain / Loss', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, 'SCRAP_GAIN_LOSS', 'Realized variance from recycling disposition and component salvage'),
('5400', 'Bad Debt Expense', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, 'BAD_DEBT_EXPENSE', 'Authorized write-offs of uncollectible customer/dealer receivables'),
('5500', 'Travel & Field Service Logistics Expense', 'EXPENSE', 'SERVICE_EXPENSE', 'DEBIT', true, NULL, 'Technician per-km travel mileage and daily allowances')
ON CONFLICT (account_number) DO NOTHING;

-- Seed Default Open Accounting Period for Current Month (and neighboring buffer)
INSERT INTO public.accounting_periods 
(period_name, fiscal_year, period_number, start_date, end_date, status, notes)
VALUES
('FY2026-M10', 'FY2026-27', 7, '2026-10-01', '2026-10-31', 'OPEN', 'October 2026 active operating period'),
('FY2026-M11', 'FY2026-27', 8, '2026-11-01', '2026-11-30', 'OPEN', 'November 2026 scheduled operating period')
ON CONFLICT (period_name) DO NOTHING;

-- =============================================================================
-- 8. HELPER FUNCTION: Concurrency-Safe Sequential Journal Entry Number
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_generate_journal_entry_number(p_entry_date DATE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prefix TEXT;
    v_seq_val BIGINT;
    v_formatted_num TEXT;
BEGIN
    v_prefix := 'JE-' || to_char(p_entry_date, 'YYYYMM') || '-';
    v_seq_val := nextval('public.seq_journal_entry_number');
    v_formatted_num := v_prefix || lpad(v_seq_val::text, 4, '0');
    RETURN v_formatted_num;
END;
$$;

-- =============================================================================
-- 9. RPC: fn_post_journal_entry (Core Double-Entry Posting Engine)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_post_journal_entry(p_entry_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_entry_date DATE;
    v_period RECORD;
    v_source_type TEXT;
    v_source_ref_id UUID;
    v_narration TEXT;
    v_lines JSONB;
    v_line_elem JSONB;
    v_line_idx INT := 1;
    v_total_debit NUMERIC(15, 2) := 0.00;
    v_total_credit NUMERIC(15, 2) := 0.00;
    v_line_debit NUMERIC(15, 2);
    v_line_credit NUMERIC(15, 2);
    v_account_id UUID;
    v_account_rec RECORD;
    v_entry_number TEXT;
    v_journal_entry_id UUID;
BEGIN
    -- 1. Authorization check
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'finance')
        ) THEN
            RAISE EXCEPTION 'Access denied: Only Finance and Administrative roles may post journal entries.';
        END IF;
    END IF;

    -- 2. Extract and validate parameters
    v_entry_date := COALESCE((p_entry_data->>'entry_date')::date, CURRENT_DATE);
    v_source_type := p_entry_data->>'source_document_type';
    v_source_ref_id := (p_entry_data->>'source_document_reference_id')::uuid;
    v_narration := TRIM(COALESCE(p_entry_data->>'narration', 'Standard General Ledger Posting'));
    v_lines := p_entry_data->'lines';

    IF v_source_type IS NULL THEN
        RAISE EXCEPTION 'source_document_type is required for all journal entries.';
    END IF;

    -- Idempotency check: if already posted for this source document, return existing
    IF v_source_ref_id IS NOT NULL THEN
        SELECT id, entry_number INTO v_journal_entry_id, v_entry_number
        FROM public.journal_entries
        WHERE source_document_type = v_source_type
          AND source_document_reference_id = v_source_ref_id
          AND status = 'POSTED'
        LIMIT 1;

        IF v_journal_entry_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'journal_entry_id', v_journal_entry_id,
                'entry_number', v_entry_number,
                'message', 'Existing authoritative journal entry returned (idempotency verified).'
            );
        END IF;
    END IF;

    -- 3. Determine accounting period from entry date
    SELECT * INTO v_period
    FROM public.accounting_periods
    WHERE v_entry_date BETWEEN start_date AND end_date
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_period.id IS NULL THEN
        RAISE EXCEPTION 'No accounting period found covering entry date %.', v_entry_date;
    END IF;

    IF v_period.status = 'LOCKED' THEN
        RAISE EXCEPTION 'Accounting period % is LOCKED. No new postings or backdated modifications permitted.', v_period.period_name;
    END IF;

    IF jsonb_array_length(v_lines) < 2 THEN
        RAISE EXCEPTION 'Double-entry accounting requires at least two lines per journal entry.';
    END IF;

    -- 4. Validate lines and calculate debits/credits
    FOR v_line_elem IN SELECT * FROM jsonb_array_elements(v_lines)
    LOOP
        v_line_debit := COALESCE((v_line_elem->>'debit_amount')::numeric, 0.00);
        v_line_credit := COALESCE((v_line_elem->>'credit_amount')::numeric, 0.00);

        IF v_line_debit < 0 OR v_line_credit < 0 THEN
            RAISE EXCEPTION 'Negative amounts are strictly forbidden in journal entries.';
        END IF;

        IF v_line_debit > 0 AND v_line_credit > 0 THEN
            RAISE EXCEPTION 'A journal line cannot contain both a debit and a credit amount.';
        END IF;

        IF v_line_debit = 0 AND v_line_credit = 0 THEN
            RAISE EXCEPTION 'A journal line must specify either a non-zero debit or credit amount.';
        END IF;

        -- Validate account exists
        IF v_line_elem ? 'account_id' THEN
            v_account_id := (v_line_elem->>'account_id')::uuid;
        ELSIF v_line_elem ? 'account_number' THEN
            SELECT id INTO v_account_id FROM public.chart_of_accounts WHERE account_number = (v_line_elem->>'account_number');
        ELSE
            RAISE EXCEPTION 'Each line must specify account_id or account_number.';
        END IF;

        IF v_account_id IS NULL THEN
            RAISE EXCEPTION 'Chart of accounts record not found for line %.', v_line_idx;
        END IF;

        v_total_debit := v_total_debit + v_line_debit;
        v_total_credit := v_total_credit + v_line_credit;
        v_line_idx := v_line_idx + 1;
    END LOOP;

    -- 5. Strict Double-Entry Balance Enforcement (Total Debits MUST Equal Total Credits)
    IF v_total_debit <> v_total_credit THEN
        RAISE EXCEPTION 'Double-entry imbalance: Total debits (%) must equal total credits (%). Variance: %', 
            v_total_debit, v_total_credit, (v_total_debit - v_total_credit);
    END IF;

    IF v_total_debit = 0 THEN
        RAISE EXCEPTION 'Journal entry total debit and credit must be greater than zero.';
    END IF;

    -- 6. Generate sequential entry number and insert journal entry header
    v_entry_number := public.fn_generate_journal_entry_number(v_entry_date);

    INSERT INTO public.journal_entries (
        entry_number,
        entry_date,
        accounting_period_id,
        source_document_type,
        source_document_reference_id,
        status,
        total_debit,
        total_credit,
        narration,
        posted_by,
        posted_at
    ) VALUES (
        v_entry_number,
        v_entry_date,
        v_period.id,
        v_source_type,
        v_source_ref_id,
        'POSTED',
        v_total_debit,
        v_total_credit,
        v_narration,
        v_actor_id,
        now()
    ) RETURNING id INTO v_journal_entry_id;

    -- 7. Insert journal lines and update GL account period balances atomically
    v_line_idx := 1;
    FOR v_line_elem IN SELECT * FROM jsonb_array_elements(v_lines)
    LOOP
        v_line_debit := COALESCE((v_line_elem->>'debit_amount')::numeric, 0.00);
        v_line_credit := COALESCE((v_line_elem->>'credit_amount')::numeric, 0.00);

        IF v_line_elem ? 'account_id' THEN
            v_account_id := (v_line_elem->>'account_id')::uuid;
        ELSE
            SELECT id INTO v_account_id FROM public.chart_of_accounts WHERE account_number = (v_line_elem->>'account_number');
        END IF;

        INSERT INTO public.journal_entry_lines (
            journal_entry_id,
            line_number,
            account_id,
            debit_amount,
            credit_amount,
            currency,
            entity_type,
            entity_id,
            description
        ) VALUES (
            v_journal_entry_id,
            v_line_idx,
            v_account_id,
            v_line_debit,
            v_line_credit,
            COALESCE(v_line_elem->>'currency', 'INR'),
            v_line_elem->>'entity_type',
            (v_line_elem->>'entity_id')::uuid,
            COALESCE(v_line_elem->>'description', v_narration)
        );

        -- Upsert GL Account period balances
        INSERT INTO public.gl_account_balances (
            account_id,
            accounting_period_id,
            opening_debit,
            opening_credit,
            net_period_debit,
            net_period_credit,
            closing_debit,
            closing_credit,
            last_updated
        ) VALUES (
            v_account_id,
            v_period.id,
            0.00,
            0.00,
            v_line_debit,
            v_line_credit,
            v_line_debit,
            v_line_credit,
            now()
        )
        ON CONFLICT (account_id, accounting_period_id) DO UPDATE SET
            net_period_debit = public.gl_account_balances.net_period_debit + EXCLUDED.net_period_debit,
            net_period_credit = public.gl_account_balances.net_period_credit + EXCLUDED.net_period_credit,
            closing_debit = public.gl_account_balances.opening_debit + (public.gl_account_balances.net_period_debit + EXCLUDED.net_period_debit),
            closing_credit = public.gl_account_balances.opening_credit + (public.gl_account_balances.net_period_credit + EXCLUDED.net_period_credit),
            last_updated = now();

        v_line_idx := v_line_idx + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'journal_entry_id', v_journal_entry_id,
        'entry_number', v_entry_number,
        'total_amount', v_total_debit,
        'period_name', v_period.period_name
    );
END;
$$;

-- =============================================================================
-- 10. AUTO-JOURNALIZER: Commercial Tax Invoices (Phase 8.2 Sales)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_journalize_sales_invoice(p_commercial_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inv RECORD;
    v_entry_payload JSONB;
    v_lines JSONB := '[]'::jsonb;
    v_ar_acc_id UUID;
    v_rev_acc_id UUID;
    v_cgst_acc_id UUID;
    v_sgst_acc_id UUID;
    v_igst_acc_id UUID;
BEGIN
    -- 1. Fetch commercial tax invoice
    SELECT * INTO v_inv
    FROM public.commercial_tax_invoices
    WHERE id = p_commercial_invoice_id;

    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'Commercial tax invoice % not found.', p_commercial_invoice_id;
    END IF;

    -- Look up account IDs
    SELECT id INTO v_ar_acc_id FROM public.chart_of_accounts WHERE account_number = '1100';
    SELECT id INTO v_rev_acc_id FROM public.chart_of_accounts WHERE account_number = '4000';
    SELECT id INTO v_cgst_acc_id FROM public.chart_of_accounts WHERE account_number = '2210';
    SELECT id INTO v_sgst_acc_id FROM public.chart_of_accounts WHERE account_number = '2220';
    SELECT id INTO v_igst_acc_id FROM public.chart_of_accounts WHERE account_number = '2230';

    -- Line 1: DEBIT Accounts Receivable (Grand Total)
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_ar_acc_id,
        'debit_amount', v_inv.grand_total,
        'credit_amount', 0.00,
        'entity_type', CASE WHEN v_inv.dealer_id IS NOT NULL THEN 'DEALER' ELSE 'CUSTOMER' END,
        'entity_id', COALESCE(v_inv.dealer_id, v_inv.customer_id),
        'description', 'Commercial receivable billed: ' || v_inv.invoice_number
    );

    -- Line 2: CREDIT Sales Revenue (Taxable Value)
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_rev_acc_id,
        'debit_amount', 0.00,
        'credit_amount', v_inv.taxable_value,
        'description', 'Television commercial sales revenue for ' || v_inv.invoice_number
    );

    -- Line 3 & 4 (Intra-state CGST & SGST) or Line 3 (Inter-state IGST)
    IF v_inv.cgst_amount > 0 THEN
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_cgst_acc_id,
            'debit_amount', 0.00,
            'credit_amount', v_inv.cgst_amount,
            'description', 'CGST 9% Output Liability: ' || v_inv.invoice_number
        );
    END IF;

    IF v_inv.sgst_amount > 0 THEN
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_sgst_acc_id,
            'debit_amount', 0.00,
            'credit_amount', v_inv.sgst_amount,
            'description', 'SGST 9% Output Liability: ' || v_inv.invoice_number
        );
    END IF;

    IF v_inv.igst_amount > 0 THEN
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_igst_acc_id,
            'debit_amount', 0.00,
            'credit_amount', v_inv.igst_amount,
            'description', 'IGST 18% Output Liability: ' || v_inv.invoice_number
        );
    END IF;

    v_entry_payload := jsonb_build_object(
        'entry_date', v_inv.invoice_date,
        'source_document_type', 'COMMERCIAL_INVOICE',
        'source_document_reference_id', v_inv.id,
        'narration', 'Commercial Tax Invoice ' || v_inv.invoice_number || ' posted to General Ledger',
        'lines', v_lines
    );

    RETURN public.fn_post_journal_entry(v_entry_payload);
END;
$$;

-- =============================================================================
-- 11. AUTO-JOURNALIZER: AR Cash Allocation & Payments (Phase 8.2 Cash Settlement)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_journalize_ar_payment(p_ar_transaction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tx RECORD;
    v_ar RECORD;
    v_entry_payload JSONB;
    v_lines JSONB := '[]'::jsonb;
    v_bank_acc_id UUID;
    v_ar_acc_id UUID;
BEGIN
    SELECT * INTO v_tx
    FROM public.customer_ar_transactions
    WHERE id = p_ar_transaction_id;

    IF v_tx.id IS NULL THEN
        RAISE EXCEPTION 'Customer AR transaction % not found.', p_ar_transaction_id;
    END IF;

    IF v_tx.transaction_type <> 'PAYMENT_APPLIED' THEN
        RAISE EXCEPTION 'Transaction type must be PAYMENT_APPLIED to journalize as payment receipt.';
    END IF;

    SELECT * INTO v_ar FROM public.customer_ar_ledger WHERE id = v_tx.ar_ledger_id;

    SELECT id INTO v_bank_acc_id FROM public.chart_of_accounts WHERE account_number = '1010';
    SELECT id INTO v_ar_acc_id FROM public.chart_of_accounts WHERE account_number = '1100';

    -- Line 1: DEBIT Bank Account
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_bank_acc_id,
        'debit_amount', v_tx.amount,
        'credit_amount', 0.00,
        'description', 'Payment collected for ' || v_ar.invoice_number
    );

    -- Line 2: CREDIT Accounts Receivable Control
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_ar_acc_id,
        'debit_amount', 0.00,
        'credit_amount', v_tx.amount,
        'entity_type', CASE WHEN v_ar.dealer_id IS NOT NULL THEN 'DEALER' ELSE 'CUSTOMER' END,
        'entity_id', COALESCE(v_ar.dealer_id, v_ar.customer_id),
        'description', 'AR settlement offset for ' || v_ar.invoice_number
    );

    v_entry_payload := jsonb_build_object(
        'entry_date', CURRENT_DATE,
        'source_document_type', 'PAYMENT_RECEIPT',
        'source_document_reference_id', v_tx.id,
        'narration', 'AR Payment settlement applied to ' || v_ar.invoice_number,
        'lines', v_lines
    );

    RETURN public.fn_post_journal_entry(v_entry_payload);
END;
$$;

-- =============================================================================
-- 12. AUTO-JOURNALIZER: Vendor AP Invoices & Matching (Phase 8.0 Procurement)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_journalize_vendor_invoice(p_vendor_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_vinv RECORD;
    v_entry_payload JSONB;
    v_lines JSONB := '[]'::jsonb;
    v_inv_acc_id UUID;
    v_input_gst_acc_id UUID;
    v_ap_acc_id UUID;
    v_subtotal NUMERIC(15, 2);
    v_tax NUMERIC(15, 2);
    v_total NUMERIC(15, 2);
BEGIN
    SELECT * INTO v_vinv
    FROM public.vendor_invoices
    WHERE id = p_vendor_invoice_id;

    IF v_vinv.id IS NULL THEN
        RAISE EXCEPTION 'Vendor invoice % not found.', p_vendor_invoice_id;
    END IF;

    v_subtotal := COALESCE(v_vinv.subtotal, v_vinv.total_amount);
    v_tax := COALESCE(v_vinv.tax_amount, 0.00);
    v_total := COALESCE(v_vinv.total_amount, v_subtotal + v_tax);

    SELECT id INTO v_inv_acc_id FROM public.chart_of_accounts WHERE account_number = '1300';
    SELECT id INTO v_input_gst_acc_id FROM public.chart_of_accounts WHERE account_number = '1200';
    SELECT id INTO v_ap_acc_id FROM public.chart_of_accounts WHERE account_number = '2100';

    -- Line 1: DEBIT Finished Goods Inventory (Subtotal / Landed Basis)
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_inv_acc_id,
        'debit_amount', v_subtotal,
        'credit_amount', 0.00,
        'description', 'TV Inventory capitalized from PO/Vendor Bill: ' || v_vinv.invoice_number
    );

    -- Line 2: DEBIT Input Tax Credit (ITC) if tax is present
    IF v_tax > 0 THEN
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_input_gst_acc_id,
            'debit_amount', v_tax,
            'credit_amount', 0.00,
            'description', 'Input GST ITC on vendor purchase: ' || v_vinv.invoice_number
        );
    END IF;

    -- Line 3: CREDIT Accounts Payable Control (Grand Total)
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_ap_acc_id,
        'debit_amount', 0.00,
        'credit_amount', v_total,
        'entity_type', 'VENDOR',
        'entity_id', v_vinv.vendor_id,
        'description', 'AP trade liability for vendor bill: ' || v_vinv.invoice_number
    );

    v_entry_payload := jsonb_build_object(
        'entry_date', v_vinv.invoice_date,
        'source_document_type', 'AP_INVOICE',
        'source_document_reference_id', v_vinv.id,
        'narration', 'Vendor Bill ' || v_vinv.invoice_number || ' recognized in General Ledger',
        'lines', v_lines
    );

    RETURN public.fn_post_journal_entry(v_entry_payload);
END;
$$;

-- =============================================================================
-- 13. AUTO-JOURNALIZER: Vendor AP Payment Disbursements (Phase 8.0 Outflow)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_journalize_vendor_payment(p_ap_transaction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tx RECORD;
    v_ap RECORD;
    v_entry_payload JSONB;
    v_lines JSONB := '[]'::jsonb;
    v_ap_acc_id UUID;
    v_bank_acc_id UUID;
BEGIN
    SELECT * INTO v_tx
    FROM public.vendor_ap_transactions
    WHERE id = p_ap_transaction_id;

    IF v_tx.id IS NULL THEN
        RAISE EXCEPTION 'Vendor AP transaction % not found.', p_ap_transaction_id;
    END IF;

    SELECT * INTO v_ap FROM public.vendor_ap_ledger WHERE id = v_tx.vendor_ap_ledger_id;

    SELECT id INTO v_ap_acc_id FROM public.chart_of_accounts WHERE account_number = '2100';
    SELECT id INTO v_bank_acc_id FROM public.chart_of_accounts WHERE account_number = '1010';

    -- Line 1: DEBIT Accounts Payable Control
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_ap_acc_id,
        'debit_amount', v_tx.amount,
        'credit_amount', 0.00,
        'entity_type', 'VENDOR',
        'entity_id', v_ap.vendor_id,
        'description', 'AP disbursement settlement: ' || v_ap.invoice_number
    );

    -- Line 2: CREDIT Operating Bank Account
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_bank_acc_id,
        'debit_amount', 0.00,
        'credit_amount', v_tx.amount,
        'description', 'Bank disbursement for vendor invoice: ' || v_ap.invoice_number
    );

    v_entry_payload := jsonb_build_object(
        'entry_date', CURRENT_DATE,
        'source_document_type', 'AP_PAYMENT',
        'source_document_reference_id', v_tx.id,
        'narration', 'Vendor AP payment disbursement for ' || v_ap.invoice_number,
        'lines', v_lines
    );

    RETURN public.fn_post_journal_entry(v_entry_payload);
END;
$$;

-- =============================================================================
-- 14. AUTO-JOURNALIZER: Dealer Consignment Settlement (Phase 8.1 Consignment)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_journalize_consignment_settlement(
    p_consignment_item_id UUID,
    p_sale_price NUMERIC,
    p_cost_basis NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_item RECORD;
    v_entry_payload JSONB;
    v_lines JSONB := '[]'::jsonb;
    v_ar_acc_id UUID;
    v_rev_acc_id UUID;
    v_cogs_acc_id UUID;
    v_consign_inv_id UUID;
BEGIN
    SELECT * INTO v_item
    FROM public.dealer_consignment_inventory
    WHERE id = p_consignment_item_id;

    IF v_item.id IS NULL THEN
        RAISE EXCEPTION 'Dealer consignment item % not found.', p_consignment_item_id;
    END IF;

    SELECT id INTO v_ar_acc_id FROM public.chart_of_accounts WHERE account_number = '1100';
    SELECT id INTO v_rev_acc_id FROM public.chart_of_accounts WHERE account_number = '4000';
    SELECT id INTO v_cogs_acc_id FROM public.chart_of_accounts WHERE account_number = '5000';
    SELECT id INTO v_consign_inv_id FROM public.chart_of_accounts WHERE account_number = '1310';

    -- Line 1: DEBIT Accounts Receivable (Dealer Billed Amount)
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_ar_acc_id,
        'debit_amount', p_sale_price,
        'credit_amount', 0.00,
        'entity_type', 'DEALER',
        'entity_id', v_item.dealer_id,
        'description', 'Consignment sale receivable from dealer'
    );

    -- Line 2: CREDIT Sales Revenue
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_rev_acc_id,
        'debit_amount', 0.00,
        'credit_amount', p_sale_price,
        'description', 'Consignment sales revenue recognized'
    );

    -- Line 3: DEBIT Cost of Goods Sold (COGS)
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_cogs_acc_id,
        'debit_amount', p_cost_basis,
        'credit_amount', 0.00,
        'description', 'COGS recognized on consignment TV sale'
    );

    -- Line 4: CREDIT Consignment Inventory
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_consign_inv_id,
        'debit_amount', 0.00,
        'credit_amount', p_cost_basis,
        'description', 'Consignment inventory derecognized on sale'
    );

    v_entry_payload := jsonb_build_object(
        'entry_date', CURRENT_DATE,
        'source_document_type', 'CONSIGNMENT_SETTLEMENT',
        'source_document_reference_id', v_item.id,
        'narration', 'Dealer consignment TV sale settled into General Ledger',
        'lines', v_lines
    );

    RETURN public.fn_post_journal_entry(v_entry_payload);
END;
$$;

-- =============================================================================
-- 15. AUTO-JOURNALIZER: Warranty Claim Reimbursements (Phase 7.7 Warranty)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_journalize_warranty_settlement(p_credit_memo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cm RECORD;
    v_entry_payload JSONB;
    v_lines JSONB := '[]'::jsonb;
    v_warr_acc_id UUID;
    v_ar_acc_id UUID;
BEGIN
    SELECT * INTO v_cm
    FROM public.dealer_warranty_credit_memos
    WHERE id = p_credit_memo_id;

    IF v_cm.id IS NULL THEN
        RAISE EXCEPTION 'Dealer warranty credit memo % not found.', p_credit_memo_id;
    END IF;

    SELECT id INTO v_warr_acc_id FROM public.chart_of_accounts WHERE account_number = '5200';
    SELECT id INTO v_ar_acc_id FROM public.chart_of_accounts WHERE account_number = '1100';

    -- Line 1: DEBIT Warranty Expense
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_warr_acc_id,
        'debit_amount', v_cm.credit_amount,
        'credit_amount', 0.00,
        'description', 'Approved warranty reimbursement expense: ' || v_cm.memo_number
    );

    -- Line 2: CREDIT Accounts Receivable Control (Dealer Credit Offset)
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_ar_acc_id,
        'debit_amount', 0.00,
        'credit_amount', v_cm.credit_amount,
        'entity_type', 'DEALER',
        'entity_id', v_cm.dealer_id,
        'description', 'Dealer credit memo offset applied: ' || v_cm.memo_number
    );

    v_entry_payload := jsonb_build_object(
        'entry_date', CURRENT_DATE,
        'source_document_type', 'WARRANTY_SETTLEMENT',
        'source_document_reference_id', v_cm.id,
        'narration', 'Warranty claim reimbursement credit memo ' || v_cm.memo_number,
        'lines', v_lines
    );

    RETURN public.fn_post_journal_entry(v_entry_payload);
END;
$$;

-- =============================================================================
-- 16. AUTO-JOURNALIZER: Bad Debt Write-Offs (Phase 8.2 Accounts Receivable)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_journalize_bad_debt_write_off(p_ar_transaction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tx RECORD;
    v_ar RECORD;
    v_entry_payload JSONB;
    v_lines JSONB := '[]'::jsonb;
    v_bad_debt_acc_id UUID;
    v_ar_acc_id UUID;
BEGIN
    SELECT * INTO v_tx
    FROM public.customer_ar_transactions
    WHERE id = p_ar_transaction_id;

    IF v_tx.id IS NULL THEN
        RAISE EXCEPTION 'Customer AR transaction % not found.', p_ar_transaction_id;
    END IF;

    IF v_tx.transaction_type <> 'BAD_DEBT_WRITE_OFF' THEN
        RAISE EXCEPTION 'Transaction type must be BAD_DEBT_WRITE_OFF.';
    END IF;

    SELECT * INTO v_ar FROM public.customer_ar_ledger WHERE id = v_tx.ar_ledger_id;

    SELECT id INTO v_bad_debt_acc_id FROM public.chart_of_accounts WHERE account_number = '5400';
    SELECT id INTO v_ar_acc_id FROM public.chart_of_accounts WHERE account_number = '1100';

    -- Line 1: DEBIT Bad Debt Expense
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_bad_debt_acc_id,
        'debit_amount', v_tx.amount,
        'credit_amount', 0.00,
        'description', 'Authorized bad debt write-off for ' || v_ar.invoice_number
    );

    -- Line 2: CREDIT Accounts Receivable Control
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_ar_acc_id,
        'debit_amount', 0.00,
        'credit_amount', v_tx.amount,
        'entity_type', CASE WHEN v_ar.dealer_id IS NOT NULL THEN 'DEALER' ELSE 'CUSTOMER' END,
        'entity_id', COALESCE(v_ar.dealer_id, v_ar.customer_id),
        'description', 'Uncollectible receivable derecognized: ' || v_ar.invoice_number
    );

    v_entry_payload := jsonb_build_object(
        'entry_date', CURRENT_DATE,
        'source_document_type', 'BAD_DEBT_WRITE_OFF',
        'source_document_reference_id', v_tx.id,
        'narration', 'Bad debt write-off recognized for invoice ' || v_ar.invoice_number,
        'lines', v_lines
    );

    RETURN public.fn_post_journal_entry(v_entry_payload);
END;
$$;

-- =============================================================================
-- 17. RPC: fn_generate_trial_balance (Server-Authoritative Trial Balance)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_generate_trial_balance(p_period_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period RECORD;
    v_accounts JSONB := '[]'::jsonb;
    v_acc RECORD;
    v_tot_debit NUMERIC(15, 2) := 0.00;
    v_tot_credit NUMERIC(15, 2) := 0.00;
    v_variance NUMERIC(15, 2);
    v_is_balanced BOOLEAN;
BEGIN
    SELECT * INTO v_period FROM public.accounting_periods WHERE id = p_period_id;
    IF v_period.id IS NULL THEN
        RAISE EXCEPTION 'Accounting period % not found.', p_period_id;
    END IF;

    FOR v_acc IN 
        SELECT 
            c.account_number,
            c.account_name,
            c.account_type,
            c.normal_balance,
            COALESCE(b.opening_debit, 0.00) AS opening_debit,
            COALESCE(b.opening_credit, 0.00) AS opening_credit,
            COALESCE(b.net_period_debit, 0.00) AS net_period_debit,
            COALESCE(b.net_period_credit, 0.00) AS net_period_credit,
            COALESCE(b.closing_debit, 0.00) AS closing_debit,
            COALESCE(b.closing_credit, 0.00) AS closing_credit
        FROM public.chart_of_accounts c
        LEFT JOIN public.gl_account_balances b 
            ON b.account_id = c.id AND b.accounting_period_id = p_period_id
        WHERE c.is_active = true
        ORDER BY c.account_number ASC
    LOOP
        v_tot_debit := v_tot_debit + v_acc.closing_debit;
        v_tot_credit := v_tot_credit + v_acc.closing_credit;

        v_accounts := v_accounts || jsonb_build_object(
            'account_number', v_acc.account_number,
            'account_name', v_acc.account_name,
            'account_type', v_acc.account_type,
            'normal_balance', v_acc.normal_balance,
            'opening_debit', v_acc.opening_debit,
            'opening_credit', v_acc.opening_credit,
            'period_debit', v_acc.net_period_debit,
            'period_credit', v_acc.net_period_credit,
            'closing_debit', v_acc.closing_debit,
            'closing_credit', v_acc.closing_credit
        );
    END LOOP;

    v_variance := v_tot_debit - v_tot_credit;
    v_is_balanced := (v_variance = 0.00);

    RETURN jsonb_build_object(
        'period_name', v_period.period_name,
        'fiscal_year', v_period.fiscal_year,
        'period_status', v_period.status,
        'total_debit', v_tot_debit,
        'total_credit', v_tot_credit,
        'variance', v_variance,
        'is_balanced', v_is_balanced,
        'accounts', v_accounts
    );
END;
$$;

-- =============================================================================
-- 18. RPC: fn_generate_financial_statement (P&L, Balance Sheet & GST Reconciliation)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_generate_financial_statement(
    p_statement_type TEXT,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_statement JSONB;
    -- P&L variables
    v_sales_rev NUMERIC(15, 2) := 0.00;
    v_other_rev NUMERIC(15, 2) := 0.00;
    v_total_revenue NUMERIC(15, 2) := 0.00;
    v_cogs NUMERIC(15, 2) := 0.00;
    v_gross_profit NUMERIC(15, 2) := 0.00;
    v_warr_exp NUMERIC(15, 2) := 0.00;
    v_bad_debt_exp NUMERIC(15, 2) := 0.00;
    v_travel_exp NUMERIC(15, 2) := 0.00;
    v_other_exp NUMERIC(15, 2) := 0.00;
    v_total_opex NUMERIC(15, 2) := 0.00;
    v_net_profit NUMERIC(15, 2) := 0.00;
    -- Balance Sheet variables
    v_bank NUMERIC(15, 2) := 0.00;
    v_cash NUMERIC(15, 2) := 0.00;
    v_ar NUMERIC(15, 2) := 0.00;
    v_inv NUMERIC(15, 2) := 0.00;
    v_consign_inv NUMERIC(15, 2) := 0.00;
    v_input_gst NUMERIC(15, 2) := 0.00;
    v_total_assets NUMERIC(15, 2) := 0.00;
    v_ap NUMERIC(15, 2) := 0.00;
    v_output_gst NUMERIC(15, 2) := 0.00;
    v_total_liabilities NUMERIC(15, 2) := 0.00;
    v_equity_capital NUMERIC(15, 2) := 0.00;
    v_retained_earnings NUMERIC(15, 2) := 0.00;
    v_total_equity NUMERIC(15, 2) := 0.00;
    v_bs_variance NUMERIC(15, 2) := 0.00;
    -- GST variables
    v_cgst_out NUMERIC(15, 2) := 0.00;
    v_sgst_out NUMERIC(15, 2) := 0.00;
    v_igst_out NUMERIC(15, 2) := 0.00;
    v_cgst_in NUMERIC(15, 2) := 0.00;
    v_sgst_in NUMERIC(15, 2) := 0.00;
    v_igst_in NUMERIC(15, 2) := 0.00;
    v_net_gst_payable NUMERIC(15, 2) := 0.00;
BEGIN
    -- -------------------------------------------------------------------------
    -- STATEMENT 1: PROFIT AND LOSS (P&L)
    -- -------------------------------------------------------------------------
    IF p_statement_type = 'PROFIT_AND_LOSS' THEN
        SELECT 
            COALESCE(SUM(CASE WHEN c.account_number = '4000' THEN l.credit_amount - l.debit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '4100' THEN l.credit_amount - l.debit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '5000' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '5200' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '5400' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '5500' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number IN ('5100', '5300') THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00)
        INTO 
            v_sales_rev, v_other_rev, v_cogs, v_warr_exp, v_bad_debt_exp, v_travel_exp, v_other_exp
        FROM public.journal_entry_lines l
        JOIN public.journal_entries j ON l.journal_entry_id = j.id
        JOIN public.chart_of_accounts c ON l.account_id = c.id
        WHERE j.entry_date BETWEEN p_start_date AND p_end_date
          AND j.status = 'POSTED';

        v_total_revenue := v_sales_rev + v_other_rev;
        v_gross_profit := v_total_revenue - v_cogs;
        v_total_opex := v_warr_exp + v_bad_debt_exp + v_travel_exp + v_other_exp;
        v_net_profit := v_gross_profit - v_total_opex;

        RETURN jsonb_build_object(
            'statement_type', 'PROFIT_AND_LOSS',
            'start_date', p_start_date,
            'end_date', p_end_date,
            'revenue', jsonb_build_object(
                'television_sales_revenue', v_sales_rev,
                'other_operating_revenue', v_other_rev,
                'total_revenue', v_total_revenue
            ),
            'cost_of_goods_sold', v_cogs,
            'gross_profit', v_gross_profit,
            'operating_expenses', jsonb_build_object(
                'warranty_expense', v_warr_exp,
                'bad_debt_expense', v_bad_debt_exp,
                'travel_service_expense', v_travel_exp,
                'other_operating_expense', v_other_exp,
                'total_operating_expenses', v_total_opex
            ),
            'operating_income', v_gross_profit - v_total_opex,
            'net_profit', v_net_profit
        );

    -- -------------------------------------------------------------------------
    -- STATEMENT 2: BALANCE SHEET
    -- -------------------------------------------------------------------------
    ELSIF p_statement_type = 'BALANCE_SHEET' THEN
        -- Current Period Net Profit calculation to include in equity
        SELECT 
            COALESCE(SUM(CASE WHEN c.account_type = 'REVENUE' THEN l.credit_amount - l.debit_amount ELSE 0 END), 0.00) -
            COALESCE(SUM(CASE WHEN c.account_type = 'EXPENSE' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00)
        INTO v_net_profit
        FROM public.journal_entry_lines l
        JOIN public.journal_entries j ON l.journal_entry_id = j.id
        JOIN public.chart_of_accounts c ON l.account_id = c.id
        WHERE j.entry_date <= p_end_date AND j.status = 'POSTED';

        -- Asset Balances
        SELECT 
            COALESCE(SUM(CASE WHEN c.account_number = '1010' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '1020' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '1100' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '1300' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '1310' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number LIKE '12%' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00)
        INTO 
            v_bank, v_cash, v_ar, v_inv, v_consign_inv, v_input_gst
        FROM public.journal_entry_lines l
        JOIN public.journal_entries j ON l.journal_entry_id = j.id
        JOIN public.chart_of_accounts c ON l.account_id = c.id
        WHERE j.entry_date <= p_end_date AND j.status = 'POSTED';

        v_total_assets := v_bank + v_cash + v_ar + v_inv + v_consign_inv + v_input_gst;

        -- Liabilities Balances
        SELECT 
            COALESCE(SUM(CASE WHEN c.account_number = '2100' THEN l.credit_amount - l.debit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number LIKE '22%' THEN l.credit_amount - l.debit_amount ELSE 0 END), 0.00)
        INTO 
            v_ap, v_output_gst
        FROM public.journal_entry_lines l
        JOIN public.journal_entries j ON l.journal_entry_id = j.id
        JOIN public.chart_of_accounts c ON l.account_id = c.id
        WHERE j.entry_date <= p_end_date AND j.status = 'POSTED';

        v_total_liabilities := v_ap + v_output_gst;

        -- Equity Balances
        SELECT 
            COALESCE(SUM(CASE WHEN c.account_number = '3100' THEN l.credit_amount - l.debit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '3200' THEN l.credit_amount - l.debit_amount ELSE 0 END), 0.00)
        INTO 
            v_equity_capital, v_retained_earnings
        FROM public.journal_entry_lines l
        JOIN public.journal_entries j ON l.journal_entry_id = j.id
        JOIN public.chart_of_accounts c ON l.account_id = c.id
        WHERE j.entry_date <= p_end_date AND j.status = 'POSTED';

        v_total_equity := v_equity_capital + v_retained_earnings + v_net_profit;
        v_bs_variance := v_total_assets - (v_total_liabilities + v_total_equity);

        RETURN jsonb_build_object(
            'statement_type', 'BALANCE_SHEET',
            'as_of_date', p_end_date,
            'assets', jsonb_build_object(
                'bank_operating', v_bank,
                'cash_and_clearing', v_cash,
                'accounts_receivable', v_ar,
                'inventory_finished_goods', v_inv,
                'consignment_inventory', v_consign_inv,
                'gst_input_tax_credit', v_input_gst,
                'total_assets', v_total_assets
            ),
            'liabilities', jsonb_build_object(
                'accounts_payable', v_ap,
                'gst_output_tax_liability', v_output_gst,
                'total_liabilities', v_total_liabilities
            ),
            'equity', jsonb_build_object(
                'share_capital', v_equity_capital,
                'retained_earnings', v_retained_earnings,
                'current_period_profit', v_net_profit,
                'total_equity', v_total_equity
            ),
            'total_liabilities_and_equity', v_total_liabilities + v_total_equity,
            'variance', v_bs_variance,
            'is_balanced', (v_bs_variance = 0.00)
        );

    -- -------------------------------------------------------------------------
    -- STATEMENT 3: GST RECONCILIATION SUMMARY (Output Tax vs Input ITC)
    -- -------------------------------------------------------------------------
    ELSIF p_statement_type = 'GST_RECONCILIATION' THEN
        SELECT 
            COALESCE(SUM(CASE WHEN c.account_number = '2210' THEN l.credit_amount - l.debit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '2220' THEN l.credit_amount - l.debit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '2230' THEN l.credit_amount - l.debit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '1210' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '1220' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN c.account_number = '1230' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0.00)
        INTO 
            v_cgst_out, v_sgst_out, v_igst_out, v_cgst_in, v_sgst_in, v_igst_in
        FROM public.journal_entry_lines l
        JOIN public.journal_entries j ON l.journal_entry_id = j.id
        JOIN public.chart_of_accounts c ON l.account_id = c.id
        WHERE j.entry_date BETWEEN p_start_date AND p_end_date
          AND j.status = 'POSTED';

        v_net_gst_payable := (v_cgst_out + v_sgst_out + v_igst_out) - (v_cgst_in + v_sgst_in + v_igst_in);

        RETURN jsonb_build_object(
            'statement_type', 'GST_RECONCILIATION',
            'start_date', p_start_date,
            'end_date', p_end_date,
            'output_gst_liability', jsonb_build_object(
                'cgst_output', v_cgst_out,
                'sgst_output', v_sgst_out,
                'igst_output', v_igst_out,
                'total_output_gst', v_cgst_out + v_sgst_out + v_igst_out
            ),
            'input_gst_itc', jsonb_build_object(
                'cgst_itc', v_cgst_in,
                'sgst_itc', v_sgst_in,
                'igst_itc', v_igst_in,
                'total_input_itc', v_cgst_in + v_sgst_in + v_igst_in
            ),
            'net_gst_payable', v_net_gst_payable
        );

    ELSE
        RAISE EXCEPTION 'Unknown financial statement type: %. Supported types: PROFIT_AND_LOSS, BALANCE_SHEET, GST_RECONCILIATION.', p_statement_type;
    END IF;
END;
$$;

-- =============================================================================
-- 19. RPC: fn_close_accounting_period (Month-End Close & Hardened Lock Governance)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_close_accounting_period(
    p_period_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_period RECORD;
    v_tb JSONB;
    v_unposted_cnt INT;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'finance')
        ) THEN
            RAISE EXCEPTION 'Access denied: Only Finance and Administrative roles may close accounting periods.';
        END IF;
    END IF;

    SELECT * INTO v_period FROM public.accounting_periods WHERE id = p_period_id;
    IF v_period.id IS NULL THEN
        RAISE EXCEPTION 'Accounting period % not found.', p_period_id;
    END IF;

    IF v_period.status = 'LOCKED' THEN
        RAISE EXCEPTION 'Accounting period % is already LOCKED.', v_period.period_name;
    END IF;

    -- 1. Check for draft or unposted journal entries
    SELECT COUNT(*) INTO v_unposted_cnt
    FROM public.journal_entries
    WHERE accounting_period_id = p_period_id AND status = 'DRAFT';

    IF v_unposted_cnt > 0 THEN
        RAISE EXCEPTION 'Cannot close period %: % draft journal entries remain unposted.', v_period.period_name, v_unposted_cnt;
    END IF;

    -- 2. Audit Trial Balance equality
    v_tb := public.fn_generate_trial_balance(p_period_id);
    IF (v_tb->>'is_balanced')::boolean = false THEN
        RAISE EXCEPTION 'Cannot close period %: Trial Balance is UNBALANCED (Variance: % INR).', v_period.period_name, v_tb->>'variance';
    END IF;

    -- 3. Transition status from OPEN -> SOFT_CLOSED -> LOCKED
    UPDATE public.accounting_periods
    SET status = 'LOCKED',
        closed_by = v_actor_id,
        closed_at = now(),
        notes = COALESCE(p_notes, 'Closed and locked by authorized financial governance audit.')
    WHERE id = p_period_id;

    RETURN jsonb_build_object(
        'success', true,
        'period_id', p_period_id,
        'period_name', v_period.period_name,
        'status', 'LOCKED',
        'trial_balance_summary', jsonb_build_object(
            'total_debit', v_tb->'total_debit',
            'total_credit', v_tb->'total_credit',
            'is_balanced', true
        ),
        'message', 'Accounting period ' || v_period.period_name || ' successfully locked. All postings finalized.'
    );
END;
$$;

-- =============================================================================
-- 20. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all 5 Phase 8.3 tables
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_account_balances ENABLE ROW LEVEL SECURITY;

-- 1. Chart of Accounts: Read allowed for internal staff; modifications restricted to finance/admin
CREATE POLICY "coa_select_internal" ON public.chart_of_accounts
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance', 'sales', 'inventory')
        )
    );

CREATE POLICY "coa_admin_write" ON public.chart_of_accounts
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- 2. Accounting Periods: Read for staff, write for finance/admin
CREATE POLICY "periods_select_staff" ON public.accounting_periods
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

CREATE POLICY "periods_admin_write" ON public.accounting_periods
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- 3. Journal Entries: Read for finance/admin/auditor; Direct browser INSERT/UPDATE denied (use RPC)
CREATE POLICY "je_select_finance" ON public.journal_entries
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- 4. Journal Entry Lines: Read for finance/admin/auditor; Direct browser mutations denied
CREATE POLICY "jel_select_finance" ON public.journal_entry_lines
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- 5. GL Account Balances: Read for finance/admin
CREATE POLICY "gl_balances_select_finance" ON public.gl_account_balances
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- Prevent unauthorized and anonymous mutations across all GL tables
REVOKE ALL ON public.chart_of_accounts FROM anon;
REVOKE ALL ON public.accounting_periods FROM anon;
REVOKE ALL ON public.journal_entries FROM anon;
REVOKE ALL ON public.journal_entry_lines FROM anon;
REVOKE ALL ON public.gl_account_balances FROM anon;

-- Grant execution of SECURITY DEFINER functions to authenticated users
GRANT EXECUTE ON FUNCTION public.fn_post_journal_entry(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_auto_journalize_sales_invoice(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_auto_journalize_ar_payment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_auto_journalize_vendor_invoice(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_auto_journalize_vendor_payment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_auto_journalize_consignment_settlement(UUID, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_auto_journalize_warranty_settlement(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_auto_journalize_bad_debt_write_off(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_trial_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_financial_statement(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_close_accounting_period(UUID, TEXT) TO authenticated;
