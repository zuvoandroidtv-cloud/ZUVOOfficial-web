/**
 * ZUVO TV CRM — PHASE 8.9 DOMAIN TYPES
 * Enterprise B2B Sales Order Management, Warehouse Pick-Pack-Ship Fulfillment
 * & Statutory Delivery Challan / E-Way Bill Governance
 *
 * Filename: src/crm/types/salesOrderFulfillment.ts
 */

export type SalesOrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'CREDIT_HOLD'
  | 'ALLOCATED'
  | 'PICKED'
  | 'PACKED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED';

export type SalesOrderItemStatus =
  | 'PENDING'
  | 'PARTIALLY_ALLOCATED'
  | 'ALLOCATED'
  | 'PICKED'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type ReservationStatus =
  | 'RESERVED'
  | 'PICKED'
  | 'PACKED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'RELEASED';

export type DeliveryChallanStatus =
  | 'GENERATED'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentTerms =
  | 'IMMEDIATE'
  | 'NET_15'
  | 'NET_30'
  | 'NET_45'
  | 'NET_60'
  | 'ADVANCE';

export interface SalesOrder {
  id: string;
  tenant_id: string;
  so_number: string;
  dealer_id?: string | null;
  customer_id?: string | null;
  order_date: string;
  expected_delivery_date?: string | null;
  payment_terms: PaymentTerms;
  billing_address?: string | null;
  shipping_address: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  status: SalesOrderStatus;
  credit_hold_reason?: string | null;
  notes?: string | null;
  created_by?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
  dealer?: {
    id: string;
    dealer_name: string;
    dealer_code: string;
    credit_limit?: number;
    phone?: string;
    city?: string;
    state?: string;
  };
  customer?: {
    id: string;
    full_name: string;
    phone?: string;
    city?: string;
    state?: string;
  };
  items?: SalesOrderItem[];
  reservations?: SalesOrderReservation[];
  delivery_challans?: DeliveryChallan[];
}

export interface SalesOrderItem {
  id: string;
  tenant_id: string;
  sales_order_id: string;
  product_variant_id: string;
  quantity_ordered: number;
  quantity_allocated: number;
  quantity_shipped: number;
  quantity_invoiced: number;
  unit_price: number;
  discount_amount: number;
  tax_rate_pct: number;
  tax_amount: number;
  line_total: number;
  status: SalesOrderItemStatus;
  created_at: string;
  updated_at: string;
  product_variant?: {
    id: string;
    variant_name: string;
    sku: string;
    screen_size_inch?: number;
    resolution?: string;
    product?: {
      name: string;
      brand?: string;
    };
  };
}

export interface SalesOrderReservation {
  id: string;
  tenant_id: string;
  sales_order_id: string;
  sales_order_item_id: string;
  product_unit_id: string;
  warehouse_id: string;
  reservation_status: ReservationStatus;
  reserved_at: string;
  picked_at?: string | null;
  packed_at?: string | null;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  released_at?: string | null;
  created_at: string;
  updated_at: string;
  product_unit?: {
    id: string;
    barcode: string;
    serial_number?: string;
    status: string;
    purchase_cost?: number;
    warehouse?: {
      id: string;
      warehouse_name: string;
      warehouse_code: string;
    };
  };
}

export interface DeliveryChallan {
  id: string;
  tenant_id: string;
  challan_number: string;
  sales_order_id: string;
  dealer_id?: string | null;
  customer_id?: string | null;
  from_warehouse_id: string;
  transporter_name: string;
  transporter_id?: string | null;
  vehicle_number: string;
  lr_number?: string | null;
  eway_bill_number: string;
  eway_bill_valid_until: string;
  distance_km: number;
  total_quantity: number;
  total_taxable_value: number;
  total_tax_amount: number;
  total_challan_value: number;
  status: DeliveryChallanStatus;
  dispatched_at?: string | null;
  dispatched_by?: string | null;
  pod_receiver_name?: string | null;
  pod_contact_phone?: string | null;
  pod_signature_ref?: string | null;
  pod_notes?: string | null;
  delivered_at?: string | null;
  commercial_tax_invoice_id?: string | null;
  journal_entry_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  sales_order?: {
    so_number: string;
    order_date: string;
  };
  warehouse?: {
    warehouse_name: string;
    warehouse_code: string;
  };
  dealer?: {
    dealer_name: string;
    dealer_code: string;
    gst_number?: string;
  };
  items?: DeliveryChallanItem[];
}

export interface DeliveryChallanItem {
  id: string;
  tenant_id: string;
  delivery_challan_id: string;
  sales_order_item_id: string;
  product_unit_id: string;
  quantity: number;
  unit_value: number;
  taxable_value: number;
  tax_rate_pct: number;
  tax_amount: number;
  created_at: string;
  product_unit?: {
    barcode: string;
    serial_number?: string;
  };
}

export interface SalesOrderAuditEvent {
  id: string;
  tenant_id: string;
  sales_order_id: string;
  event_type: string;
  actor_id?: string | null;
  previous_status?: string | null;
  new_status: string;
  payload: Record<string, any>;
  created_at: string;
}

export interface FulfillmentKPIs {
  openOrdersCount: number;
  creditHoldCount: number;
  pendingPickingCount: number;
  packedOrdersCount: number;
  inTransitChallansCount: number;
  deliveredTodayCount: number;
  totalOrderPipelineValue: number;
}
