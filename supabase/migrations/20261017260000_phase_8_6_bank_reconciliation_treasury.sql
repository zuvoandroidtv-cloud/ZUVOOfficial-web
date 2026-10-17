-- =============================================================================
-- ZUVO TV CRM — PHASE 8.6 MIGRATION
-- Enterprise Bank Reconciliation Statement (BRS), Multi-Account Electronic Statement Feeds & Corporate Treasury Clearing Engine
-- Target Environment: Supabase PostgreSQL
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. SEQUENCES FOR CONCURRENCY-SAFE BATCH & RECONCILIATION NUMBERING
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_bank_statement_batch_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_bank_reconciliation_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 2. TABLE: public.bank_accounts
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    bank_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    masked_account_number TEXT NOT NULL, -- e.g. 'XXXX-XXXX-4589' (strictly masked)
    ifsc TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('CURRENT', 'ESCROW', 'CASH_CREDIT', 'OTHER')),
    gl_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
    opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    current_book_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    statement_date DATE,
    currency TEXT NOT NULL DEFAULT 'INR',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_bank_account_mask UNIQUE (tenant_id, bank_name, masked_account_number)
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant ON public.bank_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_gl_acc ON public.bank_accounts(gl_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_type ON public.bank_accounts(account_type);

-- =============================================================================
-- 3. TABLE: public.bank_statement_batches
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bank_statement_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    batch_number TEXT NOT NULL UNIQUE,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
    statement_start_date DATE NOT NULL,
    statement_end_date DATE NOT NULL,
    opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    closing_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_deposits NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_deposits >= 0),
    total_withdrawals NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_withdrawals >= 0),
    source_format TEXT NOT NULL CHECK (source_format IN ('CSV', 'JSON', 'MT940')),
    source_file_hash TEXT NOT NULL, -- duplicate file prevention hash
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'UPLOADED' CHECK (
        status IN ('UPLOADED', 'VALIDATED', 'MATCHING', 'MATCHED', 'RECONCILED', 'REJECTED')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_bank_batch_hash UNIQUE (bank_account_id, source_file_hash),
    CONSTRAINT chk_batch_date_order CHECK (statement_end_date >= statement_start_date),
    CONSTRAINT chk_batch_math_integrity CHECK (
        round(closing_balance, 2) = round(opening_balance + total_deposits - total_withdrawals, 2)
    )
);

