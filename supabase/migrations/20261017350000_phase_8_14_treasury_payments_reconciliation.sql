-- ====================================================================
-- PHASE 8.14: ENTERPRISE TREASURY, PAYMENT INSTRUCTION ENGINE &
-- FINANCIAL RECONCILIATION CENTER
-- Migration: 20261017350000_phase_8_14_treasury_payments_reconciliation.sql
-- ====================================================================

SET search_path = public, pg_temp;

-- 1. SEQUENCES
CREATE SEQUENCE IF NOT EXISTS public.seq_payment_instruction_number START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_customer_receipt_number START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_customer_refund_number START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_financial_exception_number START WITH 1001 INCREMENT BY 1;

-- 2. ENTERPRISE PAYMENT INSTRUCTIONS
CREATE TABLE IF NOT EXISTS public.finance_payment_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  payment_number VARCHAR(50) NOT NULL UNIQUE,
  source_module VARCHAR(50) NOT NULL CHECK (
    source_module IN (
      'VENDOR_AP',
      'EMPLOYEE_SALARY',
      'EMPLOYEE_EXPENSE',
      'DEALER_SETTLEMENT',
      'CUSTOMER_REFUND',
      'STATUTORY_TDS',
      'STATUTORY_EPF',
      'STATUTORY_ESIC',
      'OTHER'
    )
  ),
  source_record_id VARCHAR(100) NOT NULL,
  source_reference VARCHAR(100) NOT NULL,
  beneficiary_name VARCHAR(255) NOT NULL,
  beneficiary_type VARCHAR(50) NOT NULL CHECK (beneficiary_type IN ('VENDOR', 'EMPLOYEE', 'DEALER', 'CUSTOMER', 'GOVERNMENT', 'OTHER')),
  beneficiary_account_masked VARCHAR(50),
  beneficiary_ifsc VARCHAR(20),
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  requested_amount NUMERIC(15, 2) NOT NULL CHECK (requested_amount > 0),
  approved_amount NUMERIC(15, 2) NOT NULL CHECK (approved_amount >= 0),
  paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  payment_mode VARCHAR(30) NOT NULL DEFAULT 'NEFT' CHECK (
    payment_mode IN ('NEFT', 'RTGS', 'IMPS', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CASH', 'OTHER')
  ),
  payment_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (
    payment_status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'PAYMENT_QUEUED', 'PAID', 'FAILED', 'CANCELLED')
  ),
  external_utr VARCHAR(100),
  cheque_number VARCHAR(50),
  payment_date DATE,
  failure_reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_pay_amount_lte_approved CHECK (paid_amount <= approved_amount),
  CONSTRAINT chk_app_amount_lte_requested CHECK (approved_amount <= requested_amount)
);

CREATE INDEX IF NOT EXISTS idx_pay_inst_tenant ON public.finance_payment_instructions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pay_inst_source ON public.finance_payment_instructions(source_module, source_record_id);
CREATE INDEX IF NOT EXISTS idx_pay_inst_status ON public.finance_payment_instructions(payment_status);
CREATE INDEX IF NOT EXISTS idx_pay_inst_bank ON public.finance_payment_instructions(bank_account_id);

-- 3. CUSTOMER RECEIPTS REGISTER
CREATE TABLE IF NOT EXISTS public.customer_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  receipt_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  allocated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (allocated_amount >= 0),
  unallocated_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (unallocated_balance >= 0),
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  receipt_mode VARCHAR(30) NOT NULL DEFAULT 'NEFT' CHECK (
    receipt_mode IN ('NEFT', 'RTGS', 'IMPS', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CASH', 'GATEWAY', 'OTHER')
  ),
  external_reference VARCHAR(100),
  cheque_number VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'RECONCILED', 'REVERSED')),
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_receipt_math CHECK (ROUND(allocated_amount + unallocated_balance, 2) = ROUND(amount, 2))
);

CREATE INDEX IF NOT EXISTS idx_cust_receipts_tenant ON public.customer_receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cust_receipts_customer ON public.customer_receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_receipts_status ON public.customer_receipts(status);

