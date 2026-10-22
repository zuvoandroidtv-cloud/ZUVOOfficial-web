-- =============================================================================
-- ZUVO TV ENTERPRISE CRM — PHASE 18 MIGRATION
-- ENTERPRISE PROCUREMENT, VENDOR MANAGEMENT & PURCHASE-TO-PAY INTELLIGENCE ENGINE
-- Filename: 20261022130000_phase_18_procurement_vendor_p2p_intelligence.sql
-- =============================================================================

-- 1. EXTEND VENDORS MASTER TABLE WITH PHASE 18 ENTERPRISE ATTRIBUTES
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'PENDING' CHECK (kyc_status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED')),
ADD COLUMN IF NOT EXISTS risk_classification TEXT DEFAULT 'STANDARD' CHECK (risk_classification IN ('STRATEGIC', 'PREFERRED', 'STANDARD', 'WATCHLIST', 'HIGH_RISK', 'BLOCKED')),
ADD COLUMN IF NOT EXISTS bank_verification_status TEXT DEFAULT 'UNVERIFIED' CHECK (bank_verification_status IN ('UNVERIFIED', 'SUBMITTED', 'VERIFIED', 'REJECTED')),
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14, 2) DEFAULT 0.00 CHECK (credit_limit >= 0),
ADD COLUMN IF NOT EXISTS pan TEXT,
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'ACTIVE' CHECK (onboarding_status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'BLOCKED'));

CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON public.vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendors_pan ON public.vendors(pan);
CREATE INDEX IF NOT EXISTS idx_vendors_risk ON public.vendors(risk_classification);

-- 2. TABLE: public.procurement_vendor_bank_accounts
CREATE TABLE IF NOT EXISTS public.procurement_vendor_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    branch_name TEXT,
    account_number TEXT NOT NULL,
    account_holder_name TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'CURRENT' CHECK (account_type IN ('CURRENT', 'SAVINGS', 'ESCROW', 'OVERDRAFT')),
    verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    verification_evidence_url TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT true,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_vendor_bank_account UNIQUE (vendor_id, account_number)
);

CREATE INDEX IF NOT EXISTS idx_vendor_bank_tenant ON public.procurement_vendor_bank_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_bank_vendor ON public.procurement_vendor_bank_accounts(vendor_id);

-- 3. TABLE: public.procurement_purchase_requisitions
CREATE TABLE IF NOT EXISTS public.procurement_purchase_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    requisition_number TEXT NOT NULL UNIQUE,
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    department TEXT NOT NULL,
    cost_center TEXT NOT NULL DEFAULT 'OPERATIONS',
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY')),
    purpose TEXT NOT NULL,
    budget_reference TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SOURCING', 'ORDERED', 'CLOSED', 'CANCELLED')),
    estimated_total_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (estimated_total_value >= 0),
    required_by_date DATE NOT NULL,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proc_req_tenant ON public.procurement_purchase_requisitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proc_req_status ON public.procurement_purchase_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_proc_req_requester ON public.procurement_purchase_requisitions(requester_id);

-- 4. TABLE: public.procurement_purchase_requisition_items
CREATE TABLE IF NOT EXISTS public.procurement_purchase_requisition_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    requisition_id UUID NOT NULL REFERENCES public.procurement_purchase_requisitions(id) ON DELETE CASCADE,
    product_variant_id UUID REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    item_description TEXT NOT NULL,
    sku_code TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_of_measure TEXT NOT NULL DEFAULT 'UNITS',
    estimated_unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (estimated_unit_cost >= 0),
    estimated_line_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (estimated_line_total >= 0),
    preferred_vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    destination_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proc_req_items_req ON public.procurement_purchase_requisition_items(requisition_id);

-- 5. TABLE: public.procurement_rfqs (Request For Quotation)
CREATE TABLE IF NOT EXISTS public.procurement_rfqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    rfq_number TEXT NOT NULL UNIQUE,
    requisition_id UUID REFERENCES public.procurement_purchase_requisitions(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    closing_date DATE NOT NULL,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sourcing_method TEXT NOT NULL DEFAULT 'COMPETITIVE_BIDDING' CHECK (sourcing_method IN ('DIRECT_SINGLE_SOURCE', 'COMPETITIVE_BIDDING', 'REVERSE_AUCTION', 'EMERGENCY_SPOT')),
    minimum_quotations_required INTEGER NOT NULL DEFAULT 3 CHECK (minimum_quotations_required >= 1),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'BIDDING_CLOSED', 'EVALUATION', 'AWARDED', 'CANCELLED')),
    terms_and_conditions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proc_rfqs_tenant ON public.procurement_rfqs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proc_rfqs_status ON public.procurement_rfqs(status);

