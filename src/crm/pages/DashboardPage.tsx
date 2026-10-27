import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Tv,
  Warehouse,
  ShieldCheck,
  Wrench,
  PackageCheck,
  ArrowRight,
  Bell,
  AlertTriangle,
  AlertOctagon,
  Cpu,
  QrCode
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: any) => void;
  onOpenBarcodeModal: () => void;
}

export const DashboardPage: React.FC<DashboardProps> = ({ onNavigate, onOpenBarcodeModal }) => {
  const { user } = useAuth();
  const [overview, setOverview] = useState<any | null>(null);
  const [stockSummary, setStockSummary] = useState<any[]>([]);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [alertSummary, setAlertSummary] = useState<{
    unreadCount: number;
    criticalCount: number;
    lowStockCount: number;
    expiringWarrantyCount: number;
  }>({
    unreadCount: 0,
    criticalCount: 0,
    lowStockCount: 0,
    expiringWarrantyCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // 0. Trigger automated alert synchronizer RPC safely
      try {
        await supabase.rpc('generate_automated_alerts');
      } catch (e) {
        // Safe fallback if RPC fails or permissions pending
      }

      // 1. Fetch CRM Overview view
      const { data: ovData } = await supabase
        .from('crm_overview')
        .select('*')
        .maybeSingle();

      setOverview(ovData || {});

      // 2. Fetch stock by warehouse view
      const { data: stData } = await supabase
        .from('stock_by_warehouse')
        .select('*')
        .limit(5);

      setStockSummary(stData || []);

      // 3. Fetch recent service tickets
      const { data: tktData } = await supabase
        .from('service_tickets')
        .select(`
          id,
          ticket_number,
          priority,
          status,
          service_type,
          created_at,
          customers:customer_id (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentTickets(tktData || []);

      // 4. Fetch notification alert breakdown
      if (user?.id) {
        const { data: notifs } = await supabase
          .from('notifications')
          .select('severity, notification_type, is_read')
          .eq('recipient_user_id', user.id);

        if (notifs) {
          const unread = notifs.filter(n => !n.is_read).length;
          const critical = notifs.filter(n => !n.is_read && n.severity === 'critical').length;
          const lowStock = notifs.filter(n => !n.is_read && (n.notification_type === 'spare_part_low_stock' || n.notification_type === 'inventory_low')).length;
          const expiringWarranty = notifs.filter(n => !n.is_read && n.notification_type === 'warranty_expiring').length;

          setAlertSummary({
            unreadCount: unread,
            criticalCount: critical,
            lowStockCount: lowStock,
            expiringWarrantyCount: expiringWarranty
          });
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome Banner */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)',
        borderColor: 'rgba(56, 189, 248, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>
            ZUVO TV Enterprise Command Center
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Integrated serialized television lifecycle, warranty registrations, and national service operations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigate('products')}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Tv size={16} style={{ color: 'var(--brand-primary)' }} /> Add / View Products
          </button>
          <button
            onClick={() => onNavigate('products')}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <PackageCheck size={16} style={{ color: 'var(--accent-emerald)' }} /> Add Unit
          </button>
          <button
            onClick={onOpenBarcodeModal}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <QrCode size={16} /> Scan Unit Barcode
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="stat-card">
          <div>
            <div className="stat-val">{overview?.total_product_units ?? 0}</div>
            <div className="stat-label">Total TV Units</div>
          </div>
          <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-cyan)' }}>
            <Tv size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-val" style={{ color: 'var(--accent-emerald)' }}>
              {overview?.units_in_stock ?? 0}
            </div>
            <div className="stat-label">In Stock Hubs</div>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-emerald)' }}>
            <Warehouse size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-val" style={{ color: '#60A5FA' }}>
              {overview?.units_sold ?? 0}
            </div>
            <div className="stat-label">Sold & Activated</div>
          </div>
          <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-blue)' }}>
            <PackageCheck size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-val" style={{ color: 'var(--accent-purple)' }}>
              {overview?.active_warranties ?? 0}
            </div>
            <div className="stat-label">Active Warranties</div>
          </div>
          <div style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-purple)' }}>
            <ShieldCheck size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-val" style={{ color: 'var(--accent-rose)' }}>
              {overview?.open_service_tickets ?? 0}
            </div>
            <div className="stat-label">Open Tickets</div>
          </div>
          <div style={{ background: 'rgba(244, 63, 94, 0.15)', padding: '12px', borderRadius: '12px', color: 'var(--accent-rose)' }}>
            <Wrench size={24} />
          </div>
        </div>
      </div>

      {/* Notifications & System Alerts Summary Widget */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={20} style={{ color: 'var(--accent-cyan)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Notifications & Critical Alerts Summary</h3>
          </div>
          <button onClick={() => onNavigate('notifications')} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            Open Notification Center <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          <div
            onClick={() => onNavigate('notifications')}
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(6, 182, 212, 0.06)',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>{alertSummary.unreadCount}</div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>Unread Notifications</div>
            </div>
            <Bell size={20} style={{ color: 'var(--accent-cyan)', opacity: 0.8 }} />
          </div>

          <div
            onClick={() => onNavigate('notifications')}
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(244, 63, 94, 0.06)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-rose)' }}>{alertSummary.criticalCount}</div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>Critical System Alerts</div>
            </div>
            <AlertOctagon size={20} style={{ color: 'var(--accent-rose)', opacity: 0.8 }} />
          </div>

          <div
            onClick={() => onNavigate('spare_parts')}
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.06)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-amber)' }}>{alertSummary.lowStockCount}</div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>Low Stock Alerts</div>
            </div>
            <Cpu size={20} style={{ color: 'var(--accent-amber)', opacity: 0.8 }} />
          </div>

          <div
            onClick={() => onNavigate('warranty')}
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(139, 92, 246, 0.06)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-purple)' }}>{alertSummary.expiringWarrantyCount}</div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>Warranty Expirations</div>
            </div>
            <AlertTriangle size={20} style={{ color: 'var(--accent-purple)', opacity: 0.8 }} />
          </div>
        </div>
      </div>

      {/* Main Grid: Warehouse Stock & Service Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Warehouse Multi-Location Stock Distribution */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Warehouse size={18} style={{ color: 'var(--accent-cyan)' }} />
              <h3 style={{ fontSize: '1.1rem' }}>Stock Distribution by Facility</h3>
            </div>
            <button onClick={() => onNavigate('inventory')} className="btn btn-secondary btn-sm">
              Manage Hubs <ArrowRight size={14} />
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Type</th>
                  <th>In Stock</th>
                  <th>Reserved</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {stockSummary.length > 0 ? (
                  stockSummary.map((wh) => (
                    <tr key={wh.warehouse_id}>
                      <td style={{ fontWeight: 600 }}>{wh.warehouse_name}</td>
                      <td>
                        <span className="badge badge-slate">{wh.warehouse_type?.replace('_', ' ')}</span>
                      </td>
                      <td style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
                        {wh.in_stock_units}
                      </td>
                      <td>{wh.reserved_units}</td>
                      <td style={{ fontWeight: 700 }}>{wh.total_units}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No stock allocated to warehouses yet. Use the Products module to receive serialized units.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Operations & Recent Service Pipeline */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wrench size={18} style={{ color: 'var(--accent-rose)' }} />
              <h3 style={{ fontSize: '1.1rem' }}>Service & Warranty Feed</h3>
            </div>
            <button onClick={() => onNavigate('service')} className="btn btn-secondary btn-sm">
              All Tickets <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentTickets.length > 0 ? (
              recentTickets.map((tkt) => (
                <div key={tkt.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{tkt.ticket_number}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Customer: {tkt.customers?.full_name || 'Walk-in'} • {tkt.service_type}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span className={`badge ${tkt.priority === 'urgent' ? 'badge-rose' : 'badge-amber'}`}>
                      {tkt.priority}
                    </span>
                    <span className="badge badge-cyan">
                      {tkt.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <ShieldCheck size={36} style={{ color: 'var(--accent-emerald)', marginBottom: '8px', opacity: 0.8 }} />
                <p style={{ fontSize: '0.875rem' }}>Zero open service tickets. All registered televisions operating normally.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
