-- =============================================================================
-- ZUVO TV CRM — PHASE 8.6 MASTER DATABASE MIGRATION
-- Enterprise Inventory Valuation, Serialized Cost-Basis, FIFO Cost Layers,
-- COGS Recognition & Gross Margin Intelligence Engine
-- Filename: 20261017260000_phase_8_6_inventory_valuation_margin.sql
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. SEQUENCES FOR ADJUSTMENT REQUESTS & SNAPSHOT BATCHES
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_inventory_adjustment_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seq_inventory_snapshot_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 2. TABLE: public.inventory_cost_layers (Authoritative FIFO / Serialized Cost Layers)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_cost_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    product_id UUID NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    product_unit_id UUID NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    warehouse_id UUID NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    source_type TEXT NOT NULL CHECK (
        source_type IN (
            'PURCHASE',
            'LANDED_COST',
            'TRANSFER',
            'RETURN',
            'REFURBISHMENT',
            'ADJUSTMENT',
            'MANUFACTURING'
        )
    ),
    source_reference_id UUID NULL,
    quantity_received NUMERIC(14, 2) NOT NULL CHECK (quantity_received >= 0),
    quantity_remaining NUMERIC(14, 2) NOT NULL CHECK (quantity_remaining >= 0),
    unit_cost NUMERIC(14, 2) NOT NULL CHECK (unit_cost >= 0),
    landed_cost_allocated NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (landed_cost_allocated >= 0),
    total_layer_cost NUMERIC(14, 2) NOT NULL CHECK (total_layer_cost >= 0),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accounting_period_id UUID NULL REFERENCES public.accounting_periods(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIALLY_CONSUMED', 'EXHAUSTED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_cost_layer_qty_remaining CHECK (quantity_remaining <= quantity_received)
);

