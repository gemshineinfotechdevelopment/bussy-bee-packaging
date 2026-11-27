import { useState, useEffect, type FC, type FormEvent } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  Snackbar,
  Divider,
  InputAdornment,
  IconButton,
  Chip,
} from '@mui/material';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import { AuthApi, SettingsApi } from '../services/api';

interface SettingsPageProps {
  currentUser?: { username: string; role: string } | null;
}

export const SettingsPage: FC<SettingsPageProps> = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);

  // Admin credentials state
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);

  // Super Admin credentials state
  const [superUsername, setSuperUsername] = useState('superadmin');
  const [superPassword, setSuperPassword] = useState('');
  const [showSuperPassword, setShowSuperPassword] = useState(false);
  const [superSaving, setSuperSaving] = useState(false);

  // Company Details (Billing & Print Header) state
  const [companyName, setCompanyName] = useState<string>(
    () => localStorage.getItem('bussy_bee_company_name') || 'Sri Shanmuga Traders'
  );
  const [companyGst, setCompanyGst] = useState<string>(
    () => localStorage.getItem('bussy_bee_company_gst') || '33BUMPR9147N1ZQ'
  );
  const [companyAddress, setCompanyAddress] = useState<string>(
    () => localStorage.getItem('bussy_bee_company_address') || '352, Amman Kovil Patti Middle Street, Sivakasi - 626123'
  );
  const [companyState, setCompanyState] = useState<string>(
    () => localStorage.getItem('bussy_bee_company_state') || 'Tamil Nadu'
  );
  const [companyPhone, setCompanyPhone] = useState<string>(
    () => localStorage.getItem('bussy_bee_company_phone') || ''
  );
  const [companySaving, setCompanySaving] = useState(false);

  // Permissions / Settings state
  const [isRateEnabledForAdmin, setIsRateEnabledForAdmin] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showToast = (message: string, severity: 'success' | 'error' = 'success') => {
    setToast({ open: true, message, severity });
  };

  // Fetch initial data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Load users
        const users = await AuthApi.getUsers();
        if (users && Array.isArray(users)) {
          const adminUser = users.find((u: any) => u.role === 'admin');
          if (adminUser) setAdminUsername(adminUser.username);

          const superUser = users.find((u: any) => u.role === 'superadmin');
          if (superUser) setSuperUsername(superUser.username);
        }

        // Load settings
        const settings = await SettingsApi.getSettings();
        if (settings) {
          if (typeof settings.isRateEnabledForAdmin === 'boolean') {
            setIsRateEnabledForAdmin(settings.isRateEnabledForAdmin);
          }
          if (settings.companyName) {
            setCompanyName(settings.companyName);
            localStorage.setItem('bussy_bee_company_name', settings.companyName);
          }
          if (settings.companyGst) {
            setCompanyGst(settings.companyGst);
            localStorage.setItem('bussy_bee_company_gst', settings.companyGst);
          }
          if (settings.companyAddress) {
            setCompanyAddress(settings.companyAddress);
            localStorage.setItem('bussy_bee_company_address', settings.companyAddress);
          }
          if (settings.companyState) {
            setCompanyState(settings.companyState);
            localStorage.setItem('bussy_bee_company_state', settings.companyState);
          }
          if (settings.companyPhone !== undefined) {
            setCompanyPhone(settings.companyPhone);
            localStorage.setItem('bussy_bee_company_phone', settings.companyPhone);
          }
        }
      } catch (err) {
        console.error('Failed to load settings data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle Save Company Details
  const handleSaveCompany = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      showToast('Company Name cannot be empty', 'error');
      return;
    }
    if (!companyGst.trim()) {
      showToast('GSTIN / Tax ID cannot be empty', 'error');
      return;
    }
    if (!companyAddress.trim()) {
      showToast('Company Address cannot be empty', 'error');
      return;
    }

    try {
      setCompanySaving(true);
      const cleanName = companyName.trim();
      const cleanGst = companyGst.trim().toUpperCase();
      const cleanAddr = companyAddress.trim();
      const cleanState = companyState.trim() || 'Tamil Nadu';
      const cleanPhone = companyPhone.trim();

      await SettingsApi.updateSettings({
        companyName: cleanName,
        companyGst: cleanGst,
        companyAddress: cleanAddr,
        companyState: cleanState,
        companyPhone: cleanPhone,
      });

      // Update localStorage cache for instant client availability
      localStorage.setItem('bussy_bee_company_name', cleanName);
      localStorage.setItem('bussy_bee_company_gst', cleanGst);
      localStorage.setItem('bussy_bee_company_address', cleanAddr);
      localStorage.setItem('bussy_bee_company_state', cleanState);
      localStorage.setItem('bussy_bee_company_phone', cleanPhone);

      // Notify other active views
      window.dispatchEvent(new Event('bussy_bee_company_updated'));

      showToast('Company details updated successfully! These details will appear on all bills.');
    } catch (err: any) {
      console.error('Error updating company details:', err);
      showToast(err.message || 'Failed to update company details', 'error');
    } finally {
      setCompanySaving(false);
    }
  };

  // Handle Save Admin Credentials
  const handleSaveAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminUsername.trim()) {
      showToast('Admin username cannot be empty', 'error');
      return;
    }
    try {
      setAdminSaving(true);
      const res = await AuthApi.updateUser('admin', {
        username: adminUsername.trim(),
        ...(adminPassword.trim() ? { password: adminPassword.trim() } : {}),
      });
      showToast(res.message || 'Admin credentials updated successfully!');
      setAdminPassword('');
    } catch (err: any) {
      console.error('Error updating admin credentials:', err);
      showToast(err.message || 'Failed to update admin credentials', 'error');
    } finally {
      setAdminSaving(false);
    }
  };

  // Handle Save Super Admin Credentials
  const handleSaveSuperAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!superUsername.trim()) {
      showToast('Super Admin username cannot be empty', 'error');
      return;
    }
    try {
      setSuperSaving(true);
      const res = await AuthApi.updateUser('superadmin', {
        username: superUsername.trim(),
        ...(superPassword.trim() ? { password: superPassword.trim() } : {}),
      });

      // If current user is superadmin, update local storage username
      if (currentUser?.role === 'superadmin') {
        const updated = { ...currentUser, username: superUsername.trim().toLowerCase() };
        localStorage.setItem('bussy_bee_auth_user', JSON.stringify(updated));
      }

      showToast(res.message || 'Super Admin credentials updated successfully!');
      setSuperPassword('');
    } catch (err: any) {
      console.error('Error updating super admin credentials:', err);
      showToast(err.message || 'Failed to update super admin credentials', 'error');
    } finally {
      setSuperSaving(false);
    }
  };

  // Handle Toggle Rate for Admin
  const handleToggleRate = async (newVal: boolean) => {
    setIsRateEnabledForAdmin(newVal);
    try {
      setSettingsSaving(true);
      await SettingsApi.updateSettings({ isRateEnabledForAdmin: newVal });
      showToast(
        newVal
          ? 'Rate option enabled for Admin in Create Particular'
          : 'Rate option disabled for Admin in Create Particular'
      );
    } catch (err: any) {
      console.error('Error updating settings:', err);
      // Revert on error
      setIsRateEnabledForAdmin(!newVal);
      showToast(err.message || 'Failed to update settings', 'error');
    } finally {
      setSettingsSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={36} sx={{ color: '#0B4DB7' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '980px', mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Typography sx={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Settings & Permissions
          </Typography>
          <Chip
            label="Super Admin Only"
            size="small"
            sx={{
              backgroundColor: '#EDE9FE',
              color: '#7C3AED',
              fontWeight: 700,
              fontSize: '11px',
              height: '22px',
            }}
          />
        </Box>
        <Typography sx={{ fontSize: '13px', color: '#64748B', mt: 0.5, fontWeight: 500 }}>
          Manage login credentials, passwords, and billing screen permissions for Admin and Super Admin.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Card 0: Company Profile & Billing Header */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3 },
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '8px',
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0B4DB7',
              }}
            >
              <BusinessRoundedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                Company Details (Print & Billing Header)
              </Typography>
              <Typography sx={{ fontSize: '12px', color: '#64748B' }}>
                Configure company name, address, and GST number. These details will automatically show on all bills and estimates.
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 2.5 }} />

          <Box component="form" onSubmit={handleSaveCompany}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2.5,
                mb: 2.5,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.8 }}>
                  Company Name <span style={{ color: '#DC2626' }}>*</span>
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Sri Shanmuga Traders"
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        fontWeight: 600,
                        height: '40px',
                        borderRadius: '8px',
                      },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.8 }}>
                  GSTIN / Tax ID <span style={{ color: '#DC2626' }}>*</span>
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={companyGst}
                  onChange={(e) => setCompanyGst(e.target.value)}
                  placeholder="e.g. 33BUMPR9147N1ZQ"
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        fontWeight: 600,
                        height: '40px',
                        borderRadius: '8px',
                      },
                    },
                  }}
                />
              </Box>

              <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.8 }}>
                  Company Address <span style={{ color: '#DC2626' }}>*</span>
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="e.g. 352, Amman Kovil Patti Middle Street, Sivakasi - 626123"
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        height: '40px',
                        borderRadius: '8px',
                      },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.8 }}>
                  State Name
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={companyState}
                  onChange={(e) => setCompanyState(e.target.value)}
                  placeholder="e.g. Tamil Nadu"
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        height: '40px',
                        borderRadius: '8px',
                      },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.8 }}>
                  Contact Phone / Mobile
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        height: '40px',
                        borderRadius: '8px',
                      },
                    },
                  }}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                disableElevation
                disabled={companySaving}
                sx={{
                  backgroundColor: '#0B4DB7',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  textTransform: 'none',
                  px: 3,
                  py: 1,
                  borderRadius: '7px',
                  '&:hover': { backgroundColor: '#083B8D' },
                }}
              >
                {companySaving ? 'Saving...' : 'Save Company Details'}
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Card 1: Admin Credentials */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3 },
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '8px',
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0B4DB7',
              }}
            >
              <AdminPanelSettingsRoundedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                Admin Account Credentials
              </Typography>
              <Typography sx={{ fontSize: '12px', color: '#64748B' }}>
                Configure the username and password used to log into the standard Admin role.
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 2.5 }} />

          <Box component="form" onSubmit={handleSaveAdmin}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2.5,
                mb: 2.5,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.8 }}>
                  Admin Username <span style={{ color: '#DC2626' }}>*</span>
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Enter admin username"
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        fontWeight: 600,
                        height: '40px',
                        borderRadius: '8px',
                      },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.8 }}>
                  New Password (leave blank to keep unchanged)
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter new password"
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        height: '40px',
                        borderRadius: '8px',
                      },
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                            edge="end"
                          >
                            {showAdminPassword ? (
                              <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} />
                            ) : (
                              <VisibilityRoundedIcon sx={{ fontSize: 18 }} />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                disableElevation
                disabled={adminSaving}
                sx={{
                  backgroundColor: '#0B4DB7',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  textTransform: 'none',
                  px: 3,
                  py: 1,
                  borderRadius: '7px',
                  '&:hover': { backgroundColor: '#083B8D' },
                }}
              >
                {adminSaving ? 'Saving...' : 'Save Admin Credentials'}
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Card 2: Super Admin Credentials */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3 },
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '8px',
                backgroundColor: '#EDE9FE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#7C3AED',
              }}
            >
              <WorkspacePremiumRoundedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                Super Admin Account Credentials
              </Typography>
              <Typography sx={{ fontSize: '12px', color: '#64748B' }}>
                Configure the master Super Admin username and password.
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 2.5 }} />

          <Box component="form" onSubmit={handleSaveSuperAdmin}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2.5,
                mb: 2.5,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.8 }}>
                  Super Admin Username <span style={{ color: '#DC2626' }}>*</span>
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={superUsername}
                  onChange={(e) => setSuperUsername(e.target.value)}
                  placeholder="Enter superadmin username"
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        fontWeight: 600,
                        height: '40px',
                        borderRadius: '8px',
                      },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.8 }}>
                  New Password (leave blank to keep unchanged)
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type={showSuperPassword ? 'text' : 'password'}
                  value={superPassword}
                  onChange={(e) => setSuperPassword(e.target.value)}
                  placeholder="Enter new password"
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        height: '40px',
                        borderRadius: '8px',
                      },
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setShowSuperPassword(!showSuperPassword)}
                            edge="end"
                          >
                            {showSuperPassword ? (
                              <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} />
                            ) : (
                              <VisibilityRoundedIcon sx={{ fontSize: 18 }} />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                disableElevation
                disabled={superSaving}
                sx={{
                  backgroundColor: '#7C3AED',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  textTransform: 'none',
                  px: 3,
                  py: 1,
                  borderRadius: '7px',
                  '&:hover': { backgroundColor: '#6D28D9' },
                }}
              >
                {superSaving ? 'Saving...' : 'Save Super Admin Credentials'}
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Card 3: Particulars Rate Option Toggle for Admin */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3 },
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '8px',
                backgroundColor: '#F0FDF4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16A34A',
              }}
            >
              <TuneRoundedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                Particulars Screen Permissions (Admin Role)
              </Typography>
              <Typography sx={{ fontSize: '12px', color: '#64748B' }}>
                Control whether standard Admin users can see and enter product Rate in Particulars &gt; Create Particular.
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 2.5 }} />

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
            }}
          >
            <Box sx={{ pr: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  Rate Option for Admin (Create Particular)
                </Typography>
                <Chip
                  label={isRateEnabledForAdmin ? 'Enabled' : 'Disabled'}
                  size="small"
                  sx={{
                    height: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isRateEnabledForAdmin ? '#DCFCE7' : '#FEE2E2',
                    color: isRateEnabledForAdmin ? '#16A34A' : '#DC2626',
                  }}
                />
              </Box>
              <Typography sx={{ fontSize: '12.5px', color: '#64748B', maxWidth: '600px' }}>
                {isRateEnabledForAdmin
                  ? 'Admin users CAN enter and view the Rate input and RATE column when creating particulars.'
                  : 'Admin users CANNOT see or enter the Rate input and RATE column in Create Particular (Rate is hidden).'}
              </Typography>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={isRateEnabledForAdmin}
                  onChange={(e) => handleToggleRate(e.target.checked)}
                  disabled={settingsSaving}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#16A34A',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#16A34A',
                    },
                  }}
                />
              }
              label={
                <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  {isRateEnabledForAdmin ? 'Enabled' : 'Disabled'}
                </Typography>
              }
            />
          </Box>
        </Paper>
      </Box>

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ width: '100%', fontWeight: 600, borderRadius: '8px' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
