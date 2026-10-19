/**
 * ZUVO TV CRM — Domain Types: Payroll, Employee Expenses & HR Finance
 * Phase 8.13 Architecture
 */

export interface EmployeeMaster {
  id: string;
  tenant_id: string;
  employee_code: string;
  profile_id?: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email: string;
  phone?: string;
  date_of_joining: string;
  date_of_exit?: string;
  department: 'MANUFACTURING' | 'WAREHOUSE' | 'SERVICE' | 'SALES' | 'FINANCE' | 'HR' | 'MANAGEMENT';
  designation: string;
  location_depot_id?: string;
  employment_type: 'FULL_TIME' | 'PROBATION' | 'CONTRACTOR' | 'INTERN';
  status: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'RESIGNED' | 'TERMINATED';
  pan_number?: string;
  uan_number?: string;
  esic_number?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_name?: string;
  cost_center_id?: string;
  manager_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeCompensation {
  id: string;
  tenant_id: string;
  employee_id: string;
  effective_from: string;
  effective_to?: string;
  basic_salary: number;
  hra: number;
  special_allowance: number;
  other_allowances: number;
  gross_salary?: number;
  annual_ctc: number;
  employee_pf_enabled: boolean;
  employer_pf_enabled: boolean;
  esi_enabled: boolean;
  professional_tax_enabled: boolean;
  payroll_tds_enabled: boolean;
  tds_monthly_deduction: number;
  state_for_pt: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayrollPeriod {
  id: string;
  tenant_id: string;
  period_code: string;
  fiscal_year: string;
  month_number: number;
  period_start: string;
  period_end: string;
  total_calendar_days: number;
  status: 'DRAFT' | 'PROCESSING' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'PAID' | 'CLOSED';
  accounting_period_id?: string;
  locked_by?: string;
  locked_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollRun {
  id: string;
  tenant_id: string;
  run_number: string;
  payroll_period_id: string;
  run_date: string;
  employee_count: number;
  total_gross_payroll: number;
  total_employee_pf: number;
  total_employee_esi: number;
  total_professional_tax: number;
  total_salary_tds: number;
  total_advance_recovery: number;
  total_other_deductions: number;
  total_net_payroll: number;
  total_employer_pf: number;
  total_employer_esi: number;
  total_employer_cost: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED_TO_GL' | 'PAID' | 'CANCELLED';
  gl_journal_entry_id?: string;
  submitted_by?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollEmployeeEntry {
  id: string;
  tenant_id: string;
  payroll_run_id: string;
  employee_id: string;
  compensation_id?: string;
  calendar_days: number;
  payable_days: number;
  loss_of_pay_days: number;
  earned_basic: number;
  earned_hra: number;
  earned_special_allowance: number;
  earned_other_allowances: number;
  gross_earnings: number;
  employee_pf: number;
  employee_esi: number;
  professional_tax: number;
  salary_tds: number;
  advance_recovery: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  employer_pf: number;
  employer_esi: number;
  employer_total_cost: number;
  payment_status: 'UNPAID' | 'PROCESSING' | 'PAID' | 'ON_HOLD';
  payment_reference?: string;
  paid_at?: string;
  created_at: string;
}

export interface EmployeeExpenseClaim {
  id: string;
  tenant_id: string;
  claim_number: string;
  employee_id: string;
  expense_date: string;
  category: 'TRAVEL_CONVEYANCE' | 'MEALS_LODGING' | 'CLIENT_ENTERTAINMENT' | 'OFFICE_SUPPLIES' | 'TRAINING' | 'OTHER';
  title: string;
  description?: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  cost_center_id?: string;
  receipt_url?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'POSTED_TO_GL' | 'PAID';
  gl_journal_entry_id?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  payment_reference?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeAdvance {
  id: string;
  tenant_id: string;
  advance_number: string;
  employee_id: string;
  advance_date: string;
  principal_amount: number;
  recovered_amount: number;
  remaining_balance: number;
  monthly_installment: number;
  status: 'REQUESTED' | 'APPROVED' | 'DISBURSED' | 'PARTIALLY_RECOVERED' | 'FULLY_RECOVERED' | 'WRITTEN_OFF';
  purpose: string;
  gl_journal_entry_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PayslipRecord {
  id: string;
  tenant_id: string;
  payslip_number: string;
  payroll_entry_id: string;
  employee_id: string;
  payroll_period_id: string;
  fiscal_year: string;
  month_name: string;
  gross_earnings: number;
  total_deductions: number;
  net_salary: number;
  payslip_payload: Record<string, any>;
  verification_hash: string;
  is_dispatched: boolean;
  dispatched_at?: string;
  generated_at: string;
}