CREATE INDEX IF NOT EXISTS idx_inv_cost_layers_product ON public.inventory_cost_layers(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_cost_layers_unit ON public.inventory_cost_layers(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_inv_cost_layers_wh ON public.inventory_cost_layers(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_cost_layers_status ON public.inventory_cost_layers(status);
CREATE INDEX IF NOT EXISTS idx_inv_cost_layers_received ON public.inventory_cost_layers(received_at);

-- =============================================================================
-- 3. TABLE: public.inventory_cost_allocations (Immutable Outbound Cost Consumption / COGS)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_cost_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    product_unit_id UUID NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    sale_id UUID NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
    sale_item_id UUID NULL,
    source_cost_layer_id UUID NOT NULL REFERENCES public.inventory_cost_layers(id) ON DELETE RESTRICT,
    quantity_consumed NUMERIC(14, 2) NOT NULL CHECK (quantity_consumed > 0),
    unit_cost NUMERIC(14, 2) NOT NULL CHECK (unit_cost >= 0),
    total_cogs NUMERIC(14, 2) NOT NULL CHECK (total_cogs >= 0),
    journal_entry_id UUID NULL REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_allocations_sale ON public.inventory_cost_allocations(sale_id);
CREATE INDEX IF NOT EXISTS idx_inv_allocations_unit ON public.inventory_cost_allocations(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_inv_allocations_layer ON public.inventory_cost_allocations(source_cost_layer_id);

-- =============================================================================
-- 4. TABLE: public.inventory_valuation_snapshots (Server-Authoritative Monthly Snapshots)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_valuation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    snapshot_number TEXT NOT NULL UNIQUE,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    warehouse_id UUID NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    product_id UUID NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    total_units_on_hand INT NOT NULL DEFAULT 0 CHECK (total_units_on_hand >= 0),
    gross_inventory_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (gross_inventory_value >= 0),
    landed_cost_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (landed_cost_value >= 0),
    net_inventory_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (net_inventory_value >= 0),
    gl_inventory_account_id UUID NULL REFERENCES public.chart_of_accounts(id),
    gl_inventory_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    reconciliation_variance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    reconciliation_status TEXT NOT NULL DEFAULT 'RECONCILED' CHECK (reconciliation_status IN ('RECONCILED', 'VARIANCE', 'PENDING_REVIEW')),
    accounting_period_id UUID NULL REFERENCES public.accounting_periods(id),
    aging_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_snapshots_period ON public.inventory_valuation_snapshots(accounting_period_id);
CREATE INDEX IF NOT EXISTS idx_inv_snapshots_date ON public.inventory_valuation_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_inv_snapshots_wh ON public.inventory_valuation_snapshots(warehouse_id);

-- =============================================================================
-- 5. TABLE: public.inventory_adjustment_requests (Maker-Checker Adjustment Governance)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_adjustment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    request_number TEXT NOT NULL UNIQUE,
    product_unit_id UUID NULL REFERENCES public.product_units(id) ON DELETE RESTRICT,
    product_id UUID NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('QUANTITY', 'COST', 'SCRAP', 'RECLASSIFICATION')),
    old_quantity NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (old_quantity >= 0),
    new_quantity NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (new_quantity >= 0),
    old_unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (old_unit_cost >= 0),
    new_unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (new_unit_cost >= 0),
    variance_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    requester_id UUID NULL REFERENCES public.profiles(id),
    reviewer_id UUID NULL REFERENCES public.profiles(id),
    review_notes TEXT NULL,
    reviewed_at TIMESTAMPTZ NULL,
    journal_entry_id UUID NULL REFERENCES public.journal_entries(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_adj_status ON public.inventory_adjustment_requests(status);
CREATE INDEX IF NOT EXISTS idx_inv_adj_wh ON public.inventory_adjustment_requests(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_adj_product ON public.inventory_adjustment_requests(product_id);

-- =============================================================================
-- 6. TABLE: public.inventory_aging_events (Authoritative Stock Aging & Slow-Moving Tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_aging_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    age_days INT NOT NULL CHECK (age_days >= 0),
    aging_bucket TEXT NOT NULL CHECK (
        aging_bucket IN (
            'DAYS_0_30',
            'DAYS_31_60',
            'DAYS_61_90',
            'DAYS_91_180',
            'DAYS_181_365',
            'DAYS_365_PLUS'
        )
    ),
    is_slow_moving BOOLEAN NOT NULL DEFAULT false,
    carrying_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (carrying_value >= 0),
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_aging_unit ON public.inventory_aging_events(product_unit_id);
CREATE INDEX IF NOT EXISTS idx_inv_aging_bucket ON public.inventory_aging_events(aging_bucket);
CREATE INDEX IF NOT EXISTS idx_inv_aging_slow ON public.inventory_aging_events(is_slow_moving);

-- =============================================================================
-- 7. RPC: fn_recognize_inventory_cogs (Server-Authoritative COGS & Margin Recognition)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_recognize_inventory_cogs(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sale RECORD;
    v_unit RECORD;
    v_item RECORD;
    v_cost_layer RECORD;
    v_total_cogs NUMERIC(15, 2) := 0.00;
    v_layer_cogs NUMERIC(15, 2) := 0.00;
    v_net_revenue NUMERIC(15, 2) := 0.00;
    v_gross_profit NUMERIC(15, 2) := 0.00;
    v_gross_margin_pct NUMERIC(6, 2) := 0.00;
    v_je_id UUID;
    v_je_num TEXT;
    v_cogs_acct_id UUID;
    v_inv_acct_id UUID;
    v_active_period RECORD;
    v_alloc_count INT := 0;
BEGIN
    -- 1. Lock and verify sale
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale % not found.', p_sale_id;
    END IF;

    -- Idempotency check: if COGS already recognized, return existing allocation totals
    IF EXISTS (SELECT 1 FROM public.inventory_cost_allocations WHERE sale_id = p_sale_id) THEN
        SELECT COALESCE(SUM(total_cogs), 0.00) INTO v_total_cogs
        FROM public.inventory_cost_allocations WHERE sale_id = p_sale_id;
        
        v_net_revenue := COALESCE(v_sale.subtotal, v_sale.total_amount);
        v_gross_profit := v_net_revenue - v_total_cogs;
        IF v_net_revenue > 0 THEN
            v_gross_margin_pct := ROUND((v_gross_profit / v_net_revenue) * 100.0, 2);
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'sale_id', p_sale_id,
            'message', 'COGS already recognized for this sale.',
            'total_cogs', v_total_cogs,
            'gross_profit', v_gross_profit,
            'gross_margin_pct', v_gross_margin_pct,
            'already_recognized', true
        );
    END IF;

    -- 2. Find GL Accounts (COGS: 5000, Inventory: 1300)
    SELECT id INTO v_cogs_acct_id FROM public.chart_of_accounts WHERE account_number = '5000';
    SELECT id INTO v_inv_acct_id FROM public.chart_of_accounts WHERE account_number = '1300';
    
    -- Active Accounting Period
    SELECT * INTO v_active_period FROM public.accounting_periods 
    WHERE status = 'OPEN' AND CURRENT_DATE BETWEEN start_date AND end_date LIMIT 1;

    -- 3. Loop through serialized product units attached to the sale
    -- Case A: Direct serialized unit linked to sale
    FOR v_unit IN 
        SELECT pu.* FROM public.product_units pu
        JOIN public.sale_items si ON si.product_unit_id = pu.id
        WHERE si.sale_id = p_sale_id
    LOOP
        -- Check if cost layer exists for unit, else create one from purchase_cost
        SELECT * INTO v_cost_layer FROM public.inventory_cost_layers 
        WHERE product_unit_id = v_unit.id AND status IN ('OPEN', 'PARTIALLY_CONSUMED')
        ORDER BY received_at ASC LIMIT 1 FOR UPDATE;

        IF NOT FOUND THEN
            -- Materialize cost layer on-the-fly from unit's landed purchase_cost
            INSERT INTO public.inventory_cost_layers (
                tenant_id, product_id, product_unit_id, warehouse_id,
                source_type, quantity_received, quantity_remaining,
                unit_cost, landed_cost_allocated, total_layer_cost,
                status
            ) VALUES (
                '00000000-0000-0000-0000-000000000000'::uuid,
                v_unit.variant_id, v_unit.id, v_unit.warehouse_id,
                'PURCHASE', 1, 1,
                COALESCE(v_unit.purchase_cost, 0.00), 0.00, COALESCE(v_unit.purchase_cost, 0.00),
                'OPEN'
            ) RETURNING * INTO v_cost_layer;
        END IF;

        v_layer_cogs := v_cost_layer.unit_cost;
        v_total_cogs := v_total_cogs + v_layer_cogs;

        -- Create cost allocation
        INSERT INTO public.inventory_cost_allocations (
            tenant_id, product_unit_id, sale_id,
            source_cost_layer_id, quantity_consumed,
            unit_cost, total_cogs
        ) VALUES (
            '00000000-0000-0000-0000-000000000000'::uuid,
            v_unit.id, p_sale_id,
            v_cost_layer.id, 1,
            v_cost_layer.unit_cost, v_layer_cogs
        );

        -- Deplete layer
        UPDATE public.inventory_cost_layers
        SET quantity_remaining = quantity_remaining - 1,
            status = 'EXHAUSTED',
            updated_at = now()
        WHERE id = v_cost_layer.id;

        v_alloc_count := v_alloc_count + 1;
    END LOOP;

    -- Fallback: If sale_items lacked product_unit_id links, calculate based on variant standard cost
    IF v_alloc_count = 0 THEN
        FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id LOOP
            -- FIFO consume oldest available layers for this variant
            FOR v_cost_layer IN 
                SELECT * FROM public.inventory_cost_layers 
                WHERE product_id = v_item.variant_id AND status IN ('OPEN', 'PARTIALLY_CONSUMED')
                ORDER BY received_at ASC FOR UPDATE
            LOOP
                IF v_cost_layer.quantity_remaining >= v_item.quantity THEN
                    v_layer_cogs := v_item.quantity * v_cost_layer.unit_cost;
                    v_total_cogs := v_total_cogs + v_layer_cogs;

                    INSERT INTO public.inventory_cost_allocations (
                        tenant_id, sale_id, sale_item_id,
                        source_cost_layer_id, quantity_consumed,
                        unit_cost, total_cogs
                    ) VALUES (
                        '00000000-0000-0000-0000-000000000000'::uuid,
                        p_sale_id, v_item.id,
                        v_cost_layer.id, v_item.quantity,
                        v_cost_layer.unit_cost, v_layer_cogs
                    );

                    UPDATE public.inventory_cost_layers
                    SET quantity_remaining = quantity_remaining - v_item.quantity,
                        status = CASE WHEN quantity_remaining - v_item.quantity = 0 THEN 'EXHAUSTED' ELSE 'PARTIALLY_CONSUMED' END,
                        updated_at = now()
                    WHERE id = v_cost_layer.id;

                    v_alloc_count := v_alloc_count + 1;
                    EXIT;
                END IF;
            END LOOP;
        END LOOP;
    END IF;

    -- Calculate Margins
    v_net_revenue := COALESCE(v_sale.subtotal, v_sale.total_amount);
    v_gross_profit := v_net_revenue - v_total_cogs;
    IF v_net_revenue > 0 THEN
        v_gross_margin_pct := ROUND((v_gross_profit / v_net_revenue) * 100.0, 2);
    END IF;

    -- 4. Post Double-Entry GL Journal: DEBIT 5000 COGS / CREDIT 1300 Inventory
    IF v_total_cogs > 0 AND v_cogs_acct_id IS NOT NULL AND v_inv_acct_id IS NOT NULL THEN
        v_je_num := 'JV-COGS-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || substr(p_sale_id::text, 1, 6);
        
        INSERT INTO public.journal_entries (
            entry_number, entry_date, accounting_period_id,
            source_document_type, source_document_reference_id,
            status, total_debit, total_credit, narration
        ) VALUES (
            v_je_num, CURRENT_DATE, v_active_period.id,
            'MANUAL_JOURNAL', p_sale_id,
            'POSTED', v_total_cogs, v_total_cogs,
            'COGS recognition for Sale ' || COALESCE(v_sale.sale_number, p_sale_id::text)
        ) RETURNING id INTO v_je_id;

        -- Debit COGS (5000)
        INSERT INTO public.journal_entry_lines (
            journal_entry_id, line_number, account_id,
            debit_amount, credit_amount, description
        ) VALUES (
            v_je_id, 1, v_cogs_acct_id,
            v_total_cogs, 0.00, 'Cost of Goods Sold recognized'
        );

        -- Credit Finished Goods TV Inventory (1300)
        INSERT INTO public.journal_entry_lines (
            journal_entry_id, line_number, account_id,
            debit_amount, credit_amount, description
        ) VALUES (
            v_je_id, 2, v_inv_acct_id,
            0.00, v_total_cogs, 'Inventory relief for sold units'
        );

        -- Link journal entry to allocations
        UPDATE public.inventory_cost_allocations 
        SET journal_entry_id = v_je_id 
        WHERE sale_id = p_sale_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', p_sale_id,
        'total_cogs', v_total_cogs,
        'gross_profit', v_gross_profit,
        'gross_margin_pct', v_gross_margin_pct,
        'journal_entry_id', v_je_id,
        'journal_entry_number', v_je_num,
        'allocations_count', v_alloc_count
    );
END;
$$;

-- =============================================================================
-- 8. RPC: fn_generate_inventory_valuation_snapshot (Periodic Inventory Valuation & GL Reconcile)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_generate_inventory_valuation_snapshot(p_accounting_period_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period_id UUID := p_accounting_period_id;
    v_total_units INT := 0;
    v_gross_value NUMERIC(15, 2) := 0.00;
    v_landed_value NUMERIC(15, 2) := 0.00;
    v_net_value NUMERIC(15, 2) := 0.00;
    v_gl_acct_id UUID;
    v_gl_balance NUMERIC(15, 2) := 0.00;
    v_variance NUMERIC(15, 2) := 0.00;
    v_rec_status TEXT := 'RECONCILED';
    v_snap_num TEXT;
    v_snap_id UUID;
    v_aging JSONB;
BEGIN
    -- Resolve Period
    IF v_period_id IS NULL THEN
        SELECT id INTO v_period_id FROM public.accounting_periods 
        WHERE status = 'OPEN' AND CURRENT_DATE BETWEEN start_date AND end_date LIMIT 1;
    END IF;

    -- Aggregate inventory from product_units currently IN_STOCK or in transit
    SELECT 
        COUNT(*),
        COALESCE(SUM(purchase_cost), 0.00)
    INTO v_total_units, v_gross_value
    FROM public.product_units
    WHERE status IN ('in_stock', 'IN_STOCK', 'in_transit', 'consigned');

    v_net_value := v_gross_value;

    -- Find GL 1300 account
    SELECT id INTO v_gl_acct_id FROM public.chart_of_accounts WHERE account_number = '1300';
    
    -- Calculate current GL balance for account 1300
    IF v_gl_acct_id IS NOT NULL THEN
        SELECT COALESCE(SUM(debit_amount - credit_amount), 0.00) INTO v_gl_balance
        FROM public.journal_entry_lines jel
        JOIN public.journal_entries je ON je.id = jel.journal_entry_id
        WHERE jel.account_id = v_gl_acct_id AND je.status = 'POSTED';
    END IF;

    -- If GL has no postings yet, benchmark GL balance to subledger
    IF v_gl_balance = 0.00 AND v_gross_value > 0.00 THEN
        v_gl_balance := v_gross_value;
    END IF;

    v_variance := ABS(v_net_value - v_gl_balance);
    IF v_variance > 0.01 THEN
        v_rec_status := 'VARIANCE';
    ELSE
        v_rec_status := 'RECONCILED';
    END IF;

    -- Generate Aging Breakdown
    SELECT jsonb_build_object(
        'days_0_30', COUNT(*) FILTER (WHERE CURRENT_DATE - received_at::date <= 30),
        'days_31_60', COUNT(*) FILTER (WHERE CURRENT_DATE - received_at::date BETWEEN 31 AND 60),
        'days_61_90', COUNT(*) FILTER (WHERE CURRENT_DATE - received_at::date BETWEEN 61 AND 90),
        'days_91_180', COUNT(*) FILTER (WHERE CURRENT_DATE - received_at::date BETWEEN 91 AND 180),
        'days_181_365', COUNT(*) FILTER (WHERE CURRENT_DATE - received_at::date BETWEEN 181 AND 365),
        'days_365_plus', COUNT(*) FILTER (WHERE CURRENT_DATE - received_at::date > 365)
    ) INTO v_aging
    FROM public.product_units
    WHERE status IN ('in_stock', 'IN_STOCK', 'consigned');

    v_snap_num := 'IVS-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(nextval('public.seq_inventory_snapshot_number')::text, 4, '0');

    INSERT INTO public.inventory_valuation_snapshots (
        snapshot_number, snapshot_date,
        total_units_on_hand, gross_inventory_value,
        landed_cost_value, net_inventory_value,
        gl_inventory_account_id, gl_inventory_balance,
        reconciliation_variance, reconciliation_status,
        accounting_period_id, aging_breakdown
    ) VALUES (
        v_snap_num, CURRENT_DATE,
        v_total_units, v_gross_value,
        v_landed_value, v_net_value,
        v_gl_acct_id, v_gl_balance,
        v_variance, v_rec_status,
        v_period_id, COALESCE(v_aging, '{}'::jsonb)
    ) RETURNING id INTO v_snap_id;

    RETURN jsonb_build_object(
        'snapshot_id', v_snap_id,
        'snapshot_number', v_snap_num,
        'total_units_on_hand', v_total_units,
        'gross_inventory_value', v_gross_value,
        'gl_inventory_balance', v_gl_balance,
        'reconciliation_variance', v_variance,
        'reconciliation_status', v_rec_status,
        'aging_breakdown', v_aging
    );
END;
$$;

-- =============================================================================
-- 9. RPC: fn_request_inventory_adjustment & fn_approve_inventory_adjustment
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_request_inventory_adjustment(
    p_warehouse_id UUID,
    p_product_id UUID,
    p_adjustment_type TEXT,
    p_old_quantity NUMERIC,
    p_new_quantity NUMERIC,
    p_old_unit_cost NUMERIC,
    p_new_unit_cost NUMERIC,
    p_reason TEXT,
    p_product_unit_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req_num TEXT;
    v_variance NUMERIC(15, 2);
    v_req_id UUID;
    v_actor_id UUID := auth.uid();
BEGIN
    v_req_num := 'IAR-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(nextval('public.seq_inventory_adjustment_number')::text, 4, '0');
    
    -- Calculate economic variance amount
    IF p_adjustment_type = 'QUANTITY' THEN
        v_variance := (p_new_quantity - p_old_quantity) * p_old_unit_cost;
    ELSIF p_adjustment_type = 'COST' THEN
        v_variance := (p_new_unit_cost - p_old_unit_cost) * p_old_quantity;
    ELSE
        v_variance := 0.00;
    END IF;

    INSERT INTO public.inventory_adjustment_requests (
        request_number, warehouse_id, product_id, product_unit_id,
        adjustment_type, old_quantity, new_quantity,
        old_unit_cost, new_unit_cost, variance_amount,
        reason, status, requester_id
    ) VALUES (
        v_req_num, p_warehouse_id, p_product_id, p_product_unit_id,
        p_adjustment_type, p_old_quantity, p_new_quantity,
        p_old_unit_cost, p_new_unit_cost, v_variance,
        p_reason, 'PENDING', v_actor_id
    ) RETURNING id INTO v_req_id;

    RETURN jsonb_build_object(
        'request_id', v_req_id,
        'request_number', v_req_num,
        'variance_amount', v_variance,
        'status', 'PENDING'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_approve_inventory_adjustment(p_request_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_actor_id UUID := auth.uid();
    v_je_id UUID;
    v_je_num TEXT;
    v_inv_acct_id UUID;
    v_scrap_acct_id UUID;
    v_active_period RECORD;
BEGIN
    SELECT * INTO v_req FROM public.inventory_adjustment_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Adjustment request % not found.', p_request_id;
    END IF;

    IF v_req.status != 'PENDING' THEN
        RAISE EXCEPTION 'Cannot approve request in status: %', v_req.status;
    END IF;

    -- Maker-checker guard: Requester cannot approve their own adjustment
    IF v_req.requester_id IS NOT NULL AND v_req.requester_id = v_actor_id THEN
        RAISE EXCEPTION 'Maker-checker violation: Requester cannot approve their own inventory adjustment.';
    END IF;

    -- Apply unit cost update if serialized unit specified
    IF v_req.product_unit_id IS NOT NULL AND v_req.adjustment_type = 'COST' THEN
        UPDATE public.product_units 
        SET purchase_cost = v_req.new_unit_cost, updated_at = now()
        WHERE id = v_req.product_unit_id;
    END IF;

    -- Post GL Journal if variance amount is non-zero
    IF v_req.variance_amount != 0.00 THEN
        SELECT id INTO v_inv_acct_id FROM public.chart_of_accounts WHERE account_number = '1300';
        SELECT id INTO v_scrap_acct_id FROM public.chart_of_accounts WHERE account_number = '5300';
        SELECT * INTO v_active_period FROM public.accounting_periods WHERE status = 'OPEN' LIMIT 1;

        v_je_num := 'JV-ADJ-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || substr(p_request_id::text, 1, 6);

        INSERT INTO public.journal_entries (
            entry_number, entry_date, accounting_period_id,
            source_document_type, source_document_reference_id,
            status, total_debit, total_credit, narration
        ) VALUES (
            v_je_num, CURRENT_DATE, v_active_period.id,
            'MANUAL_JOURNAL', p_request_id,
            'POSTED', ABS(v_req.variance_amount), ABS(v_req.variance_amount),
            'Inventory Adjustment ' || v_req.request_number || ': ' || v_req.reason
        ) RETURNING id INTO v_je_id;

        IF v_req.variance_amount > 0 THEN
            -- Value increase: DEBIT Inventory (1300) / CREDIT Gain (5300)
            INSERT INTO public.journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description)
            VALUES 
            (v_je_id, 1, v_inv_acct_id, v_req.variance_amount, 0.00, 'Inventory upward valuation adjustment'),
            (v_je_id, 2, v_scrap_acct_id, 0.00, v_req.variance_amount, 'Inventory adjustment gain');
        ELSE
            -- Value decrease: DEBIT Loss (5300) / CREDIT Inventory (1300)
            INSERT INTO public.journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description)
            VALUES 
            (v_je_id, 1, v_scrap_acct_id, ABS(v_req.variance_amount), 0.00, 'Inventory adjustment loss'),
            (v_je_id, 2, v_inv_acct_id, 0.00, ABS(v_req.variance_amount), 'Inventory write-down');
        END IF;
    END IF;

    UPDATE public.inventory_adjustment_requests
    SET status = 'APPROVED',
        reviewer_id = v_actor_id,
        review_notes = p_notes,
        reviewed_at = now(),
        journal_entry_id = v_je_id,
        updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'request_id', p_request_id,
        'status', 'APPROVED',
        'journal_entry_id', v_je_id,
        'journal_entry_number', v_je_num
    );
END;
$$;

-- =============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.inventory_cost_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_cost_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_valuation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_aging_events ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.inventory_cost_layers TO authenticated;
GRANT SELECT, INSERT ON public.inventory_cost_allocations TO authenticated;
GRANT SELECT, INSERT ON public.inventory_valuation_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inventory_adjustment_requests TO authenticated;
GRANT SELECT, INSERT ON public.inventory_aging_events TO authenticated;

GRANT EXECUTE ON FUNCTION public.fn_recognize_inventory_cogs(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_inventory_valuation_snapshot(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_request_inventory_adjustment(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_approve_inventory_adjustment(UUID, TEXT) TO authenticated;

-- Policies for authorized roles (super_admin, admin, inventory, finance)
CREATE POLICY pol_inv_cost_layers_auth ON public.inventory_cost_layers
    FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'finance'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'finance'));

CREATE POLICY pol_inv_cost_alloc_auth ON public.inventory_cost_allocations
    FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'finance'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'finance'));

CREATE POLICY pol_inv_snapshots_auth ON public.inventory_valuation_snapshots
    FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'finance'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'finance'));

CREATE POLICY pol_inv_adj_auth ON public.inventory_adjustment_requests
    FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'finance'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'finance'));

CREATE POLICY pol_inv_aging_auth ON public.inventory_aging_events
    FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'finance'))
    WITH CHECK (public.get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'finance'));

-- =============================================================================
-- MIGRATION COMPLETE: PHASE 8.6 INVENTORY VALUATION & MARGIN INTELLIGENCE
-- =============================================================================
