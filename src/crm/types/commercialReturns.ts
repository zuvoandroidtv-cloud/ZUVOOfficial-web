/**
 * ZUVO TV CRM — PHASE 8.10 DOMAIN TYPES
 * Enterprise B2B Reverse Logistics, Commercial Sales Returns (RMA),
 * Dock Rejection & Statutory GST Credit/Debit Note Governance
 *
 * Filename: src/crm/types/commercialReturns.ts
 */

export type CommercialReturnStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'RDC_ISSUED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'UNDER_INSPECTION'
  | 'ACCEPTED'
  | 'PARTIALLY_ACCEPTED'
  | 'REJECTED'
  | 'CREDIT_NOTE_PENDING'
  | 'CREDIT_NOTE_ISSUED'
  | 'SETTLED'
  | 'CANCELLED';

export type CommercialReturnType =
  | 'DOCK_REJECTION'
  | 'COMMERCIAL_RETURN'
  | 'TRANSIT_DAMAGE'
  | 'BILLING_CORRECTION';

export type CommercialReturnReason =
  | 'TRANSIT_DAMAGE'
  | 'TRANSIT_WATER_DAMAGE'
  | 'DEFECTIVE_ON_ARRIVAL'
  | 'WRONG_MODEL_SHIPPED'
  | 'EXCESS_DISPATCH'
  | 'DEALER_OVERSTOCK_RETURN'
  | 'CUSTOMER_ORDER_CANCELLED'
  | 'PRICING_DISCREPANCY';

export type ReturnItemStatus =
  | 'REQUESTED'
  | 'RECEIVED'
  | 'INSPECTED'
  | 'ACCEPTED'
  | 'REJECTED';

export type ReturnInspectionResult =
  | 'MINT_UNOPENED'
  | 'OPEN_BOX_UNDAMAGED'
  | 'MINOR_COSMETIC_BLEMISH'
  | 'MAJOR_PHYSICAL_DAMAGE'
  | 'ELECTRONIC_FAILURE'
  | 'WATER_DAMAGED';

export type ReturnDisposition =
  | 'QUARANTINE'
  | 'RESTOCK'
  | 'REFURBISH'
  | 'SCRAP'
  | 'CARRIER_CLAIM'
  | 'REJECT_RETURN';

export type CreditNoteStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

export type ECreditNoteStatus =
  | 'PENDING_PROVIDER'
  | 'PROVIDER_SUBMITTED'
  | 'IRN_GENERATED'
  | 'FAILED';

export type CarrierClaimStatus =
  | 'OPEN'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PARTIALLY_APPROVED'
  | 'REJECTED'
  | 'SETTLED'
  | 'CLOSED';

export interface CommercialSalesReturn {
  id: string;
  tenant_id: string;
  return_number: string;
  sales_order_id?: string | null;
  delivery_challan_id?: string | null;
  commercial_tax_invoice_id?: string | null;
  dealer_id?: string | null;
  customer_id?: string | null;
  return_type: CommercialReturnType;
  return_reason: CommercialReturnReason;
  rdc_number?: string | null;
  carrier_name?: string | null;
  carrier_lr_number?: string | null;
  tracking_reference?: string | null;
  warehouse_id: string;
  requested_date: string;
  received_date?: string | null;
  status: CommercialReturnStatus;
  inspection_status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'WAIVED';
  approval_status: 'NOT_REQUIRED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  financial_status: 'NOT_APPLICABLE' | 'PENDING_CREDIT' | 'CREDIT_ISSUED' | 'SETTLED';
  total_items_requested: number;
  total_items_received: number;
  total_items_accepted: number;
  total_taxable_value: number;
  total_tax_amount: number;
  total_credit_amount: number;
  notes?: string | null;
  created_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommercialSalesReturnItem {
  id: string;
  tenant_id: string;
  commercial_return_id: string;
  product_unit_id: string;
  product_variant_id: string;
  serial_number: string;
  barcode?: string | null;
  quantity: number;
  original_unit_price: number;
  return_taxable_value: number;
  tax_rate_pct: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  line_total_credit: number;
  item_status: ReturnItemStatus;
  inspection_result?: ReturnInspectionResult | null;
  disposition: ReturnDisposition;
  packaging_intact: boolean;
  accessories_included: boolean;
  panel_undamaged: boolean;
  power_on_passed: boolean;
  rejection_reason?: string | null;
  inspector_id?: string | null;
  inspected_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatutoryCreditNote {
  id: string;
  tenant_id: string;
  credit_note_number: string;
  credit_note_date: string;
  commercial_return_id: string;
  original_invoice_id: string;
  dealer_id?: string | null;
  customer_id?: string | null;
  seller_gstin: string;
  buyer_gstin?: string | null;
  place_of_supply: string;
  hsn_sac: string;
  is_inter_state: boolean;
  taxable_amount: number;
  tax_rate_pct: number;
  cgst_rate_pct: number;
  cgst_amount: number;
  sgst_rate_pct: number;
  sgst_amount: number;
  igst_rate_pct: number;
  igst_amount: number;
  total_tax: number;
  grand_total: number;
  reason: string;
  statutory_status: CreditNoteStatus;
  e_credit_note_status: ECreditNoteStatus;
  irn?: string | null;
  e_credit_note_hash?: string | null;
  acknowledgement_number?: string | null;
  acknowledgement_date?: string | null;
  journal_entry_id?: string | null;
  ar_transaction_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CarrierTransitDamageClaim {
  id: string;
  tenant_id: string;
  claim_number: string;
  commercial_return_id: string;
  delivery_challan_id?: string | null;
  carrier_name: string;
  tracking_lr_number: string;
  damaged_serial_units: number;
  declared_consignment_value: number;
  claimed_amount: number;
  approved_amount: number;
  settled_amount: number;
  claim_status: CarrierClaimStatus;
  incident_description: string;
  carrier_survey_report_ref?: string | null;
  carrier_debit_note_ref?: string | null;
  settlement_date?: string | null;
  journal_entry_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}