CREATE INDEX IF NOT EXISTS idx_bank_batches_account ON public.bank_statement_batches(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_batches_status ON public.bank_statement_batches(status);
CREATE INDEX IF NOT EXISTS idx_bank_batches_dates ON public.bank_statement_batches(statement_start_date, statement_end_date);

-- =============================================================================
-- 4. TABLE: public.bank_statement_lines
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.bank_statement_batches(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
    transaction_date DATE NOT NULL,
    value_date DATE NOT NULL,
    description TEXT NOT NULL,
    reference_number TEXT,
    utr_number TEXT,
    cheque_number TEXT,
    withdrawal_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (withdrawal_amount >= 0),
    deposit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (deposit_amount >= 0),
    running_balance NUMERIC(15, 2) NOT NULL,
    matching_status TEXT NOT NULL DEFAULT 'UNMATCHED' CHECK (
        matching_status IN ('UNMATCHED', 'AUTO_MATCHED', 'MANUALLY_MATCHED', 'CLEARED', 'RECONCILED')
    ),
    matched_journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    matched_payment_receipt_id UUID REFERENCES public.payment_receipts_unallocated(id) ON DELETE SET NULL,
    matched_rule TEXT, -- e.g. EXACT_UTR, EXACT_CHEQUE, EXACT_REF, DATE_AMOUNT, MANUAL
    match_confidence NUMERIC(5, 2), -- 100.00 for exact, 80.00+ for date/ref
    matched_at TIMESTAMPTZ,
    matched_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Invariants: cannot have both deposit and withdrawal positive
    CONSTRAINT chk_bank_line_deposit_or_withdrawal CHECK (
        NOT (withdrawal_amount > 0 AND deposit_amount > 0)
    ),
    -- Must have non-zero movement
    CONSTRAINT chk_bank_line_has_movement CHECK (
        withdrawal_amount > 0 OR deposit_amount > 0
    )
);

CREATE INDEX IF NOT EXISTS idx_bank_lines_batch ON public.bank_statement_lines(batch_id);
CREATE INDEX IF NOT EXISTS idx_bank_lines_account ON public.bank_statement_lines(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_lines_utr ON public.bank_statement_lines(utr_number);
CREATE INDEX IF NOT EXISTS idx_bank_lines_cheque ON public.bank_statement_lines(cheque_number);
CREATE INDEX IF NOT EXISTS idx_bank_lines_status ON public.bank_statement_lines(matching_status);
CREATE INDEX IF NOT EXISTS idx_bank_lines_tx_date ON public.bank_statement_lines(transaction_date);

-- =============================================================================
-- 5. TABLE: public.bank_reconciliation_records
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bank_reconciliation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'ZUVO_MAIN',
    reconciliation_number TEXT NOT NULL UNIQUE,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
    accounting_period_id UUID NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    statement_batch_id UUID REFERENCES public.bank_statement_batches(id) ON DELETE RESTRICT,
    gl_book_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    bank_statement_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    uncredited_deposits NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    unpresented_disbursements NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    direct_bank_adjustments NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    adjusted_book_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    variance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'VARIANCE' CHECK (
        status IN ('BALANCED', 'VARIANCE', 'RECONCILED', 'LOCKED')
    ),
    prepared_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reconciled_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_bank_rec_account_period UNIQUE (bank_account_id, accounting_period_id),
    CONSTRAINT chk_adjusted_balance_math CHECK (
        round(adjusted_book_balance, 2) = round(gl_book_balance + uncredited_deposits - unpresented_disbursements + direct_bank_adjustments, 2)
    ),
    CONSTRAINT chk_variance_math CHECK (
        round(variance, 2) = round(abs(adjusted_book_balance - bank_statement_balance), 2)
    )
);

CREATE INDEX IF NOT EXISTS idx_bank_rec_account ON public.bank_reconciliation_records(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_rec_period ON public.bank_reconciliation_records(accounting_period_id);
CREATE INDEX IF NOT EXISTS idx_bank_rec_status ON public.bank_reconciliation_records(status);

-- =============================================================================
-- 6. TABLE: public.bank_reconciliation_items
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bank_reconciliation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL REFERENCES public.bank_reconciliation_records(id) ON DELETE CASCADE,
    statement_line_id UUID REFERENCES public.bank_statement_lines(id) ON DELETE SET NULL,
    item_type TEXT NOT NULL CHECK (
        item_type IN (
            'UNCREDITED_DEPOSIT',
            'UNPRESENTED_CHEQUE',
            'BANK_CHARGE',
            'BANK_INTEREST',
            'DISHONOUR',
            'CHARGEBACK',
            'OTHER_ADJUSTMENT'
        )
    ),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    source_reference TEXT,
    gl_posted BOOLEAN NOT NULL DEFAULT false,
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'POSTED', 'RESOLVED', 'REVERSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bank_rec_items_rec_id ON public.bank_reconciliation_items(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_bank_rec_items_type ON public.bank_reconciliation_items(item_type);
CREATE INDEX IF NOT EXISTS idx_bank_rec_items_line ON public.bank_reconciliation_items(statement_line_id);

-- =============================================================================
-- 7. SEED CORPORATE TREASURY BANK ACCOUNTS
-- =============================================================================
DO $$
DECLARE
    v_gl_1010 UUID;
    v_gl_1020 UUID;
BEGIN
    SELECT id INTO v_gl_1010 FROM public.chart_of_accounts WHERE account_number = '1010';
    SELECT id INTO v_gl_1020 FROM public.chart_of_accounts WHERE account_number = '1020';

    IF v_gl_1010 IS NOT NULL THEN
        INSERT INTO public.bank_accounts (
            tenant_id, bank_name, account_name, masked_account_number, ifsc, account_type, gl_account_id, opening_balance, current_book_balance
        ) VALUES (
            'ZUVO_MAIN', 'HDFC Bank', 'ZUVO Operational Current Account', 'XXXX-XXXX-4589', 'HDFC0001234', 'CURRENT', v_gl_1010, 0.00, 0.00
        ) ON CONFLICT (tenant_id, bank_name, masked_account_number) DO NOTHING;

        INSERT INTO public.bank_accounts (
            tenant_id, bank_name, account_name, masked_account_number, ifsc, account_type, gl_account_id, opening_balance, current_book_balance
        ) VALUES (
            'ZUVO_MAIN', 'ICICI Bank', 'ZUVO Dealer Escrow & Security Pool', 'XXXX-XXXX-8821', 'ICIC0005678', 'ESCROW', v_gl_1010, 0.00, 0.00
        ) ON CONFLICT (tenant_id, bank_name, masked_account_number) DO NOTHING;
    END IF;
END;
$$;

-- =============================================================================
-- 8. RPC 1: fn_ingest_bank_statement_feed
-- Ingests multi-format bank statement feeds with strict balance validations
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_ingest_bank_statement_feed(
    p_account_id UUID,
    p_statement_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_bank_acc RECORD;
    v_batch_id UUID;
    v_batch_num TEXT;
    v_start_date DATE;
    v_end_date DATE;
    v_open_bal NUMERIC(15, 2);
    v_close_bal NUMERIC(15, 2);
    v_format TEXT;
    v_hash TEXT;
    v_lines JSONB;
    v_line JSONB;
    v_tot_dep NUMERIC(15, 2) := 0.00;
    v_tot_wdr NUMERIC(15, 2) := 0.00;
    v_line_dep NUMERIC(15, 2);
    v_line_wdr NUMERIC(15, 2);
    v_curr_running_bal NUMERIC(15, 2);
    v_line_running_bal NUMERIC(15, 2);
    v_tx_date DATE;
    v_val_date DATE;
    v_line_desc TEXT;
    v_ref TEXT;
    v_utr TEXT;
    v_chq TEXT;
    v_line_cnt INT := 0;
BEGIN
    -- 1. Authorization check
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'finance')
        ) THEN
            RAISE EXCEPTION 'Unauthorized: only finance and administration roles can ingest bank statements.';
        END IF;
    END IF;

    -- 2. Validate Bank Account
    SELECT * INTO v_bank_acc FROM public.bank_accounts WHERE id = p_account_id;
    IF v_bank_acc.id IS NULL THEN
        RAISE EXCEPTION 'Bank account % not found.', p_account_id;
    END IF;
    IF NOT v_bank_acc.is_active THEN
        RAISE EXCEPTION 'Bank account % is inactive.', v_bank_acc.account_name;
    END IF;

    -- 3. Parse and Validate Batch Header
    v_start_date := (p_statement_data->>'start_date')::date;
    v_end_date := (p_statement_data->>'end_date')::date;
    v_open_bal := round(COALESCE((p_statement_data->>'opening_balance')::numeric, 0.00), 2);
    v_close_bal := round(COALESCE((p_statement_data->>'closing_balance')::numeric, 0.00), 2);
    v_format := UPPER(COALESCE(p_statement_data->>'source_format', 'CSV'));
    v_hash := p_statement_data->>'source_file_hash';
    v_lines := p_statement_data->'lines';

    IF v_start_date IS NULL OR v_end_date IS NULL THEN
        RAISE EXCEPTION 'Statement start_date and end_date are required.';
    END IF;
    IF v_end_date < v_start_date THEN
        RAISE EXCEPTION 'Statement end_date cannot precede start_date.';
    END IF;
    IF v_format NOT IN ('CSV', 'JSON', 'MT940') THEN
        RAISE EXCEPTION 'Invalid source format: % (expected CSV, JSON, or MT940)', v_format;
    END IF;
    IF v_hash IS NULL OR length(trim(v_hash)) = 0 THEN
        v_hash := md5(p_account_id::text || v_start_date::text || v_end_date::text || v_open_bal::text || v_close_bal::text || COALESCE(v_lines::text, ''));
    END IF;

    -- Duplicate file protection
    IF EXISTS (SELECT 1 FROM public.bank_statement_batches WHERE bank_account_id = p_account_id AND source_file_hash = v_hash) THEN
        RAISE EXCEPTION 'Duplicate statement detected with hash % for account %.', v_hash, v_bank_acc.account_name;
    END IF;

    IF v_lines IS NULL OR jsonb_array_length(v_lines) = 0 THEN
        RAISE EXCEPTION 'Statement must contain at least one valid statement line.';
    END IF;

    -- 4. Pre-validate lines and verify running balances
    v_curr_running_bal := v_open_bal;
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
        v_line_dep := round(COALESCE((v_line->>'deposit_amount')::numeric, 0.00), 2);
        v_line_wdr := round(COALESCE((v_line->>'withdrawal_amount')::numeric, 0.00), 2);
        v_line_running_bal := round((v_line->>'running_balance')::numeric, 2);

        IF v_line_dep < 0 OR v_line_wdr < 0 THEN
            RAISE EXCEPTION 'Amounts cannot be negative in statement feed.';
        END IF;
        IF v_line_dep > 0 AND v_line_wdr > 0 THEN
            RAISE EXCEPTION 'Statement line cannot have both deposit and withdrawal amounts.';
        END IF;
        IF v_line_dep = 0 AND v_line_wdr = 0 THEN
            RAISE EXCEPTION 'Statement line must have either deposit or withdrawal greater than zero.';
        END IF;

        v_curr_running_bal := round(v_curr_running_bal + v_line_dep - v_line_wdr, 2);

        IF v_line_running_bal IS NOT NULL AND v_line_running_bal <> v_curr_running_bal THEN
            RAISE EXCEPTION 'Mathematical running balance inconsistency detected at line %: stated %, calculated %',
                v_line_cnt + 1, v_line_running_bal, v_curr_running_bal;
        END IF;

        v_tot_dep := round(v_tot_dep + v_line_dep, 2);
        v_tot_wdr := round(v_tot_wdr + v_line_wdr, 2);
        v_line_cnt := v_line_cnt + 1;
    END LOOP;

    -- Validate calculated closing balance matches statement header
    IF round(v_open_bal + v_tot_dep - v_tot_wdr, 2) <> v_close_bal THEN
        RAISE EXCEPTION 'Closing balance mismatch: stated %, calculated % (opening % + dep % - wdr %)',
            v_close_bal, round(v_open_bal + v_tot_dep - v_tot_wdr, 2), v_open_bal, v_tot_dep, v_tot_wdr;
    END IF;

    -- 5. Create Batch Record
    v_batch_num := 'BNK-BATCH-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(nextval('public.seq_bank_statement_batch_number')::text, 4, '0');
    
    INSERT INTO public.bank_statement_batches (
        tenant_id, batch_number, bank_account_id, statement_start_date, statement_end_date,
        opening_balance, closing_balance, total_deposits, total_withdrawals,
        source_format, source_file_hash, uploaded_by, status
    ) VALUES (
        v_bank_acc.tenant_id, v_batch_num, p_account_id, v_start_date, v_end_date,
        v_open_bal, v_close_bal, v_tot_dep, v_tot_wdr,
        v_format, v_hash, v_actor_id, 'VALIDATED'
    ) RETURNING id INTO v_batch_id;

    -- 6. Insert Statement Lines
    v_curr_running_bal := v_open_bal;
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
        v_line_dep := round(COALESCE((v_line->>'deposit_amount')::numeric, 0.00), 2);
        v_line_wdr := round(COALESCE((v_line->>'withdrawal_amount')::numeric, 0.00), 2);
        v_curr_running_bal := round(v_curr_running_bal + v_line_dep - v_line_wdr, 2);

        v_tx_date := COALESCE((v_line->>'transaction_date')::date, v_start_date);
        v_val_date := COALESCE((v_line->>'value_date')::date, v_tx_date);
        v_line_desc := COALESCE(v_line->>'description', 'Bank Transaction');
        v_ref := v_line->>'reference_number';
        v_utr := v_line->>'utr_number';
        v_chq := v_line->>'cheque_number';

        INSERT INTO public.bank_statement_lines (
            batch_id, bank_account_id, transaction_date, value_date,
            description, reference_number, utr_number, cheque_number,
            withdrawal_amount, deposit_amount, running_balance, matching_status
        ) VALUES (
            v_batch_id, p_account_id, v_tx_date, v_val_date,
            v_line_desc, v_ref, v_utr, v_chq,
            v_line_wdr, v_line_dep, v_curr_running_bal, 'UNMATCHED'
        );
    END LOOP;

    -- Update Bank Account last statement date
    UPDATE public.bank_accounts
    SET statement_date = v_end_date, updated_at = now()
    WHERE id = p_account_id;

    -- 7. Emit Financial Audit Event
    INSERT INTO public.financial_audit_events (
        event_type, severity, entity_type, entity_id, entity_reference, event_payload, actor_id
    ) VALUES (
        'BANK_STATEMENT_INGESTED', 'INFO', 'BANK_STATEMENT_BATCH', v_batch_id, v_batch_num,
        jsonb_build_object(
            'bank_account_id', p_account_id,
            'bank_name', v_bank_acc.bank_name,
            'lines_count', v_line_cnt,
            'opening_balance', v_open_bal,
            'closing_balance', v_close_bal,
            'total_deposits', v_tot_dep,
            'total_withdrawals', v_tot_wdr,
            'source_format', v_format
        ),
        v_actor_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'batch_id', v_batch_id,
        'batch_number', v_batch_num,
        'lines_ingested', v_line_cnt,
        'total_deposits', v_tot_dep,
        'total_withdrawals', v_tot_wdr,
        'closing_balance', v_close_bal,
        'status', 'VALIDATED'
    );
END;
$$;

-- =============================================================================
-- 9. RPC 2: fn_auto_match_bank_statement
-- Multi-tier deterministic matching algorithm: UTR -> Cheque -> Ref -> Amount+Date
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_match_bank_statement(
    p_batch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_batch RECORD;
    v_line RECORD;
    v_receipt RECORD;
    v_je RECORD;
    v_matched_count INT := 0;
    v_unmatched_count INT := 0;
    v_already_matched_count INT := 0;
BEGIN
    -- 1. Authorization check
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'finance')
        ) THEN
            RAISE EXCEPTION 'Unauthorized: only finance and administration roles can execute bank reconciliation matching.';
        END IF;
    END IF;

    -- 2. Fetch Batch
    SELECT * INTO v_batch FROM public.bank_statement_batches WHERE id = p_batch_id;
    IF v_batch.id IS NULL THEN
        RAISE EXCEPTION 'Statement batch % not found.', p_batch_id;
    END IF;

    -- Update batch status to MATCHING
    UPDATE public.bank_statement_batches SET status = 'MATCHING', updated_at = now() WHERE id = p_batch_id;

    -- 3. Loop through unmatched statement lines in this batch
    FOR v_line IN 
        SELECT * FROM public.bank_statement_lines 
        WHERE batch_id = p_batch_id
        ORDER BY transaction_date ASC, id ASC
    LOOP
        IF v_line.matching_status NOT IN ('UNMATCHED') THEN
            v_already_matched_count := v_already_matched_count + 1;
            CONTINUE;
        END IF;

        -- CASE A: DEPOSITS (Match against Phase 8.2 AR Payment Receipts)
        IF v_line.deposit_amount > 0 THEN
            -- Priority 1: Exact UTR Number Match + Exact Amount
            IF v_line.utr_number IS NOT NULL AND length(trim(v_line.utr_number)) > 0 THEN
                SELECT * INTO v_receipt 
                FROM public.payment_receipts_unallocated
                WHERE external_transaction_ref = v_line.utr_number
                  AND round(amount, 2) = round(v_line.deposit_amount, 2)
                  AND id NOT IN (
                      SELECT matched_payment_receipt_id FROM public.bank_statement_lines 
                      WHERE matched_payment_receipt_id IS NOT NULL AND id <> v_line.id
                  )
                LIMIT 1;

                IF v_receipt.id IS NOT NULL THEN
                    UPDATE public.bank_statement_lines
                    SET matching_status = 'AUTO_MATCHED',
                        matched_payment_receipt_id = v_receipt.id,
                        matched_rule = 'EXACT_UTR',
                        match_confidence = 100.00,
                        matched_at = now(),
                        matched_by = v_actor_id
                    WHERE id = v_line.id;
                    v_matched_count := v_matched_count + 1;
                    CONTINUE;
                END IF;
            END IF;

            -- Priority 2: Exact Reference / Cheque Match + Exact Amount
            IF v_line.reference_number IS NOT NULL AND length(trim(v_line.reference_number)) > 0 THEN
                SELECT * INTO v_receipt 
                FROM public.payment_receipts_unallocated
                WHERE (receipt_reference = v_line.reference_number OR external_transaction_ref = v_line.reference_number)
                  AND round(amount, 2) = round(v_line.deposit_amount, 2)
                  AND id NOT IN (
                      SELECT matched_payment_receipt_id FROM public.bank_statement_lines 
                      WHERE matched_payment_receipt_id IS NOT NULL AND id <> v_line.id
                  )
                LIMIT 1;

                IF v_receipt.id IS NOT NULL THEN
                    UPDATE public.bank_statement_lines
                    SET matching_status = 'AUTO_MATCHED',
                        matched_payment_receipt_id = v_receipt.id,
                        matched_rule = 'EXACT_REF',
                        match_confidence = 98.00,
                        matched_at = now(),
                        matched_by = v_actor_id
                    WHERE id = v_line.id;
                    v_matched_count := v_matched_count + 1;
                    CONTINUE;
                END IF;
            END IF;

            -- Priority 3: Cheque Number Match + Exact Amount
            IF v_line.cheque_number IS NOT NULL AND length(trim(v_line.cheque_number)) > 0 THEN
                SELECT * INTO v_receipt 
                FROM public.payment_receipts_unallocated
                WHERE external_transaction_ref = v_line.cheque_number
                  AND round(amount, 2) = round(v_line.deposit_amount, 2)
                  AND id NOT IN (
                      SELECT matched_payment_receipt_id FROM public.bank_statement_lines 
                      WHERE matched_payment_receipt_id IS NOT NULL AND id <> v_line.id
                  )
                LIMIT 1;

                IF v_receipt.id IS NOT NULL THEN
                    UPDATE public.bank_statement_lines
                    SET matching_status = 'AUTO_MATCHED',
                        matched_payment_receipt_id = v_receipt.id,
                        matched_rule = 'EXACT_CHEQUE',
                        match_confidence = 99.00,
                        matched_at = now(),
                        matched_by = v_actor_id
                    WHERE id = v_line.id;
                    v_matched_count := v_matched_count + 1;
                    CONTINUE;
                END IF;
            END IF;

            -- Priority 4: Exact Amount + Compatible Date Window (+/- 3 days)
            SELECT * INTO v_receipt 
            FROM public.payment_receipts_unallocated
            WHERE round(amount, 2) = round(v_line.deposit_amount, 2)
              AND received_date BETWEEN (v_line.transaction_date - INTERVAL '3 days') AND (v_line.transaction_date + INTERVAL '3 days')
              AND id NOT IN (
                  SELECT matched_payment_receipt_id FROM public.bank_statement_lines 
                  WHERE matched_payment_receipt_id IS NOT NULL AND id <> v_line.id
              )
            LIMIT 1;

            IF v_receipt.id IS NOT NULL THEN
                UPDATE public.bank_statement_lines
                SET matching_status = 'AUTO_MATCHED',
                    matched_payment_receipt_id = v_receipt.id,
                    matched_rule = 'DATE_AMOUNT_WINDOW',
                    match_confidence = 90.00,
                    matched_at = now(),
                    matched_by = v_actor_id
                WHERE id = v_line.id;
                v_matched_count := v_matched_count + 1;
                CONTINUE;
            END IF;

            -- Priority 5: Controlled Safe Description Reference match (contains receipt_reference)
            SELECT * INTO v_receipt
            FROM public.payment_receipts_unallocated
            WHERE round(amount, 2) = round(v_line.deposit_amount, 2)
              AND length(receipt_reference) >= 6
              AND v_line.description ILIKE '%' || receipt_reference || '%'
              AND id NOT IN (
                  SELECT matched_payment_receipt_id FROM public.bank_statement_lines 
                  WHERE matched_payment_receipt_id IS NOT NULL AND id <> v_line.id
              )
            LIMIT 1;

            IF v_receipt.id IS NOT NULL THEN
                UPDATE public.bank_statement_lines
                SET matching_status = 'AUTO_MATCHED',
                    matched_payment_receipt_id = v_receipt.id,
                    matched_rule = 'CONTROLLED_FUZZY_REF',
                    match_confidence = 85.00,
                    matched_at = now(),
                    matched_by = v_actor_id
                WHERE id = v_line.id;
                v_matched_count := v_matched_count + 1;
                CONTINUE;
            END IF;

        -- CASE B: WITHDRAWALS (Match against Phase 8.0/8.3 AP Vendor Payments / GL Disbursements)
        ELSIF v_line.withdrawal_amount > 0 THEN
            -- Check GL Journal Entries of type 'AP_PAYMENT' or disbursements crediting Bank Account (1010)
            -- Priority 1: Exact Cheque / Reference in JE Narration or lines
            IF v_line.cheque_number IS NOT NULL AND length(trim(v_line.cheque_number)) > 0 THEN
                SELECT je.* INTO v_je
                FROM public.journal_entries je
                JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
                JOIN public.chart_of_accounts coa ON jel.account_id = coa.id
                WHERE coa.account_number = '1010'
                  AND jel.credit_amount = v_line.withdrawal_amount
                  AND (je.narration ILIKE '%' || v_line.cheque_number || '%' OR jel.description ILIKE '%' || v_line.cheque_number || '%')
                  AND je.id NOT IN (
                      SELECT matched_journal_entry_id FROM public.bank_statement_lines
                      WHERE matched_journal_entry_id IS NOT NULL AND id <> v_line.id
                  )
                LIMIT 1;

                IF v_je.id IS NOT NULL THEN
                    UPDATE public.bank_statement_lines
                    SET matching_status = 'AUTO_MATCHED',
                        matched_journal_entry_id = v_je.id,
                        matched_rule = 'EXACT_CHEQUE',
                        match_confidence = 99.00,
                        matched_at = now(),
                        matched_by = v_actor_id
                    WHERE id = v_line.id;
                    v_matched_count := v_matched_count + 1;
                    CONTINUE;
                END IF;
            END IF;

            -- Priority 2: Exact Reference / UTR
            IF (v_line.utr_number IS NOT NULL AND length(trim(v_line.utr_number)) > 0) OR (v_line.reference_number IS NOT NULL AND length(trim(v_line.reference_number)) > 0) THEN
                SELECT je.* INTO v_je
                FROM public.journal_entries je
                JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
                JOIN public.chart_of_accounts coa ON jel.account_id = coa.id
                WHERE coa.account_number = '1010'
                  AND jel.credit_amount = v_line.withdrawal_amount
                  AND (
                      (v_line.utr_number IS NOT NULL AND je.narration ILIKE '%' || v_line.utr_number || '%') OR
                      (v_line.reference_number IS NOT NULL AND je.narration ILIKE '%' || v_line.reference_number || '%')
                  )
                  AND je.id NOT IN (
                      SELECT matched_journal_entry_id FROM public.bank_statement_lines
                      WHERE matched_journal_entry_id IS NOT NULL AND id <> v_line.id
                  )
                LIMIT 1;

                IF v_je.id IS NOT NULL THEN
                    UPDATE public.bank_statement_lines
                    SET matching_status = 'AUTO_MATCHED',
                        matched_journal_entry_id = v_je.id,
                        matched_rule = 'EXACT_REF',
                        match_confidence = 95.00,
                        matched_at = now(),
                        matched_by = v_actor_id
                    WHERE id = v_line.id;
                    v_matched_count := v_matched_count + 1;
                    CONTINUE;
                END IF;
            END IF;

            -- Priority 3: Exact Amount + Compatible Date Window (+/- 4 days)
            SELECT je.* INTO v_je
            FROM public.journal_entries je
            JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
            JOIN public.chart_of_accounts coa ON jel.account_id = coa.id
            WHERE coa.account_number = '1010'
              AND jel.credit_amount = v_line.withdrawal_amount
              AND je.entry_date BETWEEN (v_line.transaction_date - INTERVAL '4 days') AND (v_line.transaction_date + INTERVAL '4 days')
              AND je.id NOT IN (
                  SELECT matched_journal_entry_id FROM public.bank_statement_lines
                  WHERE matched_journal_entry_id IS NOT NULL AND id <> v_line.id
              )
            LIMIT 1;

            IF v_je.id IS NOT NULL THEN
                UPDATE public.bank_statement_lines
                SET matching_status = 'AUTO_MATCHED',
                    matched_journal_entry_id = v_je.id,
                    matched_rule = 'DATE_AMOUNT_WINDOW',
                    match_confidence = 90.00,
                    matched_at = now(),
                    matched_by = v_actor_id
                WHERE id = v_line.id;
                v_matched_count := v_matched_count + 1;
                CONTINUE;
            END IF;
        END IF;

        -- Unmatched line
        v_unmatched_count := v_unmatched_count + 1;
    END LOOP;

    -- Update batch overall status
    UPDATE public.bank_statement_batches
    SET status = CASE WHEN v_unmatched_count = 0 THEN 'MATCHED' ELSE 'VALIDATED' END,
        updated_at = now()
    WHERE id = p_batch_id;

    -- Emit Financial Audit Event
    INSERT INTO public.financial_audit_events (
        event_type, severity, entity_type, entity_id, entity_reference, event_payload, actor_id
    ) VALUES (
        'BANK_AUTO_MATCH_COMPLETED', 'INFO', 'BANK_STATEMENT_BATCH', p_batch_id, v_batch.batch_number,
        jsonb_build_object(
            'newly_matched', v_matched_count,
            'remaining_unmatched', v_unmatched_count,
            'previously_matched', v_already_matched_count
        ),
        v_actor_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'batch_id', p_batch_id,
        'batch_number', v_batch.batch_number,
        'matched_count', v_matched_count,
        'unmatched_count', v_unmatched_count,
        'status', CASE WHEN v_unmatched_count = 0 THEN 'MATCHED' ELSE 'VALIDATED' END
    );
