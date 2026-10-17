-- =============================================================================
-- ZUVO TV CRM — PHASE 8.5 ENTERPRISE FIXED ASSET REGISTER & DEPRECIATION ENGINE
-- Description: Ind AS 16 / Schedule II Fixed Asset Lifecycle, Capitalization,
--              Depreciation Schedules (SLM & WDV), Maintenance, and Disposals
-- Version: 8.5.0
-- =============================================================================

-- 1. EXTEND CHART OF ACCOUNTS FOR PROPERTY, PLANT & EQUIPMENT (PPE)
-- Group 1500s (Non-Current Assets) & Group 5300/5600s Depreciation
INSERT INTO public.chart_of_accounts 
(account_number, account_name, account_type, account_subtype, normal_balance, is_system_account, system_control_type, description)
VALUES
-- 1500s PPE Master Group & Control Accounts
('1500', 'Property, Plant & Equipment (Gross Block)', 'ASSET', 'NON_CURRENT_ASSETS', 'DEBIT', true, NULL, 'Master gross block for all capitalized equipment'),
('1510', 'Factory Machinery & Testing Equipment', 'ASSET', 'NON_CURRENT_ASSETS', 'DEBIT', true, 'FIXED_ASSET', 'Burn-in rigs, panel testing equipment, optical jigs'),
('1520', 'Depot Rework & Service Station Equipment', 'ASSET', 'NON_CURRENT_ASSETS', 'DEBIT', true, 'FIXED_ASSET', 'Soldering stations, BGA rework benches, spectrum analyzers'),
('1530', 'Warehouse & Material Handling Equipment', 'ASSET', 'NON_CURRENT_ASSETS', 'DEBIT', true, 'FIXED_ASSET', 'Electric forklifts, pallet trucks, mobile RF scanners'),
('1540', 'Technician Toolkits & Mobile Gear', 'ASSET', 'NON_CURRENT_ASSETS', 'DEBIT', true, 'FIXED_ASSET', 'Field service diagnostic multimeters, calibration sensors, repair kits'),
('1550', 'Computer, IT & Server Infrastructure', 'ASSET', 'NON_CURRENT_ASSETS', 'DEBIT', true, 'FIXED_ASSET', 'Workstations, barcode label printers, networking servers'),
('1560', 'Vehicles & Logistics Fleet', 'ASSET', 'NON_CURRENT_ASSETS', 'DEBIT', true, 'FIXED_ASSET', 'Service dispatch vans and transport vehicles'),
('1590', 'Accumulated Depreciation (Contra-Asset)', 'ASSET', 'CONTRA_ASSET', 'CREDIT', true, 'ACCUMULATED_DEPRECIATION', 'Cumulative depreciation reserve offset against gross block'),

-- 5000s Depreciation Expense & Disposal P&L
('5310', 'Depreciation Expense - Plant & Machinery', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, 'DEPRECIATION_EXPENSE', 'Monthly statutory depreciation on factory, warehouse and depot equipment'),
('5320', 'Depreciation Expense - Office & IT Assets', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, 'DEPRECIATION_EXPENSE', 'Monthly statutory depreciation on computers and office infrastructure'),
('5350', 'Gain / Loss on Asset Disposal & Retirement', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, 'ASSET_DISPOSAL_GAIN_LOSS', 'Net difference between asset salvage/sale proceeds and Net Book Value')
ON CONFLICT (account_number) DO UPDATE SET
    account_name = EXCLUDED.account_name,
    description = EXCLUDED.description;

-- =============================================================================
-- 2. SEQUENCES FOR FIXED ASSET TAGS AND DISPOSAL REFERENCES
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_fixed_asset_tag START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.seq_asset_disposal_num START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.seq_asset_maintenance_num START WITH 1001;

-- =============================================================================
-- 3. TABLE: fixed_asset_categories
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fixed_asset_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code VARCHAR(30) UNIQUE NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    description TEXT,
    default_useful_life_months INTEGER NOT NULL CHECK (default_useful_life_months > 0),
    default_depreciation_method VARCHAR(10) NOT NULL DEFAULT 'SLM' CHECK (default_depreciation_method IN ('SLM', 'WDV')),
    default_salvage_percentage NUMERIC(5, 2) NOT NULL DEFAULT 5.00 CHECK (default_salvage_percentage >= 0 AND default_salvage_percentage <= 50),
    asset_gl_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
    accumulated_depreciation_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
    depreciation_expense_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_asset_categories_code ON public.fixed_asset_categories(category_code);

-- Seed Categories mapped to COA
DO $$
DECLARE
    v_acc_factory UUID;
    v_acc_rework UUID;
    v_acc_wh UUID;
    v_acc_tool UUID;
    v_acc_it UUID;
    v_acc_veh UUID;
    v_acc_accum UUID;
    v_acc_dep_plant UUID;
    v_acc_dep_it UUID;
