import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  CircularProgress,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { BillPrintTemplate, type BillPrintData } from './BillPrintTemplate';
import { printBillDirectly } from '../utils/printUtils';
import { shareBillOnWhatsApp } from '../utils/whatsappUtils';

interface BillPrintModalProps {
  open: boolean;
  onClose: () => void;
  bill: BillPrintData | null;
}

export const BillPrintModal: React.FC<BillPrintModalProps> = ({ open, onClose, bill }) => {
  const [sharing, setSharing] = useState(false);
  const [customTrader, setCustomTrader] = useState(() => {
    const storedName = localStorage.getItem('dheeksha_trader_name') || localStorage.getItem('dheeksha_particular_company') || '';
    const storedAddr = localStorage.getItem('dheeksha_trader_address') || localStorage.getItem('dheeksha_particular_comp_addr') || '';
    const storedGst = localStorage.getItem('dheeksha_trader_gst') || localStorage.getItem('dheeksha_particular_comp_gst') || '';
    const storedPhone = localStorage.getItem('dheeksha_trader_phone') || localStorage.getItem('dheeksha_particular_comp_phone') || '';
    return {
      traderName: storedName,
      traderAddress: storedAddr,
      traderGst: storedGst,
      traderPhone: storedPhone,
    };
  });

  React.useEffect(() => {
    if (bill) {
      const name = bill.traderName || bill.companyName || localStorage.getItem('dheeksha_trader_name') || localStorage.getItem('dheeksha_particular_company') || 'BUSSY BEE';
      const addr = bill.traderAddress || bill.companyAddress || localStorage.getItem('dheeksha_trader_address') || localStorage.getItem('dheeksha_particular_comp_addr') || '';
      const gst = bill.traderGst || bill.companyGst || localStorage.getItem('dheeksha_trader_gst') || localStorage.getItem('dheeksha_particular_comp_gst') || '';
      const phone = bill.companyPhone || bill.traderPhone || (bill.phone && bill.phone !== bill.customerMobile ? bill.phone : '') || localStorage.getItem('dheeksha_trader_phone') || localStorage.getItem('dheeksha_particular_comp_phone') || '';
      setCustomTrader({
        traderName: name,
        traderAddress: addr,
        traderGst: gst,
        traderPhone: phone,
      });
    }
  }, [bill]);

  if (!bill) return null;

  const currentBillWithTrader: BillPrintData = {
    ...bill,
    companyName: customTrader.traderName,
    companyAddress: customTrader.traderAddress,
    companyGst: customTrader.traderGst,
    companyPhone: customTrader.traderPhone,
    traderName: customTrader.traderName,
    traderAddress: customTrader.traderAddress,
    traderGst: customTrader.traderGst,
    traderPhone: customTrader.traderPhone,
  };

  const handleTriggerPrint = () => {
    const name = (customTrader.traderName || '').trim();
    if (!name) {
      alert('Company Name is mandatory! Please enter Company Name before printing.');
      return;
    }

    printBillDirectly(currentBillWithTrader);
  };

  const handleShareWhatsApp = async () => {
    const name = (customTrader.traderName || '').trim();
    if (!name) {
      alert('Company Name is mandatory! Please enter Company Name before sharing.');
      return;
    }

    try {
      setSharing(true);
      await shareBillOnWhatsApp(currentBillWithTrader);
    } catch (err) {
      console.error('Failed to share bill on WhatsApp:', err);
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      {/* Hidden print styling that guarantees ONLY the bill template is printed */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden !important;
            }
            .bussybee-printable-section,
            .bussybee-printable-section * {
              visibility: visible !important;
            }
            .bussybee-printable-section {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background-color: #FFFFFF !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .bussybee-no-print {
              display: none !important;
            }
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
          }
        `}
      </style>

      {/* Screen Dialog for Previewing */}
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#F8FAFC',
          },
        }}
      >
        {/* Modal Top Bar */}
        <Box
          className="bussybee-no-print"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 1.8,
            backgroundColor: '#0B4DB7',
            color: '#FFFFFF',
          }}
        >
          <Box>
            <Typography sx={{ fontSize: '16px', fontWeight: 800 }}>
              Bill Preview - #{bill.billNo || 'New'}
            </Typography>
            <Typography sx={{ fontSize: '12px', color: '#DBEAFE', fontWeight: 500 }}>
              {bill.customerName} | {bill.companyName}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              disableElevation
              disabled={sharing}
              onClick={handleShareWhatsApp}
              startIcon={
                sharing ? (
                  <CircularProgress size={16} sx={{ color: '#FFFFFF' }} />
                ) : (
                  <WhatsAppIcon sx={{ fontSize: '18px !important', color: '#FFFFFF' }} />
                )
              }
              sx={{
                backgroundColor: '#25D366',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'none',
                px: 2,
                py: 0.6,
                borderRadius: '6px',
                '&:hover': {
                  backgroundColor: '#1EBE5D',
                },
              }}
            >
              {sharing ? 'Sharing...' : 'Share on WhatsApp'}
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={handleTriggerPrint}
              startIcon={<PrintOutlinedIcon sx={{ fontSize: '18px !important', color: '#0F172A' }} />}
              sx={{
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'none',
                px: 2,
                py: 0.6,
                borderRadius: '6px',
                '&:hover': {
                  backgroundColor: '#F1F5F9',
                },
              }}
            >
              Print Invoice
            </Button>
            <IconButton onClick={onClose} sx={{ color: '#FFFFFF', p: 0.8 }}>
              <CloseRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Modal Body with Bill Document */}
        <DialogContent
          sx={{
            p: { xs: 1.5, sm: 3 },
            backgroundColor: '#F1F5F9',
            display: 'flex',
            justifyContent: 'center',
            overflowY: 'auto',
          }}
        >
          <Box
            className="bussybee-printable-section"
            sx={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              borderRadius: '4px',
              width: '100%',
              maxWidth: '750px',
            }}
          >
            <BillPrintTemplate
              bill={currentBillWithTrader}
              onUpdateTraderInfo={(info) =>
                setCustomTrader({
                  traderName: info.traderName,
                  traderAddress: info.traderAddress,
                  traderGst: info.traderGst,
                  traderPhone: info.traderPhone || '',
                })
              }
            />
          </Box>
        </DialogContent>

        {/* Modal Bottom Actions */}
        <DialogActions
          className="bussybee-no-print"
          sx={{
            px: 3,
            py: 1.5,
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Button
            onClick={onClose}
            sx={{
              color: '#64748B',
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'none',
            }}
          >
            Close
          </Button>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="contained"
              disableElevation
              disabled={sharing}
              onClick={handleShareWhatsApp}
              startIcon={
                sharing ? (
                  <CircularProgress size={16} sx={{ color: '#FFFFFF' }} />
                ) : (
                  <WhatsAppIcon sx={{ fontSize: '18px !important' }} />
                )
              }
              sx={{
                backgroundColor: '#25D366',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'none',
                px: 2.5,
                py: 0.8,
                borderRadius: '6px',
                '&:hover': {
                  backgroundColor: '#1EBE5D',
                },
              }}
            >
              {sharing ? 'Sharing...' : 'Share on WhatsApp'}
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={handleTriggerPrint}
              startIcon={<PrintOutlinedIcon sx={{ fontSize: '18px !important' }} />}
              sx={{
                backgroundColor: '#0B4DB7',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'none',
                px: 3,
                py: 0.8,
                borderRadius: '6px',
                '&:hover': {
                  backgroundColor: '#083B8D',
                },
              }}
            >
              Print
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
};