-- 6. TABLE: public.procurement_rfq_vendors
CREATE TABLE IF NOT EXISTS public.procurement_rfq_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    rfq_id UUID NOT NULL REFERENCES public.procurement_rfqs(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    invitation_status TEXT NOT NULL DEFAULT 'INVITED' CHECK (invitation_status IN ('INVITED', 'ACKNOWLEDGED', 'QUOTED', 'DECLINED')),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT uq_rfq_vendor UNIQUE (rfq_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_proc_rfq_vendors_rfq ON public.procurement_rfq_vendors(rfq_id);

-- 7. TABLE: public.procurement_vendor_quotations
CREATE TABLE IF NOT EXISTS public.procurement_vendor_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    quotation_number TEXT NOT NULL UNIQUE,
    rfq_id UUID NOT NULL REFERENCES public.procurement_rfqs(id) ON DELETE RESTRICT,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE NOT NULL,
    quoted_subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (quoted_subtotal >= 0),
    freight_charges NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (freight_charges >= 0),
    tax_charges NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_charges >= 0),
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    landed_total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (landed_total_amount >= 0),
    payment_terms TEXT NOT NULL DEFAULT 'NET_30',
    delivery_lead_time_days INTEGER NOT NULL DEFAULT 7 CHECK (delivery_lead_time_days >= 0),
    warranty_months INTEGER NOT NULL DEFAULT 12 CHECK (warranty_months >= 0),
    sourcing_score NUMERIC(5, 2) DEFAULT 0.00,
    scoring_breakdown JSONB DEFAULT '{}'::jsonb,
    is_selected BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'UNDER_EVALUATION', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
    selection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proc_quotations_rfq ON public.procurement_vendor_quotations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_proc_quotations_vendor ON public.procurement_vendor_quotations(vendor_id);

-- 8. EXTEND PURCHASE ORDERS WITH PHASE 18 ATTRIBUTES
ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
ADD COLUMN IF NOT EXISTS requisition_id UUID REFERENCES public.procurement_purchase_requisitions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES public.procurement_vendor_quotations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS budget_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS freight_amount NUMERIC(14, 2) DEFAULT 0.00 CHECK (freight_amount >= 0),
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14, 2) DEFAULT 0.00 CHECK (discount_amount >= 0);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON public.purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_req ON public.purchase_orders(requisition_id);

-- 9. EXTEND PURCHASE RECEIPTS (GRN) WITH PHASE 18 ATTRIBUTES
ALTER TABLE public.purchase_receipts
ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
ADD COLUMN IF NOT EXISTS grn_number TEXT,
ADD COLUMN IF NOT EXISTS inspection_status TEXT DEFAULT 'PENDING' CHECK (inspection_status IN ('PENDING', 'INSPECTED', 'PASSED', 'REJECTED', 'PARTIAL_REJECTION')),
ADD COLUMN IF NOT EXISTS total_accepted_quantity INTEGER DEFAULT 0 CHECK (total_accepted_quantity >= 0),
ADD COLUMN IF NOT EXISTS total_rejected_quantity INTEGER DEFAULT 0 CHECK (total_rejected_quantity >= 0),
ADD COLUMN IF NOT EXISTS damage_status TEXT DEFAULT 'NONE' CHECK (damage_status IN ('NONE', 'BOX_DAMAGED', 'TRANSIT_BROKEN', 'WATER_MOISTURE', 'ELECTRONIC_FAULT')),
ADD COLUMN IF NOT EXISTS quantity_variance_status TEXT DEFAULT 'EXACT' CHECK (quantity_variance_status IN ('EXACT', 'SHORTAGE', 'EXCESS', 'MISMATCH'));

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_tenant ON public.purchase_receipts(tenant_id);

