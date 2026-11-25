import { useState } from 'react';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { theme } from './theme/theme';
import { Navbar, type NavTab } from './components/Navbar';
import { LoginPage } from './components/LoginPage';
import { CustomersPage } from './components/CustomersPage';
import { AllCustomersPage } from './components/AllCustomersPage';
import { AddCustomerPage } from './components/AddCustomerPage';
import { CompaniesPage } from './components/CompaniesPage';
import { AddCompanyPage } from './components/AddCompanyPage';
import { ProductsPage } from './components/ProductsPage';
import { ParticularsPage, type ParticularSubTab } from './components/ParticularsPage';
import { SettingsPage } from './components/SettingsPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('bussy_bee_auth_token'));
  });

  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(() => {
    try {
      const raw = localStorage.getItem('bussy_bee_auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    const saved = localStorage.getItem('bussy_bee_active_tab') as NavTab;
    let savedUser: { username: string; role: string } | null = null;
    try {
      const raw = localStorage.getItem('bussy_bee_auth_user');
      if (raw) savedUser = JSON.parse(raw);
    } catch {}

    const isSuperAdmin = savedUser?.role === 'superadmin';
    const validTabs: NavTab[] = isSuperAdmin
      ? ['Particulars', 'Product', 'All Customers', 'Customers']
      : ['Particulars', 'Product', 'Customers'];

    return validTabs.includes(saved) ? saved : 'Customers';
  });

  const [companySubView, setCompanySubView] = useState<'list' | 'add'>(() => {
    return (localStorage.getItem('bussy_bee_company_subview') as 'list' | 'add') || 'list';
  });

  const [customerSubView, setCustomerSubView] = useState<'list' | 'add'>(() => {
    return (localStorage.getItem('bussy_bee_customer_subview') as 'list' | 'add') || 'list';
  });

  const [selectedCustomerName, setSelectedCustomerName] = useState<string>(() => {
    return localStorage.getItem('bussy_bee_active_customer') || '';
  });

  const [particularInitialSubTab, setParticularInitialSubTab] = useState<ParticularSubTab>(() => {
    return (localStorage.getItem('bussy_bee_particular_subtab') as ParticularSubTab) || 'Select Customer';
  });

  const handleLoginSuccess = (user: { username: string; role: string }) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    // Standard admin should never be on 'All Customers' or 'Company'
    if (user.role !== 'superadmin' && (activeTab === 'All Customers' || activeTab === 'Company')) {
      setActiveTab('Customers');
      localStorage.setItem('bussy_bee_active_tab', 'Customers');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bussy_bee_auth_token');
    localStorage.removeItem('bussy_bee_auth_user');
    localStorage.removeItem('bussy_bee_active_tab');
    localStorage.removeItem('bussy_bee_company_subview');
    localStorage.removeItem('bussy_bee_customer_subview');
    localStorage.removeItem('bussy_bee_particular_subtab');
    localStorage.removeItem('bussy_bee_active_customer');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const handleSelectTab = (tab: NavTab) => {
    // Company is disabled in navbar
    if (tab === 'Company') return;

    // Only Super Admin can access 'All Customers' and 'Settings'
    if ((tab === 'All Customers' || tab === 'Settings') && currentUser?.role !== 'superadmin') {
      setActiveTab('Customers');
      localStorage.setItem('bussy_bee_active_tab', 'Customers');
      return;
    }

    setActiveTab(tab);
    localStorage.setItem('bussy_bee_active_tab', tab);
    if (tab === 'Particulars') {
      setSelectedCustomerName('');
      localStorage.removeItem('bussy_bee_active_customer');
      setParticularInitialSubTab('Select Customer');
      localStorage.setItem('bussy_bee_particular_subtab', 'Select Customer');
    }
    if (tab === 'Customers') {
      setCustomerSubView('list');
      localStorage.setItem('bussy_bee_customer_subview', 'list');
    }
  };

  const handleSetCompanySubView = (view: 'list' | 'add') => {
    setCompanySubView(view);
    localStorage.setItem('bussy_bee_company_subview', view);
  };

  const handleSetCustomerSubView = (view: 'list' | 'add') => {
    setCustomerSubView(view);
    localStorage.setItem('bussy_bee_customer_subview', view);
  };

  const handleCustomerSelectedForParticular = (customerName: string, subTab?: ParticularSubTab) => {
    setSelectedCustomerName(customerName);
    localStorage.setItem('bussy_bee_active_customer', customerName);
    const targetSubTab = subTab || 'Account Details';
    setParticularInitialSubTab(targetSubTab);
    localStorage.setItem('bussy_bee_particular_subtab', targetSubTab);
    setActiveTab('Particulars');
    localStorage.setItem('bussy_bee_active_tab', 'Particulars');
  };

  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: '#F8F9FD',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
        }}
      >
        <Navbar
          activeTab={activeTab}
          currentUser={currentUser}
          onSelectTab={handleSelectTab}
          onNavigateCustomers={() => {
            handleSelectTab('Customers');
            handleSetCustomerSubView('list');
          }}
          onLogout={handleLogout}
        />

        <Box component="main" sx={{ flexGrow: 1, width: '100%', overflowX: 'hidden' }}>
          {/* Particulars Tab */}
          {activeTab === 'Particulars' && (
            <ParticularsPage
              currentUser={currentUser}
              initialCustomerName={selectedCustomerName}
              initialSubTab={particularInitialSubTab}
            />
          )}

          {/* Product Tab */}
          {activeTab === 'Product' && <ProductsPage />}

          {/* Company Tab (Kept for direct programmatic view if needed, but omitted from Navbar) */}
          {activeTab === 'Company' && (
            <>
              {companySubView === 'add' ? (
                <AddCompanyPage
                  onCancel={() => handleSetCompanySubView('list')}
                  onSubmitSuccess={() => handleSetCompanySubView('list')}
                  onNavigateCompanies={() => handleSetCompanySubView('list')}
                />
              ) : (
                <CompaniesPage onAddCompany={() => handleSetCompanySubView('add')} />
              )}
            </>
          )}

          {/* All Customers Tab - ONLY accessible to Super Admin */}
          {activeTab === 'All Customers' && currentUser?.role === 'superadmin' && (
            <AllCustomersPage
              onAddNewCustomer={() => {
                handleSelectTab('Customers');
                handleSetCustomerSubView('add');
              }}
              onSelectCustomerForParticular={handleCustomerSelectedForParticular}
            />
          )}

          {/* Customers Tab */}
          {activeTab === 'Customers' && (
            <>
              {customerSubView === 'add' ? (
                <AddCustomerPage
                  onCancel={() => handleSetCustomerSubView('list')}
                  onSubmitSuccess={() => handleSetCustomerSubView('list')}
                />
              ) : (
                <CustomersPage
                  currentUser={currentUser}
                  onAddNew={() => handleSetCustomerSubView('add')}
                  onSelectCustomerForParticular={handleCustomerSelectedForParticular}
                />
              )}
            </>
          )}

          {/* Settings Tab (Super Admin Only) */}
          {activeTab === 'Settings' && currentUser?.role === 'superadmin' && (
            <SettingsPage currentUser={currentUser} />
          )}

          {/* Fallback for unauthorized or invalid tabs */}
          {(activeTab === 'All Customers' || activeTab === 'Settings') && currentUser?.role !== 'superadmin' && (
            <Box sx={{ p: 4, textAlign: 'center', color: '#DC2626' }}>
              Access restricted. Only Super Admin can access this page.
            </Box>
          )}

          {/* Other Tabs */}
          {activeTab !== 'Particulars' &&
            activeTab !== 'Product' &&
            activeTab !== 'Company' &&
            activeTab !== 'All Customers' &&
            activeTab !== 'Customers' &&
            activeTab !== 'Settings' && (
              <Box sx={{ p: 4, textAlign: 'center', color: '#64748B' }}>
                {activeTab} content coming soon.
              </Box>
            )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
