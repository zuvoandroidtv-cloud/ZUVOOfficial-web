import React, { useEffect, useState, useRef } from 'react';
import { useAuth, RoleName } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase/client';
import {
  Tv,
  Shield,
  User,
  LogOut,
  ExternalLink,
  Menu,
  Bell,
  CheckCheck,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle,
  ShoppingBag,
  Package,
  ShieldCheck,
  Wrench,
  Cpu,
  RotateCcw
} from 'lucide-react';

interface NavbarProps {
  onOpenPortal: () => void;
  activeTab: string;
  onNavigate?: (tab: string) => void;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenPortal,
  activeTab,
  onNavigate,
  onToggleMobileMenu
}) => {
  const { user, profile, role, signOut, setTestRoleOverride } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [panelOpen, setPanelOpen] = useState<boolean>(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const allRoles: RoleName[] = ['super_admin', 'admin', 'sales', 'inventory', 'service', 'support', 'technician', 'dealer'];

  const getRoleBadgeClass = (r: RoleName | null) => {
    switch (r) {
      case 'super_admin': return 'badge-purple';
      case 'admin': return 'badge-cyan';
      case 'sales': return 'badge-emerald';
      case 'inventory': return 'badge-amber';
      case 'service': return 'badge-rose';
      case 'technician': return 'badge-blue';
      case 'dealer': return 'badge-warning';
      default: return 'badge-slate';
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadNotificationSummary();

      // Setup Supabase Realtime channel fallback with 15s interval
      const channel = supabase
        .channel('public-notifications-navbar')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${user.id}` },
          () => {
            loadNotificationSummary();
          }
        )
        .subscribe();

      const pollInterval = setInterval(() => {
        loadNotificationSummary();
      }, 15000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollInterval);
      };
    }
  }, [user]);

  // Close dropdown panel on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotificationSummary = async () => {
    if (!user?.id) return;
    try {
      // 1. Get count
      const { data: countData, error: countErr } = await supabase.rpc('get_unread_notification_count');
      if (!countErr && typeof countData === 'number') {
        setUnreadCount(countData);
      } else {
        const { count } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_user_id', user.id)
          .eq('is_read', false);
        setUnreadCount(count || 0);
      }

      // 2. Fetch top 5 recent notifications
      const { data: listData } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentNotifications(listData || []);
    } catch (err) {
      console.error('Error loading navbar notifications:', err);
    }
  };

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await supabase.rpc('mark_notification_read', { p_notification_id: id });
      setRecentNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(c => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await supabase.rpc('mark_all_notifications_read');
      setRecentNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleNotificationClick = (item: any) => {
    if (!item.is_read) {
      handleMarkRead(item.id, { stopPropagation: () => {} } as any);
    }
    setPanelOpen(false);
    if (item.action_url && onNavigate) {
      onNavigate(item.action_url.replace('/', ''));
    } else if (onNavigate) {
      onNavigate('notifications');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sale_created':
      case 'payment_received':
        return <ShoppingBag size={14} style={{ color: 'var(--accent-emerald)' }} />;
      case 'inventory_low':
      case 'inventory_transfer':
        return <Package size={14} style={{ color: 'var(--accent-cyan)' }} />;
      case 'warranty_registered':
      case 'warranty_expiring':
        return <ShieldCheck size={14} style={{ color: 'var(--accent-purple)' }} />;
      case 'service_created':
        return <Wrench size={14} style={{ color: 'var(--accent-rose)' }} />;
      case 'spare_part_low_stock':
        return <Cpu size={14} style={{ color: 'var(--accent-amber)' }} />;
      case 'rma_created':
        return <RotateCcw size={14} style={{ color: 'var(--accent-amber)' }} />;
      default:
        return <Bell size={14} style={{ color: 'var(--accent-blue)' }} />;
    }
  };

  return (
    <header style={{
      height: '64px',
      borderBottom: '1px solid var(--border-card)',
      background: 'rgba(16, 19, 28, 0.92)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Mobile Hamburger Button */}
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }}
            title="Toggle Menu"
          >
            <Menu size={20} />
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/zuvo-official-logo.png"
            alt="ZUVO Android TV"
            style={{
              height: '34px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 8px rgba(20, 241, 196, 0.25))'
            }}
          />
          <span className="navbar-version-badge" style={{
            fontSize: '0.65rem',
            background: 'rgba(20, 241, 196, 0.1)',
            border: '1px solid rgba(20, 241, 196, 0.25)',
            padding: '2px 8px',
            borderRadius: '9999px',
            color: 'var(--accent-mint)',
            fontWeight: 700
          }}>
            ENTERPRISE
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Notification Bell Dropdown */}
        <div style={{ position: 'relative' }} ref={panelRef}>
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="btn btn-secondary btn-sm"
            style={{
              padding: '6px 10px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: unreadCount > 0 ? 'rgba(6, 182, 212, 0.5)' : 'var(--border-subtle)'
            }}
            title="Notifications & Alerts Center"
          >
            <Bell size={18} style={{ color: unreadCount > 0 ? 'var(--accent-cyan)' : 'inherit' }} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: 'var(--accent-rose)',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 800,
                borderRadius: '999px',
                padding: '2px 6px',
                lineHeight: 1,
                boxShadow: '0 0 8px rgba(244, 63, 94, 0.6)'
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Interactive Notification Panel */}
          {panelOpen && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '48px',
              width: '360px',
              maxWidth: '90vw',
              background: '#0F172A',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.7)',
              zIndex: 100,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'rgba(255, 255, 255, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={16} style={{ color: 'var(--accent-cyan)' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="badge badge-rose" style={{ fontSize: '0.65rem' }}>{unreadCount} unread</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {recentNotifications.length > 0 ? (
                  recentNotifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: item.is_read ? 'transparent' : 'rgba(6, 182, 212, 0.06)',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'flex-start',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ paddingTop: '2px' }}>
                        {getTypeIcon(item.notification_type)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontWeight: item.is_read ? 600 : 800, fontSize: '0.825rem', color: '#fff' }}>
                            {item.title}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.3 }}>
                          {item.message}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No notifications yet.
                  </div>
                )}
              </div>

              <div style={{
                padding: '10px 16px',
                borderTop: '1px solid var(--border-subtle)',
                background: 'rgba(255, 255, 255, 0.02)',
                textAlign: 'center'
              }}>
                <button
                  onClick={() => {
                    setPanelOpen(false);
                    if (onNavigate) onNavigate('notifications');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-cyan)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  View All Notifications →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Customer Portal Quick Launcher */}
        <button
          onClick={onOpenPortal}
          className="btn btn-secondary btn-sm"
          style={{ borderColor: 'rgba(6, 182, 212, 0.4)', color: 'var(--accent-cyan)', padding: '6px 10px' }}
          title="Customer Barcode Warranty Scanner"
        >
          <ExternalLink size={14} />
          <span className="navbar-portal-text">Warranty Portal</span>
        </button>

        {/* Role Testing Sandbox Switcher */}
        <div className="navbar-role-switcher" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.04)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <Shield size={14} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
          <select
            value={role || 'support'}
            onChange={(e) => setTestRoleOverride(e.target.value as RoleName)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              maxWidth: '90px'
            }}
          >
            {allRoles.map((r) => (
              <option key={r} value={r} style={{ background: '#111827', color: '#fff' }}>
                {r.toUpperCase()}
              </option>
            ))}
          </select>
          <span className={`badge ${getRoleBadgeClass(role)}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
            {role || 'SUPPORT'}
          </span>
        </div>

        {/* User Info / Logout */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="navbar-user-info" style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {profile?.full_name || user.email?.split('@')[0]}
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 10px' }}
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <User size={14} />
          </div>
        )}
      </div>
    </header>
  );
};