END;
$$;

-- =============================================================================
-- 10. RPC 3: fn_post_direct_bank_transaction
-- Posts direct bank adjustments (bank charges, interest, fees, dishonours) to GL
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_post_direct_bank_transaction(
    p_statement_line_id UUID,
    p_gl_account_id UUID,
    p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_line RECORD;
    v_bank_acc RECORD;
    v_target_acc RECORD;
    v_bank_gl_id UUID;
    v_je_result JSONB;
    v_je_id UUID;
    v_lines JSONB := '[]'::jsonb;
    v_amount NUMERIC(15, 2);
    v_is_deposit BOOLEAN;
BEGIN
    -- 1. Authorization check
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'finance')
        ) THEN
            RAISE EXCEPTION 'Unauthorized: only finance and administration roles can post direct bank transactions.';
        END IF;
    END IF;

    -- 2. Fetch Statement Line
    SELECT * INTO v_line FROM public.bank_statement_lines WHERE id = p_statement_line_id FOR UPDATE;
    IF v_line.id IS NULL THEN
        RAISE EXCEPTION 'Bank statement line % not found.', p_statement_line_id;
    END IF;
    IF v_line.matching_status IN ('CLEARED', 'RECONCILED') THEN
        RAISE EXCEPTION 'Statement line % is already reconciled and locked.', p_statement_line_id;
    END IF;
    IF v_line.matched_journal_entry_id IS NOT NULL THEN
        RAISE EXCEPTION 'Statement line % is already matched to journal entry %.', p_statement_line_id, v_line.matched_journal_entry_id;
    END IF;

    -- 3. Fetch Bank Account and target GL account
    SELECT * INTO v_bank_acc FROM public.bank_accounts WHERE id = v_line.bank_account_id;
    v_bank_gl_id := v_bank_acc.gl_account_id;

    IF v_bank_gl_id IS NULL THEN
        SELECT id INTO v_bank_gl_id FROM public.chart_of_accounts WHERE account_number = '1010';
    END IF;

    SELECT * INTO v_target_acc FROM public.chart_of_accounts WHERE id = p_gl_account_id;
    IF v_target_acc.id IS NULL THEN
        RAISE EXCEPTION 'Target GL account % not found.', p_gl_account_id;
    END IF;

    -- 4. Determine direction
    IF v_line.withdrawal_amount > 0 THEN
        v_amount := v_line.withdrawal_amount;
        v_is_deposit := false;

        -- Bank Charge / Expense / Withdrawal:
        -- DEBIT target expense/liability account
        -- CREDIT bank account
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_target_acc.id,
            'debit_amount', v_amount,
            'credit_amount', 0.00,
            'description', COALESCE(p_description, v_line.description)
        );
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_bank_gl_id,
            'debit_amount', 0.00,
            'credit_amount', v_amount,
            'description', 'Direct bank settlement: ' || v_bank_acc.bank_name
        );
    ELSE
        v_amount := v_line.deposit_amount;
        v_is_deposit := true;

        -- Bank Interest / Income / Direct Deposit:
        -- DEBIT bank account
        -- CREDIT target income/asset account
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_bank_gl_id,
            'debit_amount', v_amount,
            'credit_amount', 0.00,
            'description', 'Direct bank receipt: ' || v_bank_acc.bank_name
        );
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_target_acc.id,
            'debit_amount', 0.00,
            'credit_amount', v_amount,
            'description', COALESCE(p_description, v_line.description)
        );
    END IF;

    -- 5. Post Journal Entry via Phase 8.3 fn_post_journal_entry
    v_je_result := public.fn_post_journal_entry(
        jsonb_build_object(
            'entry_date', v_line.transaction_date,
            'source_document_type', 'BANK_ADJUSTMENT',
            'source_document_reference_id', v_line.id,
            'narration', 'Direct Bank Adjustment: ' || COALESCE(p_description, v_line.description),
            'lines', v_lines
        )
    );

    IF NOT COALESCE((v_je_result->>'success')::boolean, false) THEN
        RAISE EXCEPTION 'Failed to post direct bank journal entry: %', v_je_result->>'error';
    END IF;

    v_je_id := (v_je_result->>'journal_entry_id')::uuid;

    -- 6. Update Statement Line to CLEARED
    UPDATE public.bank_statement_lines
    SET matching_status = 'CLEARED',
        matched_journal_entry_id = v_je_id,
        matched_rule = 'DIRECT_ADJUSTMENT_POSTED',
        match_confidence = 100.00,
        matched_at = now(),
        matched_by = v_actor_id
    WHERE id = p_statement_line_id;

    -- 7. Emit Financial Audit Event
    INSERT INTO public.financial_audit_events (
        event_type, severity, entity_type, entity_id, entity_reference, event_payload, actor_id
    ) VALUES (
        'DIRECT_BANK_ADJUSTMENT_POSTED', 'INFO', 'BANK_STATEMENT_LINE', p_statement_line_id, v_line.reference_number,
        jsonb_build_object(
            'journal_entry_id', v_je_id,
            'journal_number', v_je_result->>'entry_number',
            'amount', v_amount,
            'gl_account_number', v_target_acc.account_number,
            'is_deposit', v_is_deposit
        ),
        v_actor_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'statement_line_id', p_statement_line_id,
        'journal_entry_id', v_je_id,
        'journal_number', v_je_result->>'entry_number',
        'matching_status', 'CLEARED',
        'amount', v_amount
    );
