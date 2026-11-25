import { useState, type FC, type FormEvent } from 'react';
import {
  Box,
  Typography,
  Button,
  InputBase,
  Paper,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import { AuthApi } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: { username: string; role: string }) => void;
}

export const LoginPage: FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [selectedRole, setSelectedRole] = useState<'admin' | 'superadmin'>('admin');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [superUsername, setSuperUsername] = useState('');
  const [superPassword, setSuperPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const currentUsername = selectedRole === 'superadmin' ? superUsername : adminUsername;
  const currentPassword = selectedRole === 'superadmin' ? superPassword : adminPassword;

  const handleUsernameChange = (val: string) => {
    if (selectedRole === 'superadmin') {
      setSuperUsername(val);
    } else {
      setAdminUsername(val);
    }
  };

  const handlePasswordChange = (val: string) => {
    if (selectedRole === 'superadmin') {
      setSuperPassword(val);
    } else {
      setAdminPassword(val);
    }
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const targetUser = currentUsername.trim();
    const targetPass = currentPassword.trim();

    if (!targetUser || !targetPass) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await AuthApi.login({
        username: targetUser,
        password: targetPass,
        role: selectedRole,
      });

      if (res && res.token) {
        localStorage.setItem('bussy_bee_auth_token', res.token);
        localStorage.setItem(
          'bussy_bee_auth_user',
          JSON.stringify(res.user || { username: targetUser, role: selectedRole })
        );
        onLoginSuccess(res.user || { username: targetUser, role: selectedRole });
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setErrorMsg(
        err.message || 'Invalid username or password. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const isSuper = selectedRole === 'superadmin';
  const themePrimary = isSuper ? '#7C3AED' : '#0B4DB7';
  const themeBgLight = isSuper ? '#F5F3FF' : '#EEF2FF';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 50%, #EEF9FA 0%, #DEF2F6 50%, #CFEAF1 100%)',
        p: 2.5,
        boxSizing: 'border-box',
      }}
    >
      <Paper
        elevation={0}
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          p: { xs: 3.5, sm: '40px 36px 32px 36px' },
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.9)',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Top Icon Badge */}
        <Box
          sx={{
            width: 54,
            height: 54,
            borderRadius: '14px',
            backgroundColor: themeBgLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
            transition: 'background-color 0.2s ease',
          }}
        >
          {isSuper ? (
            <WorkspacePremiumRoundedIcon sx={{ fontSize: 30, color: '#7C3AED' }} />
          ) : (
            <ShieldOutlinedIcon sx={{ fontSize: 30, color: '#0B4DB7' }} />
          )}
        </Box>

        {/* Heading */}
        <Typography
          variant="h1"
          sx={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#0F172A',
            textAlign: 'center',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            mb: 0.6,
          }}
        >
          {isSuper ? 'Super Admin Login' : 'Admin Login'}
        </Typography>

        {/* Subtitle */}
        <Typography
          sx={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#64748B',
            textAlign: 'center',
            letterSpacing: '-0.01em',
            mb: 2.8,
          }}
        >
          {isSuper
            ? 'Complete access with All Customers & Financial Ledgers'
            : 'Operational access for Billing, Products & Customers'}
        </Typography>

        {/* Role Segmented Pill Selector */}
        <Box
          sx={{
            display: 'flex',
            backgroundColor: '#F1F5F9',
            borderRadius: '10px',
            p: 0.5,
            mb: 2.8,
            border: '1px solid #E2E8F0',
          }}
        >
          <Button
            fullWidth
            type="button"
            disableElevation
            onClick={() => {
              setSelectedRole('admin');
              setErrorMsg('');
            }}
            startIcon={<ShieldOutlinedIcon sx={{ fontSize: '17px !important' }} />}
            sx={{
              py: 0.9,
              fontSize: '13.5px',
              fontWeight: selectedRole === 'admin' ? 700 : 500,
              textTransform: 'none',
              borderRadius: '8px',
              color: selectedRole === 'admin' ? '#0B4DB7' : '#64748B',
              backgroundColor: selectedRole === 'admin' ? '#FFFFFF' : 'transparent',
              boxShadow: selectedRole === 'admin' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
              '&:hover': {
                backgroundColor: selectedRole === 'admin' ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
              },
            }}
          >
            Admin
          </Button>

          <Button
            fullWidth
            type="button"
            disableElevation
            onClick={() => {
              setSelectedRole('superadmin');
              setErrorMsg('');
            }}
            startIcon={<WorkspacePremiumRoundedIcon sx={{ fontSize: '18px !important' }} />}
            sx={{
              py: 0.9,
              fontSize: '13.5px',
              fontWeight: selectedRole === 'superadmin' ? 700 : 500,
              textTransform: 'none',
              borderRadius: '8px',
              color: selectedRole === 'superadmin' ? '#7C3AED' : '#64748B',
              backgroundColor: selectedRole === 'superadmin' ? '#FFFFFF' : 'transparent',
              boxShadow: selectedRole === 'superadmin' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
              '&:hover': {
                backgroundColor: selectedRole === 'superadmin' ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
              },
            }}
          >
            Super Admin
          </Button>
        </Box>

        {/* Error Alert if any */}
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2.2, borderRadius: '8px', fontSize: '13px', py: 0.5 }}>
            {errorMsg}
          </Alert>
        )}

        {/* Username Field */}
        <Box sx={{ mb: 2.2 }}>
          <Typography
            component="label"
            htmlFor="username-input"
            sx={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              mb: 0.8,
              letterSpacing: '-0.01em',
            }}
          >
            Username
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              px: 1.6,
              height: '46px',
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#CBD5E1',
              },
              '&:focus-within': {
                borderColor: themePrimary,
                backgroundColor: '#FFFFFF',
                boxShadow: `0 0 0 2px ${isSuper ? 'rgba(124, 58, 237, 0.12)' : 'rgba(11, 77, 183, 0.12)'}`,
              },
            }}
          >
            <InputBase
              id="username-input"
              fullWidth
              placeholder={isSuper ? 'superadmin' : 'admin'}
              value={currentUsername}
              onChange={(e) => handleUsernameChange(e.target.value)}
              autoComplete="username"
              sx={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#0F172A',
                '& input': {
                  p: 0,
                  '&::placeholder': {
                    color: '#94A3B8',
                    opacity: 1,
                  },
                },
              }}
            />
          </Box>
        </Box>

        {/* Password Field */}
        <Box sx={{ mb: 3 }}>
          <Typography
            component="label"
            htmlFor="password-input"
            sx={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              mb: 0.8,
              letterSpacing: '-0.01em',
            }}
          >
            Password
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              px: 1.6,
              height: '46px',
              gap: 1.2,
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#CBD5E1',
              },
              '&:focus-within': {
                borderColor: themePrimary,
                backgroundColor: '#FFFFFF',
                boxShadow: `0 0 0 2px ${isSuper ? 'rgba(124, 58, 237, 0.12)' : 'rgba(11, 77, 183, 0.12)'}`,
              },
            }}
          >
            <LockOutlinedIcon
              sx={{
                color: '#94A3B8',
                fontSize: 18,
                flexShrink: 0,
              }}
            />

            <InputBase
              id="password-input"
              fullWidth
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => handlePasswordChange(e.target.value)}
              autoComplete="current-password"
              sx={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#0F172A',
                '& input': {
                  p: 0,
                  letterSpacing: showPassword ? 'normal' : '0.15em',
                  '&::placeholder': {
                    color: '#94A3B8',
                    opacity: 1,
                    letterSpacing: 'normal',
                  },
                },
              }}
            />

            <IconButton
              size="small"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              sx={{
                color: '#94A3B8',
                p: 0.5,
                '&:hover': {
                  color: '#475569',
                },
              }}
            >
              {showPassword ? (
                <VisibilityOffOutlinedIcon sx={{ fontSize: 19 }} />
              ) : (
                <VisibilityOutlinedIcon sx={{ fontSize: 19 }} />
              )}
            </IconButton>
          </Box>
        </Box>

        {/* Login Button */}
        <Button
          type="submit"
          fullWidth
          variant="contained"
          disableElevation
          disabled={loading}
          endIcon={!loading && <ArrowForwardRoundedIcon sx={{ fontSize: '18px !important' }} />}
          sx={{
            backgroundColor: isSuper ? '#7C3AED' : '#003EB0',
            color: '#FFFFFF',
            height: '46px',
            borderRadius: '8px',
            fontSize: '14.5px',
            fontWeight: 700,
            textTransform: 'none',
            letterSpacing: '-0.01em',
            boxShadow: isSuper
              ? '0 2px 8px rgba(124, 58, 237, 0.25)'
              : '0 2px 8px rgba(0, 62, 176, 0.25)',
            transition: 'background-color 0.15s ease',
            '&:hover': {
              backgroundColor: isSuper ? '#6D28D9' : '#003399',
            },
            '&.Mui-disabled': {
              backgroundColor: isSuper ? '#C4B5FD' : '#93C5FD',
              color: '#FFFFFF',
            },
          }}
        >
          {loading ? (
            <CircularProgress size={22} sx={{ color: '#FFFFFF' }} />
          ) : (
            `Login as ${isSuper ? 'Super Admin' : 'Admin'}`
          )}
        </Button>

        {/* Bottom subtle brand footer */}
        <Box
          sx={{
            mt: 3.5,
            borderTop: '1px solid #F1F5F9',
            pt: 1.5,
            textAlign: 'center',
          }}
        >
          <Typography sx={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>
            Bussy Bee Billing & Management System
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};
