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
  QrCode,
  TrendingUp,
  TrendingDown,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Sparkles
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
  const [productVariants, setProductVariants] = useState<any[]>([]);
  const [activeTimeframe, setActiveTimeframe] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Yearly'>('Yearly');
  const [searchQuery, setSearchQuery] = useState('');
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

      // 3. Fetch product catalog for Best Selling Products table
      const { data: pvData } = await supabase
        .from('product_variants')
        .select('id, product_name, screen_size, tv_type, product_code, standard_manufacturing_cost')
        .order('screen_size', { ascending: true });

      setProductVariants(pvData || []);

      // 4. Fetch recent service tickets
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

      // 5. Fetch notification alert breakdown
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

  // Filtered variants for Best Selling Products
  const filteredVariants = productVariants.filter(v =>
    !searchQuery ||
    v.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.product_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* 1. Dashboard Overview Hero Header with Aurora Teal Radial Glow & Global Search (Reference NickelFox) */}
      <div style={{
        background: 'radial-gradient(ellipse 90% 120% at 50% -30%, rgba(20, 241, 196, 0.28) 0%, rgba(6, 182, 212, 0.15) 35%, rgba(12, 14, 20, 0.98) 85%)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px 28px',
        border: '1px solid var(--border-card)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '18px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-mint)' }}>
              Enterprise Cockpit
            </span>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent-mint)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Live Sync</span>
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#FFFFFF', margin: 0 }}>
            Dashboard Overview
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            Real-time television serialized production, hub inventory, and warranty lifecycle metrics.
          </p>
        </div>

        {/* Global Search Bar & Quick Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search for anything..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(14, 17, 26, 0.85)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-lg)',
                padding: '9px 16px 9px 38px',
                color: '#FFFFFF',
                fontSize: '0.85rem',
                outline: 'none',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
                transition: 'border-color 0.15s ease'
              }}
            />
          </div>

          <button
            onClick={onOpenBarcodeModal}
            className="btn btn-primary"
            style={{ padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <QrCode size={16} /> Scan Hardware
          </button>
        </div>
      </div>

      {/* Zero-State Operational Callout Banner */}
      {(overview?.total_product_units ?? 0) === 0 && (
        <div style={{
          background: 'rgba(20, 241, 196, 0.04)',
          border: '1px dashed rgba(20, 241, 196, 0.4)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>No operational data yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '520px' }}>
            Start by adding your first product or serialized inventory unit. When new TV units are received, your real stock, warranty, and sales metrics will populate automatically.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
            <button
              onClick={() => onNavigate('products')}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Tv size={15} style={{ color: 'var(--accent-mint)' }} /> + Add Product
            </button>
            <button
              onClick={() => onNavigate('products')}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <PackageCheck size={15} style={{ color: 'var(--accent-emerald)' }} /> + Add Unit
            </button>
            <button
              onClick={onOpenBarcodeModal}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <QrCode size={15} /> Scan Barcode
            </button>
          </div>
        </div>
      )}

      {/* 2. Top Metric KPI Cards with Glowing Sparkline Waves (Reference NickelFox Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
        {/* Today's Revenue / Inventory Valuation Card */}
        <div className="stat-card" style={{ minHeight: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-label">Stock Valuation</div>
              <div className="stat-val">
                ₹{((overview?.total_product_units || 0) * 12500).toLocaleString('en-IN')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: 'rgba(20, 241, 196, 0.12)',
                  color: 'var(--accent-mint)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px'
                }}>
                  <TrendingUp size={12} /> 100%
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Factory Direct</span>
              </div>
            </div>

            {/* Glowing Neon Wave SVG Sparkline */}
            <svg width="90" height="50" viewBox="0 0 90 50" fill="none" style={{ filter: 'drop-shadow(0 0 6px rgba(20, 241, 196, 0.6))' }}>
              <path
                d="M 2 35 Q 20 10, 35 25 T 65 15 T 88 5"
                stroke="#14F1C4"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>

        {/* Physical TV Units In Stock */}
        <div className="stat-card" style={{ minHeight: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-label">In-Stock TV Units</div>
              <div className="stat-val" style={{ color: '#FFFFFF' }}>
                {overview?.units_in_stock ?? 0}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: 'rgba(6, 182, 212, 0.12)',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px'
                }}>
                  <Warehouse size={12} /> Central Hub
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Serialized</span>
              </div>
            </div>

            {/* Cyan Wave Sparkline */}
            <svg width="90" height="50" viewBox="0 0 90 50" fill="none" style={{ filter: 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.6))' }}>
              <path
                d="M 2 20 Q 25 45, 45 20 T 75 35 T 88 15"
                stroke="#06B6D4"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>

        {/* Active Warranties Card */}
        <div className="stat-card" style={{ minHeight: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-label">Active Warranties</div>
              <div className="stat-val" style={{ color: '#FFFFFF' }}>
                {overview?.active_warranties ?? 0}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: 'rgba(168, 85, 247, 0.12)',
                  color: 'var(--accent-purple)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px'
                }}>
                  <ShieldCheck size={12} /> Protected
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Registered</span>
              </div>
            </div>

            {/* Purple Wave Sparkline */}
            <svg width="90" height="50" viewBox="0 0 90 50" fill="none" style={{ filter: 'drop-shadow(0 0 6px rgba(168, 85, 247, 0.6))' }}>
              <path
                d="M 2 30 Q 22 5, 45 30 T 70 10 T 88 20"
                stroke="#A855F7"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>

        {/* Service & RMA Pipeline Card */}
        <div className="stat-card" style={{ minHeight: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-label">Open Service Tickets</div>
              <div className="stat-val" style={{ color: (overview?.open_service_tickets || 0) > 0 ? 'var(--accent-rose)' : '#FFFFFF' }}>
                {overview?.open_service_tickets ?? 0}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: (overview?.open_service_tickets || 0) > 0 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                  color: (overview?.open_service_tickets || 0) > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px'
                }}>
                  <Wrench size={12} /> {(overview?.open_service_tickets || 0) > 0 ? 'Pending' : 'Healthy'}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SLA Active</span>
              </div>
            </div>

            {/* Rose/Green Wave Sparkline */}
            <svg width="90" height="50" viewBox="0 0 90 50" fill="none" style={{ filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.6))' }}>
              <path
                d="M 2 40 Q 20 20, 40 35 T 70 15 T 88 5"
                stroke="#10B981"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. Middle Analytics Charts Section (Sales Analytics Wave Chart + Returns Bar Chart) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '18px' }}>
        {/* Sales Analytics Chart Card (Reference NickelFox Smooth Glowing Wave) */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>Sales Analytics</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.775rem' }}>Television distribution trends & dispatch volume</p>
            </div>

            {/* Timeframe Filter Pills (Daily, Weekly, Monthly, Yearly) */}
            <div style={{
              display: 'flex',
              background: '#0e111a',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '3px'
            }}>
              {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setActiveTimeframe(tf)}
                  style={{
                    background: activeTimeframe === tf ? 'var(--bg-card)' : 'transparent',
                    color: activeTimeframe === tf ? '#FFFFFF' : 'var(--text-secondary)',
                    fontWeight: activeTimeframe === tf ? 700 : 500,
                    fontSize: '0.75rem',
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: activeTimeframe === tf ? '1px solid var(--border-accent)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic / Zero-State Sales Analytics Display */}
          {(overview?.total_product_units ?? 0) === 0 ? (
            <div style={{
              height: '200px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px dashed var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              textAlign: 'center'
            }}>
              <TrendingUp size={36} style={{ color: 'var(--accent-mint)', opacity: 0.6, marginBottom: '8px' }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#FFFFFF' }}>No sales data yet</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: '380px', marginTop: '4px' }}>
                Add and fulfill sales orders to begin tracking television distribution trends & monthly dispatch volume.
              </p>
              <button
                onClick={() => onNavigate('sales')}
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '10px', fontSize: '0.75rem' }}
              >
                + Create First Sale
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative', width: '100%', height: '200px' }}>
              <svg width="100%" height="100%" viewBox="0 0 700 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="waveGlowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14F1C4" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#14F1C4" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#14F1C4" />
                    <stop offset="50%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="40" x2="700" y2="40" stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
                <line x1="0" y1="90" x2="700" y2="90" stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
                <line x1="0" y1="140" x2="700" y2="140" stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
                <path
                  d="M 10 140 Q 70 80, 130 160 T 250 110 T 370 140 T 490 90 T 610 130 T 690 40 L 690 190 L 10 190 Z"
                  fill="url(#waveGlowGrad)"
                />
                <path
                  d="M 10 140 Q 70 80, 130 160 T 250 110 T 370 140 T 490 90 T 610 130 T 690 40"
                  stroke="url(#lineGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(20, 241, 196, 0.7))' }}
                />
                <circle cx="690" cy="40" r="5" fill="#14F1C4" style={{ filter: 'drop-shadow(0 0 8px #14F1C4)' }} />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Returns / RMA Bar Chart Card */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>Returns & RMA</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.775rem' }}>Defect & claim rate</p>
              </div>
              <span style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                background: '#0e111a',
                padding: '4px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-card)'
              }}>
                Current Period
              </span>
            </div>

            {(overview?.open_service_tickets ?? 0) === 0 ? (
              <div style={{
                height: '140px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px dashed var(--border-card)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                textAlign: 'center'
              }}>
                <ShieldCheck size={32} style={{ color: 'var(--accent-emerald)', opacity: 0.8, marginBottom: '6px' }} />
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>0 Returns & Claims</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  No warranty claims or RMA requests recorded.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '140px', paddingTop: '20px' }}>
                {[
                  { month: 'Jan', val: 0, color: '#14F1C4' },
                  { month: 'Feb', val: 0, color: '#06B6D4' },
                  { month: 'Mar', val: 0, color: '#3B82F6' },
                  { month: 'Apr', val: overview?.open_service_tickets || 0, color: '#14F1C4' },
                ].map((b) => (
                  <div key={b.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '18px',
                      height: `${Math.max(4, Math.min(100, b.val * 10))}px`,
                      borderRadius: '8px 8px 3px 3px',
                      background: b.color,
                      boxShadow: `0 0 10px ${b.color}55`,
                      transition: 'height 0.3s ease'
                    }} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{b.month}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#0e111a',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            marginTop: '14px'
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Overall Warranty Health</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-mint)' }}>
              {(overview?.open_service_tickets ?? 0) === 0 ? '100% Quality' : 'Active Cases'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Best Selling Products Table (Reference NickelFox Clean Table) */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>Best Selling TV Models</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.775rem' }}>Official catalog specifications, pricing, and factory inventory</p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => onNavigate('products')}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <SlidersHorizontal size={13} /> Filter By
            </button>
            <button
              onClick={() => onNavigate('products')}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              Manage Catalog <ArrowRight size={13} />
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Model / Series</th>
                <th>Display Spec</th>
                <th>Manufacturing Cost</th>
                <th>Stock Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVariants.length > 0 ? (
                filteredVariants.map((pv, idx) => (
                  <tr key={pv.id} style={{ transition: 'background 0.15s ease' }}>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-mint)', fontWeight: 700, fontSize: '0.8rem' }}>
                      #{pv.product_code || `ZUV-${idx + 100}`}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #181d2c, #0e111a)',
                          border: '1px solid var(--border-card)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-mint)'
                        }}>
                          <Tv size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{pv.product_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ZUVO Android TV Series</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span className="badge badge-slate">{pv.screen_size}" Display</span>
                        <span className="badge badge-cyan">{pv.tv_type}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.875rem' }}>
                      ₹{Number(pv.standard_manufacturing_cost || 12500).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className="badge badge-emerald">
                        ● In Catalog
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => onNavigate('products')}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      >
                        Receive Unit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No product variants matched your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Warehouse Multi-Location Stock Distribution & Service Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px' }}>
        {/* Warehouse Multi-Location Stock Distribution */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Warehouse size={18} style={{ color: 'var(--accent-mint)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF' }}>Stock Distribution by Facility</h3>
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
                      <td style={{ color: 'var(--accent-mint)', fontWeight: 800 }}>
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
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF' }}>Service & Warranty Feed</h3>
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
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: '#0e111a',
                  border: '1px solid var(--border-card)',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#FFFFFF' }}>{tkt.ticket_number}</div>
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
