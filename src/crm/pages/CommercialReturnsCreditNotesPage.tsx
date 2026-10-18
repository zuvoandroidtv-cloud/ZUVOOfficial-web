import React, { useState } from 'react';
import {
  RotateCcw,
  FileText,
  AlertTriangle,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Search,
  Filter,
  ArrowRight,
  Package,
  Cpu,
  Layers,
  ChevronRight,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import {
  CommercialSalesReturn,
  CommercialSalesReturnItem,
  StatutoryCreditNote,
  CarrierTransitDamageClaim
} from '../types/commercialReturns';

export const CommercialReturnsCreditNotesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'returns' | 'rdc' | 'inspection' | 'credit_notes' | 'claims' | 'audit'>('returns');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReturn, setSelectedReturn] = useState<CommercialSalesReturn | null>(null);

  // Mock initial state representing server-authoritative records
  const [returnsList] = useState<CommercialSalesReturn[]>([
    {
      id: 'ret-101',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      return_number: 'RET-202610-1001',
      sales_order_id: 'so-8901',
      delivery_challan_id: 'dc-8901',
      commercial_tax_invoice_id: 'inv-8201',
      dealer_id: 'dealer-01',
      return_type: 'DOCK_REJECTION',
      return_reason: 'TRANSIT_DAMAGE',
      rdc_number: 'RDC-202610-1001',
      carrier_name: 'SafeExpress Logistics Ltd',
      carrier_lr_number: 'LR-998822',
      tracking_reference: 'MH-04-AB-1234',
      warehouse_id: 'wh-central',
      requested_date: '2026-10-18',
      status: 'UNDER_INSPECTION',
      inspection_status: 'IN_PROGRESS',
      approval_status: 'APPROVED',
      financial_status: 'PENDING_CREDIT',
      total_items_requested: 3,
      total_items_received: 3,
      total_items_accepted: 2,
      total_taxable_value: 75000.00,
      total_tax_amount: 13500.00,
      total_credit_amount: 88500.00,
      notes: 'Dock carton damage noted on delivery; 1 unit outer screen cracked, 2 units intact open-box.',
      created_at: '2026-10-18T10:30:00Z',
      updated_at: '2026-10-18T11:45:00Z'
    },
    {
      id: 'ret-102',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      return_number: 'RET-202610-1002',
      sales_order_id: 'so-8902',
      delivery_challan_id: 'dc-8902',
      commercial_tax_invoice_id: 'inv-8202',
      dealer_id: 'dealer-02',
      return_type: 'COMMERCIAL_RETURN',
      return_reason: 'WRONG_MODEL_SHIPPED',
      rdc_number: 'RDC-202610-1002',
      carrier_name: 'BlueDart Freight',
      carrier_lr_number: 'LR-445511',
      tracking_reference: 'DL-01-XY-5678',
      warehouse_id: 'wh-north',
      requested_date: '2026-10-17',
      status: 'CREDIT_NOTE_ISSUED',
      inspection_status: 'COMPLETED',
      approval_status: 'APPROVED',
      financial_status: 'CREDIT_ISSUED',
      total_items_requested: 2,
      total_items_received: 2,
      total_items_accepted: 2,
      total_taxable_value: 50000.00,
      total_tax_amount: 9000.00,
      total_credit_amount: 59000.00,
      notes: 'Dealer requested return due to incorrect screen size dispatch. Unopened mint condition.',
      created_at: '2026-10-17T14:10:00Z',
      updated_at: '2026-10-18T09:20:00Z'
    }
  ]);

  const [returnItems] = useState<CommercialSalesReturnItem[]>([
    {
      id: 'item-201',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      commercial_return_id: 'ret-101',
      product_unit_id: 'pu-5501',
      product_variant_id: 'pv-tv55',
      serial_number: 'ZUVO-TV55-2026-0091',
      barcode: '8901234567891',
      quantity: 1,
      original_unit_price: 25000.00,
      return_taxable_value: 25000.00,
      tax_rate_pct: 18.00,
      cgst_amount: 2250.00,
      sgst_amount: 2250.00,
      igst_amount: 0.00,
      line_total_credit: 29500.00,
      item_status: 'ACCEPTED',
      inspection_result: 'MINT_UNOPENED',
      disposition: 'RESTOCK',
      packaging_intact: true,
      accessories_included: true,
      panel_undamaged: true,
      power_on_passed: true,
      created_at: '2026-10-18T10:30:00Z',
      updated_at: '2026-10-18T11:45:00Z'
    },
    {
      id: 'item-202',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      commercial_return_id: 'ret-101',
      product_unit_id: 'pu-5502',
      product_variant_id: 'pv-tv55',
      serial_number: 'ZUVO-TV55-2026-0092',
      barcode: '8901234567892',
      quantity: 1,
      original_unit_price: 25000.00,
      return_taxable_value: 25000.00,
      tax_rate_pct: 18.00,
      cgst_amount: 2250.00,
      sgst_amount: 2250.00,
      igst_amount: 0.00,
      line_total_credit: 29500.00,
      item_status: 'ACCEPTED',
      inspection_result: 'MAJOR_PHYSICAL_DAMAGE',
      disposition: 'CARRIER_CLAIM',
      packaging_intact: false,
      accessories_included: true,
      panel_undamaged: false,
      power_on_passed: false,
      created_at: '2026-10-18T10:30:00Z',
      updated_at: '2026-10-18T11:45:00Z'
    }
  ]);

  const [creditNotes] = useState<StatutoryCreditNote[]>([
    {
      id: 'cn-301',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      credit_note_number: 'CN-202610-1001',
      credit_note_date: '2026-10-18',
      commercial_return_id: 'ret-102',
      original_invoice_id: 'inv-8202',
      dealer_id: 'dealer-02',
      seller_gstin: '27AAACZ8901D1Z5',
      buyer_gstin: '27AABCU9603R1ZM',
      place_of_supply: '27-Maharashtra',
      hsn_sac: '8528',
      is_inter_state: false,
      taxable_amount: 50000.00,
      tax_rate_pct: 18.00,
      cgst_rate_pct: 9.00,
      cgst_amount: 4500.00,
      sgst_rate_pct: 9.00,
      sgst_amount: 4500.00,
      igst_rate_pct: 0.00,
      igst_amount: 0.00,
      total_tax: 9000.00,
      grand_total: 59000.00,
      reason: 'SALES_RETURN',
      statutory_status: 'ISSUED',
      e_credit_note_status: 'PENDING_PROVIDER',
      journal_entry_id: 'je-202610-401',
      ar_transaction_id: 'ar-tx-901',
      created_at: '2026-10-18T09:20:00Z',
      updated_at: '2026-10-18T09:20:00Z'
    }
  ]);

  const [carrierClaims] = useState<CarrierTransitDamageClaim[]>([
    {
      id: 'clm-401',
      tenant_id: '00000000-0000-0000-0000-000000000000',
      claim_number: 'CLM-202610-1001',
      commercial_return_id: 'ret-101',
      delivery_challan_id: 'dc-8901',
      carrier_name: 'SafeExpress Logistics Ltd',
      tracking_lr_number: 'LR-998822',
      damaged_serial_units: 1,
      declared_consignment_value: 29500.00,
      claimed_amount: 25000.00,
      approved_amount: 25000.00,
      settled_amount: 0.00,
      claim_status: 'APPROVED',
      incident_description: 'Transit carton crushed; panel display completely shattered upon inspection.',
      carrier_debit_note_ref: 'DN-CARR-7711',
      created_at: '2026-10-18T11:45:00Z',
      updated_at: '2026-10-18T11:45:00Z'
    }
  ]);

  const totalReturnValue = returnsList.reduce((sum, r) => sum + r.total_credit_amount, 0);
  const pendingCreditNotesCount = returnsList.filter(r => r.financial_status === 'PENDING_CREDIT').length;

  return (
    <div style={{ padding: '1.5rem', color: '#f8fafc', background: '#090d16', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'linear-gradient(135deg, #ef4444, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RotateCcw size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                B2B Reverse Logistics & Statutory GST Credit Notes
              </h1>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.875rem', color: '#94a3b8' }}>
                Enterprise Dock Rejections, RDC Manifests, Serialized Inspection & General Ledger Balancing
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: '#fff',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={16} /> Initiate Commercial Return
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(30, 41, 59, 0.7)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>ACTIVE RETURNS</span>
            <RotateCcw size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: '#f8fafc' }}>
            {returnsList.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: '0.25rem' }}>1 awaiting inspection</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>TOTAL RETURN VALUE</span>
            <DollarSign size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: '#f8fafc' }}>
            ₹{totalReturnValue.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '0.25rem' }}>Statutory GST inclusive</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>PENDING CREDIT NOTES</span>
            <FileText size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: '#f8fafc' }}>
            {pendingCreditNotesCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.25rem' }}>Ready for AR & GL posting</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>CARRIER CLAIMS</span>
            <Truck size={18} color="#ef4444" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: '#f8fafc' }}>
            {carrierClaims.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.25rem' }}>Transit liability active</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.75rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        {[
          { id: 'returns', label: 'Commercial Returns', icon: RotateCcw },
          { id: 'rdc', label: 'Reverse Challans (RDC)', icon: Truck },
          { id: 'inspection', label: 'Serialized Triage', icon: Cpu },
          { id: 'credit_notes', label: 'Statutory Credit Notes', icon: FileText },
          { id: 'claims', label: 'Carrier Transit Claims', icon: ShieldAlert },
          { id: 'audit', label: 'Lifecycle Audit', icon: Layers }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: isActive ? '#60a5fa' : '#94a3b8',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {activeTab === 'returns' && (
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.6)', padding: '0.4rem 0.8rem', borderRadius: '6px', width: '300px' }}>
              <Search size={16} color="#64748b" />
              <input
                type="text"
                placeholder="Search return # or dealer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '0.875rem', width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
                <Filter size={14} /> Filter Status
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.4)', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>RETURN #</th>
                  <th style={{ padding: '0.75rem 1rem' }}>DATE</th>
                  <th style={{ padding: '0.75rem 1rem' }}>ORIGIN / DEALER</th>
                  <th style={{ padding: '0.75rem 1rem' }}>REASON & TYPE</th>
                  <th style={{ padding: '0.75rem 1rem' }}>RDC REFERENCE</th>
                  <th style={{ padding: '0.75rem 1rem' }}>STATUS</th>
                  <th style={{ padding: '0.75rem 1rem' }}>TOTAL CREDIT</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {returnsList.map(ret => (
                  <tr key={ret.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600, color: '#f8fafc' }}>{ret.return_number}</td>
                    <td style={{ padding: '1rem', color: '#94a3b8' }}>{ret.requested_date}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 500 }}>Dealer Electronics Pvt Ltd</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Inv: {ret.commercial_tax_invoice_id}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', fontSize: '0.75rem', fontWeight: 600 }}>
                        {ret.return_reason}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: '#cbd5e1' }}>
                      {ret.rdc_number ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Truck size={14} color="#60a5fa" />
                          <span>{ret.rdc_number}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#64748b' }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: ret.status === 'CREDIT_NOTE_ISSUED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: ret.status === 'CREDIT_NOTE_ISSUED' ? '#34d399' : '#fbbf24'
                      }}>
                        {ret.status === 'CREDIT_NOTE_ISSUED' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {ret.status}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                      ₹{ret.total_credit_amount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedReturn(ret)}
                        style={{
                          padding: '0.4rem 0.8rem',
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          color: '#60a5fa',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'inspection' && (
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem' }}>Serialized Product Inspection & Disposition Workbench</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {returnItems.map(item => (
              <div key={item.id} style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: '#f8fafc' }}>{item.serial_number}</span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.1)', padding: '0.2rem 0.4rem', borderRadius: '4px', color: '#cbd5e1' }}>55" 4K Smart TV</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                    Condition: <strong style={{ color: '#e2e8f0' }}>{item.inspection_result}</strong> | Taxable: ₹{item.return_taxable_value.toLocaleString('en-IN')}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: item.disposition === 'RESTOCK' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: item.disposition === 'RESTOCK' ? '#34d399' : '#f87171'
                    }}>
                      {item.disposition}
                    </span>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      {item.disposition === 'RESTOCK' ? 'Replenish FIFO Layer' : 'Transit Carrier Claim'}
                    </div>
                  </div>
                  <button style={{ padding: '0.4rem 0.8rem', background: '#3b82f6', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    Confirm Triage
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'credit_notes' && (
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Statutory GST Credit Notes (HSN 8528)</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.4)', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>CREDIT NOTE #</th>
                <th style={{ padding: '0.75rem 1rem' }}>DATE</th>
                <th style={{ padding: '0.75rem 1rem' }}>ORIGINAL INVOICE</th>
                <th style={{ padding: '0.75rem 1rem' }}>TAXABLE AMOUNT</th>
                <th style={{ padding: '0.75rem 1rem' }}>GST SPLIT</th>
                <th style={{ padding: '0.75rem 1rem' }}>GRAND TOTAL</th>
                <th style={{ padding: '0.75rem 1rem' }}>E-CREDIT NOTE STATUS</th>
              </tr>
            </thead>
            <tbody>
              {creditNotes.map(cn => (
                <tr key={cn.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '1rem', fontWeight: 700, color: '#f8fafc' }}>{cn.credit_note_number}</td>
                  <td style={{ padding: '1rem', color: '#94a3b8' }}>{cn.credit_note_date}</td>
                  <td style={{ padding: '1rem', color: '#60a5fa' }}>{cn.original_invoice_id}</td>
                  <td style={{ padding: '1rem' }}>₹{cn.taxable_amount.toLocaleString('en-IN')}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>CGST: ₹{cn.cgst_amount} | SGST: ₹{cn.sgst_amount}</div>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 700, color: '#10b981' }}>
                    ₹{cn.grand_total.toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', fontSize: '0.75rem', fontWeight: 600 }}>
                      {cn.e_credit_note_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'claims' && (
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem' }}>Carrier Transit Damage & Insurance Claims</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {carrierClaims.map(claim => (
              <div key={claim.id} style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1.25rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={18} color="#ef4444" />
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc' }}>{claim.claim_number}</span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                      {claim.claim_status}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1.1rem' }}>
                    Claim: ₹{claim.claimed_amount.toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  Carrier: <strong>{claim.carrier_name}</strong> | LR #: <strong>{claim.tracking_lr_number}</strong>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.2)', padding: '0.75rem', borderRadius: '6px' }}>
                  {claim.incident_description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem' }}>Enterprise Commercial Reverse Logistics Traceability Chain</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { step: '1. Outbound Commercial Sale', desc: 'B2B Sales Order SO-202610-8901 & Tax Invoice booked', date: '2026-10-15' },
              { step: '2. Logistics Dispatch', desc: 'Delivery Challan DC-202610-8901 issued with E-Way Bill', date: '2026-10-16' },
              { step: '3. Dealer Dock Rejection', desc: 'Carton damage logged at receiving dock; return RET-202610-1001 initiated', date: '2026-10-18' },
              { step: '4. Reverse Delivery Challan', desc: 'RDC-202610-1001 issued with reverse transporter LR-998822', date: '2026-10-18' },
              { step: '5. Physical Inspection & Triage', desc: 'Unit 1 restocked into inventory; Unit 2 routed to Carrier Claim', date: '2026-10-18' },
              { step: '6. Statutory Credit Note', desc: 'GST Credit Note CN-202610-1001 issued; Output GST relieved', date: '2026-10-18' },
              { step: '7. AR & General Ledger Posting', desc: 'Customer AR offset & Double-entry journal committed', date: '2026-10-18' }
            ].map((node, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>{node.step}</div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{node.desc}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>{node.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
