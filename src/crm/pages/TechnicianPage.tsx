import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Wrench,
  Search,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  User,
  Tv,
  Barcode,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Play,
  Navigation,
  CheckSquare,
  FileText,
  Package,
  Plus,
  Send,
  Camera,
  X,
  RefreshCw,
  Award,
  DollarSign,
  Wifi,
  WifiOff
} from 'lucide-react';
import { BarcodeLookupModal } from '../components/common/BarcodeLookupModal';
import { technicianOfflineService } from '../lib/technicianOfflineService';

export const TechnicianPage: React.FC = () => {
  const { user, profile, currentRole } = useAuth();
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'in_progress' | 'completed' | 'all'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected visit for detail/actions
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);

  // Modals state
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [showPartsModal, setShowPartsModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showBarcodeLookup, setShowBarcodeLookup] = useState(false);

  // Form states
  const [diagnosisForm, setDiagnosisForm] = useState({
    faultCategory: 'Display / Panel',
    rootCause: '',
    findings: '',
    actionTaken: '',
    technicianNotes: ''
  });

  // Spare parts state
  const [sparePartsList, setSparePartsList] = useState<any[]>([]);
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [partForm, setPartForm] = useState({
    sparePartId: '',
    warehouseId: '',
    quantity: 1,
    warrantyCovered: true
  });
  const [submittingPart, setSubmittingPart] = useState(false);

  // OTP state
  const [simulatedOtp, setSimulatedOtp] = useState<string | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // General action loading
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch technician visits
  const fetchVisits = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // If super_admin/admin/service, fetch all or filtered visits. If technician, fetch assigned visits.
      let query = supabase
        .from('service_visits')
        .select(`
          *,
          service_tickets!inner (
            id,
            ticket_number,
            service_type,
            priority,
            status,
            issue_category,
            issue_description,
            opened_at,
            customers!inner (
              id,
              customer_code,
              full_name,
              phone,
              address_line1,
              address_line2,
              city,
              state,
              postal_code
            ),
            product_units!inner (
              id,
              serial_number,
              barcode,
              status,
              product_variants!inner (
                product_name,
                product_code,
                tv_type,
                screen_size
              )
            ),
            warranties (
              id,
              warranty_card_number,
              start_date,
              end_date,
              status
            )
          ),
          technician_profile:profiles!service_visits_technician_id_fkey (
            id,
            full_name,
            phone,
            employee_code
          )
        `)
        .order('scheduled_at', { ascending: true });

      // Filter by technician if role is technician or not admin
      if (currentRole === 'technician' && user?.id) {
        query = query.eq('technician_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      const fetched = data || [];
      setVisits(fetched);
      technicianOfflineService.cacheVisits(fetched);
    } catch (err: any) {
      console.warn('Network issue fetching technician visits, attempting local cache fallback:', err);
      const cached = technicianOfflineService.getCachedVisits();
      if (cached.length > 0) {
        setVisits(cached);
        setErrorMsg('Operating in offline mode. Displaying locally cached visits.');
      } else {
        setErrorMsg(err.message || 'Failed to load technician visits.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Sync pending offline queue when online
  useEffect(() => {
    const handleOnline = async () => {
      const queue = technicianOfflineService.getQueue();
      if (queue.length > 0) {
        setSuccessMsg(`Connection restored. Synchronizing ${queue.length} pending status update(s)...`);
        const { succeeded, failed } = await technicianOfflineService.processQueue(async (item) => {
          const { error } = await supabase.rpc('fn_update_visit_status', {
            p_visit_id: item.visitId,
            p_new_status: item.toStatus,
            p_technician_notes: item.technicianNotes,
            p_updated_by: user?.id || null
          });
          return { success: !error, error: error?.message };
        });
        if (succeeded > 0) {
          setSuccessMsg(`Successfully synchronized ${succeeded} offline update(s).`);
          fetchVisits();
        }
        if (failed > 0) {
          setErrorMsg(`${failed} offline update(s) could not be synchronized.`);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user]);

  // Fetch spare parts & warehouses for parts usage
  const fetchPartsDependencies = async () => {
    try {
      const [partsRes, whRes] = await Promise.all([
        supabase.from('spare_parts').select('id, part_name, part_code, selling_price, standard_cost').eq('is_active', true),
        supabase.from('warehouses').select('id, warehouse_name, warehouse_code').eq('is_active', true)
      ]);
      setSparePartsList(partsRes.data || []);
      setWarehousesList(whRes.data || []);
      if (whRes.data && whRes.data.length > 0) {
        setPartForm(prev => ({ ...prev, warehouseId: whRes.data[0].id }));
      }
    } catch (err) {
      console.error('Error fetching parts dependencies:', err);
    }
  };

  useEffect(() => {
    fetchVisits();
    fetchPartsDependencies();
  }, [user, currentRole]);

  // Status transitions with offline resiliency
  const handleUpdateStatus = async (visitId: string, newStatus: string, notes?: string) => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // If client is offline, queue transition locally
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      technicianOfflineService.enqueueTransition(
        visitId,
        selectedVisit?.service_ticket_id || '',
        selectedVisit?.status || '',
        newStatus,
        notes || 'Offline mobile status update'
      );
      setSuccessMsg(`Status queued offline: ${newStatus.replace('_', ' ').toUpperCase()}. Will sync automatically upon reconnection.`);
      setVisits(technicianOfflineService.getCachedVisits());
      if (selectedVisit && selectedVisit.id === visitId) {
        setSelectedVisit((prev: any) => ({ ...prev, status: newStatus }));
      }
      setActionLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('fn_update_visit_status', {
        p_visit_id: visitId,
        p_new_status: newStatus,
        p_technician_notes: notes || 'Status updated via Mobile Technician Portal',
        p_updated_by: user?.id || null
      });

      if (error) {
        // If error is network-related, fall back to queue
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          technicianOfflineService.enqueueTransition(
            visitId,
            selectedVisit?.service_ticket_id || '',
            selectedVisit?.status || '',
            newStatus,
            notes || 'Offline mobile status update'
          );
          setSuccessMsg(`Network drop detected. Status queued locally: ${newStatus.replace('_', ' ').toUpperCase()}`);
          setVisits(technicianOfflineService.getCachedVisits());
          return;
        }
        throw error;
      }

      setSuccessMsg(`Visit status updated to ${newStatus.replace('_', ' ').toUpperCase()}`);
      fetchVisits();
      if (selectedVisit && selectedVisit.id === visitId) {
        setSelectedVisit((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update visit status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Diagnosis submission
  const handleSaveDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.from('service_diagnosis').insert({
        service_ticket_id: selectedVisit.service_ticket_id,
        diagnosis: diagnosisForm.faultCategory + ': ' + diagnosisForm.findings,
        fault_found: diagnosisForm.faultCategory,
        action_taken: diagnosisForm.actionTaken,
        technician_notes: diagnosisForm.technicianNotes,
        diagnosed_by: user?.id || null,
        diagnosed_at: new Date().toISOString()
      });

      if (error) throw error;

      setSuccessMsg('Service diagnosis recorded successfully.');
      setShowDiagnosisModal(false);
      fetchVisits();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save service diagnosis.');
    } finally {
      setActionLoading(false);
    }
  };

  // Part Usage Submission
  const handleUsePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit || !partForm.sparePartId || !partForm.warehouseId) {
      setErrorMsg('Please select a spare part and warehouse.');
      return;
    }

    setSubmittingPart(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { data, error } = await supabase.rpc('fn_request_service_part_usage', {
        p_ticket_id: selectedVisit.service_ticket_id,
        p_spare_part_id: partForm.sparePartId,
        p_warehouse_id: partForm.warehouseId,
        p_quantity: Number(partForm.quantity),
        p_warranty_covered: partForm.warrantyCovered,
        p_performed_by: user?.id || null
      });

      if (error) throw error;

      setSuccessMsg('Spare part logged & stock deducted successfully!');
      setShowPartsModal(false);
      setPartForm(prev => ({ ...prev, sparePartId: '', quantity: 1 }));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record spare part usage.');
    } finally {
      setSubmittingPart(false);
    }
  };

  // Generate OTP
  const handleRequestOtp = async () => {
    if (!selectedVisit) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.rpc('fn_generate_visit_otp', {
        p_visit_id: selectedVisit.id
      });

      if (error) throw error;

      const resObj = data as any;
      setSimulatedOtp(resObj?.otp_simulated || '');
      setShowOtpModal(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate customer confirmation OTP.');
    } finally {
      setActionLoading(false);
    }
  };

  // Verify OTP and Complete
  const handleVerifyOtpAndComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit || !enteredOtp) return;
    setVerifyingOtp(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.rpc('fn_verify_visit_otp_and_complete', {
        p_visit_id: selectedVisit.id,
        p_entered_otp: enteredOtp,
        p_technician_id: user?.id || null
      });

      if (error) throw error;

      const visitRes = data as any;
      if (visitRes && visitRes.status !== 'completed') {
        if (visitRes.otp_attempts >= 5) {
          throw new Error('Maximum verification attempts exceeded (5). Please generate a new OTP.');
        }
        throw new Error(`Customer confirmation failed. Invalid OTP. (Attempt ${visitRes.otp_attempts || 1}/5)`);
      }

      setSuccessMsg('Service completed & Customer confirmation verified successfully!');
      setShowOtpModal(false);
      setEnteredOtp('');
      setSelectedVisit(null);
      fetchVisits();
    } catch (err: any) {
      setErrorMsg(err.message || 'Customer confirmation failed. Invalid OTP.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Filter visits
  const filteredVisits = visits.filter(v => {
    // Tab filter
    if (activeTab === 'upcoming' && !['scheduled', 'assigned', 'en_route'].includes(v.status)) return false;
    if (activeTab === 'in_progress' && !['arrived', 'in_progress'].includes(v.status)) return false;
    if (activeTab === 'completed' && !['completed', 'closed'].includes(v.status)) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const ticket = v.service_tickets;
      const cust = ticket?.customers;
      const unit = ticket?.product_units;

      const matchTicket = ticket?.ticket_number?.toLowerCase().includes(q);
      const matchCust = cust?.full_name?.toLowerCase().includes(q) || cust?.phone?.includes(q);
      const matchBarcode = unit?.barcode?.toLowerCase().includes(q);
      const matchSerial = unit?.serial_number?.toLowerCase().includes(q);

      return matchTicket || matchCust || matchBarcode || matchSerial;
    }

    return true;
  });

  // Calculate statistics
  const upcomingCount = visits.filter(v => ['scheduled', 'assigned', 'en_route'].includes(v.status)).length;
  const inProgressCount = visits.filter(v => ['arrived', 'in_progress'].includes(v.status)).length;
  const completedCount = visits.filter(v => ['completed', 'closed'].includes(v.status)).length;

  return (
    <div className="technician-view">
      {/* Top Mobile Bar Header */}
      <div className="technician-header">
        <div className="technician-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)', borderRadius: 'var(--radius-md)' }}>
              <Wrench size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Field Technician Portal</h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {profile?.full_name || user?.email || 'Technician'} • {currentRole?.toUpperCase()}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {typeof navigator !== 'undefined' && !navigator.onLine ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.35rem 0.65rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                <WifiOff size={14} /> Offline Mode
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.35rem 0.65rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                <Wifi size={14} /> Live Sync
              </span>
            )}
            <button
              onClick={() => setShowBarcodeLookup(true)}
              className="technician-btn-touch btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.5rem 0.875rem' }}
            >
              <Barcode size={16} />
              <span>Scan TV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="technician-content">
        {/* Notifications / Alerts */}
        {errorMsg && (
          <div className="technician-alert-box technician-alert-error">
            <AlertTriangle size={18} style={{ color: 'var(--accent-rose)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>{errorMsg}</div>
            <button onClick={() => setErrorMsg(null)} className="btn-icon" style={{ color: 'var(--accent-rose)', border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="technician-alert-box technician-alert-success">
            <CheckCircle size={18} style={{ color: 'var(--accent-emerald)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>{successMsg}</div>
            <button onClick={() => setSuccessMsg(null)} className="btn-icon" style={{ color: 'var(--accent-emerald)', border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Stats Summary Tabs */}
        <div className="technician-tabs-grid">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`technician-tab-btn ${activeTab === 'upcoming' ? 'active-upcoming' : ''}`}
          >
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{upcomingCount}</div>
            <div style={{ fontSize: '0.75rem' }}>Upcoming</div>
          </button>

          <button
            onClick={() => setActiveTab('in_progress')}
            className={`technician-tab-btn ${activeTab === 'in_progress' ? 'active-in-progress' : ''}`}
          >
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{inProgressCount}</div>
            <div style={{ fontSize: '0.75rem' }}>In Progress</div>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`technician-tab-btn ${activeTab === 'completed' ? 'active-completed' : ''}`}
          >
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{completedCount}</div>
            <div style={{ fontSize: '0.75rem' }}>Completed</div>
          </button>
        </div>

        {/* Search Bar */}
        <div className="technician-search-bar">
          <Search size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search barcode, serial, ticket # or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="technician-search-input"
          />
        </div>

        {/* Visit Cards List */}
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--accent-cyan)' }} />
              <p style={{ fontSize: '0.875rem' }}>Loading field visits...</p>
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
              <Wrench size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No field visits found</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>There are no visits matching your selected filter.</p>
            </div>
          ) : (
            filteredVisits.map((visit) => {
              const ticket = visit.service_tickets;
              const cust = ticket?.customers;
              const unit = ticket?.product_units;
              const variant = unit?.product_variants;
              const warranty = ticket?.warranties?.[0];

              const isWarrantyActive = warranty && warranty.status === 'active' && new Date(warranty.end_date) > new Date();

              return (
                <div
                  key={visit.id}
                  className={`technician-visit-card ${selectedVisit?.id === visit.id ? 'selected' : ''}`}
                >
                  {/* Visit Header */}
                  <div className="technician-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        #{ticket?.ticket_number}
                      </span>
                      <span
                        className={`badge ${
                          visit.status === 'completed'
                            ? 'badge-emerald'
                            : visit.status === 'in_progress' || visit.status === 'arrived'
                            ? 'badge-amber'
                            : 'badge-cyan'
                        }`}
                      >
                        {visit.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <Clock size={14} />
                      <span>{new Date(visit.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="technician-card-body">
                    {/* Customer Info */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div>
                        <h3 style={{ fontSize: '0.975rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.375rem', margin: 0 }}>
                          <User size={16} style={{ color: 'var(--accent-blue)' }} />
                          <span>{cust?.full_name || 'Unknown Customer'}</span>
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          <MapPin size={14} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
                          <span>
                            {cust?.address_line1}, {cust?.city} {cust?.postal_code}
                          </span>
                        </div>
                      </div>

                      {cust?.phone && (
                        <a
                          href={`tel:${cust.phone}`}
                          className="technician-btn-touch"
                          style={{
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#34D399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '0.5rem 0.75rem',
                            minHeight: '44px',
                            minWidth: '44px',
                          }}
                        >
                          <Phone size={16} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Call</span>
                        </a>
                      )}
                    </div>

                    {/* TV & Warranty details */}
                    <div className="technician-unit-box">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                          <Tv size={16} style={{ color: 'var(--accent-purple)' }} />
                          <span>{variant?.product_name || 'ZUVO TV Unit'}</span>
                        </div>

                        {isWarrantyActive ? (
                          <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>
                            <ShieldCheck size={12} />
                            <span>Warranty Active</span>
                          </span>
                        ) : (
                          <span className="badge badge-rose" style={{ fontSize: '0.7rem' }}>
                            <ShieldAlert size={12} />
                            <span>Warranty Expired</span>
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', paddingTop: '0.375rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Barcode: </span>
                          <span style={{ color: 'var(--text-primary)' }}>{unit?.barcode || 'N/A'}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Serial: </span>
                          <span style={{ color: 'var(--text-primary)' }}>{unit?.serial_number || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Issue Description */}
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Issue Description
                      </div>
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-primary)', background: 'var(--bg-input)', padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', margin: 0, lineHeight: 1.4 }}>
                        {ticket?.issue_description || 'No description provided.'}
                      </p>
                    </div>

                    {/* Visit Actions Flow Buttons */}
                    <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {visit.status === 'scheduled' && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(visit.id, 'en_route')}
                          className="technician-btn-touch btn-primary"
                          style={{ flex: 1, minWidth: '160px' }}
                        >
                          <Navigation size={16} />
                          <span>Start Visit (En Route)</span>
                        </button>
                      )}

                      {visit.status === 'en_route' && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(visit.id, 'arrived')}
                          className="technician-btn-touch"
                          style={{ flex: 1, minWidth: '160px', background: 'var(--accent-amber)', color: '#000' }}
                        >
                          <MapPin size={16} />
                          <span>Mark Arrived</span>
                        </button>
                      )}

                      {(visit.status === 'arrived' || visit.status === 'assigned') && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(visit.id, 'in_progress')}
                          className="technician-btn-touch"
                          style={{ flex: 1, minWidth: '160px', background: 'var(--accent-purple)', color: '#fff' }}
                        >
                          <Play size={16} />
                          <span>Start Service</span>
                        </button>
                      )}

                      {visit.status === 'in_progress' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedVisit(visit);
                              setShowDiagnosisModal(true);
                            }}
                            className="technician-btn-touch btn-secondary"
                            style={{ flex: '1 1 120px' }}
                          >
                            <FileText size={16} style={{ color: 'var(--accent-cyan)' }} />
                            <span>Diagnosis</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedVisit(visit);
                              setShowPartsModal(true);
                            }}
                            className="technician-btn-touch btn-secondary"
                            style={{ flex: '1 1 120px' }}
                          >
                            <Package size={16} style={{ color: 'var(--accent-amber)' }} />
                            <span>Request Parts</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedVisit(visit);
                              handleRequestOtp();
                            }}
                            className="technician-btn-touch btn-primary"
                            style={{ flex: '2 1 180px', background: 'linear-gradient(135deg, #10B981, #059669)' }}
                          >
                            <CheckCircle size={16} />
                            <span>Complete & OTP</span>
                          </button>
                        </>
                      )}

                      {visit.status === 'completed' && (
                        <div style={{ width: '100%', padding: '0.625rem 1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34D399', borderRadius: 'var(--radius-md)', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <CheckCircle size={16} />
                          <span>Visit Completed & Customer Confirmed</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* DIAGNOSIS & REPAIR MODAL */}
      {showDiagnosisModal && selectedVisit && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span>Service Diagnosis & Repair</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowDiagnosisModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDiagnosis}>
              <div className="modal-body">
                <div className="input-group">
                  <label className="input-label">Fault Category</label>
                  <select
                    value={diagnosisForm.faultCategory}
                    onChange={(e) => setDiagnosisForm({ ...diagnosisForm, faultCategory: e.target.value })}
                    className="form-input"
                  >
                    <option value="Display / Panel">Display / Panel</option>
                    <option value="Power Supply">Power Supply Unit (PSU)</option>
                    <option value="Mainboard / Motherboard">Mainboard / Motherboard</option>
                    <option value="Audio / Speaker">Audio / Speaker</option>
                    <option value="Software / OS">Software / OS Firmware</option>
                    <option value="Remote / Connectivity">Remote / Connectivity</option>
                    <option value="Other">Other Fault</option>
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Findings & Root Cause *</label>
                  <textarea
                    rows={2}
                    value={diagnosisForm.findings}
                    onChange={(e) => setDiagnosisForm({ ...diagnosisForm, findings: e.target.value })}
                    placeholder="Describe detailed technical findings..."
                    className="form-input"
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Repair Action Taken *</label>
                  <textarea
                    rows={2}
                    value={diagnosisForm.actionTaken}
                    onChange={(e) => setDiagnosisForm({ ...diagnosisForm, actionTaken: e.target.value })}
                    placeholder="Describe repair performed..."
                    className="form-input"
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Technician Notes</label>
                  <input
                    type="text"
                    value={diagnosisForm.technicianNotes}
                    onChange={(e) => setDiagnosisForm({ ...diagnosisForm, technicianNotes: e.target.value })}
                    placeholder="Additional service notes..."
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowDiagnosisModal(false)}
                  className="technician-btn-touch btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="technician-btn-touch btn-primary"
                >
                  <CheckCircle size={16} />
                  <span>Save Diagnosis</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SPARE PARTS USAGE MODAL */}
      {showPartsModal && selectedVisit && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={18} style={{ color: 'var(--accent-amber)' }} />
                <span>Spare Part Usage & Stock Request</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowPartsModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUsePart}>
              <div className="modal-body">
                <div className="input-group">
                  <label className="input-label">Select Spare Part *</label>
                  <select
                    value={partForm.sparePartId}
                    onChange={(e) => setPartForm({ ...partForm, sparePartId: e.target.value })}
                    className="form-input"
                    required
                  >
                    <option value="">-- Choose Spare Part --</option>
                    {sparePartsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.part_name} ({p.part_code}) - ₹{p.selling_price || p.standard_cost}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Source Warehouse *</label>
                  <select
                    value={partForm.warehouseId}
                    onChange={(e) => setPartForm({ ...partForm, warehouseId: e.target.value })}
                    className="form-input"
                    required
                  >
                    {warehousesList.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_name} ({w.warehouse_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="input-group">
                    <label className="input-label">Quantity *</label>
                    <input
                      type="number"
                      min={1}
                      value={partForm.quantity}
                      onChange={(e) => setPartForm({ ...partForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Warranty Covered</label>
                    <select
                      value={partForm.warrantyCovered ? 'yes' : 'no'}
                      onChange={(e) => setPartForm({ ...partForm, warrantyCovered: e.target.value === 'yes' })}
                      className="form-input"
                    >
                      <option value="yes">Yes (Under Warranty)</option>
                      <option value="no">No (Customer Payable)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowPartsModal(false)}
                  className="technician-btn-touch btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPart}
                  className="technician-btn-touch"
                  style={{ background: 'var(--accent-amber)', color: '#000' }}
                >
                  <Package size={16} />
                  <span>Deduct & Issue Part</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER CONFIRMATION OTP MODAL */}
      {showOtpModal && selectedVisit && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={18} style={{ color: 'var(--accent-emerald)' }} />
                <span>Customer Service Confirmation</span>
              </h3>
              <button className="btn-icon" onClick={() => setShowOtpModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVerifyOtpAndComplete}>
              <div className="modal-body">
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '0.875rem', borderRadius: 'var(--radius-md)', color: '#FCD34D', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                    <AlertTriangle size={16} />
                    <span>Simulation / Test Mode Active</span>
                  </div>
                  <p style={{ margin: 0 }}>No SMS provider configured. Use test OTP code below:</p>
                  <div style={{ marginTop: '0.5rem', textAlign: 'center', background: 'var(--bg-main)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)', border: '1px solid var(--border-subtle)', letterSpacing: '0.2em' }}>
                    {simulatedOtp || '------'}
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Enter Customer 6-Digit OTP *</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="form-input"
                    style={{ textAlign: 'center', fontSize: '1.25rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.25em', padding: '0.75rem' }}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="technician-btn-touch btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingOtp}
                  className="technician-btn-touch btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                >
                  <CheckCircle size={16} />
                  <span>Verify OTP & Complete</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Lookup Modal */}
      {showBarcodeLookup && (
        <BarcodeLookupModal
          isOpen={showBarcodeLookup}
          onClose={() => setShowBarcodeLookup(false)}
        />
      )}
    </div>
  );
};
