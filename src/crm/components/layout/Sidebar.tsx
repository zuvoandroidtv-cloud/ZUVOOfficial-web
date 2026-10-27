import React, { useState } from 'react';
import { useAuth, RoleName } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Tv,
  Warehouse,
  Users,
  ShoppingCart,
  Store,
  ShieldCheck,
  Wrench,
  Cpu,
  BarChart3,
  Settings,
  QrCode,
  Bell,
  MessageSquare,
  Truck,
  Star,
  Scale,
  ShieldAlert,
  PackageCheck,
  Landmark,
  Factory,
  DollarSign,
  PieChart,
  RotateCcw,
  Award,
  Percent,
  Wallet,
  TrendingUp,
  Boxes,
  CheckSquare,
  Network,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

export type NavTabId =
  | 'dashboard'
  | 'operations_planning'
  | 'growth_engine'
  | 'supply_chain'
  | 'service_operations'
  | 'manufacturing'
  | 'products'
  | 'inventory'
  | 'inventory_valuation'
  | 'procurement'
  | 'customers'
  | 'sales'
  | 'sales_order_fulfillment'
  | 'order_to_cash'
  | 'commercial_returns'
  | 'dealer_incentives'
  | 'dealers'
  | 'warranty'
  | 'service'
  | 'technician'
  | 'spare_parts'
  | 'finance'
  | 'controls'
  | 'fixed_assets'
  | 'treasury'
  | 'budgetary_control'
  | 'withholding_tax'
  | 'payroll'
  | 'security_compliance'
  | 'finance_intelligence'
  | 'enterprise_execution'
  | 'workforce'
  | 'integration_command'
  | 'enterprise_governance'
  | 'reports'
  | 'notifications'
  | 'communications'
  | 'csat'
  | 'settings'
  | 'dealer_dashboard'
  | 'dealer_inventory'
  | 'dealer_sales'
  | 'dealer_warranty'
  | 'dealer_service'
  | 'dealer_rma'
  | 'dealer_csat'
  | 'dealer_notifications'
  | 'dealer_profile';