BEGIN
    SELECT id INTO v_acc_factory FROM public.chart_of_accounts WHERE account_number = '1510';
    SELECT id INTO v_acc_rework FROM public.chart_of_accounts WHERE account_number = '1520';
    SELECT id INTO v_acc_wh FROM public.chart_of_accounts WHERE account_number = '1530';
    SELECT id INTO v_acc_tool FROM public.chart_of_accounts WHERE account_number = '1540';
    SELECT id INTO v_acc_it FROM public.chart_of_accounts WHERE account_number = '1550';
    SELECT id INTO v_acc_veh FROM public.chart_of_accounts WHERE account_number = '1560';
    SELECT id INTO v_acc_accum FROM public.chart_of_accounts WHERE account_number = '1590';
    SELECT id INTO v_acc_dep_plant FROM public.chart_of_accounts WHERE account_number = '5310';
    SELECT id INTO v_acc_dep_it FROM public.chart_of_accounts WHERE account_number = '5320';

    INSERT INTO public.fixed_asset_categories 
    (category_code, category_name, description, default_useful_life_months, default_depreciation_method, default_salvage_percentage, asset_gl_account_id, accumulated_depreciation_account_id, depreciation_expense_account_id)
    VALUES
    ('CAT-TEST-RIG', 'Factory Testing & Burn-In Rigs', 'Automated video signal generators, load testers, 24h burn-in racks', 60, 'SLM', 5.00, v_acc_factory, v_acc_accum, v_acc_dep_plant),
    ('CAT-SOLD-STN', 'Soldering & BGA Rework Stations', 'Precision micro-soldering, IR rework stations, hot air desoldering rigs', 48, 'SLM', 5.00, v_acc_rework, v_acc_accum, v_acc_dep_plant),
    ('CAT-CALIB-EQ', 'Optical & Color Calibration Gear', 'Spectroradiometers, luminance meters, color analyzers', 36, 'SLM', 5.00, v_acc_rework, v_acc_accum, v_acc_dep_plant),
    ('CAT-WH-EQUIP', 'Warehouse Handling Machinery', 'Electric stackers, hydraulic pallet jacks, industrial barcode scanners', 84, 'SLM', 10.00, v_acc_wh, v_acc_accum, v_acc_dep_plant),
    ('CAT-SRV-BNCH', 'Service Centre Repair Benches', 'ESD-safe repair stations, isolation transformers, digital oscilloscopes', 60, 'SLM', 5.00, v_acc_rework, v_acc_accum, v_acc_dep_plant),
    ('CAT-TECH-KIT', 'Technician Toolkits & Fluke Meters', 'Field engineer mobile TV testing kits, digital multimeters, panel suction tools', 24, 'SLM', 0.00, v_acc_tool, v_acc_accum, v_acc_dep_plant),
    ('CAT-LOG-VEHC', 'Service & Logistics Fleet', 'Service delivery vans, cargo e-rickshaws, distribution trucks', 96, 'WDV', 10.00, v_acc_veh, v_acc_accum, v_acc_dep_plant),
    ('CAT-IT-HRDWR', 'Computer & Office Hardware', 'High-performance diagnostic PCs, thermal label printers, network switches', 36, 'SLM', 5.00, v_acc_it, v_acc_accum, v_acc_dep_it)
    ON CONFLICT (category_code) DO UPDATE SET
        category_name = EXCLUDED.category_name,
        default_useful_life_months = EXCLUDED.default_useful_life_months,
        asset_gl_account_id = EXCLUDED.asset_gl_account_id,
        accumulated_depreciation_account_id = EXCLUDED.accumulated_depreciation_account_id,
        depreciation_expense_account_id = EXCLUDED.depreciation_expense_account_id;
END $$;

-- =============================================================================
-- 4. TABLE: fixed_assets
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fixed_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_tag VARCHAR(30) UNIQUE NOT NULL,
    asset_name VARCHAR(150) NOT NULL,
    category_id UUID NOT NULL REFERENCES public.fixed_asset_categories(id) ON DELETE RESTRICT,
    serial_number VARCHAR(100),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    vendor_invoice_id UUID REFERENCES public.vendor_invoices(id) ON DELETE SET NULL,
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    acquisition_date DATE NOT NULL,
    capitalization_date DATE NOT NULL,
    acquisition_cost NUMERIC(14, 2) NOT NULL CHECK (acquisition_cost > 0),
    directly_attributable_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (directly_attributable_cost >= 0),
    total_capitalized_cost NUMERIC(14, 2) NOT NULL CHECK (total_capitalized_cost > 0),
    salvage_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (salvage_value >= 0),
    useful_life_months INTEGER NOT NULL CHECK (useful_life_months > 0),
    depreciation_method VARCHAR(10) NOT NULL DEFAULT 'SLM' CHECK (depreciation_method IN ('SLM', 'WDV')),
    depreciation_rate NUMERIC(6, 4) DEFAULT NULL, -- Annual rate where applicable (e.g. 0.2000 for 20%)
    accumulated_depreciation NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (accumulated_depreciation >= 0),
    current_book_value NUMERIC(14, 2) NOT NULL CHECK (current_book_value >= 0),
    status VARCHAR(25) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'IN_MAINTENANCE', 'FULLY_DEPRECIATED', 'DISPOSED', 'IMPAIRED')),
    location_depot VARCHAR(100) NOT NULL DEFAULT 'Central Assembly Plant',
    custodian VARCHAR(100),
    warranty_expiry DATE,
    last_physical_verification_at TIMESTAMPTZ,
    next_calibration_due_at DATE,
    capitalization_journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_salvage_lte_cost CHECK (salvage_value <= total_capitalized_cost),
    CONSTRAINT chk_book_value_floor CHECK (current_book_value >= salvage_value OR status = 'DISPOSED')
);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_tag ON public.fixed_assets(asset_tag);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_category ON public.fixed_assets(category_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_status ON public.fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_calibration ON public.fixed_assets(next_calibration_due_at);

-- =============================================================================
-- 5. TABLE: asset_depreciation_schedules
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.asset_depreciation_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
    accounting_period_id UUID NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    opening_book_value NUMERIC(14, 2) NOT NULL CHECK (opening_book_value >= 0),
    depreciation_amount NUMERIC(14, 2) NOT NULL CHECK (depreciation_amount >= 0),
    accumulated_depreciation NUMERIC(14, 2) NOT NULL CHECK (accumulated_depreciation >= 0),
    closing_book_value NUMERIC(14, 2) NOT NULL CHECK (closing_book_value >= 0),
    method VARCHAR(10) NOT NULL CHECK (method IN ('SLM', 'WDV')),
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'POSTED', 'SKIPPED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_asset_period UNIQUE (asset_id, accounting_period_id)
);

