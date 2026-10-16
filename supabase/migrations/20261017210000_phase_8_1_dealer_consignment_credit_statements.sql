-- ============================================================================
-- PHASE 8.1 — ADVANCED B2B CONSIGNMENT SETTLEMENTS, REAL-TIME DEALER CREDIT LIMIT ENGINE & AUTOMATED STATEMENTS
-- ZUVO TV CRM
-- ============================================================================

-- 1. Create dealer_credit_policies table
CREATE TABLE IF NOT EXISTS public.dealer_credit_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    credit_limit NUMERIC NOT NULL DEFAULT 500000.00 CHECK (credit_limit >= 0),
    warning_threshold_pct NUMERIC NOT NULL DEFAULT 80.00 CHECK (warning_threshold_pct BETWEEN 0 AND 100),
    hard_block_threshold_pct NUMERIC NOT NULL DEFAULT 100.00 CHECK (hard_block_threshold_pct >= warning_threshold_pct),
    grace_period_days INT NOT NULL DEFAULT 15 CHECK (grace_period_days >= 0),
    overdue_block_days INT NOT NULL DEFAULT 30 CHECK (overdue_block_days >= grace_period_days),
    manual_hold BOOLEAN NOT NULL DEFAULT FALSE,
    manual_hold_reason TEXT,
    manual_hold_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    manual_hold_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT dealer_credit_policies_dealer_unique UNIQUE (dealer_id)
);

-- 2. Create dealer_credit_exposure_snapshots table
CREATE TABLE IF NOT EXISTS public.dealer_credit_exposure_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    credit_limit NUMERIC NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
    outstanding_consignment_value NUMERIC NOT NULL DEFAULT 0 CHECK (outstanding_consignment_value >= 0),
    unpaid_sales_value NUMERIC NOT NULL DEFAULT 0 CHECK (unpaid_sales_value >= 0),
    pending_settlement_value NUMERIC NOT NULL DEFAULT 0 CHECK (pending_settlement_value >= 0),
    overdue_amount NUMERIC NOT NULL DEFAULT 0 CHECK (overdue_amount >= 0),
    oldest_overdue_days INT NOT NULL DEFAULT 0 CHECK (oldest_overdue_days >= 0),
    credit_adjustments_net NUMERIC NOT NULL DEFAULT 0,
    total_exposure NUMERIC NOT NULL DEFAULT 0,
    available_credit NUMERIC NOT NULL DEFAULT 0,
    utilization_pct NUMERIC NOT NULL DEFAULT 0 CHECK (utilization_pct >= 0),
    risk_state TEXT NOT NULL CHECK (risk_state IN ('AVAILABLE', 'WARNING', 'NEAR_LIMIT', 'LIMIT_EXCEEDED', 'OVERDUE_BLOCK', 'MANUAL_HOLD')),
    dispatch_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    blocking_reason TEXT,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create dealer_financial_adjustments table (credit notes, debit adjustments, payments received)
CREATE TABLE IF NOT EXISTS public.dealer_financial_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_number TEXT NOT NULL UNIQUE,
    dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('CREDIT_NOTE', 'DEBIT_ADJUSTMENT', 'PAYMENT_RECEIVED', 'REBATE', 'SETTLEMENT_PAYOUT')),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    reference_id TEXT,
    idempotency_key UUID,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('PENDING', 'POSTED', 'VOIDED')),
    posted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT dealer_fin_adj_idempotency_unique UNIQUE (idempotency_key)
);

-- 4. Create dealer_statements table (Monthly/Quarterly Financial Snapshot)
CREATE TABLE IF NOT EXISTS public.dealer_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_number TEXT NOT NULL UNIQUE,
    dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    statement_type TEXT NOT NULL CHECK (statement_type IN ('MONTHLY', 'QUARTERLY', 'AD_HOC')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    opening_balance NUMERIC NOT NULL DEFAULT 0,
    consignments_dispatched_val NUMERIC NOT NULL DEFAULT 0 CHECK (consignments_dispatched_val >= 0),
    consignments_returned_val NUMERIC NOT NULL DEFAULT 0 CHECK (consignments_returned_val >= 0),
    sales_reported_val NUMERIC NOT NULL DEFAULT 0 CHECK (sales_reported_val >= 0),
    settlements_completed_val NUMERIC NOT NULL DEFAULT 0 CHECK (settlements_completed_val >= 0),
    credit_notes_val NUMERIC NOT NULL DEFAULT 0 CHECK (credit_notes_val >= 0),
    debit_adjustments_val NUMERIC NOT NULL DEFAULT 0 CHECK (debit_adjustments_val >= 0),
    payments_received_val NUMERIC NOT NULL DEFAULT 0 CHECK (payments_received_val >= 0),
    closing_balance NUMERIC NOT NULL DEFAULT 0,
    credit_limit NUMERIC NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
    available_credit NUMERIC NOT NULL DEFAULT 0,
    overdue_amount NUMERIC NOT NULL DEFAULT 0 CHECK (overdue_amount >= 0),
    aging_0_30_val NUMERIC NOT NULL DEFAULT 0 CHECK (aging_0_30_val >= 0),
    aging_31_60_val NUMERIC NOT NULL DEFAULT 0 CHECK (aging_31_60_val >= 0),
    aging_61_90_val NUMERIC NOT NULL DEFAULT 0 CHECK (aging_61_90_val >= 0),
    aging_91_120_val NUMERIC NOT NULL DEFAULT 0 CHECK (aging_91_120_val >= 0),
    aging_120_plus_val NUMERIC NOT NULL DEFAULT 0 CHECK (aging_120_plus_val >= 0),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'GENERATED', 'FINALIZED', 'VOIDED')),
    generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    finalized_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    finalized_at TIMESTAMPTZ,
    voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    voided_at TIMESTAMPTZ,
    void_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT dealer_statement_period_unique UNIQUE (dealer_id, statement_type, period_start, period_end)
);

