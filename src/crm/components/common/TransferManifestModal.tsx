import React, { useRef } from 'react';
import {
  FileText,
  Printer,
  Download,
  X,
  Truck,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Barcode as BarcodeIcon,
  ShieldCheck
} from 'lucide-react';

export interface TransferManifestData {
  transferNumber: string;
  sourceWarehouse: string;
  destinationWarehouse: string;
  carrierName?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  dispatchDate?: string;
  expectedArrival?: string;
  status: string;
  expectedCount: number;
  dispatchedCount: number;
  receivedCount: number;
  missingCount: number;
  unexpectedCount: number;
  damagedCount: number;
  items: Array<{
    barcode: string;
    serialNumber: string;
    modelName: string;
    screenSize?: number;
    status: string;
    isDamaged: boolean;
    conditionNotes?: string;
  }>;
}

interface TransferManifestModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: TransferManifestData | null;
}

export const TransferManifestModal: React.FC<TransferManifestModalProps> = ({
  isOpen,
  onClose,
  manifest
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !manifest) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    const csvRows = [
      ['ZUVO ANDROID TV - OFFICIAL INTER-DEPOT STOCK TRANSFER MANIFEST'],
      ['Transfer Number', manifest.transferNumber],
      ['Source Depot', manifest.sourceWarehouse],
      ['Destination Depot', manifest.destinationWarehouse],
      ['Dispatch Timestamp', manifest.dispatchDate || 'N/A'],
      ['Carrier Name', manifest.carrierName || 'ZUVO Logistics'],
      ['Vehicle Number', manifest.vehicleNumber || 'N/A'],
      ['Driver Name', manifest.driverName || 'N/A'],
      ['Manifest Status', manifest.status.toUpperCase()],
      ['Expected Units', String(manifest.expectedCount)],
      ['Dispatched Units', String(manifest.dispatchedCount)],
      ['Received Units', String(manifest.receivedCount)],
      ['Missing Units', String(manifest.missingCount)],
      ['Damaged Units', String(manifest.damagedCount)],
      [],
      ['Barcode', 'Serial Number', 'Model Name', 'Screen Size', 'Item Status', 'Damaged', 'Condition Notes']
    ];

    manifest.items.forEach(item => {
      csvRows.push([
        item.barcode,
        item.serialNumber || 'N/A',
        `"${(item.modelName || 'ZUVO TV').replace(/"/g, '""')}"`,
        item.screenSize ? `${item.screenSize}"` : 'N/A',
        item.status,
        item.isDamaged ? 'YES' : 'NO',
        `"${(item.conditionNotes || '').replace(/"/g, '""')}"`
      ]);
    });

    const csvContent = '\uFEFF' + csvRows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MANIFEST_${manifest.transferNumber}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div
        className="modal-card"
        style={{
          maxWidth: '850px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden'
        }}
      >
        {/* Actions Bar */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: 'var(--bg-card-secondary, #1e293b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Truck size={20} style={{ color: '#06b6d4' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>
              Stock Transfer Manifest Preview
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handlePrint}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Printer size={15} /> Print / Save PDF
            </button>
            <button
              onClick={handleDownloadCSV}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Download size={15} /> Export CSV
            </button>
            <button
              onClick={onClose}
              className="btn-icon"
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Manifest Document */}
        <div
          ref={printRef}
          className="printable-manifest"
          style={{
            padding: '2rem',
            overflowY: 'auto',
            background: 'white',
            color: '#0f172a',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
                ZUVO ANDROID TV
              </h1>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                Inter-Depot Inventory Transfer Manifest & Bill of Lading
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Central Logistics & Regional Warehousing Operations
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-block', background: '#eff6ff', color: '#2563eb', border: '1px solid #3b82f6', padding: '0.3rem 0.75rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                {manifest.status.replace('_', ' ')}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                {manifest.transferNumber}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Dispatched: {manifest.dispatchDate ? new Date(manifest.dispatchDate).toLocaleString('en-IN') : 'Pending'}
              </div>
            </div>
          </div>

          {/* Locations & Transit Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.25rem' }}>
                SOURCE WAREHOUSE / DISPATCH DEPOT
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{manifest.sourceWarehouse}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                Authorized Dispatch Personnel Sign-Off Required
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.25rem' }}>
                DESTINATION WAREHOUSE / RECEIVING HUB
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{manifest.destinationWarehouse}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                Receiving Custody Barcode Verification Gate
              </div>
            </div>
          </div>

          {/* Transit Logistics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem', padding: '0.75rem', background: '#f1f5f9', borderRadius: '6px', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: '#64748b' }}>Carrier:</span> <strong>{manifest.carrierName || 'ZUVO Fleet'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Vehicle:</span> <strong>{manifest.vehicleNumber || 'Unassigned'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Driver:</span> <strong>{manifest.driverName || 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Phone:</span> <strong>{manifest.driverPhone || 'N/A'}</strong>
            </div>
          </div>

          {/* Reconciliation Counts Bar */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, padding: '0.75rem', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 700 }}>EXPECTED</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1d4ed8' }}>{manifest.expectedCount}</div>
            </div>
            <div style={{ flex: 1, padding: '0.75rem', background: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: '0.7rem', color: '#065f46', fontWeight: 700 }}>RECEIVED</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669' }}>{manifest.receivedCount}</div>
            </div>
            <div style={{ flex: 1, padding: '0.75rem', background: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: '0.7rem', color: '#991b1b', fontWeight: 700 }}>MISSING</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#dc2626' }}>{manifest.missingCount}</div>
            </div>
            <div style={{ flex: 1, padding: '0.75rem', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 700 }}>UNEXPECTED</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706' }}>{manifest.unexpectedCount}</div>
            </div>
            <div style={{ flex: 1, padding: '0.75rem', background: '#fdf2f8', borderRadius: '6px', border: '1px solid #fbcfe8' }}>
              <div style={{ fontSize: '0.7rem', color: '#9d174d', fontWeight: 700 }}>DAMAGED</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#db2777' }}>{manifest.damagedCount}</div>
            </div>
          </div>

          {/* Unit Manifest Line Items */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: 'white', textAlign: 'left', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.5rem 0.6rem' }}>#</th>
                <th style={{ padding: '0.5rem 0.6rem' }}>Barcode / Serial</th>
                <th style={{ padding: '0.5rem 0.6rem' }}>Product Description</th>
                <th style={{ padding: '0.5rem 0.6rem' }}>Item Status</th>
                <th style={{ padding: '0.5rem 0.6rem' }}>Condition / Audit Notes</th>
              </tr>
            </thead>
            <tbody>
              {manifest.items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                    No units attached to this transfer manifest yet.
                  </td>
                </tr>
              ) : (
                manifest.items.map((it, idx) => (
                  <tr key={it.barcode || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem 0.6rem', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '0.5rem 0.6rem', fontFamily: 'monospace', fontWeight: 700 }}>
                      <div>{it.barcode}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>{it.serialNumber || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem' }}>
                      <div style={{ fontWeight: 600 }}>{it.modelName}</div>
                      {it.screenSize && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{it.screenSize}" 4K UHD</div>}
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: it.status === 'received' ? '#dcfce7' : it.status === 'missing' ? '#fee2e2' : '#f1f5f9',
                        color: it.status === 'received' ? '#15803d' : it.status === 'missing' ? '#b91c1c' : '#334155'
                      }}>
                        {it.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', color: it.isDamaged ? '#b91c1c' : '#64748b' }}>
                      {it.isDamaged ? '⚠️ DAMAGED: ' : ''}{it.conditionNotes || 'Normal intake'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Signatures & Custody Verification */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '2px solid #0f172a' }}>
            <div>
              <div style={{ borderBottom: '1px solid #94a3b8', height: '40px', marginBottom: '0.5rem' }}></div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>DISPATCH DEPOT OFFICER</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Name, Signature & Date</div>
            </div>
            <div>
              <div style={{ borderBottom: '1px solid #94a3b8', height: '40px', marginBottom: '0.5rem' }}></div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>LOGISTICS CARRIER / DRIVER</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Name, Signature & Date</div>
            </div>
            <div>
              <div style={{ borderBottom: '1px solid #94a3b8', height: '40px', marginBottom: '0.5rem' }}></div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>RECEIVING DEPOT OFFICER</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Name, Signature & Date</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
