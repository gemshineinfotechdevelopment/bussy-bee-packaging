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
    return bill.companyName || bill.traderName || 'BUSSY BEE';
  });
  const [traderAddress, setTraderAddress] = React.useState<string>(() => {
    return bill.traderAddress || bill.companyAddress || '';
  });
  const [traderGst, setTraderGst] = React.useState<string>(() => {
    return bill.traderGst || bill.companyGst || '';
  });
  const [traderPhone, setTraderPhone] = React.useState<string>(() => {
    return bill.traderPhone || bill.companyPhone || '';
  });

  React.useEffect(() => {
    setTraderName(bill.companyName || bill.traderName || 'BUSSY BEE');
    setTraderAddress(bill.traderAddress || bill.companyAddress || '');
    setTraderGst(bill.traderGst || bill.companyGst || '');
    setTraderPhone(bill.traderPhone || bill.companyPhone || '');
  }, [
    bill.billNo,
    bill.traderAddress,
    bill.traderGst,
    bill.traderPhone,
    bill.companyAddress,
    bill.companyGst,
    bill.companyPhone,
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
  const handlePhoneChange = (val: string) => {
    setTraderPhone(val);
    onUpdateTraderInfo?.({ traderName, traderAddress, traderGst, traderPhone: val });
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
  let discountLabel = 'Discount Amount';
  if (discNum > 0) {
    const isDiscFlat = rawDiscStr.startsWith('₹') || rawDiscStr.toLowerCase().includes('rs');
    if (rawDiscStr.includes('%') || (!isDiscFlat && discNum <= 100)) {
      discountAmt = (subtotal * discNum) / 100;
      discountLabel = `Discount Amount (${cleanDisc}%)`;
    } else {
      discountAmt = discNum;
      discountLabel = `Discount Amount (₹${discNum.toLocaleString('en-IN')})`;
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
  let taxLabel = 'Tax Amount';
  if (taxNum > 0) {
    taxAmt = taxNum;
    taxLabel = `Tax Amount (₹${taxNum.toLocaleString('en-IN')})`;
  }

  // Grand Total calculation
  const calculatedTotal = Math.max(0, subtotal - discountAmt + packingAmt + taxAmt);
  const rawTotalNum = parseFloat(String(bill.total ?? bill.amount ?? '0').replace(/,/g, '')) || 0;
  const finalTotalNum = rawTotalNum > 0 && Math.abs(rawTotalNum - calculatedTotal) < 0.05 ? rawTotalNum : calculatedTotal;
  const formattedTotal = finalTotalNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    // Prorate taxable value for each HSN group
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
      cgstRate,
      cgstAmount: cgstAmt,
      sgstRate,
      sgstAmount: sgstAmt,
      totalTax: totalGroupTax,
    };
  });

  const totalCgstAmount = taxAmt / 2;
  const totalSgstAmount = taxAmt / 2;
  const totalGstAmount = taxAmt;

  const custAddr = bill.customerAddress && bill.customerAddress.trim() ? bill.customerAddress.trim() : 'Main Road, Sivakasi - 626123';
  const custGst = bill.customerGst && bill.customerGst.trim() ? bill.customerGst.trim() : '-';
  const custPhone = bill.customerMobile || bill.phone || '+91 98765 43210';

  return (
    <div
      className="bussybee-bill-container"
      style={{
        width: '100%',
        maxWidth: '820px',
        margin: '0 auto',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        padding: '24px 30px 20px 30px',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #0F172A', paddingBottom: '10px', marginBottom: '12px' }}>
        <input
          type="text"
          value={traderName}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Company Name"
          title="Company Name"
          style={{
            fontSize: '24px',
            fontWeight: 900,
            color: '#0B4DB7',
            margin: '0 0 4px 0',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            textAlign: 'center',
            border: '1px dashed transparent',
            backgroundColor: 'transparent',
            outline: 'none',
            width: '100%',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <input
            type="text"
            value={traderAddress}
            onChange={(e) => handleAddrChange(e.target.value)}
            placeholder="Name"
            title="Name"
            style={{
              textAlign: 'center',
              fontSize: '11px',
              fontWeight: 600,
              color: '#475569',
              border: '1px dashed #CBD5E1',
              backgroundColor: '#FAFAFA',
              padding: '3px 8px',
              borderRadius: '4px',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={traderGst}
              onChange={(e) => handleGstChange(e.target.value)}
              placeholder="GST No / PAN or Aadhar"
              title="GST No / PAN or Aadhar"
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 700,
                color: '#1E293B',
                border: '1px dashed #CBD5E1',
                backgroundColor: '#FAFAFA',
                padding: '3px 8px',
                borderRadius: '4px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <input
              type="text"
              value={traderPhone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="mobile number"
              title="mobile number"
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 700,
                color: '#1E293B',
                border: '1px dashed #CBD5E1',
                backgroundColor: '#FAFAFA',
                padding: '3px 8px',
                borderRadius: '4px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
        <div style={{ marginTop: '6px' }}>
          <span
            style={{
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 18px',
              borderRadius: '4px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            ESTIMATE
          </span>
        </div>
      </div>

      {/* Bill Meta Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#F8FAFC',
          border: '1px solid #CBD5E1',
          borderRadius: '4px',
          padding: '6px 12px',
          marginBottom: '10px',
          fontSize: '12px',
        }}
      >
        <div>
          <span style={{ color: '#64748B', fontWeight: 600 }}>Bill No: </span>
          <strong style={{ color: '#0B4DB7', fontSize: '13.5px' }}>#{bill.billNo || '-'}</strong>
        </div>
        <div>
          <span style={{ color: '#64748B', fontWeight: 600 }}>Date: </span>
          <strong style={{ color: '#0F172A' }}>{bill.date || '-'}</strong>
        </div>
        <div>
          <span style={{ color: '#64748B', fontWeight: 600 }}>Total Counts: </span>
          <strong style={{ color: '#0B4DB7', fontSize: '13px' }}>{computedCases}</strong>
        </div>
        <div>
          <span style={{ color: '#64748B', fontWeight: 600 }}>Phone: </span>
          <strong style={{ color: '#0F172A' }}>{custPhone}</strong>
        </div>
      </div>

      {/* 2 Boxes: Left (Consignee - Ship to) & Right (Buyer - Bill to) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          marginBottom: '14px',
        }}
      >
        {/* Consignee (Ship to) */}
        <div
          style={{
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            padding: '10px 12px',
            backgroundColor: '#FAFAFA',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: '#0B4DB7',
              borderBottom: '1px solid #E2E8F0',
              paddingBottom: '4px',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Consignee (Ship to)
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '3px' }}>
            {bill.customerName || '-'}
          </div>
          <div style={{ fontSize: '11.5px', color: '#475569', marginBottom: '3px', lineHeight: '1.4' }}>
            {custAddr}
          </div>
          <div style={{ fontSize: '11px', color: '#334155', marginBottom: '2px' }}>
            <strong>GSTIN / UIN:</strong> {custGst}
          </div>
          <div style={{ fontSize: '11px', color: '#334155' }}>
            <strong>State Name:</strong> {bill.customerState || 'Tamil Nadu, Code: 33'}
          </div>
        </div>

        {/* Buyer (Bill to) */}
        <div
          style={{
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            padding: '10px 12px',
            backgroundColor: '#FAFAFA',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: '#0B4DB7',
              borderBottom: '1px solid #E2E8F0',
              paddingBottom: '4px',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Buyer (Bill to)
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '3px' }}>
            {bill.customerName || '-'}
          </div>
          <div style={{ fontSize: '11.5px', color: '#475569', marginBottom: '3px', lineHeight: '1.4' }}>
            {custAddr}
          </div>
          <div style={{ fontSize: '11px', color: '#334155', marginBottom: '2px' }}>
            <strong>GSTIN / UIN:</strong> {custGst}
          </div>
          <div style={{ fontSize: '11px', color: '#334155' }}>
            <strong>State Name:</strong> {bill.customerState || 'Tamil Nadu, Code: 33'}
          </div>
        </div>
      </div>

      {/* Products Table with HSN / SAC column before COUNTS */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #0F172A',
          fontSize: '12px',
          marginBottom: '14px',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
            <th style={{ border: '1px solid #0F172A', padding: '8px 5px', textAlign: 'center', width: '35px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
              #
            </th>
            <th style={{ border: '1px solid #0F172A', padding: '8px 10px', textAlign: 'left', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
              Particular / Product Description
            </th>
            <th style={{ border: '1px solid #0F172A', padding: '8px 6px', textAlign: 'center', width: '90px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
              HSN / SAC
            </th>
            <th style={{ border: '1px solid #0F172A', padding: '8px 6px', textAlign: 'center', width: '75px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
              Counts
            </th>
            <th style={{ border: '1px solid #0F172A', padding: '8px 8px', textAlign: 'right', width: '85px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
              Rate (₹)
            </th>
            <th style={{ border: '1px solid #0F172A', padding: '8px 6px', textAlign: 'center', width: '80px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
              Pkt / Unit
            </th>
            <th style={{ border: '1px solid #0F172A', padding: '8px 10px', textAlign: 'right', width: '105px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
              Amount (₹)
            </th>
          </tr>
        </thead>
        <tbody>
          {(bill.products || []).length === 0 ? (
            <tr>
              <td colSpan={7} style={{ border: '1px solid #CBD5E1', textAlign: 'center', padding: '16px', color: '#64748B' }}>
                No product items in bill
              </td>
            </tr>
          ) : (
            (bill.products || []).map((item, idx) => {
              const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
              const isEven = idx % 2 === 1;
              return (
                <tr key={idx} style={{ backgroundColor: isEven ? '#F8FAFC' : '#FFFFFF' }}>
                  <td style={{ border: '1px solid #CBD5E1', padding: '7px 5px', textAlign: 'center', color: '#475569', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '7px 10px', fontWeight: 700, color: '#0F172A' }}>
                    {item.particular || '-'}
                  </td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '7px 6px', textAlign: 'center', color: '#475569', fontWeight: 600 }}>
                    {item.hsn && item.hsn.trim() !== '' ? item.hsn.trim() : '-'}
                  </td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '7px 6px', textAlign: 'center', fontWeight: 700, color: '#0F172A' }}>{item.quantity || '-'}</td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '7px 8px', textAlign: 'right', color: '#334155' }}>₹ {(parseFloat(String(item.rate)) || 0).toFixed(2)}</td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '7px 6px', textAlign: 'center', color: '#64748B' }}>{item.pktUnit && item.pktUnit !== '-' ? item.pktUnit : '-'}</td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#0F172A' }}>
                    ₹ {numAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Amount Chargeable (in words) + Summary Box */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'stretch',
          gap: '12px',
          marginBottom: '14px',
        }}
      >
        {/* Left: Amount Chargeable (in words) */}
        <div
          style={{
            flex: '1 1 52%',
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            padding: '12px 14px',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '5px' }}>
            Amount Chargeable (in words):
          </div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', lineHeight: '1.4' }}>
            {numberToWords(finalTotalNum)}
          </div>
        </div>

        {/* Right Column: Calculation Summary Table */}
        <div style={{ flex: '1 1 48%' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #0F172A',
              fontSize: '12px',
            }}
          >
            <tbody>
              <tr>
                <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 600, color: '#334155', backgroundColor: '#F8FAFC' }}>
                  Subtotal / Particular Amount
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                  ₹ {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              {discountAmt > 0 && (
                <tr>
                  <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 600, color: '#DC2626', backgroundColor: '#F8FAFC' }}>
                    {discountLabel}
                  </td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>
                    - ₹ {discountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
              {packingAmt > 0 && (
                <tr>
                  <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 600, color: '#334155', backgroundColor: '#F8FAFC' }}>
                    {packingLabel}
                  </td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                    + ₹ {packingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
              {taxAmt > 0 && (
                <tr>
                  <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 600, color: '#334155', backgroundColor: '#F8FAFC' }}>
                    {taxLabel}
                  </td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                    + ₹ {taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
              <tr style={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 900 }}>
                <td style={{ border: '1px solid #0F172A', padding: '7px 8px', fontSize: '12.5px' }}>
                  NET TOTAL AMOUNT
                </td>
                <td style={{ border: '1px solid #0F172A', padding: '7px 8px', textAlign: 'right', fontSize: '13.5px', color: '#FFFFFF' }}>
                  ₹ {formattedTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* GST Breakdown Table */}
      <div style={{ marginBottom: '14px' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #0F172A',
            fontSize: '11px',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', color: '#0F172A' }}>
              <th rowSpan={2} style={{ border: '1px solid #CBD5E1', padding: '6px 4px', width: '85px', textAlign: 'center', fontWeight: 800 }}>
                HSN / SAC
              </th>
              <th rowSpan={2} style={{ border: '1px solid #CBD5E1', padding: '6px 6px', textAlign: 'right', fontWeight: 800 }}>
                Taxable Value (₹)
              </th>
              <th colSpan={2} style={{ border: '1px solid #CBD5E1', padding: '5px 4px', textAlign: 'center', fontWeight: 800 }}>
                Central Tax (CGST)
              </th>
              <th colSpan={2} style={{ border: '1px solid #CBD5E1', padding: '5px 4px', textAlign: 'center', fontWeight: 800 }}>
                State Tax (SGST / UTGST)
              </th>
              <th rowSpan={2} style={{ border: '1px solid #CBD5E1', padding: '6px 6px', textAlign: 'right', fontWeight: 800 }}>
                Total Tax Amount (₹)
              </th>
            </tr>
            <tr style={{ backgroundColor: '#F8FAFC', color: '#0F172A' }}>
              <th style={{ border: '1px solid #CBD5E1', padding: '4px', width: '60px', textAlign: 'center', fontWeight: 700 }}>Rate (%)</th>
              <th style={{ border: '1px solid #CBD5E1', padding: '4px 6px', width: '80px', textAlign: 'right', fontWeight: 700 }}>Amount (₹)</th>
              <th style={{ border: '1px solid #CBD5E1', padding: '4px', width: '60px', textAlign: 'center', fontWeight: 700 }}>Rate (%)</th>
              <th style={{ border: '1px solid #CBD5E1', padding: '4px 6px', width: '80px', textAlign: 'right', fontWeight: 700 }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {gstGroups.map((g, idx) => (
              <tr key={idx} style={{ backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }}>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 4px', textAlign: 'center', fontWeight: 700, color: '#0F172A' }}>
                  {g.hsn}
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 6px', textAlign: 'right', fontWeight: 600 }}>
                  ₹ {g.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 4px', textAlign: 'center', color: '#475569' }}>
                  {g.cgstRate}%
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 6px', textAlign: 'right', fontWeight: 600 }}>
                  ₹ {g.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 4px', textAlign: 'center', color: '#475569' }}>
                  {g.sgstRate}%
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 6px', textAlign: 'right', fontWeight: 600 }}>
                  ₹ {g.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 6px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                  ₹ {g.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#F1F5F9', fontWeight: 800 }}>
              <td style={{ border: '1px solid #CBD5E1', padding: '6px 4px', textAlign: 'center' }}>Total</td>
              <td style={{ border: '1px solid #CBD5E1', padding: '6px 6px', textAlign: 'right', color: '#0F172A' }}>
                ₹ {totalTaxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ border: '1px solid #CBD5E1', padding: '6px 4px' }}></td>
              <td style={{ border: '1px solid #CBD5E1', padding: '6px 6px', textAlign: 'right' }}>
                ₹ {totalCgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ border: '1px solid #CBD5E1', padding: '6px 4px' }}></td>
              <td style={{ border: '1px solid #CBD5E1', padding: '6px 6px', textAlign: 'right' }}>
                ₹ {totalSgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ border: '1px solid #CBD5E1', padding: '6px 6px', textAlign: 'right', color: '#0B4DB7', fontWeight: 900 }}>
                ₹ {totalGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
        {taxAmt > 0 && (
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', fontStyle: 'italic' }}>
            Tax Amount (in words): <strong>{numberToWords(totalGstAmount)}</strong>
          </div>
        )}
      </div>

      {/* Signatures */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px dashed #CBD5E1',
          fontSize: '11.5px',
        }}
      >
        <div style={{ textAlign: 'center', width: '160px' }}>
          <div style={{ height: '24px' }}></div>
          <div style={{ borderTop: '1px solid #0F172A', marginBottom: '4px' }}></div>
          <div style={{ fontWeight: 700, color: '#334155' }}>Customer Signature</div>
        </div>
        <div style={{ textAlign: 'center', width: '180px' }}>
          <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: '22px' }}>For {traderName}</div>
          <div style={{ borderTop: '1px solid #0F172A', marginBottom: '4px' }}></div>
          <div style={{ fontWeight: 700, color: '#334155' }}>Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
};