-- 5. Create dealer_statement_items table (Itemized Ledger Entries per Statement)
CREATE TABLE IF NOT EXISTS public.dealer_statement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id UUID NOT NULL REFERENCES public.dealer_statements(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('CONSIGNMENT_DISPATCH', 'CONSIGNMENT_RETURN', 'SALE', 'SETTLEMENT', 'CREDIT_NOTE', 'DEBIT_ADJUSTMENT', 'PAYMENT')),
    reference_number TEXT NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL,
    product_unit_id UUID REFERENCES public.product_units(id) ON DELETE SET NULL,
    barcode TEXT,
    model_name TEXT,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    unit_value NUMERIC NOT NULL DEFAULT 0 CHECK (unit_value >= 0),
    debit_amount NUMERIC NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount NUMERIC NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
    running_balance NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Create dealer_recall_recommendations table (Stagnant Stock Automation)
CREATE TABLE IF NOT EXISTS public.dealer_recall_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_number TEXT NOT NULL UNIQUE,
    dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE CASCADE,
    consignment_id UUID REFERENCES public.dealer_consignment_stock(id) ON DELETE SET NULL,
    age_days INT NOT NULL CHECK (age_days >= 0),
    unit_cost_value NUMERIC NOT NULL DEFAULT 0 CHECK (unit_cost_value >= 0),
    stagnant_severity TEXT NOT NULL CHECK (stagnant_severity IN ('WARNING', 'RECALL_RECOMMENDED', 'CRITICAL')),
    trigger_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'APPROVED', 'REJECTED', 'RECALL_INITIATED', 'CLOSED')),
    action_notes TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    recall_request_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT dealer_recall_rec_unit_active_unique UNIQUE (product_unit_id, status)
);

-- 7. Create dealer_recall_requests table (Formal Logistics & Disposition of Recalled Stock)
CREATE TABLE IF NOT EXISTS public.dealer_recall_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recall_reference TEXT NOT NULL UNIQUE,
    dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    to_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    recommendation_id UUID REFERENCES public.dealer_recall_recommendations(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'INITIATED' CHECK (status IN ('INITIATED', 'IN_TRANSIT', 'RECEIVED_AT_WAREHOUSE', 'INSPECTED', 'RESTOCKED', 'CANCELLED')),
    approved_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at TIMESTAMPTZ,
    received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    disposition_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Add Foreign Key linkage back to recall request from recommendation
ALTER TABLE public.dealer_recall_recommendations 
    DROP CONSTRAINT IF EXISTS fk_dealer_rec_recall_request;
ALTER TABLE public.dealer_recall_recommendations 
    ADD CONSTRAINT fk_dealer_rec_recall_request 
    FOREIGN KEY (recall_request_id) REFERENCES public.dealer_recall_requests(id) ON DELETE SET NULL;

-- 9. Create dealer_recall_request_items table
CREATE TABLE IF NOT EXISTS public.dealer_recall_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recall_request_id UUID NOT NULL REFERENCES public.dealer_recall_requests(id) ON DELETE CASCADE,
    product_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE CASCADE,
    consignment_id UUID REFERENCES public.dealer_consignment_stock(id) ON DELETE SET NULL,
    unit_cost_value NUMERIC NOT NULL DEFAULT 0,
    condition_on_receipt TEXT CHECK (condition_on_receipt IS NULL OR condition_on_receipt IN ('PRISTINE', 'DAMAGED_BOX', 'DEFECTIVE_PANEL', 'MISSING_ACCESSORIES')),
    disposition TEXT CHECK (disposition IS NULL OR disposition IN ('RETURN_TO_PRIMARY_STOCK', 'REFURB_DEPOT', 'SCRAP')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT dealer_recall_req_unit_unique UNIQUE (recall_request_id, product_unit_id)
);

-- 10. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_dealer_credit_policies_dealer ON public.dealer_credit_policies(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_exposure_dealer ON public.dealer_credit_exposure_snapshots(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_fin_adj_dealer ON public.dealer_financial_adjustments(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_statements_dealer ON public.dealer_statements(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_statement_items_statement ON public.dealer_statement_items(statement_id);
CREATE INDEX IF NOT EXISTS idx_dealer_recall_rec_dealer ON public.dealer_recall_recommendations(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_recall_rec_status ON public.dealer_recall_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_dealer_recall_req_dealer ON public.dealer_recall_requests(dealer_id);

-- 11. Row Level Security
ALTER TABLE public.dealer_credit_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_credit_exposure_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_financial_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_statement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_recall_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_recall_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_recall_request_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Staff manage dealer credit policies" ON public.dealer_credit_policies;
DROP POLICY IF EXISTS "Dealers view own credit policy" ON public.dealer_credit_policies;
CREATE POLICY "Staff manage dealer credit policies"
    ON public.dealer_credit_policies FOR ALL
    USING (get_current_user_role() IN ('super_admin', 'admin', 'finance', 'sales'));
CREATE POLICY "Dealers view own credit policy"
    ON public.dealer_credit_policies FOR SELECT
    USING (get_current_user_role() = 'dealer' AND dealer_id = get_current_user_dealer_id());

DROP POLICY IF EXISTS "Staff manage dealer exposure snapshots" ON public.dealer_credit_exposure_snapshots;
DROP POLICY IF EXISTS "Dealers view own exposure snapshots" ON public.dealer_credit_exposure_snapshots;
CREATE POLICY "Staff manage dealer exposure snapshots"
    ON public.dealer_credit_exposure_snapshots FOR ALL
    USING (get_current_user_role() IN ('super_admin', 'admin', 'finance', 'sales'));
CREATE POLICY "Dealers view own exposure snapshots"
    ON public.dealer_credit_exposure_snapshots FOR SELECT
    USING (get_current_user_role() = 'dealer' AND dealer_id = get_current_user_dealer_id());

DROP POLICY IF EXISTS "Staff manage financial adjustments" ON public.dealer_financial_adjustments;
DROP POLICY IF EXISTS "Dealers view own financial adjustments" ON public.dealer_financial_adjustments;
CREATE POLICY "Staff manage financial adjustments"
    ON public.dealer_financial_adjustments FOR ALL
    USING (get_current_user_role() IN ('super_admin', 'admin', 'finance'));
CREATE POLICY "Dealers view own financial adjustments"
    ON public.dealer_financial_adjustments FOR SELECT
    USING (get_current_user_role() = 'dealer' AND dealer_id = get_current_user_dealer_id());

DROP POLICY IF EXISTS "Staff manage dealer statements" ON public.dealer_statements;
DROP POLICY IF EXISTS "Dealers view own statements" ON public.dealer_statements;
CREATE POLICY "Staff manage dealer statements"
    ON public.dealer_statements FOR ALL
    USING (get_current_user_role() IN ('super_admin', 'admin', 'finance', 'sales'));
CREATE POLICY "Dealers view own statements"
    ON public.dealer_statements FOR SELECT
    USING (get_current_user_role() = 'dealer' AND dealer_id = get_current_user_dealer_id());

DROP POLICY IF EXISTS "Staff manage statement items" ON public.dealer_statement_items;
DROP POLICY IF EXISTS "Dealers view own statement items" ON public.dealer_statement_items;
CREATE POLICY "Staff manage statement items"
    ON public.dealer_statement_items FOR ALL
    USING (get_current_user_role() IN ('super_admin', 'admin', 'finance', 'sales'));
CREATE POLICY "Dealers view own statement items"
    ON public.dealer_statement_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.dealer_statements ds
        WHERE ds.id = statement_id
          AND get_current_user_role() = 'dealer'
          AND ds.dealer_id = get_current_user_dealer_id()
    ));

DROP POLICY IF EXISTS "Staff manage recall recommendations" ON public.dealer_recall_recommendations;
CREATE POLICY "Staff manage recall recommendations"
    ON public.dealer_recall_recommendations FOR ALL
    USING (get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'sales', 'management'));

DROP POLICY IF EXISTS "Staff manage recall requests" ON public.dealer_recall_requests;
DROP POLICY IF EXISTS "Dealers view own recall requests" ON public.dealer_recall_requests;
CREATE POLICY "Staff manage recall requests"
    ON public.dealer_recall_requests FOR ALL
    USING (get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'management'));
CREATE POLICY "Dealers view own recall requests"
    ON public.dealer_recall_requests FOR SELECT
    USING (get_current_user_role() = 'dealer' AND dealer_id = get_current_user_dealer_id());

DROP POLICY IF EXISTS "Staff manage recall request items" ON public.dealer_recall_request_items;
DROP POLICY IF EXISTS "Dealers view own recall items" ON public.dealer_recall_request_items;
CREATE POLICY "Staff manage recall request items"
    ON public.dealer_recall_request_items FOR ALL
    USING (get_current_user_role() IN ('super_admin', 'admin', 'inventory', 'management'));
CREATE POLICY "Dealers view own recall items"
    ON public.dealer_recall_request_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.dealer_recall_requests drr
        WHERE drr.id = recall_request_id
          AND get_current_user_role() = 'dealer'
          AND drr.dealer_id = get_current_user_dealer_id()
    ));

