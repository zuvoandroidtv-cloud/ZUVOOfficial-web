
import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavTabId } from './components/layout/Sidebar';
import { BarcodeLookupModal } from './components/common/BarcodeLookupModal';
import './index.css';

// CRM Pages
import { DashboardPage } from './pages/DashboardPage';
import { OperationsPlanningPage } from './pages/OperationsPlanningPage';
import { GrowthEnginePage } from './pages/GrowthEnginePage';
import { SupplyChainControlPage } from './pages/SupplyChainControlPage';
import { ServiceOperationsPage } from './pages/ServiceOperationsPage';
import { ProductsPage } from './pages/ProductsPage';
import { ManufacturingPage } from './pages/ManufacturingPage';
import { InventoryPage } from './pages/InventoryPage';
import { InventoryValuationPage } from './pages/InventoryValuationPage';
import { ProcurementPage } from './pages/ProcurementPage';
import { ProcurementManagementPage } from './pages/ProcurementManagementPage';
import { CustomersPage } from './pages/CustomersPage';
import { SalesPage } from './pages/SalesPage';
import { SalesOrderFulfillmentPage } from './pages/SalesOrderFulfillmentPage';
import { OrderToCashManagementPage } from './pages/OrderToCashManagementPage';
import { CommercialReturnsCreditNotesPage } from './pages/CommercialReturnsCreditNotesPage';
import { DealerIncentiveSchemesPage } from './pages/DealerIncentiveSchemesPage';
import { DealersPage } from './pages/DealersPage';
import { WarrantyPage } from './pages/WarrantyPage';
import { ServicePage } from './pages/ServicePage';
import { TechnicianPage } from './pages/TechnicianPage';
import { SparePartsPage } from './pages/SparePartsPage';
import { FinancePage } from './pages/FinancePage';
import { FinancialControlsPage } from './pages/FinancialControlsPage';
import { FixedAssetsPage } from './pages/FixedAssetsPage';
import { BankReconciliationPage } from './pages/BankReconciliationPage';
import { BudgetaryControlPage } from './pages/BudgetaryControlPage';
import { WithholdingTaxTdsPage } from './pages/WithholdingTaxTdsPage';
import { PayrollManagementPage } from './pages/PayrollManagementPage';
import { SecurityCompliancePage } from './pages/SecurityCompliancePage';
import { FinanceCommercialIntelligencePage } from './pages/FinanceCommercialIntelligencePage';
import { EnterpriseExecutionPage } from './pages/EnterpriseExecutionPage';
import { WorkforceManagementPage } from './pages/WorkforceManagementPage';
import { IntegrationCommandCenterPage } from './pages/IntegrationCommandCenterPage';
import { EnterpriseGovernancePage } from './pages/EnterpriseGovernancePage';
import { ReportsPage } from './pages/ReportsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { CommunicationsPage } from './pages/CommunicationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { CustomerWarrantyPortal } from './pages/CustomerWarrantyPortal';
import { CustomerSurveyPage } from './pages/CustomerSurveyPage';
import { CsatPage } from './pages/CsatPage';
import { LoginPage } from './pages/LoginPage';

// Dealer Portal Pages
import { DealerDashboardPage } from './pages/DealerDashboardPage';
import { DealerInventoryPage } from './pages/DealerInventoryPage';
import { DealerSalesPage } from './pages/DealerSalesPage';
import { DealerWarrantyPage } from './pages/DealerWarrantyPage';
import { DealerServicePage } from './pages/DealerServicePage';
import { DealerRmaPage } from './pages/DealerRmaPage';
import { DealerNotificationsPage } from './pages/DealerNotificationsPage';
import { DealerProfilePage } from './pages/DealerProfilePage';

import { Tv, ShieldCheck, ArrowLeft, Globe } from 'lucide-react';

