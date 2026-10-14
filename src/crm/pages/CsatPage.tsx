import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Star,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  MessageSquare,
  ShieldAlert,
  Search,
  Filter,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Plus,
  UserCheck,
  Building,
  Wrench,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  Calendar,
  X,
  Sparkles,
  PhoneCall,
  User
} from 'lucide-react';
import { Pagination } from '../components/common/Pagination';

type CsatTab = 'overview' | 'surveys' | 'followups' | 'performance';

interface CsatPageProps {
  isDealerScope?: boolean;
}

export const CsatPage: React.FC<CsatPageProps> = ({ isDealerScope = false }) => {
  const { role, user } = useAuth();
  const [activeTab, setActiveTab] = useState<CsatTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Summary Metrics
  const [summary, setSummary] = useState<any>(null);
  const [distribution, setDistribution] = useState<any[]>([]);

  // Surveys & Responses
  const [surveys, setSurveys] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Follow-ups
  const [followups, setFollowups] = useState<any[]>([]);
  const [followupStatusFilter, setFollowupStatusFilter] = useState<string>('all');
  const [selectedFollowup, setSelectedFollowup] = useState<any | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [savingFollowup, setSavingFollowup] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [staffMembers, setStaffMembers] = useState<any[]>([]);

  // Technician & Service Center Summaries
  const [technicianStats, setTechnicianStats] = useState<any[]>([]);
  const [serviceCenterStats, setServiceCenterStats] = useState<any[]>([]);

  // Manual Trigger Modal
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [eligibleTickets, setEligibleTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [triggering, setTriggering] = useState(false);
  const [triggerSuccess, setTriggerSuccess] = useState<any | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  // Copy token link feedback
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Outbox Dispatch Queue State
  const [queueStats, setQueueStats] = useState<{ queued_count: number; dispatched_count: number } | null>(null);
  const [dispatchingQueue, setDispatchingQueue] = useState(false);
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);

  const handleDispatchQueue = async () => {
    setDispatchingQueue(true);
    setDispatchNotice(null);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_process_simulated_csat_dispatch', { p_batch_size: 25 });
      if (error) {
        setDispatchNotice(`Dispatch error: ${error.message}`);
      } else if (data && data.success) {
        setDispatchNotice(`Simulated — not delivered externally: ${data.dispatched_count} survey link(s) processed in simulation mode (${data.failed_count || 0} failed). Outbox tokens purged from database.`);
        setRefreshKey((k) => k + 1);
      }
    } catch (err: any) {
      setDispatchNotice(`Failed to dispatch: ${err.message}`);
    } finally {
      setDispatchingQueue(false);
    }
  };

  // Fetch staff members for assignment
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, employee_code, roles(name)')
          .eq('is_active', true);
        if (data) setStaffMembers(data);
      } catch (err) {
        console.error('Error fetching staff members:', err);
      }
    };
    fetchStaff();
  }, []);

  // Fetch summary and data
  useEffect(() => {
    const loadCsatData = async () => {
      setLoading(true);
      try {
        // 1. Load Summary View
        const { data: summaryData } = await (supabase.from as any)('vw_csat_summary')
          .select('*')
          .maybeSingle();
        if (summaryData) setSummary(summaryData);

        // 2. Load Distribution View
        const { data: distData } = await (supabase.from as any)('vw_csat_rating_distribution')
          .select('*');
        if (distData) setDistribution(distData);

        // 3. Load Surveys with Joined Response, Ticket and Customer
        let query = (supabase.from as any)('csat_surveys')
          .select(`
            *,
            csat_responses (
              id,
              rating,
              feedback_text,
              followup_preferred,
              submitted_at
            ),
            service_tickets (
              id,
              ticket_number,
              service_type,
              status,
              resolved_at
            ),
            customers (
              id,
              full_name,
              phone
            ),
            profiles:technician_id (
              id,
              full_name
            )
          `)
          .order('created_at', { ascending: false });

        const { data: surveysData, error: surveysErr } = await query;
        if (surveysErr) throw surveysErr;
        setSurveys(surveysData || []);

        // 4. Load Follow-ups
        let fuQuery = (supabase.from as any)('csat_followups')
          .select(`
            *,
            csat_surveys (
              survey_number,
              ticket_id
            ),
            csat_responses (
              rating,
              feedback_text,
              followup_preferred,
              submitted_at
            ),
            service_tickets (
              ticket_number,
              service_type
            ),
            customers (
              full_name,
              phone
            ),
            assigned_profile:assigned_to (
              full_name
            )
          `)
          .order('created_at', { ascending: false });

        const { data: fuData, error: fuErr } = await fuQuery;
        if (fuErr) throw fuErr;
        setFollowups(fuData || []);

        // 5. Load Performance Views & Queue Stats (if not dealer scope)
        if (!isDealerScope) {
          const { data: techData } = await (supabase.from as any)('vw_csat_technician_summary')
            .select('*');
          if (techData) setTechnicianStats(techData);

          const { data: scData } = await (supabase.from as any)('vw_csat_service_center_summary')
            .select('*');
          if (scData) setServiceCenterStats(scData);

          const { data: qData } = await (supabase.rpc as any)('fn_get_csat_dispatch_queue_stats');
          if (qData && qData.success) {
            setQueueStats(qData);
          }
        }
      } catch (err: any) {
        console.error('Error loading CSAT dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCsatData();
  }, [refreshKey, isDealerScope]);

  // Load eligible tickets when opening manual trigger modal
  const handleOpenTriggerModal = async () => {
    setShowTriggerModal(true);
    setTriggerError(null);
    setTriggerSuccess(null);
    try {
      const { data } = await supabase
        .from('service_tickets')
        .select(`
          id,
          ticket_number,
          service_type,
          status,
          resolved_at,
          customers (
            full_name,
            phone
          )
        `)
        .in('status', ['resolved', 'closed'])
        .order('updated_at', { ascending: false })
        .limit(25);
      if (data) setEligibleTickets(data);
    } catch (err: any) {
      setTriggerError(err.message || 'Failed to load eligible tickets');
    }
  };

  const handleTriggerSurvey = async () => {
    if (!selectedTicketId) {
      setTriggerError('Please select a service ticket.');
      return;
    }
    setTriggering(true);
    setTriggerError(null);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_trigger_service_csat_survey', {
        p_ticket_id: selectedTicketId,
        p_survey_trigger: 'service_completed'
      });

      if (error) {
        setTriggerError(error.message);
      } else if (data) {
        const res = data as any;
        if (!res.success) {
          setTriggerError(res.message || res.error || 'Failed to trigger survey');
        } else {
          setTriggerSuccess(res);
          setRefreshKey((k) => k + 1);
        }
      }
    } catch (err: any) {
      setTriggerError(err.message || 'Error triggering survey');
    } finally {
      setTriggering(false);
    }
  };

  const handleAssignFollowup = async (followupId: string, profileId: string) => {
    try {
      const { data, error } = await (supabase.rpc as any)('fn_assign_csat_followup', {
        p_followup_id: followupId,
        p_assigned_to: profileId
      });
      if (error) throw error;
      setRefreshKey((k) => k + 1);
      setSelectedFollowup(null);
    } catch (err: any) {
      alert('Failed to assign follow-up: ' + err.message);
    }
  };

  const handleResolveFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFollowup) return;
    if (!resolutionNotes.trim()) {
      alert('Resolution notes are required.');
      return;
    }

    setSavingFollowup(true);
    try {
      const { data, error } = await (supabase.rpc as any)('fn_resolve_csat_followup', {
        p_followup_id: selectedFollowup.id,
        p_resolution_notes: resolutionNotes.trim(),
        p_contact_notes: contactNotes.trim() || null
      });

      if (error) throw error;
      setRefreshKey((k) => k + 1);
      setSelectedFollowup(null);
      setResolutionNotes('');
      setContactNotes('');
    } catch (err: any) {
      alert('Failed to resolve follow-up: ' + err.message);
    } finally {
      setSavingFollowup(false);
    }
  };

  // Filtered surveys
  const filteredSurveys = surveys.filter((s) => {
    const ticketNo = s.service_tickets?.ticket_number?.toLowerCase() || '';
    const custName = s.customers?.full_name?.toLowerCase() || '';
    const survNo = s.survey_number?.toLowerCase() || '';
    const matchesSearch =
      ticketNo.includes(searchQuery.toLowerCase()) ||
      custName.includes(searchQuery.toLowerCase()) ||
      survNo.includes(searchQuery.toLowerCase());

    const resp = Array.isArray(s.csat_responses) ? s.csat_responses[0] : s.csat_responses;
    const rating = resp?.rating;

    let matchesRating = true;
    if (ratingFilter === '5') matchesRating = rating === 5;
    else if (ratingFilter === '4') matchesRating = rating === 4;
    else if (ratingFilter === '3') matchesRating = rating === 3;
    else if (ratingFilter === '2') matchesRating = rating === 2;
    else if (ratingFilter === '1') matchesRating = rating === 1;
    else if (ratingFilter === 'low') matchesRating = rating && rating <= 2;

    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = s.status === statusFilter;
    }

    return matchesSearch && matchesRating && matchesStatus;
  });

  const paginatedSurveys = filteredSurveys.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Filtered Follow-ups
  const filteredFollowups = followups.filter((f) => {
    if (followupStatusFilter === 'all') return true;
    return f.status === followupStatusFilter;
  });

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}>
              <Star size={20} fill="#fff" />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              {isDealerScope ? 'Dealer Customer Feedback (CSAT)' : 'Customer Satisfaction (CSAT)'}
            </h1>
          </div>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {isDealerScope
              ? 'Real-time customer satisfaction insights for your dealership services'
              : 'End-to-end post-service feedback collection, rating analytics and low-rating follow-up workflows'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {!isDealerScope && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleDispatchQueue}
                disabled={dispatchingQueue || (queueStats !== null && queueStats.queued_count === 0)}
                title="Processes pending outbox queue records in simulation mode (not delivered externally) and purges raw tokens from database"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: queueStats && queueStats.queued_count > 0 ? '1px solid #3b82f6' : undefined }}
              >
                <Send size={14} className={dispatchingQueue ? 'animate-spin' : ''} />
                Dispatch Outbox {queueStats ? `(${queueStats.queued_count} queued)` : ''}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleOpenTriggerModal}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Plus size={15} /> Trigger Survey
              </button>
            </>
          )}
        </div>
      </div>

      {dispatchNotice && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', marginBottom: '1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{dispatchNotice}</span>
          <button onClick={() => setDispatchNotice(null)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}

      {/* Metric Cards Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Average CSAT Score Card */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Average CSAT</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                {summary && summary.total_responses > 0 ? (
                  <>
                    <span>{summary.average_rating}</span>
                    <span style={{ fontSize: '0.9rem', color: '#71717a', fontWeight: 500 }}>/ 5.0</span>
                  </>
                ) : (
                  <span style={{ fontSize: '1.25rem', color: '#a1a1aa' }}>N/A (No responses)</span>
                )}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <Star size={18} fill="#f59e0b" />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.5rem' }}>
            Based on {summary?.total_responses || 0} customer response{summary?.total_responses === 1 ? '' : 's'}
          </div>
        </div>

        {/* Total Responses */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Responses</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem' }}>
                {summary?.total_responses ?? 0}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
              <MessageSquare size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.5rem' }}>
            Out of {summary?.total_surveys_sent ?? 0} survey invitation{summary?.total_surveys_sent === 1 ? '' : 's'}
          </div>
        </div>

        {/* Response Rate % */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Response Rate</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem' }}>
                {summary?.response_rate_percentage ?? 0}%
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.5rem' }}>
            Calculated over sent surveys
          </div>
        </div>

        {/* Low Rating Count */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Low Ratings (≤ 2★)</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: summary?.low_rating_count ? '#ef4444' : 'inherit', marginTop: '0.25rem' }}>
                {summary?.low_rating_count ?? 0}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <ThumbsDown size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.5rem' }}>
            Detractors requiring follow-up
          </div>
        </div>

        {/* Open Follow-Ups */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Open Follow-Ups</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: summary?.pending_followups_count ? '#8b5cf6' : 'inherit', marginTop: '0.25rem' }}>
                {summary?.pending_followups_count ?? 0}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
              <ShieldAlert size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.5rem' }}>
            {summary?.resolved_followups_count ?? 0} resolved cases
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '0.625rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'overview' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: activeTab === 'overview' ? 'var(--brand-primary)' : 'var(--text-muted)'
          }}
        >
          Overview & Ratings
        </button>
        <button
          className={`tab-btn ${activeTab === 'surveys' ? 'active' : ''}`}
          onClick={() => setActiveTab('surveys')}
          style={{
            padding: '0.625rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'surveys' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: activeTab === 'surveys' ? 'var(--brand-primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          Surveys & Feedback
          <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.5rem', borderRadius: 999 }}>
            {surveys.length}
          </span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'followups' ? 'active' : ''}`}
          onClick={() => setActiveTab('followups')}
          style={{
            padding: '0.625rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'followups' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: activeTab === 'followups' ? 'var(--brand-primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          Low-Rating Follow-Ups
          {summary?.pending_followups_count > 0 && (
            <span style={{ fontSize: '0.75rem', background: '#ef4444', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: 999, fontWeight: 700 }}>
              {summary.pending_followups_count}
            </span>
          )}
        </button>
        {!isDealerScope && (
          <button
            className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
            onClick={() => setActiveTab('performance')}
            style={{
              padding: '0.625rem 1.25rem',
              border: 'none',
              background: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'performance' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              color: activeTab === 'performance' ? 'var(--brand-primary)' : 'var(--text-muted)'
            }}
          >
            Staff & Center Performance
          </button>
        )}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 2fr', gap: '1.5rem' }}>
          {/* Rating Distribution Breakdown */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={18} color="#f59e0b" /> Rating Distribution
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[5, 4, 3, 2, 1].map((starCount) => {
                const distItem = distribution.find((d) => d.rating === starCount);
                const count = distItem?.count || 0;
                const percentage = distItem?.percentage || 0;
                const colors: Record<number, string> = {
                  5: '#10b981',
                  4: '#3b82f6',
                  3: '#eab308',
                  2: '#f97316',
                  1: '#ef4444',
                };
                return (
                  <div key={starCount} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                    <div style={{ width: 44, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                      <span>{starCount}</span>
                      <Star size={13} fill="#fbbf24" color="#fbbf24" />
                    </div>
                    <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${percentage}%`,
                          background: colors[starCount],
                          borderRadius: 4,
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>
                    <div style={{ width: 75, textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      <strong>{count}</strong> ({percentage}%)
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Ratings of 1 and 2 automatically trigger high-priority alerts to authorized service leads for follow-up and remediation.
            </div>
          </div>

          {/* Recent Responses Stream */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={18} color="#3b82f6" /> Recent Customer Feedback
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveTab('surveys')}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
              >
                View All
              </button>
            </h3>

            {surveys.filter((s) => s.status === 'submitted').length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <MessageSquare size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                <p>No customer feedback submitted yet.</p>
                <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Completed service tickets will automatically send survey invitations.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {surveys
                  .filter((s) => s.status === 'submitted')
                  .slice(0, 5)
                  .map((s) => {
                    const resp = Array.isArray(s.csat_responses) ? s.csat_responses[0] : s.csat_responses;
                    const rating = resp?.rating || 0;
                    const isLow = rating <= 2;
                    return (
                      <div
                        key={s.id}
                        style={{
                          background: isLow ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)',
                          border: isLow ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border-color)',
                          borderRadius: 10,
                          padding: '0.875rem 1rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              {[1, 2, 3, 4, 5].map((st) => (
                                <Star
                                  key={st}
                                  size={13}
                                  fill={st <= rating ? '#fbbf24' : 'transparent'}
                                  color={st <= rating ? '#fbbf24' : '#52525b'}
                                />
                              ))}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                              {rating} / 5
                            </span>
                            {isLow && (
                              <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 4 }}>
                                LOW RATING
                              </span>
                            )}
                          </div>
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                            Ticket #{s.service_tickets?.ticket_number}
                          </span>
                        </div>

                        {resp?.feedback_text ? (
                          <p style={{ fontSize: '0.85rem', margin: '0.35rem 0', color: 'var(--text-primary)', fontStyle: 'italic' }}>
                            "{resp.feedback_text}"
                          </p>
                        ) : (
                          <p style={{ fontSize: '0.8rem', margin: '0.35rem 0', color: 'var(--text-muted)' }}>
                            (No comments provided)
                          </p>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>Customer: {s.customers?.full_name || 'Anonymous Customer'}</span>
                          <span>{resp?.submitted_at ? new Date(resp.submitted_at).toLocaleDateString() : ''}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SURVEYS & RESPONSES TABLE */}
      {activeTab === 'surveys' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          {/* Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 260 }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search by ticket #, customer or survey #..."
                  className="input input-sm"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ paddingLeft: 34, width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                className="select select-sm"
                value={ratingFilter}
                onChange={(e) => {
                  setRatingFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Ratings</option>
                <option value="5">5 Stars (Very Satisfied)</option>
                <option value="4">4 Stars (Satisfied)</option>
                <option value="3">3 Stars (Neutral)</option>
                <option value="2">2 Stars (Unsatisfied)</option>
                <option value="1">1 Star (Very Unsatisfied)</option>
                <option value="low">Low Ratings (≤ 2 Stars)</option>
              </select>

              <select
                className="select select-sm"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Customer Response</option>
                <option value="submitted">Submitted</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Survey #</th>
                  <th>Ticket</th>
                  <th>Customer</th>
                  <th>Technician</th>
                  <th>Rating</th>
                  <th>Customer Comments</th>
                  <th>Follow-up</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSurveys.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No matching surveys found.
                    </td>
                  </tr>
                ) : (
                  paginatedSurveys.map((s) => {
                    const resp = Array.isArray(s.csat_responses) ? s.csat_responses[0] : s.csat_responses;
                    const rating = resp?.rating;
                    return (
                      <tr key={s.id}>
                        <td>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.survey_number}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>#{s.service_tickets?.ticket_number}</span>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                            {s.service_tickets?.service_type}
                          </div>
                        </td>
                        <td>
                          <div>{s.customers?.full_name || 'N/A'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.customers?.phone}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem' }}>
                            {s.profiles?.full_name || 'Assigned Lead'}
                          </span>
                        </td>
                        <td>
                          {rating ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Star size={14} fill="#fbbf24" color="#fbbf24" />
                              <strong style={{ color: rating <= 2 ? '#ef4444' : '#10b981' }}>{rating}/5</strong>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Waiting</span>
                          )}
                        </td>
                        <td style={{ maxWidth: 220 }}>
                          {resp?.feedback_text ? (
                            <div style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={resp.feedback_text}>
                              "{resp.feedback_text}"
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                          )}
                        </td>
                        <td>
                          {resp?.followup_preferred ? (
                            <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                              Requested
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge badge-${
                              s.status === 'submitted' ? 'success' : s.status === 'pending' ? 'warning' : 'neutral'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(s.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td>
                          {s.status === 'submitted' ? (
                            <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={13} /> Logged
                            </span>
                          ) : s.status === 'pending' ? (
                            <span style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={13} /> Link Active
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Expired
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalCount={filteredSurveys.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* TAB 3: LOW-RATING FOLLOW-UPS */}
      {activeTab === 'followups' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['all', 'pending', 'in_progress', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  className={`btn btn-sm ${followupStatusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFollowupStatusFilter(st)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {filteredFollowups.length === 0 ? (
            <div className="card" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>No Open Follow-Ups</h3>
              <p style={{ fontSize: '0.85rem', marginTop: 4 }}>All low-rating customer issues have been resolved or none are pending.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
              {filteredFollowups.map((f) => {
                const isPending = f.status === 'pending';
                const isResolved = f.status === 'resolved';
                return (
                  <div
                    key={f.id}
                    className="card"
                    style={{
                      padding: '1.25rem',
                      borderLeft: `4px solid ${isResolved ? '#10b981' : isPending ? '#ef4444' : '#3b82f6'}`,
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: f.priority === 'urgent' ? '#ef4444' : '#f59e0b', textTransform: 'uppercase' }}>
                          {f.priority} Priority Case
                        </span>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.2rem 0 0 0' }}>
                          Ticket #{f.service_tickets?.ticket_number}
                        </h4>
                      </div>
                      <span className={`badge badge-${isResolved ? 'success' : isPending ? 'danger' : 'info'}`}>
                        {f.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Customer & Rating Information */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span className="text-muted">Customer:</span>
                        <strong>{f.customers?.full_name}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span className="text-muted">Contact Phone:</span>
                        <a href={`tel:${f.customers?.phone}`} style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
                          {f.customers?.phone}
                        </a>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-muted">Customer Rating:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#ef4444', fontWeight: 700 }}>
                          <Star size={13} fill="#ef4444" color="#ef4444" />
                          <span>{f.csat_responses?.rating || 'Low'} / 5</span>
                        </div>
                      </div>
                    </div>

                    {/* Customer Feedback */}
                    {f.csat_responses?.feedback_text && (
                      <div style={{ marginBottom: '0.75rem', fontStyle: 'italic', fontSize: '0.85rem', color: '#e4e4e7', background: 'rgba(239,68,68,0.06)', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid rgba(239,68,68,0.15)' }}>
                        "{f.csat_responses.feedback_text}"
                      </div>
                    )}

                    {/* Assigned Staff */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      <span>Assigned to:</span>
                      <strong>{f.assigned_profile?.full_name || 'Unassigned'}</strong>
                    </div>

                    {/* Resolution Notes if resolved */}
                    {isResolved && f.resolution_notes && (
                      <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
                        <strong style={{ color: '#10b981' }}>Resolution: </strong>
                        <span>{f.resolution_notes}</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!isResolved && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => {
                            setSelectedFollowup(f);
                            setAssigneeId(f.assigned_to || '');
                          }}
                        >
                          <UserCheck size={14} /> Assign Case
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => {
                            setSelectedFollowup(f);
                            setResolutionNotes(f.resolution_notes || '');
                            setContactNotes(f.contact_notes || '');
                          }}
                        >
                          <CheckCircle2 size={14} /> Resolve Case
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PERFORMANCE SUMMARIES */}
      {activeTab === 'performance' && !isDealerScope && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
          {/* Technician CSAT Summary */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Wrench size={18} color="#3b82f6" /> Technician Satisfaction Index
            </h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Technician</th>
                    <th>Code</th>
                    <th>Responses</th>
                    <th>Average Score</th>
                    <th>Low Ratings</th>
                  </tr>
                </thead>
                <tbody>
                  {technicianStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No technician survey records yet.
                      </td>
                    </tr>
                  ) : (
                    technicianStats.map((t) => (
                      <tr key={t.technician_id}>
                        <td>
                          <strong>{t.technician_name}</strong>
                        </td>
                        <td>
                          <span className="badge badge-neutral">{t.technician_code || 'TECH'}</span>
                        </td>
                        <td>{t.responses_received}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Star size={13} fill="#fbbf24" color="#fbbf24" />
                            <strong>{t.average_rating || 0}</strong>
                          </div>
                        </td>
                        <td>
                          <span style={{ color: t.low_ratings_count > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 600 }}>
                            {t.low_ratings_count}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Service Center CSAT Summary */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building size={18} color="#10b981" /> Service Center Ratings
            </h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Service Center</th>
                    <th>Code</th>
                    <th>Surveys Sent</th>
                    <th>Responses</th>
                    <th>Average Score</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceCenterStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No service center ratings yet.
                      </td>
                    </tr>
                  ) : (
                    serviceCenterStats.map((sc) => (
                      <tr key={sc.service_center_id}>
                        <td>
                          <strong>{sc.center_name}</strong>
                        </td>
                        <td>
                          <span className="badge badge-neutral">{sc.center_code}</span>
                        </td>
                        <td>{sc.surveys_sent}</td>
                        <td>{sc.responses_received}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Star size={13} fill="#fbbf24" color="#fbbf24" />
                            <strong>{sc.average_rating || 0}</strong>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RESOLVE / ASSIGN FOLLOW-UP MODAL */}
      {selectedFollowup && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.125rem' }}>
                Follow-Up Case: Ticket #{selectedFollowup.service_tickets?.ticket_number}
              </h3>
              <button
                className="btn btn-secondary btn-xs"
                onClick={() => setSelectedFollowup(null)}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleResolveFollowup} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 8, fontSize: '0.85rem' }}>
                <div style={{ marginBottom: 4 }}>Customer: <strong>{selectedFollowup.customers?.full_name}</strong></div>
                <div style={{ marginBottom: 4 }}>Phone: <strong>{selectedFollowup.customers?.phone}</strong></div>
                <div>Customer Rating: <strong style={{ color: '#ef4444' }}>{selectedFollowup.csat_responses?.rating}/5</strong></div>
              </div>

              <div>
                <label className="label">Assign To Specialist</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    className="select"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Select staff member...</option>
                    {staffMembers.map((sm) => (
                      <option key={sm.id} value={sm.id}>
                        {sm.full_name} ({sm.employee_code || sm.roles?.name})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!assigneeId}
                    onClick={() => handleAssignFollowup(selectedFollowup.id, assigneeId)}
                  >
                    Save Assignment
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Customer Contact Notes (Phone Conversation)</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Notes from customer outreach (call date, explanation provided)..."
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Resolution Action & Notes *</label>
                <textarea
                  className="input"
                  rows={3}
                  required
                  placeholder="Document corrective actions taken, technician feedback, parts replacement or goodwill voucher..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedFollowup(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingFollowup || !resolutionNotes.trim()}
                >
                  {savingFollowup ? 'Saving...' : 'Mark Case Resolved'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL SURVEY TRIGGER MODAL */}
      {showTriggerModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send size={18} color="var(--brand-primary)" /> Generate CSAT Survey Invitation
              </h3>
              <button
                className="btn btn-secondary btn-xs"
                onClick={() => setShowTriggerModal(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {triggerSuccess ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <CheckCircle2 size={44} color="#10b981" style={{ margin: '0 auto 0.75rem' }} />
                  <h4 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Survey Invitation Created!</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Survey Number: <strong>{triggerSuccess.survey_number}</strong>
                  </p>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.75rem', marginTop: '1rem', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                    <code>{window.location.origin}{window.location.pathname}#{triggerSuccess.survey_url}</code>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '1rem' }}
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#${triggerSuccess.survey_url}`);
                      alert('Survey link copied to clipboard!');
                    }}
                  >
                    <Copy size={14} /> Copy Customer Survey Link
                  </button>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                    Select an eligible completed or resolved service ticket to send or re-send a CSAT survey invitation via communication log simulation.
                  </p>

                  {triggerError && (
                    <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '0.625rem 0.875rem', color: '#fca5a5', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={15} /> {triggerError}
                    </div>
                  )}

                  <div>
                    <label className="label">Eligible Resolved / Closed Service Tickets</label>
                    <select
                      className="select"
                      value={selectedTicketId}
                      onChange={(e) => setSelectedTicketId(e.target.value)}
                    >
                      <option value="">Choose ticket...</option>
                      {eligibleTickets.map((t) => (
                        <option key={t.id} value={t.id}>
                          Ticket #{t.ticket_number} — {t.customers?.full_name} ({t.service_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, padding: '0.75rem', fontSize: '0.8rem', color: '#93c5fd' }}>
                    Notice: Survey tokens are single-use and cryptographically hashed with a 7-day validity period. Duplicate surveys for the same ticket are automatically prevented.
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowTriggerModal(false)}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={triggering || !selectedTicketId}
                      onClick={handleTriggerSurvey}
                    >
                      {triggering ? 'Generating Survey...' : 'Dispatch Survey'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
