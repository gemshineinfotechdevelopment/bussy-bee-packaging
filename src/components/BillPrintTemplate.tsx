import React from 'react';

export interface BillPrintProduct {
  particular: string;
  hsn?: string;
  quantity: string | number;
  rate: string | number;
  pktUnit: string | number;
  amount: string | number;
}

export interface BillPrintData {
  id?: string;
  _id?: string;
  billNo: string;
  date: string;
  customerName: string;
  customerAddress?: string;
  customerState?: string;
  customerPhone?: string;
  customerGst?: string;
  customerMobile?: string;
  traderName?: string;
  traderAddress?: string;
  traderGst?: string;
  traderPhone?: string;
  companyName: string;
  companyAddress?: string;
  companyGst?: string;
  companyPhone?: string;
  preparedBy?: string;
  phone?: string;
  email?: string;
  website?: string;
  transport?: string;
  lrNo?: string;
  caseCount?: string | number;
  products: BillPrintProduct[];
  amount?: string | number;
  discount?: string | number;
  packing?: string | number;
  tax?: string | number;
  total?: string | number;
  pdfData?: string;
  pdfUrl?: string;
  pdfName?: string;
}

interface BillPrintTemplateProps {
  bill: BillPrintData;
  onUpdateTraderInfo?: (info: { traderName: string; traderAddress: string; traderGst: string; traderPhone?: string }) => void;
}

/**
 * Converts a number to Indian Rupees in words
 */
export function formatStateName(state?: string): string {
  if (!state) return 'Tamil Nadu';
  return state
    .replace(/,\s*Code\s*:\s*\d+/gi, '')
    .replace(/Code\s*:\s*\d+/gi, '')
    .trim() || 'Tamil Nadu';
}

export function numberToWords(amount: number): string {
  if (!amount || isNaN(amount) || amount === 0) return 'INR Zero Rupees Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const twoDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n === 0) return '';
    if (n < 10) return singleDigits[n];
    if (n < 20) return twoDigits[n - 10];
    const unit = n % 10;
    return tens[Math.floor(n / 10)] + (unit ? ' ' + singleDigits[unit] : '');
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = '';
    if (hundred) {
      res += singleDigits[hundred] + ' Hundred';
      if (rest) res += ' ';
    }
    if (rest) {
      res += convertTwoDigits(rest);
    }
    return res;
  }

  const rounded = Math.round(amount * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  let crore = Math.floor(rupees / 10000000);
  let rem = rupees % 10000000;
  let lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  let thousand = Math.floor(rem / 1000);
  rem = rem % 1000;
  let hundredPart = rem;

  let words = '';
  if (crore) words += convertTwoDigits(crore) + ' Crore ';
  if (lakh) words += convertTwoDigits(lakh) + ' Lakh ';
  if (thousand) words += convertTwoDigits(thousand) + ' Thousand ';
  if (hundredPart) words += convertThreeDigits(hundredPart) + ' ';

  words = words.trim();
  if (!words) words = 'Zero';

  let result = 'INR ' + words + ' Rupees';
  if (paise > 0) {
    result += ' and ' + convertTwoDigits(paise) + ' Paise';
  }
  result += ' Only';
  return result;
}

