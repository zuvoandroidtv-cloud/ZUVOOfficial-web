/**
 * ZUVO TV CRM — PHASE 8.11 DOMAIN TYPES
 * Enterprise Dealer Commercial Incentives, Volume Rebate Slabs,
 * Target Accruals & Statutory Trade Discount Settlement Governance
 *
 * Filename: src/crm/types/dealerIncentives.ts
 */

export type SchemeType =
  | 'VOLUME_REBATE'
  | 'REVENUE_REBATE'
  | 'TARGET_INCENTIVE'
  | 'FESTIVAL_SCHEME'
  | 'PRODUCT_MIX_INCENTIVE';

export type EligibilityTier =
  | 'ALL'
  | 'TIER_1_PLATINUM'
  | 'TIER_2_GOLD'
  | 'TIER_3_SILVER'
  | 'SELECT_DEALERS';

export type SchemeStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'SETTLED'
  | 'CANCELLED';

export type SettlementMethod =
  | 'AR_CREDIT_MEMO'
  | 'BANK_TRANSFER'
  | 'COMMERCIAL_CREDIT_NOTE';

export type EnrollmentStatus =
  | 'ENROLLED'
  | 'DISQUALIFIED'
  | 'ACHIEVED'
  | 'SETTLED'
  | 'CANCELLED';

export type AccrualStatus = 'DRAFT' | 'POSTED' | 'REVERSED' | 'SETTLED';

export type SettlementStatus = 'PENDING' | 'PROCESSING' | 'SETTLED' | 'CANCELLED';

export interface DealerSchemeProgram {
  id: string;
  tenant_id: string;
  scheme_code: string;
  scheme_name: string;
  description?: string | null;
  scheme_type: SchemeType;
  eligibility_tier: EligibilityTier;
  start_date: string;
  end_date: string;
  settlement_method: SettlementMethod;
  accounting_treatment: 'ACCRUAL_MATCHING' | 'CASH_SETTLEMENT';
  status: SchemeStatus;
  budget_allocated: number;
  total_accrued_liability: number;
  total_settled_amount: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealerSchemeSlab {
  id: string;
  tenant_id: string;
  scheme_id: string;
  slab_sequence: number;
  slab_name: string;
  min_qualifying_units: number;
  max_qualifying_units?: number | null;
  min_qualifying_revenue: number;
  max_qualifying_revenue?: number | null;
  rebate_percentage: number;
  fixed_rebate_per_unit: number;
  created_at: string;
}

export interface DealerSchemeEnrollment {
  id: string;
  tenant_id: string;
  scheme_id: string;
  dealer_id: string;
  target_units: number;
  target_revenue: number;
  current_qualifying_units: number;
  current_qualifying_revenue: number;
  current_slab_id?: string | null;
  current_earned_rebate: number;
  status: EnrollmentStatus;
  enrolled_at: string;
  last_evaluated_at?: string | null;
}

export interface DealerSchemeAccrual {
  id: string;
  tenant_id: string;
  scheme_id: string;
  dealer_id: string;
  accounting_period_id: string;
  qualifying_units: number;
  qualifying_sales_value: number;
  applicable_slab_id?: string | null;
  accrued_amount: number;
  prior_accrual: number;
  incremental_accrual: number;
  journal_entry_id?: string | null;
  status: AccrualStatus;
  created_at: string;
}

export interface DealerSchemeSettlement {
  id: string;
  tenant_id: string;
  settlement_number: string;
  scheme_id: string;
  dealer_id: string;
  settlement_date: string;
  qualifying_units: number;
  qualifying_revenue: number;
  eligible_amount: number;
  deductions: number;
  final_payout: number;
  settlement_method: SettlementMethod;
  ar_transaction_id?: string | null;
  statutory_credit_note_id?: string | null;
  journal_entry_id?: string | null;
  approval_status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approved_by?: string | null;
  approved_at?: string | null;
  settlement_status: SettlementStatus;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}