-- ============================================================================
-- AUTHORITATIVE SERVER-SIDE RPCS
-- ============================================================================

-- A. Credit Limit & Exposure Evaluation RPC
CREATE OR REPLACE FUNCTION public.fn_evaluate_dealer_credit_exposure(p_dealer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_credit_limit NUMERIC := 0;
    v_warning_pct NUMERIC := 80.00;
    v_hard_block_pct NUMERIC := 100.00;
    v_grace_days INT := 15;
    v_overdue_block_days INT := 30;
    v_manual_hold BOOLEAN := FALSE;
    v_manual_hold_reason TEXT := NULL;

    v_consignment_val NUMERIC := 0;
    v_unpaid_sales_val NUMERIC := 0;
    v_pending_settlement_val NUMERIC := 0;
    v_adjustments_net NUMERIC := 0;
    v_overdue_amount NUMERIC := 0;
    v_oldest_overdue_days INT := 0;

    v_total_exposure NUMERIC := 0;
    v_available_credit NUMERIC := 0;
    v_utilization_pct NUMERIC := 0;
    v_risk_state TEXT := 'AVAILABLE';
    v_dispatch_allowed BOOLEAN := TRUE;
    v_blocking_reason TEXT := NULL;
    v_dealer RECORD;
BEGIN
    -- 1. Verify Dealer Exists
    SELECT * INTO v_dealer FROM public.dealers WHERE id = p_dealer_id;
    IF v_dealer.id IS NULL THEN
        RAISE EXCEPTION 'Dealer % not found', p_dealer_id;
    END IF;

    -- 2. Fetch or initialize policy
    SELECT 
        credit_limit, warning_threshold_pct, hard_block_threshold_pct,
        grace_period_days, overdue_block_days, manual_hold, manual_hold_reason
    INTO 
        v_credit_limit, v_warning_pct, v_hard_block_pct,
        v_grace_days, v_overdue_block_days, v_manual_hold, v_manual_hold_reason
    FROM public.dealer_credit_policies
    WHERE dealer_id = p_dealer_id;

    IF v_credit_limit IS NULL THEN
        v_credit_limit := COALESCE(v_dealer.credit_limit, 500000.00);
    END IF;

    -- 3. Calculate Outstanding Consignment Value (Stock physically with dealer or in transit)
    SELECT COALESCE(SUM(pu.purchase_cost), 0)
    INTO v_consignment_val
    FROM public.dealer_consignment_stock cs
    JOIN public.product_units pu ON pu.id = cs.product_unit_id
    WHERE cs.dealer_id = p_dealer_id
      AND cs.consignment_status IN ('dispatched', 'received', 'available', 'reserved', 'disputed');

    -- 4. Calculate Pending Settlements and Unpaid Sales
    SELECT COALESCE(SUM(s.total_amount), 0)
    INTO v_unpaid_sales_val
    FROM public.sales s
    WHERE s.dealer_id = p_dealer_id
      AND s.payment_status != 'paid';

    SELECT COALESCE(SUM(pu.purchase_cost), 0)
    INTO v_pending_settlement_val
    FROM public.dealer_consignment_stock cs
    JOIN public.product_units pu ON pu.id = cs.product_unit_id
    WHERE cs.dealer_id = p_dealer_id
      AND cs.consignment_status = 'sold'
      AND cs.settlement_status = 'pending';

    -- 5. Calculate Financial Adjustments Net (Debit adjustments increase liability, Credit notes / Payments reduce liability)
    SELECT COALESCE(SUM(
        CASE 
            WHEN adjustment_type IN ('DEBIT_ADJUSTMENT') THEN amount
            WHEN adjustment_type IN ('CREDIT_NOTE', 'PAYMENT_RECEIVED', 'REBATE') THEN -amount
            ELSE 0 
        END
    ), 0)
    INTO v_adjustments_net
    FROM public.dealer_financial_adjustments
    WHERE dealer_id = p_dealer_id
      AND status = 'POSTED';

    -- 6. Evaluate Overdue Liability & Days
    SELECT 
        COALESCE(SUM(s.total_amount), 0),
        COALESCE(MAX(EXTRACT(DAY FROM (NOW() - s.sale_date))::INT), 0)
    INTO v_overdue_amount, v_oldest_overdue_days
    FROM public.sales s
    WHERE s.dealer_id = p_dealer_id
      AND s.payment_status != 'paid'
      AND EXTRACT(DAY FROM (NOW() - s.sale_date)) > v_grace_days;

    -- 7. Net Exposure
    v_total_exposure := GREATEST(0, v_consignment_val + v_unpaid_sales_val + v_pending_settlement_val + v_adjustments_net);
    v_available_credit := GREATEST(0, v_credit_limit - v_total_exposure);

    IF v_credit_limit > 0 THEN
        v_utilization_pct := ROUND((v_total_exposure / v_credit_limit) * 100, 2);
    ELSE
        v_utilization_pct := CASE WHEN v_total_exposure > 0 THEN 100.00 ELSE 0.00 END;
    END IF;

    -- 8. Authoritative Credit Risk State Evaluation
    IF v_manual_hold THEN
        v_risk_state := 'MANUAL_HOLD';
        v_dispatch_allowed := FALSE;
        v_blocking_reason := COALESCE(v_manual_hold_reason, 'Account placed on manual hold by credit management');
    ELSIF v_oldest_overdue_days >= v_overdue_block_days THEN
        v_risk_state := 'OVERDUE_BLOCK';
        v_dispatch_allowed := FALSE;
        v_blocking_reason := 'Overdue balance aged ' || v_oldest_overdue_days || ' days exceeds threshold of ' || v_overdue_block_days || ' days';
    ELSIF v_total_exposure >= v_credit_limit AND v_credit_limit > 0 THEN
        v_risk_state := 'LIMIT_EXCEEDED';
        v_dispatch_allowed := FALSE;
        v_blocking_reason := 'Total exposure (₹' || v_total_exposure || ') exceeds approved credit limit (₹' || v_credit_limit || ')';
    ELSIF v_utilization_pct >= v_warning_pct THEN
        IF v_utilization_pct >= 95.00 THEN
            v_risk_state := 'NEAR_LIMIT';
        ELSE
            v_risk_state := 'WARNING';
        END IF;
        v_dispatch_allowed := TRUE;
    ELSE
        v_risk_state := 'AVAILABLE';
        v_dispatch_allowed := TRUE;
    END IF;

    -- 9. Persist snapshot for historical audit trail
    INSERT INTO public.dealer_credit_exposure_snapshots (
        dealer_id, credit_limit, outstanding_consignment_value,
        unpaid_sales_value, pending_settlement_value, overdue_amount,
        oldest_overdue_days, credit_adjustments_net, total_exposure,
        available_credit, utilization_pct, risk_state, dispatch_allowed,
        blocking_reason
    ) VALUES (
        p_dealer_id, v_credit_limit, v_consignment_val,
        v_unpaid_sales_val, v_pending_settlement_val, v_overdue_amount,
        v_oldest_overdue_days, v_adjustments_net, v_total_exposure,
        v_available_credit, v_utilization_pct, v_risk_state, v_dispatch_allowed,
        v_blocking_reason
    );

    RETURN jsonb_build_object(
        'dealer_id', p_dealer_id,
        'credit_limit', v_credit_limit,
        'current_exposure', v_total_exposure,
        'outstanding_consignment_value', v_consignment_val,
        'unpaid_sales_value', v_unpaid_sales_val,
        'pending_settlement_value', v_pending_settlement_val,
        'available_credit', v_available_credit,
        'utilization_percent', v_utilization_pct,
        'overdue_amount', v_overdue_amount,
        'oldest_overdue_days', v_oldest_overdue_days,
        'risk_state', v_risk_state,
        'dispatch_allowed', v_dispatch_allowed,
        'blocking_reason', v_blocking_reason
    );
END;
$$;

-- B. Atomic Dispatch Credit Gate RPC (Protects Dispatches from Race Conditions)
CREATE OR REPLACE FUNCTION public.fn_validate_consignment_dispatch_gate(
    p_dealer_id UUID,
    p_requested_unit_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_credit_eval JSONB;
    v_requested_val NUMERIC := 0;
    v_current_exposure NUMERIC;
    v_credit_limit NUMERIC;
    v_projected_exposure NUMERIC;
    v_available_credit NUMERIC;
    v_dispatch_allowed BOOLEAN;
    v_blocking_reason TEXT;
    v_risk_state TEXT;
BEGIN
    -- 1. Lock dealer row to serialize concurrent dispatch attempts
    PERFORM 1 FROM public.dealers WHERE id = p_dealer_id FOR UPDATE;

    -- 2. Calculate requested dispatch value
    SELECT COALESCE(SUM(purchase_cost), 0)
    INTO v_requested_val
    FROM public.product_units
    WHERE id = ANY(p_requested_unit_ids);

    -- 3. Authoritatively evaluate current exposure
    v_credit_eval := public.fn_evaluate_dealer_credit_exposure(p_dealer_id);
    v_current_exposure := (v_credit_eval->>'current_exposure')::NUMERIC;
    v_credit_limit := (v_credit_eval->>'credit_limit')::NUMERIC;
    v_dispatch_allowed := (v_credit_eval->>'dispatch_allowed')::BOOLEAN;
    v_blocking_reason := v_credit_eval->>'blocking_reason';
    v_risk_state := v_credit_eval->>'risk_state';

    -- 4. If current state is blocked, reject immediately
    IF NOT v_dispatch_allowed THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'blockedBy', v_risk_state,
            'reason', v_blocking_reason,
            'currentExposure', v_current_exposure,
            'creditLimit', v_credit_limit
        );
    END IF;

    -- 5. Calculate projected exposure
    v_projected_exposure := v_current_exposure + v_requested_val;
    v_available_credit := GREATEST(0, v_credit_limit - v_current_exposure);

    IF v_credit_limit > 0 AND v_projected_exposure > v_credit_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'blockedBy', 'CREDIT_LIMIT_EXCEEDED',
            'reason', 'Requested dispatch value (₹' || v_requested_val || ') pushes projected exposure (₹' || v_projected_exposure || ') beyond approved credit limit (₹' || v_credit_limit || ')',
            'currentExposure', v_current_exposure,
            'requestedValue', v_requested_val,
            'projectedExposure', v_projected_exposure,
            'availableCredit', v_available_credit
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'currentExposure', v_current_exposure,
        'requestedValue', v_requested_val,
        'projectedExposure', v_projected_exposure,
        'availableCredit', v_available_credit,
        'warning', CASE WHEN (v_projected_exposure / NULLIF(v_credit_limit, 0)) >= 0.80 THEN 'High Credit Utilization Warning' ELSE NULL END
    );