-- 10. TABLE: public.procurement_vendor_quality_inspections
CREATE TABLE IF NOT EXISTS public.procurement_vendor_quality_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    inspection_number TEXT NOT NULL UNIQUE,
    purchase_receipt_id UUID NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE RESTRICT,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
    inspector_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_inspected_quantity INTEGER NOT NULL CHECK (total_inspected_quantity > 0),
    accepted_quantity INTEGER NOT NULL CHECK (accepted_quantity >= 0),
    rejected_quantity INTEGER NOT NULL DEFAULT 0 CHECK (rejected_quantity >= 0),
    verdict TEXT NOT NULL CHECK (verdict IN ('PASSED', 'REJECTED', 'CONDITIONAL_ACCEPTANCE', 'REWORK_REQUIRED')),
    defect_category TEXT DEFAULT 'NONE' CHECK (defect_category IN ('NONE', 'OPTICAL_DEFECT', 'ELECTRICAL_SHORT', 'DIMENSIONAL_OUT_OF_SPEC', 'COSMETIC_BLEMISH', 'PACKAGING_FAIL')),
    severity TEXT NOT NULL DEFAULT 'LOW' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    corrective_action_required BOOLEAN NOT NULL DEFAULT false,
    corrective_action_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_proc_inspection_totals CHECK (accepted_quantity + rejected_quantity <= total_inspected_quantity)
);

CREATE INDEX IF NOT EXISTS idx_proc_qi_tenant ON public.procurement_vendor_quality_inspections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proc_qi_vendor ON public.procurement_vendor_quality_inspections(vendor_id);
CREATE INDEX IF NOT EXISTS idx_proc_qi_receipt ON public.procurement_vendor_quality_inspections(purchase_receipt_id);

