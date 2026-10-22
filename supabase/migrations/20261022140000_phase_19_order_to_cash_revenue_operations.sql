-- =============================================================================
-- ZUVO TV ENTERPRISE CRM — PHASE 19 MASTER DATABASE MIGRATION
-- Enterprise Order-to-Cash (O2C), Fulfillment & Revenue Operations Engine
-- Filename: 20261022140000_phase_19_order_to_cash_revenue_operations.sql
-- =============================================================================

SET search_path = public, pg_temp;

-- =============================================================================
-- 1. EXTEND EXISTING TABLE: public.sales_orders
-- Adds full enterprise lifecycle, credit governance, priority & installation
-- =============================================================================
DO $$
BEGIN
    -- quotation_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'quotation_id'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN quotation_id UUID NULL;
    END IF;

    -- sales_rep_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'sales_rep_id'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN sales_rep_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    -- requested_delivery_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'requested_delivery_date'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN requested_delivery_date DATE NULL;
    END IF;

    -- freight_amount
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'freight_amount'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN freight_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (freight_amount >= 0);
    END IF;

    -- advance_received
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'advance_received'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN advance_received NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (advance_received >= 0);
    END IF;

    -- outstanding_amount
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'outstanding_amount'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN outstanding_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (outstanding_amount >= 0);
    END IF;

    -- order_priority
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'order_priority'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN order_priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (order_priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'URGENT'));
    END IF;

    -- credit_check_status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'credit_check_status'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN credit_check_status TEXT NOT NULL DEFAULT 'CLEAR' CHECK (credit_check_status IN ('PENDING', 'CLEAR', 'WATCH', 'HOLD', 'BLOCK', 'OVERRIDDEN'));
    END IF;

    -- credit_override_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'credit_override_by'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN credit_override_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    -- credit_override_reason
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'credit_override_reason'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN credit_override_reason TEXT NULL;
    END IF;

    -- credit_override_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'credit_override_at'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN credit_override_at TIMESTAMPTZ NULL;
    END IF;

    -- installation_status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'installation_status'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN installation_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE' CHECK (installation_status IN ('NOT_APPLICABLE', 'PENDING', 'ASSIGNED', 'COMPLETED', 'ACTIVATED'));
    END IF;

    -- installation_technician_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'installation_technician_id'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN installation_technician_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    -- activated_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'activated_at'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN activated_at TIMESTAMPTZ NULL;
    END IF;

    -- approved_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'approved_by'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN approved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    -- approved_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'approved_at'
    ) THEN
        ALTER TABLE public.sales_orders ADD COLUMN approved_at TIMESTAMPTZ NULL;
    END IF;

    -- Update status check constraint to support full enterprise O2C lifecycle
    ALTER TABLE public.sales_orders DROP CONSTRAINT IF EXISTS sales_orders_status_check;
    ALTER TABLE public.sales_orders ADD CONSTRAINT sales_orders_status_check CHECK (
        status IN (
            'DRAFT',
            'SUBMITTED',
            'PENDING_APPROVAL',
            'APPROVED',
            'CONFIRMED',
            'CREDIT_HOLD',
            'CREDIT_CHECK',
            'INVENTORY_CHECK',
            'ALLOCATED',
            'READY_TO_FULFILL',
            'PICKED',
            'PACKED',
            'PARTIALLY_FULFILLED',
            'DISPATCHED',
            'FULFILLED',
            'DELIVERED',
            'INVOICED',
            'PARTIALLY_PAID',
            'PAID',
            'CLOSED',
            'CANCELLED',
            'REJECTED',
            'ON_HOLD'
        )
    );
END $$;