END;
$$;

-- C. Enforce Credit Gate inside fn_dispatch_consignment_to_dealer
CREATE OR REPLACE FUNCTION public.fn_dispatch_consignment_to_dealer(
  p_dealer_id UUID,
  p_product_unit_ids UUID[],
  p_warehouse_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_unit_id UUID;
  v_dispatched_count INT := 0;
  v_unit RECORD;
  v_consignment_id UUID;
  v_gate_result JSONB;
BEGIN
  v_role := get_current_user_role();
  IF v_role NOT IN ('super_admin', 'admin', 'sales', 'inventory') THEN
    RAISE EXCEPTION 'Unauthorized: Only staff can dispatch consignment stock to dealers';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.dealers WHERE id = p_dealer_id AND is_active = true) THEN
    RAISE EXCEPTION 'Dealer does not exist or is inactive';
  END IF;

  -- Authoritative Phase 8.1 Credit Gate Verification
  v_gate_result := public.fn_validate_consignment_dispatch_gate(p_dealer_id, p_product_unit_ids);
  IF NOT (v_gate_result->>'allowed')::BOOLEAN THEN
    RAISE EXCEPTION 'Credit Gate Blocked: % (Reason: %)', v_gate_result->>'blockedBy', v_gate_result->>'reason';
  END IF;

  FOREACH v_unit_id IN ARRAY p_product_unit_ids LOOP
    SELECT * INTO v_unit FROM public.product_units WHERE id = v_unit_id FOR UPDATE;
    
    IF v_unit.id IS NULL THEN
      RAISE EXCEPTION 'Product unit % not found', v_unit_id;
    END IF;

    IF v_unit.status = 'sold' THEN
      RAISE EXCEPTION 'Product unit % (Barcode: %) is already sold', v_unit.id, v_unit.barcode;
    END IF;

    IF v_unit.dealer_id IS NOT NULL AND v_unit.dealer_id != p_dealer_id THEN
      RAISE EXCEPTION 'Product unit % is assigned to another dealer', v_unit.barcode;
    END IF;

    UPDATE public.product_units
    SET dealer_id = p_dealer_id,
        status = 'in_transit',
        ownership_type = 'zuvo_owned',
        updated_at = NOW()
    WHERE id = v_unit_id;

    INSERT INTO public.dealer_consignment_stock (
      dealer_id,
      product_unit_id,
      ownership_type,
      consignment_status,
      dispatched_at,
      dispatched_by,
      from_warehouse_id,
      notes
    ) VALUES (
      p_dealer_id,
      v_unit_id,
      'zuvo_owned',
      'dispatched',
      NOW(),
      auth.uid(),
      COALESCE(p_warehouse_id, v_unit.warehouse_id),
      p_notes
    )
    ON CONFLICT (product_unit_id) DO UPDATE SET
      dealer_id = EXCLUDED.dealer_id,
      ownership_type = 'zuvo_owned',
      consignment_status = 'dispatched',
      dispatched_at = NOW(),
      dispatched_by = EXCLUDED.dispatched_by,
      from_warehouse_id = EXCLUDED.from_warehouse_id,
      received_at = NULL,
      received_by = NULL,
      discrepancy_reason = NULL,
      discrepancy_notes = NULL,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING id INTO v_consignment_id;

    INSERT INTO public.dealer_consignment_movements (
      consignment_id,
      product_unit_id,
      dealer_id,
      movement_type,
      previous_consignment_status,
      new_consignment_status,
      previous_ownership_type,
      new_ownership_type,
      performed_by,
      reference_number,
      reason,
      notes
    ) VALUES (
      v_consignment_id,
      v_unit_id,
      p_dealer_id,
      'DISPATCH',
      NULL,
      'dispatched',
      v_unit.ownership_type,
      'zuvo_owned',
      auth.uid(),
      'DISP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(v_unit_id::TEXT, 1, 6),
      'Dispatched to dealer consignment',
      p_notes
    );

    INSERT INTO public.inventory_transactions (
      product_unit_id,
      transaction_type,
      previous_status,
      new_status,
      reference_note,
      performed_by,
      from_warehouse_id
    ) VALUES (
      v_unit_id,
      'DISPATCH_TO_DEALER',
      v_unit.status,
      'in_transit',
      COALESCE(p_notes, 'Dispatched to dealer ' || p_dealer_id),
      auth.uid(),
      v_unit.warehouse_id
    );

    v_dispatched_count := v_dispatched_count + 1;
  END LOOP;

  -- Refresh exposure snapshot
  PERFORM public.fn_evaluate_dealer_credit_exposure(p_dealer_id);

  RETURN jsonb_build_object(
    'success', true,
    'dealer_id', p_dealer_id,
    'dispatched_count', v_dispatched_count,
    'credit_gate', v_gate_result
  );
