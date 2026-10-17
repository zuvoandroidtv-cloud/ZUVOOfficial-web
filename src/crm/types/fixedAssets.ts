export type AssetStatus = 
  | 'ACTIVE'
  | 'IN_MAINTENANCE'
  | 'FULLY_DEPRECIATED'
  | 'DISPOSED'
  | 'IMPAIRED';

export type DepreciationMethod = 'SLM' | 'WDV';

export type MaintenanceType = 
  | 'CALIBRATION'
  | 'PREVENTATIVE'
  | 'CORRECTIVE_REPAIR'
  | 'BREAKDOWN'
  | 'ANNUAL_AUDIT';

export type DisposalReason = 
  | 'SCRAP'
  | 'OBSOLETE'
  | 'SOLD'
  | 'DESTROYED'
  | 'TRADE_IN';

export interface FixedAssetCategory {
  id: string;
  category_code: string;
  category_name: string;
  description: string | null;
  default_useful_life_months: number;
  default_depreciation_method: DepreciationMethod;
  default_salvage_percentage: number;
  asset_gl_account_id: string;
  accumulated_depreciation_account_id: string;
  depreciation_expense_account_id: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FixedAsset {
  id: string;
  asset_tag: string;
  asset_name: string;
  category_id: string;
  category?: FixedAssetCategory;
  serial_number: string | null;
  vendor_id: string | null;
  vendor_invoice_id: string | null;
  purchase_order_id: string | null;
  acquisition_date: string;
  capitalization_date: string;
  acquisition_cost: number;
  directly_attributable_cost: number;
  total_capitalized_cost: number;
  salvage_value: number;
  useful_life_months: number;
  depreciation_method: DepreciationMethod;
  depreciation_rate: number | null;
  accumulated_depreciation: number;
  current_book_value: number;
  status: AssetStatus;
  location_depot: string;
  custodian: string | null;
  warranty_expiry: string | null;
  last_physical_verification_at: string | null;
  next_calibration_due_at: string | null;
  capitalization_journal_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetDepreciationSchedule {
  id: string;
  asset_id: string;
  accounting_period_id: string;
  period_start: string;
  period_end: string;
  opening_book_value: number;
  depreciation_amount: number;
  accumulated_depreciation: number;
  closing_book_value: number;
  method: DepreciationMethod;
  journal_entry_id: string | null;
  status: 'SCHEDULED' | 'POSTED' | 'SKIPPED' | 'CANCELLED';
  created_at: string;
}

export interface AssetMaintenanceLog {
  id: string;
  log_number: string;
  asset_id: string;
  maintenance_type: MaintenanceType;
  reference_number: string | null;
  service_provider: string | null;
  performed_at: string;
  next_due_at: string | null;
  downtime_hours: number;
  maintenance_cost: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AssetDisposal {
  id: string;
  disposal_number: string;
  asset_id: string;
  disposal_date: string;
  disposal_reason: DisposalReason;
  proceeds: number;
  capitalized_cost_at_disposal: number;
  accumulated_depreciation_at_disposal: number;
  net_book_value: number;
  gain_loss: number;
  disposal_method: string;
  journal_entry_id: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface AssetRegisterMetrics {
  total_assets: number;
  active_assets: number;
  in_maintenance: number;
  fully_depreciated: number;
  disposed_assets: number;
  total_gross_block: number;
  total_accumulated_depreciation: number;
  total_net_book_value: number;
  overdue_calibrations_count: number;
}
