import { useState, useEffect, useMemo, useRef, type FC } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Divider,
  MenuItem,
  Select,
  InputAdornment,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ModeEditOutlineRoundedIcon from '@mui/icons-material/ModeEditOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import {
  CustomersApi,
  CompaniesApi,
  ProductsApi,
  ParticularsApi,
  AccountsApi,
  SettingsApi,
} from '../services/api';
import { BillPrintModal } from './BillPrintModal';
import type { BillPrintData } from './BillPrintTemplate';
import { printBillDirectly, printLedgerStatementDirectly, printParticularsListDirectly, parseDateToTimestamp } from '../utils/printUtils';
import {
  shareBillOnWhatsApp,
  shareLedgerOnWhatsApp,
  shareParticularsListOnWhatsApp,
} from '../utils/whatsappUtils';
import { DateRangePrintModal } from './DateRangePrintModal';
import { DatePickerField } from './DatePickerField';
import { INDIAN_STATES, PKT_UNIT_OPTIONS, TAX_PERCENT_OPTIONS } from '../constants/appConstants';

export type ParticularSubTab =
  | 'Select Customer'
  | 'Create Particular'
  | 'Account Details'
  | 'Particular Details'
  | 'Add Credit';

interface ProductRowItem {
  id: string;
  particular: string;
  hsn?: string;
  quantity: string;
  rate: string;
  pktUnit: string;
  amount: string;
}

// Helper to extract unit multiplier from alphanumeric pkt/unit strings (e.g. "10 pkts" -> 10, "12.5 kg" -> 12.5, "box" -> 1)
export const extractUnitMultiplier = (unitStr: string | undefined): number => {
  if (!unitStr || !unitStr.trim()) return 1;
  const trimmed = unitStr.trim();
  const leadingNum = parseFloat(trimmed);
  if (!isNaN(leadingNum) && leadingNum > 0) {
    return leadingNum;
  }
  const match = trimmed.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    const embeddedNum = parseFloat(match[1]);
    if (!isNaN(embeddedNum) && embeddedNum > 0) {
      return embeddedNum;
    }
  }
  return 1;
};

export const formatCityAndPincode = (rawAddress?: string): string => {
  if (!rawAddress || !rawAddress.trim()) return '-';
  const clean = rawAddress.trim();

  // Find 6-digit Indian pincode
  const pinMatch = clean.match(/\b\d{6}\b/);
  const pincode = pinMatch ? pinMatch[0] : '';

  // Split by comma, semicolon, newline
  const parts = clean
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const nonCityKeywords = [
    'tamil nadu',
    'tamilnadu',
    'tn',
    'india',
    'kerala',
    'karnataka',
    'andhra pradesh',
    'telangana',
    'maharashtra',
  ];

  const cityCandidates = parts.filter((part) => {
    const lower = part.toLowerCase();
    if (/^\d+$/.test(part.replace(/\s+/g, ''))) return false;
    if (nonCityKeywords.includes(lower)) return false;
    return true;
  });

  let city = '';
  if (cityCandidates.length > 0) {
    const last = cityCandidates[cityCandidates.length - 1];
    const stripped = last.replace(/\b\d{6}\b/, '').replace(/[-–—]/g, '').trim();
    if (stripped && !nonCityKeywords.includes(stripped.toLowerCase())) {
      city = stripped;
    } else if (cityCandidates.length > 1) {
      city = cityCandidates[cityCandidates.length - 2].replace(/\b\d{6}\b/, '').replace(/[-–—]/g, '').trim();
    } else {
      city = stripped;
    }
  }

  if (city && pincode) {
    return `${city}, ${pincode}`;
  }
  if (city) return city;
  if (pincode) return pincode;
  return clean;
};

interface ParticularsPageProps {
  currentUser?: { username: string; role: string } | null;
  initialCustomerName?: string;
  initialSubTab?: ParticularSubTab;
}