END;
$$;

-- D. Dealer Sales Reporting with Settlement Entry & Idempotency
CREATE OR REPLACE FUNCTION public.fn_report_dealer_consignment_sale(
    p_dealer_id UUID,
    p_product_unit_id UUID,
    p_selling_price NUMERIC,
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_sale_reference TEXT DEFAULT NULL,
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_auth_dealer_id UUID;
    v_unit RECORD;
    v_cs RECORD;
    v_sale_id UUID;
    v_sale_number TEXT;
    v_customer_id UUID;
BEGIN
    v_role := get_current_user_role();
    v_auth_dealer_id := get_current_user_dealer_id();

    IF v_role = 'dealer' AND v_auth_dealer_id != p_dealer_id THEN
        RAISE EXCEPTION 'Unauthorized: Cannot report sale for another dealer';
    END IF;

    -- Idempotency protection
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_sale_id FROM public.sales WHERE notes LIKE '%idempotency:' || p_idempotency_key::TEXT || '%';
        IF v_sale_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'sale_id', v_sale_id,
                'idempotent_replay', true
            );
        END IF;
    END IF;

    -- Validate unit and consignment ownership
    SELECT * INTO v_unit FROM public.product_units WHERE id = p_product_unit_id FOR UPDATE;
    IF v_unit.id IS NULL THEN
        RAISE EXCEPTION 'Product unit % not found', p_product_unit_id;
    END IF;

    IF v_unit.dealer_id != p_dealer_id THEN
        RAISE EXCEPTION 'Unit % is not assigned to dealer %', v_unit.barcode, p_dealer_id;
    END IF;

    IF v_unit.status = 'sold' THEN
        RAISE EXCEPTION 'Unit % is already sold', v_unit.barcode;
    END IF;

    SELECT * INTO v_cs FROM public.dealer_consignment_stock WHERE product_unit_id = p_product_unit_id FOR UPDATE;
    IF v_cs.id IS NULL OR v_cs.consignment_status NOT IN ('available', 'received') THEN
        RAISE EXCEPTION 'Unit is not in available dealer consignment stock';
    END IF;

    -- Optional customer lookup/creation
    IF p_customer_phone IS NOT NULL THEN
        SELECT id INTO v_customer_id FROM public.customers WHERE phone = p_customer_phone LIMIT 1;
        IF v_customer_id IS NULL THEN
            INSERT INTO public.customers (full_name, phone)
            VALUES (COALESCE(p_customer_name, 'Retail Customer'), p_customer_phone)
            RETURNING id INTO v_customer_id;
        END IF;
    END IF;

    v_sale_number := 'DSL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);

    -- Insert sale
    INSERT INTO public.sales (
        sale_number, customer_id, dealer_id, sale_date,
        subtotal, discount_amount, tax_amount, total_amount,
        payment_status, sale_status, sold_by, notes
    ) VALUES (
        v_sale_number, v_customer_id, p_dealer_id, NOW(),
        p_selling_price, 0, 0, p_selling_price,
        'pending', 'completed', auth.uid(),
        'Dealer reported sale. Ref: ' || COALESCE(p_sale_reference, 'N/A') || 
        CASE WHEN p_idempotency_key IS NOT NULL THEN ' | idempotency:' || p_idempotency_key::TEXT ELSE '' END
    ) RETURNING id INTO v_sale_id;

    INSERT INTO public.sale_items (
        sale_id, product_unit_id, unit_price, discount_amount, total_price
    ) VALUES (
        v_sale_id, p_product_unit_id, p_selling_price, 0, p_selling_price
    );

    -- Update product unit
    UPDATE public.product_units
    SET status = 'sold',
        ownership_type = 'customer_owned',
        sold_at = NOW(),
        updated_at = NOW()
    WHERE id = p_product_unit_id;

    -- Update consignment status to SOLD & SETTLEMENT_PENDING
    UPDATE public.dealer_consignment_stock
    SET consignment_status = 'sold',
        ownership_type = 'customer_owned',
        sold_at = NOW(),
        settlement_status = 'pending',
        settlement_reference = v_sale_number,
        updated_at = NOW()
    WHERE id = v_cs.id;

    -- Log Movement
    INSERT INTO public.dealer_consignment_movements (
        consignment_id, product_unit_id, dealer_id, movement_type,
        previous_consignment_status, new_consignment_status,
        previous_ownership_type, new_ownership_type, performed_by,
        reference_number, reason, notes
    ) VALUES (
        v_cs.id, p_product_unit_id, p_dealer_id, 'SALE',
        v_cs.consignment_status, 'sold',
        v_cs.ownership_type, 'customer_owned', auth.uid(),
        v_sale_number, 'Dealer reported consignment sale',
        'Sold at ₹' || p_selling_price
    );

    -- Refresh exposure
    PERFORM public.fn_evaluate_dealer_credit_exposure(p_dealer_id);

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'sale_number', v_sale_number,
        'product_unit_id', p_product_unit_id,
        'dealer_id', p_dealer_id
    );
