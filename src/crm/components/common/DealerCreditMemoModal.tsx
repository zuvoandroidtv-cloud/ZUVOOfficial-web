import React, { useRef } from 'react';
import {
  FileText,
  Printer,
  Download,
  X,
  CheckCircle,
  Building2,
  Tv,
  Calendar,
  DollarSign,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export interface CreditMemoData {
  creditMemoNumber: string;
  creditDate: string;
  dealerName: string;
  dealerCode?: string;
  dealerPhone?: string;
  dealerAddress?: string;
  warehouseName: string;
  productBarcode: string;
  productSerial: string;
  modelName: string;
  screenSize?: string;
  wholesalePrice: number;
  taxAmount: number;
  totalCreditAmount: number;
  reason: string;
  status: 'CREDITED' | 'RECONCILED' | 'SETTLED';
  authorizedSignatory?: string;
}

interface DealerCreditMemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  memo: CreditMemoData | null;
}

export const DealerCreditMemoModal: React.FC<DealerCreditMemoModalProps> = ({
  isOpen,
  onClose,
  memo
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !memo) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    const csvRows = [
      ['ZUVO ANDROID TV - OFFICIAL CONSIGNMENT CREDIT MEMO'],
      ['Credit Memo Number', memo.creditMemoNumber],
      ['Date', memo.creditDate],
      ['Dealer Name', memo.dealerName],
      ['Warehouse Restocked', memo.warehouseName],
      ['TV Model', memo.modelName],
      ['Barcode', memo.productBarcode],
      ['Serial Number', memo.productSerial],
      ['Credit Base Value (INR)', memo.wholesalePrice.toFixed(2)],
      ['Taxes Credited (INR)', memo.taxAmount.toFixed(2)],
      ['Total Net Credit (INR)', memo.totalCreditAmount.toFixed(2)],
      ['Return Reason', `"${memo.reason.replace(/"/g, '""')}"`],
      ['Settlement Status', memo.status]
    ];

    const csvContent = '\uFEFF' + csvRows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${memo.creditMemoNumber}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div
        className="modal-card"
        style={{
          maxWidth: '750px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden'
        }}
      >
        {/* Header Actions */}
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
            <FileText size={20} style={{ color: '#3b82f6' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>
              Consignment Credit Memo Preview
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

        {/* Printable Document Body */}
        <div
          ref={printRef}
          className="printable-credit-memo"
          style={{
            padding: '2rem',
            overflowY: 'auto',
            background: 'white',
            color: '#0f172a',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
          }}
        >
          {/* Top Brand Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                ZUVO ANDROID TV
              </h1>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                Consumer Electronics & Commercial Consignment Division
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                Aarani, Tamil Nadu, India | support@zuvoandroidtv.com
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-block', background: '#ecfdf5', color: '#059669', border: '1px solid #10b981', padding: '0.35rem 0.85rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                CREDIT MEMORANDUM
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                {memo.creditMemoNumber}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Date: {new Date(memo.creditDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Parties & Restocking Information */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.35rem' }}>
                CREDITED DEALER / CONSIGNEE
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{memo.dealerName}</div>
              {memo.dealerCode && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Account Code: {memo.dealerCode}</div>}
              {memo.dealerAddress && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{memo.dealerAddress}</div>}
              {memo.dealerPhone && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Contact: {memo.dealerPhone}</div>}
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.35rem' }}>
                RECEIVING CENTRAL WAREHOUSE
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{memo.warehouseName}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Inventory Class: ZUVO Central Stock (Restocked)</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                Reason: <strong style={{ color: '#0f172a' }}>{memo.reason}</strong>
              </div>
            </div>
          </div>

          {/* Unit Line Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: 'white', textAlign: 'left', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.65rem 0.75rem' }}>Description</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Identifiers</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Wholesale Base</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Tax Adjust</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Credit (INR)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0', fontSize: '0.875rem' }}>
                <td style={{ padding: '0.75rem' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{memo.modelName}</div>
                  {memo.screenSize && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Display: {memo.screenSize} 4K UHD</div>}
                </td>
                <td style={{ padding: '0.75rem', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                  <div>BAR: {memo.productBarcode}</div>
                  <div>S/N: {memo.productSerial}</div>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>1</td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>₹{memo.wholesalePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>₹{memo.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                  ₹{memo.totalCreditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Financial Settlement Breakdown */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <div style={{ width: '280px', borderTop: '2px solid #0f172a', paddingTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b' }}>Consignment Item Value:</span>
                <span>₹{memo.wholesalePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b' }}>Applicable Tax Adjustment:</span>
                <span>₹{memo.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '1px solid #e2e8f0', marginTop: '0.25rem', fontSize: '1.05rem', fontWeight: 800, color: '#059669' }}>
                <span>Total Net Dealer Credit:</span>
                <span>₹{memo.totalCreditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Policy & Authorization Note */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.2rem' }}>
                Legal & Accounting Notice:
              </div>
              This credit memorandum formally restocks the listed hardware into Central Depots and offsets dealer accounts receivable. Read-only audit representation.
            </div>
            <div style={{ textAlign: 'right', minWidth: '160px' }}>
              <div style={{ borderBottom: '1px solid #94a3b8', height: '35px' }}></div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: '0.25rem', color: '#0f172a' }}>
                {memo.authorizedSignatory || 'ZUVO Commercial Accounts'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