CREATE INDEX IF NOT EXISTS idx_deprec_sched_asset ON public.asset_depreciation_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_deprec_sched_period ON public.asset_depreciation_schedules(accounting_period_id);
CREATE INDEX IF NOT EXISTS idx_deprec_sched_status ON public.asset_depreciation_schedules(status);

-- =============================================================================
-- 6. TABLE: asset_maintenance_logs
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.asset_maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_number VARCHAR(30) UNIQUE NOT NULL,
    asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
    maintenance_type VARCHAR(30) NOT NULL CHECK (maintenance_type IN ('CALIBRATION', 'PREVENTATIVE', 'CORRECTIVE_REPAIR', 'BREAKDOWN', 'ANNUAL_AUDIT')),
    reference_number VARCHAR(100),
    service_provider VARCHAR(150),
    performed_at DATE NOT NULL DEFAULT CURRENT_DATE,
    next_due_at DATE,
    downtime_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.00 CHECK (downtime_hours >= 0),
    maintenance_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (maintenance_cost >= 0),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_asset_maint_asset ON public.asset_maintenance_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_maint_type ON public.asset_maintenance_logs(maintenance_type);

-- =============================================================================
-- 7. TABLE: asset_disposals
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.asset_disposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disposal_number VARCHAR(30) UNIQUE NOT NULL,
    asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE RESTRICT,
    disposal_date DATE NOT NULL,
    disposal_reason VARCHAR(50) NOT NULL CHECK (disposal_reason IN ('SCRAP', 'OBSOLETE', 'SOLD', 'DESTROYED', 'TRADE_IN')),
    proceeds NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (proceeds >= 0),
    capitalized_cost_at_disposal NUMERIC(14, 2) NOT NULL,
    accumulated_depreciation_at_disposal NUMERIC(14, 2) NOT NULL,
    net_book_value NUMERIC(14, 2) NOT NULL,
    gain_loss NUMERIC(14, 2) NOT NULL, -- positive = gain, negative = loss
    disposal_method VARCHAR(50) NOT NULL DEFAULT 'RECYCLING_VENDOR',
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_asset_disposal UNIQUE (asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_disposals_asset ON public.asset_disposals(asset_id);

-- =============================================================================
-- 8. RPC: fn_capitalize_fixed_asset
-- Capitalizes a new Fixed Asset, assigns unique asset tag, initializes schedule,
-- and posts balanced acquisition journal entry to General Ledger.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_capitalize_fixed_asset(
    p_asset_name TEXT,
    p_category_id UUID,
    p_acquisition_cost NUMERIC,
    p_directly_attributable_cost NUMERIC DEFAULT 0.00,
    p_acquisition_date DATE DEFAULT CURRENT_DATE,
    p_capitalization_date DATE DEFAULT CURRENT_DATE,
    p_serial_number TEXT DEFAULT NULL,
    p_vendor_id UUID DEFAULT NULL,
    p_vendor_invoice_id UUID DEFAULT NULL,
    p_purchase_order_id UUID DEFAULT NULL,
    p_salvage_value NUMERIC DEFAULT NULL,
    p_useful_life_months INTEGER DEFAULT NULL,
    p_depreciation_method TEXT DEFAULT NULL,
    p_location_depot TEXT DEFAULT 'Central Assembly Plant',
    p_custodian TEXT DEFAULT NULL,
    p_warranty_expiry DATE DEFAULT NULL,
    p_next_calibration_due_at DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cat RECORD;
    v_total_cost NUMERIC(14, 2);
    v_salvage NUMERIC(14, 2);
    v_life INTEGER;
    v_method TEXT;
    v_tag TEXT;
    v_asset_id UUID;
    v_period RECORD;
    v_journal_id UUID;
    v_journal_num TEXT;
    v_source_acc_id UUID;
    v_lines JSONB;
    v_post_result JSONB;
BEGIN
    -- 1. Validate Category
    SELECT * INTO v_cat FROM public.fixed_asset_categories WHERE id = p_category_id;
    IF v_cat.id IS NULL THEN
        RAISE EXCEPTION 'Fixed asset category % not found.', p_category_id;
    END IF;

    -- 2. Compute Costs & Invariants
    IF p_acquisition_cost <= 0 THEN
        RAISE EXCEPTION 'Acquisition cost must be positive.';
    END IF;
    v_total_cost := ROUND(p_acquisition_cost + COALESCE(p_directly_attributable_cost, 0.00), 2);

    v_life := COALESCE(p_useful_life_months, v_cat.default_useful_life_months);
    IF v_life <= 0 THEN
        RAISE EXCEPTION 'Useful life must be greater than zero months.';
    END IF;

    v_method := COALESCE(p_depreciation_method, v_cat.default_depreciation_method);
    IF v_method NOT IN ('SLM', 'WDV') THEN
        RAISE EXCEPTION 'Depreciation method must be SLM or WDV.';
    END IF;

    IF p_salvage_value IS NOT NULL THEN
        v_salvage := ROUND(p_salvage_value, 2);
    ELSE
        v_salvage := ROUND(v_total_cost * (v_cat.default_salvage_percentage / 100.00), 2);
    END IF;

    IF v_salvage > v_total_cost THEN
        RAISE EXCEPTION 'Salvage value (₹%) cannot exceed total capitalized cost (₹%).', v_salvage, v_total_cost;
    END IF;

    -- 3. Check Accounting Period for Capitalization Date
    SELECT * INTO v_period FROM public.accounting_periods
    WHERE p_capitalization_date BETWEEN start_date AND end_date
    ORDER BY created_at DESC LIMIT 1;

    IF v_period.id IS NULL THEN
        RAISE EXCEPTION 'No open accounting period found for capitalization date %.', p_capitalization_date;
    END IF;
    IF v_period.status = 'LOCKED' THEN
        RAISE EXCEPTION 'Accounting period % is LOCKED. Capitalization not permitted.', v_period.period_name;
    END IF;

    -- 4. Generate Unique Sequential Asset Tag
    v_tag := 'AST-' || to_char(p_capitalization_date, 'YYYY') || '-' || lpad(nextval('public.seq_fixed_asset_tag')::text, 5, '0');

    -- 5. Insert Fixed Asset Record
    INSERT INTO public.fixed_assets (
        asset_tag, asset_name, category_id, serial_number, vendor_id,
        vendor_invoice_id, purchase_order_id, acquisition_date, capitalization_date,
        acquisition_cost, directly_attributable_cost, total_capitalized_cost,
        salvage_value, useful_life_months, depreciation_method,
        accumulated_depreciation, current_book_value, status,
        location_depot, custodian, warranty_expiry, next_calibration_due_at
    ) VALUES (
        v_tag, p_asset_name, p_category_id, p_serial_number, p_vendor_id,
        p_vendor_invoice_id, p_purchase_order_id, p_acquisition_date, p_capitalization_date,
        p_acquisition_cost, COALESCE(p_directly_attributable_cost, 0.00), v_total_cost,
        v_salvage, v_life, v_method,
        0.00, v_total_cost, 'ACTIVE',
        p_location_depot, p_custodian, p_warranty_expiry, p_next_calibration_due_at
    ) RETURNING id INTO v_asset_id;

    -- 6. General Ledger Posting:
    -- Debit: Fixed Asset Gross Block Account (v_cat.asset_gl_account_id)
    -- Credit: AP Control (2100) if from vendor invoice, or Bank (1010)
    IF p_vendor_invoice_id IS NOT NULL THEN
        SELECT id INTO v_source_acc_id FROM public.chart_of_accounts WHERE account_number = '2100';
    ELSE
        SELECT id INTO v_source_acc_id FROM public.chart_of_accounts WHERE account_number = '1010';
    END IF;

    v_lines := jsonb_build_array(
        jsonb_build_object(
            'account_id', v_cat.asset_gl_account_id,
            'debit_amount', v_total_cost,
            'credit_amount', 0.00,
            'line_description', 'Capitalization of fixed asset ' || v_tag || ' (' || p_asset_name || ')'
        ),
        jsonb_build_object(
            'account_id', v_source_acc_id,
            'debit_amount', 0.00,
            'credit_amount', v_total_cost,
            'line_description', 'Settlement/clearing for capital acquisition ' || v_tag
        )
    );

    v_post_result := public.fn_post_journal_entry(
        p_entry_date => p_capitalization_date,
        p_description => 'Fixed Asset Capitalization: ' || v_tag || ' - ' || p_asset_name,
        p_lines => v_lines,
        p_source_document_type => 'FIXED_ASSET_CAPITALIZATION',
        p_source_document_reference_id => v_asset_id::text
    );

    IF (v_post_result->>'success')::boolean = true THEN
        v_journal_id := (v_post_result->>'journal_entry_id')::uuid;
        v_journal_num := v_post_result->>'entry_number';

        UPDATE public.fixed_assets
        SET capitalization_journal_entry_id = v_journal_id
        WHERE id = v_asset_id;
    END IF;

    -- 7. Audit Event
    PERFORM public.fn_log_financial_audit_event(
        p_event_type => 'FIXED_ASSET_CAPITALIZED',
        p_entity_type => 'FIXED_ASSET',
        p_entity_id => v_asset_id::text,
        p_amount => v_total_cost,
        p_payload => jsonb_build_object(
            'asset_tag', v_tag,
            'capitalized_cost', v_total_cost,
            'method', v_method,
            'salvage_value', v_salvage,
            'journal_entry', v_journal_num
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'asset_id', v_asset_id,
        'asset_tag', v_tag,
        'total_capitalized_cost', v_total_cost,
        'salvage_value', v_salvage,
        'journal_entry_id', v_journal_id,
        'journal_entry_number', v_journal_num,
        'message', 'Fixed asset ' || v_tag || ' successfully capitalized.'
    );
END;
$$;

-- =============================================================================
-- 9. RPC: fn_run_monthly_depreciation
-- Executes server-authoritative statutory monthly depreciation run across
-- all active qualifying fixed assets for an accounting period.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_run_monthly_depreciation(p_period_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period RECORD;
    v_asset RECORD;
    v_monthly_deprec NUMERIC(14, 2);
    v_deprec_amount NUMERIC(14, 2);
    v_new_accum NUMERIC(14, 2);
    v_new_book NUMERIC(14, 2);
    v_total_depreciation NUMERIC(14, 2) := 0.00;
    v_asset_count INTEGER := 0;
    v_journal_id UUID;
    v_journal_num TEXT;
    v_accum_acc_id UUID;
    v_expense_acc_id UUID;
    v_lines JSONB;
    v_post_result JSONB;
BEGIN
    -- 1. Validate Accounting Period
    SELECT * INTO v_period FROM public.accounting_periods WHERE id = p_period_id;
    IF v_period.id IS NULL THEN
        RAISE EXCEPTION 'Accounting period % not found.', p_period_id;
    END IF;

    IF v_period.status = 'LOCKED' THEN
        RAISE EXCEPTION 'Accounting period % is LOCKED. Depreciation execution prohibited.', v_period.period_name;
    END IF;

    -- 2. Check if already executed for this period
    IF EXISTS (
        SELECT 1 FROM public.asset_depreciation_schedules
        WHERE accounting_period_id = p_period_id AND status = 'POSTED'
    ) THEN
        RAISE EXCEPTION 'Depreciation run for accounting period % has already been executed and posted.', v_period.period_name;
    END IF;

    -- 3. Resolve Master Accounts for Summary Posting
    SELECT id INTO v_accum_acc_id FROM public.chart_of_accounts WHERE account_number = '1590';
    SELECT id INTO v_expense_acc_id FROM public.chart_of_accounts WHERE account_number = '5310';

    -- 4. Process Each Active Asset Eligible for Depreciation
    FOR v_asset IN 
        SELECT a.*, c.default_depreciation_method, c.depreciation_expense_account_id
        FROM public.fixed_assets a
        JOIN public.fixed_asset_categories c ON a.category_id = c.id
        WHERE a.status IN ('ACTIVE', 'IN_MAINTENANCE')
          AND a.capitalization_date <= v_period.end_date
          AND a.current_book_value > a.salvage_value
        ORDER BY a.asset_tag ASC
    LOOP
        -- Calculate Monthly Depreciation based on method
        IF v_asset.depreciation_method = 'SLM' THEN
            -- Straight Line: (Cost - Salvage) / Useful Life Months
            v_monthly_deprec := ROUND((v_asset.total_capitalized_cost - v_asset.salvage_value) / v_asset.useful_life_months, 2);
        ELSE
            -- WDV: Rate / 12 applied to opening book value
            v_monthly_deprec := ROUND(v_asset.current_book_value * (COALESCE(v_asset.depreciation_rate, 0.15) / 12.00), 2);
        END IF;

        -- Floor check: Cannot depreciate below salvage value
        IF (v_asset.current_book_value - v_monthly_deprec) < v_asset.salvage_value THEN
            v_deprec_amount := v_asset.current_book_value - v_asset.salvage_value;
        ELSE
            v_deprec_amount := v_monthly_deprec;
        END IF;

        IF v_deprec_amount > 0 THEN
            v_new_accum := v_asset.accumulated_depreciation + v_deprec_amount;
            v_new_book := v_asset.current_book_value - v_deprec_amount;

            -- Insert Schedule Line
            INSERT INTO public.asset_depreciation_schedules (
                asset_id, accounting_period_id, period_start, period_end,
                opening_book_value, depreciation_amount, accumulated_depreciation,
                closing_book_value, method, status
            ) VALUES (
                v_asset.id, p_period_id, v_period.start_date, v_period.end_date,
                v_asset.current_book_value, v_deprec_amount, v_new_accum,
                v_new_book, v_asset.depreciation_method, 'POSTED'
            );

            -- Update Fixed Asset Ledger
            UPDATE public.fixed_assets SET
                accumulated_depreciation = v_new_accum,
                current_book_value = v_new_book,
                status = CASE WHEN v_new_book <= v_asset.salvage_value THEN 'FULLY_DEPRECIATED' ELSE status END,
                updated_at = timezone('utc', now())
            WHERE id = v_asset.id;

            v_total_depreciation := v_total_depreciation + v_deprec_amount;
            v_asset_count := v_asset_count + 1;
        END IF;
    END LOOP;

    -- 5. Post Aggregated Depreciation Journal Entry to GL
    IF v_total_depreciation > 0 THEN
        v_lines := jsonb_build_array(
            jsonb_build_object(
                'account_id', v_expense_acc_id,
                'debit_amount', v_total_depreciation,
                'credit_amount', 0.00,
                'line_description', 'Monthly statutory depreciation expense for ' || v_period.period_name || ' (' || v_asset_count || ' assets)'
            ),
            jsonb_build_object(
                'account_id', v_accum_acc_id,
                'debit_amount', 0.00,
                'credit_amount', v_total_depreciation,
                'line_description', 'Accumulated depreciation reserve for ' || v_period.period_name
            )
        );

        v_post_result := public.fn_post_journal_entry(
            p_entry_date => v_period.end_date,
            p_description => 'Statutory Monthly Depreciation: ' || v_period.period_name,
            p_lines => v_lines,
            p_source_document_type => 'DEPRECIATION_RUN',
            p_source_document_reference_id => p_period_id::text
        );

        IF (v_post_result->>'success')::boolean = true THEN
            v_journal_id := (v_post_result->>'journal_entry_id')::uuid;
            v_journal_num := v_post_result->>'entry_number';

            UPDATE public.asset_depreciation_schedules
            SET journal_entry_id = v_journal_id
            WHERE accounting_period_id = p_period_id;
        END IF;
    END IF;

    -- 6. Audit Event
    PERFORM public.fn_log_financial_audit_event(
        p_event_type => 'DEPRECIATION_RUN_EXECUTED',
        p_entity_type => 'ACCOUNTING_PERIOD',
        p_entity_id => p_period_id::text,
        p_amount => v_total_depreciation,
        p_payload => jsonb_build_object(
            'period_name', v_period.period_name,
            'assets_depreciated', v_asset_count,
            'total_depreciation', v_total_depreciation,
            'journal_entry_number', v_journal_num
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'period_id', p_period_id,
        'period_name', v_period.period_name,
        'assets_processed', v_asset_count,
        'total_depreciation', v_total_depreciation,
        'journal_entry_id', v_journal_id,
        'journal_entry_number', v_journal_num,
        'message', 'Depreciation run completed: ₹' || v_total_depreciation || ' across ' || v_asset_count || ' assets.'
    );
END;
$$;

-- =============================================================================
-- 10. RPC: fn_dispose_fixed_asset
-- Handles authoritative derecognition, proceeds, gain/loss calculation,
-- GL disposal journalization, and status transition to DISPOSED.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_dispose_fixed_asset(
    p_asset_id UUID,
    p_proceeds NUMERIC,
    p_disposal_date DATE DEFAULT CURRENT_DATE,
    p_disposal_reason TEXT DEFAULT 'SCRAP',
    p_disposal_method TEXT DEFAULT 'RECYCLING_VENDOR'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_asset RECORD;
    v_cat RECORD;
    v_period RECORD;
    v_nbv NUMERIC(14, 2);
    v_gain_loss NUMERIC(14, 2);
    v_disposal_num TEXT;
    v_disposal_id UUID;
    v_journal_id UUID;
    v_journal_num TEXT;
    v_accum_acc_id UUID;
    v_asset_acc_id UUID;
    v_bank_acc_id UUID;
    v_gain_loss_acc_id UUID;
    v_lines JSONB := '[]'::jsonb;
    v_post_result JSONB;
BEGIN
    -- 1. Fetch Asset and Validate
    SELECT * INTO v_asset FROM public.fixed_assets WHERE id = p_asset_id;
    IF v_asset.id IS NULL THEN
        RAISE EXCEPTION 'Fixed asset % not found.', p_asset_id;
    END IF;

    IF v_asset.status = 'DISPOSED' THEN
        RAISE EXCEPTION 'Fixed asset % is already marked DISPOSED.', v_asset.asset_tag;
    END IF;

    SELECT * INTO v_cat FROM public.fixed_asset_categories WHERE id = v_asset.category_id;

    -- 2. Validate Accounting Period
    SELECT * INTO v_period FROM public.accounting_periods
    WHERE p_disposal_date BETWEEN start_date AND end_date
    ORDER BY created_at DESC LIMIT 1;

    IF v_period.id IS NULL THEN
        RAISE EXCEPTION 'No open accounting period found for disposal date %.', p_disposal_date;
    END IF;
    IF v_period.status = 'LOCKED' THEN
        RAISE EXCEPTION 'Accounting period % is LOCKED. Disposal not permitted.', v_period.period_name;
    END IF;

    -- 3. Calculate Authoritative Financial Figures
    v_nbv := v_asset.current_book_value;
    v_gain_loss := ROUND(COALESCE(p_proceeds, 0.00) - v_nbv, 2);

    v_disposal_num := 'DSP-' || to_char(p_disposal_date, 'YYYYMM') || '-' || lpad(nextval('public.seq_asset_disposal_num')::text, 4, '0');

    -- 4. Record Disposal in asset_disposals
    INSERT INTO public.asset_disposals (
        disposal_number, asset_id, disposal_date, disposal_reason,
        proceeds, capitalized_cost_at_disposal, accumulated_depreciation_at_disposal,
        net_book_value, gain_loss, disposal_method, approved_by
    ) VALUES (
        v_disposal_num, p_asset_id, p_disposal_date, p_disposal_reason,
        COALESCE(p_proceeds, 0.00), v_asset.total_capitalized_cost,
        v_asset.accumulated_depreciation, v_nbv, v_gain_loss,
        p_disposal_method, auth.uid()
    ) RETURNING id INTO v_disposal_id;

    -- 5. Build Balanced Double-Entry Derecognition Journal:
    -- Debit: Operating Bank/Cash (1010) for Proceeds (if > 0)
    -- Debit: Accumulated Depreciation (1590) for derecognition
    -- Credit: Fixed Asset Gross Block Account for total capitalized cost
    -- Debit/Credit: Gain/Loss on Disposal (5350)
    SELECT id INTO v_accum_acc_id FROM public.chart_of_accounts WHERE account_number = '1590';
    SELECT id INTO v_bank_acc_id FROM public.chart_of_accounts WHERE account_number = '1010';
    SELECT id INTO v_gain_loss_acc_id FROM public.chart_of_accounts WHERE account_number = '5350';
    v_asset_acc_id := v_cat.asset_gl_account_id;

    -- Line 1: Derecognize Accumulated Depreciation (Debit)
    IF v_asset.accumulated_depreciation > 0 THEN
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_accum_acc_id,
            'debit_amount', v_asset.accumulated_depreciation,
            'credit_amount', 0.00,
            'line_description', 'Derecognize accum depreciation on disposal of ' || v_asset.asset_tag
        );
    END IF;

    -- Line 2: Recognize Cash Proceeds (Debit) if proceeds > 0
    IF COALESCE(p_proceeds, 0.00) > 0 THEN
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_bank_acc_id,
            'debit_amount', p_proceeds,
            'credit_amount', 0.00,
            'line_description', 'Proceeds from disposal of ' || v_asset.asset_tag
        );
    END IF;

    -- Line 3: Realize Loss (Debit) OR Gain (Credit)
    IF v_gain_loss < 0 THEN
        -- Loss: Debit
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_gain_loss_acc_id,
            'debit_amount', ABS(v_gain_loss),
            'credit_amount', 0.00,
            'line_description', 'Loss on disposal/retirement of ' || v_asset.asset_tag
        );
    ELSIF v_gain_loss > 0 THEN
        -- Gain: Credit
        v_lines := v_lines || jsonb_build_object(
            'account_id', v_gain_loss_acc_id,
            'debit_amount', 0.00,
            'credit_amount', v_gain_loss,
            'line_description', 'Gain on disposal of ' || v_asset.asset_tag
        );
    END IF;

    -- Line 4: Derecognize Gross Block Asset Cost (Credit)
    v_lines := v_lines || jsonb_build_object(
        'account_id', v_asset_acc_id,
        'debit_amount', 0.00,
        'credit_amount', v_asset.total_capitalized_cost,
        'line_description', 'Derecognize asset gross block on disposal of ' || v_asset.asset_tag
    );

    -- Post balanced journal entry
    v_post_result := public.fn_post_journal_entry(
        p_entry_date => p_disposal_date,
        p_description => 'Fixed Asset Disposal & Retirement: ' || v_asset.asset_tag,
        p_lines => v_lines,
        p_source_document_type => 'FIXED_ASSET_DISPOSAL',
        p_source_document_reference_id => v_disposal_id::text
    );

    IF (v_post_result->>'success')::boolean = true THEN
        v_journal_id := (v_post_result->>'journal_entry_id')::uuid;
        v_journal_num := v_post_result->>'entry_number';

        UPDATE public.asset_disposals
        SET journal_entry_id = v_journal_id
        WHERE id = v_disposal_id;
    END IF;

    -- 6. Transition Fixed Asset Status
    UPDATE public.fixed_assets SET
        status = 'DISPOSED',
        current_book_value = 0.00,
        updated_at = timezone('utc', now())
    WHERE id = p_asset_id;

    -- 7. Audit Event
    PERFORM public.fn_log_financial_audit_event(
        p_event_type => 'FIXED_ASSET_DISPOSED',
        p_entity_type => 'FIXED_ASSET',
        p_entity_id => p_asset_id::text,
        p_amount => p_proceeds,
        p_payload => jsonb_build_object(
            'disposal_number', v_disposal_num,
            'asset_tag', v_asset.asset_tag,
            'net_book_value', v_nbv,
            'proceeds', p_proceeds,
            'gain_loss', v_gain_loss,
            'journal_entry_number', v_journal_num
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'disposal_id', v_disposal_id,
        'disposal_number', v_disposal_num,
        'asset_tag', v_asset.asset_tag,
        'net_book_value', v_nbv,
        'proceeds', p_proceeds,
        'gain_loss', v_gain_loss,
        'journal_entry_id', v_journal_id,
        'journal_entry_number', v_journal_num,
        'message', 'Asset ' || v_asset.asset_tag || ' successfully disposed.'
    );
END;
$$;

-- =============================================================================
-- 11. RPC: fn_record_asset_maintenance
-- Records maintenance or calibration, updates next due date, and tracks cost.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_record_asset_maintenance(
    p_asset_id UUID,
    p_maintenance_type TEXT,
    p_service_provider TEXT,
    p_maintenance_cost NUMERIC DEFAULT 0.00,
    p_downtime_hours NUMERIC DEFAULT 0.00,
    p_performed_at DATE DEFAULT CURRENT_DATE,
    p_next_due_at DATE DEFAULT NULL,
    p_reference_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_asset RECORD;
    v_log_id UUID;
    v_log_num TEXT;
BEGIN
    SELECT * INTO v_asset FROM public.fixed_assets WHERE id = p_asset_id;
    IF v_asset.id IS NULL THEN
        RAISE EXCEPTION 'Fixed asset % not found.', p_asset_id;
    END IF;

    IF p_maintenance_type NOT IN ('CALIBRATION', 'PREVENTATIVE', 'CORRECTIVE_REPAIR', 'BREAKDOWN', 'ANNUAL_AUDIT') THEN
        RAISE EXCEPTION 'Invalid maintenance type %.', p_maintenance_type;
    END IF;

    v_log_num := 'MNT-' || to_char(p_performed_at, 'YYYYMM') || '-' || lpad(nextval('public.seq_asset_maintenance_num')::text, 4, '0');

    INSERT INTO public.asset_maintenance_logs (
        log_number, asset_id, maintenance_type, reference_number,
        service_provider, performed_at, next_due_at, downtime_hours,
        maintenance_cost, notes, created_by
    ) VALUES (
        v_log_num, p_asset_id, p_maintenance_type, p_reference_number,
        p_service_provider, p_performed_at, p_next_due_at,
        COALESCE(p_downtime_hours, 0.00), COALESCE(p_maintenance_cost, 0.00),
        p_notes, auth.uid()
    ) RETURNING id INTO v_log_id;

    -- If calibration or maintenance, update asset next_calibration_due_at or status
    IF p_maintenance_type = 'CALIBRATION' AND p_next_due_at IS NOT NULL THEN
        UPDATE public.fixed_assets SET
            next_calibration_due_at = p_next_due_at,
            last_physical_verification_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        WHERE id = p_asset_id;
    END IF;

    IF p_maintenance_type = 'BREAKDOWN' THEN
        UPDATE public.fixed_assets SET
            status = 'IN_MAINTENANCE',
            updated_at = timezone('utc', now())
        WHERE id = p_asset_id AND status = 'ACTIVE';
    ELSIF v_asset.status = 'IN_MAINTENANCE' AND p_maintenance_type IN ('PREVENTATIVE', 'CORRECTIVE_REPAIR', 'CALIBRATION') THEN
        UPDATE public.fixed_assets SET
            status = 'ACTIVE',
            updated_at = timezone('utc', now())
        WHERE id = p_asset_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'log_id', v_log_id,
        'log_number', v_log_num,
        'asset_tag', v_asset.asset_tag,
        'maintenance_type', p_maintenance_type,
        'cost', p_maintenance_cost,
        'message', 'Maintenance record ' || v_log_num || ' logged successfully.'
    );
END;
$$;

-- =============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.fixed_asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_depreciation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_disposals ENABLE ROW LEVEL SECURITY;

-- 1. fixed_asset_categories RLS
CREATE POLICY "categories_select_internal" ON public.fixed_asset_categories
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('super_admin', 'admin', 'finance', 'inventory', 'service')
        )
    );

CREATE POLICY "categories_admin_modify" ON public.fixed_asset_categories
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- 2. fixed_assets RLS
CREATE POLICY "assets_select_internal" ON public.fixed_assets
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('super_admin', 'admin', 'finance', 'inventory', 'service')
        )
    );