END;
$$;

-- E. Generate Periodic Dealer Statement RPC
CREATE OR REPLACE FUNCTION public.fn_generate_dealer_statement(
    p_dealer_id UUID,
    p_period_start DATE,
    p_period_end DATE,
    p_statement_type TEXT DEFAULT 'MONTHLY'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_statement_id UUID;
    v_statement_number TEXT;
    v_dealer RECORD;
    v_opening_bal NUMERIC := 0;
    v_disp_val NUMERIC := 0;
    v_ret_val NUMERIC := 0;
    v_sales_val NUMERIC := 0;
    v_settled_val NUMERIC := 0;
    v_cn_val NUMERIC := 0;
    v_db_val NUMERIC := 0;
    v_pmt_val NUMERIC := 0;
    v_closing_bal NUMERIC := 0;
    v_credit_limit NUMERIC := 0;
    v_available_credit NUMERIC := 0;
    v_overdue_amt NUMERIC := 0;
    v_aging RECORD;
BEGIN
    SELECT * INTO v_dealer FROM public.dealers WHERE id = p_dealer_id;
    IF v_dealer.id IS NULL THEN
        RAISE EXCEPTION 'Dealer % not found', p_dealer_id;
    END IF;

    -- Check for existing statement for period
    SELECT id, statement_number INTO v_statement_id, v_statement_number
    FROM public.dealer_statements
    WHERE dealer_id = p_dealer_id
      AND statement_type = p_statement_type
      AND period_start = p_period_start
      AND period_end = p_period_end;

    IF v_statement_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'statement_id', v_statement_id,
            'statement_number', v_statement_number,
            'message', 'Existing statement retrieved for period'
        );
    END IF;

    -- Generate Reference
    v_statement_number := 'DST-' || TO_CHAR(p_period_end, 'YYYYMM') || '-' || SUBSTRING(MD5(p_dealer_id::TEXT || p_period_start::TEXT), 1, 6);

    -- Calculate Dispatches during period
    SELECT COALESCE(SUM(pu.purchase_cost), 0)
    INTO v_disp_val
    FROM public.dealer_consignment_stock cs
    JOIN public.product_units pu ON pu.id = cs.product_unit_id
    WHERE cs.dealer_id = p_dealer_id
      AND cs.dispatched_at::DATE BETWEEN p_period_start AND p_period_end;

    -- Calculate Returns / Recalls during period
    SELECT COALESCE(SUM(pu.purchase_cost), 0)
    INTO v_ret_val
    FROM public.dealer_consignment_stock cs
    JOIN public.product_units pu ON pu.id = cs.product_unit_id
    WHERE cs.dealer_id = p_dealer_id
      AND cs.consignment_status IN ('returned', 'recalled')
      AND COALESCE(cs.returned_at, cs.recalled_at)::DATE BETWEEN p_period_start AND p_period_end;

    -- Calculate Sales reported
    SELECT COALESCE(SUM(s.total_amount), 0)
    INTO v_sales_val
    FROM public.sales s
    WHERE s.dealer_id = p_dealer_id
      AND s.sale_date::DATE BETWEEN p_period_start AND p_period_end;

    -- Calculate Settlements
    SELECT COALESCE(SUM(pu.purchase_cost), 0)
    INTO v_settled_val
    FROM public.dealer_consignment_stock cs
    JOIN public.product_units pu ON pu.id = cs.product_unit_id
    WHERE cs.dealer_id = p_dealer_id
      AND cs.settlement_status = 'settled'
      AND cs.settlement_date::DATE BETWEEN p_period_start AND p_period_end;

    -- Financial Adjustments
    SELECT 
        COALESCE(SUM(CASE WHEN adjustment_type = 'CREDIT_NOTE' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN adjustment_type = 'DEBIT_ADJUSTMENT' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN adjustment_type = 'PAYMENT_RECEIVED' THEN amount ELSE 0 END), 0)
    INTO v_cn_val, v_db_val, v_pmt_val
    FROM public.dealer_financial_adjustments
    WHERE dealer_id = p_dealer_id
      AND status = 'POSTED'
      AND posted_at::DATE BETWEEN p_period_start AND p_period_end;

    -- Closing balance
    v_closing_bal := (v_opening_bal + v_disp_val + v_sales_val + v_db_val) - (v_ret_val + v_settled_val + v_cn_val + v_pmt_val);
    v_credit_limit := COALESCE(v_dealer.credit_limit, 500000.00);
    v_available_credit := GREATEST(0, v_credit_limit - v_closing_bal);

    -- Aging breakdown
    SELECT
        COALESCE(SUM(CASE WHEN EXTRACT(DAY FROM (NOW() - COALESCE(cs.received_at, cs.dispatched_at))) <= 30 THEN pu.purchase_cost ELSE 0 END), 0) AS age_0_30,
        COALESCE(SUM(CASE WHEN EXTRACT(DAY FROM (NOW() - COALESCE(cs.received_at, cs.dispatched_at))) BETWEEN 31 AND 60 THEN pu.purchase_cost ELSE 0 END), 0) AS age_31_60,
        COALESCE(SUM(CASE WHEN EXTRACT(DAY FROM (NOW() - COALESCE(cs.received_at, cs.dispatched_at))) BETWEEN 61 AND 90 THEN pu.purchase_cost ELSE 0 END), 0) AS age_61_90,
        COALESCE(SUM(CASE WHEN EXTRACT(DAY FROM (NOW() - COALESCE(cs.received_at, cs.dispatched_at))) BETWEEN 91 AND 120 THEN pu.purchase_cost ELSE 0 END), 0) AS age_91_120,
        COALESCE(SUM(CASE WHEN EXTRACT(DAY FROM (NOW() - COALESCE(cs.received_at, cs.dispatched_at))) > 120 THEN pu.purchase_cost ELSE 0 END), 0) AS age_120_plus
    INTO v_aging
    FROM public.dealer_consignment_stock cs
    JOIN public.product_units pu ON pu.id = cs.product_unit_id
    WHERE cs.dealer_id = p_dealer_id
      AND cs.consignment_status IN ('dispatched', 'received', 'available');

    INSERT INTO public.dealer_statements (
        statement_number, dealer_id, statement_type, period_start, period_end,
        opening_balance, consignments_dispatched_val, consignments_returned_val,
        sales_reported_val, settlements_completed_val, credit_notes_val,
        debit_adjustments_val, payments_received_val, closing_balance,
        credit_limit, available_credit, overdue_amount,
        aging_0_30_val, aging_31_60_val, aging_61_90_val, aging_91_120_val, aging_120_plus_val,
        status, generated_by
    ) VALUES (
        v_statement_number, p_dealer_id, p_statement_type, p_period_start, p_period_end,
        v_opening_bal, v_disp_val, v_ret_val,
        v_sales_val, v_settled_val, v_cn_val,
        v_db_val, v_pmt_val, v_closing_bal,
        v_credit_limit, v_available_credit, v_overdue_amt,
        v_aging.age_0_30, v_aging.age_31_60, v_aging.age_61_90, v_aging.age_91_120, v_aging.age_120_plus,
        'GENERATED', auth.uid()
    ) RETURNING id INTO v_statement_id;

    RETURN jsonb_build_object(
        'success', true,
        'statement_id', v_statement_id,
        'statement_number', v_statement_number,
        'closing_balance', v_closing_bal,
        'status', 'GENERATED'
    );
