import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Search, Plus, X, Barcode, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Pagination } from '../components/common/Pagination';
import { UnlinkedDealerAlert } from '../components/common/UnlinkedDealerAlert';

export const DealerWarrantyPage: React.FC = () => {
  const { profile } = useAuth();
  const dealerId = profile?.dealer_id;

  const [warranties, setWarranties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Warranty Registration Modal
  const [showRegModal, setShowRegModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedProduct, setVerifiedProduct] = useState<any | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [periodMonths, setPeriodMonths] = useState(12);

  const fetchWarranties = async () => {
    if (!dealerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('warranties')
        .select('*, customers(full_name, phone), product_units(barcode, serial_number, product_variants(product_name))', { count: 'exact' })
        .eq('dealer_id', dealerId)
        .order('registered_at', { ascending: false });

      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`warranty_number.ilike.${q}`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setWarranties(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching dealer warranties:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarranties();
  }, [dealerId, searchQuery, page, pageSize]);

  const handleVerifyBarcode = async () => {
    if (!barcodeInput.trim()) return;
    setVerifying(true);
    setVerifiedProduct(null);
    try {
      const { data: rawData, error } = await supabase.rpc('verify_tv_barcode_for_warranty', {
        p_barcode: barcodeInput.trim()
      });

      if (error) throw error;
      const data = rawData as any;
      if (!data?.eligible) {
        alert(`Verification Notice: ${data?.message || 'Barcode not eligible for warranty'}`);
        setVerifiedProduct(null);
        return;
      }
      setVerifiedProduct(data);
      if (data.customer_name) setCustomerName(data.customer_name);
      if (data.customer_phone) setCustomerPhone(data.customer_phone);
    } catch (err: any) {
      alert(`Barcode verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleRegisterWarranty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedProduct) {
      alert('Please verify a valid TV barcode first');
      return;
    }

    setRegistering(true);
    try {
      const { data, error } = await supabase.rpc('register_customer_warranty', {
        p_barcode: barcodeInput.trim(),
        p_customer_name: customerName.trim(),
        p_customer_phone: customerPhone.trim(),
        p_customer_email: customerEmail.trim() || null,
        p_customer_address: customerAddress.trim() || null,
        p_registration_method: 'crm_registration'
      });

      if (error) throw error;
      const res = data as any;
      if (res && res.success === false) {
        throw new Error(res.error || 'Warranty registration failed.');
      }

      setShowRegModal(false);
      setBarcodeInput('');
      setVerifiedProduct(null);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setCustomerAddress('');
      fetchWarranties();
    } catch (err: any) {
      alert(`Warranty Registration Failed: ${err.message}`);
    } finally {
      setRegistering(false);
    }
  };

  if (!dealerId && !loading) {
    return (
      <div className="module-container">
        <UnlinkedDealerAlert />
      </div>
    );
  }

  return (
    <div className="module-container">
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck style={{ color: 'var(--brand-primary)' }} /> Dealer Warranty Management
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Verify TV barcodes, register new warranties, and track customer coverage periods
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowRegModal(true)}>
          <Plus size={16} /> Register Warranty
        </button>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search by Warranty Number..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
      </div>

      {/* Warranty Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Warranty #</th>
                <th>TV Model</th>
                <th>Barcode / S/N</th>
                <th>Customer</th>
                <th>Coverage Period</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                    <p className="text-muted">Loading dealer warranty certificates...</p>
                  </td>
                </tr>
              ) : warranties.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <ShieldCheck size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Warranties Registered</h3>
                    <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      Click "Register Warranty" to activate warranty coverage for a sold TV unit.
                    </p>
                  </td>
                </tr>
              ) : (
                warranties.map((w) => (
                  <tr key={w.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{w.warranty_number}</td>
                    <td>{w.product_units?.product_variants?.product_name || 'ZUVO TV'}</td>
                    <td>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8125rem' }}>{w.product_units?.barcode}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>S/N: {w.product_units?.serial_number}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{w.customers?.full_name || 'Customer'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.customers?.phone}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8125rem' }}>
                        {new Date(w.warranty_start_date).toLocaleDateString()} — {new Date(w.warranty_end_date).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.warranty_period_months} Months</div>
                    </td>
                    <td>
                      <span className={`badge ${w.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'uppercase' }}>
                        {w.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={page}
          pageSize={pageSize}
          totalRecords={totalCount}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </div>

      {/* Registration Modal */}
      {showRegModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Dealer TV Warranty Registration</h3>
              <button className="btn-icon" onClick={() => setShowRegModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRegisterWarranty}>
              <div className="modal-body">
                {/* Barcode Scanner Input */}
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Scan or Enter TV Barcode *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. ZUVO-554K-8921"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                    />
                    <button type="button" className="btn btn-secondary" onClick={handleVerifyBarcode} disabled={verifying || !barcodeInput.trim()}>
                      {verifying ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </div>

                {/* Verification result */}
                {verifiedProduct && (
                  <div className="card" style={{ padding: '0.875rem', marginBottom: '1.25rem', background: 'rgba(16, 185, 129, 0.05)', borderColor: 'var(--status-success)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <CheckCircle2 style={{ color: 'var(--status-success)' }} />
                    <div style={{ fontSize: '0.875rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--status-success)' }}>Product Verified Eligible for Warranty</div>
                      <div>{verifiedProduct.product_name} | Barcode: {verifiedProduct.barcode}</div>
                    </div>
                  </div>
                )}

                {/* Customer info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Customer Name *</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="Customer Full Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Customer Phone *</label>
                    <input
                      type="tel"
                      required
                      className="input-field"
                      placeholder="Phone Number"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Customer Email</label>
                    <input
                      type="email"
                      className="input-field"
                      placeholder="Email Address"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Coverage Period</label>
                    <input
                      type="text"
                      className="input-field"
                      value="12 Months (Standard Manufacturer Policy)"
                      disabled
                      style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Customer Address</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Full Address"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRegModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={registering || !verifiedProduct}>
                  {registering ? 'Activating Warranty...' : 'Activate Warranty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