export const ParticularsPage: FC<ParticularsPageProps> = ({ currentUser, initialCustomerName, initialSubTab }) => {
  // Determine if logged-in user is Super Admin
  const userRole =
    currentUser?.role ||
    (() => {
      try {
        const u = localStorage.getItem('bussy_bee_auth_user');
        return u ? JSON.parse(u)?.role : 'admin';
      } catch {
        return 'admin';
      }
    })();
  const isSuperAdmin = userRole === 'superadmin';

  // Subtabs list: 'Add Credit' is ONLY visible to Super Admin
  const subTabs: ParticularSubTab[] = useMemo(() => {
    return isSuperAdmin
      ? ['Select Customer', 'Create Particular', 'Account Details', 'Particular Details', 'Add Credit']
      : ['Select Customer', 'Create Particular', 'Account Details', 'Particular Details'];
  }, [isSuperAdmin]);

  const [activeSubTab, setActiveSubTab] = useState<ParticularSubTab>(() => {
    const saved = (localStorage.getItem('bussy_bee_particular_subtab') as ParticularSubTab) || 'Select Customer';
    const target = initialSubTab || saved;
    if (!isSuperAdmin && target === 'Add Credit') {
      return 'Select Customer';
    }
    return target;
  });

  // Ensure Admin cannot stay on 'Add Credit'
  useEffect(() => {
    if (!isSuperAdmin && activeSubTab === 'Add Credit') {
      setActiveSubTab('Select Customer');
      localStorage.setItem('bussy_bee_particular_subtab', 'Select Customer');
    }
  }, [isSuperAdmin, activeSubTab]);

  // Live Dropdown options
  const [customerOptions, setCustomerOptions] = useState<{
    id: string;
    name: string;
    address?: string;
    gst?: string;
    mobile?: string;
    aadhar?: string;
    state?: string;
    pan?: string;
  }[]>([]);
  const [productOptions, setProductOptions] = useState<{ id: string; name: string; code?: string; rate?: number; pktUnit?: string }[]>([]);

  // Persistent Selected Customer for Creation & Filter
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [currentCustomerName, setCurrentCustomerName] = useState<string>(() => {
    return initialCustomerName || '';
  });

  // Independent Filter state for Account Details and Particular Details (Default to ALL)
  const [accountFilterCustomer, setAccountFilterCustomer] = useState<string>(() => {
    return initialSubTab === 'Account Details' && initialCustomerName && initialCustomerName !== 'ALL'
      ? initialCustomerName
      : 'ALL';
  });
  const [particularFilterCustomer, setParticularFilterCustomer] = useState<string>(() => {
    return initialSubTab === 'Particular Details' && initialCustomerName && initialCustomerName !== 'ALL'
      ? initialCustomerName
      : 'ALL';
  });

  const [accountCustomerInput, setAccountCustomerInput] = useState<string>(() => {
    return accountFilterCustomer && accountFilterCustomer !== 'ALL' ? accountFilterCustomer : 'All Customers';
  });
  const [particularCustomerInput, setParticularCustomerInput] = useState<string>(() => {
    return particularFilterCustomer && particularFilterCustomer !== 'ALL' ? particularFilterCustomer : 'All Customers';
  });

  useEffect(() => {
    const name = accountFilterCustomer && accountFilterCustomer !== 'ALL' ? accountFilterCustomer : 'All Customers';
    setAccountCustomerInput(name);
  }, [accountFilterCustomer]);

  useEffect(() => {
    const name = particularFilterCustomer && particularFilterCustomer !== 'ALL' ? particularFilterCustomer : 'All Customers';
    setParticularCustomerInput(name);
  }, [particularFilterCustomer]);

  // Subtab 2: Create Particular Form State
  const [caseCount, setCaseCount] = useState<string>('0');
  const [bundlesQty, setBundlesQty] = useState<string>('0');
  const [company, setCompany] = useState<string>(
    () => localStorage.getItem('bussy_bee_company_name') || 'Sri Shanmuga Traders'
  );
  const [companyAddress, setCompanyAddress] = useState<string>(
    () => localStorage.getItem('bussy_bee_company_address') || '352, Amman Kovil Patti Middle Street, Sivakasi - 626123'
  );
  const [companyGst, setCompanyGst] = useState<string>(
    () => localStorage.getItem('bussy_bee_company_gst') || '33BUMPR9147N1ZQ'
  );
  const [companyPhone, setCompanyPhone] = useState<string>(
    () => localStorage.getItem('bussy_bee_company_phone') || ''
  );
  const [customerAddress, setCustomerAddress] = useState<string>(() => localStorage.getItem('bussy_bee_particular_cust_addr') || '');
  const [customerState, setCustomerState] = useState<string>(() => localStorage.getItem('bussy_bee_particular_cust_state') || 'Tamil Nadu');
  const [transportName, setTransportName] = useState<string>(() => localStorage.getItem('bussy_bee_particular_transport') || '');
  const [lrNo, setLrNo] = useState<string>(() => localStorage.getItem('bussy_bee_particular_lr_no') || '');
  const [customerPhone, setCustomerPhone] = useState<string>(() => localStorage.getItem('bussy_bee_particular_cust_phone') || '');
  const [customerGst, setCustomerGst] = useState<string>(() => localStorage.getItem('bussy_bee_particular_cust_gst') || '');
  const [customerPan, setCustomerPan] = useState<string>(() => localStorage.getItem('bussy_bee_particular_cust_pan') || '');
  const [packing, setPacking] = useState<string>('');
  const [billNo, setBillNo] = useState<string>('');
  const [tax, setTax] = useState<string>('');
  const [taxPercent, setTaxPercent] = useState<string>('');
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toLocaleDateString('en-GB').replace(/\//g, '-');
  });

  // Settings: Rate visibility for Admin
  const [isRateEnabledForAdmin, setIsRateEnabledForAdmin] = useState<boolean>(true);
  const isRateVisible = isSuperAdmin || isRateEnabledForAdmin;

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const s = await SettingsApi.getSettings();
        if (s && typeof s.isRateEnabledForAdmin === 'boolean') {
          setIsRateEnabledForAdmin(s.isRateEnabledForAdmin);
        }
      } catch (err) {
        console.error('Failed to load settings in ParticularsPage:', err);
      }
    };
    fetchSettings();
  }, []);

  // Product Entry Form State
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [hsnCode, setHsnCode] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [rate, setRate] = useState<string>('');
  const [pkt, setPkt] = useState<string>('nos');
  const [productRows, setProductRows] = useState<ProductRowItem[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editRowData, setEditRowData] = useState<{
    particular: string;
    hsn: string;
    quantity: string;
    rate: string;
    pktUnit: string;
  }>({ particular: '', hsn: '', quantity: '', rate: '', pktUnit: '' });
  const [createLoading, setCreateLoading] = useState(false);

  // Subtab 3: Account Details State
  const [accountDetails, setAccountDetails] = useState<any[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);

  // Subtab 4: Particular Details State
  const [particularDetails, setParticularDetails] = useState<any[]>([]);
  const [particularLoading, setParticularLoading] = useState(false);

  // Subtab 5: Add Credit Form State
  const [addCreditCustomerName, setAddCreditCustomerName] = useState<string>('');
  const [creditAmount, setCreditAmount] = useState<string>('');
  const [creditNotes, setCreditNotes] = useState<string>('');
  const [creditDate, setCreditDate] = useState<string>(() => {
    const today = new Date();
    return today.toLocaleDateString('en-GB').replace(/\//g, '-');
  });
  const [creditPaymentType, setCreditPaymentType] = useState<string>('Cash');
  const [savedAccounts, setSavedAccounts] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bussy_bee_transfer_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return ['GPK Main Current A/C', 'GPK Cash Counter', 'Axis Bank A/C', 'HDFC Bank A/C'];
  });
  const [creditTransferredTo, setCreditTransferredTo] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('bussy_bee_transfer_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      }
    } catch {}
    return 'GPK Main Current A/C';
  });
  const [manageAccountsModalOpen, setManageAccountsModalOpen] = useState(false);
  const [newAccountInput, setNewAccountInput] = useState('');
  const [creditLoading, setCreditLoading] = useState(false);

  // Bill Print Modal State
  const [selectedBillForPrint, setSelectedBillForPrint] = useState<BillPrintData | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [openAccountDateModal, setOpenAccountDateModal] = useState(false);
  const [openParticularDateModal, setOpenParticularDateModal] = useState(false);

  // Edit Particular Modal State
  const [openEditParticularModal, setOpenEditParticularModal] = useState(false);
  const [editingParticularId, setEditingParticularId] = useState<string | null>(null);
  const [editBillForm, setEditBillForm] = useState<{
    billNo: string;
    date: string;
    customerName: string;
    companyName: string;
    transport: string;
    caseCount: string;
    discount: string;
    packing: string;
    tax: string;
    products: Array<{
      id?: string;
      particular: string;
      quantity: string;
      rate: string;
      pktUnit: string;
      amount: string;
    }>;
  }>({
    billNo: '',
    date: '',
    customerName: '',
    companyName: '',
    transport: '',
    caseCount: '0',
    discount: '0',
    packing: '0',
    tax: '0',
    products: [],
  });
  const [editBillLoading, setEditBillLoading] = useState(false);

  // PDF Upload & Preview State (under 1 MB)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetBillId, setUploadTargetBillId] = useState<string | null>(null);
  const [uploadingBillId, setUploadingBillId] = useState<string | null>(null);
  void uploadingBillId;
  const [pdfPreviewModal, setPdfPreviewModal] = useState<{
    open: boolean;
    url: string;
    name: string;
    id: string;
    billNo?: string;
  } | null>(null);
  const [pdfToast, setPdfToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Automatically calculate total case count from added product rows
  useEffect(() => {
    if (productRows.length > 0) {
      const totalCases = productRows.reduce((acc, row) => acc + (parseFloat(row.quantity) || 0), 0);
      setCaseCount(String(totalCases));
    } else {
      setCaseCount('0');
    }
  }, [productRows]);

  // Update customer when prop changes
  useEffect(() => {
    if (initialCustomerName) {
      setCurrentCustomerName(initialCustomerName);
      if (initialSubTab === 'Account Details') {
        setAccountFilterCustomer(initialCustomerName);
      } else if (initialSubTab === 'Particular Details') {
        setParticularFilterCustomer(initialCustomerName);
      }
      setAddCreditCustomerName(initialCustomerName);
      const match = customerOptions.find((c) => c.name === initialCustomerName);
      if (match) {
        setSelectedCustomerId(match.id);
        if (match.address) {
          setCustomerAddress(match.address);
        }
        if (match.mobile) {
          setCustomerPhone(match.mobile);
        }
        if (match.gst) {
          setCustomerGst(match.gst);
        }
      }
    } else {
      setCurrentCustomerName('');
      setAddCreditCustomerName('');
      setSelectedCustomerId('');
      setCustomerAddress('');
      setCustomerPhone('');
      setCustomerGst('');
    }
  }, [initialCustomerName, customerOptions, initialSubTab]);

  // Update subtab when prop changes
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
      localStorage.setItem('bussy_bee_particular_subtab', initialSubTab);
    }
  }, [initialSubTab]);

  // Persist activeSubTab whenever it changes
  useEffect(() => {
    if (activeSubTab) {
      localStorage.setItem('bussy_bee_particular_subtab', activeSubTab);
    }
  }, [activeSubTab]);

  // Keep Company Info in sync with Settings updates
  useEffect(() => {
    const syncCompany = () => {
      const savedName = localStorage.getItem('bussy_bee_company_name');
      const savedAddr = localStorage.getItem('bussy_bee_company_address');
      const savedGst = localStorage.getItem('bussy_bee_company_gst');
      const savedPhone = localStorage.getItem('bussy_bee_company_phone');
      if (savedName) setCompany(savedName);
      if (savedAddr) setCompanyAddress(savedAddr);
      if (savedGst) setCompanyGst(savedGst);
      if (savedPhone !== null && savedPhone !== undefined) setCompanyPhone(savedPhone);
    };

    window.addEventListener('bussy_bee_company_updated', syncCompany);
    return () => window.removeEventListener('bussy_bee_company_updated', syncCompany);
  }, []);

  // Load Dropdown Options & Settings
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [custRes, compRes, prodRes, settingsRes] = await Promise.all([
          CustomersApi.getAll(),
          CompaniesApi.getAll(),
          ProductsApi.getAll(),
          SettingsApi.getSettings().catch(() => null),
        ]);

        if (settingsRes) {
          if (settingsRes.companyName) {
            setCompany(settingsRes.companyName);
            localStorage.setItem('bussy_bee_company_name', settingsRes.companyName);
          }
          if (settingsRes.companyAddress) {
            setCompanyAddress(settingsRes.companyAddress);
            localStorage.setItem('bussy_bee_company_address', settingsRes.companyAddress);
          }
          if (settingsRes.companyGst) {
            setCompanyGst(settingsRes.companyGst);
            localStorage.setItem('bussy_bee_company_gst', settingsRes.companyGst);
          }
          if (settingsRes.companyPhone !== undefined) {
            setCompanyPhone(settingsRes.companyPhone);
            localStorage.setItem('bussy_bee_company_phone', settingsRes.companyPhone);
          }
          if (settingsRes.companyState) {
            localStorage.setItem('bussy_bee_company_state', settingsRes.companyState);
          }
        }

        if (custRes && custRes.length > 0) {
          const mapped = custRes.map((c: any) => ({
            id: c._id || c.id,
            name: c.name,
            address: c.address,
            gst: c.gst,
            mobile: c.mobile || c.phone || '',
            aadhar: c.aadhar || '',
            state: c.state || 'Tamil Nadu',
            pan: c.pan || '',
          }));
          setCustomerOptions(mapped);

          if (currentCustomerName) {
            const existing = mapped.find((c: any) => c.name === currentCustomerName);
            if (existing) {
              setSelectedCustomerId(existing.id);
              setAddCreditCustomerName(existing.name);
              if (existing.address) {
                setCustomerAddress(existing.address);
              }
              if (existing.mobile) {
                setCustomerPhone(existing.mobile);
              }
              if (existing.gst || existing.aadhar) {
                setCustomerGst(existing.gst || existing.aadhar);
              }
              if (existing.state) {
                setCustomerState(existing.state);
              }
              if (existing.pan) {
                setCustomerPan(existing.pan);
              }
            }
          }
        }

        if (compRes && compRes.length > 0 && !settingsRes?.companyName) {
          setCompany('Sri Shanmuga Traders');
        }

        if (prodRes && prodRes.length > 0) {
          const mapped = prodRes.map((p: any) => ({
            id: p._id || p.id,
            name: p.name,
            code: p.code || p.hsn || '',
            rate: p.rate,
            pktUnit: p.pktUnit,
          }));
          setProductOptions(mapped);
        }
      } catch (err) {
        console.error('Error loading dropdown options:', err);
      }
    };
    loadOptions();
  }, []);

  // Fetch Accounts
  const fetchAccounts = async (targetCustomer?: string) => {
    try {
      setAccountLoading(true);
      const cust = targetCustomer !== undefined ? targetCustomer : accountFilterCustomer;
      const data = await AccountsApi.getAll(cust && cust !== 'ALL' ? cust : undefined);
      const sorted = (data || []).slice().sort((a: any, b: any) => {
        const timeA = parseDateToTimestamp(a.date) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = parseDateToTimestamp(b.date) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (timeB !== timeA) return timeB - timeA;
        const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return cB - cA;
      });
      setAccountDetails(sorted);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setAccountLoading(false);
    }
  };

  // Fetch Particulars (Loads bills filtered by customer, or all)
  const fetchParticulars = async (targetCustomer?: string) => {
    try {
      setParticularLoading(true);
      const cust = targetCustomer !== undefined ? targetCustomer : particularFilterCustomer;
      const data = await ParticularsApi.getAll(cust && cust !== 'ALL' ? cust : undefined);
      const sorted = (data || []).slice().sort((a: any, b: any) => {
        const timeA = parseDateToTimestamp(a.date) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = parseDateToTimestamp(b.date) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (timeB !== timeA) return timeB - timeA;
        const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return cB - cA;
      });
      setParticularDetails(sorted);
    } catch (err) {
      console.error('Failed to load particulars:', err);
    } finally {
      setParticularLoading(false);
    }
  };

  // Memoized date-wise descending sorted records (today's date first, previous dates below)
  const sortedAccountDetails = useMemo(() => {
    return [...accountDetails].sort((a: any, b: any) => {
      const timeA = parseDateToTimestamp(a.date) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = parseDateToTimestamp(b.date) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      if (timeB !== timeA) return timeB - timeA;
      const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return cB - cA;
    });
  }, [accountDetails]);

  const sortedParticularDetails = useMemo(() => {
    return [...particularDetails].sort((a: any, b: any) => {
      const timeA = parseDateToTimestamp(a.date) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = parseDateToTimestamp(b.date) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      if (timeB !== timeA) return timeB - timeA;
      const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return cB - cA;
    });
  }, [particularDetails]);

  useEffect(() => {
    if (activeSubTab === 'Account Details') {
      fetchAccounts(accountFilterCustomer);
    } else if (activeSubTab === 'Particular Details') {
      fetchParticulars(particularFilterCustomer);
    }
  }, [activeSubTab, accountFilterCustomer, particularFilterCustomer]);

  // Overall totals
  const overallTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    accountDetails.forEach((row) => {
      totalDebit += parseFloat(String(row.debit || '0').replace(/,/g, '')) || 0;
      totalCredit += parseFloat(String(row.credit || '0').replace(/,/g, '')) || 0;
    });
    return {
      totalDebit,
      totalCredit,
      netBalance: totalCredit - totalDebit,
    };
  }, [accountDetails]);

  const handleSelectCustomerClick = () => {
    if (!selectedCustomerId && !currentCustomerName) {
      alert('Please select a customer first');
      return;
    }
    setActiveSubTab('Create Particular');
  };

  // Subtab 2: Product Line Addition
  const handleAddProductRow = () => {
    if (!selectedProduct || !quantity || (isRateVisible && !rate)) {
      alert(isRateVisible ? 'Please select Product, enter No. of Counts and Rate' : 'Please select Product and enter No. of Counts');
      return;
    }
    const caseVal = parseFloat(quantity) || 0;
    const piecesPerCase = extractUnitMultiplier(pkt);
    const totalPieces = caseVal * piecesPerCase;
    const effectiveRate = isRateVisible ? (rate || '0') : (rate || '0');
    const lineAmt = (totalPieces * (parseFloat(effectiveRate) || 0)).toFixed(2);

    const newRow: ProductRowItem = {
      id: Date.now().toString(),
      particular: selectedProduct.trim(),
      hsn: hsnCode.trim(),
      quantity,
      rate: effectiveRate,
      pktUnit: pkt ? pkt : '-',
      amount: lineAmt,
    };
    setProductRows((prev) => [...prev, newRow]);
    setSelectedProduct('');
    setHsnCode('');
    setQuantity('');
    setRate('');
    setPkt('');
  };

  // Start editing a product row
  const handleStartEditRow = (row: ProductRowItem) => {
    setEditingRowId(row.id);
    setEditRowData({
      particular: row.particular,
      hsn: row.hsn || '',
      quantity: row.quantity,
      rate: row.rate,
      pktUnit: row.pktUnit === '-' ? '' : row.pktUnit,
    });
  };

  // Save edited product row
  const handleSaveEditRow = (id: string) => {
    if (!editRowData.particular || !editRowData.quantity || !editRowData.rate) {
      alert('Please enter Product, No. of Counts, and Rate');
      return;
    }
    const caseVal = parseFloat(editRowData.quantity) || 0;
    const piecesPerCase = extractUnitMultiplier(editRowData.pktUnit);
    const totalPieces = caseVal * (piecesPerCase > 0 ? piecesPerCase : 1);
    const lineAmt = (totalPieces * (parseFloat(editRowData.rate) || 0)).toFixed(2);

    setProductRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              particular: editRowData.particular.trim(),
              hsn: editRowData.hsn.trim(),
              quantity: editRowData.quantity.trim(),
              rate: editRowData.rate.trim(),
              pktUnit: editRowData.pktUnit.trim() !== '' ? editRowData.pktUnit.trim() : '-',
              amount: lineAmt,
            }
          : row
      )
    );
    setEditingRowId(null);
  };

  // Cancel editing product row
  const handleCancelEditRow = () => {
    setEditingRowId(null);
  };

  // Subtotal (Sum of all products)
  const subtotalAmount = useMemo(() => {
    return productRows.reduce((acc, row) => acc + (parseFloat(row.amount) || 0), 0);
  }, [productRows]);

  // Packing Calculation (Percentage based)
  const packingVal = useMemo(() => {
    if (!packing) return 0;
    const cleanPack = String(packing).trim().replace(/[^0-9.]/g, '');
    const num = parseFloat(cleanPack) || 0;
    if (num <= 0) return 0;
    return (subtotalAmount * num) / 100;
  }, [packing, subtotalAmount]);

  // Tax Calculation (Mutually exclusive: Fixed ₹ Amount OR Dropdown %)
  const taxVal = useMemo(() => {
    if (tax && parseFloat(tax) > 0) {
      const cleanTax = String(tax).trim().replace(/[^0-9.]/g, '');
      return parseFloat(cleanTax) || 0;
    }
    if (taxPercent && parseFloat(taxPercent) > 0) {
      const pct = parseFloat(taxPercent) || 0;
      return ((subtotalAmount + packingVal) * pct) / 100;
    }
    return 0;
  }, [tax, taxPercent, subtotalAmount, packingVal]);

  // Raw Net Total before Round Off
  const rawTotalAmount = useMemo(() => {
    return Math.max(0, subtotalAmount + packingVal + taxVal);
  }, [subtotalAmount, packingVal, taxVal]);

  // Round Off Difference: (.5 & above rounds up (+1), below .5 rounds down)
  const roundOffDiff = useMemo(() => {
    return Math.round(rawTotalAmount) - rawTotalAmount;
  }, [rawTotalAmount]);

  // Final Rounded Grand Total Amount
  const finalTotalAmount = useMemo(() => {
    return Math.round(rawTotalAmount).toFixed(2);
  }, [rawTotalAmount]);

  // Subtab 2: Submit Particular Bill
  const handleCreateParticular = async () => {
    if (!billNo || !billNo.trim()) {
      alert('Please enter a Bill Number (Mandatory)');
      return;
    }
    if (!currentCustomerName || !currentCustomerName.trim()) {
      alert('Please select a Customer');
      return;
    }
    if (!customerPhone || !customerPhone.trim()) {
      alert('Please enter Customer Mobile / Phone Number (Mandatory)');
      return;
    }
    if (productRows.length === 0) {
      alert('Please add at least one Product Item');
      return;
    }

    try {
      setCreateLoading(true);

      // Auto-add any new product items directly to Products collection in database
      for (const row of productRows) {
        const prodName = row.particular.trim();
        const exists = productOptions.some(
          (opt) => opt.name.trim().toLowerCase() === prodName.toLowerCase()
        );
        if (!exists && prodName) {
          try {
            await ProductsApi.create({
              name: prodName,
              code: row.hsn ? row.hsn.trim() : '',
              hsn: row.hsn ? row.hsn.trim() : '',
              rate: parseFloat(row.rate) || 0,
              pktUnit: row.pktUnit && row.pktUnit !== '-' ? row.pktUnit : '1',
            });
            console.log(`[Product] Auto-created product in database: ${prodName}`);
          } catch (pErr) {
            console.warn(`[Product] Auto-add failed for ${prodName}:`, pErr);
          }
        }
      }

      // Refresh productOptions immediately
      try {
        const freshProducts = await ProductsApi.getAll();
        if (freshProducts && freshProducts.length > 0) {
          setProductOptions(
            freshProducts.map((p: any) => ({
              id: p._id || p.id,
              name: p.name,
              code: p.code || p.hsn || '',
              rate: p.rate,
              pktUnit: p.pktUnit,
            }))
          );
        }
      } catch {}

      const targetCustomer = customerOptions.find((c) => c.name.toLowerCase() === (currentCustomerName || '').toLowerCase());
      const resolvedAddress = customerAddress.trim() || targetCustomer?.address || '';

      const created = await ParticularsApi.create({
        customerName: currentCustomerName || 'General',
        customerAddress: resolvedAddress,
        customerPhone: customerPhone.trim(),
        customerGst: customerGst.trim() || targetCustomer?.gst || '',
        customerState: customerState.trim() || targetCustomer?.state || 'Tamil Nadu',
        customerAadhar: customerGst.trim() || targetCustomer?.aadhar || '',
        customerPan: customerPan.trim() || targetCustomer?.pan || '',
        bundles: bundlesQty || '0',
        caseCount: bundlesQty || caseCount || '0',
        companyName: company.trim() || 'Sri Shanmuga Traders',
        companyAddress: companyAddress.trim(),
        companyGst: companyGst.trim(),
        companyPhone: companyPhone.trim(),
        traderName: company.trim() || 'Sri Shanmuga Traders',
        traderAddress: companyAddress.trim(),
        traderGst: companyGst.trim(),
        traderPhone: companyPhone.trim(),
        discount: '0',
        transport: transportName.trim() || '-',
        lrNo: lrNo.trim() || '-',
        packing: packing ? `${packing}%` : '0',
        billNo: billNo.trim(),
        tax: String(taxVal.toFixed(2)),
        amount: subtotalAmount.toFixed(2),
        total: finalTotalAmount,
        date: date,
        products: productRows.map((p) => ({
          particular: p.particular,
          hsn: p.hsn || '',
          quantity: p.quantity,
          rate: p.rate,
          pktUnit: p.pktUnit,
          amount: p.amount,
        })),
      });

      const assignedBillNo = created?.billNo || billNo.trim();
      const createdBillData: BillPrintData = {
        id: created?._id || created?.id || '',
        _id: created?._id || created?.id || '',
        billNo: assignedBillNo,
        customerName: currentCustomerName || 'General',
        customerAddress: resolvedAddress,
        customerState: customerState.trim() || targetCustomer?.state || 'Tamil Nadu',
        customerGst: customerGst.trim() || targetCustomer?.gst || '',
        customerMobile: customerPhone.trim() || targetCustomer?.mobile || '+91 98765 43210',
        customerPhone: customerPhone.trim() || targetCustomer?.mobile || '',
        companyName: company.trim() || 'Sri Shanmuga Traders',
        companyAddress: companyAddress.trim(),
        companyGst: companyGst.trim(),
        companyPhone: companyPhone.trim(),
        traderName: company.trim() || 'Sri Shanmuga Traders',
        traderAddress: companyAddress.trim(),
        traderGst: companyGst.trim(),
        traderPhone: companyPhone.trim(),
        preparedBy: 'Admin',
        phone: companyPhone.trim() || customerPhone.trim() || '+91 98765 43210',
        email: 'info@bussybee.com',
        website: 'www.bussybee.com',
        transport: transportName.trim() || '-',
        lrNo: lrNo.trim() || '-',
        caseCount: bundlesQty || caseCount || '0',
        date: date,
        products: productRows.map((p) => ({
          particular: p.particular,
          hsn: p.hsn,
          quantity: p.quantity,
          rate: p.rate,
          pktUnit: p.pktUnit,
          amount: p.amount,
        })),
        amount: subtotalAmount.toFixed(2),
        discount: '0',
        packing: packing ? `${packing}%` : '0',
        tax: String(taxVal.toFixed(2)),
        total: finalTotalAmount,
      };

      const successMsg = `Particular bill #${assignedBillNo} created successfully!`;
      alert(successMsg);

      setBillNo('');
      setSelectedProduct('');
      setHsnCode('');
      setProductRows([]);
      setCaseCount('0');
      setBundlesQty('0');
      setPacking('');
      setTax('');
      setTaxPercent('');
      setTransportName('');
      setLrNo('');
      localStorage.removeItem('bussy_bee_particular_transport');
      localStorage.removeItem('bussy_bee_particular_lr_no');
      fetchAccounts(accountFilterCustomer);
      fetchParticulars('ALL');
      setParticularFilterCustomer('ALL');

      setActiveSubTab('Particular Details');

      // Open the print invoice modal automatically
      setSelectedBillForPrint(createdBillData);
      setPrintModalOpen(true);
    } catch (err) {
      console.error('Failed to create particular:', err);
      alert('Error creating particular bill');
    } finally {
      setCreateLoading(false);
    }
  };

  // Account Names Management for Subtab 5 (Add Credit)
  const handleAddSavedAccount = () => {
    const trimmed = newAccountInput.trim();
    if (!trimmed) return;
    if (savedAccounts.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      alert('This account name already exists');
      return;
    }
    const updated = [...savedAccounts, trimmed];
    setSavedAccounts(updated);
    try {
      localStorage.setItem('bussy_bee_transfer_accounts', JSON.stringify(updated));
    } catch {}
    setNewAccountInput('');
    setCreditTransferredTo(trimmed);
  };

  const handleDeleteSavedAccount = (nameToDelete: string) => {
    if (!window.confirm(`Delete "${nameToDelete}" from saved account names?`)) return;
    const updated = savedAccounts.filter((a) => a !== nameToDelete);
    setSavedAccounts(updated);
    try {
      localStorage.setItem('bussy_bee_transfer_accounts', JSON.stringify(updated));
    } catch {}
    if (creditTransferredTo === nameToDelete) {
      setCreditTransferredTo(updated.length > 0 ? updated[0] : '');
    }
  };

  // Subtab 5: Submit Credit
  const handleAddCreditSubmit = async () => {
    const targetCust = addCreditCustomerName || currentCustomerName || (customerOptions[0]?.name ?? 'General');
    if (!creditAmount || parseFloat(creditAmount) <= 0) {
      alert('Please enter a valid credit amount');
      return;
    }

    try {
      setCreditLoading(true);
      const res = await AccountsApi.addCredit({
        customerName: targetCust,
        companyName: creditTransferredTo || '',
        creditAmount: creditAmount.trim(),
        date: creditDate,
        paymentMode: creditPaymentType,
        paymentType: creditPaymentType,
        transferredTo: creditTransferredTo,
        reference: '',
        notes: creditNotes ? creditNotes.trim() : `${creditPaymentType} received into ${creditTransferredTo || 'Account'}`,
      });

      alert(res?.message || 'Credit added successfully!');
      setCreditAmount('');
      setCreditNotes('');
      
      // Refresh all financial states
      fetchAccounts(accountFilterCustomer);
      fetchParticulars(particularFilterCustomer);
      setActiveSubTab('Account Details');
    } catch (err: any) {
      console.error('Failed to add credit:', err);
      alert(err?.message || 'Error adding credit');
    } finally {
      setCreditLoading(false);
    }
  };

  // Delete handlers
  const handleDeleteAccountEntry = async (id: string) => {
    if (!window.confirm('Delete this account ledger transaction?')) return;
    try {
      const entryToDelete = accountDetails.find((a) => (a._id || a.id) === id);
      await AccountsApi.delete(id);
      setAccountDetails((prev) => prev.filter((a) => (a._id || a.id) !== id));
      if (entryToDelete) {
        setParticularDetails((prev) =>
          prev.filter((p) => {
            const pId = p._id || p.id;
            if (entryToDelete.particularId && (pId === entryToDelete.particularId || p._id === entryToDelete.particularId)) return false;
            if (entryToDelete.billNo && p.billNo === entryToDelete.billNo) return false;
            return true;
          })
        );
      }
      fetchAccounts(accountFilterCustomer);
      fetchParticulars(particularFilterCustomer);
    } catch (err) {
      console.error('Failed to delete account entry:', err);
    }
  };

  const handleDeleteParticular = async (id: string) => {
    if (!window.confirm('Delete this particular bill?')) return;
    try {
      const billToDelete = particularDetails.find((p) => (p._id || p.id) === id);
      await ParticularsApi.delete(id);
      setParticularDetails((prev) => prev.filter((p) => (p._id || p.id) !== id));
      setAccountDetails((prev) =>
        prev.filter((a) => {
          if (a.particularId && (a.particularId === id || (billToDelete && a.particularId === (billToDelete._id || billToDelete.id)))) {
            return false;
          }
          if (billToDelete?.billNo && a.billNo && a.billNo === billToDelete.billNo) {
            return false;
          }
          return true;
        })
      );
      fetchAccounts(accountFilterCustomer);
      fetchParticulars(particularFilterCustomer);
    } catch (err) {
      console.error('Failed to delete particular bill:', err);
    }
  };

  const handleOpenBillPrint = (billData: any, autoTrigger = false) => {
    const targetCustomer = customerOptions.find(
      (c) => c.name.toLowerCase() === (billData.customerName || currentCustomerName || '').toLowerCase()
    );
    const savedName = localStorage.getItem('bussy_bee_company_name');
    const savedAddr = localStorage.getItem('bussy_bee_company_address');
    const savedGst = localStorage.getItem('bussy_bee_company_gst');
    const savedPhone = localStorage.getItem('bussy_bee_company_phone');

    const compName = billData.traderName && billData.traderName !== 'BUSSY BEE'
      ? billData.traderName
      : (billData.companyName && billData.companyName !== 'BUSSY BEE'
        ? billData.companyName
        : (savedName || company || 'Sri Shanmuga Traders'));
    const compAddr = billData.traderAddress || billData.companyAddress || savedAddr || companyAddress || '352, Amman Kovil Patti Middle Street, Sivakasi - 626123';
    const compGst = billData.traderGst || billData.companyGst || savedGst || companyGst || '33BUMPR9147N1ZQ';
    const compPhone = billData.traderPhone || billData.companyPhone || savedPhone || companyPhone || '';

    const formattedBill: BillPrintData = {
      id: billData._id || billData.id || '',
      _id: billData._id || billData.id || '',
      billNo: billData.billNo || '',
      date: billData.date || '',
      customerName: billData.customerName || currentCustomerName || '',
      customerAddress: targetCustomer?.address || billData.customerAddress || '',
      customerGst: targetCustomer?.gst || billData.customerGst || '',
      customerMobile: targetCustomer?.mobile || billData.customerPhone || billData.customerMobile || '',
      customerPhone: targetCustomer?.mobile || billData.customerPhone || billData.customerMobile || '',
      companyName: compName,
      companyAddress: compAddr,
      companyGst: compGst,
      companyPhone: compPhone,
      traderName: compName,
      traderAddress: compAddr,
      traderGst: compGst,
      traderPhone: compPhone,
      preparedBy: billData.preparedBy || 'Admin',
      phone: compPhone || targetCustomer?.mobile || '+91 98765 43210',
      email: 'info@bussybee.com',
      website: 'www.bussybee.com',
      transport: billData.transport && billData.transport.trim() !== '' && billData.transport !== '-' ? billData.transport.trim() : '-',
      lrNo: billData.lrNo && billData.lrNo.trim() !== '' && billData.lrNo !== '-' ? billData.lrNo.trim() : '-',
      caseCount: billData.caseCount || billData.cases || (billData.products ? billData.products.reduce((acc: number, p: any) => acc + (parseFloat(p.quantity) || 0), 0) : 0),
      products: (billData.products || []).map((p: any) => ({
        particular: p.particular || p.particularName || p.name || '',
        hsn: p.hsn || '',
        quantity: p.quantity || '',
        rate: p.rate || '',
        pktUnit: p.pktUnit || p.pkt || '',
        amount: p.amount || '',
      })),
      amount: billData.amount || billData.total || '0.00',
      discount: billData.discount !== undefined && billData.discount !== null ? String(billData.discount) : '0',
      packing: billData.packing !== undefined && billData.packing !== null ? String(billData.packing) : '0',
      tax: billData.tax !== undefined && billData.tax !== null ? String(billData.tax) : '0',
      total: billData.total || billData.amount || '0.00',
      pdfData: billData.pdfData || '',
      pdfUrl: billData.pdfUrl || '',
      pdfName: billData.pdfName || '',
    };

    setSelectedBillForPrint(formattedBill);

    if (autoTrigger) {
      if (!compName) {
        setPrintModalOpen(true);
      } else {
        printBillDirectly(formattedBill);
      }
    } else {
      setPrintModalOpen(true);
    }
  };

  // WhatsApp Share Handlers
  const handleShareBillWhatsApp = async (billData: any) => {
    try {
      const targetCustomer = customerOptions.find(
        (c) =>
          (c.name && billData.customerName && c.name.trim().toLowerCase() === billData.customerName.trim().toLowerCase()) ||
          (c.id && billData.customerId && String(c.id) === String(billData.customerId))
      );
      let custPhone = billData.customerMobile || billData.customerPhone || targetCustomer?.mobile || '';
      if (!custPhone && billData.customerName) {
        try {
          const freshCusts = await CustomersApi.getAll();
          const found = (freshCusts || []).find(
            (c: any) => c.name && c.name.trim().toLowerCase() === billData.customerName.trim().toLowerCase()
          );
          if (found) {
            custPhone = found.mobile || found.phone || '';
          }
        } catch {}
      }
      const custAddress = targetCustomer?.address || billData.customerAddress || '';
      const custGst = targetCustomer?.gst || billData.customerGst || '';

      const savedName = localStorage.getItem('bussy_bee_company_name');
      const savedAddr = localStorage.getItem('bussy_bee_company_address');
      const savedGst = localStorage.getItem('bussy_bee_company_gst');
      const savedPhone = localStorage.getItem('bussy_bee_company_phone');

      const compName = billData.traderName && billData.traderName !== 'BUSSY BEE'
        ? billData.traderName
        : (billData.companyName && billData.companyName !== 'BUSSY BEE'
          ? billData.companyName
          : (savedName || company || 'Sri Shanmuga Traders'));
      const compAddr = billData.traderAddress || billData.companyAddress || savedAddr || companyAddress || '352, Amman Kovil Patti Middle Street, Sivakasi - 626123';
      const compGst = billData.traderGst || billData.companyGst || savedGst || companyGst || '33BUMPR9147N1ZQ';
      const compPhone = billData.traderPhone || billData.companyPhone || savedPhone || companyPhone || '';

      const formattedBill: BillPrintData = {
        id: billData._id || billData.id || '',
        _id: billData._id || billData.id || '',
        billNo: billData.billNo || '',
        customerName: billData.customerName || currentCustomerName || 'General',
        customerAddress: custAddress,
        customerGst: custGst,
        customerMobile: custPhone,
        customerPhone: custPhone,
        customerState: billData.customerState || 'Tamil Nadu',
        companyName: compName,
        companyAddress: compAddr,
        companyGst: compGst,
        companyPhone: compPhone,
        traderName: compName,
        traderAddress: compAddr,
        traderGst: compGst,
        traderPhone: compPhone,
        preparedBy: billData.preparedBy || 'Admin',
        phone: compPhone || custPhone || '+91 98765 43210',
        email: 'info@bussybee.com',
        website: 'www.bussybee.com',
        transport: billData.transport && billData.transport !== '-' ? billData.transport : '-',
        lrNo: billData.lrNo && billData.lrNo !== '-' ? billData.lrNo : '-',
        caseCount: billData.caseCount || billData.cases || (billData.products ? billData.products.reduce((acc: number, p: any) => acc + (parseFloat(p.quantity) || 0), 0) : 0),
        date: billData.date || new Date().toISOString().split('T')[0],
        products: (billData.products || []).map((p: any) => ({
          particular: p.particular || p.particularName || p.name || 'Product',
          hsn: p.hsn || '',
          quantity: String(p.quantity || '0'),
          rate: String(p.rate || '0'),
          pktUnit: p.pktUnit || p.pkt || '-',
          amount: String(p.amount || '0'),
        })),
        amount: billData.amount || billData.total || '0.00',
        discount: billData.discount !== undefined && billData.discount !== null ? String(billData.discount) : '0',
        packing: billData.packing !== undefined && billData.packing !== null ? String(billData.packing) : '0',
        tax: billData.tax !== undefined && billData.tax !== null ? String(billData.tax) : '0',
        total: billData.total || billData.amount || '0.00',
      };
      await shareBillOnWhatsApp(formattedBill, custPhone);
    } catch (err) {
      console.error('Failed to share bill on WhatsApp:', err);
    }
  };

  const handleShareParticularsListWhatsApp = async () => {
    try {
      const cust = particularFilterCustomer && particularFilterCustomer !== 'ALL' ? particularFilterCustomer : 'All Customers';
      await shareParticularsListOnWhatsApp(cust, sortedParticularDetails);
    } catch (err) {
      console.error('Failed to share particulars on WhatsApp:', err);
    }
  };

  const handleShareLedgerWhatsApp = async () => {
    try {
      const cust = accountFilterCustomer && accountFilterCustomer !== 'ALL' ? accountFilterCustomer : currentCustomerName;
      const targetCustomer = customerOptions.find((c) => c.name.toLowerCase() === (cust || '').toLowerCase());
      await shareLedgerOnWhatsApp(cust, sortedAccountDetails, undefined, undefined, targetCustomer?.mobile);
    } catch (err) {
      console.error('Failed to share ledger on WhatsApp:', err);
    }
  };

  // Edit Particular Handlers
  const handleOpenEditParticular = (row: any) => {
    const rowId = row._id || row.id || '';
    setEditingParticularId(rowId);
    const rawPack = row.packing !== undefined && row.packing !== null && String(row.packing).trim() !== ''
      ? String(row.packing).replace(/[^0-9.]/g, '')
      : (row.discount !== undefined && row.discount !== null ? String(row.discount).replace(/[^0-9.]/g, '') : '');

    setEditBillForm({
      billNo: row.billNo || '',
      date: row.date || '',
      customerName: row.customerName || '',
      companyName: row.companyName || '',
      transport: row.transport && row.transport !== '-' ? row.transport : '',
      caseCount: String(row.caseCount || '0'),
      discount: '0',
      packing: rawPack === '0' ? '' : rawPack,
      tax: String(row.tax || '0'),
      products: (row.products || []).map((p: any, idx: number) => ({
        id: p._id || p.id || `edit-prod-${idx}`,
        particular: p.particular || p.particularName || p.name || '',
        quantity: String(p.quantity || '0'),
        rate: String(p.rate || '0'),
        pktUnit: p.pktUnit && p.pktUnit !== '-' ? p.pktUnit : (p.pkt && p.pkt !== '-' ? p.pkt : 'nos'),
        amount: String(p.amount || '0'),
      })),
    });
    setOpenEditParticularModal(true);
  };

  const handleAddEditProductRow = () => {
    setEditBillForm((prev) => {
      const updated = [
        ...prev.products,
        {
          id: `edit-prod-${Date.now()}`,
          particular: '',
          quantity: '',
          rate: '',
          pktUnit: 'nos',
          amount: '0.00',
        },
      ];
      const totalCases = updated.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
      return { ...prev, products: updated, caseCount: String(totalCases) };
    });
  };

  const handleUpdateEditProductRow = (index: number, field: string, val: string) => {
    setEditBillForm((prev) => {
      const updated = [...prev.products];
      const row = { ...updated[index], [field]: val };
      if (field === 'quantity' || field === 'rate' || field === 'pktUnit') {
        const q = parseFloat(field === 'quantity' ? val : row.quantity) || 0;
        const r = parseFloat(field === 'rate' ? val : row.rate) || 0;
        const pktStr = (field === 'pktUnit' ? val : row.pktUnit) || '';
        const pieces = extractUnitMultiplier(pktStr);
        row.amount = (q * pieces * r).toFixed(2);
      }
      updated[index] = row;
      const totalCases = updated.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
      return { ...prev, products: updated, caseCount: String(totalCases) };
    });
  };

  const handleDeleteEditProductRow = (index: number) => {
    setEditBillForm((prev) => {
      const updated = prev.products.filter((_, i) => i !== index);
      const totalCases = updated.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
      return { ...prev, products: updated, caseCount: String(totalCases) };
    });
  };

  // Edit Calculation Hooks
  const editSubtotal = useMemo(() => {
    return editBillForm.products.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  }, [editBillForm.products]);

  const editPackingVal = useMemo(() => {
    const pStr = String(editBillForm.packing || '').trim();
    if (!pStr) return 0;
    const cleanPack = pStr.replace(/[^0-9.]/g, '');
    const pNum = parseFloat(cleanPack) || 0;
    if (pNum <= 0) return 0;
    return (editSubtotal * pNum) / 100;
  }, [editSubtotal, editBillForm.packing]);

  const editTaxVal = useMemo(() => {
    const tStr = String(editBillForm.tax || '').trim();
    if (!tStr) return 0;
    const cleanTax = tStr.replace(/[^0-9.]/g, '');
    const tNum = parseFloat(cleanTax) || 0;
    if (tNum <= 0) return 0;
    return tNum;
  }, [editBillForm.tax]);

  const editFinalTotal = useMemo(() => {
    const net = Math.max(0, editSubtotal + editPackingVal + editTaxVal);
    const rounded = Math.round(net);
    return rounded.toFixed(2);
  }, [editSubtotal, editPackingVal, editTaxVal]);

  const handleSaveEditParticular = async () => {
    if (!editingParticularId) return;
    try {
      setEditBillLoading(true);
      await ParticularsApi.update(editingParticularId, {
        customerName: editBillForm.customerName,
        companyName: '',
        date: editBillForm.date,
        transport: '-',
        caseCount: editBillForm.caseCount || '0',
        discount: '0',
        packing: editBillForm.packing ? `${editBillForm.packing}%` : '0',
        tax: editBillForm.tax || '0',
        billNo: editBillForm.billNo,
        amount: editSubtotal.toFixed(2),
        total: editFinalTotal,
        products: editBillForm.products,
      });

      await fetchParticulars(particularFilterCustomer);
      await fetchAccounts(accountFilterCustomer);
      setOpenEditParticularModal(false);
      setPdfToast({
        open: true,
        message: `Bill #${editBillForm.billNo} updated successfully!`,
        severity: 'success',
      });
    } catch (err) {
      console.error('Failed to update particular bill:', err);
      alert('Error updating bill details');
    } finally {
      setEditBillLoading(false);
    }
  };

  // Transport Receipt / PDF Upload Handlers (Up to 5 MB)
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

  const handleTriggerPdfUpload = (id: string) => {
    setUploadTargetBillId(id);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = uploadTargetBillId;
    if (!file || !targetId) return;

    // Reset input so same file can be selected again if needed
    e.target.value = '';

    // 1. Verify file type is Image or PDF
    const isImageOrPdf =
      file.type.startsWith('image/') ||
      file.type === 'application/pdf' ||
      /\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(file.name);
    if (!isImageOrPdf) {
      setPdfToast({
        open: true,
        message: 'Invalid file format. Please upload an Image (JPG, PNG, WEBP) or PDF file.',
        severity: 'error',
      });
      return;
    }

    // 2. Verify file size is under 5 MB
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
      setPdfToast({
        open: true,
        message: `File size (${sizeInMb} MB) exceeds 5 MB limit. Please select a smaller file.`,
        severity: 'error',
      });
      return;
    }

    try {
      setUploadingBillId(targetId);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const uploadRes = await ParticularsApi.uploadPdf(targetId, base64Data, file.name);
          const savedData = uploadRes?.data?.pdfData || base64Data;

          // Update local state in particularDetails
          setParticularDetails((prev) =>
            prev.map((p) => {
              const pId = p._id || p.id;
              if (pId === targetId) {
                return { ...p, pdfData: savedData, pdfName: file.name };
              }
              return p;
            })
          );

          setPdfToast({
            open: true,
            message: `Receipt document "${file.name}" uploaded successfully!`,
            severity: 'success',
          });
        } catch (uploadErr) {
          console.error('Failed to save document to server:', uploadErr);
          setPdfToast({
            open: true,
            message: 'Failed to upload receipt. Please try again.',
            severity: 'error',
          });
        } finally {
          setUploadingBillId(null);
        }
      };

      reader.onerror = () => {
        setUploadingBillId(null);
        setPdfToast({
          open: true,
          message: 'Error reading file.',
          severity: 'error',
        });
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to initiate upload:', err);
      setUploadingBillId(null);
    }
  };

  const _handleOpenPdfPreview = (row: any) => {
    const rowId = row._id || row.id || '';
    if (!row.pdfData) {
      handleTriggerPdfUpload(rowId);
      return;
    }

    setPdfPreviewModal({
      open: true,
      url: row.pdfData,
      name: row.pdfName || `Bill-${row.billNo || 'document'}.pdf`,
      id: rowId,
      billNo: row.billNo,
    });
  };
  void _handleOpenPdfPreview;

  const handleDeleteAttachedPdf = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove the attached PDF from this bill?')) return;
    try {
      await ParticularsApi.deletePdf(id);
      setParticularDetails((prev) =>
        prev.map((p) => {
          const pId = p._id || p.id;
          if (pId === id) {
            return { ...p, pdfData: '', pdfName: '' };
          }
          return p;
        })
      );
      if (pdfPreviewModal?.id === id) {
        setPdfPreviewModal(null);
      }
      setPdfToast({
        open: true,
        message: 'Attached PDF deleted successfully.',
        severity: 'success',
      });
    } catch (err) {
      console.error('Failed to delete attached PDF:', err);
      setPdfToast({
        open: true,
        message: 'Failed to delete attached PDF.',
        severity: 'error',
      });
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        p: { xs: 2, sm: 2.5, md: 3 },
        boxSizing: 'border-box',
      }}
    >
      {/* Subtabs Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 2, sm: 3, md: 4 },
          mb: 2.5,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          borderBottom: '1px solid #EEF2F6',
          pb: 0.5,
          '::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        {subTabs.map((tab) => {
          const isActive = activeSubTab === tab;
          return (
            <Box
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              sx={{
                position: 'relative',
                pb: 1.2,
                cursor: 'pointer',
              }}
            >
              <Typography
                sx={{
                  fontSize: '14px',
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? '#0B4DB7' : '#475569',
                  backgroundColor: isActive && tab === 'Add Credit' ? '#EFF6FF' : 'transparent',
                  px: isActive && tab === 'Add Credit' ? 1.5 : 0.5,
                  py: isActive && tab === 'Add Credit' ? 0.6 : 0,
                  borderRadius: '6px',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    color: '#0B4DB7',
                  },
                }}
              >
                {tab}
              </Typography>

              {/* Active Tab Underline Bar */}
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2.5px',
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

      {/* View 1: Select Customer View */}
      {activeSubTab === 'Select Customer' && (
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              backgroundColor: '#0B4DB7',
              px: { xs: 2, sm: 3 },
              py: 1.6,
              minHeight: '52px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography
              sx={{
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
              }}
            >
              Select Customer
            </Typography>
          </Box>

          <Box
            sx={{
              p: { xs: 3, sm: 4, md: 5 },
              pt: { xs: 4, md: 5 },
              pb: { xs: 5, md: 6 },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: { xs: 1.5, sm: 4 },
                maxWidth: '800px',
              }}
            >
              <Typography
                sx={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0F172A',
                  minWidth: '140px',
                }}
              >
                Select Customer
              </Typography>

              <Box sx={{ width: { xs: '100%', sm: '380px', md: '420px' } }}>
                <Autocomplete
                  fullWidth
                  size="small"
                  autoHighlight
                  options={customerOptions}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                  isOptionEqualToValue={(option, val) => option.id === val.id || option.name === val.name}
                  value={customerOptions.find((c) => c.id === selectedCustomerId) || null}
                  onChange={(_, val) => {
                    if (val) {
                      setSelectedCustomerId(val.id);
                      setCurrentCustomerName(val.name);
                      setAddCreditCustomerName(val.name);
                      setCustomerAddress(val.address || '');
                      setCustomerPhone(val.mobile || '');
                      setCustomerGst(val.gst || '');
                      localStorage.setItem('bussy_bee_active_customer', val.name);
                      if (val.address) localStorage.setItem('bussy_bee_particular_cust_addr', val.address);
                      if (val.mobile) localStorage.setItem('bussy_bee_particular_cust_phone', val.mobile);
                      if (val.gst) localStorage.setItem('bussy_bee_particular_cust_gst', val.gst);
                    } else {
                      setSelectedCustomerId('');
                      setCurrentCustomerName('');
                      setAddCreditCustomerName('');
                      setCustomerAddress('');
                      setCustomerPhone('');
                      setCustomerGst('');
                      localStorage.removeItem('bussy_bee_active_customer');
                      localStorage.removeItem('bussy_bee_particular_cust_addr');
                      localStorage.removeItem('bussy_bee_particular_cust_phone');
                      localStorage.removeItem('bussy_bee_particular_cust_gst');
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Type or select customer..."
                      sx={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-root': {
                          height: '40px',
                          borderRadius: '6px',
                          fontSize: '13.5px',
                          fontWeight: 500,
                          '& fieldset': {
                            borderColor: '#CBD5E1',
                          },
                          '&:hover fieldset': {
                            borderColor: '#94A3B8',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#0B4DB7',
                            borderWidth: '1.5px',
                          },
                        },
                      }}
                    />
                  )}
                />

                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    disableElevation
                    onClick={handleSelectCustomerClick}
                    sx={{
                      backgroundColor: '#0B4DB7',
                      color: '#FFFFFF',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      textTransform: 'none',
                      px: 2.6,
                      py: 0.9,
                      borderRadius: '6px',
                      lineHeight: 1.3,
                      '&:hover': {
                        backgroundColor: '#083B8D',
                      },
                    }}
                  >
                    Click to Select
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
        </Paper>
      )}

      {/* View 2: Create Particular View */}
      {activeSubTab === 'Create Particular' && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
            width: '100%',
          }}
        >
          {/* Top Card: Create Particular Form */}
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                backgroundColor: '#0B4DB7',
                px: 2.2,
                py: 1.4,
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                Create Particular - Customer
              </Typography>
            </Box>

            <Box sx={{ p: 2.5 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(5, 1fr)',
                  },
                  gap: 2,
                }}
              >
                {/* 1. Date */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Date <span style={{ color: '#DC2626' }}>*</span>
                  </Typography>
                  <DatePickerField
                    value={date}
                    onChange={setDate}
                    placeholder="dd-mm-yyyy"
                    iconSize={16}
                    inputSx={{ height: '36px' }}
                  />
                </Box>

                {/* 2. Bill No * */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Bill No <span style={{ color: '#DC2626' }}>*</span>
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Enter Bill No (e.g. 101)"
                    value={billNo}
                    onChange={(e) => setBillNo(e.target.value)}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: '13px',
                          fontWeight: 600,
                          height: '36px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0B4DB7', borderWidth: '1.5px' },
                        },
                      },
                    }}
                  />
                </Box>

                {/* 3. Customer Name * */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Customer Name <span style={{ color: '#DC2626' }}>*</span>
                  </Typography>
                  <Autocomplete
                    fullWidth
                    size="small"
                    autoHighlight
                    options={customerOptions}
                    getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                    isOptionEqualToValue={(option, val) => option.id === val.id || option.name === val.name}
                    value={customerOptions.find((c) => c.name === currentCustomerName) || null}
                    onChange={(_, val) => {
                      const name = val ? val.name : '';
                      setCurrentCustomerName(name);
                      localStorage.setItem('bussy_bee_active_customer', name);
                      if (val) {
                        setSelectedCustomerId(val.id);
                        setAddCreditCustomerName(val.name);
                        setCustomerAddress(val.address || '');
                        setCustomerPhone(val.mobile || '');
                        setCustomerGst(val.gst || val.aadhar || val.pan || '');
                        setCustomerState(val.state || 'Tamil Nadu');
                        setCustomerPan(val.pan || '');
                        if (val.address) localStorage.setItem('bussy_bee_particular_cust_addr', val.address);
                        if (val.mobile) localStorage.setItem('bussy_bee_particular_cust_phone', val.mobile);
                        if (val.gst || val.aadhar || val.pan) localStorage.setItem('bussy_bee_particular_cust_gst', val.gst || val.aadhar || val.pan || '');
                        if (val.state) localStorage.setItem('bussy_bee_particular_cust_state', val.state);
                        if (val.pan) localStorage.setItem('bussy_bee_particular_cust_pan', val.pan);
                      } else {
                        setSelectedCustomerId('');
                        setCustomerAddress('');
                        setCustomerPhone('');
                        setCustomerGst('');
                        setCustomerState('Tamil Nadu');
                        setCustomerPan('');
                        localStorage.removeItem('bussy_bee_particular_cust_addr');
                        localStorage.removeItem('bussy_bee_particular_cust_phone');
                        localStorage.removeItem('bussy_bee_particular_cust_gst');
                        localStorage.removeItem('bussy_bee_particular_cust_state');
                        localStorage.removeItem('bussy_bee_particular_cust_pan');
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Search Customer..."
                        sx={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-root': {
                            height: '36px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#0F172A',
                            '& fieldset': { borderColor: '#CBD5E1' },
                            '&:hover fieldset': { borderColor: '#94A3B8' },
                            '&.Mui-focused fieldset': { borderColor: '#0B4DB7', borderWidth: '1.5px' },
                          },
                        }}
                      />
                    )}
                  />
                </Box>

                {/* 4. Mobile Number * */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Mobile Number <span style={{ color: '#DC2626' }}>*</span>
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Customer Mobile Number"
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value);
                      localStorage.setItem('bussy_bee_particular_cust_phone', e.target.value);
                    }}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: '13px',
                          fontWeight: 600,
                          height: '36px',
                          backgroundColor: '#FFFFFF',
                          color: '#0F172A',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0B4DB7', borderWidth: '1.5px' },
                        },
                      },
                    }}
                  />
                </Box>

                {/* 5. Address */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Address
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="City, Pincode"
                    value={customerAddress}
                    onChange={(e) => {
                      setCustomerAddress(e.target.value);
                      localStorage.setItem('bussy_bee_particular_cust_addr', e.target.value);
                    }}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: '13px',
                          fontWeight: 500,
                          height: '36px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0B4DB7', borderWidth: '1.5px' },
                        },
                      },
                    }}
                  />
                </Box>

                {/* 6. State (Searchable Autocomplete Text Box) */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    State <span style={{ color: '#DC2626' }}>*</span>
                  </Typography>
                  <Autocomplete
                    fullWidth
                    size="small"
                    autoHighlight
                    openOnFocus
                    options={INDIAN_STATES}
                    value={customerState || null}
                    onChange={(_event, newValue) => {
                      const val = newValue || '';
                      setCustomerState(val);
                      localStorage.setItem('bussy_bee_particular_cust_state', val);
                    }}
                    onInputChange={(_event, newInputValue, reason) => {
                      if (reason === 'input' || reason === 'clear') {
                        setCustomerState(newInputValue || '');
                        localStorage.setItem('bussy_bee_particular_cust_state', newInputValue || '');
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Select or search state..."
                        sx={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-root': {
                            height: '36px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#0F172A',
                            '& fieldset': { borderColor: '#CBD5E1' },
                            '&:hover fieldset': { borderColor: '#94A3B8' },
                            '&.Mui-focused fieldset': { borderColor: '#0B4DB7', borderWidth: '1.5px' },
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

                {/* 7. GST Number / Aadhar no / PAN */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    GST Number / Aadhar no / PAN
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="GSTIN / Aadhar / PAN"
                    value={customerGst}
                    onChange={(e) => {
                      setCustomerGst(e.target.value);
                      localStorage.setItem('bussy_bee_particular_cust_gst', e.target.value);
                    }}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: '13px',
                          fontWeight: 500,
                          height: '36px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0B4DB7', borderWidth: '1.5px' },
                        },
                      },
                    }}
                  />
                </Box>

                {/* 8. LR Number */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    LR Number
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Enter LR Number"
                    value={lrNo}
                    onChange={(e) => {
                      setLrNo(e.target.value);
                      localStorage.setItem('bussy_bee_particular_lr_no', e.target.value);
                    }}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: '13px',
                          fontWeight: 500,
                          height: '36px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0B4DB7', borderWidth: '1.5px' },
                        },
                      },
                    }}
                  />
                </Box>

                {/* 9. Transport Name */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Transport Name
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Enter Transport Name"
                    value={transportName}
                    onChange={(e) => {
                      setTransportName(e.target.value);
                      localStorage.setItem('bussy_bee_particular_transport', e.target.value);
                    }}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: '13px',
                          fontWeight: 500,
                          height: '36px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0B4DB7', borderWidth: '1.5px' },
                        },
                      },
                    }}
                  />
                </Box>

                {/* 10. Bundles Qty (bundel) */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Bundles Qty (bundel)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Bundles Qty"
                    value={bundlesQty}
                    onChange={(e) => {
                      setBundlesQty(e.target.value);
                      setCaseCount(e.target.value);
                    }}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: '13px',
                          fontWeight: 600,
                          height: '36px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0B4DB7', borderWidth: '1.5px' },
                        },
                      },
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </Paper>

          {/* Bottom Card: Product Grid & Entry */}
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                backgroundColor: '#0B4DB7',
                px: 2.2,
                py: 1.4,
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                Product Entry
              </Typography>
            </Box>

            <Box
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
                borderBottom: '1px solid #E2E8F0',
              }}
            >
              <Autocomplete
                freeSolo
                size="small"
                autoHighlight
                sx={{ flex: { xs: '1 1 100%', sm: 2.3 }, minWidth: '150px' }}
                options={productOptions}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                isOptionEqualToValue={(option, val) => {
                  const optStr = typeof option === 'string' ? option : option?.name || '';
                  const valStr = typeof val === 'string' ? val : val?.name || '';
                  return optStr.toLowerCase() === valStr.toLowerCase();
                }}
                value={selectedProduct}
                onChange={(_, val) => {
                  if (typeof val === 'string') {
                    setSelectedProduct(val);
                  } else if (val && typeof val === 'object') {
                    setSelectedProduct(val.name || '');
                  } else {
                    setSelectedProduct('');
                  }
                }}
                onInputChange={(_, newInputValue) => {
                  setSelectedProduct(newInputValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search Product..."
                    sx={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px',
                      '& .MuiOutlinedInput-root': {
                        height: '36px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#0F172A',
                        '& fieldset': {
                          borderColor: '#CBD5E1',
                        },
                        '&:hover fieldset': {
                          borderColor: '#94A3B8',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0B4DB7',
                          borderWidth: '1.5px',
                        },
                      },
                    }}
                  />
                )}
              />

              <TextField
                size="small"
                placeholder="HSN Code"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                sx={{
                  flex: { xs: '1 1 45%', sm: 0.9 },
                  minWidth: '80px',
                  '& .MuiOutlinedInput-root': {
                    height: '36px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                  },
                }}
              />

              <TextField
                size="small"
                placeholder="No. of Counts"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                sx={{
                  flex: { xs: '1 1 45%', sm: 1 },
                  minWidth: '95px',
                  '& .MuiOutlinedInput-root': {
                    height: '36px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                  },
                }}
              />

              {isRateVisible && (
                <TextField
                  size="small"
                  placeholder="Rate"
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  sx={{
                    flex: { xs: '1 1 45%', sm: 0.9 },
                    minWidth: '70px',
                    '& .MuiOutlinedInput-root': {
                      height: '36px',
                      fontSize: '13px',
                      fontWeight: 500,
                      borderRadius: '6px',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                    },
                  }}
                />
              )}

              <TextField
                select
                size="small"
                value={pkt || 'nos'}
                onChange={(e) => setPkt(e.target.value)}
                sx={{
                  flex: { xs: '1 1 45%', sm: 1.1 },
                  minWidth: '95px',
                  '& .MuiOutlinedInput-root': {
                    height: '36px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0B4DB7', borderWidth: '1.5px' },
                  },
                }}
              >
                {PKT_UNIT_OPTIONS.map((unit) => (
                  <MenuItem key={unit} value={unit} sx={{ fontSize: '13px', fontWeight: 600 }}>
                    {unit}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                size="small"
                placeholder="Amount"
                value={
                  quantity && rate
                    ? (((parseFloat(quantity) || 0) * extractUnitMultiplier(pkt)) * (parseFloat(rate) || 0)).toFixed(2)
                    : ''
                }
                slotProps={{
                  input: {
                    readOnly: true,
                    sx: {
                      height: '36px',
                      fontSize: '13px',
                      fontWeight: 600,
                      backgroundColor: '#F1F5F9',
                      borderRadius: '6px',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                    },
                  },
                }}
                sx={{ flex: { xs: '1 1 45%', sm: 1.1 } }}
              />

              <Button
                variant="contained"
                disableElevation
                onClick={handleAddProductRow}
                sx={{
                  backgroundColor: '#0B4DB7',
                  color: '#FFFFFF',
                  minWidth: '36px',
                  width: '36px',
                  height: '36px',
                  p: 0,
                  borderRadius: '6px',
                  '&:hover': {
                    backgroundColor: '#083B8D',
                  },
                }}
              >
                <AddRoundedIcon sx={{ fontSize: 20 }} />
              </Button>
            </Box>

            <TableContainer>
              <Table sx={{ width: '100%', borderCollapse: 'collapse' }} aria-label="particular product table">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 2,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '26%',
                      }}
                    >
                      PARTICULAR
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '13%',
                      }}
                    >
                      HSN CODE
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '13%',
                      }}
                    >
                      NO. OF COUNTS
                    </TableCell>
                    {isRateVisible && (
                      <TableCell
                        sx={{
                          py: 1.4,
                          px: 1.5,
                          fontSize: '11.5px',
                          fontWeight: 700,
                          color: '#1E293B',
                          letterSpacing: '0.04em',
                          textAlign: 'center',
                          borderBottom: '1px solid #E2E8F0',
                          borderRight: '1px solid #E2E8F0',
                          width: '12%',
                        }}
                      >
                        RATE
                      </TableCell>
                    )}
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '12%',
                      }}
                    >
                      PKT / UNITS
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '14%',
                      }}
                    >
                      AMOUNT
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        width: '10%',
                      }}
                    >
                      ACTION
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productRows.length > 0 ? (
                    productRows.map((row) => {
                      const isEditing = editingRowId === row.id;
                      const liveAmount = isEditing
                        ? (
                            (parseFloat(editRowData.quantity) || 0) *
                            extractUnitMultiplier(editRowData.pktUnit) *
                            (parseFloat(editRowData.rate) || 0)
                          ).toFixed(2)
                        : row.amount;

                      return (
                        <TableRow
                          key={row.id}
                          sx={{
                            backgroundColor: isEditing ? '#F8FAFC' : 'inherit',
                            '&:hover': {
                              backgroundColor: isEditing ? '#F1F5F9' : '#FAFAFA',
                            },
                          }}
                        >
                          <TableCell
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 600,
                              fontSize: '13px',
                              color: '#0F172A',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            {isEditing ? (
                              <Autocomplete
                                freeSolo
                                size="small"
                                options={productOptions.map((p) => p.name)}
                                value={editRowData.particular}
                                onInputChange={(_e, val) =>
                                  setEditRowData((prev) => ({ ...prev, particular: val || '' }))
                                }
                                onChange={(_e, val) =>
                                  setEditRowData((prev) => ({ ...prev, particular: val || '' }))
                                }
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    size="small"
                                    placeholder="Product Name"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveEditRow(row.id);
                                      } else if (e.key === 'Escape') {
                                        handleCancelEditRow();
                                      }
                                    }}
                                    sx={{
                                      backgroundColor: '#FFFFFF',
                                      '& .MuiInputBase-input': {
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        py: 0.5,
                                      },
                                    }}
                                  />
                                )}
                                sx={{ minWidth: '140px' }}
                              />
                            ) : (
                              row.particular
                            )}
                          </TableCell>

                          <TableCell
                            align="center"
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 600,
                              fontSize: '13px',
                              color: '#334155',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            {isEditing ? (
                              <TextField
                                size="small"
                                value={editRowData.hsn}
                                placeholder="HSN"
                                onChange={(e) =>
                                  setEditRowData((prev) => ({ ...prev, hsn: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveEditRow(row.id);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditRow();
                                  }
                                }}
                                slotProps={{
                                  input: {
                                    sx: {
                                      fontSize: '12.5px',
                                      fontWeight: 600,
                                      textAlign: 'center',
                                      backgroundColor: '#FFFFFF',
                                      '& input': { textAlign: 'center', py: 0.5, px: 0.5 },
                                    },
                                  },
                                }}
                                sx={{ width: '85px' }}
                              />
                            ) : (
                              row.hsn || '-'
                            )}
                          </TableCell>

                          <TableCell
                            align="center"
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 600,
                              fontSize: '13px',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            {isEditing ? (
                              <TextField
                                size="small"
                                type="number"
                                value={editRowData.quantity}
                                onChange={(e) =>
                                  setEditRowData((prev) => ({ ...prev, quantity: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveEditRow(row.id);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditRow();
                                  }
                                }}
                                slotProps={{
                                  input: {
                                    sx: {
                                      fontSize: '13px',
                                      fontWeight: 700,
                                      textAlign: 'center',
                                      backgroundColor: '#FFFFFF',
                                      '& input': { textAlign: 'center', py: 0.5, px: 0.5 },
                                    },
                                  },
                                }}
                                sx={{ width: '80px' }}
                              />
                            ) : (
                              row.quantity
                            )}
                          </TableCell>

                          {isRateVisible && (
                            <TableCell
                              align="center"
                              sx={{
                                borderBottom: '1px solid #E2E8F0',
                                borderRight: '1px solid #E2E8F0',
                                fontWeight: 600,
                                fontSize: '13px',
                                py: isEditing ? 0.8 : 1.2,
                              }}
                            >
                              {isEditing ? (
                                <TextField
                                  size="small"
                                  type="number"
                                  value={editRowData.rate}
                                  onChange={(e) =>
                                    setEditRowData((prev) => ({ ...prev, rate: e.target.value }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveEditRow(row.id);
                                    } else if (e.key === 'Escape') {
                                      handleCancelEditRow();
                                    }
                                  }}
                                  slotProps={{
                                    input: {
                                      sx: {
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        textAlign: 'center',
                                        backgroundColor: '#FFFFFF',
                                        '& input': { textAlign: 'center', py: 0.5, px: 0.5 },
                                      },
                                    },
                                  }}
                                  sx={{ width: '85px' }}
                                />
                              ) : (
                                row.rate
                              )}
                            </TableCell>
                          )}

                          <TableCell
                            align="center"
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 600,
                              fontSize: '13px',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            {isEditing ? (
                              <TextField
                                select
                                size="small"
                                value={editRowData.pktUnit || 'nos'}
                                onChange={(e) =>
                                  setEditRowData((prev) => ({ ...prev, pktUnit: e.target.value }))
                                }
                                sx={{
                                  width: '95px',
                                  '& .MuiOutlinedInput-root': {
                                    height: '32px',
                                    fontSize: '12.5px',
                                    fontWeight: 700,
                                    backgroundColor: '#FFFFFF',
                                    borderRadius: '6px',
                                  },
                                }}
                              >
                                {PKT_UNIT_OPTIONS.map((unit) => (
                                  <MenuItem key={unit} value={unit} sx={{ fontSize: '12.5px' }}>
                                    {unit}
                                  </MenuItem>
                                ))}
                              </TextField>
                            ) : (
                              row.pktUnit
                            )}
                          </TableCell>

                          <TableCell
                            align="center"
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 700,
                              fontSize: '13px',
                              color: isEditing ? '#0B4DB7' : '#0F172A',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            ₹{parseFloat(liveAmount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>

                          <TableCell align="center" sx={{ borderBottom: '1px solid #E2E8F0', py: isEditing ? 0.8 : 1.2 }}>
                            {isEditing ? (
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.6 }}>
                                <Tooltip title="Save (Enter)" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleSaveEditRow(row.id)}
                                    sx={{
                                      backgroundColor: '#16A34A',
                                      color: '#FFFFFF',
                                      borderRadius: '5px',
                                      width: '26px',
                                      height: '26px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#15803D' },
                                    }}
                                  >
                                    <CheckRoundedIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Cancel (Esc)" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={handleCancelEditRow}
                                    sx={{
                                      backgroundColor: '#F1F5F9',
                                      color: '#64748B',
                                      borderRadius: '5px',
                                      width: '26px',
                                      height: '26px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#E2E8F0', color: '#0F172A' },
                                    }}
                                  >
                                    <CloseRoundedIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            ) : (
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.6 }}>
                                <Tooltip title="Edit Product Item (Cases, Rate, Pkt/Unit)" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleStartEditRow(row)}
                                    sx={{
                                      backgroundColor: '#EFF6FF',
                                      color: '#0B4DB7',
                                      borderRadius: '5px',
                                      width: '26px',
                                      height: '26px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#DBEAFE' },
                                    }}
                                  >
                                    <ModeEditOutlineRoundedIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete Item" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => setProductRows((prev) => prev.filter((p) => p.id !== row.id))}
                                    sx={{
                                      backgroundColor: '#FEF2F2',
                                      color: '#DC2626',
                                      borderRadius: '5px',
                                      width: '26px',
                                      height: '26px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#FEE2E2' },
                                    }}
                                  >
                                    <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <>
                      <TableRow sx={{ height: '65px' }}>
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        {isRateVisible && <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />}
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0' }} />
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Below Products Table: Right-aligned Calculation & Submit */}
            <Box
              sx={{
                p: { xs: 2, sm: 2.5 },
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: { xs: 'stretch', sm: 'flex-end' },
              }}
            >
              <Box
                sx={{
                  width: { xs: '100%', sm: '380px', md: '400px' },
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  backgroundColor: '#FFFFFF',
                  p: 2.2,
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                {/* 1. Amount (Subtotal) */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                    Amount
                  </Typography>
                  <Typography sx={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                    ₹{subtotalAmount.toFixed(2)}
                  </Typography>
                </Box>

                <Divider sx={{ my: 0.2 }} />

                {/* 2. Packing Box and Tax Boxes (Stacked Vertically) */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {/* Packing (%) Box */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.4 }}>
                      <Typography sx={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>
                        Packing (%)
                      </Typography>
                      {packingVal > 0 && (
                        <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: '#16A34A' }}>
                          +₹{packingVal.toFixed(2)}
                        </Typography>
                      )}
                    </Box>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="0"
                      value={packing}
                      onChange={(e) => setPacking(e.target.value)}
                      slotProps={{
                        input: {
                          sx: {
                            fontSize: '13px',
                            fontWeight: 600,
                            height: '36px',
                            backgroundColor: '#FFFFFF',
                            borderRadius: '6px',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0B4DB7', borderWidth: '1.5px' },
                          },
                        },
                      }}
                    />
                  </Box>

                  {/* Tax (₹) Box */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.4 }}>
                      <Typography sx={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>
                        Tax (₹) {Boolean(taxPercent && parseFloat(taxPercent) > 0) && <span style={{ color: '#94A3B8' }}>(Disabled - % Selected)</span>}
                      </Typography>
                      {tax && parseFloat(tax) > 0 && (
                        <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: '#16A34A' }}>
                          +₹{taxVal.toFixed(2)}
                        </Typography>
                      )}
                    </Box>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Enter Tax (₹)"
                      value={tax}
                      disabled={Boolean(taxPercent && parseFloat(taxPercent) > 0)}
                      onChange={(e) => {
                        setTax(e.target.value);
                        if (e.target.value) setTaxPercent('');
                      }}
                      slotProps={{
                        input: {
                          sx: {
                            fontSize: '13px',
                            fontWeight: 600,
                            height: '36px',
                            backgroundColor: Boolean(taxPercent && parseFloat(taxPercent) > 0) ? '#F1F5F9' : '#FFFFFF',
                            borderRadius: '6px',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0B4DB7', borderWidth: '1.5px' },
                          },
                        },
                      }}
                    />
                  </Box>

                  {/* Tax (%) Dropdown Box */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.4 }}>
                      <Typography sx={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>
                        Tax (%) {Boolean(tax && parseFloat(tax) > 0) && <span style={{ color: '#94A3B8' }}>(Disabled - ₹ Entered)</span>}
                      </Typography>
                      {taxPercent && parseFloat(taxPercent) > 0 && (
                        <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: '#16A34A' }}>
                          +₹{taxVal.toFixed(2)}
                        </Typography>
                      )}
                    </Box>
                    <Select
                      fullWidth
                      size="small"
                      value={taxPercent}
                      disabled={Boolean(tax && parseFloat(tax) > 0)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTaxPercent(val);
                        if (val && parseFloat(val) > 0) setTax('');
                      }}
                      displayEmpty
                      sx={{
                        height: '36px',
                        fontSize: '13px',
                        fontWeight: 600,
                        backgroundColor: Boolean(tax && parseFloat(tax) > 0) ? '#F1F5F9' : '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0B4DB7', borderWidth: '1.5px' },
                      }}
                    >
                      <MenuItem value="" sx={{ fontSize: '13px' }}>
                        <em>None (0%)</em>
                      </MenuItem>
                      {TAX_PERCENT_OPTIONS.filter((o) => Boolean(o.value)).map((opt) => (
                        <MenuItem key={opt.value} value={String(opt.value)} sx={{ fontSize: '13px', fontWeight: 600 }}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </Box>
                </Box>

                {/* Round Off Row */}
                {Math.abs(roundOffDiff) > 0.001 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 0.2 }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                      Round Off
                    </Typography>
                    <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: roundOffDiff >= 0 ? '#16A34A' : '#DC2626' }}>
                      {roundOffDiff >= 0 ? `+₹${roundOffDiff.toFixed(2)}` : `-₹${Math.abs(roundOffDiff).toFixed(2)}`}
                    </Typography>
                  </Box>
                )}

                <Divider sx={{ my: 0.2 }} />

                {/* 3. Grand Total Box */}
                <Box
                  sx={{
                    p: 1.2,
                    backgroundColor: '#EFF6FF',
                    border: '1.5px solid #3B82F6',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: '13.5px', fontWeight: 700, color: '#1E40AF' }}>
                    Grand Total
                  </Typography>
                  <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#1D4ED8' }}>
                    ₹{finalTotalAmount}
                  </Typography>
                </Box>

                {/* 4. Submit Button */}
                <Button
                  variant="contained"
                  disableElevation
                  fullWidth
                  onClick={handleCreateParticular}
                  disabled={createLoading}
                  sx={{
                    backgroundColor: '#0284C7',
                    color: '#FFFFFF',
                    height: '40px',
                    fontSize: '14px',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                    '&:hover': {
                      backgroundColor: '#0369A1',
                    },
                  }}
                >
                  {createLoading ? 'Submitting...' : 'Submit'}
                </Button>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* View 3: Account Details View */}
      {activeSubTab === 'Account Details' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Top Metric Cards (Super Admin only) */}
          {isSuperAdmin && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 2.2,
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '10px',
                    backgroundColor: '#FEF2F2',
                    color: '#DC2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ReceiptLongRoundedIcon sx={{ fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                    Total Purchases (Debit)
                  </Typography>
                  <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#DC2626' }}>
                    ₹{overallTotals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2.2,
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '10px',
                    backgroundColor: '#F0FDF4',
                    color: '#16A34A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AccountBalanceWalletRoundedIcon sx={{ fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                    Total Paid / Credits
                  </Typography>
                  <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#16A34A' }}>
                    ₹{overallTotals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2.2,
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '10px',
                    backgroundColor: overallTotals.netBalance < 0 ? '#FEF2F2' : '#F0FDF4',
                    color: overallTotals.netBalance < 0 ? '#DC2626' : '#16A34A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AccountBalanceWalletRoundedIcon sx={{ fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                    Net Outstanding Balance
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: overallTotals.netBalance < 0 ? '#DC2626' : '#16A34A',
                    }}
                  >
                    ₹{overallTotals.netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Paper>
            </Box>
          )}

          {/* Account Details Table */}
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                backgroundColor: '#0B4DB7',
                px: { xs: 2, sm: 3 },
                py: 1.5,
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: { xs: 'stretch', md: 'center' },
                justifyContent: 'space-between',
                gap: 1.5,
                minHeight: '52px',
              }}
            >
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontSize: '15.5px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                Account Details {accountFilterCustomer && accountFilterCustomer !== 'ALL' ? `- ${accountFilterCustomer}` : '(All Customers)'}
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: 'stretch',
                  gap: 1.2,
                  width: { xs: '100%', md: 'auto' },
                }}
              >
                <Autocomplete
                  size="small"
                  openOnFocus
                  autoHighlight
                  options={[{ id: 'ALL', name: 'All Customers' }, ...customerOptions]}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                  isOptionEqualToValue={(option, val) => {
                    const optName = typeof option === 'string' ? option : option.name;
                    const valName = typeof val === 'string' ? val : val.name;
                    return optName === valName;
                  }}
                  value={
                    accountFilterCustomer && accountFilterCustomer !== 'ALL'
                      ? customerOptions.find((c) => c.name === accountFilterCustomer) || { id: accountFilterCustomer, name: accountFilterCustomer }
                      : { id: 'ALL', name: 'All Customers' }
                  }
                  inputValue={accountCustomerInput}
                  onInputChange={(_, newInputValue, reason) => {
                    if (reason === 'input') {
                      setAccountCustomerInput(newInputValue);
                    } else if (reason === 'reset') {
                      const curName = accountFilterCustomer && accountFilterCustomer !== 'ALL'
                        ? accountFilterCustomer
                        : 'All Customers';
                      setAccountCustomerInput(newInputValue || curName);
                    } else if (reason === 'clear') {
                      setAccountCustomerInput('');
                      setAccountFilterCustomer('ALL');
                      fetchAccounts('ALL');
                    }
                  }}
                  filterOptions={(options, state) => {
                    if (!state.inputValue || state.inputValue === 'All Customers') {
                      return options;
                    }
                    const query = state.inputValue.toLowerCase().trim();
                    return options.filter((o) => {
                      const name = typeof o === 'string' ? o : o.name;
                      return name && name.toLowerCase().includes(query);
                    });
                  }}
                  onChange={(_, val) => {
                    const selectedName = val ? (val.id === 'ALL' ? 'ALL' : val.name) : 'ALL';
                    setAccountFilterCustomer(selectedName);
                    fetchAccounts(selectedName);
                  }}
                  sx={{ width: { xs: '100%', sm: 220 } }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Filter Customer..."
                      onClick={() => {
                        if (accountCustomerInput === 'All Customers') {
                          setAccountCustomerInput('');
                        }
                      }}
                      onFocus={(e) => {
                        if (accountCustomerInput === 'All Customers') {
                          setAccountCustomerInput('');
                        } else {
                          (e.target as HTMLInputElement)?.select?.();
                        }
                      }}
                      sx={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-root': {
                          height: '34px',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          py: 0,
                        },
                      }}
                    />
                  )}
                />

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.2,
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  <Button
                    variant="contained"
                    disableElevation
                    onClick={handleShareLedgerWhatsApp}
                    startIcon={<WhatsAppIcon sx={{ fontSize: '18px !important', color: '#FFFFFF' }} />}
                    sx={{
                      flex: { xs: 1, sm: 'none' },
                      minWidth: 0,
                      backgroundColor: '#25D366',
                      color: '#FFFFFF',
                      fontSize: { xs: '12px', sm: '13px' },
                      fontWeight: 700,
                      textTransform: 'none',
                      px: { xs: 1.2, sm: 2 },
                      py: 0.7,
                      borderRadius: '6px',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.2,
                      '&:hover': {
                        backgroundColor: '#1EBE5D',
                      },
                    }}
                  >
                    Share on WhatsApp
                  </Button>
                  <Button
                    variant="contained"
                    disableElevation
                    onClick={() => setOpenAccountDateModal(true)}
                    startIcon={<PrintOutlinedIcon sx={{ fontSize: '18px !important', color: '#0F172A' }} />}
                    sx={{
                      flex: { xs: 1, sm: 'none' },
                      minWidth: 0,
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      fontSize: { xs: '12px', sm: '13px' },
                      fontWeight: 700,
                      textTransform: 'none',
                      px: { xs: 1.2, sm: 2.2 },
                      py: 0.7,
                      borderRadius: '6px',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.2,
                      '&:hover': {
                        backgroundColor: '#F8FAFC',
                      },
                    }}
                  >
                    Click to Print
                  </Button>
                </Box>
              </Box>
            </Box>

            <TableContainer>
              <Table sx={{ width: '100%' }} aria-label="account details table">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                    <TableCell sx={{ py: 1.5, px: { xs: 2, sm: 3 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '60px' }}>
                      SL.NO
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '110px' }}>
                      DATE
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '140px' }}>
                      CUSTOMER
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: { xs: 2, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B' }}>
                      PRODUCT NAME
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '150px' }}>
                      ADDRESS
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '110px' }}>
                      DEBIT
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell align="right" sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '110px' }}>
                        CREDIT
                      </TableCell>
                    )}
                    <TableCell align="right" sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '120px' }}>
                      BALANCE
                    </TableCell>
                    <TableCell align="center" sx={{ py: 1.5, px: { xs: 2, sm: 3 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '70px' }}>
                      DELETE
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accountLoading ? (
                    <TableRow>
                      <TableCell colSpan={isSuperAdmin ? 9 : 8} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={32} sx={{ color: '#0B4DB7' }} />
                      </TableCell>
                    </TableRow>
                  ) : sortedAccountDetails.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSuperAdmin ? 9 : 8} align="center" sx={{ py: 6, color: '#64748B' }}>
                        No account details found {accountFilterCustomer && accountFilterCustomer !== 'ALL' ? `for ${accountFilterCustomer}` : ''}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedAccountDetails.map((row: any, index: number) => {
                      const isLast = index === sortedAccountDetails.length - 1;
                      const rowId = row._id || row.id || '';
                      return (
                        <TableRow
                          key={rowId || index}
                          sx={{
                            '&:hover': {
                              backgroundColor: '#F8FAFC',
                            },
                          }}
                        >
                          <TableCell sx={{ py: 1.6, px: { xs: 2, sm: 3 }, fontSize: '13.5px', fontWeight: 600, color: '#1E293B', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {index + 1}
                          </TableCell>
                          <TableCell sx={{ py: 1.6, px: { xs: 1.5, sm: 2.5 }, fontSize: '13.5px', fontWeight: 500, color: '#475569', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {row.date}
                          </TableCell>
                          <TableCell sx={{ py: 1.6, px: { xs: 1.5, sm: 2.5 }, fontSize: '13.5px', fontWeight: 700, color: '#0B4DB7', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {row.customerName}
                          </TableCell>
                          <TableCell sx={{ py: 1.6, px: { xs: 2, sm: 2.5 }, fontSize: '13.5px', fontWeight: 600, color: '#0F172A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', maxWidth: '240px' }}>
                            {(() => {
                              if (row.productName && row.productName !== 'General' && row.productName !== '-') {
                                return row.productName;
                              }
                              const matchedPart = particularDetails.find(
                                (p: any) =>
                                  (row.particularId && (p._id === row.particularId || p.id === row.particularId)) ||
                                  (row.billNo && p.billNo === row.billNo)
                              );
                              if (matchedPart && matchedPart.products && matchedPart.products.length > 0) {
                                return matchedPart.products.map((p: any) => p.particular).filter(Boolean).join(', ');
                              }
                              if (row.companyName && row.companyName !== 'General' && row.companyName !== '-') {
                                return row.companyName;
                              }
                              if (row.type === 'CREDIT' || row.type === 'ADVANCE') {
                                return row.notes || row.paymentMode || 'Credit Added';
                              }
                              return '-';
                            })()}
                          </TableCell>
                          <TableCell sx={{ py: 1.6, px: { xs: 1.5, sm: 2.5 }, fontSize: '13px', fontWeight: 500, color: '#334155', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', maxWidth: '160px' }}>
                            {(() => {
                              const targetCustomer = customerOptions.find(
                                (c) => c.name.toLowerCase() === (row.customerName || '').toLowerCase()
                              );
                              const matchedPart = particularDetails.find(
                                (p: any) =>
                                  (row.particularId && (p._id === row.particularId || p.id === row.particularId)) ||
                                  (row.billNo && p.billNo === row.billNo)
                              );
                              const rawAddr = row.address || matchedPart?.customerAddress || targetCustomer?.address || '';
                              const formatted = formatCityAndPincode(rawAddr);
                              if (!formatted || formatted === '-') return '-';
                              return (
                                <Tooltip title={rawAddr || formatted} arrow>
                                  <span style={{ display: 'inline-block', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                    {formatted}
                                  </span>
                                </Tooltip>
                              );
                            })()}
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1.6, px: { xs: 1.5, sm: 2.5 }, fontSize: '13.5px', fontWeight: 500, color: '#DC2626', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {row.debit}
                          </TableCell>
                          {isSuperAdmin && (
                            <TableCell align="right" sx={{ py: 1.6, px: { xs: 1.5, sm: 2.5 }, fontSize: '13.5px', fontWeight: 600, color: '#16A34A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                              {row.credit}
                            </TableCell>
                          )}
                          <TableCell
                            align="right"
                            sx={{
                              py: 1.6,
                              px: { xs: 1.5, sm: 2.5 },
                              fontSize: '13.5px',
                              fontWeight: 700,
                              color: String(row.balance).startsWith('-') ? '#DC2626' : '#16A34A',
                              borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                            }}
                          >
                            {row.balance}
                          </TableCell>
                          <TableCell align="center" sx={{ py: 1.6, px: { xs: 2, sm: 3 }, borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            <Tooltip title="Delete Record" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteAccountEntry(rowId)}
                                sx={{
                                  color: '#64748B',
                                  backgroundColor: '#F8FAFC',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '6px',
                                  p: 0.7,
                                  transition: 'all 0.15s ease',
                                  '&:hover': {
                                    color: '#DC2626',
                                    backgroundColor: '#FEF2F2',
                                    borderColor: '#FECACA',
                                  },
                                }}
                              >
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* View 4: Particular Details View */}
      {activeSubTab === 'Particular Details' && (
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              backgroundColor: '#0B4DB7',
              px: { xs: 2, sm: 3 },
              py: 1.5,
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'stretch', md: 'center' },
              justifyContent: 'space-between',
              gap: 1.5,
              minHeight: '52px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                Particular Details {particularFilterCustomer && particularFilterCustomer !== 'ALL' ? `- ${particularFilterCustomer}` : '(All Customers)'}
              </Typography>
              <Chip
                label={`${sortedParticularDetails.length} Bills`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '12px',
                }}
              />
            </Box>

            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: 'stretch',
                gap: 1.2,
                width: { xs: '100%', md: 'auto' },
              }}
            >
              <Autocomplete
                size="small"
                openOnFocus
                autoHighlight
                options={[{ id: 'ALL', name: 'All Customers' }, ...customerOptions]}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                isOptionEqualToValue={(option, val) => {
                  const optName = typeof option === 'string' ? option : option.name;
                  const valName = typeof val === 'string' ? val : val.name;
                  return optName === valName;
                }}
                value={
                  particularFilterCustomer && particularFilterCustomer !== 'ALL'
                    ? customerOptions.find((c) => c.name === particularFilterCustomer) || { id: particularFilterCustomer, name: particularFilterCustomer }
                    : { id: 'ALL', name: 'All Customers' }
                }
                inputValue={particularCustomerInput}
                onInputChange={(_, newInputValue, reason) => {
                  if (reason === 'input') {
                    setParticularCustomerInput(newInputValue);
                  } else if (reason === 'reset') {
                    const curName = particularFilterCustomer && particularFilterCustomer !== 'ALL'
                      ? particularFilterCustomer
                      : 'All Customers';
                    setParticularCustomerInput(newInputValue || curName);
                  } else if (reason === 'clear') {
                    setParticularCustomerInput('');
                    setParticularFilterCustomer('ALL');
                    fetchParticulars('ALL');
                  }
                }}
                filterOptions={(options, state) => {
                  if (!state.inputValue || state.inputValue === 'All Customers') {
                    return options;
                  }
                  const query = state.inputValue.toLowerCase().trim();
                  return options.filter((o) => {
                    const name = typeof o === 'string' ? o : o.name;
                    return name && name.toLowerCase().includes(query);
                  });
                }}
                onChange={(_, val) => {
                  const selectedName = val ? (val.id === 'ALL' ? 'ALL' : val.name) : 'ALL';
                  setParticularFilterCustomer(selectedName);
                  fetchParticulars(selectedName);
                }}
                sx={{ width: { xs: '100%', sm: 220 } }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Filter Customer..."
                    onClick={() => {
                      if (particularCustomerInput === 'All Customers') {
                        setParticularCustomerInput('');
                      }
                    }}
                    onFocus={(e) => {
                      if (particularCustomerInput === 'All Customers') {
                        setParticularCustomerInput('');
                      } else {
                        (e.target as HTMLInputElement)?.select?.();
                      }
                    }}
                    sx={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px',
                      '& .MuiOutlinedInput-root': {
                        height: '34px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        py: 0,
                      },
                    }}
                  />
                )}
              />

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.2,
                  width: { xs: '100%', sm: 'auto' },
                }}
              >
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleShareParticularsListWhatsApp}
                  startIcon={<WhatsAppIcon sx={{ fontSize: '18px !important', color: '#FFFFFF' }} />}
                  sx={{
                    flex: { xs: 1, sm: 'none' },
                    minWidth: 0,
                    backgroundColor: '#25D366',
                    color: '#FFFFFF',
                    fontSize: { xs: '12px', sm: '13px' },
                    fontWeight: 700,
                    textTransform: 'none',
                    px: { xs: 1.2, sm: 2 },
                    py: 0.6,
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      backgroundColor: '#1EBE5D',
                    },
                  }}
                >
                  Share on WhatsApp
                </Button>
                <Button
                  variant="contained"
                  disableElevation
                  onClick={() => setOpenParticularDateModal(true)}
                  startIcon={<PrintOutlinedIcon sx={{ fontSize: '18px !important', color: '#0F172A' }} />}
                  sx={{
                    flex: { xs: 1, sm: 'none' },
                    minWidth: 0,
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    fontSize: { xs: '12px', sm: '13px' },
                    fontWeight: 700,
                    textTransform: 'none',
                    px: { xs: 1.2, sm: 2 },
                    py: 0.6,
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      backgroundColor: '#F8FAFC',
                    },
                  }}
                >
                  Print Bills List
                </Button>
              </Box>
            </Box>
          </Box>

          <TableContainer>
            <Table sx={{ width: '100%', borderCollapse: 'collapse' }} aria-label="particular details table">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '80px' }}>
                    BILL.NO
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '130px' }}>
                    CUSTOMER
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '150px' }}>
                    PRODUCT NAME
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '95px' }}>
                    DATE
                  </TableCell>
                  <TableCell align="right" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '100px' }}>
                    SUBTOTAL
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '80px' }}>
                    PACKING
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '75px' }}>
                    TAX
                  </TableCell>
                  <TableCell align="right" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '110px' }}>
                    NET TOTAL
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', width: '150px' }}>
                    ACTION
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {particularLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={32} sx={{ color: '#0B4DB7' }} />
                    </TableCell>
                  </TableRow>
                ) : sortedParticularDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 6, color: '#64748B' }}>
                      No particular bills found {particularFilterCustomer && particularFilterCustomer !== 'ALL' ? `for ${particularFilterCustomer}` : ''}.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedParticularDetails.map((row, index) => {
                    const isLast = index === sortedParticularDetails.length - 1;
                    const rowId = row._id || row.id || '';
                    const subtotalNum = parseFloat(String(row.amount || row.total || '0').replace(/,/g, '')) || 0;
                    const totalNum = parseFloat(String(row.total || row.amount || '0').replace(/,/g, '')) || 0;
                    const rawPack = row.packing !== undefined && row.packing !== null && String(row.packing).trim() !== ''
                      ? String(row.packing).replace(/[^0-9.]/g, '')
                      : (row.discount !== undefined && row.discount !== null ? String(row.discount).replace(/[^0-9.]/g, '') : '');
                    const packStr = rawPack && parseFloat(rawPack) > 0 ? `${rawPack}%` : '-';
                    const taxStr = row.tax && parseFloat(row.tax) > 0 ? `₹${parseFloat(row.tax).toLocaleString('en-IN')}` : '-';

                    return (
                      <TableRow
                        key={rowId || index}
                        sx={{
                          '&:hover': {
                            backgroundColor: '#F8FAFC',
                          },
                        }}
                      >
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '13px', fontWeight: 700, color: '#0F172A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {row.billNo}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '13px', fontWeight: 700, color: '#0B4DB7', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {row.customerName}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '13px', fontWeight: 600, color: '#0F172A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6', maxWidth: '200px' }}>
                          {(() => {
                            const productNames = (row.products || []).map((p: any) => p.particular).filter(Boolean);
                            if (productNames.length === 0) return row.companyName && row.companyName !== 'General' ? row.companyName : '-';
                            const joined = productNames.join(', ');
                            return (
                              <Tooltip title={joined} arrow>
                                <span style={{ display: 'inline-block', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                  {joined}
                                </span>
                              </Tooltip>
                            );
                          })()}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '12.5px', fontWeight: 500, color: '#475569', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {row.date}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.4, px: 1.5, fontSize: '13px', fontWeight: 600, color: '#475569', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          ₹{subtotalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '12.5px', fontWeight: 600, color: packStr !== '-' ? '#0284C7' : '#94A3B8', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {packStr}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '12.5px', fontWeight: 600, color: taxStr !== '-' ? '#0F172A' : '#94A3B8', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {taxStr}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.4, px: 1.5, fontSize: '13.5px', fontWeight: 800, color: '#0F172A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          ₹{totalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.6 }}>
                            <Tooltip title="Share on WhatsApp" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleShareBillWhatsApp(row)}
                                sx={{
                                  backgroundColor: '#25D366',
                                  color: '#FFFFFF',
                                  borderRadius: '4px',
                                  width: '24px',
                                  height: '22px',
                                  p: 0,
                                  '&:hover': { backgroundColor: '#1EBE5D' },
                                }}
                              >
                                <WhatsAppIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="View" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenBillPrint(row, false)}
                                sx={{
                                  backgroundColor: '#0B4DB7',
                                  color: '#FFFFFF',
                                  borderRadius: '4px',
                                  width: '24px',
                                  height: '22px',
                                  p: 0,
                                  '&:hover': { backgroundColor: '#083B8D' },
                                }}
                              >
                                <VisibilityRoundedIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Print" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenBillPrint(row, true)}
                                sx={{
                                  backgroundColor: '#334155',
                                  color: '#FFFFFF',
                                  borderRadius: '4px',
                                  width: '24px',
                                  height: '22px',
                                  p: 0,
                                  '&:hover': { backgroundColor: '#1E293B' },
                                }}
                              >
                                <PrintOutlinedIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>

                            {/* Edit Particular Bill Button */}
                            <Tooltip title="Edit Bill Details" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenEditParticular(row)}
                                sx={{
                                  backgroundColor: '#0284C7',
                                  color: '#FFFFFF',
                                  borderRadius: '4px',
                                  width: '24px',
                                  height: '22px',
                                  p: 0,
                                  '&:hover': { backgroundColor: '#0369A1' },
                                }}
                              >
                                <ModeEditOutlineRoundedIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Delete" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteParticular(rowId)}
                                sx={{
                                  backgroundColor: '#DC2626',
                                  color: '#FFFFFF',
                                  borderRadius: '4px',
                                  width: '24px',
                                  height: '22px',
                                  p: 0,
                                  '&:hover': { backgroundColor: '#B91C1C' },
                                }}
                              >
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* View 5: Add Credit View (Super Admin Only) */}
      {activeSubTab === 'Add Credit' && isSuperAdmin && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            py: { xs: 2, sm: 4, md: 5 },
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              maxWidth: { xs: '100%', sm: '680px', md: '780px', lg: '840px' },
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                backgroundColor: '#0B4DB7',
                px: { xs: 2.5, sm: 3.5 },
                py: 2,
                minHeight: '52px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                Add Credit - Customer
              </Typography>
            </Box>

            <Box
              sx={{
                p: { xs: 3, sm: 5, md: 6 },
                pb: { xs: 4, sm: 6, md: 7 },
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              {/* 1. Date */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Date
                </Typography>
                <DatePickerField
                  value={creditDate}
                  onChange={setCreditDate}
                  placeholder="dd-mm-yyyy"
                  iconSize={18}
                  inputSx={{
                    fontSize: '13.5px',
                    height: '42px',
                  }}
                />
              </Box>

              {/* 2. Customer Name */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Customer Name
                </Typography>
                <Autocomplete
                  fullWidth
                  size="small"
                  autoHighlight
                  options={customerOptions}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                  isOptionEqualToValue={(option, val) => option.id === val.id || option.name === val.name}
                  value={customerOptions.find((c) => c.name === (addCreditCustomerName || currentCustomerName)) || null}
                  onChange={(_, val) => setAddCreditCustomerName(val ? val.name : '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search Customer..."
                      sx={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-root': {
                          height: '42px',
                          borderRadius: '6px',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: '#0F172A',
                          '& fieldset': {
                            borderColor: '#CBD5E1',
                          },
                          '&:hover fieldset': {
                            borderColor: '#94A3B8',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#0B4DB7',
                            borderWidth: '1.5px',
                          },
                        },
                      }}
                    />
                  )}
                />
              </Box>

              {/* 3. Credit Amount */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Credit Amount
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  placeholder="e.g. 1000000"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        fontWeight: 600,
                        height: '42px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#CBD5E1',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#94A3B8',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#0B4DB7',
                          borderWidth: '1.5px',
                        },
                      },
                    },
                  }}
                />
              </Box>

              {/* 4. Payment Type */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Payment Type
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={creditPaymentType}
                  onChange={(e) => setCreditPaymentType(e.target.value)}
                  sx={{
                    height: '42px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '6px',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: '#0F172A',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#CBD5E1',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#94A3B8',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#0B4DB7',
                      borderWidth: '1.5px',
                    },
                  }}
                >
                  {['Cash', 'Bank Transfer', 'GPay / PhonePe / UPI', 'Cheque', 'NEFT / RTGS'].map((pt) => (
                    <MenuItem key={pt} value={pt} sx={{ fontSize: '13.5px', fontWeight: 600 }}>
                      {pt}
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              {/* 5. Transferred To + [+ Manage / Add] Button */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Transferred To
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                  <Select
                    fullWidth
                    size="small"
                    value={creditTransferredTo}
                    onChange={(e) => setCreditTransferredTo(e.target.value)}
                    displayEmpty
                    sx={{
                      height: '42px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      color: creditTransferredTo ? '#0F172A' : '#94A3B8',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#CBD5E1',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#94A3B8',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#0B4DB7',
                        borderWidth: '1.5px',
                      },
                    }}
                  >
                    {savedAccounts.length === 0 ? (
                      <MenuItem value="" disabled sx={{ fontSize: '13.5px' }}>
                        <em>No Accounts Saved - Click Manage to Add</em>
                      </MenuItem>
                    ) : (
                      savedAccounts.map((acc) => (
                        <MenuItem key={acc} value={acc} sx={{ fontSize: '13.5px', fontWeight: 600 }}>
                          {acc}
                        </MenuItem>
                      ))
                    )}
                  </Select>

                  <Button
                    variant="contained"
                    disableElevation
                    onClick={() => setManageAccountsModalOpen(true)}
                    startIcon={<AddRoundedIcon sx={{ fontSize: 18 }} />}
                    sx={{
                      backgroundColor: '#0B4DB7',
                      color: '#FFFFFF',
                      height: '42px',
                      px: 2.2,
                      fontSize: '13px',
                      fontWeight: 700,
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                      borderRadius: '6px',
                      flexShrink: 0,
                      boxShadow: 'none',
                      '&:hover': {
                        backgroundColor: '#083B8D',
                      },
                    }}
                  >
                    Manage / Add
                  </Button>
                </Box>
              </Box>

              {/* 6. Notes */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Notes
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Notes / Remarks"
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        fontWeight: 500,
                        height: '42px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#CBD5E1',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#94A3B8',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#0B4DB7',
                          borderWidth: '1.5px',
                        },
                      },
                    },
                  }}
                />
              </Box>

              {/* Action Button */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  pl: { xs: 0, sm: '178px' },
                  mt: 1,
                }}
              >
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleAddCreditSubmit}
                  disabled={creditLoading}
                  sx={{
                    backgroundColor: '#0B4DB7',
                    color: '#FFFFFF',
                    height: '42px',
                    fontSize: '14px',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: '6px',
                    px: 3.5,
                    '&:hover': {
                      backgroundColor: '#083B8D',
                    },
                  }}
                >
                  {creditLoading ? 'Submitting...' : 'Submit'}
                </Button>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Manage / Add Account Names Modal matching Image 9 */}
      <Dialog
        open={manageAccountsModalOpen}
        onClose={() => setManageAccountsModalOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '16px',
              p: 3,
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
          <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
            Manage / Add Account Names
          </Typography>
          <IconButton
            size="small"
            onClick={() => setManageAccountsModalOpen(false)}
            sx={{ color: '#64748B', p: 0.5, mt: -0.5, mr: -0.5 }}
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        <Typography sx={{ fontSize: '13px', color: '#64748B', mb: 2.5 }}>
          Add new person / bank account or delete unwanted names from the dropdown list.
        </Typography>

        {/* Input & Add Button */}
        <Box sx={{ display: 'flex', gap: 1.2, mb: 3 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. S. Nagaraj A/C, Murugan"
            value={newAccountInput}
            onChange={(e) => setNewAccountInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSavedAccount();
              }
            }}
            slotProps={{
              input: {
                sx: {
                  height: '42px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  backgroundColor: '#FFFFFF',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#CBD5E1',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#94A3B8',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#0B4DB7',
                    borderWidth: '1.5px',
                  },
                },
              },
            }}
          />
          <Button
            variant="contained"
            disableElevation
            disabled={!newAccountInput.trim()}
            onClick={handleAddSavedAccount}
            sx={{
              height: '42px',
              px: 2.5,
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 700,
              textTransform: 'none',
              backgroundColor: '#0B4DB7',
              color: '#FFFFFF',
              '&.Mui-disabled': {
                backgroundColor: '#E2E8F0',
                color: '#94A3B8',
              },
              '&:hover': {
                backgroundColor: '#083B8D',
              },
            }}
          >
            Add
          </Button>
        </Box>

        {/* Section Heading */}
        <Typography
          sx={{
            fontSize: '11.5px',
            fontWeight: 800,
            color: '#64748B',
            letterSpacing: '0.04em',
            mb: 1.5,
            textTransform: 'uppercase',
          }}
        >
          Saved Account Names ({savedAccounts.length})
        </Typography>

        {/* Accounts List */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.2,
            maxHeight: '260px',
            overflowY: 'auto',
            pr: 0.5,
            mb: 3,
          }}
        >
          {savedAccounts.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No account names saved yet.
            </Box>
          ) : (
            savedAccounts.map((acc) => (
              <Box
                key={acc}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 2,
                  py: 1.2,
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  transition: 'background-color 0.15s ease',
                  '&:hover': {
                    backgroundColor: '#F8FAFC',
                  },
                }}
              >
                <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: '#1E293B' }}>
                  {acc}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteSavedAccount(acc)}
                  sx={{
                    color: '#EF4444',
                    p: 0.5,
                    borderRadius: '6px',
                    '&:hover': {
                      backgroundColor: '#FEE2E2',
                    },
                  }}
                  title="Delete account"
                >
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            ))
          )}
        </Box>

        {/* Modal Footer Close Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={() => setManageAccountsModalOpen(false)}
            sx={{
              height: '38px',
              px: 3,
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 600,
              textTransform: 'none',
              borderColor: '#CBD5E1',
              color: '#334155',
              '&:hover': {
                backgroundColor: '#F8FAFC',
                borderColor: '#94A3B8',
              },
            }}
          >
            Close
          </Button>
        </Box>
      </Dialog>
      {/* Hidden File Input for PDF Upload (Under 1 MB) */}
      <input
        type="file"
        ref={fileInputRef}
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handlePdfFileChange}
      />

      {/* PDF Document Preview & Management Modal */}
      <Dialog
        open={Boolean(pdfPreviewModal?.open)}
        onClose={() => setPdfPreviewModal(null)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '12px',
              overflow: 'hidden',
              height: '80vh',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0B4DB7',
            color: '#FFFFFF',
            py: 1.5,
            px: 2.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PictureAsPdfRoundedIcon sx={{ fontSize: 22, color: '#FFFFFF' }} />
            <Typography sx={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
              {pdfPreviewModal?.name || 'Attached PDF Document'}
            </Typography>
            {pdfPreviewModal?.billNo && (
              <Chip
                label={`Bill #${pdfPreviewModal.billNo}`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '11px',
                  height: '20px',
                }}
              />
            )}
          </Box>
          <IconButton
            size="small"
            onClick={() => setPdfPreviewModal(null)}
            sx={{ color: '#FFFFFF', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0, flex: 1, backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {pdfPreviewModal?.url ? (
            pdfPreviewModal.url.startsWith('data:image') || pdfPreviewModal.url.match(/\.(jpeg|jpg|png|webp|gif)$/i) || !pdfPreviewModal.url.includes('application/pdf') ? (
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', overflow: 'auto' }}>
                <img
                  src={pdfPreviewModal.url}
                  alt={pdfPreviewModal.name || 'Document'}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    borderRadius: '6px',
                  }}
                />
              </Box>
            ) : (
              <iframe
                src={pdfPreviewModal.url}
                title="PDF Preview"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block',
                }}
              />
            )
          ) : (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748B',
              }}
            >
              <Typography>No document available</Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: 2.5,
            py: 1.5,
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #E2E8F0',
            justifyContent: 'space-between',
          }}
        >
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={() => pdfPreviewModal?.id && handleDeleteAttachedPdf(pdfPreviewModal.id)}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '12.5px',
              borderRadius: '6px',
            }}
          >
            Delete Document
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<UploadFileRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => pdfPreviewModal?.id && handleTriggerPdfUpload(pdfPreviewModal.id)}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '12.5px',
                borderRadius: '6px',
              }}
            >
              Change / Re-upload
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />}
              component="a"
              href={pdfPreviewModal?.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '12.5px',
                borderRadius: '6px',
                color: '#475569',
                borderColor: '#CBD5E1',
              }}
            >
              Open in New Tab
            </Button>

            <Button
              variant="contained"
              disableElevation
              size="small"
              startIcon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
              component="a"
              href={pdfPreviewModal?.url}
              download={pdfPreviewModal?.name || 'bill-receipt'}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                backgroundColor: '#0B4DB7',
                color: '#FFFFFF',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '12.5px',
                borderRadius: '6px',
                '&:hover': { backgroundColor: '#083B8D' },
              }}
            >
              Download
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Bill Print & Preview Modal */}
      <BillPrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        bill={selectedBillForPrint}
        onSaveBillTraderInfo={async (billId, info) => {
          try {
            await ParticularsApi.update(billId, {
              traderAddress: info.traderAddress,
              traderGst: info.traderGst,
              traderPhone: info.traderPhone,
              companyAddress: info.traderAddress,
              companyGst: info.traderGst,
              companyPhone: info.traderPhone,
            });
            setParticularDetails((prev: any[]) =>
              prev.map((item: any) =>
                item._id === billId || item.id === billId
                  ? {
                      ...item,
                      traderAddress: info.traderAddress,
                      traderGst: info.traderGst,
                      traderPhone: info.traderPhone,
                      companyAddress: info.traderAddress,
                      companyGst: info.traderGst,
                      companyPhone: info.traderPhone,
                    }
                  : item
              )
            );
          } catch (err) {
            console.error('Failed to update trader info on bill:', err);
          }
        }}
      />

      {/* Toast Notification for PDF Uploads */}
      <Snackbar
        open={pdfToast.open}
        autoHideDuration={4000}
        onClose={() => setPdfToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setPdfToast((prev) => ({ ...prev, open: false }))}
          severity={pdfToast.severity}
          variant="filled"
          sx={{ width: '100%', borderRadius: '8px', fontWeight: 600, fontSize: '13px' }}
        >
          {pdfToast.message}
        </Alert>
      </Snackbar>

      {/* Account Statement Date Range Print Modal */}
      <DateRangePrintModal
        open={openAccountDateModal}
        onClose={() => setOpenAccountDateModal(false)}
        title={`Print Account Statement - ${accountFilterCustomer && accountFilterCustomer !== 'ALL' ? accountFilterCustomer : 'All Customers'}`}
        subtitle="Select transaction date range to filter ledger entries for A4 print."
        items={sortedAccountDetails}
        getDateFromItem={(a) => a.date || ''}
        onConfirmPrint={(itemsToPrint, rangeText) => {
          printLedgerStatementDirectly(
            accountFilterCustomer && accountFilterCustomer !== 'ALL' ? accountFilterCustomer : 'All Customers',
            itemsToPrint,
            rangeText
          );
        }}
      />

      {/* Particulars Bills Date Range Print Modal */}
      <DateRangePrintModal
        open={openParticularDateModal}
        onClose={() => setOpenParticularDateModal(false)}
        title={`Print Particulars Bills Master Report - ${particularFilterCustomer && particularFilterCustomer !== 'ALL' ? particularFilterCustomer : 'All Customers'}`}
        subtitle="Select bill date range to filter bills for A4 print."
        items={sortedParticularDetails}
        getDateFromItem={(p) => p.date || ''}
        onConfirmPrint={(itemsToPrint, rangeText) => {
          printParticularsListDirectly(itemsToPrint, rangeText);
        }}
      />

      {/* Edit Particular Bill Dialog */}
      <Dialog
        open={openEditParticularModal}
        onClose={() => setOpenEditParticularModal(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '12px',
              p: 1,
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
            borderBottom: '1px solid #EEF2F6',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ModeEditOutlineRoundedIcon sx={{ color: '#0B4DB7', fontSize: 24 }} />
            <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
              Edit Bill #{editBillForm.billNo} {editBillForm.customerName ? `- ${editBillForm.customerName}` : ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpenEditParticularModal(false)} sx={{ color: '#64748B' }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2.5 }}>
          {/* Bill Info Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 2.5 }}>
            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Bill No *
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editBillForm.billNo}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, billNo: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 700, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Customer Name *
              </Typography>
              <Autocomplete
                freeSolo
                options={customerOptions.map((c) => c.name)}
                value={editBillForm.customerName}
                onInputChange={(_e, newVal) => setEditBillForm((prev) => ({ ...prev, customerName: newVal }))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder="Customer Name"
                  />
                )}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Date (DD-MM-YYYY)
              </Typography>
              <DatePickerField
                value={editBillForm.date}
                onChange={(val) => setEditBillForm((prev) => ({ ...prev, date: val }))}
                placeholder="DD-MM-YYYY"
                iconSize={16}
                inputSx={{ fontSize: '13px', fontWeight: 600 }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                No. of Cases
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editBillForm.caseCount}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, caseCount: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Packing (%)
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="e.g. 5"
                value={editBillForm.packing}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                  setEditBillForm((prev) => ({ ...prev, packing: cleaned }));
                }}
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    sx: { fontSize: '13px', fontWeight: 500, borderRadius: '6px' },
                  },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Tax (₹)
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Enter Tax Amount"
                value={editBillForm.tax}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, tax: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>
          </Box>

          {/* Product Items Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, mt: 1 }}>
            <Typography sx={{ fontSize: '14.5px', fontWeight: 800, color: '#0F172A' }}>
              Product Items ({editBillForm.products.length})
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={handleAddEditProductRow}
              startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: '6px',
              }}
            >
              Add Item
            </Button>
          </Box>

          {/* Product Items Table */}
          <TableContainer sx={{ border: '1px solid #E2E8F0', borderRadius: '8px', mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, width: '40px' }}>#</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700 }}>Particular / Item</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, width: '90px' }}>Qty</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, width: '90px' }}>Rate (₹)</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, width: '100px' }}>Unit</TableCell>
                  <TableCell align="right" sx={{ fontSize: '11px', fontWeight: 700, width: '110px' }}>Amount (₹)</TableCell>
                  <TableCell align="center" sx={{ fontSize: '11px', fontWeight: 700, width: '50px' }}>Del</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {editBillForm.products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3, color: '#64748B', fontSize: '12.5px' }}>
                      No items. Click "+ Add Item" above to add products.
                    </TableCell>
                  </TableRow>
                ) : (
                  editBillForm.products.map((prod, idx) => (
                    <TableRow key={prod.id || idx}>
                      <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>{idx + 1}</TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Item Name"
                          value={prod.particular}
                          onChange={(e) => handleUpdateEditProductRow(idx, 'particular', e.target.value)}
                          slotProps={{
                            input: { sx: { fontSize: '12.5px', fontWeight: 600, height: '32px' } },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Qty"
                          value={prod.quantity}
                          onChange={(e) => handleUpdateEditProductRow(idx, 'quantity', e.target.value)}
                          slotProps={{
                            input: { sx: { fontSize: '12.5px', height: '32px' } },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Rate"
                          value={prod.rate}
                          onChange={(e) => handleUpdateEditProductRow(idx, 'rate', e.target.value)}
                          slotProps={{
                            input: { sx: { fontSize: '12.5px', height: '32px' } },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          value={prod.pktUnit || 'nos'}
                          onChange={(e) => handleUpdateEditProductRow(idx, 'pktUnit', e.target.value)}
                          slotProps={{
                            select: {
                              sx: { fontSize: '12px', height: '32px' },
                            },
                          }}
                        >
                          {!(PKT_UNIT_OPTIONS as readonly string[]).includes(prod.pktUnit) && prod.pktUnit && prod.pktUnit !== '-' && (
                            <MenuItem value={prod.pktUnit} sx={{ fontSize: '12px' }}>
                              {prod.pktUnit}
                            </MenuItem>
                          )}
                          {PKT_UNIT_OPTIONS.map((unit) => (
                            <MenuItem key={unit} value={unit} sx={{ fontSize: '12px' }}>
                              {unit}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>
                        ₹{parseFloat(prod.amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteEditProductRow(idx)}
                          sx={{ color: '#DC2626', p: 0.4 }}
                        >
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Live Summary Calculation Banner */}
          <Box
            sx={{
              p: 2,
              borderRadius: '8px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', fontSize: '12.5px' }}>
              <div>
                <span style={{ color: '#64748B' }}>Subtotal: </span>
                <strong style={{ color: '#0F172A' }}>₹ {editSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              {editPackingVal > 0 && (
                <div>
                  <span style={{ color: '#0284C7' }}>Packing ({editBillForm.packing}%): </span>
                  <strong style={{ color: '#0284C7' }}>+ ₹ {editPackingVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              )}
              {editTaxVal > 0 && (
                <div>
                  <span style={{ color: '#64748B' }}>Tax: </span>
                  <strong>+ ₹ {editTaxVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              )}
            </Box>

            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Updated Net Total
              </Typography>
              <Typography sx={{ fontSize: '18px', fontWeight: 900, color: '#0B4DB7' }}>
                ₹ {parseFloat(editFinalTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Typography>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={() => setOpenEditParticularModal(false)} sx={{ color: '#64748B', fontWeight: 600, textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveEditParticular}
            disabled={editBillLoading}
            sx={{
              backgroundColor: '#0B4DB7',
              color: '#FFFFFF',
              fontWeight: 700,
              textTransform: 'none',
              px: 3,
              borderRadius: '6px',
              '&:hover': { backgroundColor: '#083B8D' },
            }}
          >
            {editBillLoading ? 'Saving...' : 'Save Bill Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Hidden File Input for Transport / Godown Receipt Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={handlePdfFileChange}
      />
    </Box>
  );
};

