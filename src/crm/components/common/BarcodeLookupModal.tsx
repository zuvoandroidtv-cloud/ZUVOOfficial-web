import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../context/AuthContext';
import {
  QrCode, Search, X, Tv, ShieldCheck, CheckCircle2, AlertTriangle, MapPin,
  Camera, CameraOff, Printer, Clock, FileText, Wrench, RotateCcw, Volume2
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { BarcodeLabelModal } from './BarcodeLabelModal';
import { ProductUnitHistoryModal } from './ProductUnitHistoryModal';

interface BarcodeLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterWarranty?: (barcode: string) => void;
  onCreateServiceTicket?: (barcode: string) => void;
  onReceiveUnit?: (barcode: string) => void;
}

export const BarcodeLookupModal: React.FC<BarcodeLookupModalProps> = ({
  isOpen,
  onClose,
  onRegisterWarranty,
  onCreateServiceTicket,
  onReceiveUnit,
}) => {
  const { role } = useAuth();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'streaming' | 'denied' | 'unsupported'>('idle');
  const [cameraInstructions, setCameraInstructions] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Sub-modals
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResult(null);
      setError(null);
      setCameraError(null);
      setCameraInstructions(null);
      setCameraState('idle');
      setIsScanning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      stopCamera();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setCameraInstructions(null);
    setCameraState('requesting');

    // 1. Check if running in a secure context (HTTPS or localhost)
    if (window.isSecureContext === false && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setCameraState('unsupported');
      setCameraError('Camera access requires a secure connection (HTTPS). Please access this portal over HTTPS.');
      return;
    }

    // 2. Check if mediaDevices API is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('unsupported');
      setCameraError('Camera API is not supported on this browser or device. Please use manual entry or upload an optical test file.');
      return;
    }

    // 3. Query camera permission status if Permissions API is available
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as any });
        if (permissionStatus.state === 'denied') {
          setCameraState('denied');
          setCameraError('Camera permission is blocked in your browser settings.');
          setCameraInstructions(
            'To allow camera access: Click the camera/lock icon in your browser URL bar, change Camera to "Allow", and click "Retry Camera Access".'
          );
          return;
        }
      } catch (pErr) {
        // Some browsers do not support querying { name: 'camera' }; continue to getUserMedia
      }
    }

    setIsScanning(true);

    try {
      // 4. Request camera access using MediaDevices API explicitly to trigger browser permission modal
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      mediaStreamRef.current = stream;

      // Clean up pre-flight stream before Html5Qrcode binds the camera track to the video element
      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;

      // Yield a microtask tick so React renders the #barcode-camera-view div in the DOM
      await new Promise((resolve) => setTimeout(resolve, 80));

      if (!html5QrcodeRef.current) {
        html5QrcodeRef.current = new Html5Qrcode('barcode-camera-view');
      }

      await html5QrcodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 160 },
        },
        (decodedText) => {
          playBeep();
          stopCamera();
          setQuery(decodedText);
          executeLookup(decodedText);
        },
        () => {
          // Frame error callback - ignore routine scan non-matches
        }
      );

      setCameraState('streaming');
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setIsScanning(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraState('denied');
        setCameraError('Camera access was denied by the user or blocked by the browser.');
        setCameraInstructions(
          'Please allow camera access by clicking the lock/camera icon in your address bar, setting Camera to "Allow", and clicking "Retry Camera Access".'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraState('unsupported');
        setCameraError('No camera device was detected on your system. You can enter the barcode or serial number manually.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraState('unsupported');
        setCameraError('Camera is already in use by another application or tab. Please close other camera apps and retry.');
      } else {
        setCameraState('unsupported');
        setCameraError(err.message || 'Unable to initialize camera preview. Please check browser settings or use manual entry.');
      }
    }
  };

  const stopCamera = async () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      try {
        await html5QrcodeRef.current.stop();
      } catch (err) {
        console.error('Error stopping camera:', err);
      }
    }
    setIsScanning(false);
    setCameraState('idle');
  };

  const executeLookup = async (searchStr: string) => {
    const cleanQuery = searchStr.trim();
    if (!cleanQuery) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: res, error: rpcErr } = await (supabase.rpc as any)('get_product_unit_detail', {
        p_identifier: cleanQuery,
      });

      if (rpcErr) throw rpcErr;

      if (!res || !res.success) {
        setError(`Barcode / Serial "${cleanQuery}" not found. Please verify the code or check if unit has been registered.`);
      } else {
        setResult(res);
      }
    } catch (err: any) {
      console.error('Lookup error:', err);
      setError(err.message || 'Failed to complete product unit lookup.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    stopCamera();
    executeLookup(query);
  };

  if (!isOpen) return null;

  const unit = result?.unit;
  const sale = result?.sale;
  const warranty = result?.warranty;
  const serviceTickets = result?.service_tickets || [];
  const rma = result?.rma;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
          {/* Modal Title */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '8px', borderRadius: '8px' }}>
                <QrCode size={22} style={{ color: 'var(--accent-cyan)' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>ZUVO Barcode & Serial Scanner</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Physical TV unit lookup, warranty verification, and service tracing.
                </div>
              </div>
            </div>
            <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}>
              <X size={16} />
            </button>
          </div>

          {/* Camera Scan Container */}
          <div style={{ marginBottom: '16px' }}>
            {isScanning ? (
              <div style={{ background: '#000000', borderRadius: '12px', overflow: 'hidden', position: 'relative', minHeight: '260px', border: '2px solid var(--accent-cyan)' }}>
                <div id="barcode-camera-view" style={{ width: '100%', minHeight: '260px' }} />
                <div style={{ position: 'absolute', top: '10px', left: '12px', background: 'rgba(0,0,0,0.7)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                  Live Camera Active
                </div>
                <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                  <button onClick={stopCamera} className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CameraOff size={14} /> Stop Camera
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={cameraState === 'requesting'}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(6, 182, 212, 0.1)', borderColor: 'rgba(6, 182, 212, 0.3)', color: 'var(--accent-cyan)' }}
                >
                  <Camera size={18} />
                  {cameraState === 'requesting' ? 'Requesting Permission...' : 'Scan via Camera'}
                </button>
                <label
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.3)', color: '#c084fc' }}
                >
                  <FileText size={18} />
                  Optical Test File
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setCameraError(null);
                      setCameraInstructions(null);
                      try {
                        const html5Qr = new Html5Qrcode('barcode-camera-view');
                        const decodedText = await html5Qr.scanFile(file, true);
                        playBeep();
                        setQuery(decodedText);
                        executeLookup(decodedText);
                      } catch (err: any) {
                        setCameraError(`Optical file scan failed: ${err || 'No barcode detected in image.'}`);
                      }
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {cameraError && (
            <div style={{ background: 'rgba(251, 146, 60, 0.08)', border: '1px solid rgba(251, 146, 60, 0.3)', color: '#FDBA74', padding: '12px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.825rem', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#FB923C' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{cameraError}</div>
                    {cameraInstructions && (
                      <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.4 }}>
                        {cameraInstructions}
                      </div>
                    )}
                  </div>
                </div>
                {(cameraState === 'denied' || cameraState === 'unsupported') && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="btn btn-secondary btn-sm"
                    style={{ flexShrink: 0, padding: '4px 10px', fontSize: '0.75rem', color: '#FDBA74', borderColor: 'rgba(251, 146, 60, 0.4)' }}
                  >
                    <RotateCcw size={12} style={{ marginRight: '4px' }} />
                    Retry Camera
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Manual Input Form */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input
              ref={inputRef}
              type="text"
              className="form-input"
              style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
              placeholder="Scan or type Barcode / Serial Number (e.g. ZUV-000000000001)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              <Search size={16} />
              {isLoading ? 'Lookup...' : 'Lookup'}
            </button>
          </form>

          {/* Error Message & Unregistered Barcode Action */}
          {error && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              color: '#FDA4AF',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent-rose)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Barcode not registered</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {error}
                    </div>
                  </div>
                </div>
                {onReceiveUnit && (
                  <button
                    type="button"
                    onClick={() => {
                      onReceiveUnit(query.trim());
                      onClose();
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Tv size={14} /> Create New Unit
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Result View */}
          {result && unit && (
            <div className="glass-card" style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.95)' }}>
              {/* Product Title */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                    {unit.variant?.product_name || 'ZUVO Android TV'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Brand: {unit.variant?.brand_name} • Model: {unit.variant?.model_name} • Code: {unit.variant?.product_code}
                  </div>
                </div>
                <span className={`badge ${
                  unit.status === 'in_stock' ? 'badge-cyan' :
                  unit.status === 'sold' ? 'badge-emerald' :
                  unit.status === 'in_service' ? 'badge-rose' : 'badge-amber'
                }`} style={{ fontSize: '0.85rem', padding: '4px 10px' }}>
                  {unit.status?.toUpperCase()}
                </span>
              </div>

              {/* Grid Metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.85rem', marginBottom: '16px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Primary Barcode:</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>{unit.barcode}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Serial Number:</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{unit.serial_number}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Warehouse / Location:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <MapPin size={14} style={{ color: 'var(--accent-cyan)' }} />
                    {unit.warehouse?.warehouse_name || 'Central Facility'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Hardware Specifications:</span>
                  <div style={{ fontWeight: 600 }}>
                    {unit.variant?.screen_size}" • {unit.variant?.tv_type?.toUpperCase()}
                    {unit.variant?.bluetooth && ' • BT'}
                    {unit.variant?.voice_remote && ' • Voice'}
                  </div>
                </div>
              </div>

              {/* Sale Information Card */}
              {sale && (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '12px', fontSize: '0.825rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} /> Sale & Customer Reference
                  </div>
                  <div>Invoice: <strong>{sale.sale_number}</strong> • Date: {new Date(sale.sale_date).toLocaleDateString()}</div>
                  <div>Customer: <strong>{sale.customer?.full_name || 'Retail Customer'}</strong> ({sale.customer?.phone || 'N/A'})</div>
                </div>
              )}

              {/* Warranty Card */}
              <div style={{
                marginBottom: '16px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: warranty ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                border: warranty ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={20} style={{ color: warranty ? 'var(--accent-emerald)' : 'var(--text-muted)' }} />
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                      {warranty ? 'Active Official Warranty' : 'No Registered Warranty'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {warranty
                        ? `Valid until ${warranty.warranty_end_date} (#${warranty.warranty_number})`
                        : 'Eligible for activation upon customer sale.'}
                    </div>
                  </div>
                </div>
                <span className={`badge ${warranty ? 'badge-emerald' : 'badge-slate'}`}>
                  {warranty ? warranty.status?.toUpperCase() : 'UNREGISTERED'}
                </span>
              </div>

              {/* Action Toolbar */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsLabelModalOpen(true)}
                >
                  <Printer size={14} /> Print Label
                </button>

                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsHistoryModalOpen(true)}
                >
                  <Clock size={14} /> Complete Unit History
                </button>

                {!warranty && unit.status === 'sold' && onRegisterWarranty && (
                  <button
                    className="btn btn-emerald btn-sm"
                    onClick={() => {
                      onClose();
                      onRegisterWarranty(unit.barcode);
                    }}
                  >
                    <ShieldCheck size={14} /> Register Warranty
                  </button>
                )}

                {unit.status === 'sold' && onCreateServiceTicket && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      onClose();
                      onCreateServiceTicket(unit.barcode);
                    }}
                  >
                    <Wrench size={14} /> Create Service Ticket
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-modals */}
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

      {unit && (
        <ProductUnitHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          unitIdentifier={unit.barcode}
          onRegisterWarranty={onRegisterWarranty}
          onCreateServiceTicket={onCreateServiceTicket}
        />
      )}
    </>
  );
};
