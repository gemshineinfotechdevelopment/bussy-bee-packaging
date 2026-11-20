import { useState, type FC, type MouseEvent } from 'react';
import { Box, Typography, Menu, MenuItem, ListItemIcon, Divider } from '@mui/material';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';

export type NavTab = 'Customers' | 'Company' | 'Product' | 'Particulars' | 'All Customers';

interface NavbarProps {
  activeTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  onNavigateCustomers?: () => void;
  onLogout?: () => void;
}

export const Navbar: FC<NavbarProps> = ({
  activeTab = 'Customers',
  onSelectTab,
  onNavigateCustomers,
  onLogout,
}) => {
  const tabs: NavTab[] = ['Customers', 'Company', 'Product', 'Particulars', 'All Customers'];
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleTabClick = (tab: NavTab) => {
    if (onSelectTab) {
      onSelectTab(tab);
    } else if (tab === 'Customers' && onNavigateCustomers) {
      onNavigateCustomers();
    }
  };

  const handleProfileClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleLogoutClick = () => {
    handleCloseMenu();
    if (onLogout) onLogout();
  };

  return (
    <Box
      component="header"
      sx={{
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #EEF2F6',
        px: { xs: 2.5, md: 4.5 },
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        boxSizing: 'border-box',
      }}
    >
      {/* Left Logo Section */}
      <Box
        onClick={() => handleTabClick('Customers')}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
      >
        {/* Stylized B Logo Badge */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#F8FAFC" />
            <path
              d="M7 5H12C13.6569 5 15 6.34315 15 8C15 9.65685 13.6569 11 12 11H7V5Z"
              stroke="#0B4DB7"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 11H13C14.6569 11 16 12.3431 16 14C16 15.6569 14.6569 17 13 17H7V11Z"
              stroke="#0B4DB7"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9.5 7.5H11.5C12.0523 7.5 12.5 7.94772 12.5 8.5C12.5 9.05228 12.0523 9.5 11.5 9.5H9.5V7.5Z"
              fill="#0B4DB7"
            />
            <path
              d="M9.5 12.5H12C12.5523 12.5 13 12.9477 13 13.5C13 14.0523 12.5523 14.5 12 14.5H9.5V12.5Z"
              fill="#0B4DB7"
            />
          </svg>
        </Box>

        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            fontSize: '18px',
            color: '#0F172A',
            letterSpacing: '-0.01em',
          }}
        >
          Bussy Bee
        </Typography>
      </Box>

      {/* Center Navigation Links */}
      <Box
        component="nav"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 3, md: 4.5 },
          height: '100%',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Box
              key={tab}
              onClick={() => handleTabClick(tab)}
              sx={{
                position: 'relative',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'color 0.15s ease',
              }}
            >
              <Typography
                sx={{
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '14.5px',
                  color: isActive ? '#0B4DB7' : '#475569',
                  letterSpacing: '-0.01em',
                  px: 0.5,
                  transition: 'color 0.15s ease',
                  '&:hover': {
                    color: '#0B4DB7',
                  },
                }}
              >
                {tab}
              </Typography>

              {/* Active indicator underline bar */}
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    backgroundColor: '#0B4DB7',
                    borderTopLeftRadius: '2px',
                    borderTopRightRadius: '2px',
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>

      {/* Right Action Icons (Profile / Logout) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          onClick={handleProfileClick}
          sx={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            backgroundColor: '#0B4DB7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 3px rgba(11, 77, 183, 0.25)',
            '&:hover': {
              backgroundColor: '#083B8D',
              transform: 'scale(1.05)',
            },
          }}
        >
          <PersonOutlineRoundedIcon sx={{ fontSize: 20, color: '#FFFFFF' }} />
        </Box>

        {/* Profile / Logout Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleCloseMenu}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          slotProps={{
            paper: {
              sx: {
                borderRadius: '10px',
                minWidth: '160px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                border: '1px solid #E2E8F0',
                mt: 1,
              },
            },
          }}
        >
          <MenuItem disabled sx={{ opacity: '1 !important', py: 1 }}>
            <ListItemIcon>
              <AdminPanelSettingsRoundedIcon sx={{ fontSize: 18, color: '#0B4DB7' }} />
            </ListItemIcon>
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                Administrator
              </Typography>
              <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                Logged In
              </Typography>
            </Box>
          </MenuItem>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={handleLogoutClick} sx={{ color: '#DC2626', py: 1 }}>
            <ListItemIcon>
              <LogoutRoundedIcon sx={{ fontSize: 18, color: '#DC2626' }} />
            </ListItemIcon>
            <Typography sx={{ fontSize: '13px', fontWeight: 600 }}>
              Logout
            </Typography>
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};