export const BillPrintTemplate: React.FC<BillPrintTemplateProps> = ({ bill, onUpdateTraderInfo }) => {
  const [traderName, setTraderName] = React.useState<string>(() => {
    return bill.companyName && bill.companyName !== 'BUSSY BEE'
      ? bill.companyName
      : (bill.traderName && bill.traderName !== 'BUSSY BEE'
        ? bill.traderName
        : (localStorage.getItem('bussy_bee_company_name') || 'Sri Shanmuga Traders'));
  });
  const [traderAddress, setTraderAddress] = React.useState<string>(() => {
    return bill.traderAddress || bill.companyAddress || localStorage.getItem('bussy_bee_company_address') || '352, Amman Kovil Patti Middle Street, Sivakasi - 626123';
  });
  const [traderGst, setTraderGst] = React.useState<string>(() => {
    return bill.traderGst || bill.companyGst || localStorage.getItem('bussy_bee_company_gst') || '33BUMPR9147N1ZQ';
  });
  const [traderState, setTraderState] = React.useState<string>(() => {
    return localStorage.getItem('bussy_bee_company_state') || 'Tamil Nadu';
  });
  const [traderPhone] = React.useState<string>(() => {
    return bill.traderPhone || bill.companyPhone || localStorage.getItem('bussy_bee_company_phone') || '';
  });

  React.useEffect(() => {
    const savedName = localStorage.getItem('bussy_bee_company_name');
    const savedAddr = localStorage.getItem('bussy_bee_company_address');
    const savedGst = localStorage.getItem('bussy_bee_company_gst');
    const savedState = localStorage.getItem('bussy_bee_company_state');

    setTraderName(
      bill.companyName && bill.companyName !== 'BUSSY BEE'
        ? bill.companyName
        : (bill.traderName && bill.traderName !== 'BUSSY BEE'
          ? bill.traderName
          : (savedName || 'Sri Shanmuga Traders'))
    );
    setTraderAddress(bill.traderAddress || bill.companyAddress || savedAddr || '352, Amman Kovil Patti Middle Street, Sivakasi - 626123');
    setTraderGst(bill.traderGst || bill.companyGst || savedGst || '33BUMPR9147N1ZQ');
    setTraderState(savedState || 'Tamil Nadu');
  }, [
    bill.billNo,
    bill.traderAddress,
    bill.traderGst,
    bill.companyAddress,
    bill.companyGst,
    bill.companyName,
    bill.traderName,
  ]);

  const handleNameChange = (val: string) => {
    setTraderName(val);
    onUpdateTraderInfo?.({ traderName: val, traderAddress, traderGst, traderPhone });
  };
  const handleAddrChange = (val: string) => {
    setTraderAddress(val);
    onUpdateTraderInfo?.({ traderName, traderAddress: val, traderGst, traderPhone });
  };
  const handleGstChange = (val: string) => {
    setTraderGst(val);
    onUpdateTraderInfo?.({ traderName, traderAddress, traderGst: val, traderPhone });
  };

  // Calculate Subtotal from Products or bill.amount
  const prodSubtotal = (bill.products || []).reduce((acc, p) => {
    const amt = parseFloat(String(p.amount).replace(/,/g, '')) || 0;
    return acc + amt;
  }, 0);
  const subtotal = prodSubtotal > 0 ? prodSubtotal : (parseFloat(String(bill.amount || bill.total || '0').replace(/,/g, '')) || 0);

  // Discount calculation
  const rawDiscStr = String(bill.discount ?? '').trim();
  const cleanDisc = rawDiscStr.replace(/[^0-9.]/g, '');
  const discNum = parseFloat(cleanDisc) || 0;
  let discountAmt = 0;
  let discountLabel = 'Discount';
  if (discNum > 0) {
    const isDiscFlat = rawDiscStr.startsWith('₹') || rawDiscStr.toLowerCase().includes('rs');
    if (rawDiscStr.includes('%') || (!isDiscFlat && discNum <= 100)) {
      discountAmt = (subtotal * discNum) / 100;
      discountLabel = `Discount (${cleanDisc}%)`;
    } else {
      discountAmt = discNum;
      discountLabel = `Discount (₹${discNum.toLocaleString('en-IN')})`;
    }
  }

  // Packing calculation
  const rawPackStr = String(bill.packing ?? '').trim();
  const cleanPack = rawPackStr.replace(/[^0-9.]/g, '');
  const packNum = parseFloat(cleanPack) || 0;
  let packingAmt = 0;
  let packingLabel = 'Packing Charges';
  if (packNum > 0) {
    const baseAfterDiscount = Math.max(0, subtotal - discountAmt);
    const isPackFlat = rawPackStr.startsWith('₹') || rawPackStr.toLowerCase().includes('rs');
    if (rawPackStr.includes('%') || (!isPackFlat && packNum <= 100)) {
      packingAmt = (baseAfterDiscount * packNum) / 100;
      packingLabel = `Packing Charges (${cleanPack}%)`;
    } else {
      packingAmt = packNum;
      packingLabel = `Packing Charges (₹${packNum.toLocaleString('en-IN')})`;
    }
  }

  // Tax calculation
  const rawTaxStr = String(bill.tax ?? '').trim();
  const cleanTax = rawTaxStr.replace(/[^0-9.]/g, '');
  const taxNum = parseFloat(cleanTax) || 0;
  let taxAmt = 0;
  if (taxNum > 0) {
    taxAmt = taxNum;
  }

  // Grand Total calculation with standard mathematical round-off (.5 & above rounds up (+1), below .5 rounds down)
  const calculatedTotal = Math.max(0, subtotal - discountAmt + packingAmt + taxAmt);
  const roundedTotalNum = Math.round(calculatedTotal);
  const roundOffDiff = roundedTotalNum - calculatedTotal;
  const formattedTotal = roundedTotalNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalQuantity = (bill.products || []).reduce((acc, p) => {
    const q = parseFloat(String(p.quantity).replace(/,/g, '')) || 0;
    return acc + q;
  }, 0);
  const primaryUnit = (bill.products && bill.products.length > 0 && bill.products[0].pktUnit && bill.products[0].pktUnit !== '-')
    ? bill.products[0].pktUnit
    : 'nos';

  const computedCases = bill.caseCount !== undefined && bill.caseCount !== ''
    ? bill.caseCount
    : (bill.products || []).reduce((acc, p) => acc + (parseFloat(String(p.quantity)) || 0), 0);

  // Taxable Value & GST Calculation
  const totalTaxableValue = Math.max(0, subtotal - discountAmt);

  // Group products by HSN/SAC
  const hsnMap: { [key: string]: { hsn: string; amount: number } } = {};
  const products = bill.products && bill.products.length > 0 ? bill.products : [];

  if (products.length > 0) {
    products.forEach((p) => {
      const hsnKey = p.hsn && p.hsn.trim() !== '' ? p.hsn.trim() : '4819';
      const pAmt = parseFloat(String(p.amount).replace(/,/g, '')) || 0;
      if (!hsnMap[hsnKey]) {
        hsnMap[hsnKey] = { hsn: hsnKey, amount: 0 };
      }
      hsnMap[hsnKey].amount += pAmt;
    });
  } else {
    hsnMap['4819'] = { hsn: '4819', amount: subtotal };
  }

  const hsnEntries = Object.values(hsnMap);
  const totalProdSum = hsnEntries.reduce((s, e) => s + e.amount, 0) || 1;

  const gstGroups = hsnEntries.map((entry) => {
    const proportion = entry.amount / totalProdSum;
    const groupTaxable = totalTaxableValue * proportion;
    const groupTax = taxAmt * proportion;
    const cgstAmt = groupTax / 2;
    const sgstAmt = groupTax / 2;
    const totalGroupTax = cgstAmt + sgstAmt;

    const ratePercent = groupTaxable > 0 ? (groupTax / groupTaxable) * 100 : 0;
    const cgstRate = (ratePercent / 2).toFixed(1).replace(/\.0$/, '');
    const sgstRate = (ratePercent / 2).toFixed(1).replace(/\.0$/, '');

    return {
      hsn: entry.hsn,
      taxableValue: groupTaxable,
      cgstRate: cgstRate === '0' && taxAmt > 0 ? '2.5' : cgstRate,
      cgstAmount: cgstAmt,
      sgstRate: sgstRate === '0' && taxAmt > 0 ? '2.5' : sgstRate,
      sgstAmount: sgstAmt,
      totalTax: totalGroupTax,
    };
  });

  const totalCgstAmount = taxAmt / 2;
  const totalSgstAmount = taxAmt / 2;
  const totalGstAmount = taxAmt;

  const effectiveCgstRate = gstGroups[0]?.cgstRate || '2.5';
  const effectiveSgstRate = gstGroups[0]?.sgstRate || '2.5';

  const custAddr = bill.customerAddress && bill.customerAddress.trim() ? bill.customerAddress.trim() : 'SIVAKASI';
  const custGst = bill.customerGst && bill.customerGst.trim() ? bill.customerGst.trim() : '';

  // Formatted bill number for invoice (e.g. 109 or #109)
  const displayBillNo = bill.billNo || '-';

  return (
    <div
      className="bussybee-bill-container"
      style={{
        width: '100%',
        maxWidth: '820px',
        margin: '0 auto',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        fontFamily: 'Arial, Helvetica, sans-serif',
        border: '1.5px solid #000000',
        boxSizing: 'border-box',
        fontSize: '11.5px',
        lineHeight: 1.3,
      }}
    >
      {/* 1. Top Title Bar matching photo */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 10px',
          borderBottom: '1px solid #000000',
        }}
      >
        <div style={{ width: '160px' }}></div>
        <div
          style={{
            fontSize: '15px',
            fontWeight: 'bold',
            textAlign: 'center',
            letterSpacing: '0.04em',
          }}
        >
          Estimate
        </div>
        <div
          style={{
            fontSize: '10px',
            fontStyle: 'italic',
            fontWeight: 'bold',
            color: '#333333',
            width: '160px',
            textAlign: 'right',
          }}
        >
          (ORIGINAL FOR RECIPIENT)
        </div>
      </div>

      {/* 2. Top Header Grid: Left (Company Details + Consignee/Buyer) | Right (Invoice Metadata Grid) */}
      <div style={{ display: 'flex', borderBottom: '1px solid #000000' }}>
        {/* Left Column (50% Width) */}
        <div style={{ width: '50%', borderRight: '1px solid #000000', display: 'flex', flexDirection: 'column' }}>
          {/* Company Info Box */}
          <div style={{ padding: '8px 10px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            {/* Logo Emblem Icon */}
            <div style={{ flexShrink: 0, marginTop: '2px' }}>
              <svg width="40" height="40" viewBox="0 0 100 100" style={{ border: '1.5px solid #000000', borderRadius: '50%' }}>
                <circle cx="50" cy="50" r="46" fill="none" stroke="#000000" strokeWidth="2" />
                <path d="M50 18 L55 35 L73 35 L59 46 L64 63 L50 52 L36 63 L41 46 L27 35 L45 35 Z" fill="#000000" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={traderName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Company Name"
                title="Company Name"
                style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#000000',
                  margin: '0 0 2px 0',
                  border: 'none',
                  backgroundColor: 'transparent',
                  outline: 'none',
                  width: '100%',
                  fontFamily: 'inherit',
                  padding: 0,
                }}
              />
              <input
                type="text"
                value={traderAddress}
                onChange={(e) => handleAddrChange(e.target.value)}
                placeholder="Address"
                title="Address"
                style={{
                  fontSize: '11px',
                  color: '#000000',
                  border: 'none',
                  backgroundColor: 'transparent',
                  outline: 'none',
                  width: '100%',
                  fontFamily: 'inherit',
                  padding: 0,
                  marginBottom: '2px',
                }}
              />
              <div style={{ fontSize: '11px' }}>
                <span style={{ fontWeight: 'bold' }}>GSTIN/UIN: </span>
                <input
                  type="text"
                  value={traderGst}
                  onChange={(e) => handleGstChange(e.target.value)}
                  placeholder="GSTIN"
                  title="GSTIN"
                  style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#000000',
                    border: 'none',
                    backgroundColor: 'transparent',
                    outline: 'none',
                    width: '140px',
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                />
              </div>
              <div style={{ fontSize: '11px' }}>
                <span style={{ fontWeight: 'bold' }}>State Name : </span>
                <span>{formatStateName(traderState)}</span>
              </div>
            </div>
          </div>

          {/* Consignee (Ship to) */}
          <div style={{ borderTop: '1px solid #000000', padding: '6px 10px', minHeight: '68px' }}>
            <div style={{ fontSize: '10.5px', color: '#444444', marginBottom: '2px' }}>Consignee (Ship to)</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {bill.customerName || '-'}
            </div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', lineHeight: 1.25 }}>
              {custAddr}
            </div>
            <div style={{ fontSize: '11px', marginTop: '2px' }}>
              <span style={{ fontWeight: 'bold' }}>State Name</span>
              <span> &nbsp;:&nbsp; {formatStateName(bill.customerState)}</span>
            </div>
            {custGst && custGst !== '-' && (
              <div style={{ fontSize: '11px', marginTop: '1px' }}>
                <span style={{ fontWeight: 'bold' }}>GSTIN/UIN</span>
                <span> &nbsp;:&nbsp; {custGst}</span>
              </div>
            )}
          </div>

          {/* Buyer (Bill to) */}
          <div style={{ borderTop: '1px solid #000000', padding: '6px 10px', minHeight: '68px' }}>
            <div style={{ fontSize: '10.5px', color: '#444444', marginBottom: '2px' }}>Buyer (Bill to)</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {bill.customerName || '-'}
            </div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', lineHeight: 1.25 }}>
              {custAddr}
            </div>
            <div style={{ fontSize: '11px', marginTop: '2px' }}>
              <span style={{ fontWeight: 'bold' }}>State Name</span>
              <span> &nbsp;:&nbsp; {formatStateName(bill.customerState)}</span>
            </div>
            {custGst && custGst !== '-' && (
              <div style={{ fontSize: '11px', marginTop: '1px' }}>
                <span style={{ fontWeight: 'bold' }}>GSTIN/UIN</span>
                <span> &nbsp;:&nbsp; {custGst}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (50% Width): 2-Column Metadata Table */}
        <div style={{ width: '50%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', height: '100%', fontSize: '11px' }}>
            <tbody>
              {/* Row 1 */}
              <tr style={{ height: '33.33%' }}>
                <td style={{ width: '50%', borderBottom: '1px solid #000000', borderRight: '1px solid #000000', padding: '8px 10px', verticalAlign: 'top' }}>
                  <div style={{ fontSize: '10px', color: '#444444' }}>Bill No.</div>
                  <div style={{ fontWeight: 'bold', fontSize: '12px', marginTop: '2px' }}>{displayBillNo}</div>
                </td>
                <td style={{ width: '50%', borderBottom: '1px solid #000000', padding: '8px 10px', verticalAlign: 'top' }}>
                  <div style={{ fontSize: '10px', color: '#444444' }}>Dated</div>
                  <div style={{ fontWeight: 'bold', fontSize: '12px', marginTop: '2px' }}>{bill.date || '-'}</div>
                </td>
              </tr>

              {/* Row 2 */}
              <tr style={{ height: '33.33%' }}>
                <td style={{ borderBottom: '1px solid #000000', borderRight: '1px solid #000000', padding: '8px 10px', verticalAlign: 'top' }}>
                  <div style={{ fontSize: '10px', color: '#444444' }}>Transport</div>
                  <div style={{ fontWeight: 'bold', fontSize: '11.5px', marginTop: '2px' }}>
                    {bill.transport && bill.transport !== '-' ? bill.transport : '-'}
                  </div>
                </td>
                <td style={{ borderBottom: '1px solid #000000', padding: '8px 10px', verticalAlign: 'top' }}>
                  <div style={{ fontSize: '10px', color: '#444444' }}>Destination</div>
                  <div style={{ fontWeight: 'bold', fontSize: '11.5px', marginTop: '2px' }}>
                    {custAddr ? custAddr.split(',')[0].trim() : '-'}
                  </div>
                </td>
              </tr>

              {/* Row 3 */}
              <tr style={{ height: '33.34%' }}>
                <td style={{ borderRight: '1px solid #000000', padding: '8px 10px', verticalAlign: 'top' }}>
                  <div style={{ fontSize: '10px', color: '#444444' }}>LR No.</div>
                  <div style={{ fontWeight: 'bold', fontSize: '11.5px', marginTop: '2px' }}>
                    {bill.lrNo && bill.lrNo !== '-' ? bill.lrNo : '-'}
                  </div>
                </td>
                <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                  <div style={{ fontSize: '10px', color: '#444444' }}>Bundles Qty</div>
                  <div style={{ fontWeight: 'bold', fontSize: '11.5px', marginTop: '2px' }}>
                    {computedCases ? `${computedCases} bundles` : '-'}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Products Table matching Image 2 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000000' }}>
            <th style={{ width: '5%', borderRight: '1px solid #000000', padding: '5px 2px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
              Sl<br />No.
            </th>
            <th style={{ width: '45%', borderRight: '1px solid #000000', padding: '5px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 'bold' }}>
              Description of Goods
            </th>
            <th style={{ width: '12%', borderRight: '1px solid #000000', padding: '5px 4px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
              HSN/SAC
            </th>
            <th style={{ width: '14%', borderRight: '1px solid #000000', padding: '5px 6px', textAlign: 'right', fontSize: '11px', fontWeight: 'bold' }}>
              Quantity
            </th>
            <th style={{ width: '10%', borderRight: '1px solid #000000', padding: '5px 6px', textAlign: 'right', fontSize: '11px', fontWeight: 'bold' }}>
              Rate
            </th>
            <th style={{ width: '5%', borderRight: '1px solid #000000', padding: '5px 4px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
              per
            </th>
            <th style={{ width: '9%', padding: '5px 8px', textAlign: 'right', fontSize: '11px', fontWeight: 'bold' }}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {(bill.products || []).length === 0 ? (
            <tr>
              <td style={{ borderRight: '1px solid #000000', textAlign: 'center', padding: '6px' }}>1</td>
              <td style={{ borderRight: '1px solid #000000', padding: '6px 8px' }}>-</td>
              <td style={{ borderRight: '1px solid #000000', textAlign: 'center', padding: '6px' }}>4819</td>
              <td style={{ borderRight: '1px solid #000000', textAlign: 'right', padding: '6px' }}>0 nos</td>
              <td style={{ borderRight: '1px solid #000000', textAlign: 'right', padding: '6px' }}>0.00</td>
              <td style={{ borderRight: '1px solid #000000', textAlign: 'center', padding: '6px' }}>nos</td>
              <td style={{ textAlign: 'right', padding: '6px 8px' }}>0.00</td>
            </tr>
          ) : (
            (bill.products || []).map((item, idx) => {
              const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
              const unit = item.pktUnit && item.pktUnit !== '-' ? item.pktUnit : 'nos';
              return (
                <tr key={idx}>
                  <td style={{ borderRight: '1px solid #000000', textAlign: 'center', padding: '6px 2px', verticalAlign: 'top' }}>
                    {idx + 1}
                  </td>
                  <td style={{ borderRight: '1px solid #000000', padding: '6px 8px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>
                      {item.particular || '-'}
                    </div>
                    {/* CGST, SGST, ROUND OFF listed beneath the item name as in Image 2 */}
                    {idx === (bill.products.length - 1) && (
                      <div style={{ marginTop: '14px', fontStyle: 'italic', fontSize: '11px', fontWeight: 'bold' }}>
                        {taxAmt > 0 && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '20px' }}>
                              <span>CGST-{effectiveCgstRate}%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '20px', marginTop: '2px' }}>
                              <span>SGST-{effectiveSgstRate}%</span>
                            </div>
                          </>
                        )}
                        {packingAmt > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '20px', marginTop: '2px' }}>
                            <span>{packingLabel}</span>
                          </div>
                        )}
                        {discountAmt > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '20px', marginTop: '2px', color: '#DC2626' }}>
                            <span>{discountLabel}</span>
                          </div>
                        )}
                        {Math.abs(roundOffDiff) > 0.001 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '20px', marginTop: '2px' }}>
                            <span>ROUND OFF</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ borderRight: '1px solid #000000', textAlign: 'center', padding: '6px 4px', verticalAlign: 'top' }}>
                    {item.hsn && item.hsn.trim() !== '' ? item.hsn.trim() : '4819'}
                  </td>
                  <td style={{ borderRight: '1px solid #000000', textAlign: 'right', padding: '6px 6px', verticalAlign: 'top', fontWeight: 'bold' }}>
                    {item.quantity ? `${item.quantity} ${unit}` : '-'}
                  </td>
                  <td style={{ borderRight: '1px solid #000000', textAlign: 'right', padding: '6px 6px', verticalAlign: 'top' }}>
                    <div>{(parseFloat(String(item.rate)) || 0).toFixed(2)}</div>
                    {idx === (bill.products.length - 1) && taxAmt > 0 && (
                      <div style={{ marginTop: '14px', fontSize: '11px' }}>
                        <div>{effectiveCgstRate} %</div>
                        <div style={{ marginTop: '2px' }}>{effectiveSgstRate} %</div>
                      </div>
                    )}
                  </td>
                  <td style={{ borderRight: '1px solid #000000', textAlign: 'center', padding: '6px 4px', verticalAlign: 'top' }}>
                    <div>{unit}</div>
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', verticalAlign: 'top', fontWeight: 'bold' }}>
                    <div>{numAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    {idx === (bill.products.length - 1) && (
                      <div style={{ marginTop: '14px', fontSize: '11px', fontWeight: 'bold' }}>
                        {taxAmt > 0 && (
                          <>
                            <div>{totalCgstAmount.toFixed(2)}</div>
                            <div style={{ marginTop: '2px' }}>{totalSgstAmount.toFixed(2)}</div>
                          </>
                        )}
                        {packingAmt > 0 && (
                          <div style={{ marginTop: '2px' }}>{packingAmt.toFixed(2)}</div>
                        )}
                        {discountAmt > 0 && (
                          <div style={{ marginTop: '2px', color: '#DC2626' }}>-{discountAmt.toFixed(2)}</div>
                        )}
                        {Math.abs(roundOffDiff) > 0.001 && (
                          <div style={{ marginTop: '2px' }}>{roundOffDiff >= 0 ? `+${roundOffDiff.toFixed(2)}` : roundOffDiff.toFixed(2)}</div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        <tfoot>
          {/* Total Row */}
          <tr style={{ borderTop: '1px solid #000000', borderBottom: '1px solid #000000', fontWeight: 'bold' }}>
            <td colSpan={2} style={{ borderRight: '1px solid #000000', padding: '6px 8px', textAlign: 'right' }}>
              Total
            </td>
            <td style={{ borderRight: '1px solid #000000' }}></td>
            <td style={{ borderRight: '1px solid #000000', textAlign: 'right', padding: '6px 6px', fontWeight: 'bold' }}>
              {totalQuantity} {primaryUnit}
            </td>
            <td style={{ borderRight: '1px solid #000000' }}></td>
            <td style={{ borderRight: '1px solid #000000' }}></td>
            <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 'bold', fontSize: '12px' }}>
              ₹ {formattedTotal}
            </td>
          </tr>
          <tr>
            <td colSpan={7} style={{ textAlign: 'right', padding: '2px 8px', fontSize: '10px', fontStyle: 'italic', color: '#444444' }}>
              E. & O.E
            </td>
          </tr>
        </tfoot>
      </table>

      {/* 4. Amount Chargeable (in words) matching photo */}
      <div style={{ borderTop: '1px solid #000000', padding: '6px 10px', borderBottom: '1px solid #000000' }}>
        <div style={{ fontSize: '10px', color: '#444444' }}>Amount Chargeable (in words)</div>
        <div style={{ fontSize: '12.5px', fontWeight: 'bold', marginTop: '2px' }}>
          {numberToWords(roundedTotalNum)}
        </div>
      </div>

      {/* 5. Tax Breakdown Table matching photo */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', borderBottom: '1px solid #000000' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000000' }}>
            <th rowSpan={2} style={{ width: '15%', borderRight: '1px solid #000000', padding: '4px', textAlign: 'center', fontSize: '10.5px' }}>
              HSN/SAC
            </th>
            <th rowSpan={2} style={{ width: '15%', borderRight: '1px solid #000000', padding: '4px 6px', textAlign: 'right', fontSize: '10.5px' }}>
              Taxable<br />Value
            </th>
            <th colSpan={2} style={{ width: '25%', borderRight: '1px solid #000000', padding: '3px', textAlign: 'center', fontSize: '10.5px', borderBottom: '1px solid #000000' }}>
              CGST
            </th>
            <th colSpan={2} style={{ width: '25%', borderRight: '1px solid #000000', padding: '3px', textAlign: 'center', fontSize: '10.5px', borderBottom: '1px solid #000000' }}>
              SGST/UTGST
            </th>
            <th rowSpan={2} style={{ width: '20%', padding: '4px 6px', textAlign: 'right', fontSize: '10.5px' }}>
              Total<br />Tax Amount
            </th>
          </tr>
          <tr style={{ borderBottom: '1px solid #000000' }}>
            <th style={{ width: '10%', borderRight: '1px solid #000000', padding: '3px', textAlign: 'center', fontSize: '10px' }}>Rate</th>
            <th style={{ width: '15%', borderRight: '1px solid #000000', padding: '3px 6px', textAlign: 'right', fontSize: '10px' }}>Amount</th>
            <th style={{ width: '10%', borderRight: '1px solid #000000', padding: '3px', textAlign: 'center', fontSize: '10px' }}>Rate</th>
            <th style={{ width: '15%', borderRight: '1px solid #000000', padding: '3px 6px', textAlign: 'right', fontSize: '10px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {gstGroups.map((g, idx) => (
            <tr key={idx}>
              <td style={{ borderRight: '1px solid #000000', padding: '4px', textAlign: 'center' }}>{g.hsn}</td>
              <td style={{ borderRight: '1px solid #000000', padding: '4px 6px', textAlign: 'right' }}>
                {g.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ borderRight: '1px solid #000000', padding: '4px', textAlign: 'center' }}>{g.cgstRate}%</td>
              <td style={{ borderRight: '1px solid #000000', padding: '4px 6px', textAlign: 'right' }}>
                {g.cgstAmount.toFixed(2)}
              </td>
              <td style={{ borderRight: '1px solid #000000', padding: '4px', textAlign: 'center' }}>{g.sgstRate}%</td>
              <td style={{ borderRight: '1px solid #000000', padding: '4px 6px', textAlign: 'right' }}>
                {g.sgstAmount.toFixed(2)}
              </td>
              <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>
                {g.totalTax.toFixed(2)}
              </td>
            </tr>
          ))}
          {/* Total row of GST table */}
          <tr style={{ borderTop: '1px solid #000000', fontWeight: 'bold' }}>
            <td style={{ borderRight: '1px solid #000000', padding: '4px', textAlign: 'right' }}>Total</td>
            <td style={{ borderRight: '1px solid #000000', padding: '4px 6px', textAlign: 'right' }}>
              {totalTaxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td style={{ borderRight: '1px solid #000000' }}></td>
            <td style={{ borderRight: '1px solid #000000', padding: '4px 6px', textAlign: 'right' }}>
              {totalCgstAmount.toFixed(2)}
            </td>
            <td style={{ borderRight: '1px solid #000000' }}></td>
            <td style={{ borderRight: '1px solid #000000', padding: '4px 6px', textAlign: 'right' }}>
              {totalSgstAmount.toFixed(2)}
            </td>
            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>
              {totalGstAmount.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Tax Amount (in words) matching photo */}
      <div style={{ padding: '4px 10px', fontSize: '11px', borderBottom: '1px solid #000000' }}>
        <span style={{ color: '#444444' }}>Tax Amount (in words) : </span>
        <strong style={{ textTransform: 'capitalize' }}>
          {numberToWords(totalGstAmount).replace(/^INR /, 'INR ')}
        </strong>
      </div>

      {/* 6. Declaration & Signatures (NO BANK DETAILS per user request!) */}
      <div style={{ display: 'flex', minHeight: '90px' }}>
        {/* Left Side: Declaration */}
        <div style={{ width: '55%', borderRight: '1px solid #000000', padding: '8px 10px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '11px', textDecoration: 'underline', marginBottom: '4px' }}>
            Declaration
          </div>
          <div style={{ fontSize: '10.5px', color: '#222222', lineHeight: 1.35 }}>
            We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
          </div>
        </div>

        {/* Right Side: Signature (Bank details omitted as requested) */}
        <div
          style={{
            width: '45%',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            textAlign: 'right',
          }}
        >
          <div style={{ fontWeight: 'bold', fontSize: '11px' }}>
            for {traderName}
          </div>
          <div style={{ height: '40px' }}></div>
          <div style={{ fontWeight: 'bold', fontSize: '11px' }}>
            Authorised Signatory
          </div>
        </div>
      </div>

      {/* 7. Bottom Disclaimer */}
      <div
        style={{
          borderTop: '1px solid #000000',
          textAlign: 'center',
          padding: '3px',
          fontSize: '10px',
          color: '#555555',
        }}
      >
        This is a Computer Generated Invoice
      </div>
    </div>
  );
};