END;
$$;

-- =============================================================================
-- 11. RPC 4: fn_generate_bank_reconciliation_statement
-- Authoritative Statutory BRS calculation and storage
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_generate_bank_reconciliation_statement(
    p_account_id UUID,
    p_period_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_bank_acc RECORD;
    v_period RECORD;
    v_batch RECORD;
    v_gl_balance NUMERIC(15, 2) := 0.00;
    v_bank_balance NUMERIC(15, 2) := 0.00;
    v_uncredited_deposits NUMERIC(15, 2) := 0.00;
    v_unpresented_disbursements NUMERIC(15, 2) := 0.00;
    v_direct_adjustments NUMERIC(15, 2) := 0.00;
    v_adj_book_balance NUMERIC(15, 2) := 0.00;
    v_variance NUMERIC(15, 2) := 0.00;
    v_status TEXT;
    v_rec_id UUID;
    v_rec_num TEXT;
    v_bank_gl_id UUID;
    v_rec RECORD;
    v_line RECORD;
    v_item_cnt INT := 0;
BEGIN
    -- 1. Authorization check
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'finance')
        ) THEN
            RAISE EXCEPTION 'Unauthorized: only finance and administration roles can generate BRS.';
        END IF;
    END IF;

    -- 2. Validate Bank Account and Period
    SELECT * INTO v_bank_acc FROM public.bank_accounts WHERE id = p_account_id;
    IF v_bank_acc.id IS NULL THEN
        RAISE EXCEPTION 'Bank account % not found.', p_account_id;
    END IF;

    SELECT * INTO v_period FROM public.accounting_periods WHERE id = p_period_id;
    IF v_period.id IS NULL THEN
        RAISE EXCEPTION 'Accounting period % not found.', p_period_id;
    END IF;

    -- Check if already locked
    SELECT * INTO v_rec FROM public.bank_reconciliation_records 
    WHERE bank_account_id = p_account_id AND accounting_period_id = p_period_id;

    IF v_rec.id IS NOT NULL AND v_rec.status = 'LOCKED' THEN
        RAISE EXCEPTION 'Bank reconciliation for % in period % is LOCKED and immutable.', v_bank_acc.account_name, v_period.period_name;
    END IF;

    -- 3. Calculate GL Book Balance for this bank account (account 1010 or specific gl_account_id)
    v_bank_gl_id := COALESCE(v_bank_acc.gl_account_id, (SELECT id FROM public.chart_of_accounts WHERE account_number = '1010'));

    SELECT round(COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0.00), 2) INTO v_gl_balance
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON jel.journal_entry_id = je.id
    WHERE jel.account_id = v_bank_gl_id
      AND je.entry_date <= v_period.end_date
      AND je.status = 'POSTED';

    -- Update account current_book_balance
    UPDATE public.bank_accounts SET current_book_balance = v_gl_balance, updated_at = now() WHERE id = p_account_id;

    -- 4. Get Latest Statement Batch for this account within or covering period
    SELECT * INTO v_batch 
    FROM public.bank_statement_batches
    WHERE bank_account_id = p_account_id
      AND statement_end_date <= v_period.end_date
    ORDER BY statement_end_date DESC, created_at DESC
    LIMIT 1;

    IF v_batch.id IS NOT NULL THEN
        v_bank_balance := v_batch.closing_balance;
    ELSE
        -- Fallback to statement_batch_lines or opening_balance
        v_bank_balance := v_bank_acc.opening_balance;
    END IF;

    -- 5. Calculate Reconciling Items:
    -- A. Uncredited Deposits: AR receipts deposited in GL/books but not yet cleared/matched in bank statement
    SELECT round(COALESCE(SUM(pr.remaining_amount), 0.00), 2) INTO v_uncredited_deposits
    FROM public.payment_receipts_unallocated pr
    WHERE pr.received_date <= v_period.end_date
      AND pr.status IN ('UNALLOCATED', 'PARTIALLY_ALLOCATED')
      AND pr.id NOT IN (
          SELECT matched_payment_receipt_id FROM public.bank_statement_lines
          WHERE matched_payment_receipt_id IS NOT NULL AND bank_account_id = p_account_id
      );

    -- B. Unpresented Disbursements: AP Payments/Cheques issued in GL but not presented/cleared in bank
    SELECT round(COALESCE(SUM(jel.credit_amount), 0.00), 2) INTO v_unpresented_disbursements
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON jel.journal_entry_id = je.id
    WHERE jel.account_id = v_bank_gl_id
      AND je.entry_date <= v_period.end_date
      AND je.status = 'POSTED'
      AND je.id NOT IN (
          SELECT matched_journal_entry_id FROM public.bank_statement_lines
          WHERE matched_journal_entry_id IS NOT NULL AND bank_account_id = p_account_id
      );

    -- C. Direct Bank Adjustments: Bank statement lines not yet posted to GL
    IF v_batch.id IS NOT NULL THEN
        SELECT round(COALESCE(SUM(deposit_amount - withdrawal_amount), 0.00), 2) INTO v_direct_adjustments
        FROM public.bank_statement_lines
        WHERE batch_id = v_batch.id
          AND matching_status = 'UNMATCHED';
    END IF;

    -- 6. Authoritative BRS Formula:
    -- Adjusted Book Balance = GL Book Balance + Uncredited Deposits - Unpresented Disbursements + Direct Bank Adjustments
    v_adj_book_balance := round(v_gl_balance + v_uncredited_deposits - v_unpresented_disbursements + v_direct_adjustments, 2);
    v_variance := round(abs(v_adj_book_balance - v_bank_balance), 2);

    IF v_variance = 0.00 THEN
        v_status := 'BALANCED';
    ELSE
        v_status := 'VARIANCE';
    END IF;

    -- 7. Persist Bank Reconciliation Record (Upsert)
    IF v_rec.id IS NULL THEN
        v_rec_num := 'BRS-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(nextval('public.seq_bank_reconciliation_number')::text, 4, '0');
        INSERT INTO public.bank_reconciliation_records (
            tenant_id, reconciliation_number, bank_account_id, accounting_period_id, statement_batch_id,
            gl_book_balance, bank_statement_balance, uncredited_deposits, unpresented_disbursements,
            direct_bank_adjustments, adjusted_book_balance, variance, status, prepared_by
        ) VALUES (
            v_bank_acc.tenant_id, v_rec_num, p_account_id, p_period_id, v_batch.id,
            v_gl_balance, v_bank_balance, v_uncredited_deposits, v_unpresented_disbursements,
            v_direct_adjustments, v_adj_book_balance, v_variance, v_status, v_actor_id
        ) RETURNING id INTO v_rec_id;
    ELSE
        v_rec_id := v_rec.id;
        v_rec_num := v_rec.reconciliation_number;
        UPDATE public.bank_reconciliation_records
        SET statement_batch_id = v_batch.id,
            gl_book_balance = v_gl_balance,
            bank_statement_balance = v_bank_balance,
            uncredited_deposits = v_uncredited_deposits,
            unpresented_disbursements = v_unpresented_disbursements,
            direct_bank_adjustments = v_direct_adjustments,
            adjusted_book_balance = v_adj_book_balance,
            variance = v_variance,
            status = v_status,
            prepared_by = COALESCE(prepared_by, v_actor_id),
            updated_at = now()
        WHERE id = v_rec_id;

        -- Clean up previous non-locked items to refresh
        DELETE FROM public.bank_reconciliation_items WHERE reconciliation_id = v_rec_id AND status = 'OPEN';
    END IF;

    -- 8. Populate individual reconciliation items
    -- Statement lines that are unmatched (Direct bank items / adjustments)
    IF v_batch.id IS NOT NULL THEN
        FOR v_line IN 
            SELECT * FROM public.bank_statement_lines 
            WHERE batch_id = v_batch.id AND matching_status = 'UNMATCHED'
        LOOP
            INSERT INTO public.bank_reconciliation_items (
                reconciliation_id, statement_line_id, item_type, amount, description, source_reference, gl_posted, status
            ) VALUES (
                v_rec_id, v_line.id,
                CASE 
                    WHEN v_line.withdrawal_amount > 0 AND v_line.description ILIKE '%charge%' THEN 'BANK_CHARGE'
                    WHEN v_line.deposit_amount > 0 AND v_line.description ILIKE '%interest%' THEN 'BANK_INTEREST'
                    WHEN v_line.withdrawal_amount > 0 AND (v_line.description ILIKE '%dishonour%' OR v_line.description ILIKE '%bounce%') THEN 'DISHONOUR'
                    WHEN v_line.withdrawal_amount > 0 AND v_line.description ILIKE '%chargeback%' THEN 'CHARGEBACK'
                    WHEN v_line.withdrawal_amount > 0 THEN 'UNPRESENTED_CHEQUE'
                    ELSE 'UNCREDITED_DEPOSIT'
                END,
                GREATEST(v_line.deposit_amount, v_line.withdrawal_amount),
                v_line.description, v_line.reference_number, false, 'OPEN'
            );
            v_item_cnt := v_item_cnt + 1;
        END LOOP;
    END IF;

    -- 9. Emit Financial Audit Event
    INSERT INTO public.financial_audit_events (
        event_type, severity, entity_type, entity_id, entity_reference, event_payload, actor_id
    ) VALUES (
        'BANK_RECONCILIATION_GENERATED', 
        CASE WHEN v_status = 'BALANCED' THEN 'INFO' ELSE 'WARNING' END,
        'BANK_RECONCILIATION', v_rec_id, v_rec_num,
        jsonb_build_object(
            'bank_account_id', p_account_id,
            'period_id', p_period_id,
            'gl_book_balance', v_gl_balance,
            'bank_statement_balance', v_bank_balance,
            'adjusted_book_balance', v_adj_book_balance,
            'variance', v_variance,
            'status', v_status
        ),
        v_actor_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'reconciliation_id', v_rec_id,
        'reconciliation_number', v_rec_num,
        'gl_book_balance', v_gl_balance,
        'bank_statement_balance', v_bank_balance,
        'uncredited_deposits', v_uncredited_deposits,
        'unpresented_disbursements', v_unpresented_disbursements,
        'direct_bank_adjustments', v_direct_adjustments,
        'adjusted_book_balance', v_adj_book_balance,
        'variance', v_variance,
        'status', v_status,
        'reconciling_items_count', v_item_cnt
    );