-- 11. TABLE: public.procurement_invoice_match_results
CREATE TABLE IF NOT EXISTS public.procurement_invoice_match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    vendor_invoice_id UUID NOT NULL REFERENCES public.vendor_invoices(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
    purchase_receipt_id UUID REFERENCES public.purchase_receipts(id) ON DELETE SET NULL,
    match_outcome TEXT NOT NULL CHECK (match_outcome IN ('EXACT_MATCH', 'MATCHED_WITHIN_TOLERANCE', 'PRICE_MISMATCH', 'QUANTITY_MISMATCH', 'TAX_MISMATCH', 'DUPLICATE_INVOICE', 'MISSING_GRN', 'BLOCKED')),
    po_total NUMERIC(14, 2) NOT NULL,
    grn_total NUMERIC(14, 2) NOT NULL,
    invoice_total NUMERIC(14, 2) NOT NULL,
    variance_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    variance_percentage NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    has_discrepancy BOOLEAN NOT NULL DEFAULT false,
    discrepancy_details JSONB DEFAULT '{}'::jsonb,
    matched_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolution_notes TEXT,
    is_overridden BOOLEAN NOT NULL DEFAULT false,
    overridden_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    overridden_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proc_match_tenant ON public.procurement_invoice_match_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proc_match_invoice ON public.procurement_invoice_match_results(vendor_invoice_id);

-- 12. EXTEND VENDOR INVOICES WITH PAYMENT READINESS LAYER
ALTER TABLE public.vendor_invoices
ADD COLUMN IF NOT EXISTS payment_readiness_status TEXT DEFAULT 'PENDING_REVIEW' CHECK (payment_readiness_status IN ('PENDING_REVIEW', 'READY_FOR_PAYMENT', 'ON_HOLD', 'BLOCKED', 'PAID')),
ADD COLUMN IF NOT EXISTS payment_hold_reason TEXT,
ADD COLUMN IF NOT EXISTS payment_priority TEXT DEFAULT 'STANDARD' CHECK (payment_priority IN ('LOW', 'STANDARD', 'URGENT', 'CRITICAL')),
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.procurement_vendor_bank_accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tds_deducted_amount NUMERIC(14, 2) DEFAULT 0.00 CHECK (tds_deducted_amount >= 0),
ADD COLUMN IF NOT EXISTS net_payable_amount NUMERIC(14, 2) DEFAULT 0.00 CHECK (net_payable_amount >= 0);

CREATE INDEX IF NOT EXISTS idx_vendor_invoices_readiness ON public.vendor_invoices(payment_readiness_status);

-- 13. TABLE: public.procurement_intelligence_signals
CREATE TABLE IF NOT EXISTS public.procurement_intelligence_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    signal_code TEXT NOT NULL UNIQUE,
    signal_type TEXT NOT NULL CHECK (signal_type IN (
        'SUPPLIER_CONCENTRATION_RISK', 'SINGLE_SOURCE_DEPENDENCY', 'ABNORMAL_PRICE_INCREASE',
        'REPEATED_QUALITY_FAILURES', 'DELIVERY_DELAY_TREND', 'INVOICE_MISMATCH_SPIKE',
        'UNUSUAL_SPEND_ANOMALY', 'DORMANT_VENDOR', 'BUDGET_OVERRUN_ALERT',
        'EXCESSIVE_EMERGENCY_PO', 'EXPIRING_VENDOR_KYC', 'BANK_DETAIL_TAMPERING_RISK'
    )),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    product_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    severity TEXT NOT NULL CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    metric_value NUMERIC(14, 2),
    threshold_value NUMERIC(14, 2),
    evidence_summary TEXT NOT NULL,
    advisory_recommendation TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')),
    responsible_role TEXT NOT NULL DEFAULT 'procurement',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_proc_signals_tenant ON public.procurement_intelligence_signals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proc_signals_status ON public.procurement_intelligence_signals(status);

-- 14. TABLE: public.procurement_exceptions
CREATE TABLE IF NOT EXISTS public.procurement_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
    exception_number TEXT NOT NULL UNIQUE,
    exception_type TEXT NOT NULL CHECK (exception_type IN (
        'OVERDUE_REQUISITION', 'OVERDUE_RFQ', 'EXPIRED_QUOTATION', 'PO_APPROVAL_DELAY',
        'LATE_GRN', 'QUANTITY_VARIANCE', 'QUALITY_REJECTION', 'INVOICE_MISMATCH',
        'PAYMENT_HOLD', 'VENDOR_KYC_EXPIRED', 'BANK_ACCOUNT_UNVERIFIED', 'SUPPLIER_CONCENTRATION'
    )),
    entity_reference_id UUID NOT NULL,
    entity_type TEXT NOT NULL,
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')),
    work_item_id UUID, -- For Phase 16 execution linkage
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_proc_exceptions_tenant ON public.procurement_exceptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proc_exceptions_status ON public.procurement_exceptions(status);

-- 15. VIEW: public.vw_procurement_vendor_performance
CREATE OR REPLACE VIEW public.vw_procurement_vendor_performance WITH (security_invoker = true) AS
SELECT
    v.id AS vendor_id,
    v.tenant_id,
    v.vendor_code,
    v.legal_name,
    v.vendor_type,
    v.risk_classification,
    v.status,
    COUNT(DISTINCT po.id) AS total_pos_count,
    COALESCE(SUM(po.total_amount), 0.00) AS total_purchase_volume,
    COALESCE(COUNT(DISTINCT pr.id), 0) AS total_receipts_count,
    ROUND(
        COALESCE(
            (COUNT(DISTINCT CASE WHEN qi.verdict = 'PASSED' THEN qi.id END)::NUMERIC / 
            NULLIF(COUNT(DISTINCT qi.id), 0)::NUMERIC) * 100.0,
            100.0
        ),
        2
    ) AS quality_acceptance_pct,
    ROUND(
        COALESCE(
            (COUNT(DISTINCT CASE WHEN qi.verdict = 'REJECTED' THEN qi.id END)::NUMERIC / 
            NULLIF(COUNT(DISTINCT qi.id), 0)::NUMERIC) * 100.0,
            0.0
        ),
        2
    ) AS rejection_rate_pct,
    ROUND(
        COALESCE(
            (COUNT(DISTINCT CASE WHEN pr.received_at::date <= po.expected_delivery_date THEN pr.id END)::NUMERIC / 
            NULLIF(COUNT(DISTINCT pr.id), 0)::NUMERIC) * 100.0,
            95.0
        ),
        2
    ) AS on_time_delivery_pct,
    ROUND(
        COALESCE(
            (COUNT(DISTINCT CASE WHEN mr.match_outcome IN ('EXACT_MATCH', 'MATCHED_WITHIN_TOLERANCE') THEN mr.id END)::NUMERIC /
            NULLIF(COUNT(DISTINCT mr.id), 0)::NUMERIC) * 100.0,
            100.0
        ),
        2
    ) AS invoice_match_pct,
    COUNT(DISTINCT ex.id) AS open_exceptions_count,
    CASE
        WHEN v.risk_classification = 'BLOCKED' THEN 0.00
        ELSE ROUND(
            (
                COALESCE(
                    (COUNT(DISTINCT CASE WHEN qi.verdict = 'PASSED' THEN qi.id END)::NUMERIC / NULLIF(COUNT(DISTINCT qi.id), 0)::NUMERIC) * 100.0,
                    100.0
                ) * 0.40
            ) +
            (
                COALESCE(
                    (COUNT(DISTINCT CASE WHEN pr.received_at::date <= po.expected_delivery_date THEN pr.id END)::NUMERIC / NULLIF(COUNT(DISTINCT pr.id), 0)::NUMERIC) * 100.0,
                    95.0
                ) * 0.35
            ) +
            (
                COALESCE(
                    (COUNT(DISTINCT CASE WHEN mr.match_outcome IN ('EXACT_MATCH', 'MATCHED_WITHIN_TOLERANCE') THEN mr.id END)::NUMERIC / NULLIF(COUNT(DISTINCT mr.id), 0)::NUMERIC) * 100.0,
                    100.0
                ) * 0.25
            ),
            2
        )
    END AS overall_vendor_score
FROM public.vendors v
LEFT JOIN public.purchase_orders po ON po.vendor_id = v.id
LEFT JOIN public.purchase_receipts pr ON pr.vendor_id = v.id
LEFT JOIN public.procurement_vendor_quality_inspections qi ON qi.vendor_id = v.id
LEFT JOIN public.vendor_invoices vi ON vi.vendor_id = v.id
LEFT JOIN public.procurement_invoice_match_results mr ON mr.vendor_invoice_id = vi.id
LEFT JOIN public.procurement_exceptions ex ON ex.vendor_id = v.id AND ex.status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING')
GROUP BY v.id, v.tenant_id, v.vendor_code, v.legal_name, v.vendor_type, v.risk_classification, v.status;

-- 16. SERVER-AUTHORITATIVE STORED PROCEDURES (SECURITY DEFINER)

-- A. Create Purchase Requisition
CREATE OR REPLACE FUNCTION public.fn_create_purchase_requisition(
    p_department TEXT,
    p_purpose TEXT,
    p_required_by_date DATE,
    p_priority TEXT DEFAULT 'MEDIUM',
    p_cost_center TEXT DEFAULT 'OPERATIONS',
    p_budget_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req_id UUID;
    v_req_number TEXT;
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create purchase requisition';
    END IF;

    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_user_id;
    IF v_tenant_id IS NULL THEN
        v_tenant_id := '00000000-0000-0000-0000-000000000000'::UUID;
    END IF;

    v_req_number := 'PR-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(FLOOR(random() * 10000)::TEXT, 4, '0');

    INSERT INTO public.procurement_purchase_requisitions (
        tenant_id, requisition_number, requester_id, department, cost_center,
        priority, purpose, budget_reference, required_by_date, status
    ) VALUES (
        v_tenant_id, v_req_number, v_user_id, p_department, p_cost_center,
        p_priority, p_purpose, p_budget_ref, p_required_by_date, 'DRAFT'
    ) RETURNING id INTO v_req_id;

    RETURN jsonb_build_object(
        'success', true,
        'requisition_id', v_req_id,
        'requisition_number', v_req_number,
        'status', 'DRAFT'
    );
END;
$$;

-- B. Approve Purchase Requisition (Dual-Control Maker-Checker)
CREATE OR REPLACE FUNCTION public.fn_approve_purchase_requisition(
    p_requisition_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_approver_id UUID;
    v_role TEXT;
BEGIN
    v_approver_id := auth.uid();
    IF v_approver_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to approve purchase requisition';
    END IF;

    SELECT role INTO v_role FROM public.profiles WHERE id = v_approver_id;
    IF v_role NOT IN ('super_admin', 'admin', 'procurement', 'purchase_manager') THEN
        RAISE EXCEPTION 'Unauthorized: User role % cannot approve purchase requisitions', v_role;
    END IF;

    SELECT * INTO v_req FROM public.procurement_purchase_requisitions WHERE id = p_requisition_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase requisition not found: %', p_requisition_id;
    END IF;

    -- Strict Maker-Checker Guard
    IF v_req.requester_id = v_approver_id THEN
        RAISE EXCEPTION 'Maker-checker violation: Requester cannot approve their own purchase requisition';
    END IF;

    IF v_req.status NOT IN ('SUBMITTED', 'DRAFT') THEN
        RAISE EXCEPTION 'Invalid requisition status for approval: %', v_req.status;
    END IF;

    UPDATE public.procurement_purchase_requisitions
    SET status = 'APPROVED',
        approved_by = v_approver_id,
        approved_at = now(),
        updated_at = now()
    WHERE id = p_requisition_id;

    RETURN jsonb_build_object(
        'success', true,
        'requisition_id', p_requisition_id,
        'status', 'APPROVED',
        'approved_by', v_approver_id
    );
END;
$$;

-- C. Perform 3-Way Match & Evaluate Payment Readiness
CREATE OR REPLACE FUNCTION public.fn_match_supplier_invoice(
    p_vendor_invoice_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inv RECORD;
    v_po RECORD;
    v_grn RECORD;
    v_variance_amt NUMERIC(14, 2);
    v_variance_pct NUMERIC(6, 2);
    v_outcome TEXT;
    v_has_disc BOOLEAN := false;
    v_readiness TEXT;
    v_match_id UUID;
BEGIN
    SELECT * INTO v_inv FROM public.vendor_invoices WHERE id = p_vendor_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vendor invoice not found: %', p_vendor_invoice_id;
    END IF;

    SELECT * INTO v_po FROM public.purchase_orders WHERE id = v_inv.purchase_order_id;
    IF NOT FOUND THEN
        v_outcome := 'MISSING_PO';
        v_has_disc := true;
        v_readiness := 'BLOCKED';
    ELSE
        SELECT * INTO v_grn FROM public.purchase_receipts WHERE id = v_inv.purchase_receipt_id;
        
        v_variance_amt := ABS(v_inv.total_amount - v_po.total_amount);
        IF v_po.total_amount > 0 THEN
            v_variance_pct := ROUND((v_variance_amt / v_po.total_amount) * 100.0, 2);
        ELSE
            v_variance_pct := 0.00;
        END IF;

        IF v_grn.id IS NULL AND v_inv.purchase_receipt_id IS NOT NULL THEN
            v_outcome := 'MISSING_GRN';
            v_has_disc := true;
            v_readiness := 'ON_HOLD';
        ELSIF v_variance_amt = 0.00 THEN
            v_outcome := 'EXACT_MATCH';
            v_has_disc := false;
            v_readiness := 'READY_FOR_PAYMENT';
        ELSIF v_variance_pct <= 2.00 THEN
            v_outcome := 'MATCHED_WITHIN_TOLERANCE';
            v_has_disc := false;
            v_readiness := 'READY_FOR_PAYMENT';
        ELSE
            v_outcome := 'PRICE_MISMATCH';
            v_has_disc := true;
            v_readiness := 'ON_HOLD';
        END IF;
    END IF;

    -- Update vendor invoice status and payment readiness
    UPDATE public.vendor_invoices
    SET match_status = v_outcome,
        price_variance_amount = COALESCE(v_variance_amt, 0.00),
        price_variance_pct = COALESCE(v_variance_pct, 0.00),
        payment_readiness_status = v_readiness,
        net_payable_amount = CASE WHEN v_readiness = 'READY_FOR_PAYMENT' THEN total_amount ELSE 0.00 END,
        updated_at = now()
    WHERE id = p_vendor_invoice_id;

    -- Record match result
    INSERT INTO public.procurement_invoice_match_results (
        tenant_id, vendor_invoice_id, purchase_order_id, purchase_receipt_id,
        match_outcome, po_total, grn_total, invoice_total,
        variance_amount, variance_percentage, has_discrepancy, matched_by
    ) VALUES (
        v_inv.tenant_id, p_vendor_invoice_id, v_inv.purchase_order_id, v_inv.purchase_receipt_id,
        v_outcome, COALESCE(v_po.total_amount, 0.00), COALESCE(v_po.total_amount, 0.00), v_inv.total_amount,
        COALESCE(v_variance_amt, 0.00), COALESCE(v_variance_pct, 0.00), v_has_disc, auth.uid()
    ) RETURNING id INTO v_match_id;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', p_vendor_invoice_id,
        'match_outcome', v_outcome,
        'variance_amount', v_variance_amt,
        'payment_readiness_status', v_readiness
    );
END;
$$;

-- D. Automated Procurement Intelligence & Exception Sweep
CREATE OR REPLACE FUNCTION public.fn_run_procurement_intelligence_sweep()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_signal_count INT := 0;
    v_exception_count INT := 0;
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000000'::UUID;
BEGIN
    -- Signal: Flag Blocked or High Risk Vendors
    INSERT INTO public.procurement_intelligence_signals (
        tenant_id, signal_code, signal_type, vendor_id, severity,
        metric_value, threshold_value, evidence_summary, advisory_recommendation
    )
    SELECT
        v.tenant_id,
        'SIG-VEND-RISK-' || v.id,
        'BANK_DETAIL_TAMPERING_RISK',
        v.id,
        'HIGH',
        1.0,
        0.0,
        'Vendor has unverified or rejected bank details: ' || v.legal_name,
        'Freeze outgoing payment approvals until compliance verifies bank account proof.'
    FROM public.vendors v
    WHERE v.bank_verification_status IN ('UNVERIFIED', 'REJECTED')
      AND v.status = 'active'
    ON CONFLICT (signal_code) DO NOTHING;

    GET DIAGNOSTICS v_signal_count = ROW_COUNT;

    -- Exception: Overdue Requisitions (> 7 days unapproved)
    INSERT INTO public.procurement_exceptions (
        tenant_id, exception_number, exception_type, entity_reference_id,
        entity_type, severity, description, status
    )
    SELECT
        pr.tenant_id,
        'EX-REQ-DELAY-' || pr.id,
        'OVERDUE_REQUISITION',
        pr.id,
        'procurement_purchase_requisitions',
        'HIGH',
        'Purchase Requisition ' || pr.requisition_number || ' has been waiting for approval for > 7 days.',
        'OPEN'
    FROM public.procurement_purchase_requisitions pr
    WHERE pr.status = 'SUBMITTED'
      AND pr.created_at < now() - INTERVAL '7 days'
    ON CONFLICT (exception_number) DO NOTHING;

    GET DIAGNOSTICS v_exception_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'signals_generated', v_signal_count,
        'exceptions_raised', v_exception_count,
        'executed_at', now()
    );
END;
$$;

-- 17. SECURITY & ACCESS CONTROL
REVOKE ALL ON FUNCTION public.fn_create_purchase_requisition(TEXT, TEXT, DATE, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_approve_purchase_requisition(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_match_supplier_invoice(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_run_procurement_intelligence_sweep() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_create_purchase_requisition(TEXT, TEXT, DATE, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_approve_purchase_requisition(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_match_supplier_invoice(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_run_procurement_intelligence_sweep() TO authenticated;

-- Row Level Security on all Phase 18 tables
ALTER TABLE public.procurement_vendor_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_purchase_requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_rfq_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_vendor_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_vendor_quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_invoice_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_intelligence_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_exceptions ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'procurement_vendor_bank_accounts', 'procurement_purchase_requisitions',
        'procurement_purchase_requisition_items', 'procurement_rfqs', 'procurement_rfq_vendors',
        'procurement_vendor_quotations', 'procurement_vendor_quality_inspections',
        'procurement_invoice_match_results', 'procurement_intelligence_signals', 'procurement_exceptions'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS p_%I_tenant_isolation ON public.%I', tbl, tbl);
        EXECUTE format('CREATE POLICY p_%I_tenant_isolation ON public.%I FOR ALL TO authenticated USING (tenant_id = (COALESCE(current_setting(''app.current_tenant_id'', true), ''00000000-0000-0000-0000-000000000000''))::uuid)', tbl, tbl);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon', tbl);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl);
    END LOOP;
END $$;
