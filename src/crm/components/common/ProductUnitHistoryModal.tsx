import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../context/AuthContext';
import {
  Tv, X, MapPin, ShieldCheck, Printer, Calendar, Clock, ArrowRight,
  User, FileText, Wrench, RotateCcw, AlertTriangle, CheckCircle2, QrCode
} from 'lucide-react';
import { BarcodeLabelModal } from './BarcodeLabelModal';

interface ProductUnitHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitIdentifier: string | null;
  onRegisterWarranty?: (barcode: string) => void;
  onCreateServiceTicket?: (barcode: string) => void;
}

export const ProductUnitHistoryModal: React.FC<ProductUnitHistoryModalProps> = ({
  isOpen,
  onClose,
  unitIdentifier,
  onRegisterWarranty,
  onCreateServiceTicket,
}) => {
  const { role } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen && unitIdentifier) {
      loadUnitDetails();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, unitIdentifier]);

  const loadUnitDetails = async () => {
    if (!unitIdentifier) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data: res, error: err } = await (supabase.rpc as any)('get_product_unit_detail', {
        p_identifier: unitIdentifier,
      });

      if (err) throw err;

      if (!res || !res.success) {
        setError(res?.error || 'Failed to retrieve product unit history.');
      } else {
        setData(res);
      }
    } catch (err: any) {
      console.error('Error fetching unit detail:', err);
      setError(err.message || 'Error loading product unit details.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const unit = data?.unit;
  const sale = data?.sale;
  const warranty = data?.warranty;
  const serviceTickets = data?.service_tickets || [];
  const rma = data?.rma;
  const history = data?.history || [];

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '840px', maxHeight: '90vh', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '10px', borderRadius: '10px' }}>
                <Tv size={24} style={{ color: 'var(--accent-cyan)' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>Product Unit Lifecycle & Traceability</h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Complete serial, barcode, ownership, warranty, service, and inventory trail.
                </div>
              </div>
            </div>
            <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '6px 10px' }}>
              <X size={16} />
            </button>
          </div>

          {isLoading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Loading complete product unit history...
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#FDA4AF', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {data && unit && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Top Summary Card */}
              <div className="glass-card" style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.9)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                      {unit.variant?.product_name || 'ZUVO Android TV'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Brand: {unit.variant?.brand_name || 'ZUVO'} • Model: {unit.variant?.model_name || 'TV'} • Code: {unit.variant?.product_code}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`badge ${
                      unit.status === 'in_stock' ? 'badge-cyan' :
                      unit.status === 'sold' ? 'badge-emerald' :
                      unit.status === 'in_service' ? 'badge-rose' : 'badge-amber'
                    }`} style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                      {unit.status?.toUpperCase()}
                    </span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsLabelModalOpen(true)}
                      title="Print Barcode Label"
                    >
                      <Printer size={14} /> Print Label
                    </button>
                  </div>
                </div>

                {/* Technical Specifications Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>PRIMARY BARCODE</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '0.95rem' }}>
                      {unit.barcode}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>SERIAL NUMBER</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem' }}>
                      {unit.serial_number}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>LOCATION / WAREHOUSE</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                      <MapPin size={14} style={{ color: 'var(--accent-cyan)' }} />
                      {unit.warehouse?.warehouse_name || 'Central Facility'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>HARDWARE SPECS</span>
                    <div style={{ fontWeight: 600 }}>
                      {unit.variant?.screen_size}" Display • {unit.variant?.tv_type?.toUpperCase()}
                      {unit.variant?.bluetooth && ' • BT'}
                      {unit.variant?.voice_remote && ' • Voice'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>INTAKE COST & DATE</span>
                    <div style={{ fontWeight: 600 }}>
                      ₹{unit.purchase_cost || 0} • {new Date(unit.received_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Breakdown Grid (Sale, Warranty, Service, RMA) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                {/* Sale Information */}
                <div className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.9rem' }}>
                    <FileText size={16} /> Sale & Customer Order
                  </div>
                  {sale ? (
                    <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><strong>Invoice #:</strong> {sale.sale_number}</div>
                      <div><strong>Sale Date:</strong> {new Date(sale.sale_date).toLocaleDateString()}</div>
                      <div><strong>Customer:</strong> {sale.customer?.full_name || 'Retail Customer'}</div>
                      <div><strong>Contact:</strong> {sale.customer?.phone || 'N/A'}</div>
                      <div><strong>Paid Amount:</strong> ₹{sale.total_amount} ({sale.payment_status?.toUpperCase()})</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      This TV unit has not been sold yet. (Available in stock)
                    </div>
                  )}
                </div>

                {/* Warranty Status */}
                <div className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.9rem' }}>
                      <ShieldCheck size={16} /> Warranty Policy
                    </div>
                    <span className={`badge ${warranty ? 'badge-emerald' : 'badge-slate'}`} style={{ fontSize: '0.7rem' }}>
                      {warranty ? warranty.status?.toUpperCase() : 'UNREGISTERED'}
                    </span>
                  </div>
                  {warranty ? (
                    <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><strong>Policy #:</strong> {warranty.warranty_number}</div>
                      <div><strong>Start Date:</strong> {warranty.warranty_start_date}</div>
                      <div><strong>End Date:</strong> {warranty.warranty_end_date}</div>
                      <div><strong>Method:</strong> {warranty.registration_method}</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        No registered warranty found for this unit.
                      </div>
                      {unit.status === 'sold' && onRegisterWarranty && (
                        <button
                          className="btn btn-emerald btn-sm"
                          onClick={() => {
                            onClose();
                            onRegisterWarranty(unit.barcode);
                          }}
                        >
                          Register Warranty Now
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Service History */}
                <div className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-purple)', fontWeight: 700, fontSize: '0.9rem' }}>
                      <Wrench size={16} /> Service Tickets ({serviceTickets.length})
                    </div>
                    {unit.status === 'sold' && onCreateServiceTicket && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                        onClick={() => {
                          onClose();
                          onCreateServiceTicket(unit.barcode);
                        }}
                      >
                        + Ticket
                      </button>
                    )}
                  </div>
                  {serviceTickets.length > 0 ? (
                    <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                      {serviceTickets.map((st: any) => (
                        <div key={st.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontWeight: 600 }}>#{st.ticket_number} • {st.status?.toUpperCase()}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{st.issue_category}: {st.issue_description}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      No service issues or repair tickets logged.
                    </div>
                  )}
                </div>

                {/* RMA / Return Info */}
                {rma && (
                  <div className="glass-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: 'var(--accent-rose)', fontWeight: 700, fontSize: '0.9rem' }}>
                      <RotateCcw size={16} /> RMA / Return Details
                    </div>
                    <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><strong>RMA #:</strong> {rma.return_number}</div>
                      <div><strong>Reason:</strong> {rma.return_reason}</div>
                      <div><strong>Condition:</strong> {rma.inspection_condition}</div>
                      <div><strong>Refund:</strong> ₹{rma.refund_amount}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Complete Chronological Unit History Timeline */}
              <div className="glass-card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} style={{ color: 'var(--accent-cyan)' }} />
                  Chronological Product Unit Lifecycle Timeline
                </h3>

                {history && history.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', paddingLeft: '20px' }}>
                    <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '10px', width: '2px', background: 'var(--border-subtle)' }} />
                    {history.map((ev: any, idx: number) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <div style={{
                          position: 'absolute',
                          left: '-20px',
                          top: '4px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: ev.event_type === 'RECEIVED' ? 'var(--accent-cyan)' :
                                      ev.event_type === 'SOLD' || ev.event_type === 'SALE_COMPLETED' ? 'var(--accent-emerald)' :
                                      ev.event_type === 'WARRANTY_REGISTERED' ? 'var(--accent-purple)' :
                                      ev.event_type === 'RMA_RETURN' ? 'var(--accent-rose)' : 'var(--accent-amber)',
                          border: '2px solid var(--bg-card)'
                        }} />
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFFFFF' }}>
                              {ev.title}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {new Date(ev.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {ev.details}
                          </div>
                          {ev.status_change && (
                            <div style={{ marginTop: '4px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                              Status: {ev.status_change}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No recorded movement events.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Barcode Label Modal */}
      {unit && (
        <BarcodeLabelModal
          isOpen={isLabelModalOpen}
          onClose={() => setIsLabelModalOpen(false)}
          unit={{
            barcode: unit.barcode,
            serial_number: unit.serial_number,
            product_name: unit.variant?.product_name,
            screen_size: unit.variant?.screen_size,
            model_name: unit.variant?.model_name,
          }}
        />
      )}
    </>
  );
};
