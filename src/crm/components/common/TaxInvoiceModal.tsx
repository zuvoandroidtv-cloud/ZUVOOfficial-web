import React from 'react';
import { Tv, Printer, X, ShieldCheck, Download } from 'lucide-react';

interface TaxInvoiceModalProps {
  sale: any;
  onClose: () => void;
}

export const TaxInvoiceModal: React.FC<TaxInvoiceModalProps> = ({ sale, onClose }) => {
  if (!sale) return null;

  const isInterState = sale.customers?.state && sale.customers.state.toLowerCase() !== 'maharashtra';
  const taxRate = 0.18;
  const taxableAmount = sale.subtotal - sale.discount_amount;
  const totalTax = sale.tax_amount || Math.round(taxableAmount * taxRate);

  const cgst = isInterState ? 0 : Math.round(totalTax / 2);
  const sgst = isInterState ? 0 : Math.round(totalTax / 2);
  const igst = isInterState ? totalTax : 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop" style={{ backdropFilter: 'blur(4px)', padding: '1rem' }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '800px',
          background: '#ffffff',
          color: '#1e293b',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Action Header - Excluded from Print */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            background: '#0f172a',
            color: '#ffffff',
            borderBottom: '1px solid #334155'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <Tv style={{ color: '#38bdf8' }} size={20} />
            <span>ZUVO Official Tax Invoice Generator</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Printer size={15} /> Print / Save as PDF
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              style={{ background: '#334155', color: '#fff' }}
            >
              <X size={15} /> Close
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div id="printable-invoice" style={{ padding: '2rem 2.5rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <div style={{ width: 32, height: 32, background: '#2563eb', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>
                  Z
                </div>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  ZUVO ELECTRONICS INDIA PVT LTD
                </span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.5 }}>
                Plot No. 42, Electronics Hardware Park, MIDC<br />
                Mumbai, Maharashtra, India - 400093<br />
                Email: support@zuvo.tv | Tel: +91 (022) 6890-1200<br />
                <strong>GSTIN: 27AAACZ8901D1Z5</strong> | HSN Code: 8528
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: '0.75rem', fontWeight: 800, padding: '0.25rem 0.625rem', borderRadius: '4px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                TAX INVOICE
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem', fontFamily: 'monospace' }}>
                #{sale.sale_number}
              </h2>
              <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.125rem' }}>
                Invoice Date: <strong>{new Date(sale.sale_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
              </div>
            </div>
          </div>

          {/* Customer & Dealer Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Billed To (Customer)</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                {sale.customers?.full_name || 'Walk-in Retail Customer'}
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#475569', marginTop: '0.25rem', lineHeight: 1.4 }}>
                {sale.customers?.address_line1 && <div>{sale.customers.address_line1}</div>}
                {sale.customers?.city && <div>{sale.customers.city}, {sale.customers.state} - {sale.customers.postal_code}</div>}
                <div>Phone: {sale.customers?.phone}</div>
                {sale.customers?.email && <div>Email: {sale.customers.email}</div>}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sales Channel / Partner</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                {sale.dealers ? sale.dealers.dealer_name : 'Direct ZUVO Official Store'}
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#475569', marginTop: '0.25rem', lineHeight: 1.4 }}>
                {sale.dealers?.dealer_code && <div>Dealer Code: {sale.dealers.dealer_code}</div>}
                {sale.dealers?.gst_number && <div>Dealer GSTIN: <strong>{sale.dealers.gst_number}</strong></div>}
                {sale.dealers?.city && <div>Location: {sale.dealers.city}, {sale.dealers.state}</div>}
              </div>
            </div>
          </div>

          {/* Purchased Line Items */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#ffffff', textAlign: 'left' }}>
                <th style={{ padding: '0.625rem 0.75rem', borderRadius: '4px 0 0 4px' }}>Item Description</th>
                <th style={{ padding: '0.625rem 0.75rem' }}>Unit Barcode</th>
                <th style={{ padding: '0.625rem 0.75rem' }}>Serial Number</th>
                <th style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>Qty</th>
                <th style={{ padding: '0.625rem 0.75rem', textAlign: 'right', borderRadius: '0 4px 4px 0' }}>Price (₹)</th>
              </tr>
            </thead>
            <tbody>
              {sale.sale_items?.map((item: any, idx: number) => (
                <tr key={item.id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600, color: '#0f172a' }}>
                    {item.product_units?.product_variants?.product_name || 'ZUVO Television'}
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>
                      HSN Code: 8528 | 12 Months Official Manufacturer Warranty Included
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                    {item.product_units?.barcode}
                  </td>
                  <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                    {item.product_units?.serial_number}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>1</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                    ₹{item.unit_price?.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Financials & Tax Breakdown */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Payment & Terms */}
            <div style={{ flex: 1, background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8125rem' }}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>Payment & Policy Information</div>
              <div style={{ color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div>Payment Method: <strong style={{ textTransform: 'uppercase' }}>{sale.payments?.[0]?.payment_method || 'Card / Online'}</strong></div>
                <div>Payment Status: <strong style={{ color: sale.payment_status === 'paid' ? '#16a34a' : '#d97706', textTransform: 'uppercase' }}>{sale.payment_status}</strong></div>
                {sale.payments?.[0]?.payment_reference && <div>Transaction Ref: {sale.payments[0].payment_reference}</div>}
                {sale.sale_status === 'returned' && (
                  <div style={{ color: '#dc2626', fontWeight: 700, marginTop: '0.25rem' }}>
                    ⚠️ ORDER RETURNED / RMA PROCESSED
                  </div>
                )}
              </div>
            </div>

            {/* Calculations Box */}
            <div style={{ width: '300px', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', color: '#475569' }}>
                <span>Gross Subtotal:</span>
                <span>₹{sale.subtotal?.toLocaleString('en-IN')}</span>
              </div>
              {sale.discount_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', color: '#16a34a' }}>
                  <span>Discount Offered:</span>
                  <span>-₹{sale.discount_amount?.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', color: '#475569', borderTop: '1px dashed #cbd5e1' }}>
                <span>Taxable Value:</span>
                <span>₹{taxableAmount?.toLocaleString('en-IN')}</span>
              </div>
              {!isInterState ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', color: '#475569' }}>
                    <span>CGST (9%):</span>
                    <span>₹{cgst?.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', color: '#475569' }}>
                    <span>SGST (9%):</span>
                    <span>₹{sgst?.toLocaleString('en-IN')}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', color: '#475569' }}>
                  <span>IGST (18%):</span>
                  <span>₹{igst?.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0', borderTop: '2px solid #0f172a', marginTop: '0.35rem', fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
                <span>Grand Total:</span>
                <span style={{ color: '#2563eb' }}>₹{sale.total_amount?.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Footer Terms */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
            This is a computer-generated tax invoice issued by ZUVO Electronics India Pvt Ltd. Goods once sold carry official 1-year manufacturer warranty.<br />
            Register warranty online at <strong>{typeof window !== 'undefined' ? `${window.location.origin}/?view=warranty` : 'https://zuvoandroidtv.com/?view=warranty'}</strong> using the barcode printed above.
          </div>
        </div>
      </div>
    </div>
  );
};
