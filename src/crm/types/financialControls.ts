export type ControlSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ControlStatus = 
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'RESOLVED'
  | 'WAIVED';

export type ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type GSTReconciliationStatus =
  | 'MATCHED'
  | 'VARIANCE'
  | 'EXCEPTION'
  | 'REVIEWED'
  | 'FILE_READY';

export type CashFlowCategory =
  | 'OPERATING'
  | 'INVESTING'
  | 'FINANCING';

export interface FinanceControlRule {
  id: string;
  rule_code: string;
  rule_name: string;
  rule_description: string | null;
  rule_category: string;
  threshold_amount: number | null;
  severity: ControlSeverity;
  requires_approval: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceControlException {
  id: string;
  control_number: string;
  rule_id: string | null;
  rule_code: string;
  severity: ControlSeverity;
  entity_type: string;
  entity_id: string;
  reference_number: string | null;
  detected_amount: number;
  threshold_amount: number | null;
  detected_at: string;
  status: ControlStatus;
  assigned_reviewer_id: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceApprovalRequest {
  id: string;
  request_number: string;
  exception_id: string | null;
  entity_type: string;
  entity_id: string;
  requested_amount: number;
  reason: string;
  requester_id: string;
  reviewer_id: string | null;
  status: ApprovalStatus;
  decision_notes: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceApprovalAction {
  id: string;
  request_id: string;
  action_type: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  actor_id: string;
  notes: string | null;
  created_at: string;
}

export interface FinancialAuditEvent {
  id: string;
  event_number: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  amount: number | null;
  payload: any;
  created_at: string;
}

export interface GSTReconciliationRecord {
  id: string;
  period_id: string;
  outward_taxable_value: number;
  outward_cgst: number;
  outward_sgst: number;
  outward_igst: number;
  outward_total_tax: number;
  outward_invoice_count: number;
  inward_taxable_value: number;
  inward_itc_cgst: number;
  inward_itc_sgst: number;
  inward_itc_igst: number;
  inward_total_itc: number;
  inward_bill_count: number;
  net_cgst_payable: number;
  net_sgst_payable: number;
  net_igst_payable: number;
  net_total_gst_payable: number;
  unreconciled_tax_variance: number;
  reconciliation_status: GSTReconciliationStatus;
  filing_boundary_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashFlowSnapshot {
  id: string;
  period_id: string;
  opening_cash: number;
  customer_collections: number;
  vendor_payments: number;
  operating_expenses: number;
  gst_tax_payments: number;
  warranty_payments: number;
  inventory_purchases: number;
  financing_inflows: number;
  financing_outflows: number;
  net_operating_flow: number;
  net_investing_flow: number;
  net_financing_flow: number;
  net_cash_flow: number;
  closing_cash: number;
  created_at: string;
  updated_at: string;
}

export interface CashFlowForecast {
  horizon_days: number;
  forecast_date: string;
  current_cash: number;
  projected_inflows: number;
  projected_outflows: number;
  net_projected_flow: number;
  projected_closing_cash: number;
  is_negative_warning: boolean;
  is_estimate: boolean;
  open_ar_count: number;
  open_ap_count: number;
}

export interface ExecutiveFinanceSummary {
  cash_position: number;
  ar_outstanding: number;
  ap_outstanding: number;
  net_working_capital: number;
  gst_payable_or_refundable: number;
  current_month_revenue: number;
  current_month_cogs: number;
  gross_profit: number;
  operating_expenses: number;
  net_operating_profit: number;
  unresolved_exceptions_count: number;
  pending_approvals_count: number;
  high_overdue_ar: boolean;
  high_ap_concentration: boolean;
  gst_variance_detected: boolean;
  negative_projected_cash: boolean;
}