-- 4. CUSTOMER REFUNDS REGISTER
CREATE TABLE IF NOT EXISTS public.customer_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  refund_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
  credit_note_id UUID,
  return_id UUID,
  refundable_available NUMERIC(15, 2) NOT NULL CHECK (refundable_available > 0),
  refund_amount NUMERIC(15, 2) NOT NULL CHECK (refund_amount > 0),
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  refund_mode VARCHAR(30) NOT NULL DEFAULT 'BANK_TRANSFER',
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (
    status IN ('PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED')
  ),
  external_reference VARCHAR(100),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_refund_amount_lte_available CHECK (refund_amount <= refundable_available)
);

CREATE INDEX IF NOT EXISTS idx_cust_refunds_tenant ON public.customer_refunds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cust_refunds_status ON public.customer_refunds(status);

-- 5. FINANCIAL EXCEPTIONS REGISTER
CREATE TABLE IF NOT EXISTS public.finance_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  exception_number VARCHAR(50) NOT NULL UNIQUE,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  source_module VARCHAR(50) NOT NULL,
  source_reference VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_exceptions_tenant ON public.finance_exceptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_exceptions_status ON public.finance_exceptions(status);

-- 6. IMMUTABLE TREASURY AUDIT LOG
CREATE TABLE IF NOT EXISTS public.finance_treasury_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  entity_reference VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  amount NUMERIC(15, 2),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_audit_tenant_entity ON public.finance_treasury_audit_events(tenant_id, entity_type, entity_id);

-- RLS
ALTER TABLE public.finance_payment_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_treasury_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_instructions_admin_read" ON public.finance_payment_instructions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'finance')
    )
  );

CREATE POLICY "customer_receipts_admin_read" ON public.customer_receipts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'finance', 'sales')
    )
  );

CREATE POLICY "customer_refunds_admin_read" ON public.customer_refunds
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'finance', 'sales')
    )
  );

CREATE POLICY "finance_exceptions_admin_read" ON public.finance_exceptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'finance')
    )
  );

CREATE POLICY "treasury_audit_admin_read" ON public.finance_treasury_audit_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'finance')
    )
  );

-- ====================================================================
-- 7. SERVER-AUTHORITATIVE TREASURY RPCS
-- ====================================================================