END;
$$;

-- =============================================================================
-- 12. RPC 5: fn_manually_match_bank_statement_line
-- Controlled Manual Matching and Lock/Unlock handling
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_manually_match_bank_statement_line(
    p_statement_line_id UUID,
    p_target_type TEXT, -- 'RECEIPT', 'JOURNAL_ENTRY', 'UNMATCH'
    p_target_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_line RECORD;
    v_receipt RECORD;
    v_je RECORD;
    v_batch RECORD;
BEGIN
    -- 1. Authorization check
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'finance')
        ) THEN
            RAISE EXCEPTION 'Unauthorized: only finance and administration roles can manually match bank statements.';
        END IF;
    END IF;

    -- 2. Fetch Line and Batch
    SELECT * INTO v_line FROM public.bank_statement_lines WHERE id = p_statement_line_id FOR UPDATE;
    IF v_line.id IS NULL THEN
        RAISE EXCEPTION 'Bank statement line % not found.', p_statement_line_id;
    END IF;

    SELECT * INTO v_batch FROM public.bank_statement_batches WHERE id = v_line.batch_id;
    IF v_batch.status = 'RECONCILED' THEN
        RAISE EXCEPTION 'Batch % is already locked in statutory reconciliation.', v_batch.batch_number;
    END IF;

    -- 3. Handle Actions
    IF p_target_type = 'UNMATCH' THEN
        -- Revert matching
        UPDATE public.bank_statement_lines
        SET matching_status = 'UNMATCHED',
            matched_journal_entry_id = NULL,
            matched_payment_receipt_id = NULL,
            matched_rule = NULL,
            match_confidence = NULL,
            matched_at = NULL,
            matched_by = NULL
        WHERE id = p_statement_line_id;

        -- Emit audit event
        INSERT INTO public.financial_audit_events (
            event_type, severity, entity_type, entity_id, entity_reference, event_payload, actor_id
        ) VALUES (
            'BANK_STATEMENT_LINE_UNMATCHED', 'INFO', 'BANK_STATEMENT_LINE', p_statement_line_id, v_line.reference_number,
            jsonb_build_object('unmatched_by', v_actor_id, 'reason', p_notes),
            v_actor_id
        );

        RETURN jsonb_build_object('success', true, 'action', 'UNMATCH', 'matching_status', 'UNMATCHED');

    ELSIF p_target_type = 'RECEIPT' THEN
        SELECT * INTO v_receipt FROM public.payment_receipts_unallocated WHERE id = p_target_id;
        IF v_receipt.id IS NULL THEN
            RAISE EXCEPTION 'Target payment receipt % not found.', p_target_id;
        END IF;

        -- Check double allocation
        IF EXISTS (
            SELECT 1 FROM public.bank_statement_lines 
            WHERE matched_payment_receipt_id = p_target_id AND id <> p_statement_line_id
        ) THEN
            RAISE EXCEPTION 'Target payment receipt % is already matched to another statement line.', p_target_id;
        END IF;

        -- Exact amount verification
        IF round(v_receipt.amount, 2) <> round(v_line.deposit_amount, 2) THEN
            RAISE EXCEPTION 'Amount mismatch: receipt amount % does not match deposit amount %', v_receipt.amount, v_line.deposit_amount;
        END IF;

        UPDATE public.bank_statement_lines
        SET matching_status = 'MANUALLY_MATCHED',
            matched_payment_receipt_id = p_target_id,
            matched_journal_entry_id = NULL,
            matched_rule = 'MANUAL_RECEIPT_ALLOCATION',
            match_confidence = 100.00,
            matched_at = now(),
            matched_by = v_actor_id
        WHERE id = p_statement_line_id;

        INSERT INTO public.financial_audit_events (
            event_type, severity, entity_type, entity_id, entity_reference, event_payload, actor_id
        ) VALUES (
            'BANK_STATEMENT_LINE_MANUALLY_MATCHED', 'INFO', 'BANK_STATEMENT_LINE', p_statement_line_id, v_line.reference_number,
            jsonb_build_object('target_receipt_id', p_target_id, 'notes', p_notes),
            v_actor_id
        );

        RETURN jsonb_build_object('success', true, 'action', 'MATCH_RECEIPT', 'matching_status', 'MANUALLY_MATCHED');

    ELSIF p_target_type = 'JOURNAL_ENTRY' THEN
        SELECT * INTO v_je FROM public.journal_entries WHERE id = p_target_id;
        IF v_je.id IS NULL THEN
            RAISE EXCEPTION 'Target journal entry % not found.', p_target_id;
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.bank_statement_lines 
            WHERE matched_journal_entry_id = p_target_id AND id <> p_statement_line_id
        ) THEN
            RAISE EXCEPTION 'Target journal entry % is already matched to another statement line.', p_target_id;
        END IF;

        UPDATE public.bank_statement_lines
        SET matching_status = 'MANUALLY_MATCHED',
            matched_journal_entry_id = p_target_id,
            matched_payment_receipt_id = NULL,
            matched_rule = 'MANUAL_JE_ALLOCATION',
            match_confidence = 100.00,
            matched_at = now(),
            matched_by = v_actor_id
        WHERE id = p_statement_line_id;

        INSERT INTO public.financial_audit_events (
            event_type, severity, entity_type, entity_id, entity_reference, event_payload, actor_id
        ) VALUES (
            'BANK_STATEMENT_LINE_MANUALLY_MATCHED', 'INFO', 'BANK_STATEMENT_LINE', p_statement_line_id, v_line.reference_number,
            jsonb_build_object('target_journal_entry_id', p_target_id, 'notes', p_notes),
            v_actor_id
        );

        RETURN jsonb_build_object('success', true, 'action', 'MATCH_JE', 'matching_status', 'MANUALLY_MATCHED');
    ELSE
        RAISE EXCEPTION 'Invalid target_type: % (expected RECEIPT, JOURNAL_ENTRY, or UNMATCH)', p_target_type;
    END IF;
