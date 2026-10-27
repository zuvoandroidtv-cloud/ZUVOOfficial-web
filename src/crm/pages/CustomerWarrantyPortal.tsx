import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import {
  ShieldCheck,
  Scan,
  Tv,
  CheckCircle2,
  AlertCircle,
  Calendar,
  User,
  Phone,
  Mail,
  MapPin,
  Printer,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Lock,
  Navigation,
  Clock
} from 'lucide-react';

export const CustomerWarrantyPortal: React.FC = () => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);

  // Customer form inputs
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [warrantyStartDate, setWarrantyStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [registering, setRegistering] = useState(false);
  const [registeredWarranty, setRegisteredWarranty] = useState<any | null>(null);

  // Phase 7.9: Privacy-Safe Active Service ETA State
  const [activeServiceEta, setActiveServiceEta] = useState<any | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  const handleVerifyBarcode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    setVerifying(true);
    setVerificationResult(null);
    setRegisteredWarranty(null);

    try {
      const { data, error } = await (supabase.rpc as any)('verify_tv_barcode_for_warranty', {
        p_barcode: code
      });

      if (error) throw error;
      const res = data as any;
      setVerificationResult(res);

      if (res?.valid && res?.already_registered) {
        setRegisteredWarranty(res.warranty);

        // Phase 7.9: Check for any active service ticket ETA for this customer/product
        try {
          if (res.product?.unit_id) {
            const { data: ticketData } = await (supabase as any)
              .from('service_tickets')
              .select('id, ticket_number, status, service_visits(id, status, current_eta_minutes, eta_status, technician_eta_events(eta_status, estimated_arrival_window_start, estimated_arrival_window_end, is_delayed, created_at))')
              .eq('product_unit_id', res.product.unit_id)
              .in('status', ['assigned', 'in_progress'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (ticketData?.service_visits?.[0]) {
              setActiveServiceEta({
                ticketNumber: ticketData.ticket_number,
                ticketStatus: ticketData.status,
                visit: ticketData.service_visits[0]
              });
            }
          }
        } catch (e) {
          console.warn('ETA fetch skipped:', e);
        }
      } else if (res?.valid && res?.sale) {
        // Pre-fill customer info if available from sale
        if (res.sale.customer_name) setCustomerName(res.sale.customer_name);
        if (res.sale.customer_phone) setCustomerPhone(res.sale.customer_phone);
      }
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleRegisterWarranty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Please provide your Full Name and Mobile Phone Number.');
      return;
    }

    setRegistering(true);
    try {
      const { data, error } = await (supabase.rpc as any)('register_customer_warranty', {
        p_barcode: barcodeInput.trim(),
        p_customer_name: customerName.trim(),
        p_customer_phone: customerPhone.trim(),
        p_customer_email: customerEmail.trim() || null,
        p_customer_address: customerAddress.trim() || null,
        p_registration_method: 'barcode_scan'
      });

      if (error) throw error;
      const res = data as any;

      if (res?.success) {
        setRegisteredWarranty(res.warranty);
      } else {
        alert(res?.error || 'Registration failed');
      }
    } catch (err: any) {
      alert(`Registration error: ${err.message}`);
    } finally {
      setRegistering(false);
    }
  };

  const resetPortal = () => {
    setBarcodeInput('');
    setVerificationResult(null);
    setRegisteredWarranty(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setCustomerAddress('');
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '1rem 0 3rem' }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 1.25rem', background: 'rgba(37, 99, 235, 0.08)', borderRadius: '9999px', marginBottom: '1rem' }}>
          <ShieldCheck size={20} style={{ color: 'var(--brand-primary)' }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--brand-primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            ZUVO Official Protection
          </span>
        </div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Television Warranty Registration
        </h1>
        <p className="text-secondary" style={{ fontSize: '1rem', maxWidth: '580px', margin: '0 auto' }}>
          Activate your official 12-month manufacturer warranty by scanning or entering the unique barcode on your ZUVO Smart TV box or rear panel.
        </p>
      </div>

      {/* STAGE 1: Barcode Input */}
      {!registeredWarranty && (!verificationResult || !verificationResult.valid || verificationResult.already_registered) && (
        <div className="card" style={{ padding: '2rem', marginBottom: '2rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
          <form onSubmit={handleVerifyBarcode}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Enter or Scan TV Barcode
              </label>
              <div style={{ position: 'relative' }}>
                <Scan size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--brand-primary)' }} />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  className="input-field"
                  placeholder="Scan barcode with scanner or enter e.g. ZUV-BAR-..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  style={{ paddingLeft: '3rem', fontSize: '1.125rem', fontFamily: 'monospace', fontWeight: 600 }}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <p className="text-muted" style={{ fontSize: '0.8125rem', margin: 0 }}>
                  * Hardware barcode readers type directly into this box automatically.
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', justifyContent: 'center' }}
              disabled={verifying || !barcodeInput.trim()}
            >
              {verifying ? (
                <>Verifying Barcode...</>
              ) : (
                <>
                  Verify Television & Check Warranty <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Unsuccessful Verification Banner */}
          {verificationResult && !verificationResult.valid && (
            <div className="card" style={{ marginTop: '1.5rem', background: 'rgba(239, 68, 68, 0.05)', borderColor: 'var(--status-danger)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <AlertCircle size={24} style={{ color: 'var(--status-danger)', flexShrink: 0, marginTop: '0.125rem' }} />
              <div>
                <h4 style={{ fontWeight: 600, color: 'var(--status-danger)', marginBottom: '0.25rem' }}>
                  Verification Error
                </h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {verificationResult.message}
                </p>
                {verificationResult.product && (
                  <div style={{ fontSize: '0.8125rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                    Product: {verificationResult.product.product_name} | Recorded Status: {verificationResult.product.status}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STAGE 2: Eligible for Registration -> Customer Form */}
      {verificationResult?.valid && !verificationResult?.already_registered && !registeredWarranty && (
        <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
          {/* Verified TV info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--status-success)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.75rem' }}>
            <CheckCircle2 size={32} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--status-success)', textTransform: 'uppercase' }}>
                Verified Genuine ZUVO TV
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.125rem' }}>
                {verificationResult.product.product_name} ({verificationResult.product.screen_size}")
              </div>
              <div style={{ fontSize: '0.8125rem', fontFamily: 'monospace', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Barcode: {verificationResult.product.barcode} | Serial: {verificationResult.product.serial_number}
              </div>
            </div>
          </div>

          <form onSubmit={handleRegisterWarranty}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.25rem' }}>
              Customer Registration Details
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. John Doe"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Phone Number *</label>
                <input
                  type="tel"
                  required
                  className="input-field"
                  placeholder="e.g. +91 9876543210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Email Address (Optional)</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="e.g. john@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Delivery / Installation Address</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="House/Street, City, Pincode"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={14} style={{ color: 'var(--brand-primary)' }} /> Warranty Start Date (Purchase Date) *
                </label>
                <input
                  type="date"
                  required
                  className="input-field"
                  value={warrantyStartDate}
                  onChange={(e) => setWarrantyStartDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  style={{ fontWeight: 600 }}
                />
                <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Select the date of TV purchase/delivery from your invoice.
                </span>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ShieldCheck size={14} style={{ color: 'var(--status-success)' }} /> Warranty Duration & Expiry
                </label>
                <div
                  className="input-field"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-secondary)',
                    fontWeight: 600,
                    color: 'var(--brand-primary)'
                  }}
                >
                  <span>12 Months Standard Coverage</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Until:{' '}
                    {(() => {
                      const d = new Date(warrantyStartDate || new Date());
                      d.setFullYear(d.getFullYear() + 1);
                      d.setDate(d.getDate() - 1);
                      return d.toLocaleDateString();
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Enforced Warranty Policy Parameters Box */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                <ShieldCheck size={16} style={{ color: 'var(--status-success)' }} /> Comprehensive Warranty Coverage Details:
              </div>
              <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <li><strong>Display Panel & Motherboard:</strong> 100% genuine component replacement for panel lines, dead pixels, and power failures.</li>
                <li><strong>Audio & Remote Control:</strong> Coverage against internal speaker distortions, motherboard audio chips, and Bluetooth voice remotes.</li>
                <li><strong>Authorized Technicians:</strong> Doorstep on-site technician inspection and service with OTP verification.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={resetPortal}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={registering}
              >
                {registering ? 'Activating Warranty...' : 'Activate 1-Year Official Warranty'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STAGE 3: Registered Warranty Certificate Card */}
      {registeredWarranty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease-in-out' }}>
          {/* Certificate Card */}
          <div
            className="card"
            style={{
              padding: '2.5rem',
              background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
              border: '2px solid var(--brand-primary)',
              boxShadow: '0 20px 40px -15px rgba(37, 99, 235, 0.15)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Watermark badge */}
            <div style={{ position: 'absolute', right: '-20px', top: '-20px', opacity: 0.05, pointerEvents: 'none' }}>
              <ShieldCheck size={240} />
            </div>

            {/* Top Certificate Header */}
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span className="badge badge-primary" style={{ letterSpacing: '0.08em', fontWeight: 700, padding: '0.35rem 0.75rem', marginBottom: '0.5rem' }}>
                  CERTIFICATE OF WARRANTY
                </span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '0.25rem' }}>
                  ZUVO Television Protection Plan
                </h2>
                <div style={{ fontFamily: 'monospace', fontSize: '0.9375rem', color: 'var(--brand-primary)', fontWeight: 700, marginTop: '0.25rem' }}>
                  Policy #{registeredWarranty.warranty_number}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${registeredWarranty.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.875rem', padding: '0.4rem 0.85rem' }}>
                  STATUS: {registeredWarranty.status?.toUpperCase()}
                </span>
              </div>
            </div>

            {/* TV and Customer Specification Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TV Model / Variant</div>
                <div style={{ fontSize: '1.0625rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  {registeredWarranty.product_name || verificationResult?.product?.product_name || 'ZUVO TV'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Serial Number</div>
                <div style={{ fontSize: '0.9375rem', fontFamily: 'monospace', fontWeight: 600, marginTop: '0.25rem' }}>
                  {registeredWarranty.serial_number || verificationResult?.product?.serial_number}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unit Barcode</div>
                <div style={{ fontSize: '0.9375rem', fontFamily: 'monospace', fontWeight: 600, marginTop: '0.25rem' }}>
                  {registeredWarranty.barcode || barcodeInput}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registered Customer</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginTop: '0.25rem' }}>
                  {registeredWarranty.customer_name || customerName || 'Registered Owner'}
                </div>
              </div>
            </div>

            {/* Coverage Date Banner */}
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Valid From</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                  {registeredWarranty.warranty_start_date}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Coverage End Date</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--brand-primary)', marginTop: '0.25rem' }}>
                  {registeredWarranty.warranty_end_date}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Coverage Period</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--status-success)', marginTop: '0.25rem' }}>
                  {registeredWarranty.duration_months || 12} Months
                </div>
              </div>
            </div>

            {/* PHASE 7.9: CUSTOMER-SAFE SERVICE VISIT ETA TRACKER */}
            {activeServiceEta && (
              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Navigation size={18} style={{ color: 'var(--accent-cyan)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                      Doorstep Service Visit Status (Ticket #{activeServiceEta.ticketNumber})
                    </span>
                  </div>
                  <span className={`badge ${activeServiceEta.visit?.eta_status === 'ARRIVED' ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.75rem' }}>
                    {activeServiceEta.visit?.eta_status === 'ARRIVED'
                      ? 'TECHNICIAN ARRIVED'
                      : activeServiceEta.visit?.eta_status === 'EN_ROUTE'
                      ? 'TECHNICIAN EN ROUTE'
                      : 'SERVICE ASSIGNED'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Arrival Window</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--brand-primary)', marginTop: '0.25rem' }}>
                      {activeServiceEta.visit?.current_eta_minutes
                        ? `Approx. ${activeServiceEta.visit.current_eta_minutes} minutes`
                        : 'Arrival Pending Confirmation'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Service Progress</div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                      {activeServiceEta.visit?.status?.toUpperCase() || 'SCHEDULED'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={14} />
                  <span>
                    Privacy-safe proximity tracking. Exact coordinates are protected by ZUVO Privacy Policy.
                  </span>
                </div>
              </div>
            )}

            {/* PHASE 7.7: EXTENDED WARRANTY UPSELL SHOWCASE */}
            <div
              style={{
                marginTop: '1.75rem',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(124, 58, 237, 0.08) 100%)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={18} style={{ color: 'var(--brand-primary)' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                    Protect Your Investment: ZUVO Care Extended Protection Plans
                  </span>
                </div>
                <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                  AUTHORIZED PROTECTION
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Extend your coverage seamlessly beyond the standard 12 months. Official ZUVO Care plans provide doorstep parts replacement, zero labor charges, and certified engineering repair on motherboards, power supplies, and display backlights.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--brand-primary)' }}>+1 Year Shield</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Additional 12 Months</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '0.25rem' }}>₹1,499 onwards</div>
                </div>
                <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--brand-primary)' }}>+2 Years Ultra</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Additional 24 Months</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '0.25rem' }}>₹4,299 onwards</div>
                </div>
                <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--brand-primary)' }}>+3 Years Diamond</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Additional 36 Months</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '0.25rem' }}>₹6,999 onwards</div>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                💡 Extended plans can be activated directly at your authorized ZUVO dealer or via customer support at +91 8056666653.
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              This digital certificate verifies manufacturer warranty coverage under ZUVO Electronics. Keep this policy number for hassle-free claim service.
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => window.print()}>
              <Printer size={16} /> Print Certificate
            </button>
            <button className="btn btn-primary" onClick={resetPortal}>
              <RotateCcw size={16} /> Register Another TV
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
