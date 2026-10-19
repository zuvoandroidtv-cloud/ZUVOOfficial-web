export type PaymentSourceModule =
  | 'VENDOR_AP'
  | 'EMPLOYEE_SALARY'
  | 'EMPLOYEE_EXPENSE'
  | 'DEALER_SETTLEMENT'
  | 'CUSTOMER_REFUND'
  | 'STATUTORY_TDS'
  | 'STATUTORY_EPF'
  | 'STATUTORY_ESIC'
  | 'OTHER';

export type PaymentInstructionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'PAYMENT_QUEUED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED';

export type PaymentMode =
  | 'NEFT'
  | 'RTGS'
  | 'IMPS'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'CASH'
  | 'GATEWAY'
  | 'OTHER';

export interface PaymentInstruction {
  id: string;
  tenant_id: string;
  payment_number: string;
  source_module: PaymentSourceModule;
  source_record_id: string;
  source_reference: string;
  beneficiary_name: string;
  beneficiary_type: 'VENDOR' | 'EMPLOYEE' | 'DEALER' | 'CUSTOMER' | 'GOVERNMENT' | 'OTHER';
  beneficiary_account_masked?: string;
  beneficiary_ifsc?: string;
  bank_account_id?: string;
  requested_amount: number;
  approved_amount: number;
  paid_amount: number;
  currency: string;
  payment_mode: PaymentMode;
  payment_status: PaymentInstructionStatus;
  external_utr?: string;
  cheque_number?: string;
  payment_date?: string;
  failure_reason?: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  paid_by?: string;
  paid_at?: string;
  journal_entry_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerReceipt {
  id: string;
  tenant_id: string;
  receipt_number: string;
  customer_id?: string;
  receipt_date: string;
  amount: number;
  allocated_amount: number;
  unallocated_balance: number;
  bank_account_id?: string;
  receipt_mode: PaymentMode;
  external_reference?: string;
  cheque_number?: string;
  status: 'POSTED' | 'RECONCILED' | 'REVERSED';
  journal_entry_id?: string;
  created_at: string;
}

export interface CustomerRefund {
  id: string;
  tenant_id: string;
  refund_number: string;
  customer_id?: string;
  refundable_available: number;
  refund_amount: number;
  bank_account_id?: string;
  refund_mode: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'PAID' | 'REJECTED' | 'CANCELLED';
  external_reference?: string;
  approved_by?: string;
  approved_at?: string;
  paid_by?: string;
  paid_at?: string;
  created_at: string;
}

export interface FinanceException {
  id: string;
  tenant_id: string;
  exception_number: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source_module: string;
  source_reference: string;
  description: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  assigned_to?: string;
  resolution_notes?: string;
  resolved_at?: string;
  created_at: string;
}

export interface TreasuryCockpitData {
  total_bank_balance: number;
  pending_approvals_amount: number;
  queued_payments_amount: number;
  unmatched_bank_lines: number;
  open_financial_exceptions: number;
  customer_receipts_today: number;
  liquidity_status: 'ADEQUATE' | 'WARNING';
}
