import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Search, Plus, X, Barcode, Calendar, AlertCircle, CheckCircle2, DollarSign, FileText } from 'lucide-react';
import { Pagination } from '../components/common/Pagination';
import { UnlinkedDealerAlert } from '../components/common/UnlinkedDealerAlert';

export const DealerWarrantyPage: React.FC = () => {
  const { profile } = useAuth();
  const dealerId = profile?.dealer_id;

  const [activeTab, setActiveTab] = useState<'warranties' | 'reimbursements'>('warranties');
  const [warranties, setWarranties] = useState<any[]>([]);
  const [reimbursements, setReimbursements] = useState<any[]>([]);
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

  // Phase 7.7 Reimbursement Claim Modal
  const [showReimbModal, setShowReimbModal] = useState(false);
  const [submittingReimb, setSubmittingReimb] = useState(false);
  const [reimbForm, setReimbForm] = useState({
    productUnitId: '',
    laborCost: 450,
    partsCost: 0,
    dealerNotes: ''
  });

  const fetchWarranties = async () => {
    if (!dealerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (activeTab === 'warranties') {
        let query = supabase
          .from('warranties')
          .select('*, customers(full_name, phone), product_units(id, barcode, serial_number, product_variants(product_name))', { count: 'exact' })
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
      } else {
        let query = (supabase as any)
          .from('dealer_reimbursement_claims')
          .select('*, product_units(barcode, serial_number, product_variants(product_name))', { count: 'exact' })
          .eq('dealer_id', dealerId)
          .order('created_at', { ascending: false });

        if (searchQuery.trim()) {
          const q = `%${searchQuery.trim()}%`;
          query = query.or(`reimbursement_number.ilike.${q}`);
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;

        setReimbursements(data || []);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Error fetching dealer data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarranties();
  }, [dealerId, searchQuery, page, pageSize, activeTab]);

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
            Verify TV barcodes, register new customer warranties, and submit labor/parts reimbursement claims
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'warranties' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('warranties'); setPage(1); }}
          >
            <ShieldCheck size={16} /> Registered Warranties
          </button>
          <button
            className={`btn ${activeTab === 'reimbursements' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('reimbursements'); setPage(1); }}
          >
            <DollarSign size={16} /> Reimbursement Claims
          </button>
          {activeTab === 'warranties' ? (
            <button className="btn btn-primary" onClick={() => setShowRegModal(true)}>
              <Plus size={16} /> Register Warranty
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setShowReimbModal(true)}>
              <Plus size={16} /> Submit Claim
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder={activeTab === 'warranties' ? "Search by Warranty Number..." : "Search by Claim Number..."}
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
      {activeTab === 'warranties' ? (
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
      ) : (
        /* PHASE 7.7: DEALER REIMBURSEMENTS TABLE */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Claim #</th>
                  <th>Product Unit</th>
                  <th>Labor Claimed</th>
                  <th>Parts Claimed</th>
                  <th>Total Claimed</th>
                  <th>Approved</th>
                  <th>Status</th>
                  <th>Credit Memo Ref</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                      <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                      <p className="text-muted">Loading dealer reimbursement claims...</p>
                    </td>
                  </tr>
                ) : reimbursements.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem' }}>
                      <DollarSign size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Reimbursement Claims</h3>
                      <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        Submit in-warranty service and replacement claims to receive credit memos credited to your ledger.
                      </p>
                    </td>
                  </tr>
                ) : (
                  reimbursements.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.reimbursement_number}</td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{r.product_units?.product_variants?.product_name || 'ZUVO TV'}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          BC: {r.product_units?.barcode}
                        </div>
                      </td>
                      <td>₹{r.labor_cost_claimed?.toLocaleString() || 0}</td>
                      <td>₹{r.parts_cost_claimed?.toLocaleString() || 0}</td>
                      <td style={{ fontWeight: 700 }}>₹{r.total_claimed?.toLocaleString() || 0}</td>
                      <td style={{ fontWeight: 700, color: r.approved_amount ? 'var(--status-success)' : 'inherit' }}>
                        {r.approved_amount !== null ? `₹${r.approved_amount?.toLocaleString()}` : '—'}
                      </td>
                      <td>
                        <span className={`badge ${
                          r.status === 'CREDITED' || r.status === 'APPROVED' ? 'badge-success' :
                          r.status === 'REJECTED' ? 'badge-danger' :
                          'badge-warning'
                        }`} style={{ textTransform: 'uppercase' }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--brand-primary)' }}>
                        {r.credit_memo_number || '—'}
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
      )}

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

      {/* PHASE 7.7: DEALER REIMBURSEMENT MODAL */}
      {showReimbModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={18} style={{ color: 'var(--brand-primary)' }} />
                <span>Submit Dealer In-Warranty Reimbursement</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowReimbModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!reimbForm.productUnitId) {
                alert('Please select a warranted product unit.');
                return;
              }
              setSubmittingReimb(true);
              try {
                const { data, error } = await (supabase.rpc as any)('fn_submit_dealer_reimbursement', {
                  p_dealer_id: dealerId,
                  p_product_unit_id: reimbForm.productUnitId,
                  p_labor_cost: parseFloat(reimbForm.laborCost as any) || 0,
                  p_parts_cost: parseFloat(reimbForm.partsCost as any) || 0,
                  p_dealer_notes: reimbForm.dealerNotes || null
                });

                if (error) throw error;
                const res = data as any;
                if (res && res.success === false) {
                  throw new Error(res.error || 'Reimbursement submission failed.');
                }

                alert(`Reimbursement claim ${res?.reimbursement_number} submitted successfully! Awaiting central credit memo audit.`);
                setShowReimbModal(false);
                setReimbForm({
                  productUnitId: '',
                  laborCost: 450,
                  partsCost: 0,
                  dealerNotes: ''
                });
                fetchWarranties();
              } catch (err: any) {
                alert(`Submission error: ${err.message}`);
              } finally {
                setSubmittingReimb(false);
              }
            }}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Select Serviced / Replaced Product Unit *</label>
                  <select
                    required
                    className="input-field"
                    value={reimbForm.productUnitId}
                    onChange={(e) => setReimbForm({ ...reimbForm, productUnitId: e.target.value })}
                  >
                    <option value="">-- Choose Unit Under Warranty --</option>
                    {warranties.map((w) => (
                      <option key={w.product_units?.id || w.id} value={w.product_units?.id || w.product_unit_id}>
                        {w.product_units?.product_variants?.product_name || 'ZUVO TV'} — Barcode: {w.product_units?.barcode} (Policy #{w.warranty_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Labor Allowance Claimed (₹) *</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field"
                      value={reimbForm.laborCost}
                      onChange={(e) => setReimbForm({ ...reimbForm, laborCost: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Spare Parts Cost Claimed (₹) *</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field"
                      value={reimbForm.partsCost}
                      onChange={(e) => setReimbForm({ ...reimbForm, partsCost: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Reimbursement Claim:</span>
                  <span style={{ color: 'var(--brand-primary)', fontSize: '1rem' }}>
                    ₹{((parseFloat(reimbForm.laborCost as any) || 0) + (parseFloat(reimbForm.partsCost as any) || 0)).toLocaleString()}
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Technical Justification & Notes</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="e.g. In-store replacement of backlight strip and power regulator board on customer TV"
                    value={reimbForm.dealerNotes}
                    onChange={(e) => setReimbForm({ ...reimbForm, dealerNotes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReimbModal(false)} disabled={submittingReimb}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingReimb || !reimbForm.productUnitId}>
                  {submittingReimb ? 'Submitting Claim...' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
