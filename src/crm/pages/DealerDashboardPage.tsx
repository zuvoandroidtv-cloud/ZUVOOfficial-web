import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Package,
  ShoppingBag,
  ShieldCheck,
  Wrench,
  RotateCcw,
  Bell,
  Building2,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { UnlinkedDealerAlert } from '../components/common/UnlinkedDealerAlert';

export const DealerDashboardPage: React.FC = () => {
  const { profile, user } = useAuth();
  const dealerId = profile?.dealer_id;

  const [loading, setLoading] = useState(true);
  const [dealerInfo, setDealerInfo] = useState<any>(null);
  const [inventoryStats, setInventoryStats] = useState<any>(null);
  const [salesStats, setSalesStats] = useState<any>(null);
  const [warrantyStats, setWarrantyStats] = useState<any>(null);
  const [serviceStats, setServiceStats] = useState<any>(null);
  const [rmaStats, setRmaStats] = useState<any>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!dealerId) {
      setLoading(false);
      return;
    }

    const loadDashboardData = async () => {
      setLoading(true);
      try {
        // Dealer Info
        const { data: dlr } = await supabase
          .from('dealers')
          .select('*')
          .eq('id', dealerId)
          .single();
        setDealerInfo(dlr);

        // Inventory Summary
        const { data: inv } = await supabase
          .from('vw_dealer_inventory_summary')
          .select('*')
          .eq('dealer_id', dealerId)
          .maybeSingle();
        setInventoryStats(inv);

        // Sales Performance
        const { data: sls } = await supabase
          .from('vw_dealer_sales_performance')
          .select('*')
          .eq('dealer_id', dealerId)
          .maybeSingle();
        setSalesStats(sls);

        // Warranty Summary
        const { data: wrn } = await supabase
          .from('vw_dealer_warranty_summary')
          .select('*')
          .eq('dealer_id', dealerId)
          .maybeSingle();
        setWarrantyStats(wrn);

        // Service Summary
        const { data: srv } = await supabase
          .from('vw_dealer_service_summary')
          .select('*')
          .eq('dealer_id', dealerId)
          .maybeSingle();
        setServiceStats(srv);

        // RMA Summary
        const { data: rma } = await supabase
          .from('vw_dealer_rma_summary')
          .select('*')
          .eq('dealer_id', dealerId)
          .maybeSingle();
        setRmaStats(rma);

        // Recent Sales
        const { data: rSales } = await supabase
          .from('sales')
          .select('*, customers(full_name, phone)')
          .eq('dealer_id', dealerId)
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentSales(rSales || []);

        // Notifications
        if (user) {
          const { data: ntf } = await supabase
            .from('notifications')
            .select('*')
            .eq('recipient_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);
          setRecentNotifications(ntf || []);
        }
      } catch (err) {
        console.error('Error loading dealer dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [dealerId, user]);

  if (loading) {
    return (
      <div className="module-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div className="animate-spin" style={{ width: 36, height: 36, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
        <p className="text-muted">Loading dealer self-service portal...</p>
      </div>
    );
  }

  if (!dealerId) {
    return (
      <div className="module-container">
        <UnlinkedDealerAlert />
      </div>
    );
  }

  return (
    <div className="module-container">
      {/* Header Banner */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(124, 58, 237, 0.04) 100%)', borderColor: 'rgba(37, 99, 235, 0.2)' }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span className="badge badge-primary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {dealerInfo?.dealer_type || 'Dealer'} Portal
              </span>
              <span className="badge badge-neutral" style={{ fontFamily: 'monospace' }}>
                {dealerInfo?.dealer_code}
              </span>
            </div>
            <h1 className="title-md" style={{ fontSize: '1.5rem', marginTop: '0.25rem' }}>
              Welcome, {dealerInfo?.dealer_name || profile?.full_name}
            </h1>
            <p className="text-muted" style={{ fontSize: '0.875rem' }}>
              {[dealerInfo?.city, dealerInfo?.state].filter(Boolean).join(', ') || 'Authorized ZUVO TV Partner'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CREDIT LIMIT</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
              ₹{(dealerInfo?.credit_limit || 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Available Stock */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>AVAILABLE STOCK</span>
            <Package size={20} style={{ color: 'var(--brand-primary)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {inventoryStats?.in_stock_count || 0} <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)' }}>units</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Total assigned: {inventoryStats?.total_assigned_units || 0}
          </div>
        </div>

        {/* Total Sales */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL SALES VOLUME</span>
            <ShoppingBag size={20} style={{ color: 'var(--status-success)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--status-success)' }}>
            ₹{(salesStats?.total_sales_amount || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {salesStats?.total_sales_count || 0} sales ({salesStats?.total_units_sold || 0} units sold)
          </div>
        </div>

        {/* Active Warranties */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACTIVE WARRANTIES</span>
            <ShieldCheck size={20} style={{ color: 'var(--brand-secondary)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {warrantyStats?.active_warranties || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Total registered: {warrantyStats?.total_warranties || 0}
          </div>
        </div>

        {/* Open Service Tickets */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>OPEN SERVICE TICKETS</span>
            <Wrench size={20} style={{ color: 'var(--status-warning)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--status-warning)' }}>
            {(serviceStats?.open_tickets || 0) + (serviceStats?.in_progress_tickets || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Total tickets: {serviceStats?.total_tickets || 0}
          </div>
        </div>

        {/* Pending RMAs */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>PENDING RMAs</span>
            <RotateCcw size={20} style={{ color: 'var(--status-danger)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--status-danger)' }}>
            {rmaStats?.pending_returns || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Approved returns: {rmaStats?.approved_returns || 0}
          </div>
        </div>
      </div>

      {/* Two Column Layout for Recent Sales & Notifications */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Recent Dealer Sales */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingBag size={18} style={{ color: 'var(--brand-primary)' }} /> Recent Sales Orders
            </h3>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No recent sales orders recorded yet
                    </td>
                  </tr>
                ) : (
                  recentSales.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.sale_number}</td>
                      <td>{s.customers?.full_name || 'Customer'}</td>
                      <td>{new Date(s.sale_date).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>₹{(s.total_amount || 0).toLocaleString()}</td>
                      <td>
                        <span className="badge badge-success" style={{ textTransform: 'capitalize' }}>
                          {s.sale_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notifications Feed */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} style={{ color: 'var(--brand-secondary)' }} /> Recent Notifications
          </h3>
          {recentNotifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No new dealer alerts or updates
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentNotifications.map((n) => (
                <div key={n.id} style={{ padding: '0.75rem', borderRadius: '0.375rem', background: 'var(--bg-secondary)', borderLeft: '3px solid var(--brand-primary)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{n.title}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{n.message}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
