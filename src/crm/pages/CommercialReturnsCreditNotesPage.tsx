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

  const [returnsList] = useState<CommercialSalesReturn[]>([]);
  const [returnItems] = useState<CommercialSalesReturnItem[]>([]);
  const [creditNotes] = useState<StatutoryCreditNote[]>([]);
  const [carrierClaims] = useState<CarrierTransitDamageClaim[]>([]);

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
                {returnsList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
                      No commercial returns or dock rejections found.
                    </td>
                  </tr>
                ) : (
                  returnsList.map(ret => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'inspection' && (
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem' }}>Serialized Product Inspection & Disposition Workbench</h3>
          {returnItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
              No serialized return units awaiting triage or inspection.
            </div>
          ) : (
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
          )}
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
              {creditNotes.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
                    No statutory GST credit notes issued.
                  </td>
                </tr>
              ) : (
                creditNotes.map(cn => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'claims' && (
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem' }}>Carrier Transit Damage & Insurance Claims</h3>
          {carrierClaims.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
              No carrier transit liability or damage claims registered.
            </div>
          ) : (
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
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem' }}>Enterprise Commercial Reverse Logistics Traceability Chain</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { step: '1. Outbound Commercial Sale', desc: 'B2B Sales Order & GST Tax Invoice booked from sales fulfillment' },
              { step: '2. Logistics Dispatch', desc: 'Delivery Challan (DC) issued with statutory E-Way Bill consignment' },
              { step: '3. Dealer Dock Rejection', desc: 'Damage or model mismatch logged at dealer receiving dock to initiate return' },
              { step: '4. Reverse Delivery Challan', desc: 'Reverse Challan (RDC) issued with designated return freight carrier & LR number' },
              { step: '5. Physical Inspection & Triage', desc: 'Warehouse QA validates packaging & components; routes to Restock or Carrier Claim' },
              { step: '6. Statutory Credit Note', desc: 'E-Credit note issued under GST Section 34; output tax liability adjusted' },
              { step: '7. AR & General Ledger Posting', desc: 'Customer Accounts Receivable ledger credit offset and inventory ledger balanced' }
            ].map((node, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>{node.step}</div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{node.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
