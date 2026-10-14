import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  Info,
  RefreshCw,
  Search,
  Filter,
  CheckCheck,
  Settings,
  ShoppingBag,
  Package,
  ShieldCheck,
  Wrench,
  Cpu,
  RotateCcw,
  ExternalLink,
  Sliders
} from 'lucide-react';

interface NotificationsPageProps {
  onNavigate?: (tab: string) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'notifications' | 'preferences'>('notifications');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadNotifications(), loadPreferences()]);
    } catch (err: any) {
      console.error('Error fetching notification data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadNotifications = async () => {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (user?.id) {
      query = query.eq('recipient_user_id', user.id);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to load notifications:', error);
    } else {
      setNotifications(data || []);
    }
  };

  const loadPreferences = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase.rpc('get_or_create_notification_preferences', {
        p_user_id: user.id
      });
      if (error) {
        console.error('Error getting preferences via RPC, fallback to query:', error);
        const { data: prefData } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        setPreferences(prefData || {
          in_app_enabled: true,
          email_enabled: false,
          sms_enabled: false,
          whatsapp_enabled: false,
          sales_enabled: true,
          inventory_enabled: true,
          warranty_enabled: true,
          service_enabled: true,
          spare_parts_enabled: true,
          rma_enabled: true,
        });
      } else {
        setPreferences(data || {});
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  };

  const handleTriggerAutomatedAlerts = async () => {
    setIsRefreshing(true);
    setFeedbackMsg(null);
    try {
      const { data, error } = await supabase.rpc('generate_automated_alerts');
      if (error) {
        setFeedbackMsg({ type: 'error', text: 'Failed to generate automated alerts: ' + error.message });
      } else {
        await loadNotifications();
        setFeedbackMsg({ type: 'success', text: 'Automated low-stock and warranty alerts synchronized.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Failed to synchronize alerts.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: id });
      if (error) {
        // Fallback update
        await supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('id', id);
      }
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setFeedbackMsg({ type: 'success', text: 'Notification marked as read.' });
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { error } = await supabase.rpc('mark_all_notifications_read');
      if (error) {
        await supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('recipient_user_id', user?.id)
          .eq('is_read', false);
      }
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
      setFeedbackMsg({ type: 'success', text: 'All notifications marked as read.' });
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !preferences) return;
    setFeedbackMsg(null);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) {
        setFeedbackMsg({ type: 'error', text: 'Unable to update notification preferences: ' + error.message });
      } else {
        setFeedbackMsg({ type: 'success', text: 'Notification preferences updated successfully.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Unable to update notification preferences.' });
    }
  };

  // Filtered Notifications
  const filteredNotifications = notifications.filter(n => {
    if (readFilter === 'unread' && n.is_read) return false;
    if (readFilter === 'read' && !n.is_read) return false;
    if (typeFilter !== 'all' && n.notification_type !== typeFilter) return false;
    if (severityFilter !== 'all' && n.severity !== severityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title?.toLowerCase().includes(q);
      const matchMsg = n.message?.toLowerCase().includes(q);
      const matchType = n.notification_type?.toLowerCase().includes(q);
      if (!matchTitle && !matchMsg && !matchType) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage) || 1;
  const paginatedNotifications = filteredNotifications.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <span className="badge badge-rose" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertOctagon size={12} /> CRITICAL</span>;
      case 'warning':
        return <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> WARNING</span>;
      case 'success':
        return <span className="badge badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> SUCCESS</span>;
      default:
        return <span className="badge badge-cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Info size={12} /> INFO</span>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sale_created':
      case 'sale_completed':
      case 'payment_received':
        return <ShoppingBag size={18} style={{ color: 'var(--accent-emerald)' }} />;
      case 'inventory_low':
      case 'inventory_transfer':
        return <Package size={18} style={{ color: 'var(--accent-cyan)' }} />;
      case 'warranty_registered':
      case 'warranty_expiring':
        return <ShieldCheck size={18} style={{ color: 'var(--accent-purple)' }} />;
      case 'service_created':
      case 'service_updated':
      case 'service_completed':
        return <Wrench size={18} style={{ color: 'var(--accent-rose)' }} />;
      case 'spare_part_low_stock':
        return <Cpu size={18} style={{ color: 'var(--accent-amber)' }} />;
      case 'rma_created':
        return <RotateCcw size={18} style={{ color: 'var(--accent-amber)' }} />;
      default:
        return <Bell size={18} style={{ color: 'var(--accent-blue)' }} />;
    }
  };

  const handleActionClick = (actionUrl?: string) => {
    if (!actionUrl || !onNavigate) return;
    const cleanUrl = actionUrl.replace('/', '');
    onNavigate(cleanUrl);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const criticalCount = notifications.filter(n => n.severity === 'critical' && !n.is_read).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(59, 130, 246, 0.08) 100%)',
        borderColor: 'rgba(6, 182, 212, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 15px rgba(6, 182, 212, 0.4)'
            }}>
              <Bell size={20} />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Notifications & Communication Center</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Centralized ZUVO CRM real-time notifications, low-stock alerts, warranty expirations & delivery preferences foundation.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleTriggerAutomatedAlerts}
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Scan DB for low stock and expiring warranties"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Sync Stock/Warranty Alerts
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CheckCheck size={14} /> Mark All Read ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          background: feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
          border: `1px solid ${feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
          color: feedbackMsg.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
          fontSize: '0.875rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{feedbackMsg.text}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Overview Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="stat-card">
          <div>
            <div className="stat-val">{notifications.length}</div>
            <div className="stat-label">Total Notifications</div>
          </div>
          <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-cyan)' }}>
            <Bell size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-val" style={{ color: unreadCount > 0 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
              {unreadCount}
            </div>
            <div className="stat-label">Unread Alerts</div>
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-amber)' }}>
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-val" style={{ color: criticalCount > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
              {criticalCount}
            </div>
            <div className="stat-label">Unread Critical Alerts</div>
          </div>
          <div style={{ background: 'rgba(244, 63, 94, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-rose)' }}>
            <AlertOctagon size={22} />
          </div>
        </div>
      </div>

      {/* Tabs Switcher: Notifications Feed vs Preferences */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveSubTab('notifications')}
          className={`btn ${activeSubTab === 'notifications' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Bell size={15} /> Notification Feed
        </button>
        <button
          onClick={() => setActiveSubTab('preferences')}
          className={`btn ${activeSubTab === 'preferences' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Sliders size={15} /> Delivery & Role Preferences
        </button>
      </div>

      {activeSubTab === 'notifications' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filter Toolbar */}
          <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="input"
                  style={{ paddingLeft: '36px', width: '100%', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              {/* Type Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                  className="input"
                  style={{ fontSize: '0.8rem', padding: '6px 10px', background: '#111827' }}
                >
                  <option value="all">All Categories</option>
                  <option value="sale_created">Sales Created</option>
                  <option value="payment_received">Payments Received</option>
                  <option value="inventory_transfer">Stock Transfers</option>
                  <option value="warranty_registered">Warranty Registered</option>
                  <option value="warranty_expiring">Warranty Expiring</option>
                  <option value="service_created">Service Ticket Created</option>
                  <option value="spare_part_low_stock">Spare Parts Low Stock</option>
                  <option value="rma_created">RMA Return</option>
                </select>
              </div>

              {/* Severity Filter */}
              <select
                value={severityFilter}
                onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
                className="input"
                style={{ fontSize: '0.8rem', padding: '6px 10px', background: '#111827' }}
              >
                <option value="all">All Severities</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>

              {/* Read Filter */}
              <select
                value={readFilter}
                onChange={(e) => { setReadFilter(e.target.value as any); setPage(1); }}
                className="input"
                style={{ fontSize: '0.8rem', padding: '6px 10px', background: '#111827' }}
              >
                <option value="all">All Status</option>
                <option value="unread">Unread Only</option>
                <option value="read">Read Only</option>
              </select>
            </div>
          </div>

          {/* Notifications Feed List */}
          {isLoading ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="animate-spin" style={{ width: 30, height: 30, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', margin: '0 auto 12px' }} />
              Loading notifications from Supabase...
            </div>
          ) : paginatedNotifications.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {paginatedNotifications.map((n) => (
                <div
                  key={n.id}
                  className="glass-card"
                  style={{
                    padding: '16px',
                    borderLeft: `4px solid ${
                      n.severity === 'critical'
                        ? 'var(--accent-rose)'
                        : n.severity === 'warning'
                        ? 'var(--accent-amber)'
                        : n.severity === 'success'
                        ? 'var(--accent-emerald)'
                        : 'var(--accent-cyan)'
                    }`,
                    background: n.is_read ? 'rgba(255, 255, 255, 0.015)' : 'rgba(6, 182, 212, 0.05)',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {getTypeIcon(n.notification_type)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: n.is_read ? 600 : 800, color: '#fff', margin: 0 }}>
                          {n.title}
                        </h4>
                        {getSeverityBadge(n.severity)}
                        <span className="badge badge-slate" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                          {n.notification_type.replace(/_/g, ' ')}
                        </span>
                        {!n.is_read && (
                          <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: 'var(--accent-cyan)',
                            display: 'inline-block'
                          }} />
                        )}
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 8px 0', lineHeight: 1.4 }}>
                        {n.message}
                      </p>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {n.action_url && (
                      <button
                        onClick={() => handleActionClick(n.action_url)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <ExternalLink size={13} /> View Record
                      </button>
                    )}
                    {!n.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(n.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '6px 10px', color: 'var(--accent-cyan)' }}
                        title="Mark as read"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Bell size={40} style={{ color: 'var(--accent-cyan)', opacity: 0.5, marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '4px' }}>No notifications found</h3>
              <p style={{ fontSize: '0.85rem' }}>No system alerts or notifications match your selected filter criteria.</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Showing {(page - 1) * itemsPerPage + 1} - {Math.min(page * itemsPerPage, filteredNotifications.length)} of {filteredNotifications.length}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="btn btn-secondary btn-sm"
                >
                  Previous
                </button>
                <span style={{ fontSize: '0.85rem', padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="btn btn-secondary btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Notification Preferences Form Tab */
        <div className="glass-card" style={{ padding: '24px', maxWidth: '800px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Settings size={20} style={{ color: 'var(--accent-cyan)' }} />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Notification & Communication Settings</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Configure in-app alert categories and future SMS/WhatsApp/Email channel foundation.
              </p>
            </div>
          </div>

          <form onSubmit={handleSavePreferences} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Primary Channel Toggles */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', color: 'var(--accent-cyan)' }}>
                Delivery Channels
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences?.in_app_enabled ?? true}
                    onChange={(e) => setPreferences({ ...preferences, in_app_enabled: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>In-App Notifications</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Navbar Bell & Notifications Feed</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', opacity: 0.7 }}>
                  <input
                    type="checkbox"
                    checked={preferences?.email_enabled ?? false}
                    onChange={(e) => setPreferences({ ...preferences, email_enabled: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      Email Alerts <span className="badge badge-slate" style={{ fontSize: '0.6rem' }}>Foundation</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Send critical alert summaries</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', opacity: 0.7 }}>
                  <input
                    type="checkbox"
                    checked={preferences?.sms_enabled ?? false}
                    onChange={(e) => setPreferences({ ...preferences, sms_enabled: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      SMS Gateway <span className="badge badge-slate" style={{ fontSize: '0.6rem' }}>Foundation</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SMS notification dispatch</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', opacity: 0.7 }}>
                  <input
                    type="checkbox"
                    checked={preferences?.whatsapp_enabled ?? false}
                    onChange={(e) => setPreferences({ ...preferences, whatsapp_enabled: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      WhatsApp API <span className="badge badge-slate" style={{ fontSize: '0.6rem' }}>Foundation</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>WhatsApp message dispatch</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Category Level Toggles */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', color: 'var(--accent-cyan)' }}>
                Notification Categories
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences?.sales_enabled ?? true}
                    onChange={(e) => setPreferences({ ...preferences, sales_enabled: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Sales & Payments</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences?.inventory_enabled ?? true}
                    onChange={(e) => setPreferences({ ...preferences, inventory_enabled: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Inventory Transfers</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences?.warranty_enabled ?? true}
                    onChange={(e) => setPreferences({ ...preferences, warranty_enabled: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Warranty Expirations</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences?.service_enabled ?? true}
                    onChange={(e) => setPreferences({ ...preferences, service_enabled: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Service Tickets</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences?.spare_parts_enabled ?? true}
                    onChange={(e) => setPreferences({ ...preferences, spare_parts_enabled: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Spare Parts Low Stock</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences?.rma_enabled ?? true}
                    onChange={(e) => setPreferences({ ...preferences, rma_enabled: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>RMA & Returns</span>
                </label>
              </div>
            </div>

            <div>
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
                Save Notification Preferences
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
