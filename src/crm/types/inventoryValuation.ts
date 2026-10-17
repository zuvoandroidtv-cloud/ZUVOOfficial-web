/**
 * ZUVO TV CRM — PHASE 8.6 DOMAIN TYPES
 * Enterprise Inventory Valuation, Serialized Cost-Basis, FIFO Layers & Gross Margin Intelligence
 *
 * Filename: src/crm/types/inventoryValuation.ts
 */

export type CostLayerSourceType =
  | 'PURCHASE'
  | 'LANDED_COST'
  | 'TRANSFER'
  | 'RETURN'
  | 'REFURBISHMENT'
  | 'ADJUSTMENT'
  | 'MANUFACTURING';

export type CostLayerStatus = 'OPEN' | 'PARTIALLY_CONSUMED' | 'EXHAUSTED' | 'CANCELLED';

export type AgingBucket =
  | 'DAYS_0_30'
  | 'DAYS_31_60'
  | 'DAYS_61_90'
  | 'DAYS_91_180'
  | 'DAYS_181_365'
  | 'DAYS_365_PLUS';

export type AdjustmentType = 'QUANTITY' | 'COST' | 'SCRAP' | 'RECLASSIFICATION';

export type AdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type ReconciliationStatus = 'RECONCILED' | 'VARIANCE' | 'PENDING_REVIEW';

export interface InventoryCostLayer {
  id: string;
  tenant_id: string;
  product_id?: string | null;
  product_unit_id?: string | null;
  warehouse_id?: string | null;
  source_type: CostLayerSourceType;
  source_reference_id?: string | null;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost: number;
  landed_cost_allocated: number;
  total_layer_cost: number;
  received_at: string;
  accounting_period_id?: string | null;
  status: CostLayerStatus;
  created_at: string;
  updated_at: string;
  product_variant?: {
    product_name?: string;
    product_code?: string;
  };
  product_unit?: {
    serial_number?: string;
    barcode?: string;
  };
  warehouse?: {
    name?: string;
  };
}

export interface InventoryCostAllocation {
  id: string;
  tenant_id: string;
  product_unit_id?: string | null;
  sale_id?: string | null;
  sale_item_id?: string | null;
  source_cost_layer_id: string;
  quantity_consumed: number;
  unit_cost: number;
  total_cogs: number;
  journal_entry_id?: string | null;
  allocated_at: string;
  created_at: string;
  sale?: {
    sale_number?: string;
    total_amount?: number;
    subtotal?: number;
  };
  product_unit?: {
    serial_number?: string;
  };
}

export interface InventoryValuationSnapshot {
  id: string;
  tenant_id: string;
  snapshot_number: string;
  snapshot_date: string;
  warehouse_id?: string | null;
  product_id?: string | null;
  total_units_on_hand: number;
  gross_inventory_value: number;
  landed_cost_value: number;
  net_inventory_value: number;
  gl_inventory_account_id?: string | null;
  gl_inventory_balance: number;
  reconciliation_variance: number;
  reconciliation_status: ReconciliationStatus;
  accounting_period_id?: string | null;
  aging_breakdown: Record<string, number>;
  created_at: string;
  warehouse?: {
    name?: string;
  };
}

export interface InventoryAdjustmentRequest {
  id: string;
  tenant_id: string;
  request_number: string;
  product_unit_id?: string | null;
  product_id?: string | null;
  warehouse_id: string;
  adjustment_type: AdjustmentType;
  old_quantity: number;
  new_quantity: number;
  old_unit_cost: number;
  new_unit_cost: number;
  variance_amount: number;
  reason: string;
  status: AdjustmentStatus;
  requester_id?: string | null;
  reviewer_id?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  journal_entry_id?: string | null;
  created_at: string;
  updated_at: string;
  warehouse?: {
    name?: string;
  };
  product_variant?: {
    product_name?: string;
  };
  product_unit?: {
    serial_number?: string;
  };
}

export interface InventoryAgingSummary {
  days_0_30: number;
  days_31_60: number;
  days_61_90: number;
  days_91_180: number;
  days_181_365: number;
  days_365_plus: number;
  slow_moving_units: number;
  total_units: number;
  total_carrying_value: number;
}

export interface ValuationDashboardMetrics {
  total_inventory_value: number;
  units_on_hand: number;
  total_landed_costs_absorbed: number;
  cogs_ytd: number;
  gross_profit_ytd: number;
  gross_margin_pct: number;
  gl_reconciliation_variance: number;
  slow_moving_stock_value: number;
}
