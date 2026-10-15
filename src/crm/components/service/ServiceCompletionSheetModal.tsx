import React from 'react';
import {
  Printer,
  Download,
  CheckCircle,
  Tv,
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  FileText,
  Wrench,
  ShieldCheck,
  Package,
  X
} from 'lucide-react';

export interface ServiceCompletionSheetData {
  jobTicketNumber: string;
  visitDate: string;
  visitType: string;
  technicianName: string;
  technicianPhone?: string;
  technicianCode?: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  tvModel: string;
  screenSize?: string;
  serialNumber?: string;
  barcode?: string;
  warrantyStatus: 'active' | 'expired' | 'void' | 'unknown';
  reportedIssue: string;
  diagnosisSummary?: {
    faultCategory?: string;
    rootCause?: string;
    findings?: string;
    actionTaken?: string;
  };
  partsUsed?: Array<{
    partName: string;
    partCode: string;
    quantity: number;
    warrantyCovered: boolean;
  }>;
  arrivalTime?: string;
  departureTime?: string;
  completionResult: 'resolved' | 'repaired' | 'parts_replaced' | 'inspected';
  customerSignatureUrl?: string;
  customerConfirmedAt?: string;
}

interface ServiceCompletionSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ServiceCompletionSheetData;
}

export const ServiceCompletionSheetModal: React.FC<ServiceCompletionSheetModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '720px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-main)',
          border: '1px solid rgba(6, 182, 212, 0.4)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        {/* Header Controls (Do not print) */}
        <div
          className="modal-header no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '1rem 1.25rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} style={{ color: 'var(--accent-cyan)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Service Completion Document
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handlePrint}
              className="technician-btn-touch btn-primary"
              style={{ minHeight: '38px', padding: '0.4rem 0.875rem', fontSize: '0.8rem' }}
            >
              <Printer size={16} />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="btn-icon"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Service Document Body */}
        <div
          className="modal-body printable-service-sheet"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            background: '#FFFFFF',
            color: '#0F172A',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}
        >
          {/* Document Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #06B6D4', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: '#0F172A', color: '#06B6D4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.1rem' }}>
                  Z
                </div>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0, color: '#0F172A' }}>
                  ZUVO ANDROID TV
                </h1>
              </div>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                Official Field Service & Diagnostics Completion Certificate
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                Service Job #
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 800, color: '#0284C7' }}>
                {data.jobTicketNumber}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
                Date: {data.visitDate}
              </div>
            </div>
          </div>

          {/* Section: Customer & TV Device Information */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', padding: '0.875rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            {/* Customer Box */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: '0.35rem' }}>
                Customer Information
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>{data.customerName}</div>
              {data.customerPhone && (
                <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: '0.15rem' }}>Phone: {data.customerPhone}</div>
              )}
              {data.customerAddress && (
                <div style={{ fontSize: '0.775rem', color: '#475569', marginTop: '0.25rem', lineHeight: 1.35 }}>
                  {data.customerAddress}
                </div>
              )}
            </div>

            {/* TV Unit Box */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: '0.35rem' }}>
                Television Unit Details
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>{data.tvModel} {data.screenSize ? `(${data.screenSize})` : ''}</div>
              <div style={{ fontSize: '0.775rem', fontFamily: 'monospace', color: '#334155', marginTop: '0.2rem' }}>
                Barcode: {data.barcode || 'N/A'}
              </div>
              <div style={{ fontSize: '0.775rem', fontFamily: 'monospace', color: '#334155' }}>
                Serial #: {data.serialNumber || 'N/A'}
              </div>
              <div style={{ marginTop: '0.35rem' }}>
                <span style={{
                  display: 'inline-block',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  background: data.warrantyStatus === 'active' ? '#DCFCE7' : '#FEE2E2',
                  color: data.warrantyStatus === 'active' ? '#166534' : '#991B1B'
                }}>
                  {data.warrantyStatus === 'active' ? '✓ Warranty Covered' : 'Out of Warranty'}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Service Diagnostics & Repair */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#0F172A', borderBottom: '1px solid #CBD5E1', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>
              Field Diagnostics & Action Performed
            </div>

            <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              <strong style={{ color: '#475569' }}>Reported Issue: </strong>
              <span style={{ color: '#0F172A' }}>{data.reportedIssue}</span>
            </div>

            {data.diagnosisSummary && (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '0.75rem', fontSize: '0.8rem', lineHeight: 1.45 }}>
                {data.diagnosisSummary.faultCategory && (
                  <div><strong>Fault Category: </strong>{data.diagnosisSummary.faultCategory}</div>
                )}
                {data.diagnosisSummary.findings && (
                  <div style={{ marginTop: '0.25rem' }}><strong>Observations / Findings: </strong>{data.diagnosisSummary.findings}</div>
                )}
                {data.diagnosisSummary.actionTaken && (
                  <div style={{ marginTop: '0.25rem' }}><strong>Repair Action Taken: </strong>{data.diagnosisSummary.actionTaken}</div>
                )}
              </div>
            )}
          </div>

          {/* Section: Parts Used */}
          {data.partsUsed && data.partsUsed.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#0F172A', borderBottom: '1px solid #CBD5E1', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>
                Spare Parts Consumed
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                    <th style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #CBD5E1' }}>Part Name</th>
                    <th style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #CBD5E1' }}>Code</th>
                    <th style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #CBD5E1' }}>Qty</th>
                    <th style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #CBD5E1' }}>Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {data.partsUsed.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{p.partName}</td>
                      <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace' }}>{p.partCode}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{p.quantity}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        {p.warrantyCovered ? 'Under Warranty' : 'Billable'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Section: Field Times & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.8rem', padding: '0.75rem', background: '#F8FAFC', borderRadius: '6px' }}>
            <div>
              <span style={{ color: '#64748B' }}>Arrival Timestamp: </span>
              <strong style={{ color: '#0F172A' }}>{data.arrivalTime || 'Recorded on mobile'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Departure Timestamp: </span>
              <strong style={{ color: '#0F172A' }}>{data.departureTime || 'Recorded on mobile'}</strong>
            </div>
          </div>

          {/* Section: Signatures & Certification */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', borderTop: '2px dashed #CBD5E1', paddingTop: '1.25rem' }}>
            {/* Technician Certification */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: '0.5rem' }}>
                Certified Field Technician
              </div>
              <div style={{ minHeight: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>
                  {data.technicianName}
                </div>
                {data.technicianCode && (
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    ID: {data.technicianCode}
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <CheckCircle size={14} /> Certified Field Completion
                </div>
              </div>
            </div>

            {/* Customer Digital Sign-Off */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: '0.5rem' }}>
                Customer Sign-Off (On Glass)
              </div>
              <div style={{ minHeight: '60px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {data.customerSignatureUrl ? (
                  <img
                    src={data.customerSignatureUrl}
                    alt="Customer Digital Signature"
                    style={{ maxHeight: '55px', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic' }}>
                    Customer Verified via Electronic Signature & OTP
                  </span>
                )}
              </div>
              {data.customerConfirmedAt && (
                <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.25rem', textAlign: 'right' }}>
                  Signed at: {new Date(data.customerConfirmedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Footer Notice */}
          <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #E2E8F0', textAlign: 'center', fontSize: '0.7rem', color: '#94A3B8' }}>
            ZUVO TV Official Service Documentation. Retain this certificate for future warranty support.
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer no-print"
          style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: '0.75rem 1.25rem',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="technician-btn-touch btn-secondary"
            style={{ minHeight: '38px', padding: '0.4rem 1rem', fontSize: '0.8rem' }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="technician-btn-touch btn-primary"
            style={{ minHeight: '38px', padding: '0.4rem 1rem', fontSize: '0.8rem' }}
          >
            <Printer size={16} />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>
    </div>
  );
};