CREATE POLICY "assets_admin_modify" ON public.fixed_assets
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- 3. asset_depreciation_schedules RLS
CREATE POLICY "deprec_sched_select_finance" ON public.asset_depreciation_schedules
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

CREATE POLICY "deprec_sched_modify_finance" ON public.asset_depreciation_schedules
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- 4. asset_maintenance_logs RLS
CREATE POLICY "maintenance_select_internal" ON public.asset_maintenance_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('super_admin', 'admin', 'finance', 'inventory', 'service')
        )
    );

CREATE POLICY "maintenance_insert_internal" ON public.asset_maintenance_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('super_admin', 'admin', 'finance', 'inventory', 'service')
        )
    );

-- 5. asset_disposals RLS
CREATE POLICY "disposals_select_finance" ON public.asset_disposals
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

CREATE POLICY "disposals_modify_finance" ON public.asset_disposals
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('super_admin', 'admin', 'finance')
        )
    );

-- Strict Denial for Anonymous & Unauthorized Public Access
REVOKE ALL ON public.fixed_asset_categories FROM anon;
REVOKE ALL ON public.fixed_assets FROM anon;
REVOKE ALL ON public.asset_depreciation_schedules FROM anon;
REVOKE ALL ON public.asset_maintenance_logs FROM anon;
REVOKE ALL ON public.asset_disposals FROM anon;

REVOKE EXECUTE ON FUNCTION public.fn_capitalize_fixed_asset FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_run_monthly_depreciation FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_dispose_fixed_asset FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_record_asset_maintenance FROM anon;

GRANT EXECUTE ON FUNCTION public.fn_capitalize_fixed_asset TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_run_monthly_depreciation TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_dispose_fixed_asset TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_record_asset_maintenance TO authenticated;