END;
$$;

-- F. Finalize Dealer Statement RPC (Guarantees Immutability)
CREATE OR REPLACE FUNCTION public.fn_finalize_dealer_statement(p_statement_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_st RECORD;
BEGIN
    v_role := get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'finance') THEN
        RAISE EXCEPTION 'Unauthorized: Only finance and admin roles can finalize statements';
    END IF;

    SELECT * INTO v_st FROM public.dealer_statements WHERE id = p_statement_id FOR UPDATE;
    IF v_st.id IS NULL THEN
        RAISE EXCEPTION 'Statement % not found', p_statement_id;
    END IF;

    IF v_st.status = 'FINALIZED' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Statement is already finalized');
    END IF;

    IF v_st.status = 'VOIDED' THEN
        RAISE EXCEPTION 'Cannot finalize a voided statement';
    END IF;

    UPDATE public.dealer_statements
    SET status = 'FINALIZED',
        finalized_by = auth.uid(),
        finalized_at = NOW(),
        updated_at = NOW()
    WHERE id = p_statement_id;

    RETURN jsonb_build_object(
        'success', true,
        'statement_id', p_statement_id,
        'status', 'FINALIZED'
    );
END;
$$;

-- G. Stagnant Stock Evaluation Engine & Recall Recommendation Generation
CREATE OR REPLACE FUNCTION public.fn_evaluate_stagnant_consignment_stock()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
    v_row RECORD;
    v_severity TEXT;
    v_rec_num TEXT;