END;
$$;

-- =============================================================================
-- 13. RPC: fn_lock_bank_reconciliation
-- Locks a balanced BRS making the period immutable
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_lock_bank_reconciliation(
    p_reconciliation_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_rec RECORD;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = v_actor_id AND r.name IN ('super_admin', 'admin', 'finance')
        ) THEN
            RAISE EXCEPTION 'Unauthorized: only finance leadership can lock BRS.';
        END IF;
    END IF;

    SELECT * INTO v_rec FROM public.bank_reconciliation_records WHERE id = p_reconciliation_id FOR UPDATE;
    IF v_rec.id IS NULL THEN
        RAISE EXCEPTION 'Reconciliation record % not found.', p_reconciliation_id;
    END IF;

    IF v_rec.status = 'LOCKED' THEN
        RAISE EXCEPTION 'Reconciliation % is already locked.', v_rec.reconciliation_number;
    END IF;

    IF v_rec.variance <> 0.00 THEN
        RAISE EXCEPTION 'Cannot lock reconciliation with non-zero variance (% remaining).', v_rec.variance;
    END IF;

    UPDATE public.bank_reconciliation_records
    SET status = 'LOCKED',
        reviewed_by = v_actor_id,
        reconciled_at = COALESCE(reconciled_at, now()),
        locked_at = now(),
        updated_at = now()
    WHERE id = p_reconciliation_id;

    -- Lock matching batch
    IF v_rec.statement_batch_id IS NOT NULL THEN
        UPDATE public.bank_statement_batches
        SET status = 'RECONCILED', updated_at = now()
        WHERE id = v_rec.statement_batch_id;

        UPDATE public.bank_statement_lines
        SET matching_status = 'RECONCILED'
        WHERE batch_id = v_rec.statement_batch_id AND matching_status IN ('AUTO_MATCHED', 'MANUALLY_MATCHED', 'CLEARED');
    END IF;

    INSERT INTO public.financial_audit_events (
        event_type, severity, entity_type, entity_id, entity_reference, event_payload, actor_id
    ) VALUES (
        'BANK_RECONCILIATION_LOCKED', 'INFO', 'BANK_RECONCILIATION', p_reconciliation_id, v_rec.reconciliation_number,
        jsonb_build_object('locked_by', v_actor_id, 'variance', v_rec.variance, 'notes', p_notes),
        v_actor_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'reconciliation_id', p_reconciliation_id,
        'reconciliation_number', v_rec.reconciliation_number,
        'status', 'LOCKED',
        'locked_at', now()
    );