interface SidebarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  onOpenBarcodeModal: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  id: NavTabId;
  label: string;
  icon: any;
  allowedRoles: RoleName[];
  badge?: string;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenBarcodeModal,
  isOpen = false,
  onClose
}) => {
  const { role, profile, user, isAllowed } = useAuth();
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleCategory = (title: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const handleTabClick = (tab: NavTabId) => {
    onSelectTab(tab);
    if (onClose) onClose();
  };

  const isDealerRole = role === 'dealer';

  // Organized enterprise category structure
  const categories: NavCategory[] = isDealerRole ? [
    {
      title: 'Dealer Portal',
      items: [
        { id: 'dealer_dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['dealer'] },
        { id: 'dealer_inventory', label: 'Dealer Stock', icon: Warehouse, allowedRoles: ['dealer'] },
        { id: 'dealer_sales', label: 'Dealer Sales', icon: ShoppingCart, allowedRoles: ['dealer'] },
        { id: 'dealer_warranty', label: 'Warranties', icon: ShieldCheck, allowedRoles: ['dealer'] },
        { id: 'dealer_service', label: 'Service Requests', icon: Wrench, allowedRoles: ['dealer'] },
        { id: 'dealer_rma', label: 'Returns (RMA)', icon: Store, allowedRoles: ['dealer'] },
        { id: 'dealer_csat', label: 'Customer CSAT', icon: Star, allowedRoles: ['dealer'] },
        { id: 'dealer_notifications', label: 'Notifications', icon: Bell, allowedRoles: ['dealer'] },
        { id: 'dealer_profile', label: 'Dealer Profile', icon: Settings, allowedRoles: ['dealer'] },
      ]
    }
  ] : [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['super_admin', 'admin', 'sales', 'inventory', 'service', 'support'] },
        { id: 'operations_planning', label: 'Planning & Intel', icon: TrendingUp, allowedRoles: ['super_admin', 'admin', 'sales', 'inventory', 'service'], badge: 'INTEL' },
      ]
    },
    {
      title: 'PRODUCTS & INVENTORY',
      items: [
        { id: 'products', label: 'Products & Units', icon: Tv, allowedRoles: ['super_admin', 'admin', 'inventory', 'sales', 'service', 'support'] },
        { id: 'inventory', label: 'Warehouses & Stock', icon: Warehouse, allowedRoles: ['super_admin', 'admin', 'inventory'] },
        { id: 'supply_chain', label: 'Supply Chain Matrix', icon: Boxes, allowedRoles: ['super_admin', 'admin', 'inventory', 'sales', 'service'], badge: 'SCM' },
        { id: 'inventory_valuation', label: 'Valuation & Margin', icon: DollarSign, allowedRoles: ['super_admin', 'admin', 'inventory', 'sales'], badge: 'COGS' },
        { id: 'manufacturing', label: 'Manufacturing & BOM', icon: Factory, allowedRoles: ['super_admin', 'admin', 'inventory', 'sales'], badge: 'BOM' },
      ]
    },
    {
      title: 'SALES & COMMERCIAL',
      items: [
        { id: 'sales', label: 'Sales Orders', icon: ShoppingCart, allowedRoles: ['super_admin', 'admin', 'sales'] },
        { id: 'sales_order_fulfillment', label: 'B2B Fulfillment', icon: PackageCheck, allowedRoles: ['super_admin', 'admin', 'sales', 'inventory'], badge: 'B2B' },
        { id: 'order_to_cash', label: 'Order to Cash (O2C)', icon: TrendingUp, allowedRoles: ['super_admin', 'admin', 'sales', 'inventory'], badge: 'O2C' },
        { id: 'customers', label: 'Customers', icon: Users, allowedRoles: ['super_admin', 'admin', 'sales', 'support'] },
        { id: 'dealers', label: 'Dealers & Partners', icon: Store, allowedRoles: ['super_admin', 'admin', 'sales', 'inventory'] },
        { id: 'dealer_incentives', label: 'Incentives & Slabs', icon: Award, allowedRoles: ['super_admin', 'admin', 'sales'], badge: 'REBATE' },
        { id: 'commercial_returns', label: 'Returns & Credit Notes', icon: RotateCcw, allowedRoles: ['super_admin', 'admin', 'sales', 'inventory'], badge: 'RMA' },
        { id: 'growth_engine', label: 'Growth Engine', icon: Users, allowedRoles: ['super_admin', 'admin', 'sales', 'support'], badge: 'GROWTH' },
      ]
    },
    {
      title: 'SERVICE & WARRANTY',
      items: [
        { id: 'service', label: 'Service Tickets', icon: Wrench, allowedRoles: ['super_admin', 'admin', 'service', 'support'] },
        { id: 'service_operations', label: 'Field Ops & SLA', icon: Wrench, allowedRoles: ['super_admin', 'admin', 'service', 'inventory', 'support'], badge: 'SLA' },
        { id: 'technician', label: 'Technician Hub', icon: Wrench, allowedRoles: ['super_admin', 'admin', 'service', 'support', 'technician'], badge: 'Mobile' },
        { id: 'warranty', label: 'Warranty Hub', icon: ShieldCheck, allowedRoles: ['super_admin', 'admin', 'service', 'sales', 'support'] },
        { id: 'spare_parts', label: 'Spare Parts Catalog', icon: Cpu, allowedRoles: ['super_admin', 'admin', 'service', 'inventory'] },
        { id: 'csat', label: 'Customer CSAT', icon: Star, allowedRoles: ['super_admin', 'admin', 'service', 'support'] },
      ]
    },
    {
      title: 'OPERATIONS & SCM',
      items: [
        { id: 'procurement', label: 'Procurement (P2P)', icon: Truck, allowedRoles: ['super_admin', 'admin', 'inventory', 'sales'], badge: 'P2P' },
        { id: 'workforce', label: 'Workforce & HR', icon: Users, allowedRoles: ['super_admin', 'admin', 'sales', 'service', 'support'], badge: 'HR' },
        { id: 'enterprise_execution', label: 'Task Execution', icon: CheckSquare, allowedRoles: ['super_admin', 'admin', 'sales', 'inventory', 'service', 'support'], badge: 'EXEC' },
      ]
    },
    {
      title: 'FINANCE & CONTROL',
      items: [
        { id: 'finance', label: 'General Ledger', icon: Scale, allowedRoles: ['super_admin', 'admin', 'sales'] },
        { id: 'controls', label: 'Financial Controls', icon: ShieldAlert, allowedRoles: ['super_admin', 'admin', 'sales'] },
        { id: 'treasury', label: 'Treasury & Bank Rec', icon: Landmark, allowedRoles: ['super_admin', 'admin', 'sales'], badge: 'BANK' },
        { id: 'budgetary_control', label: 'Cost Centers & Budgets', icon: PieChart, allowedRoles: ['super_admin', 'admin', 'sales'] },
        { id: 'withholding_tax', label: 'TDS Governance', icon: Percent, allowedRoles: ['super_admin', 'admin', 'sales'], badge: 'TDS' },
        { id: 'payroll', label: 'Payroll & Expenses', icon: Wallet, allowedRoles: ['super_admin', 'admin', 'sales'], badge: 'PAY' },
        { id: 'fixed_assets', label: 'Fixed Assets (PPE)', icon: PackageCheck, allowedRoles: ['super_admin', 'admin', 'sales'] },
        { id: 'finance_intelligence', label: 'Financial Intel', icon: DollarSign, allowedRoles: ['super_admin', 'admin', 'sales'], badge: 'CFO' },
      ]
    },
    {
      title: 'COMMUNICATIONS & ALERTS',
      items: [
        { id: 'notifications', label: 'Notification Center', icon: Bell, allowedRoles: ['super_admin', 'admin', 'sales', 'inventory', 'service', 'support'] },
        { id: 'communications', label: 'SMS & Comms Gateway', icon: MessageSquare, allowedRoles: ['super_admin', 'admin', 'sales', 'service', 'support'] },
        { id: 'integration_command', label: 'Integration Queue', icon: Network, allowedRoles: ['super_admin', 'admin'], badge: 'SYNC' },
      ]
    },
    {
      title: 'ANALYTICS & GOVERNANCE',
      items: [
        { id: 'reports', label: 'Executive Analytics', icon: BarChart3, allowedRoles: ['super_admin', 'admin', 'sales', 'inventory', 'service', 'support'] },
        { id: 'security_compliance', label: 'Security & RLS Audit', icon: ShieldAlert, allowedRoles: ['super_admin', 'admin'], badge: 'AUDIT' },
        { id: 'enterprise_governance', label: 'Governance & Rules', icon: Settings, allowedRoles: ['super_admin', 'admin'], badge: 'GOV' },
        { id: 'settings', label: 'System Settings', icon: Settings, allowedRoles: ['super_admin', 'admin'] },
      ]
    }
  ];

  return (
    <aside
      className={`sidebar-container ${isOpen ? 'open' : ''}`}
      style={{
        width: isSidebarCollapsed ? '76px' : '268px',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-card)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '18px 12px',
        flexShrink: 0,
        transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        height: 'calc(100vh - 64px)',
        position: 'sticky',
        top: '64px',
        overflowY: 'hidden',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Brand / Logo Section */}
        <div style={{
          padding: '4px 6px 16px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '14px'
        }}>
          {!isSidebarCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src="/zuvo-official-logo.png"
                alt="ZUVO Android TV"
                style={{
                  height: '32px',
                  maxWidth: '160px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 8px rgba(20, 241, 196, 0.2))'
                }}
              />
            </div>
          ) : (
            <img
              src="/zuvo-official-logo.png"
              alt="ZUVO"
              style={{
                height: '24px',
                width: '36px',
                objectFit: 'cover',
                objectPosition: 'left center'
              }}
            />
          )}

          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="btn btn-secondary btn-sm"
            style={{
              padding: '6px',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.04)',
              color: 'var(--text-muted)',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Scrollable Categorized Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {categories.map((category) => {
            const visibleCategoryItems = category.items.filter(item => isAllowed(item.allowedRoles));
            if (visibleCategoryItems.length === 0) return null;

            const isCollapsed = !!collapsedCategories[category.title];

            return (
              <div key={category.title} className="sidebar-category-group">
                {!isSidebarCollapsed && (
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.title)}
                    className="sidebar-category-header"
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'var(--text-muted)',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      padding: '8px 8px 4px 8px'
                    }}
                  >
                    <span>{category.title}</span>
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}

                {(!isCollapsed || isSidebarCollapsed) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                    {visibleCategoryItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleTabClick(item.id)}
                          title={isSidebarCollapsed ? item.label : undefined}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
                            width: '100%',
                            padding: isSidebarCollapsed ? '10px 0' : '10px 14px',
                            borderRadius: 'var(--radius-md)',
                            background: isActive
                              ? 'linear-gradient(90deg, #14F1C4 0%, #06B6D4 100%)'
                              : 'transparent',
                            color: isActive ? '#0c0e14' : 'var(--text-secondary)',
                            fontWeight: isActive ? 800 : 500,
                            fontSize: '0.84rem',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                            border: 'none',
                            boxShadow: isActive ? '0 4px 16px rgba(20, 241, 196, 0.35)' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                            <Icon size={18} style={{ color: isActive ? '#0c0e14' : 'inherit', flexShrink: 0 }} />
                            {!isSidebarCollapsed && (
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.label}
                              </span>
                            )}
                          </div>
                          {!isSidebarCollapsed && item.badge && (
                            <span style={{
                              fontSize: '0.62rem',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-full)',
                              background: isActive ? '#0c0e14' : 'rgba(255, 255, 255, 0.08)',
                              color: isActive ? '#14F1C4' : 'var(--text-secondary)',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile / Quick Actions Card (Reference Kabir Singh Profile Style) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
        {/* User Card */}
        {!isSidebarCollapsed ? (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #14F1C4, #3B82F6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#0c0e14',
              fontSize: '0.9rem',
              flexShrink: 0
            }}>
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'Z'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name || 'Staff User'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-mint)', textTransform: 'capitalize', fontWeight: 600 }}>
                {role?.replace('_', ' ') || 'Super Admin'}
              </div>
            </div>
          </div>
        ) : null}

        {/* Quick Action: Barcode Scanner Modal Trigger */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-md)',
          padding: isSidebarCollapsed ? '6px 4px' : '8px 10px',
          textAlign: 'center',
        }}>
          <button
            onClick={onOpenBarcodeModal}
            className="btn btn-primary"
            style={{ width: '100%', fontSize: '0.78rem', padding: isSidebarCollapsed ? '8px 0' : '8px 10px', justifyContent: 'center' }}
            title="Open Hardware Scanner"
          >
            <QrCode size={15} />
            {!isSidebarCollapsed && <span style={{ marginLeft: '4px' }}>Scan Barcode</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};