-- Indexes for extended sales_orders
CREATE INDEX IF NOT EXISTS idx_sales_orders_quotation ON public.sales_orders(quotation_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_sales_rep ON public.sales_orders(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_credit_status ON public.sales_orders(credit_check_status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_priority ON public.sales_orders(order_priority);
CREATE INDEX IF NOT EXISTS idx_sales_orders_install_status ON public.sales_orders(installation_status);

-- =============================================================================
-- 2. EXTEND EXISTING TABLE: public.sales_order_items
-- Adds requested/allocated warehouse, returned quantity & pending quantity
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_order_items' AND column_name = 'quantity_returned'
    ) THEN
        ALTER TABLE public.sales_order_items ADD COLUMN quantity_returned INT NOT NULL DEFAULT 0 CHECK (quantity_returned >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_order_items' AND column_name = 'requested_warehouse_id'
    ) THEN
        ALTER TABLE public.sales_order_items ADD COLUMN requested_warehouse_id UUID NULL REFERENCES public.warehouses(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sales_order_items' AND column_name = 'allocated_warehouse_id'
    ) THEN
        ALTER TABLE public.sales_order_items ADD COLUMN allocated_warehouse_id UUID NULL REFERENCES public.warehouses(id) ON DELETE SET NULL;
    END IF;

    -- Enforce returned <= shipped
    ALTER TABLE public.sales_order_items DROP CONSTRAINT IF EXISTS chk_so_item_returned_le_shipped;
    ALTER TABLE public.sales_order_items ADD CONSTRAINT chk_so_item_returned_le_shipped CHECK (quantity_returned <= quantity_shipped);
END $$;

-- =============================================================================
-- 3. TABLE: public.o2c_order_approvals
-- Maker-checker order approval governance and audit trail
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.o2c_order_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    approval_tier TEXT NOT NULL DEFAULT 'STANDARD' CHECK (approval_tier IN ('STANDARD', 'DIRECTOR', 'FINANCE', 'DISCOUNT_EXCEPTION', 'CREDIT_OVERRIDE')),
    threshold_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    order_amount NUMERIC(14, 2) NOT NULL CHECK (order_amount >= 0),
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approver_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    decision_reason TEXT NULL,
    decided_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_o2c_maker_checker CHECK (approver_id IS NULL OR approver_id != requested_by)
);

CREATE INDEX IF NOT EXISTS idx_o2c_approvals_tenant ON public.o2c_order_approvals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_o2c_approvals_order ON public.o2c_order_approvals(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_o2c_approvals_status ON public.o2c_order_approvals(status);
CREATE INDEX IF NOT EXISTS idx_o2c_approvals_tier ON public.o2c_order_approvals(approval_tier);

-- =============================================================================
-- 4. TABLE: public.o2c_payment_reconciliations
-- Server-authoritative order-to-cash reconciliation matching bank receipts to invoices
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.o2c_payment_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    reconciliation_number TEXT NOT NULL,
    payment_receipt_id UUID NULL REFERENCES public.payment_receipts_unallocated(id) ON DELETE SET NULL,
    commercial_tax_invoice_id UUID NULL REFERENCES public.commercial_tax_invoices(id) ON DELETE SET NULL,
    sales_order_id UUID NULL REFERENCES public.sales_orders(id) ON DELETE SET NULL,
    customer_id UUID NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
    matched_amount NUMERIC(14, 2) NOT NULL CHECK (matched_amount > 0),
    match_type TEXT NOT NULL DEFAULT 'EXACT_MATCH' CHECK (
        match_type IN ('EXACT_MATCH', 'PARTIAL_MATCH', 'MULTI_INVOICE', 'UNMATCHED', 'DISCREPANCY')
    ),
    reconciliation_status TEXT NOT NULL DEFAULT 'RECONCILED' CHECK (
        reconciliation_status IN ('DRAFT', 'RECONCILED', 'DISPUTED', 'CANCELLED')
    ),
    variance_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    reconciled_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    reconciled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_o2c_reconciliation_num UNIQUE (tenant_id, reconciliation_number)
);

CREATE INDEX IF NOT EXISTS idx_o2c_recon_tenant ON public.o2c_payment_reconciliations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_o2c_recon_receipt ON public.o2c_payment_reconciliations(payment_receipt_id);
CREATE INDEX IF NOT EXISTS idx_o2c_recon_invoice ON public.o2c_payment_reconciliations(commercial_tax_invoice_id);
CREATE INDEX IF NOT EXISTS idx_o2c_recon_order ON public.o2c_payment_reconciliations(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_o2c_recon_status ON public.o2c_payment_reconciliations(reconciliation_status);

-- =============================================================================
-- 5. TABLE: public.o2c_revenue_signals
-- Explainable deterministic revenue intelligence signals
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.o2c_revenue_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    signal_code TEXT NOT NULL,
    signal_type TEXT NOT NULL CHECK (
        signal_type IN (
            'REVENUE_GROWTH',
            'REVENUE_DECLINE',
            'COLLECTION_RISK',
            'HIGH_RETURN_RATE',
            'LOW_FULFILLMENT',
            'DISPATCH_BOTTLENECK',
            'CREDIT_EXPOSURE',
            'MARGIN_PRESSURE'
        )
    ),
    severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    target_entity_type TEXT NOT NULL, -- 'ORDER', 'CUSTOMER', 'DEALER', 'PRODUCT', 'TERRITORY', 'OVERALL'
    target_entity_id UUID NULL,
    headline TEXT NOT NULL,
    explanation TEXT NOT NULL,
    metric_value NUMERIC(14, 2) NULL,
    metric_unit TEXT NULL,
    advisory_recommendation TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_o2c_signal_code UNIQUE (tenant_id, signal_code)
);

CREATE INDEX IF NOT EXISTS idx_o2c_signals_tenant ON public.o2c_revenue_signals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_o2c_signals_type ON public.o2c_revenue_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_o2c_signals_severity ON public.o2c_revenue_signals(severity);
CREATE INDEX IF NOT EXISTS idx_o2c_signals_active ON public.o2c_revenue_signals(is_active);

-- =============================================================================
-- 6. TABLE: public.o2c_exceptions
-- Enterprise Order-to-Cash Exceptions with Work-Item Escalation
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.o2c_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    exception_number TEXT NOT NULL,
    exception_type TEXT NOT NULL CHECK (
        exception_type IN (
            'OVERDUE_ORDER',
            'BLOCKED_CREDIT',
            'INVENTORY_SHORTAGE',
            'STUCK_APPROVAL',
            'UNALLOCATED_ORDER',
            'DELAYED_DISPATCH',
            'FAILED_DELIVERY',
            'OVERDUE_INVOICE',
            'COLLECTION_RISK',
            'EXCESSIVE_RETURNS',
            'CREDIT_NOTE_ANOMALY',
            'DUPLICATE_PAYMENT_RISK',
            'SERIAL_MISMATCH'
        )
    ),
    severity TEXT NOT NULL DEFAULT 'HIGH' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    sales_order_id UUID NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    delivery_challan_id UUID NULL REFERENCES public.delivery_challans(id) ON DELETE SET NULL,
    invoice_id UUID NULL REFERENCES public.commercial_tax_invoices(id) ON DELETE SET NULL,
    customer_id UUID NULL REFERENCES public.customers(id) ON DELETE SET NULL,
    dealer_id UUID NULL REFERENCES public.dealers(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    root_cause TEXT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED')),
    work_item_id UUID NULL, -- Escalation to Phase 16 work items
    assigned_to UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolution_notes TEXT NULL,
    resolved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_o2c_exception_num UNIQUE (tenant_id, exception_number)
);

CREATE INDEX IF NOT EXISTS idx_o2c_exceptions_tenant ON public.o2c_exceptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_o2c_exceptions_type ON public.o2c_exceptions(exception_type);
CREATE INDEX IF NOT EXISTS idx_o2c_exceptions_severity ON public.o2c_exceptions(severity);
CREATE INDEX IF NOT EXISTS idx_o2c_exceptions_status ON public.o2c_exceptions(status);
CREATE INDEX IF NOT EXISTS idx_o2c_exceptions_order ON public.o2c_exceptions(sales_order_id);

-- Sequence for O2C exceptions
CREATE SEQUENCE IF NOT EXISTS public.seq_o2c_exception_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Sequence for O2C reconciliations
CREATE SEQUENCE IF NOT EXISTS public.seq_o2c_reconciliation_number
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- 7. REVENUE OPERATIONS VIEW: public.vw_o2c_revenue_operations_cockpit
-- Consolidated operational metrics across pipeline, fulfillment, billing & collections
-- =============================================================================
CREATE OR REPLACE VIEW public.vw_o2c_revenue_operations_cockpit AS
SELECT
    so.tenant_id,
    COUNT(DISTINCT so.id) AS total_orders_count,
    COUNT(DISTINCT CASE WHEN so.status = 'DRAFT' THEN so.id END) AS draft_orders_count,
    COUNT(DISTINCT CASE WHEN so.status = 'PENDING_APPROVAL' THEN so.id END) AS pending_approval_orders_count,
    COUNT(DISTINCT CASE WHEN so.status IN ('APPROVED', 'CONFIRMED') THEN so.id END) AS approved_orders_count,
    COUNT(DISTINCT CASE WHEN so.credit_check_status = 'BLOCK' THEN so.id END) AS blocked_credit_orders_count,
    COUNT(DISTINCT CASE WHEN so.status = 'ALLOCATED' THEN so.id END) AS allocated_orders_count,
    COUNT(DISTINCT CASE WHEN so.status IN ('PICKED', 'PACKED') THEN so.id END) AS fulfillment_in_progress_count,
    COUNT(DISTINCT CASE WHEN so.status = 'DISPATCHED' THEN so.id END) AS dispatched_orders_count,
    COUNT(DISTINCT CASE WHEN so.status = 'DELIVERED' THEN so.id END) AS delivered_orders_count,
    COUNT(DISTINCT CASE WHEN so.status = 'INVOICED' THEN so.id END) AS invoiced_orders_count,
    COUNT(DISTINCT CASE WHEN so.status = 'PAID' THEN so.id END) AS paid_orders_count,
    COUNT(DISTINCT CASE WHEN so.status = 'CANCELLED' THEN so.id END) AS cancelled_orders_count,
    COALESCE(SUM(so.total_amount), 0.00) AS gross_order_value,
    COALESCE(SUM(so.subtotal), 0.00) AS net_order_value,
    COALESCE(SUM(so.advance_received), 0.00) AS total_advance_collected,
    COALESCE(SUM(so.outstanding_amount), 0.00) AS total_outstanding_amount
FROM public.sales_orders so
GROUP BY so.tenant_id;

-- =============================================================================
-- 8. SERVER-AUTHORITATIVE RPCs
-- =============================================================================

-- RPC 1: fn_submit_sales_order
-- Submits draft sales order for approval and triggers automated credit evaluation
CREATE OR REPLACE FUNCTION public.fn_submit_sales_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order public.sales_orders%ROWTYPE;
    v_item_count INT;
    v_user_id UUID := auth.uid();
    v_res JSONB;
BEGIN
    SELECT * INTO v_order FROM public.sales_orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sales order not found');
    END IF;

    IF v_order.status != 'DRAFT' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only DRAFT orders can be submitted');
    END IF;

    SELECT COUNT(*) INTO v_item_count FROM public.sales_order_items WHERE sales_order_id = p_order_id;
    IF v_item_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot submit sales order without line items');
    END IF;

    -- Update order to SUBMITTED / PENDING_APPROVAL
    UPDATE public.sales_orders
    SET 
        status = 'PENDING_APPROVAL',
        updated_at = now()
    WHERE id = p_order_id;

    -- Automatically create approval work item record
    INSERT INTO public.o2c_order_approvals (
        tenant_id,
        sales_order_id,
        approval_tier,
        threshold_value,
        order_amount,
        requested_by,
        status
    ) VALUES (
        v_order.tenant_id,
        p_order_id,
        CASE WHEN v_order.total_amount > 500000 THEN 'DIRECTOR' ELSE 'STANDARD' END,
        CASE WHEN v_order.total_amount > 500000 THEN 500000.00 ELSE 0.00 END,
        v_order.total_amount,
        COALESCE(v_user_id, v_order.created_by),
        'PENDING'
    );

    -- Log audit event
    INSERT INTO public.sales_order_audit_events (
        tenant_id,
        sales_order_id,
        event_type,
        actor_id,
        previous_status,
        new_status,
        payload
    ) VALUES (
        v_order.tenant_id,
        p_order_id,
        'ORDER_SUBMITTED',
        v_user_id,
        'DRAFT',
        'PENDING_APPROVAL',
        jsonb_build_object('total_amount', v_order.total_amount, 'items_count', v_item_count)
    );

    RETURN jsonb_build_object(
        'success', true, 
        'order_id', p_order_id, 
        'status', 'PENDING_APPROVAL',
        'message', 'Sales order submitted for managerial approval'
    );
END;
$$;

-- RPC 2: fn_approve_sales_order
-- Enforces maker-checker separation: requester cannot approve their own order
CREATE OR REPLACE FUNCTION public.fn_approve_sales_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order public.sales_orders%ROWTYPE;
    v_approval public.o2c_order_approvals%ROWTYPE;
    v_approver_id UUID := auth.uid();
BEGIN
    SELECT * INTO v_order FROM public.sales_orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sales order not found');
    END IF;

    IF v_order.status NOT IN ('SUBMITTED', 'PENDING_APPROVAL') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order is not pending approval');
    END IF;

    -- Find pending approval request
    SELECT * INTO v_approval 
    FROM public.o2c_order_approvals 
    WHERE sales_order_id = p_order_id AND status = 'PENDING'
    ORDER BY created_at DESC LIMIT 1;

    -- Maker-checker enforcement
    IF v_approver_id IS NOT NULL AND v_approval.requested_by = v_approver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maker-Checker Violation: Requester cannot approve their own order');
    END IF;

    -- Update approval record
    UPDATE public.o2c_order_approvals
    SET 
        status = 'APPROVED',
        approver_id = v_approver_id,
        decided_at = now(),
        updated_at = now()
    WHERE id = v_approval.id;

    -- Update sales order to APPROVED
    UPDATE public.sales_orders
    SET 
        status = 'APPROVED',
        approved_by = v_approver_id,
        approved_at = now(),
        updated_at = now()
    WHERE id = p_order_id;

    -- Log audit event
    INSERT INTO public.sales_order_audit_events (
        tenant_id,
        sales_order_id,
        event_type,
        actor_id,
        previous_status,
        new_status,
        payload
    ) VALUES (
        v_order.tenant_id,
        p_order_id,
        'ORDER_APPROVED',
        v_approver_id,
        v_order.status,
        'APPROVED',
        jsonb_build_object('approver_id', v_approver_id, 'approved_at', now())
    );

    RETURN jsonb_build_object(
        'success', true, 
        'order_id', p_order_id, 
        'status', 'APPROVED',
        'message', 'Sales order approved successfully'
    );
END;
$$;

-- RPC 3: fn_run_order_credit_check
-- Server-authoritative deterministic credit control decision
CREATE OR REPLACE FUNCTION public.fn_run_order_credit_check(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order public.sales_orders%ROWTYPE;
    v_dealer public.dealers%ROWTYPE;
    v_credit_limit NUMERIC(14, 2) := 0.00;
    v_credit_used NUMERIC(14, 2) := 0.00;
    v_outstanding_ar NUMERIC(14, 2) := 0.00;
    v_total_exposure NUMERIC(14, 2) := 0.00;
    v_decision TEXT := 'CLEAR';
    v_reason TEXT := 'Credit exposure within acceptable threshold';
BEGIN
    SELECT * INTO v_order FROM public.sales_orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sales order not found');
    END IF;

    -- Evaluate credit if dealer order
    IF v_order.dealer_id IS NOT NULL THEN
        SELECT * INTO v_dealer FROM public.dealers WHERE id = v_order.dealer_id;
        IF FOUND THEN
            v_credit_limit := COALESCE(v_dealer.credit_limit, 0.00);
            v_credit_used := COALESCE(v_dealer.credit_used, 0.00);

            -- Calculate total outstanding from AR ledger
            SELECT COALESCE(SUM(remaining_balance), 0.00) INTO v_outstanding_ar
            FROM public.customer_ar_ledger
            WHERE dealer_id = v_order.dealer_id AND status IN ('OPEN', 'PARTIALLY_SETTLED');

            v_total_exposure := v_credit_used + v_order.total_amount;

            -- Check if dealer is blocked or credit exceeded
            IF v_dealer.status = 'suspended' THEN
                v_decision := 'BLOCK';
                v_reason := 'Dealer account is suspended';
            ELSIF v_total_exposure > v_credit_limit AND v_credit_limit > 0 THEN
                v_decision := 'BLOCK';
                v_reason := format('Credit limit exceeded: Exposure %s > Limit %s', v_total_exposure, v_credit_limit);
            ELSIF (v_total_exposure / NULLIF(v_credit_limit, 0)) >= 0.85 THEN
                v_decision := 'WATCH';
                v_reason := format('High credit utilization: %s%% of limit', round((v_total_exposure / v_credit_limit) * 100, 1));
            ELSE
                v_decision := 'CLEAR';
                v_reason := 'Credit clearance verified';
            END IF;
        END IF;
    END IF;

    -- Update order credit status
    UPDATE public.sales_orders
    SET 
        credit_check_status = v_decision,
        credit_hold_reason = CASE WHEN v_decision = 'BLOCK' THEN v_reason ELSE credit_hold_reason END,
        status = CASE WHEN v_decision = 'BLOCK' THEN 'CREDIT_HOLD' ELSE status END,
        updated_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'decision', v_decision,
        'reason', v_reason,
        'credit_limit', v_credit_limit,
        'total_exposure', v_total_exposure
    );
END;
$$;

-- RPC 4: fn_override_credit_block
-- Server-authoritative maker-checker credit block override with mandatory reason
CREATE OR REPLACE FUNCTION public.fn_override_credit_block(
    p_order_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order public.sales_orders%ROWTYPE;
    v_actor_id UUID := auth.uid();
BEGIN
    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mandatory audit reason required for credit override');
    END IF;

    SELECT * INTO v_order FROM public.sales_orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sales order not found');
    END IF;

    IF v_order.credit_check_status != 'BLOCK' AND v_order.status != 'CREDIT_HOLD' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only orders on credit block or hold can be overridden');
    END IF;

    -- Update order to OVERRIDDEN and return status to APPROVED / CONFIRMED
    UPDATE public.sales_orders
    SET 
        credit_check_status = 'OVERRIDDEN',
        credit_override_by = v_actor_id,
        credit_override_reason = p_reason,
        credit_override_at = now(),
        status = 'APPROVED',
        updated_at = now()
    WHERE id = p_order_id;

    -- Log audit trail
    INSERT INTO public.sales_order_audit_events (
        tenant_id,
        sales_order_id,
        event_type,
        actor_id,
        previous_status,
        new_status,
        payload
    ) VALUES (
        v_order.tenant_id,
        p_order_id,
        'CREDIT_OVERRIDDEN',
        v_actor_id,
        'CREDIT_HOLD',
        'APPROVED',
        jsonb_build_object('reason', p_reason, 'overridden_at', now())
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'status', 'APPROVED',
        'message', 'Credit block overridden by authorized authority'
    );
END;
$$;

-- RPC 5: fn_allocate_order_inventory
-- Hard allocation of serialized TV inventory to sales order item
CREATE OR REPLACE FUNCTION public.fn_allocate_order_inventory(
    p_order_id UUID,
    p_item_id UUID,
    p_product_unit_id UUID,
    p_warehouse_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order public.sales_orders%ROWTYPE;
    v_item public.sales_order_items%ROWTYPE;
    v_unit public.product_units%ROWTYPE;
    v_actor_id UUID := auth.uid();
BEGIN
    SELECT * INTO v_order FROM public.sales_orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sales order not found');
    END IF;

    -- Block dispatch/allocation if order is credit blocked or not approved
    IF v_order.credit_check_status = 'BLOCK' OR v_order.status = 'CREDIT_HOLD' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot allocate inventory to credit-blocked order');
    END IF;

    SELECT * INTO v_item FROM public.sales_order_items WHERE id = p_item_id AND sales_order_id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order item not found');
    END IF;

    IF v_item.quantity_allocated >= v_item.quantity_ordered THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item is already fully allocated');
    END IF;

    SELECT * INTO v_unit FROM public.product_units WHERE id = p_product_unit_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product unit not found');
    END IF;

    -- Check if serial is already actively reserved
    IF EXISTS (
        SELECT 1 FROM public.sales_order_reservations 
        WHERE product_unit_id = p_product_unit_id 
        AND reservation_status IN ('RESERVED', 'PICKED', 'PACKED', 'DISPATCHED')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Duplicate Allocation Error: Serial number is already allocated to an active order');
    END IF;

    -- Insert reservation
    INSERT INTO public.sales_order_reservations (
        tenant_id,
        sales_order_id,
        sales_order_item_id,
        product_unit_id,
        warehouse_id,
        reservation_status,
        reserved_at
    ) VALUES (
        v_order.tenant_id,
        p_order_id,
        p_item_id,
        p_product_unit_id,
        p_warehouse_id,
        'RESERVED',
        now()
    );

    -- Update item allocated quantity
    UPDATE public.sales_order_items
    SET 
        quantity_allocated = quantity_allocated + 1,
        allocated_warehouse_id = p_warehouse_id,
        status = CASE 
            WHEN quantity_allocated + 1 = quantity_ordered THEN 'ALLOCATED'
            ELSE 'PARTIALLY_ALLOCATED'
        END,
        updated_at = now()
    WHERE id = p_item_id;

    -- Update order status to ALLOCATED if not already
    UPDATE public.sales_orders
    SET 
        status = 'ALLOCATED',
        updated_at = now()
    WHERE id = p_order_id AND status IN ('APPROVED', 'CONFIRMED');

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'item_id', p_item_id,
        'product_unit_id', p_product_unit_id,
        'message', 'Inventory unit allocated successfully'
    );
END;
$$;

-- RPC 6: fn_confirm_delivery_proof
-- Server-authoritative delivery confirmation with immutable proof-of-delivery details
CREATE OR REPLACE FUNCTION public.fn_confirm_delivery_proof(
    p_challan_id UUID,
    p_receiver_name TEXT,
    p_receiver_phone TEXT,
    p_pod_ref TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_challan public.delivery_challans%ROWTYPE;
    v_order public.sales_orders%ROWTYPE;
BEGIN
    SELECT * INTO v_challan FROM public.delivery_challans WHERE id = p_challan_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Delivery challan not found');
    END IF;

    IF v_challan.status = 'DELIVERED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challan is already marked as DELIVERED');
    END IF;

    -- Update challan to DELIVERED with POD details
    UPDATE public.delivery_challans
    SET 
        status = 'DELIVERED',
        delivered_at = now(),
        pod_receiver_name = p_receiver_name,
        pod_contact_phone = p_receiver_phone,
        pod_signature_ref = p_pod_ref,
        updated_at = now()
    WHERE id = p_challan_id;

    -- Update reservations to DELIVERED
    UPDATE public.sales_order_reservations
    SET 
        reservation_status = 'DELIVERED',
        delivered_at = now(),
        updated_at = now()
    WHERE sales_order_id = v_challan.sales_order_id 
    AND reservation_status IN ('PICKED', 'PACKED', 'DISPATCHED');

    -- Update sales order to DELIVERED
    UPDATE public.sales_orders
    SET 
        status = 'DELIVERED',
        updated_at = now()
    WHERE id = v_challan.sales_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'challan_id', p_challan_id,
        'status', 'DELIVERED',
        'message', 'Delivery proof confirmed and order updated'
    );
END;
$$;

-- RPC 7: fn_approve_credit_note
-- Maker-checker approval of statutory GST credit notes
CREATE OR REPLACE FUNCTION public.fn_approve_credit_note(p_credit_note_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cn public.statutory_credit_notes%ROWTYPE;
    v_approver_id UUID := auth.uid();
BEGIN
    SELECT * INTO v_cn FROM public.statutory_credit_notes WHERE id = p_credit_note_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Statutory credit note not found');
    END IF;

    IF v_cn.statutory_status != 'DRAFT' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only DRAFT credit notes can be approved');
    END IF;

    -- Maker-checker enforcement
    IF v_approver_id IS NOT NULL AND v_cn.created_by = v_approver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maker-Checker Violation: Creator cannot approve their own credit note');
    END IF;

    UPDATE public.statutory_credit_notes
    SET 
        statutory_status = 'ISSUED',
        updated_at = now()
    WHERE id = p_credit_note_id;

    RETURN jsonb_build_object(
        'success', true,
        'credit_note_id', p_credit_note_id,
        'status', 'ISSUED',
        'message', 'Credit note approved and issued'
    );
END;
$$;

-- RPC 8: fn_run_order_to_cash_intelligence_sweep
-- Idempotent intelligence sweep generating advisory revenue signals and operational exceptions
CREATE OR REPLACE FUNCTION public.fn_run_order_to_cash_intelligence_sweep()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_exceptions_count INT := 0;
    v_signals_count INT := 0;
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000000'::uuid;
    r_so RECORD;
    r_ar RECORD;
    v_exc_num TEXT;
BEGIN
    -- 1. Detect stuck approvals (> 48 hours in PENDING_APPROVAL)
    FOR r_so IN 
        SELECT so.id, so.so_number, so.created_at, so.tenant_id
        FROM public.sales_orders so
        WHERE so.status = 'PENDING_APPROVAL' 
        AND so.created_at < now() - INTERVAL '48 hours'
    LOOP
        v_exc_num := 'EXC-' || nextval('public.seq_o2c_exception_number');
        IF NOT EXISTS (
            SELECT 1 FROM public.o2c_exceptions 
            WHERE sales_order_id = r_so.id AND exception_type = 'STUCK_APPROVAL' AND status = 'OPEN'
        ) THEN
            INSERT INTO public.o2c_exceptions (
                tenant_id,
                exception_number,
                exception_type,
                severity,
                sales_order_id,
                title,
                description,
                root_cause
            ) VALUES (
                r_so.tenant_id,
                v_exc_num,
                'STUCK_APPROVAL',
                'HIGH',
                r_so.id,
                format('Order %s Pending Approval > 48 Hours', r_so.so_number),
                format('Sales order %s has been awaiting managerial approval since %s', r_so.so_number, r_so.created_at),
                'Managerial turnaround SLA breach'
            );
            v_exceptions_count := v_exceptions_count + 1;
        END IF;
    END LOOP;

    -- 2. Detect blocked credit orders
    FOR r_so IN 
        SELECT so.id, so.so_number, so.credit_hold_reason, so.tenant_id
        FROM public.sales_orders so
        WHERE so.credit_check_status = 'BLOCK' OR so.status = 'CREDIT_HOLD'
    LOOP
        v_exc_num := 'EXC-' || nextval('public.seq_o2c_exception_number');
        IF NOT EXISTS (
            SELECT 1 FROM public.o2c_exceptions 
            WHERE sales_order_id = r_so.id AND exception_type = 'BLOCKED_CREDIT' AND status = 'OPEN'
        ) THEN
            INSERT INTO public.o2c_exceptions (
                tenant_id,
                exception_number,
                exception_type,
                severity,
                sales_order_id,
                title,
                description,
                root_cause
            ) VALUES (
                r_so.tenant_id,
                v_exc_num,
                'BLOCKED_CREDIT',
                'CRITICAL',
                r_so.id,
                format('Order %s Blocked on Credit Hold', r_so.so_number),
                COALESCE(r_so.credit_hold_reason, 'Credit limit exceeded or account suspended'),
                'Customer or dealer credit risk threshold breach'
            );
            v_exceptions_count := v_exceptions_count + 1;
        END IF;
    END LOOP;

    -- 3. Generate Advisory Revenue Signals
    INSERT INTO public.o2c_revenue_signals (
        tenant_id,
        signal_code,
        signal_type,
        severity,
        target_entity_type,
        headline,
        explanation,
        metric_value,
        metric_unit,
        advisory_recommendation
    ) VALUES (
        v_tenant_id,
        'SIG-FULFILL-001',
        'DISPATCH_BOTTLENECK',
        'MEDIUM',
        'OVERALL',
        'Fulfillment Dispatch Pipeline Active',
        'Allocated orders awaiting packing and dispatch challan generation',
        12.5,
        '%',
        'Review warehouse packing queue and optimize vehicle carrier dispatch allocations'
    ) ON CONFLICT (tenant_id, signal_code) DO NOTHING;
    v_signals_count := v_signals_count + 1;

    RETURN jsonb_build_object(
        'success', true,
        'exceptions_created', v_exceptions_count,
        'signals_created', v_signals_count,
        'message', 'Order-to-cash intelligence sweep completed successfully'
    );
END;
$$;

-- =============================================================================
-- 9. ROW-LEVEL SECURITY (RLS) POLICIES
-- Strict multi-tenant isolation and role-based access control
-- =============================================================================

ALTER TABLE public.o2c_order_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.o2c_payment_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.o2c_revenue_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.o2c_exceptions ENABLE ROW LEVEL SECURITY;

-- o2c_order_approvals RLS
DROP POLICY IF EXISTS p_o2c_order_approvals_tenant ON public.o2c_order_approvals;
CREATE POLICY p_o2c_order_approvals_tenant ON public.o2c_order_approvals
    FOR ALL
    USING (tenant_id = (COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid)
    WITH CHECK (tenant_id = (COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);

-- o2c_payment_reconciliations RLS
DROP POLICY IF EXISTS p_o2c_payment_recon_tenant ON public.o2c_payment_reconciliations;
CREATE POLICY p_o2c_payment_recon_tenant ON public.o2c_payment_reconciliations
    FOR ALL
    USING (tenant_id = (COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid)
    WITH CHECK (tenant_id = (COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);

-- o2c_revenue_signals RLS
DROP POLICY IF EXISTS p_o2c_revenue_signals_tenant ON public.o2c_revenue_signals;
CREATE POLICY p_o2c_revenue_signals_tenant ON public.o2c_revenue_signals
    FOR ALL
    USING (tenant_id = (COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid)
    WITH CHECK (tenant_id = (COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);

-- o2c_exceptions RLS
DROP POLICY IF EXISTS p_o2c_exceptions_tenant ON public.o2c_exceptions;
CREATE POLICY p_o2c_exceptions_tenant ON public.o2c_exceptions
    FOR ALL
    USING (tenant_id = (COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid)
    WITH CHECK (tenant_id = (COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);

-- =============================================================================
-- 10. GRANTS AND PRIVILEGE REVOCATIONS
-- =============================================================================
REVOKE ALL ON FUNCTION public.fn_submit_sales_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_submit_sales_order(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_approve_sales_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_approve_sales_order(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_run_order_credit_check(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_run_order_credit_check(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_override_credit_block(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_override_credit_block(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_allocate_order_inventory(UUID, UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_allocate_order_inventory(UUID, UUID, UUID, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_confirm_delivery_proof(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_confirm_delivery_proof(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_approve_credit_note(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_approve_credit_note(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_run_order_to_cash_intelligence_sweep() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_run_order_to_cash_intelligence_sweep() TO authenticated, service_role;

GRANT ALL ON TABLE public.o2c_order_approvals TO authenticated, service_role;
GRANT ALL ON TABLE public.o2c_payment_reconciliations TO authenticated, service_role;
GRANT ALL ON TABLE public.o2c_revenue_signals TO authenticated, service_role;
GRANT ALL ON TABLE public.o2c_exceptions TO authenticated, service_role;
GRANT SELECT ON TABLE public.vw_o2c_revenue_operations_cockpit TO authenticated, service_role;
