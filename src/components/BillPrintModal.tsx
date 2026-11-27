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
  useTheme,
  useMediaQuery,
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
  onSaveBillTraderInfo?: (billId: string, info: { traderAddress: string; traderGst: string; traderPhone: string }) => void;
}

export const BillPrintModal: React.FC<BillPrintModalProps> = ({ open, onClose, bill, onSaveBillTraderInfo }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [sharing, setSharing] = useState(false);
  const [customTrader, setCustomTrader] = useState(() => {
    const savedName = typeof window !== 'undefined' ? localStorage.getItem('bussy_bee_company_name') : null;
    const savedAddr = typeof window !== 'undefined' ? localStorage.getItem('bussy_bee_company_address') : null;
    const savedGst = typeof window !== 'undefined' ? localStorage.getItem('bussy_bee_company_gst') : null;
    const savedPhone = typeof window !== 'undefined' ? localStorage.getItem('bussy_bee_company_phone') : null;
    return {
      traderName: bill?.traderName && bill.traderName !== 'BUSSY BEE' ? bill.traderName : (bill?.companyName && bill.companyName !== 'BUSSY BEE' ? bill.companyName : (savedName || 'Sri Shanmuga Traders')),
      traderAddress: bill?.traderAddress || bill?.companyAddress || savedAddr || '352, Amman Kovil Patti Middle Street, Sivakasi - 626123',
      traderGst: bill?.traderGst || bill?.companyGst || savedGst || '33BUMPR9147N1ZQ',
      traderPhone: bill?.traderPhone || bill?.companyPhone || savedPhone || '',
    };
  });

  React.useEffect(() => {
    if (bill) {
      const savedName = typeof window !== 'undefined' ? localStorage.getItem('bussy_bee_company_name') : null;
      const savedAddr = typeof window !== 'undefined' ? localStorage.getItem('bussy_bee_company_address') : null;
      const savedGst = typeof window !== 'undefined' ? localStorage.getItem('bussy_bee_company_gst') : null;
      const savedPhone = typeof window !== 'undefined' ? localStorage.getItem('bussy_bee_company_phone') : null;
      setCustomTrader({
        traderName: bill.traderName && bill.traderName !== 'BUSSY BEE' ? bill.traderName : (bill.companyName && bill.companyName !== 'BUSSY BEE' ? bill.companyName : (savedName || 'Sri Shanmuga Traders')),
        traderAddress: bill.traderAddress || bill.companyAddress || savedAddr || '352, Amman Kovil Patti Middle Street, Sivakasi - 626123',
        traderGst: bill.traderGst || bill.companyGst || savedGst || '33BUMPR9147N1ZQ',
        traderPhone: bill.traderPhone || bill.companyPhone || savedPhone || '',
      });
    }
  }, [
    bill?.billNo,
    bill?.traderAddress,
    bill?.traderGst,
    bill?.traderPhone,
    bill?.companyAddress,
    bill?.companyGst,
    bill?.companyPhone,
  ]);

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
    const billId = bill?._id || bill?.id;
    if (billId && onSaveBillTraderInfo) {
      onSaveBillTraderInfo(billId, {
        traderAddress: customTrader.traderAddress,
        traderGst: customTrader.traderGst,
        traderPhone: customTrader.traderPhone,
      });
    }

    printBillDirectly(currentBillWithTrader);
  };

  const handleShareWhatsApp = async () => {
    const billId = bill?._id || bill?.id;
    if (billId && onSaveBillTraderInfo) {
      onSaveBillTraderInfo(billId, {
        traderAddress: customTrader.traderAddress,
        traderGst: customTrader.traderGst,
        traderPhone: customTrader.traderPhone,
      });
    }

    try {
      setSharing(true);
      const targetPhone = currentBillWithTrader.customerMobile || currentBillWithTrader.customerPhone || bill?.customerMobile || bill?.customerPhone || '';
      await shareBillOnWhatsApp(currentBillWithTrader, targetPhone);
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
            .bussybee-printable-section input {
              border: none !important;
              background-color: transparent !important;
              box-shadow: none !important;
              outline: none !important;
            }
            .bussybee-printable-section input::placeholder {
              color: transparent !important;
              opacity: 0 !important;
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
        fullScreen={isMobile}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: { xs: 0, sm: '12px' },
            overflow: 'hidden',
            backgroundColor: '#F8FAFC',
            m: { xs: 0, sm: 2 },
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
            gap: 1.5,
            px: { xs: 2, sm: 3 },
            py: { xs: 1.2, sm: 1.5 },
            backgroundColor: '#0B4DB7',
            color: '#FFFFFF',
            flexShrink: 0,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                fontSize: { xs: '15px', sm: '16px' },
                fontWeight: 800,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Bill Preview - #{bill.billNo || 'New'}
            </Typography>
            <Typography
              sx={{
                fontSize: '12px',
                color: '#DBEAFE',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {bill.customerName} | {customTrader.traderName || 'Sri Shanmuga Traders'}
            </Typography>
          </Box>

          {/* Desktop quick action buttons (Only on wide screens to prevent overflow on mobile/tablet) */}
          <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 1 }}>
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
                whiteSpace: 'nowrap',
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
                whiteSpace: 'nowrap',
                '&:hover': {
                  backgroundColor: '#F1F5F9',
                },
              }}
            >
              Print Estimate
            </Button>
          </Box>

          {/* Close button always accessible */}
          <IconButton
            onClick={onClose}
            sx={{
              color: '#FFFFFF',
              p: 0.8,
              ml: { xs: 1, sm: 0.5 },
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.15)' },
            }}
            aria-label="close"
          >
            <CloseRoundedIcon sx={{ fontSize: 22 }} />
          </IconButton>
        </Box>

        {/* Mobile Swipe Hint */}
        <Box
          className="bussybee-no-print"
          sx={{
            display: { xs: 'flex', sm: 'none' },
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.8,
            py: 0.7,
            px: 1.5,
            backgroundColor: '#EFF6FF',
            borderBottom: '1px solid #DBEAFE',
            color: '#1E40AF',
            fontSize: '11.5px',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          <span>👈 Swipe horizontally to view full bill details 👉</span>
        </Box>

        {/* Modal Body with Bill Document (Proper horizontal + vertical scroll without flex center data clipping) */}
        <DialogContent
          sx={{
            p: { xs: 1, sm: 3 },
            backgroundColor: '#F1F5F9',
            overflowX: 'auto',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            display: 'block',
          }}
        >
          <Box
            className="bussybee-printable-section"
            sx={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              borderRadius: '4px',
              width: '100%',
              minWidth: '760px',
              maxWidth: '820px',
              mx: 'auto',
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

        {/* Modal Bottom Actions (Pinned & 50/50 balanced on mobile, zero clip) */}
        <DialogActions
          className="bussybee-no-print"
          sx={{
            px: { xs: 1.5, sm: 3 },
            py: { xs: 1.2, sm: 1.5 },
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1.2,
            flexShrink: 0,
          }}
        >
          <Button
            onClick={onClose}
            sx={{
              display: { xs: 'none', md: 'inline-flex' },
              color: '#64748B',
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': { backgroundColor: '#F1F5F9' },
            }}
          >
            Close
          </Button>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
              width: { xs: '100%', md: 'auto' },
            }}
          >
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
                flex: { xs: 1, sm: 'none' },
                minWidth: 0,
                backgroundColor: '#25D366',
                color: '#FFFFFF',
                fontSize: { xs: '12.5px', sm: '13px' },
                fontWeight: 700,
                textTransform: 'none',
                px: { xs: 1.5, sm: 2.5 },
                height: '40px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(37, 211, 102, 0.25)',
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
              startIcon={<PrintOutlinedIcon sx={{ fontSize: '18px !important', color: '#FFFFFF' }} />}
              sx={{
                flex: { xs: 1, sm: 'none' },
                minWidth: 0,
                backgroundColor: '#0B4DB7',
                color: '#FFFFFF',
                fontSize: { xs: '12.5px', sm: '13px' },
                fontWeight: 700,
                textTransform: 'none',
                px: { xs: 1.5, sm: 2.5 },
                height: '40px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(11, 77, 183, 0.25)',
                '&:hover': {
                  backgroundColor: '#083B8D',
                },
              }}
            >
              Print Estimate
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
};
