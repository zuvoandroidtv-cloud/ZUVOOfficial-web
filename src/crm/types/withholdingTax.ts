/**
 * ZUVO TV CRM — Domain Types: Statutory Withholding Tax (TDS/TCS)
 * Phase 8.12 Architecture
 */

export interface TdsSectionMaster {
  id: string;
  section_code: string;
  section_title: string;
  act_section: string;
  default_rate_pct: number;
  higher_rate_pct: number;
  surcharge_rate_pct: number;
  cess_rate_pct: number;
  threshold_amount: number;
  threshold_type: 'PER_BILL' | 'ANNUAL_AGGREGATE' | 'SINGLE_OR_AGGREGATE';
  gl_liability_account_id?: string;
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface VendorTdsProfile {
  id: string;
  vendor_id: string;
  pan_number: string;
  is_pan_valid: boolean;
  is_specified_person_206ab: boolean;
  entity_classification: 'COMPANY' | 'INDIVIDUAL' | 'HUF' | 'PARTNERSHIP' | 'LLP' | 'GOVERNMENT' | 'FOREIGN_ENTITY';
  has_lower_deduction_cert: boolean;
  lower_deduction_cert_no?: string;
  lower_deduction_rate_pct?: number;
  lower_deduction_valid_from?: string;
  lower_deduction_valid_to?: string;
  lower_deduction_limit_amount?: number;
  cumulative_financial_turnover: number;
  current_fiscal_year: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TdsDeductionRecord {
  id: string;
  deduction_number: string;
  source_type: 'VENDOR_INVOICE' | 'LANDED_COST_VOUCHER' | 'DEALER_SCHEME_SETTLEMENT' | 'MANUAL_DEDUCTION';
  source_id: string;
  vendor_id?: string;
  dealer_id?: string;
  tds_section_id: string;
  deduction_date: string;
  fiscal_year: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  gross_base_amount: number;
  exemption_threshold_applied: number;
  taxable_base_amount: number;
  applied_rate_pct: number;
  tds_tax_amount: number;
  surcharge_amount: number;
  cess_amount: number;
  total_tds_deducted: number;
  net_payable_amount: number;
  pan_status: 'VALID_PAN' | 'INVALID_PAN' | 'PAN_NOT_AVAILABLE' | 'LOWER_DEDUCTION_CERT';
  rate_basis: 'NORMAL_RATE' | 'HIGHER_RATE_206AA' | 'HIGHER_RATE_206AB' | 'LOWER_RATE_CERT';
  gl_journal_entry_id?: string;
  settlement_status: 'ACCRUED' | 'DEPOSITED' | 'CANCELLED' | 'REFUNDED';
  challan_id?: string;
  certificate_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TdsChallanSettlement {
  id: string;
  challan_reference_number: string;
  bsr_code: string;
  challan_tender_date: string;
  challan_serial_number: string;
  payment_mode: 'E_PAYMENT' | 'NET_BANKING' | 'NEFT_RTGS' | 'OVER_THE_COUNTER';
  bank_account_id?: string;
  fiscal_year: string;
  tax_month: string;
  section_code: string;
  total_tax_amount: number;
  surcharge_amount: number;
  cess_amount: number;
  interest_amount: number;
  fee_penalty_amount: number;
  total_challan_amount: number;
  allocated_deductions_count: number;
  gl_journal_entry_id?: string;
  bank_utr_number?: string;
  notes?: string;
  created_at: string;
}

export interface TdsForm26qBatch {
  id: string;
  batch_reference_number: string;
  fiscal_year: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  period_start_date: string;
  period_end_date: string;
  total_deductions_count: number;
  total_taxable_base: number;
  total_tds_deducted: number;
  total_tds_deposited: number;
  challan_matched_count: number;
  status: 'DRAFT' | 'VALIDATED' | 'CIN_VERIFIED' | 'FILED' | 'ACCEPTED_BY_TIN';
  tin_acknowledgement_number?: string;
  filing_date?: string;
  notes?: string;
  created_at: string;
}

export interface TdsForm16aCertificate {
  id: string;
  certificate_number: string;
  form_26q_batch_id?: string;
  recipient_type: 'VENDOR' | 'DEALER';
  recipient_vendor_id?: string;
  recipient_dealer_id?: string;
  pan_number: string;
  legal_name: string;
  fiscal_year: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  total_amount_credited: number;
  total_tds_deducted: number;
  total_tds_deposited: number;
  issue_date: string;
  download_url?: string;
  status: 'GENERATED' | 'DISPATCHED_TO_PARTY' | 'ACKNOWLEDGED';
  created_at: string;
}
