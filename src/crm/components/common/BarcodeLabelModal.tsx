import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { X, Printer, Tv } from 'lucide-react';

interface BarcodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit: {
    barcode: string;
    serial_number: string;
    product_name?: string;
    screen_size?: number | string;
    model_name?: string;
  } | null;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ isOpen, onClose, unit }) => {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (isOpen && unit && unit.barcode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, unit.barcode, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 2,
          height: 54,
          displayValue: true,
          font: 'monospace',
          fontSize: 14,
          textMargin: 4,
          margin: 10,
          background: '#ffffff',
        });
      } catch (err) {
        console.error('Barcode rendering error:', err);
      }
    }
  }, [isOpen, unit]);

  if (!isOpen || !unit) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog print-container-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <style>
          {`
            @media print {
              body * {
                visibility: hidden;
              }
              .printable-label-card, .printable-label-card * {
                visibility: visible;
              }
              .printable-label-card {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 20px;
                box-shadow: none !important;
                border: 2px solid #000 !important;
                background: #fff !important;
                color: #000 !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}
        </style>

        {/* Modal Header */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Tv size={22} style={{ color: 'var(--accent-cyan)' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Print Barcode & Serial Label</h2>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Label Content Card */}
        <div
          className="printable-label-card"
          style={{
            background: '#FFFFFF',
            color: '#0F172A',
            borderRadius: '12px',
            padding: '24px',
            border: '2px solid #E2E8F0',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          {/* ZUVO Brand Header */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0F172A', paddingBottom: '10px', marginBottom: '14px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.1em', color: '#0F172A', lineHeight: 1 }}>
                ZUVO
              </div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', color: '#475569', marginTop: '2px' }}>
                TELEVISION CRM INVENTORY
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                {unit.screen_size ? `${unit.screen_size}"` : 'TV'}
              </div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B' }}>
                PHYSICAL UNIT
              </div>
            </div>
          </div>

          {/* Model / Variant Name */}
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
            {unit.product_name || 'ZUVO Android TV'}
          </div>
          {unit.model_name && (
            <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '12px', fontWeight: 600 }}>
              Model: {unit.model_name}
            </div>
          )}

          {/* Serial Number Display */}
          <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '6px', padding: '6px 16px', marginBottom: '14px', width: '100%' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Serial Number
            </span>
            <div style={{ fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
              {unit.serial_number}
            </div>
          </div>

          {/* CODE128 Barcode SVG */}
          <div style={{ background: '#FFFFFF', padding: '8px', borderRadius: '6px', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <svg ref={barcodeRef} style={{ maxWidth: '100%' }}></svg>
          </div>
        </div>

        {/* Action Controls */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Close
          </button>
          <button type="button" onClick={handlePrint} className="btn btn-primary">
            <Printer size={16} />
            Print Barcode Label
          </button>
        </div>
      </div>
    </div>
  );
};
