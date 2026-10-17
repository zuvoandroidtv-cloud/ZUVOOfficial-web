/**
 * ZUVO TV CRM — PHASE 8.8 DOMAIN TYPES
 * Enterprise Budgetary Control, Department Cost Center Accounting & PO Commitment Governance
 *
 * Filename: src/crm/types/budgetaryControl.ts
 */

export type DepartmentType =
  | 'FACTORY'
  | 'SERVICE'
  | 'SALES'
  | 'CORPORATE'
  | 'RND'
  | 'LOGISTICS'
  | 'OTHER';

export type BudgetCategory = 'OPEX' | 'CAPEX' | 'WARRANTY' | 'OVERHEAD';

export type BudgetStatus = 'DRAFT' | 'APPROVED' | 'REVISED' | 'CLOSED';

export type CommitmentStatus =
  | 'OPEN'
  | 'PARTIALLY_RELIEVED'
  | 'FULLY_RELIEVED'
  | 'CANCELLED';

export type BudgetPolicy = 'ALLOW' | 'WARN' | 'HARD_BLOCK';

export type VarianceStatus = 'HEALTHY' | 'WATCH' | 'CRITICAL';

export interface CostCenter {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  department: DepartmentType;
  description?: string | null;
  manager_id?: string | null;
  parent_cost_center_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetEnvelope {
  id: string;
  envelope_number: string;
  tenant_id: string;
  cost_center_id: string;
  fiscal_year: number;
  period_start: string;
  period_end: string;
  budget_category: BudgetCategory;
  total_budget: number;
  status: BudgetStatus;
  version: number;
  previous_version_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  cost_center?: CostCenter;
  line_items?: BudgetLineItem[];
}

export interface BudgetLineItem {
  id: string;
  tenant_id: string;
  budget_envelope_id: string;
  gl_account_id?: string | null;
  gl_account_code: string;
  allocated_amount: number;
  revised_amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetCommitment {
  id: string;
  commitment_number: string;
  tenant_id: string;
  cost_center_id: string;
  budget_line_item_id?: string | null;
  purchase_order_id?: string | null;
  gl_account_code: string;
  committed_amount: number;
  relieved_amount: number;
  remaining_commitment: number;
  status: CommitmentStatus;
  vendor_invoice_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  cost_center?: CostCenter;
  purchase_order?: {
    po_number?: string;
    total_amount?: number;
    vendor_id?: string;
  };
}

export interface CostCenterAllocation {
  id: string;
  tenant_id: string;
  journal_line_id: string;
  cost_center_id: string;
  allocated_amount: number;
  allocation_percentage: number;
  created_at: string;
}

export interface BudgetVarianceRow {
  cost_center_id: string;
  cost_center_code: string;
  cost_center_name: string;
  department: DepartmentType;
  gl_account_code: string;
  budget_allocated: number;
  committed_amount: number;
  actual_spent: number;
  available_headroom: number;
  variance_amount: number;
  utilization_pct: number;
  status: VarianceStatus;
}

export interface BudgetAvailabilityResult {
  allowed: boolean;
  policy: BudgetPolicy;
  allocated: number;
  committed: number;
  actual: number;
  available: number;
  requested: number;
  cost_center_code: string;
  gl_account_code: string;
}
