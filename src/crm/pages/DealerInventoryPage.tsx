import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import { Package, Search, Filter, AlertCircle, Barcode, Tv, CheckCircle2, AlertTriangle, Clock, ShieldAlert, ArrowRight, X, FileText } from 'lucide-react';
import { Pagination } from '../components/common/Pagination';
import { UnlinkedDealerAlert } from '../components/common/UnlinkedDealerAlert';
import { DealerCreditMemoModal, CreditMemoData } from '../components/common/DealerCreditMemoModal';

export const DealerInventoryPage: React.FC = () => {
  const { profile } = useAuth();
  const dealerId = profile?.dealer_id;

  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCreditMemo, setSelectedCreditMemo] = useState<CreditMemoData | null>(null);
  const [isCreditMemoOpen, setIsCreditMemoOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownershipFilter, setOwnershipFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    dispatched: 0,
    available: 0,
    sold: 0,
    disputed: 0
  });

  // Pending Receipt Action Modal State
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [selectedConsignmentId, setSelectedConsignmentId] = useState<string | null>(null);
  const [discrepancyReason, setDiscrepancyReason] = useState('damaged_unit');
  const [discrepancyNotes, setDiscrepancyNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchInventory = async () => {
    if (!dealerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('vw_dealer_consignment_inventory' as any)
        .select('*', { count: 'exact' })
        .eq('dealer_id', dealerId)
        .order('dispatched_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('consignment_status', statusFilter);
      }

      if (ownershipFilter !== 'all') {
        query = query.eq('ownership_type', ownershipFilter);
      }

      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`barcode.ilike.${q},serial_number.ilike.${q},model_name.ilike.${q}`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setInventory(data || []);
      setTotalCount(count || 0);

      // Fetch summary stats
      const { data: summaryData }: any = await supabase
        .from('vw_dealer_consignment_summary' as any)
        .select('*')
        .eq('dealer_id', dealerId)
        .maybeSingle();

      if (summaryData) {
        setStats({
          total: Number(summaryData.total_consignment_units || 0),
          dispatched: Number(summaryData.dispatched_units || 0),
          available: Number(summaryData.available_units || 0),
          sold: Number(summaryData.sold_units || 0),
          disputed: Number(summaryData.disputed_units || 0)
        });
      }
    } catch (err) {
      console.error('Error fetching dealer consignment inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [dealerId, searchQuery, statusFilter, ownershipFilter, page, pageSize]);

  const handleAcknowledgeReceipt = async (consignmentId: string, action: 'accept' | 'discrepancy') => {
    if (action === 'discrepancy') {
      setSelectedConsignmentId(consignmentId);
      setDiscrepancyReason('damaged_unit');
      setDiscrepancyNotes('');
      setShowDiscrepancyModal(true);
      return;
    }

    if (!confirm('Confirm receipt of this TV product unit into your consignment stock?')) return;

    setSubmittingAction(true);
    try {
      const { data, error } = await supabase.rpc('fn_dealer_acknowledge_consignment_receipt', {
        p_consignment_id: consignmentId,
        p_action: 'accept',
        p_notes: 'Acknowledged by dealer'
      });

      if (error) throw error;
      alert('Shipment accepted into available consignment inventory!');
      fetchInventory();
    } catch (err: any) {
      alert(`Receipt acknowledgment failed: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSubmitDiscrepancy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConsignmentId) return;

    setSubmittingAction(true);
    try {
      const { error } = await supabase.rpc('fn_dealer_acknowledge_consignment_receipt', {
        p_consignment_id: selectedConsignmentId,
        p_action: 'discrepancy',
        p_discrepancy_reason: discrepancyReason,
        p_notes: discrepancyNotes.trim() || 'Discrepancy reported during receipt audit'
      });

      if (error) throw error;

      alert('Discrepancy reported to ZUVO support team. Stock status updated to Disputed.');
      setShowDiscrepancyModal(false);
      fetchInventory();
    } catch (err: any) {
      alert(`Failed to report discrepancy: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  const getAgingBadge = (days: number) => {
    if (days <= 30) return <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>0–30 Days</span>;
    if (days <= 60) return <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>31–60 Days</span>;
    if (days <= 90) return <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>61–90 Days</span>;
    return <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>{days}+ Days (Aging)</span>;
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
            <Package style={{ color: 'var(--brand-primary)' }} /> Dealer Consignment Inventory
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Manage ZUVO-owned consignment stock, confirm pending receipts, report discrepancies, and track sales status
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid-4" style={{ marginBottom: '1.5rem', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--brand-primary)' }}>
          <div className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Consignment Stock</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem' }}>{stats.total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ZUVO-owned physically at store</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
          <div className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Pending Receipts</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem', color: '#2563eb' }}>{stats.dispatched}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In-transit from ZUVO Warehouse</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <div className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Available for Sale</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem', color: '#059669' }}>{stats.available}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ready for customer billing</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
          <div className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Disputed / Issues</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem', color: '#dc2626' }}>{stats.disputed}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Under inspection / discrepancy</div>
        </div>
      </div>

      {/* Pending Dispatches Alert Banner if any */}
      {stats.dispatched > 0 && (
        <div className="card" style={{ background: 'rgba(59, 130, 246, 0.08)', borderColor: '#3b82f6', marginBottom: '1.5rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Clock style={{ color: '#2563eb' }} size={24} />
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0, fontWeight: 600, color: '#1d4ed8' }}>
                You have {stats.dispatched} pending consignment unit(s) awaiting receipt confirmation
              </h4>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Inspect dispatched TV units upon arrival and accept or report discrepancies promptly.
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                setStatusFilter('dispatched');
                setPage(1);
              }}
              style={{ fontSize: '0.875rem' }}
            >
              View Pending Shipments <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search by Barcode, Serial, or Model Name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <select
            className="input-field"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{ width: '190px' }}
          >
            <option value="all">All Consignment Statuses</option>
            <option value="dispatched">Dispatched (Pending)</option>
            <option value="available">Available for Sale</option>
            <option value="sold">Sold</option>
            <option value="disputed">Disputed / Discrepancy</option>
            <option value="recalled">Recalled</option>
          </select>
          <select
            className="input-field"
            value={ownershipFilter}
            onChange={(e) => {
              setOwnershipFilter(e.target.value);
              setPage(1);
            }}
            style={{ width: '180px' }}
          >
            <option value="all">All Ownership Types</option>
            <option value="zuvo_owned">ZUVO Owned</option>
            <option value="customer_owned">Customer Owned</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>TV Model & Variant</th>
                <th>Barcode</th>
                <th>Serial Number</th>
                <th>Ownership</th>
                <th>Consignment Status</th>
                <th>Dispatched / Received</th>
                <th>Days at Store</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                    <p className="text-muted">Loading consignment stock...</p>
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <Package size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Consignment Stock Found</h3>
                    <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      {searchQuery || statusFilter !== 'all' ? 'No stock items match your filter criteria' : 'No inventory units have been dispatched to your dealer account yet'}
                    </p>
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item.consignment_id}>
                    <td>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Tv size={16} style={{ color: 'var(--brand-primary)' }} />
                        {item.model_name || 'ZUVO TV'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.screen_size}" {item.tv_type} | Code: {item.product_code}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Barcode size={12} /> {item.barcode}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{item.serial_number}</span>
                    </td>
                    <td>
                      <span className={`badge ${
                        item.ownership_type === 'zuvo_owned' ? 'badge-primary' :
                        item.ownership_type === 'customer_owned' ? 'badge-success' : 'badge-neutral'
                      }`} style={{ fontSize: '0.75rem' }}>
                        {item.ownership_type === 'zuvo_owned' ? 'ZUVO Owned (Consignment)' : 'Customer Owned'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        item.consignment_status === 'available' || item.consignment_status === 'received' ? 'badge-success' :
                        item.consignment_status === 'dispatched' ? 'badge-info' :
                        item.consignment_status === 'sold' ? 'badge-primary' :
                        item.consignment_status === 'disputed' ? 'badge-danger' :
                        item.consignment_status === 'recalled' || item.consignment_status === 'returned' ? 'badge-warning' : 'badge-neutral'
                      }`} style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                        {item.consignment_status === 'dispatched' ? 'In-Transit / Dispatched' : item.consignment_status}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.875rem' }}>
                        {item.received_at ? new Date(item.received_at).toLocaleDateString() : new Date(item.dispatched_at).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        From: {item.from_warehouse_name || 'Central Hub'}
                      </div>
                    </td>
                    <td>
                      {getAgingBadge(item.days_at_dealer || 0)}
                    </td>
                    <td>
                      {item.consignment_status === 'dispatched' ? (
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleAcknowledgeReceipt(item.consignment_id, 'accept')}
                            disabled={submittingAction}
                            title="Confirm Accept Receipt"
                          >
                            <CheckCircle2 size={13} /> Accept
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleAcknowledgeReceipt(item.consignment_id, 'discrepancy')}
                            disabled={submittingAction}
                            title="Report Discrepancy"
                          >
                            <AlertTriangle size={13} /> Discrepancy
                          </button>
                        </div>
                      ) : item.consignment_status === 'disputed' ? (
                        <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <ShieldAlert size={14} /> Reported: {item.discrepancy_reason?.replace('_', ' ')}
                        </span>
                      ) : item.consignment_status === 'returned' ? (
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => {
                            setSelectedCreditMemo({
                              creditMemoNumber: `CR-MEMO-${item.consignment_id?.substring(0, 8)?.toUpperCase() || 'RESTOCK'}`,
                              creditDate: item.dispatched_at || new Date().toISOString(),
                              dealerName: profile?.full_name || 'Authorized Dealer',
                              dealerCode: profile?.dealer_id?.substring(0, 8),
                              warehouseName: 'Central Depot Warehouse',
                              productBarcode: item.barcode || 'N/A',
                              productSerial: item.serial_number || 'N/A',
                              modelName: item.model_name || 'ZUVO 4K Smart TV',
                              wholesalePrice: Number(item.selling_price || 16500) * 0.82,
                              taxAmount: Number(item.selling_price || 16500) * 0.18,
                              totalCreditAmount: Number(item.selling_price || 16500),
                              reason: 'Restocked to Central Depot via Consignment Return',
                              status: 'CREDITED'
                            });
                            setIsCreditMemoOpen(true);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}
                        >
                          <FileText size={13} /> Credit Memo
                        </button>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.875rem' }}>Verified</span>
                      )}
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

      {/* Discrepancy Reporting Modal */}
      {showDiscrepancyModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <h3 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
                <AlertTriangle size={20} /> Report Consignment Discrepancy
              </h3>
              <button className="btn-icon" onClick={() => setShowDiscrepancyModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitDiscrepancy}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label-sm">Discrepancy Type *</label>
                <select
                  className="input-field"
                  value={discrepancyReason}
                  onChange={(e) => setDiscrepancyReason(e.target.value)}
                  required
                >
                  <option value="damaged_unit">Damaged TV / Broken Box</option>
                  <option value="missing_unit">Missing Unit / Package Shortage</option>
                  <option value="incorrect_unit">Incorrect TV Model Received</option>
                  <option value="barcode_mismatch">Barcode / Serial Mismatch</option>
                  <option value="quantity_mismatch">Quantity Mismatch</option>
                  <option value="other">Other Discrepancy</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="label-sm">Discrepancy Details & Inspection Notes *</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="Describe physical condition, barcode variance, or box damage..."
                  value={discrepancyNotes}
                  onChange={(e) => setDiscrepancyNotes(e.target.value)}
                  required
                />
              </div>

              <div className="flex-between" style={{ gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDiscrepancyModal(false)}
                  disabled={submittingAction}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={submittingAction}
                >
                  {submittingAction ? 'Submitting Discrepancy...' : 'Submit Discrepancy Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dealer Consignment Credit Memo Printable Modal */}
      <DealerCreditMemoModal
        isOpen={isCreditMemoOpen}
        onClose={() => setIsCreditMemoOpen(false)}
        memo={selectedCreditMemo}
      />
    </div>
  );
};
