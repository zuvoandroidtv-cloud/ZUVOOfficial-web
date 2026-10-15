import React, { useRef, useState, useEffect } from 'react';
import { PenTool, RotateCcw, Check, AlertCircle } from 'lucide-react';

interface SignaturePadGlassProps {
  onCapture: (signatureDataUrl: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  className?: string;
}

export const SignaturePadGlass: React.FC<SignaturePadGlassProps> = ({
  onCapture,
  onClear,
  disabled = false,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pointCount, setPointCount] = useState(0);

  // Setup high-DPI canvas
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(rect.width || 320, 300);
    const height = 180;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#06B6D4'; // ZUVO signature cyan
    }
  };

  useEffect(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setErrorMessage(null);
    setPointCount(prev => prev + 1);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    if ('touches' in e && e.cancelable) {
      e.preventDefault(); // Prevent touch scroll during signing
    }
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasDrawn(true);
    setPointCount(prev => prev + 1);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setPointCount(0);
    setErrorMessage(null);
    if (onClear) onClear();
  };

  const handleConfirmSignature = () => {
    if (!hasDrawn || pointCount < 8) {
      setErrorMessage('Please provide a valid customer signature on the screen before confirming.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      onCapture(dataUrl);
    } catch (err: any) {
      setErrorMessage('Failed to capture signature from screen. Please retry.');
    }
  };

  return (
    <div className={`signature-glass-container ${className}`} style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <PenTool size={14} style={{ color: 'var(--accent-cyan)' }} />
          <span>Customer Sign-Off Glass</span>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sign with finger or stylus</span>
      </div>

      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '180px',
          background: 'rgba(11, 15, 25, 0.85)',
          border: '1.5px dashed rgba(6, 182, 212, 0.4)',
          borderRadius: 'var(--radius-md)',
          touchAction: 'none',
          overflow: 'hidden'
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{
            display: 'block',
            cursor: disabled ? 'not-allowed' : 'crosshair'
          }}
        />

        {!hasDrawn && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              color: 'rgba(148, 163, 184, 0.45)',
              fontSize: '0.875rem',
              fontWeight: 500,
              letterSpacing: '0.02em',
              userSelect: 'none'
            }}
          >
            Draw Customer Signature Here
          </div>
        )}
      </div>

      {errorMessage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--accent-rose)' }}>
          <AlertCircle size={14} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || !hasDrawn}
          className="technician-btn-touch btn-secondary"
          style={{ minHeight: '38px', padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
        >
          <RotateCcw size={14} />
          <span>Clear Canvas</span>
        </button>

        <button
          type="button"
          onClick={handleConfirmSignature}
          disabled={disabled}
          className="technician-btn-touch btn-primary"
          style={{ minHeight: '38px', padding: '0.4rem 0.875rem', fontSize: '0.75rem', background: 'linear-gradient(135deg, #06B6D4, #3B82F6)' }}
        >
          <Check size={14} />
          <span>Accept Signature</span>
        </button>
      </div>
    </div>
  );
};
