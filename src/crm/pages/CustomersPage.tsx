import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Tv,
  ShieldCheck,
  Wrench,
  AlertCircle,
  ExternalLink,
  X,
  CreditCard,
  Download,
  FileSpreadsheet,
  Send,
  MessageSquare
} from 'lucide-react';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';
import { Pagination } from '../components/common/Pagination';
import { SendCustomerMessageModal } from '../components/customers/SendCustomerMessageModal';

interface Customer {
  id: string;
  customer_code: string;
  full_name: string;
  phone: string;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  is_active: boolean;
  created_at: string;
}

interface CustomerHistory {
  sales: any[];
  warranties: any[];
  tickets: any[];
  commLogs: any[];
}

export const CustomersPage: React.FC = () => {
  const { currentRole, isAllowed } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [sendMessageCustomer, setSendMessageCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<CustomerHistory>({ sales: [], warranties: [], tickets: [], commLogs: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [exporting, setExporting] = useState(false);

  // New Customer Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formPincode, setFormPincode] = useState('');

  const fetchCustomers = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`full_name.ilike.${q},phone.ilike.${q},customer_code.ilike.${q},email.ilike.${q}`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      setCustomers((data as Customer[]) || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      setErrorMsg(err.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchQuery, page, pageSize]);

  const fetchCustomerHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingHistory(true);
    try {
      const [salesRes, warrantyRes, ticketRes, commRes] = await Promise.all([
        supabase
          .from('sales')
          .select(`
            *,
            sale_items:sale_items (
              *,
              product_units:product_unit_id (
                barcode,
                serial_number,
                product_variants:product_variant_id (product_name)
              )
            )
          `)
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('warranties')
          .select(`
            *,
            product_units:product_unit_id (
              barcode,
              serial_number,
              product_variants:product_variant_id (product_name)
            )
          `)
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('service_tickets')
          .select('*')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('communication_logs')
          .select('*')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false })
      ]);

      setHistory({
        sales: salesRes.data || [],
        warranties: warrantyRes.data || [],
        tickets: ticketRes.data || [],
        commLogs: commRes.data || []
      });
    } catch (err) {
      console.error('Error fetching customer history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      let query = supabase.from('customers').select('*').order('created_at', { ascending: false });
      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`full_name.ilike.${q},phone.ilike.${q},customer_code.ilike.${q},email.ilike.${q}`);
      }
      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []).map((c: any) => ({
        customer_code: c.customer_code,
        full_name: c.full_name,
        phone: c.phone,
        email: c.email || '',
        address_line1: c.address_line1 || '',
        city: c.city || '',
        state: c.state || '',
        postal_code: c.postal_code || '',
        is_active: c.is_active ? 'Active' : 'Inactive',
        created_at: new Date(c.created_at).toLocaleDateString()
      }));

      const headers = [
        { key: 'customer_code', label: 'Customer Code' },
        { key: 'full_name', label: 'Full Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'address_line1', label: 'Address' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'postal_code', label: 'Postal Code' },
        { key: 'is_active', label: 'Status' },
        { key: 'created_at', label: 'Registered Date' }
      ];

      const filename = `zuvo_customers_${new Date().toISOString().slice(0, 10)}`;
      if (format === 'csv') {
        exportToCSV(rows, headers, filename);
      } else {
        await exportToExcel(rows, headers, filename, 'Customers');
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCustomer(true);
    try {
      const generatedCode = `CUST-${Date.now().toString().slice(-6)}`;
      const { error } = await supabase
        .from('customers')
        .insert({
          customer_code: generatedCode,
          full_name: formName.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim() || null,
          address_line1: formAddress.trim() || null,
          city: formCity.trim() || null,
          state: formState.trim() || null,
          postal_code: formPincode.trim() || null,
          is_active: true
        });

      if (error) throw error;

      setShowAddModal(false);
      setFormName('');
      setFormPhone('');
      setFormEmail('');
      setFormAddress('');
      setFormCity('');
      setFormState('');
      setFormPincode('');
      fetchCustomers();
    } catch (err: any) {
      alert(`Failed to create customer: ${err.message}`);
    } finally {
      setSavingCustomer(false);
    }
  };

  const canEdit = ['super_admin', 'admin', 'sales'].includes(currentRole);
  const canSendMsg = isAllowed(['super_admin', 'admin', 'sales', 'service', 'support']);

  return (
    <div className="module-container">
      {/* Top Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users style={{ color: 'var(--brand-primary)' }} /> Customer Management
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Customer directory, sales association, purchased units, service & messaging history
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleExport('xlsx')}
            disabled={exporting || loading}
          >
            <FileSpreadsheet size={15} /> Export Excel
          </button>
          {canEdit && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> Register Customer
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
            placeholder="Search by name, phone number, customer code, or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="card" style={{ borderColor: 'var(--status-danger)', background: 'rgba(239, 68, 68, 0.05)', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <AlertCircle style={{ color: 'var(--status-danger)' }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--status-danger)' }}>Error loading customers</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{errorMsg}</div>
          </div>
        </div>
      )}

      {/* Customer List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Code</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Location</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                    <p className="text-muted" style={{ fontSize: '0.875rem' }}>Loading customer directory...</p>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                    <Users size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', opacity: 0.5 }} />
                    <p style={{ fontWeight: 600 }}>No customers found</p>
                    <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                      {searchQuery ? 'Try a different search query' : 'Register your first customer to get started'}
                    </p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {c.customer_code}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                        <Phone size={13} style={{ color: 'var(--brand-primary)' }} /> {c.phone}
                      </span>
                    </td>
                    <td>
                      {c.email ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                          <Mail size={13} style={{ color: 'var(--text-muted)' }} /> {c.email}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {c.city || c.state ? (
                        <span style={{ fontSize: '0.875rem' }}>
                          {[c.city, c.state].filter(Boolean).join(', ')}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${c.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => fetchCustomerHistory(c)}
                          title="View complete CRM history"
                        >
                          <ExternalLink size={14} /> CRM 360°
                        </button>
                        {canSendMsg && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setSendMessageCustomer(c)}
                            title="Send WhatsApp / SMS / Email Message"
                          >
                            <Send size={13} /> Message
                          </button>
                        )}
                      </div>
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

      {/* Customer 360° Modal / Drawer */}
      {selectedCustomer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={20} style={{ color: 'var(--brand-primary)' }} />
                  {selectedCustomer.full_name}
                  <span className="badge badge-primary">{selectedCustomer.customer_code}</span>
                </h3>
                <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                  Full unified CRM view: Contact, TV Purchases, Warranties, Service & Messaging History
                </p>
              </div>
              <button className="btn-icon" onClick={() => setSelectedCustomer(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Contact info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Phone</div>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                    <Phone size={14} style={{ color: 'var(--brand-primary)' }} /> {selectedCustomer.phone}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email</div>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                    <Mail size={14} style={{ color: 'var(--text-muted)' }} /> {selectedCustomer.email || 'None registered'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Address</div>
                  <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem', fontSize: '0.875rem' }}>
                    <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                    {[selectedCustomer.address_line1, selectedCustomer.city, selectedCustomer.state, selectedCustomer.postal_code].filter(Boolean).join(', ') || 'No address'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer Since</div>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                    <Calendar size={14} style={{ color: 'var(--text-muted)' }} /> {new Date(selectedCustomer.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="animate-spin" style={{ width: 28, height: 28, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 0.5rem' }} />
                  <p className="text-muted" style={{ fontSize: '0.875rem' }}>Loading purchase, service and communication history...</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Sales & Purchased TVs */}
                  <div>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <Tv size={16} style={{ color: 'var(--brand-primary)' }} /> Purchased TVs & Sales ({history.sales.length})
                    </h4>
                    {history.sales.length === 0 ? (
                      <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'var(--bg-primary)' }}>
                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>No sales recorded yet for this customer.</p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="data-table" style={{ fontSize: '0.875rem' }}>
                          <thead>
                            <tr>
                              <th>Invoice / Sale #</th>
                              <th>Date</th>
                              <th>Amount</th>
                              <th>Payment Status</th>
                              <th>TV Variant / Barcode</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.sales.map((sale) => (
                              <tr key={sale.id}>
                                <td style={{ fontWeight: 600 }}>{sale.sale_number}</td>
                                <td>{new Date(sale.sale_date).toLocaleDateString()}</td>
                                <td>₹{sale.total_amount?.toLocaleString()}</td>
                                <td>
                                  <span className={`badge ${sale.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                                    {sale.payment_status}
                                  </span>
                                </td>
                                <td>
                                  {sale.sale_items?.map((item: any) => (
                                    <div key={item.id} style={{ fontSize: '0.8125rem' }}>
                                      {item.product_units?.product_variants?.product_name || 'TV Unit'}
                                      <span className="badge badge-neutral" style={{ marginLeft: '0.35rem', fontFamily: 'monospace' }}>
                                        {item.product_units?.barcode}
                                      </span>
                                    </div>
                                  ))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Active Warranties */}
                  <div>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <ShieldCheck size={16} style={{ color: 'var(--status-success)' }} /> Registered Warranties ({history.warranties.length})
                    </h4>
                    {history.warranties.length === 0 ? (
                      <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'var(--bg-primary)' }}>
                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>No warranty registrations on file.</p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="data-table" style={{ fontSize: '0.875rem' }}>
                          <thead>
                            <tr>
                              <th>Warranty #</th>
                              <th>Product</th>
                              <th>Serial #</th>
                              <th>Start Date</th>
                              <th>End Date</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.warranties.map((w) => (
                              <tr key={w.id}>
                                <td style={{ fontWeight: 600 }}>{w.warranty_number}</td>
                                <td>{w.product_units?.product_variants?.product_name || 'ZUVO TV'}</td>
                                <td style={{ fontFamily: 'monospace' }}>{w.product_units?.serial_number}</td>
                                <td>{w.warranty_start_date}</td>
                                <td>{w.warranty_end_date}</td>
                                <td>
                                  <span className={`badge ${w.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                                    {w.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Service Tickets */}
                  <div>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <Wrench size={16} style={{ color: 'var(--brand-accent)' }} /> Service History ({history.tickets.length})
                    </h4>
                    {history.tickets.length === 0 ? (
                      <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'var(--bg-primary)' }}>
                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>No service tickets registered.</p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="data-table" style={{ fontSize: '0.875rem' }}>
                          <thead>
                            <tr>
                              <th>Ticket #</th>
                              <th>Issue Description</th>
                              <th>Priority</th>
                              <th>Status</th>
                              <th>Opened</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.tickets.map((t) => (
                              <tr key={t.id}>
                                <td style={{ fontWeight: 600 }}>{t.ticket_number}</td>
                                <td>{t.issue_description}</td>
                                <td>
                                  <span className={`badge ${t.priority === 'urgent' ? 'badge-danger' : t.priority === 'high' ? 'badge-warning' : 'badge-neutral'}`}>
                                    {t.priority}
                                  </span>
                                </td>
                                <td>
                                  <span className="badge badge-info">{t.status}</span>
                                </td>
                                <td>{new Date(t.opened_at).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Communication History & Messaging */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                        <MessageSquare size={16} style={{ color: 'var(--accent-cyan)' }} /> Communication History ({history.commLogs.length})
                      </h4>
                      {canSendMsg && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setSendMessageCustomer(selectedCustomer)}
                        >
                          <Send size={13} /> Send Message
                        </button>
                      )}
                    </div>
                    {history.commLogs.length === 0 ? (
                      <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'var(--bg-primary)' }}>
                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>No message dispatches logged for this customer.</p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="data-table" style={{ fontSize: '0.875rem' }}>
                          <thead>
                            <tr>
                              <th>Channel</th>
                              <th>Recipient</th>
                              <th>Event / Type</th>
                              <th>Message Body</th>
                              <th>Status</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.commLogs.map((log) => (
                              <tr key={log.id}>
                                <td style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: '0.75rem' }}>{log.channel}</td>
                                <td>{log.recipient}</td>
                                <td><span className="badge badge-neutral">{log.message_type}</span></td>
                                <td style={{ maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.message_body}</td>
                                <td>
                                  <span className={`badge ${log.status === 'sent' || log.status === 'delivered' ? 'badge-success' : 'badge-warning'}`}>
                                    {log.status === 'sent' ? 'SENT (SIMULATED)' : log.status.toUpperCase()}
                                  </span>
                                </td>
                                <td>{new Date(log.created_at).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedCustomer(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Message Modal */}
      {sendMessageCustomer && (
        <SendCustomerMessageModal
          isOpen={!!sendMessageCustomer}
          onClose={() => setSendMessageCustomer(null)}
          customer={sendMessageCustomer}
          onSuccess={() => {
            if (selectedCustomer) {
              fetchCustomerHistory(selectedCustomer);
            }
          }}
        />
      )}

      {/* New Customer Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Register New Customer</h3>
              <button className="btn-icon" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. Rahul Sharma"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      className="input-field"
                      placeholder="e.g. +91 9876543210"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="input-field"
                      placeholder="e.g. rahul@example.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Address Line 1</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. House No. 42, Green Park"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. New Delhi"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Delhi"
                      value={formState}
                      onChange={(e) => setFormState(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PIN Code</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 110016"
                      value={formPincode}
                      onChange={(e) => setFormPincode(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingCustomer}>
                  {savingCustomer ? 'Registering...' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
