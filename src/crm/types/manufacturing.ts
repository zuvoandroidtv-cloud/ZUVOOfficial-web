/**
 * ZUVO TV CRM — PHASE 8.7 DOMAIN TYPES
 * Enterprise Manufacturing Execution, Multi-Level BOM, Work Orders & WIP Costing
 *
 * Filename: src/crm/types/manufacturing.ts
 */

export type BomStatus = 'DRAFT' | 'ACTIVE' | 'REVISED' | 'OBSOLETE';

export type ComponentCategory =
  | 'PANEL'
  | 'MOTHERBOARD'
  | 'POWER_SUPPLY'
  | 'BACKLIGHT'
  | 'CHASSIS'
  | 'REMOTE'
  | 'PACKAGING'
  | 'OTHER';

export type WorkOrderStatus =
  | 'DRAFT'
  | 'RELEASED'
  | 'IN_PRODUCTION'
  | 'QUALITY_HOLD'
  | 'COMPLETED'
  | 'CANCELLED';

export type IssueStatus = 'STAGED' | 'ISSUED_TO_WIP' | 'RETURNED_TO_STOCK';

export type StationType =
  | 'ELECTRICAL_HI_POT'
  | 'OPTICAL_CALIBRATION'
  | 'BURN_IN_STRESS_4H'
  | 'FINAL_PACKAGING_QA';

export interface BillOfMaterials {
  id: string;
  tenant_id: string;
  bom_number: string;
  product_variant_id: string;
  revision: string;
  description?: string | null;
  yield_expected_pct: number;
  standard_labor_cost: number;
  standard_overhead_cost: number;
  total_standard_cost: number;
  status: BomStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  product_variant?: {
    product_name?: string;
    product_code?: string;
  };
  items?: BomItem[];
}

export interface BomItem {
  id: string;
  tenant_id: string;
  bom_id: string;
  component_part_id: string;
  quantity_per_unit: number;
  scrap_allowance_pct: number;
  component_category: ComponentCategory;
  is_serialized_component: boolean;
  created_at: string;
  part_name?: string;
  part_code?: string;
  standard_cost?: number;
  component_part?: {
    part_name?: string;
    part_code?: string;
    standard_cost?: number;
  };
}

export interface ProductionWorkOrder {
  id: string;
  tenant_id: string;
  work_order_number: string;
  bom_id: string;
  product_variant_id: string;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  planned_quantity: number;
  completed_quantity: number;
  scrapped_quantity: number;
  status: WorkOrderStatus;
  assembly_line: string;
  planned_start_date: string;
  actual_start_at?: string | null;
  actual_completion_date?: string | null;
  supervisor_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  product_name?: string;
  product_code?: string;
  bom_number?: string;
  product_variant?: {
    product_name?: string;
    product_code?: string;
  };
  bom?: {
    bom_number?: string;
    revision?: string;
  };
  component_issues?: any[];
  quality_checks?: any[];
}

export interface WorkOrderComponentIssue {
  id: string;
  tenant_id: string;
  work_order_id: string;
  component_part_id: string;
  planned_quantity: number;
  issued_quantity: number;
  returned_quantity: number;
  unit_cost: number;
  total_issued_cost: number;
  status: IssueStatus;
  issued_at?: string | null;
  returned_at?: string | null;
  created_at: string;
  part_name?: string;
  part_code?: string;
  component_part?: {
    part_name?: string;
    part_code?: string;
  };
}

export interface ProductionQualityCheck {
  id: string;
  tenant_id: string;
  work_order_id: string;
  station_type: StationType;
  units_tested: number;
  units_passed: number;
  units_failed: number;
  calibration_equipment_id?: string | null;
  inspector_id?: string | null;
  inspected_at: string;
  notes?: string | null;
  created_at: string;
  asset_tag?: string;
  work_order?: {
    work_order_number?: string;
  };
  equipment?: {
    asset_name?: string;
    asset_tag?: string;
  };
}

export interface ProductionCostRecord {
  id: string;
  tenant_id: string;
  work_order_id: string;
  raw_material_cost: number;
  direct_labor_cost: number;
  overhead_absorbed_cost: number;
  scrap_variance_cost: number;
  total_production_cost: number;
  completed_quantity: number;
  unit_cost_basis: number;
  journal_entry_id?: string | null;
  calculated_at: string;
  work_order?: {
    work_order_number?: string;
    completed_quantity?: number;
  };
}

export interface ManufacturingSummary {
  active_work_orders: number;
  completed_work_orders: number;
  total_planned_units: number;
  total_completed_units: number;
  total_wip_value: number;
  scrap_percentage: number;
  quality_pass_rate: number;
  units_awaiting_qa: number;
}
