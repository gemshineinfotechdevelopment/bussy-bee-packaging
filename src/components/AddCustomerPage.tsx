import { useState, type FC, type ChangeEvent } from 'react';
import {
  Box,
  Typography,
  Button,
  InputBase,
  Paper,
  CircularProgress,
  Autocomplete,
  TextField,
} from '@mui/material';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import { CustomersApi } from '../services/api';
import { INDIAN_STATES } from '../constants/appConstants';

interface AddCustomerPageProps {
  onCancel?: () => void;
  onSubmitSuccess?: () => void;
}

export const AddCustomerPage: FC<AddCustomerPageProps> = ({
  onCancel,
  onSubmitSuccess,
}) => {
  const [formData, setFormData] = useState({
    fullName: '',
    mobileNumber: '',
    aadharNumber: '',
    billingAddress: '',
    state: '',
    gstin: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string) => (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.fullName.trim()) {
      alert('Please enter Customer Name / Business Name (Mandatory)');
      return;
    }
    if (!formData.mobileNumber.trim()) {
      alert('Please enter Mobile Number (Mandatory)');
      return;
    }
    if (!formData.aadharNumber.trim()) {
      alert('Please enter Aadhar Number (Mandatory)');
      return;
    }
    if (!formData.billingAddress.trim()) {
      alert('Please enter Delivery Address (Mandatory)');
      return;
    }
    if (!formData.state.trim()) {
      alert('Please select State (Mandatory)');
      return;
    }
    if (!formData.gstin.trim()) {
      alert('Please enter GSTIN / Tax ID (Mandatory)');
      return;
    }

    try {
      setLoading(true);
      await CustomersApi.create({
        name: formData.fullName.trim(),
        mobile: formData.mobileNumber.trim(),
        aadhar: formData.aadharNumber.trim(),
        address: formData.billingAddress.trim(),
        state: formData.state.trim(),
        gst: formData.gstin.trim(),
        avatarLetter: formData.fullName.trim().charAt(0).toUpperCase(),
        avatarBg: '#DBEAFE',
        avatarColor: '#0B4DB7',
      });
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (err: any) {
      console.error('Failed to create customer:', err);
      const msg = err?.message || 'Please check your backend connection.';
      alert(`Error creating customer: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 2.5, md: 3 },
        boxSizing: 'border-box',
      }}
    >
      {/* Page Title & Subtitle */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h1"
          sx={{
            fontSize: '28px',
            fontWeight: 800,
            color: '#0F172A',
            letterSpacing: '-0.025em',
            lineHeight: 1.2,
            mb: 0.8,
          }}
        >
          Add New Customer
        </Typography>
        <Typography
          sx={{
            fontSize: '14px',
            color: '#64748B',
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}
        >
          Enter the details below to register a new client profile into the Bussy Bee platform.
        </Typography>
      </Box>

      {/* Main Form Card */}
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #EEF2F6',
          boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.03), 0 1px 2px -1px rgba(15, 23, 42, 0.03)',
          p: { xs: 2.5, sm: 3.5, md: 4 },
          boxSizing: 'border-box',
        }}
      >
        <Box component="form" noValidate autoComplete="off">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2.5,
            }}
          >
            {/* 1. Full Name Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Full Name / Business Name *
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#0B4DB7',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(11, 77, 183, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  placeholder="e.g. Acme Corporation"
                  value={formData.fullName}
                  onChange={handleChange('fullName')}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>

            {/* 2. Mobile Number Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Mobile Number *
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#0B4DB7',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(11, 77, 183, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  placeholder="e.g. +91 98765 43210"
                  value={formData.mobileNumber}
                  onChange={handleChange('mobileNumber')}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>

            {/* 3. Aadhar Number Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Aadhar Number *
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#0B4DB7',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(11, 77, 183, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  placeholder="e.g. 1234 5678 9012"
                  value={formData.aadharNumber}
                  onChange={handleChange('aadharNumber')}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>

            {/* 4. Delivery Address Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Delivery Address *
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#0B4DB7',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(11, 77, 183, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  placeholder="e.g. 123 Industrial Area, Phase 2, Sivakasi"
                  value={formData.billingAddress}
                  onChange={handleChange('billingAddress')}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>

            {/* 5. State Field (Searchable Autocomplete Text Box) */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                State *
              </Typography>
              <Autocomplete
                fullWidth
                size="small"
                autoHighlight
                openOnFocus
                options={INDIAN_STATES}
                value={formData.state || null}
                onChange={(_event, newValue) => {
                  setFormData((prev) => ({
                    ...prev,
                    state: newValue || '',
                  }));
                }}
                onInputChange={(_event, newInputValue, reason) => {
                  if (reason === 'input' || reason === 'clear') {
                    setFormData((prev) => ({
                      ...prev,
                      state: newInputValue || '',
                    }));
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Select or search state..."
                    sx={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: '8px',
                      '& .MuiOutlinedInput-root': {
                        height: '42px',
                        borderRadius: '8px',
                        fontSize: '13.5px',
                        fontWeight: 500,
                        color: '#0F172A',
                        backgroundColor: '#F8FAFC',
                        '& fieldset': {
                          borderColor: '#E2E8F0',
                        },
                        '&:hover fieldset': {
                          borderColor: '#CBD5E1',
                        },
                        '&.Mui-focused': {
                          backgroundColor: '#FFFFFF',
                          boxShadow: '0 0 0 3px rgba(11, 77, 183, 0.1)',
                          '& fieldset': {
                            borderColor: '#0B4DB7',
                            borderWidth: '1.5px',
                          },
                        },
                        '& input::placeholder': {
                          color: '#94A3B8',
                          opacity: 1,
                        },
                      },
                    }}
                  />
                )}
              />
            </Box>

            {/* 6. GSTIN / Tax ID Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                GSTIN / Tax ID *
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#0B4DB7',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(11, 77, 183, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  placeholder="e.g. 33AAAAA0000A1Z5"
                  value={formData.gstin}
                  onChange={handleChange('gstin')}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 1.5,
              mt: 4,
              pt: 3,
              borderTop: '1px solid #EEF2F6',
            }}
          >
            <Button
              variant="outlined"
              onClick={onCancel}
              disabled={loading}
              sx={{
                height: '40px',
                px: 2.5,
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 600,
                color: '#64748B',
                borderColor: '#E2E8F0',
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#CBD5E1',
                  backgroundColor: '#F8FAFC',
                },
              }}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              disableElevation
              onClick={handleSubmit}
              disabled={loading}
              startIcon={
                loading ? <CircularProgress size={16} color="inherit" /> : <AddCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />
              }
              sx={{
                height: '40px',
                px: 3,
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 700,
                backgroundColor: '#0B4DB7',
                color: '#FFFFFF',
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: '#083B8D',
                },
              }}
            >
              {loading ? 'Creating...' : 'Register Customer'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
