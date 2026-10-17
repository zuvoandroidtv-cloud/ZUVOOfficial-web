export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';
export type AccountingPeriodStatus = 'OPEN' | 'SOFT_CLOSED' | 'LOCKED';
export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'VOID';
export type SourceDocumentType =
  | 'COMMERCIAL_INVOICE'
  | 'PAYMENT_RECEIPT'
  | 'AP_INVOICE'
  | 'AP_PAYMENT'
  | 'CONSIGNMENT_SETTLEMENT'
  | 'WARRANTY_SETTLEMENT'
  | 'BAD_DEBT_WRITE_OFF'
  | 'MANUAL_JOURNAL'
  | 'PERIOD_CLOSING_REVERSAL';

export interface ChartOfAccount {
  id: string;
  account_number: string;
  account_name: string;
  parent_account_id?: string | null;
  account_type: AccountType;
  account_subtype: string;
  normal_balance: NormalBalance;
  currency: string;
  is_active: boolean;
  is_system_account: boolean;
  system_control_type?: string | null;
  gst_tax_code?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountingPeriod {
  id: string;
  period_name: string;
  fiscal_year: string;
  period_number: number;
  start_date: string;
  end_date: string;
  status: AccountingPeriodStatus;
  closed_by?: string | null;
  closed_at?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface JournalEntryLine {
  id?: string;
  journal_entry_id?: string;
  line_number: number;
  account_id: string;
  account_number?: string;
  account_name?: string;
  debit_amount: number;
  credit_amount: number;
  account?: {
    account_number: string;
    account_name: string;
  } | null;
  currency?: string;
  entity_type?: 'CUSTOMER' | 'DEALER' | 'VENDOR' | 'WAREHOUSE' | 'INTERNAL' | null;
  entity_id?: string | null;
  description?: string | null;
}

export interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  accounting_period_id: string;
  source_document_type: SourceDocumentType;
  source_document_reference_id?: string | null;
  status: JournalEntryStatus;
  total_debit: number;
  total_credit: number;
  narration: string;
  posted_by?: string | null;
  posted_at: string;
  created_at: string;
  lines?: JournalEntryLine[];
}

export interface TrialBalanceItem {
  account_number: string;
  account_name: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
}

export interface TrialBalanceResult {
  period_name: string;
  fiscal_year: string;
  period_status: AccountingPeriodStatus;
  total_debit: number;
  total_credit: number;
  variance: number;
  is_balanced: boolean;
  accounts: TrialBalanceItem[];
}

export interface ProfitAndLossResult {
  statement_type: 'PROFIT_AND_LOSS';
  start_date: string;
  end_date: string;
  revenue: {
    television_sales_revenue: number;
    other_operating_revenue: number;
    total_revenue: number;
  };
  cost_of_goods_sold: number;
  gross_profit: number;
  operating_expenses: {
    warranty_expense: number;
    bad_debt_expense: number;
    travel_service_expense: number;
    other_operating_expense: number;
    total_operating_expenses: number;
  };
  operating_income: number;
  net_profit: number;
}

export interface BalanceSheetResult {
  statement_type: 'BALANCE_SHEET';
  as_of_date: string;
  assets: {
    bank_operating: number;
    cash_and_clearing: number;
    accounts_receivable: number;
    inventory_finished_goods: number;
    consignment_inventory: number;
    gst_input_tax_credit: number;
    total_assets: number;
  };
  liabilities: {
    accounts_payable: number;
    gst_output_tax_liability: number;
    total_liabilities: number;
  };
  equity: {
    share_capital: number;
    retained_earnings: number;
    current_period_profit: number;
    total_equity: number;
  };
  total_liabilities_and_equity: number;
  variance: number;
  is_balanced: boolean;
}

export interface GstReconciliationResult {
  statement_type: 'GST_RECONCILIATION';
  start_date: string;
  end_date: string;
  output_gst_liability: {
    cgst_output: number;
    sgst_output: number;
    igst_output: number;
    total_output_gst: number;
  };
  input_gst_itc: {
    cgst_itc: number;
    sgst_itc: number;
    igst_itc: number;
    total_input_itc: number;
  };
  net_gst_payable: number;
}