BEGIN
    FOR v_row IN (
        SELECT 
            cs.id AS consignment_id,
            cs.dealer_id,
            cs.product_unit_id,
            pu.purchase_cost,
            EXTRACT(DAY FROM (NOW() - COALESCE(cs.received_at, cs.dispatched_at)))::INT AS age_days
        FROM public.dealer_consignment_stock cs
        JOIN public.product_units pu ON pu.id = cs.product_unit_id
        WHERE cs.consignment_status IN ('dispatched', 'received', 'available')
          AND EXTRACT(DAY FROM (NOW() - COALESCE(cs.received_at, cs.dispatched_at))) >= 60
    ) LOOP
        IF v_row.age_days >= 120 THEN
            v_severity := 'CRITICAL';
        ELSIF v_row.age_days >= 90 THEN
            v_severity := 'RECALL_RECOMMENDED';
        ELSE
            v_severity := 'WARNING';
        END IF;

        v_rec_num := 'REC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(v_row.product_unit_id::TEXT, 1, 6);

        INSERT INTO public.dealer_recall_recommendations (
            recommendation_number, dealer_id, product_unit_id, consignment_id,
            age_days, unit_cost_value, stagnant_severity, trigger_reason,
            status
        ) VALUES (
            v_rec_num, v_row.dealer_id, v_row.product_unit_id, v_row.consignment_id,
            v_row.age_days, v_row.purchase_cost, v_severity,
            'Consignment stock stagnant for ' || v_row.age_days || ' days without sale',
            'OPEN'
        )
        ON CONFLICT (product_unit_id, status) DO UPDATE SET
            age_days = EXCLUDED.age_days,
            stagnant_severity = EXCLUDED.stagnant_severity,
            updated_at = NOW();

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'evaluated_count', v_count
    );
END;
$$;

-- H. Approve Recall Recommendation & Create Formal Recall Request
CREATE OR REPLACE FUNCTION public.fn_approve_consignment_recall_recommendation(
    p_recommendation_id UUID,
    p_to_warehouse_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_rec RECORD;
    v_recall_id UUID;
    v_ref TEXT;
BEGIN
    v_role := get_current_user_role();
    IF v_role NOT IN ('super_admin', 'admin', 'inventory', 'management') THEN
        RAISE EXCEPTION 'Unauthorized: Only inventory managers and admins can approve recalls';
    END IF;

    SELECT * INTO v_rec FROM public.dealer_recall_recommendations WHERE id = p_recommendation_id FOR UPDATE;
    IF v_rec.id IS NULL THEN
        RAISE EXCEPTION 'Recommendation % not found', p_recommendation_id;
    END IF;

    IF v_rec.status != 'OPEN' AND v_rec.status != 'ACKNOWLEDGED' THEN
        RAISE EXCEPTION 'Recommendation is in % state and cannot be approved', v_rec.status;
    END IF;

    v_ref := 'RCR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);

    -- Create Formal Recall Request
    INSERT INTO public.dealer_recall_requests (
        recall_reference, dealer_id, to_warehouse_id, recommendation_id,
        status, approved_by, approved_at, disposition_notes
    ) VALUES (
        v_ref, v_rec.dealer_id, p_to_warehouse_id, p_recommendation_id,
        'INITIATED', auth.uid(), NOW(), p_notes
    ) RETURNING id INTO v_recall_id;

    -- Create Request Item
    INSERT INTO public.dealer_recall_request_items (
        recall_request_id, product_unit_id, consignment_id, unit_cost_value
    ) VALUES (
        v_recall_id, v_rec.product_unit_id, v_rec.consignment_id, v_rec.unit_cost_value
    );

    -- Update Recommendation status
    UPDATE public.dealer_recall_recommendations
    SET status = 'RECALL_INITIATED',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        recall_request_id = v_recall_id,
        action_notes = p_notes,
        updated_at = NOW()
    WHERE id = p_recommendation_id;

    -- Update Consignment Stock status
    UPDATE public.dealer_consignment_stock
    SET consignment_status = 'recalled',
        recalled_at = NOW(),
        updated_at = NOW()
    WHERE id = v_rec.consignment_id;

    -- Transfer unit back to warehouse
    UPDATE public.product_units
    SET dealer_id = NULL,
        warehouse_id = p_to_warehouse_id,
        status = 'in_stock',
        ownership_type = 'zuvo_owned',
        updated_at = NOW()
    WHERE id = v_rec.product_unit_id;

    -- Log Movement
    INSERT INTO public.dealer_consignment_movements (
        consignment_id, product_unit_id, dealer_id, movement_type,
        previous_consignment_status, new_consignment_status,
        previous_ownership_type, new_ownership_type, performed_by,
        reference_number, reason, notes
    ) VALUES (
        v_rec.consignment_id, v_rec.product_unit_id, v_rec.dealer_id, 'RECALL_APPROVED',
        'available', 'recalled',
        'zuvo_owned', 'zuvo_owned', auth.uid(),
        v_ref, 'Stagnant stock recall recommendation approved',
        p_notes
    );

    RETURN jsonb_build_object(
        'success', true,
        'recall_request_id', v_recall_id,
        'recall_reference', v_ref,
        'status', 'RECALL_INITIATED'
    );
END;
$$;

-- 12. Grants
GRANT SELECT, INSERT, UPDATE ON public.dealer_credit_policies TO authenticated;
GRANT SELECT, INSERT ON public.dealer_credit_exposure_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dealer_financial_adjustments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dealer_statements TO authenticated;
GRANT SELECT, INSERT ON public.dealer_statement_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dealer_recall_recommendations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dealer_recall_requests TO authenticated;
GRANT SELECT, INSERT ON public.dealer_recall_request_items TO authenticated;