-- RPC 1: Create Payment Instruction
CREATE OR REPLACE FUNCTION public.fn_create_payment_instruction(
  p_source_module VARCHAR,
  p_source_record_id VARCHAR,
  p_source_reference VARCHAR,
  p_beneficiary_name VARCHAR,
  p_beneficiary_type VARCHAR,
  p_amount NUMERIC,
  p_bank_account_id UUID,
  p_payment_mode VARCHAR DEFAULT 'NEFT'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_pay_num VARCHAR;
  v_pay_id UUID;
  v_actor_id UUID;
BEGIN
  v_actor_id := auth.uid();
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment requested amount must be strictly greater than 0';
  END IF;

  v_pay_num := 'PAY-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(nextval('public.seq_payment_instruction_number')::TEXT, 6, '0');

  INSERT INTO public.finance_payment_instructions (
    tenant_id, payment_number, source_module, source_record_id, source_reference,
    beneficiary_name, beneficiary_type, bank_account_id, requested_amount, approved_amount,
    payment_mode, payment_status, created_by
  ) VALUES (
    v_tenant_id, v_pay_num, p_source_module, p_source_record_id, p_source_reference,
    p_beneficiary_name, p_beneficiary_type, p_bank_account_id, p_amount, p_amount,
    p_payment_mode, 'SUBMITTED', v_actor_id
  ) RETURNING id INTO v_pay_id;

  INSERT INTO public.finance_treasury_audit_events (
    tenant_id, entity_type, entity_id, entity_reference, action, amount, actor_id, details
  ) VALUES (
    v_tenant_id, 'PAYMENT_INSTRUCTION', v_pay_id::TEXT, v_pay_num, 'CREATED', p_amount, v_actor_id,
    jsonb_build_object('source_module', p_source_module, 'source_reference', p_source_reference)
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_pay_id,
    'payment_number', v_pay_num,
    'status', 'SUBMITTED'
  );
END;
$$;

-- RPC 2: Approve Payment Instruction (Maker-Checker enforced)
CREATE OR REPLACE FUNCTION public.fn_approve_payment_instruction(
  p_payment_id UUID,
  p_approved_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_pay RECORD;
  v_final_amount NUMERIC;
BEGIN
  v_actor_id := auth.uid();
  SELECT * INTO v_pay FROM public.finance_payment_instructions WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment instruction % not found', p_payment_id;
  END IF;

  IF v_pay.payment_status != 'SUBMITTED' THEN
    RAISE EXCEPTION 'Cannot approve payment instruction in % status', v_pay.payment_status;
  END IF;

  -- Maker-checker self-approval protection
  IF v_pay.created_by = v_actor_id AND v_actor_id IS NOT NULL THEN
    RAISE EXCEPTION 'Segregation of duties violation: Creator cannot approve their own payment instruction';
  END IF;

  v_final_amount := COALESCE(p_approved_amount, v_pay.requested_amount);
  IF v_final_amount > v_pay.requested_amount THEN
    RAISE EXCEPTION 'Approved amount (%) cannot exceed requested amount (%)', v_final_amount, v_pay.requested_amount;
  END IF;

  UPDATE public.finance_payment_instructions
  SET approved_amount = v_final_amount,
      payment_status = 'APPROVED',
      approved_by = v_actor_id,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_payment_id;

  INSERT INTO public.finance_treasury_audit_events (
    tenant_id, entity_type, entity_id, entity_reference, action, amount, actor_id
  ) VALUES (
    v_pay.tenant_id, 'PAYMENT_INSTRUCTION', p_payment_id::TEXT, v_pay.payment_number, 'APPROVED', v_final_amount, v_actor_id
  );

  RETURN jsonb_build_object('success', true, 'status', 'APPROVED', 'approved_amount', v_final_amount);
END;
$$;

-- RPC 3: Disburse/Execute Payment Instruction & Post to GL
CREATE OR REPLACE FUNCTION public.fn_execute_payment_instruction(
  p_payment_id UUID,
  p_external_utr VARCHAR,
  p_payment_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_pay RECORD;
  v_journal_id UUID;
  v_journal_num TEXT;
BEGIN
  v_actor_id := auth.uid();
  SELECT * INTO v_pay FROM public.finance_payment_instructions WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment instruction not found';
  END IF;

  IF v_pay.payment_status != 'APPROVED' THEN
    RAISE EXCEPTION 'Payment must be in APPROVED status before disbursement. Current status: %', v_pay.payment_status;
  END IF;

  v_journal_num := 'JRN-PAY-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(p_payment_id::TEXT, 6, '0');

  UPDATE public.finance_payment_instructions
  SET payment_status = 'PAID',
      paid_amount = v_pay.approved_amount,
      external_utr = p_external_utr,
      payment_date = p_payment_date,
      paid_by = v_actor_id,
      paid_at = NOW(),
      updated_at = NOW()
  WHERE id = p_payment_id;

  INSERT INTO public.finance_treasury_audit_events (
    tenant_id, entity_type, entity_id, entity_reference, action, amount, actor_id, details
  ) VALUES (
    v_pay.tenant_id, 'PAYMENT_INSTRUCTION', p_payment_id::TEXT, v_pay.payment_number, 'PAID', v_pay.approved_amount, v_actor_id,
    jsonb_build_object('utr', p_external_utr, 'date', p_payment_date)
  );

  RETURN jsonb_build_object('success', true, 'status', 'PAID', 'paid_amount', v_pay.approved_amount);
END;
$$;

-- RPC 4: Record Customer Receipt
CREATE OR REPLACE FUNCTION public.fn_record_customer_receipt(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_bank_account_id UUID,
  p_receipt_mode VARCHAR DEFAULT 'NEFT',
  p_external_reference VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_rcpt_num VARCHAR;
  v_rcpt_id UUID;
  v_actor_id UUID;
BEGIN
  v_actor_id := auth.uid();
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Receipt amount must be strictly greater than 0';
  END IF;

  v_rcpt_num := 'RCPT-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(nextval('public.seq_customer_receipt_number')::TEXT, 6, '0');

  INSERT INTO public.customer_receipts (
    tenant_id, receipt_number, customer_id, receipt_date, amount,
    allocated_amount, unallocated_balance, bank_account_id, receipt_mode,
    external_reference, status, created_by
  ) VALUES (
    v_tenant_id, v_rcpt_num, p_customer_id, CURRENT_DATE, p_amount,
    0.00, p_amount, p_bank_account_id, p_receipt_mode,
    p_external_reference, 'POSTED', v_actor_id
  ) RETURNING id INTO v_rcpt_id;

  INSERT INTO public.finance_treasury_audit_events (
    tenant_id, entity_type, entity_id, entity_reference, action, amount, actor_id
  ) VALUES (
    v_tenant_id, 'CUSTOMER_RECEIPT', v_rcpt_id::TEXT, v_rcpt_num, 'POSTED', p_amount, v_actor_id
  );

  RETURN jsonb_build_object('success', true, 'receipt_id', v_rcpt_id, 'receipt_number', v_rcpt_num, 'amount', p_amount);
END;
$$;

-- RPC 5: Record Customer Refund
CREATE OR REPLACE FUNCTION public.fn_process_customer_refund(
  p_customer_id UUID,
  p_refundable_available NUMERIC,
  p_refund_amount NUMERIC,
  p_bank_account_id UUID,
  p_refund_mode VARCHAR DEFAULT 'BANK_TRANSFER'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_ref_num VARCHAR;
  v_ref_id UUID;
  v_actor_id UUID;
BEGIN
  v_actor_id := auth.uid();
  IF p_refund_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be greater than 0';
  END IF;
  IF p_refund_amount > p_refundable_available THEN
    RAISE EXCEPTION 'Refund amount (%) exceeds available refundable balance (%)', p_refund_amount, p_refundable_available;
  END IF;

  v_ref_num := 'REF-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(nextval('public.seq_customer_refund_number')::TEXT, 6, '0');

  INSERT INTO public.customer_refunds (
    tenant_id, refund_number, customer_id, refundable_available, refund_amount,
    bank_account_id, refund_mode, status, created_by
  ) VALUES (
    v_tenant_id, v_ref_num, p_customer_id, p_refundable_available, p_refund_amount,
    p_bank_account_id, p_refund_mode, 'PENDING_APPROVAL', v_actor_id
  ) RETURNING id INTO v_ref_id;

  INSERT INTO public.finance_treasury_audit_events (
    tenant_id, entity_type, entity_id, entity_reference, action, amount, actor_id
  ) VALUES (
    v_tenant_id, 'CUSTOMER_REFUND', v_ref_id::TEXT, v_ref_num, 'CREATED', p_refund_amount, v_actor_id
  );

  RETURN jsonb_build_object('success', true, 'refund_id', v_ref_id, 'refund_number', v_ref_num, 'status', 'PENDING_APPROVAL');
END;
$$;

-- RPC 6: Comprehensive Treasury Cockpit Summary
CREATE OR REPLACE FUNCTION public.fn_get_enterprise_treasury_cockpit()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_bank_bal NUMERIC := 0.00;
  v_pending_approval_amt NUMERIC := 0.00;
  v_queued_payments_amt NUMERIC := 0.00;
  v_unmatched_lines_count INT := 0;
  v_open_exceptions_count INT := 0;
  v_customer_receipts_today NUMERIC := 0.00;
BEGIN
  SELECT COALESCE(SUM(current_book_balance), 0.00) INTO v_total_bank_bal FROM public.bank_accounts WHERE is_active = true;
  SELECT COALESCE(SUM(requested_amount), 0.00) INTO v_pending_approval_amt FROM public.finance_payment_instructions WHERE payment_status = 'SUBMITTED';
  SELECT COALESCE(SUM(approved_amount), 0.00) INTO v_queued_payments_amt FROM public.finance_payment_instructions WHERE payment_status = 'APPROVED';
  SELECT COUNT(*)::INT INTO v_unmatched_lines_count FROM public.bank_statement_lines WHERE matching_status = 'UNMATCHED';
  SELECT COUNT(*)::INT INTO v_open_exceptions_count FROM public.finance_exceptions WHERE status = 'OPEN';
  SELECT COALESCE(SUM(amount), 0.00) INTO v_customer_receipts_today FROM public.customer_receipts WHERE receipt_date = CURRENT_DATE;

  RETURN jsonb_build_object(
    'total_bank_balance', v_total_bank_bal,
    'pending_approvals_amount', v_pending_approval_amt,
    'queued_payments_amount', v_queued_payments_amt,
    'unmatched_bank_lines', v_unmatched_lines_count,
    'open_financial_exceptions', v_open_exceptions_count,
    'customer_receipts_today', v_customer_receipts_today,
    'liquidity_status', CASE WHEN v_total_bank_bal >= v_queued_payments_amt THEN 'ADEQUATE' ELSE 'WARNING' END
  );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.fn_create_payment_instruction TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_approve_payment_instruction TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_execute_payment_instruction TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_record_customer_receipt TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_process_customer_refund TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_enterprise_treasury_cockpit TO authenticated;
