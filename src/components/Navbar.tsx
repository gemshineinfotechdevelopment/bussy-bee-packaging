import { useState, type FC, type MouseEvent } from 'react';
import {
  Box,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  Chip,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';

export type NavTab = 'Customers' | 'Product' | 'Particulars' | 'All Customers' | 'Company' | 'Settings';

interface NavbarProps {
  activeTab?: NavTab;
  currentUser?: { username: string; role: string } | null;
  onSelectTab?: (tab: NavTab) => void;
  onNavigateCustomers?: () => void;
  onLogout?: () => void;
}

export const Navbar: FC<NavbarProps> = ({
  activeTab = 'Customers',
  currentUser,
  onSelectTab,
  onNavigateCustomers,
  onLogout,
}) => {
  const isSuperAdmin = currentUser?.role === 'superadmin';

  // Company is removed from navbar
  // 'All Customers' & 'Settings' are only visible to Super Admin; Admin cannot view them
  const tabs: NavTab[] = isSuperAdmin
    ? ['Customers', 'Product', 'Particulars', 'All Customers', 'Settings']
    : ['Customers', 'Product', 'Particulars'];

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    <>
      <Box
        component="header"
        sx={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #EEF2F6',
          px: { xs: 1.5, sm: 2.5, md: 4.5 },
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
        {/* Left Section: Mobile Menu Button + Brand Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1.5 } }}>
          {/* Mobile Toolbar / Hamburger Toggle */}
          <IconButton
            onClick={() => setMobileOpen(true)}
            aria-label="Open mobile navigation"
            sx={{
              display: { xs: 'inline-flex', md: 'none' },
              color: '#0F172A',
              p: 1,
              borderRadius: '8px',
              '&:hover': { backgroundColor: '#F1F5F9' },
            }}
          >
            <MenuRoundedIcon sx={{ fontSize: 25 }} />
          </IconButton>

          <Box
            onClick={() => handleTabClick('Customers')}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.2, cursor: 'pointer' }}
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
                flexShrink: 0,
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
                fontWeight: 800,
                fontSize: { xs: '17px', sm: '19px' },
                color: '#0F172A',
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
              }}
            >
              Bussy Bee
            </Typography>
          </Box>
        </Box>

        {/* Center Navigation Links (Desktop Only: md and above) */}
        <Box
          component="nav"
          sx={{
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            gap: { md: 3, lg: 4.5 },
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 } }}>
          {/* Role Pill Badge */}
          <Chip
            size="small"
            icon={
              isSuperAdmin ? (
                <WorkspacePremiumRoundedIcon sx={{ fontSize: '15px !important', color: '#7C3AED !important' }} />
              ) : (
                <AdminPanelSettingsRoundedIcon sx={{ fontSize: '15px !important', color: '#0B4DB7 !important' }} />
              )
            }
            label={isSuperAdmin ? 'Super Admin' : 'Admin'}
            sx={{
              height: '26px',
              fontSize: '11.5px',
              fontWeight: 700,
              color: isSuperAdmin ? '#6D28D9' : '#0B4DB7',
              backgroundColor: isSuperAdmin ? '#F5F3FF' : '#EEF2FF',
              border: `1px solid ${isSuperAdmin ? '#DDD6FE' : '#BFDBFE'}`,
              letterSpacing: '0.02em',
              display: { xs: 'none', sm: 'inline-flex' },
            }}
          />

          <Box
            onClick={handleProfileClick}
            sx={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              backgroundColor: isSuperAdmin ? '#7C3AED' : '#0B4DB7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isSuperAdmin
                ? '0 1px 3px rgba(124, 58, 237, 0.3)'
                : '0 1px 3px rgba(11, 77, 183, 0.25)',
              '&:hover': {
                backgroundColor: isSuperAdmin ? '#6D28D9' : '#083B8D',
                transform: 'scale(1.05)',
              },
            }}
          >
            {isSuperAdmin ? (
              <WorkspacePremiumRoundedIcon sx={{ fontSize: 19, color: '#FFFFFF' }} />
            ) : (
              <PersonOutlineRoundedIcon sx={{ fontSize: 20, color: '#FFFFFF' }} />
            )}
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
                  minWidth: '180px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  border: '1px solid #E2E8F0',
                  mt: 1,
                },
              },
            }}
          >
            <MenuItem disabled sx={{ opacity: '1 !important', py: 1 }}>
              <ListItemIcon>
                {isSuperAdmin ? (
                  <WorkspacePremiumRoundedIcon sx={{ fontSize: 19, color: '#7C3AED' }} />
                ) : (
                  <AdminPanelSettingsRoundedIcon sx={{ fontSize: 18, color: '#0B4DB7' }} />
                )}
              </ListItemIcon>
              <Box>
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  {isSuperAdmin ? 'Super Administrator' : 'Administrator'}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                  {currentUser?.username || (isSuperAdmin ? 'superadmin' : 'admin')}
                </Typography>
              </Box>
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
            {isSuperAdmin && (
              <MenuItem
                onClick={() => {
                  handleCloseMenu();
                  if (onSelectTab) onSelectTab('Settings');
                }}
                sx={{ py: 1 }}
              >
                <ListItemIcon>
                  <SettingsRoundedIcon sx={{ fontSize: 18, color: '#7C3AED' }} />
                </ListItemIcon>
                <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Settings
                </Typography>
              </MenuItem>
            )}
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

      {/* Mobile Sidebar / Tool bar Drawer */}
      <Drawer
        anchor="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: 280,
              maxWidth: '85vw',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
            },
          },
        }}
      >
        {/* Drawer Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #EEF2F6',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
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
            <Typography sx={{ fontWeight: 800, fontSize: '18px', color: '#0F172A', letterSpacing: '-0.02em' }}>
              Bussy Bee
            </Typography>
          </Box>
          <IconButton onClick={() => setMobileOpen(false)} sx={{ color: '#64748B', p: 0.8 }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* User Badge Info Card */}
        <Box sx={{ p: 2, borderBottom: '1px solid #F1F5F9', backgroundColor: '#F8FAFC' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: isSuperAdmin ? '#7C3AED' : '#0B4DB7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                flexShrink: 0,
              }}
            >
              {isSuperAdmin ? (
                <WorkspacePremiumRoundedIcon sx={{ fontSize: 20 }} />
              ) : (
                <PersonOutlineRoundedIcon sx={{ fontSize: 20 }} />
              )}
            </Box>
            <Box sx={{ overflow: 'hidden' }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {currentUser?.username || (isSuperAdmin ? 'superadmin' : 'admin')}
              </Typography>
              <Chip
                size="small"
                label={isSuperAdmin ? 'Super Admin' : 'Admin'}
                sx={{
                  height: '20px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: isSuperAdmin ? '#6D28D9' : '#0B4DB7',
                  backgroundColor: isSuperAdmin ? '#EDE9FE' : '#DBEAFE',
                  mt: 0.3,
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Navigation Items List */}
        <List sx={{ px: 1.5, py: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            let icon = <PeopleAltRoundedIcon sx={{ fontSize: 20 }} />;
            if (tab === 'Product') icon = <Inventory2RoundedIcon sx={{ fontSize: 20 }} />;
            if (tab === 'Particulars') icon = <ReceiptLongRoundedIcon sx={{ fontSize: 20 }} />;
            if (tab === 'All Customers') icon = <GroupsRoundedIcon sx={{ fontSize: 20 }} />;
            if (tab === 'Settings') icon = <SettingsRoundedIcon sx={{ fontSize: 20 }} />;

            return (
              <ListItem key={tab} disablePadding>
                <ListItemButton
                  onClick={() => {
                    setMobileOpen(false);
                    handleTabClick(tab);
                  }}
                  sx={{
                    borderRadius: '8px',
                    py: 1.2,
                    px: 1.8,
                    backgroundColor: isActive ? '#EFF6FF' : 'transparent',
                    color: isActive ? '#0B4DB7' : '#334155',
                    borderLeft: isActive ? '4px solid #0B4DB7' : '4px solid transparent',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      backgroundColor: isActive ? '#DBEAFE' : '#F1F5F9',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: isActive ? '#0B4DB7' : '#64748B' }}>
                    {icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography
                        sx={{
                          fontSize: '14px',
                          fontWeight: isActive ? 700 : 600,
                          color: isActive ? '#0B4DB7' : '#1E293B',
                        }}
                      >
                        {tab}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        {/* Drawer Footer with Logout */}
        <Box sx={{ p: 1.5, borderTop: '1px solid #EEF2F6' }}>
          <ListItemButton
            onClick={() => {
              setMobileOpen(false);
              handleLogoutClick();
            }}
            sx={{
              borderRadius: '8px',
              py: 1.2,
              px: 1.8,
              color: '#DC2626',
              '&:hover': {
                backgroundColor: '#FEF2F2',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: '#DC2626' }}>
              <LogoutRoundedIcon sx={{ fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#DC2626',
                  }}
                >
                  Logout
                </Typography>
              }
            />
          </ListItemButton>
        </Box>
      </Drawer>
    </>
  );
};