export const App: React.FC = () => {
  const { session, isLoading, role } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPublicPortal, setShowPublicPortal] = useState(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();

      // If user specifically requests staff/login/crm, don't show public portal
      if (
        searchParams.get('view') === 'login' ||
        searchParams.get('mode') === 'login' ||
        path.endsWith('/login') ||
        path.endsWith('/staff') ||
        path.endsWith('/crm') ||
        hash === '#login' ||
        hash === '#staff' ||
        hash === '#crm'
      ) {
        return false;
      }

      return (
        searchParams.get('view') === 'warranty' ||
        searchParams.get('mode') === 'warranty' ||
        searchParams.get('portal') === 'warranty' ||
        hash === '#warranty' ||
        hash === '#/warranty' ||
        path.endsWith('/warranty')
      );
    }
    return false;
  });

  const [surveyToken, setSurveyToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''
      );
      return (
        searchParams.get('survey') ||
        searchParams.get('token') ||
        hashParams.get('survey') ||
        hashParams.get('token')
      );
    }
    return null;
  });

  // Auto-switch default tab based on user role
  useEffect(() => {
    if (role === 'dealer' && !activeTab.startsWith('dealer_')) {
      setActiveTab('dealer_dashboard');
    } else if (role === 'technician' && activeTab !== 'technician') {
      setActiveTab('technician');
    }
  }, [role]);

  const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="animate-spin" style={{ width: 44, height: 44, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>ZUVO TV CRM</h2>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>Initialising secure connection...</p>
      </div>
    );
  }

  // 1. If public customer survey is accessed
  if (surveyToken) {
    return (
      <CustomerSurveyPage
        token={surveyToken}
        onExit={() => {
          setSurveyToken(null);
          if (window.history.pushState) {
            const url = new URL(window.location.href);
            url.searchParams.delete('survey');
            url.searchParams.delete('token');
            window.history.pushState({}, '', url.pathname);
          }
        }}
      />
    );
  }

  // 2. If public customer portal mode is toggled or user is unauthenticated and wants public warranty portal
  if (showPublicPortal) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        {!isEmbedded && (
          <header style={{ minHeight: '60px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Tv size={18} />
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.125rem' }}>ZUVO Television</span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setShowPublicPortal(false);
                if (window.history.pushState) {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('view');
                  url.searchParams.delete('mode');
                  window.history.pushState({}, '', url.pathname);
                }
              }}
            >
              <ArrowLeft size={15} /> {session ? 'Back to CRM Staff Portal' : 'Staff Login'}
            </button>
          </header>
        )}
        <main style={{ padding: isEmbedded ? '1rem' : '1.5rem 1rem' }}>
          <CustomerWarrantyPortal />
        </main>
      </div>
    );
  }

  // 2. Unauthenticated user: Show Login with quick button to Customer Portal
  if (!session) {
    return (
      <div className="crm-app-scope" style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
        <header style={{ minHeight: '60px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Tv size={20} style={{ color: 'var(--brand-primary)' }} />
            <span style={{ fontWeight: 800 }}>ZUVO TV CRM</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <a
              href="/"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', textDecoration: 'none' }}
              title="Return to ZUVO Official Public Website"
            >
              <Globe size={14} /> Official Website
            </a>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPublicPortal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
            >
              <ShieldCheck size={15} style={{ color: 'var(--status-success)' }} /> Warranty Portal
            </button>
          </div>
        </header>
        <main style={{ flex: 1, padding: '0 0.5rem' }}>
          <LoginPage />
        </main>
      </div>
    );
  }

  // 3. Authenticated CRM Staff App Shell
  const renderActiveModule = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigate={(tab) => setActiveTab(tab as NavTabId)}
            onOpenBarcodeModal={() => setBarcodeModalOpen(true)}
          />
        );
      case 'operations_planning':
        return <OperationsPlanningPage />;
      case 'growth_engine':
        return <GrowthEnginePage />;
      case 'supply_chain':
        return <SupplyChainControlPage />;
      case 'service_operations':
        return <ServiceOperationsPage />;
      case 'notifications':
        return <NotificationsPage onNavigate={(tab) => setActiveTab(tab as NavTabId)} />;
      case 'communications':
        return <CommunicationsPage />;
      case 'csat':
        return <CsatPage isDealerScope={false} />;
      case 'products':
        return <ProductsPage />;
      case 'manufacturing':
        return <ManufacturingPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'inventory_valuation':
        return <InventoryValuationPage />;
      case 'procurement':
        return <ProcurementManagementPage />;
      case 'customers':
        return <CustomersPage />;
      case 'sales':
        return <SalesPage />;
      case 'sales_order_fulfillment':
        return <SalesOrderFulfillmentPage />;
      case 'order_to_cash':
        return <OrderToCashManagementPage />;
      case 'commercial_returns':
        return <CommercialReturnsCreditNotesPage />;
      case 'dealer_incentives':
        return <DealerIncentiveSchemesPage />;
      case 'dealers':
        return <DealersPage />;
      case 'warranty':
        return <WarrantyPage />;
      case 'service':
        return <ServicePage />;
      case 'technician':
        return <TechnicianPage />;
      case 'spare_parts':
        return <SparePartsPage />;
      case 'finance':
        return <FinancePage />;
      case 'controls':
        return <FinancialControlsPage />;
      case 'fixed_assets':
        return <FixedAssetsPage />;
      case 'treasury':
        return <BankReconciliationPage />;
      case 'budgetary_control':
        return <BudgetaryControlPage />;
      case 'withholding_tax':
        return <WithholdingTaxTdsPage />;
      case 'payroll':
        return <PayrollManagementPage />;
      case 'security_compliance':
        return <SecurityCompliancePage />;
      case 'finance_intelligence':
        return <FinanceCommercialIntelligencePage />;
      case 'enterprise_execution':
        return <EnterpriseExecutionPage />;
      case 'workforce':
        return <WorkforceManagementPage />;
      case 'integration_command':
        return <IntegrationCommandCenterPage />;
      case 'enterprise_governance':
        return <EnterpriseGovernancePage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;

      // Dealer Self-Service Portal
      case 'dealer_dashboard':
        return <DealerDashboardPage />;
      case 'dealer_inventory':
        return <DealerInventoryPage />;
      case 'dealer_sales':
        return <DealerSalesPage />;
      case 'dealer_warranty':
        return <DealerWarrantyPage />;
      case 'dealer_service':
        return <DealerServicePage />;
      case 'dealer_rma':
        return <DealerRmaPage />;
      case 'dealer_csat':
        return <CsatPage isDealerScope={true} />;
      case 'dealer_notifications':
        return <DealerNotificationsPage />;
      case 'dealer_profile':
        return <DealerProfilePage />;

      default:
        if (role === 'dealer') {
          return <DealerDashboardPage />;
        }
        if (role === 'technician') {
          return <TechnicianPage />;
        }
        return (
          <DashboardPage
            onNavigate={(tab) => setActiveTab(tab as NavTabId)}
            onOpenBarcodeModal={() => setBarcodeModalOpen(true)}
          />
        );
    }
  };

  return (
    <div className="crm-app-scope" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onNavigate={(tab) => setActiveTab(tab as NavTabId)}
        onOpenPortal={() => setShowPublicPortal(true)}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Main Body with Sidebar + Content */}
      <div className="app-body" style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 64px)', minWidth: 0, position: 'relative' }}>
        {/* Mobile Backdrop Overlay */}
        {mobileMenuOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenBarcodeModal={() => setBarcodeModalOpen(true)}
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        <main className="page-wrapper" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          {renderActiveModule()}
        </main>
      </div>

      {/* Global Barcode Scanner Modal */}
      <BarcodeLookupModal
        isOpen={barcodeModalOpen}
        onClose={() => setBarcodeModalOpen(false)}
        onRegisterWarranty={() => {
          setActiveTab('warranty');
          setBarcodeModalOpen(false);
        }}
        onCreateServiceTicket={() => {
          setActiveTab('service');
          setBarcodeModalOpen(false);
        }}
        onReceiveUnit={() => {
          setActiveTab('products');
          setBarcodeModalOpen(false);
        }}
      />
    </div>
  );
};