END;
$$;

-- =============================================================================
-- 14. ROW-LEVEL SECURITY POLICIES
-- =============================================================================
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliation_items ENABLE ROW LEVEL SECURITY;

-- bank_accounts: Read/Write for finance & admin; read for sales (for escrow visibility)
CREATE POLICY "bank_accounts_select_finance" ON public.bank_accounts
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance', 'sales')
        )
    );

CREATE POLICY "bank_accounts_admin_write" ON public.bank_accounts
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- bank_statement_batches: Finance & Admin only
CREATE POLICY "bank_batches_finance" ON public.bank_statement_batches
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- bank_statement_lines: Finance & Admin only
CREATE POLICY "bank_lines_finance" ON public.bank_statement_lines
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- bank_reconciliation_records: Finance & Admin only
CREATE POLICY "bank_rec_records_finance" ON public.bank_reconciliation_records
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- bank_reconciliation_items: Finance & Admin only
CREATE POLICY "bank_rec_items_finance" ON public.bank_reconciliation_items
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- Revoke all permissions from anon
REVOKE ALL ON public.bank_accounts FROM anon;
REVOKE ALL ON public.bank_statement_batches FROM anon;
REVOKE ALL ON public.bank_statement_lines FROM anon;
REVOKE ALL ON public.bank_reconciliation_records FROM anon;
REVOKE ALL ON public.bank_reconciliation_items FROM anon;

-- Grant execution on RPCs to authenticated users
GRANT EXECUTE ON FUNCTION public.fn_ingest_bank_statement_feed(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_auto_match_bank_statement(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_post_direct_bank_transaction(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_bank_reconciliation_statement(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_manually_match_bank_statement_line(UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_lock_bank_reconciliation(UUID, TEXT) TO authenticated;

-- =============================================================================
-- END OF PHASE 8.6 MIGRATION
-- =============================================================================
