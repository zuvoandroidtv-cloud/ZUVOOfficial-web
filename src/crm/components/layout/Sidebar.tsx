import React from 'react';
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
} from 'lucide-react';

export type NavTabId =
  | 'dashboard'
  | 'manufacturing'
  | 'products'
  | 'inventory'
  | 'inventory_valuation'
  | 'procurement'
  | 'customers'
  | 'sales'
  | 'sales_order_fulfillment'
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

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenBarcodeModal,
  isOpen = false,
  onClose
}) => {
  const { role, isAllowed } = useAuth();

  const handleTabClick = (tab: NavTabId) => {
    onSelectTab(tab);
    if (onClose) onClose();
  };

  const navItems: NavItem[] = [
    // Staff Nav Items
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      allowedRoles: ['super_admin', 'admin', 'sales', 'inventory', 'service', 'support'],
    },
    {
      id: 'notifications',
      label: 'Notifications & Alerts',
      icon: Bell,
      allowedRoles: ['super_admin', 'admin', 'sales', 'inventory', 'service', 'support'],
    },
    {
      id: 'communications',
      label: 'Communications & Messaging',
      icon: MessageSquare,
      allowedRoles: ['super_admin', 'admin', 'sales', 'service', 'support'],
    },
    {
      id: 'csat',
      label: 'Customer CSAT',
      icon: Star,
      allowedRoles: ['super_admin', 'admin', 'service', 'support'],
    },
    {
      id: 'products',
      label: 'Products & Units',
      icon: Tv,
      allowedRoles: ['super_admin', 'admin', 'inventory', 'sales', 'service', 'support'],
    },
    {
      id: 'manufacturing',
      label: 'Manufacturing & WIP',
      icon: Factory,
      allowedRoles: ['super_admin', 'admin', 'inventory', 'sales'],
      badge: 'BOM',
    },
    {
      id: 'inventory',
      label: 'Inventory & Hubs',
      icon: Warehouse,
      allowedRoles: ['super_admin', 'admin', 'inventory'],
    },
    {
      id: 'inventory_valuation',
      label: 'Inventory Valuation & Margin',
      icon: DollarSign,
      allowedRoles: ['super_admin', 'admin', 'inventory', 'sales'],
      badge: 'COGS',
    },
    {
      id: 'procurement',
      label: 'Procurement (Vendors & POs)',
      icon: Truck,
      allowedRoles: ['super_admin', 'admin', 'inventory'],
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: Users,
      allowedRoles: ['super_admin', 'admin', 'sales', 'support'],
    },
    {
      id: 'sales',
      label: 'Sales & Invoices',
      icon: ShoppingCart,
      allowedRoles: ['super_admin', 'admin', 'sales'],
    },
    {
      id: 'sales_order_fulfillment',
      label: 'B2B Orders & Fulfillment',
      icon: PackageCheck,
      allowedRoles: ['super_admin', 'admin', 'sales', 'inventory'],
      badge: 'B2B',
    },
    {
      id: 'commercial_returns',
      label: 'Returns & Credit Notes',
      icon: RotateCcw,
      allowedRoles: ['super_admin', 'admin', 'sales', 'inventory'],
      badge: 'RMA',
    },
    {
      id: 'dealer_incentives',
      label: 'Incentives & Rebates',
      icon: Award,
      allowedRoles: ['super_admin', 'admin', 'sales'],
      badge: 'REBATE',
    },
    {
      id: 'dealers',
      label: 'Dealers (B2B)',
      icon: Store,
      allowedRoles: ['super_admin', 'admin', 'sales', 'inventory'],
    },
    {
      id: 'warranty',
      label: 'Warranty Hub',
      icon: ShieldCheck,
      allowedRoles: ['super_admin', 'admin', 'service', 'sales', 'support'],
    },
    {
      id: 'service',
      label: 'Service Tickets',
      icon: Wrench,
      allowedRoles: ['super_admin', 'admin', 'service', 'support'],
    },
    {
      id: 'technician',
      label: 'Field Service (Mobile)',
      icon: Wrench,
      allowedRoles: ['super_admin', 'admin', 'service', 'support', 'technician'],
      badge: 'Mobile',
    },
    {
      id: 'spare_parts',
      label: 'Spare Parts',
      icon: Cpu,
      allowedRoles: ['super_admin', 'admin', 'service', 'inventory'],
    },
    {
      id: 'finance',
      label: 'Finance & GL',
      icon: Scale,
      allowedRoles: ['super_admin', 'admin', 'sales'],
    },
    {
      id: 'controls',
      label: 'Financial Controls',
      icon: ShieldAlert,
      allowedRoles: ['super_admin', 'admin', 'sales'],
    },
    {
      id: 'fixed_assets',
      label: 'Fixed Assets (PPE)',
      icon: PackageCheck,
      allowedRoles: ['super_admin', 'admin', 'sales'],
    },
    {
      id: 'treasury',
      label: 'Treasury & BRS',
      icon: Landmark,
      allowedRoles: ['super_admin', 'admin', 'sales'],
    },
    {
      id: 'budgetary_control',
      label: 'Budgetary Control & CC',
      icon: PieChart,
      allowedRoles: ['super_admin', 'admin', 'sales', 'inventory'],
      badge: 'FICO',
    },
    {
      id: 'withholding_tax',
      label: 'TDS & Withholding Tax',
      icon: Percent,
      allowedRoles: ['super_admin', 'admin', 'sales', 'inventory'],
      badge: 'TAX',
    },
    {
      id: 'reports',
      label: 'Reports (20 Views)',
      icon: BarChart3,
      allowedRoles: ['super_admin', 'admin', 'sales', 'inventory', 'service', 'support'],
      badge: '20',
    },
    {
      id: 'settings',
      label: 'Settings & RBAC',
      icon: Settings,
      allowedRoles: ['super_admin', 'admin'],
    },

    // Dealer Self-Service Portal Nav Items
    {
      id: 'dealer_dashboard',
      label: 'Dealer Dashboard',
      icon: LayoutDashboard,
      allowedRoles: ['dealer'],
    },
    {
      id: 'dealer_inventory',
      label: 'Dealer Stock',
      icon: Warehouse,
      allowedRoles: ['dealer'],
    },
    {
      id: 'dealer_sales',
      label: 'Dealer Sales',
      icon: ShoppingCart,
      allowedRoles: ['dealer'],
    },
    {
      id: 'dealer_warranty',
      label: 'Dealer Warranties',
      icon: ShieldCheck,
      allowedRoles: ['dealer'],
    },
    {
      id: 'dealer_service',
      label: 'Service Requests',
      icon: Wrench,
      allowedRoles: ['dealer'],
    },
    {
      id: 'dealer_rma',
      label: 'Return Requests (RMA)',
      icon: Store,
      allowedRoles: ['dealer'],
    },
    {
      id: 'dealer_csat',
      label: 'Customer CSAT',
      icon: Star,
      allowedRoles: ['dealer'],
    },
    {
      id: 'dealer_notifications',
      label: 'Dealer Notifications',
      icon: Bell,
      allowedRoles: ['dealer'],
    },
    {
      id: 'dealer_profile',
      label: 'Dealer Profile',
      icon: Settings,
      allowedRoles: ['dealer'],
    },
  ];

  const visibleItems = navItems.filter((item) => isAllowed(item.allowedRoles));

  return (
    <aside
      className={`sidebar-container ${isOpen ? 'open' : ''}`}
      style={{
        width: '240px',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 14px',
        flexShrink: 0,
      }}
    >
      <div>
        <div style={{ padding: '0 8px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            CRM Modules
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)' }}>
            {visibleItems.length} active
          </span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(59, 130, 246, 0.15))' : 'transparent',
                  border: isActive ? '1px solid var(--border-accent)' : '1px solid transparent',
                  color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={18} style={{ color: isActive ? 'var(--accent-cyan)' : 'inherit' }} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-full)',
                    background: isActive ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.1)',
                    color: isActive ? '#000' : '#fff',
                    fontWeight: 700,
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Quick Action: Barcode Search Tool */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '12px',
        textAlign: 'center',
      }}>
        <button
          onClick={onOpenBarcodeModal}
          className="btn btn-primary"
          style={{ width: '100%', fontSize: '0.8rem', padding: '8px' }}
        >
          <QrCode size={16} />
          Scan Barcode / Serial
        </button>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px' }}>
          Hardware Scanner Ready
        </div>
      </div>
    </aside>
  );
};
