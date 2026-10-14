import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import { Bell, CheckCircle, Clock, AlertTriangle, ShieldCheck, Wrench, ShoppingBag } from 'lucide-react';

export const DealerNotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching dealer notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Error updating notification read status:', err);
    }
  };

  return (
    <div className="module-container" style={{ maxWidth: '800px' }}>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell style={{ color: 'var(--brand-primary)' }} /> Dealer Notification Center
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            In-app alerts for sales orders, warranty approvals, service updates, and stock movements
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: '1.25rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
            <p className="text-muted">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem' }}>
            <Bell size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Notifications</h3>
            <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              You have no unread or historical alerts at this time.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  background: n.is_read ? 'var(--bg-secondary)' : 'rgba(37, 99, 235, 0.04)',
                  borderLeft: `4px solid ${
                    n.severity === 'urgent' || n.severity === 'high' ? 'var(--status-danger)' :
                    n.severity === 'warning' ? 'var(--status-warning)' : 'var(--brand-primary)'
                  }`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1rem'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{n.title}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{n.message}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
                {!n.is_read && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleMarkAsRead(n.id)}
                    style={{ fontSize: '0.75rem' }}
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
