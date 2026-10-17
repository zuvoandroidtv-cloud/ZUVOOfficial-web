/**
 * ZUVO TV CRM — PHASE 8.6 DOMAIN TYPES
 * Enterprise Bank Reconciliation Statement (BRS), Multi-Account Statement Feeds & Corporate Treasury Engine
 *
 * Filename: src/crm/types/bankReconciliation.ts
 */

export type BankAccountType = 'CURRENT' | 'ESCROW' | 'CASH_CREDIT' | 'OTHER';

export type StatementSourceFormat = 'CSV' | 'JSON' | 'MT940';

export type StatementBatchStatus =
  | 'UPLOADED'
  | 'VALIDATED'
  | 'MATCHING'
  | 'MATCHED'
  | 'RECONCILED'
  | 'REJECTED';

export type MatchingStatus =
  | 'UNMATCHED'
  | 'AUTO_MATCHED'
  | 'MANUALLY_MATCHED'
  | 'CLEARED'
  | 'RECONCILED';

export type ReconciliationStatus = 'BALANCED' | 'VARIANCE' | 'RECONCILED' | 'LOCKED';

export type BankAdjustmentType =
  | 'UNCREDITED_DEPOSIT'
  | 'UNPRESENTED_CHEQUE'
  | 'BANK_CHARGE'
  | 'BANK_INTEREST'
  | 'DISHONOUR'
  | 'CHARGEBACK'
  | 'OTHER_ADJUSTMENT';

export type MatchingRule =
  | 'EXACT_UTR'
  | 'EXACT_CHEQUE'
  | 'EXACT_REF'
  | 'DATE_AMOUNT_WINDOW'
  | 'CONTROLLED_FUZZY_REF'
  | 'MANUAL_RECEIPT_ALLOCATION'
  | 'MANUAL_JE_ALLOCATION'
  | 'DIRECT_ADJUSTMENT_POSTED';

export interface BankAccount {
  id: string;
  tenant_id: string;
  bank_name: string;
  account_name: string;
  masked_account_number: string;
  ifsc: string;
  account_type: BankAccountType;
  gl_account_id?: string | null;
  opening_balance: number;
  current_book_balance: number;
  statement_date?: string | null;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankStatementBatch {
  id: string;
  tenant_id: string;
  batch_number: string;
  bank_account_id: string;
  statement_start_date: string;
  statement_end_date: string;
  opening_balance: number;
  closing_balance: number;
  total_deposits: number;
  total_withdrawals: number;
  source_format: StatementSourceFormat;
  source_file_hash: string;
  uploaded_by?: string | null;
  uploaded_at: string;
  status: StatementBatchStatus;
  created_at: string;
  updated_at: string;
}

export interface BankStatementLine {
  id: string;
  batch_id: string;
  bank_account_id: string;
  transaction_date: string;
  value_date: string;
  description: string;
  reference_number?: string | null;
  utr_number?: string | null;
  cheque_number?: string | null;
  withdrawal_amount: number;
  deposit_amount: number;
  running_balance: number;
  matching_status: MatchingStatus;
  matched_journal_entry_id?: string | null;
  matched_payment_receipt_id?: string | null;
  matched_rule?: MatchingRule | string | null;
  match_confidence?: number | null;
  matched_at?: string | null;
  matched_by?: string | null;
  created_at: string;
}

export interface BankReconciliationRecord {
  id: string;
  tenant_id: string;
  reconciliation_number: string;
  bank_account_id: string;
  accounting_period_id: string;
  statement_batch_id?: string | null;
  gl_book_balance: number;
  bank_statement_balance: number;
  uncredited_deposits: number;
  unpresented_disbursements: number;
  direct_bank_adjustments: number;
  adjusted_book_balance: number;
  variance: number;
  status: ReconciliationStatus;
  prepared_by?: string | null;
  reviewed_by?: string | null;
  reconciled_at?: string | null;
  locked_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankReconciliationItem {
  id: string;
  reconciliation_id: string;
  statement_line_id?: string | null;
  item_type: BankAdjustmentType;
  amount: number;
  description: string;
  source_reference?: string | null;
  gl_posted: boolean;
  journal_entry_id?: string | null;
  status: 'OPEN' | 'POSTED' | 'RESOLVED' | 'REVERSED';
  created_at: string;
  resolved_at?: string | null;
}

export interface TreasuryCockpitSummary {
  total_book_balance: number;
  total_statement_balance: number;
  total_variance: number;
  unmatched_inflows_amount: number;
  unmatched_outflows_amount: number;
  accounts_requiring_attention: number;
  active_accounts_count: number;
}
