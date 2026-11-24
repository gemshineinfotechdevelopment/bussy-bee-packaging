import type { BillPrintData } from '../components/BillPrintTemplate';
import { numberToWords } from '../components/BillPrintTemplate';

/**
 * Robust date parser supporting DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, ISO, etc.
 */
export const parseDateToTimestamp = (dateStr: string): number => {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const clean = dateStr.trim();

  // Format: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  // Format: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  const parsed = Date.parse(clean);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Checks whether an item's date falls within [fromDate, toDate]
 */
export const isDateInRange = (dateStr: string, fromDateStr: string, toDateStr: string): boolean => {
  if (!fromDateStr && !toDateStr) return true;
  const itemTime = parseDateToTimestamp(dateStr);
  if (!itemTime) return true;

  if (fromDateStr) {
    const fromTime = parseDateToTimestamp(fromDateStr);
    if (fromTime && itemTime < fromTime) return false;
  }

  if (toDateStr) {
    const toTime = parseDateToTimestamp(toDateStr);
    // Include the full day until 23:59:59
    if (toTime && itemTime > toTime + (24 * 60 * 60 * 1000 - 1)) return false;
  }

  return true;
};

export const generateBillHtml = (bill: BillPrintData): string => {
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
    const isDiscFlat = rawDiscStr.startsWith('â‚¹') || rawDiscStr.toLowerCase().includes('rs');
    if (rawDiscStr.includes('%') || (!isDiscFlat && discNum <= 100)) {
      discountAmt = (subtotal * discNum) / 100;
      discountLabel = `Discount (${cleanDisc}%)`;
    } else {
      discountAmt = discNum;
      discountLabel = `Discount (â‚¹${discNum.toLocaleString('en-IN')})`;
    }
  } else {
    discountLabel = 'Discount Amount';
  }

  const baseAfterDiscount = Math.max(0, subtotal - discountAmt);

  // Packing calculation (Calculated from reduced amount after discount or flat)
  const rawPackStr = String(bill.packing ?? '').trim();
  const cleanPack = rawPackStr.replace(/[^0-9.]/g, '');
  const packNum = parseFloat(cleanPack) || 0;
  let packingAmt = 0;
  let packingLabel = 'Packing Charges';
  if (packNum > 0) {
    const isPackFlat = rawPackStr.startsWith('â‚¹') || rawPackStr.toLowerCase().includes('rs');
    if (rawPackStr.includes('%') || (!isPackFlat && packNum <= 100)) {
      packingAmt = (baseAfterDiscount * packNum) / 100;
      packingLabel = `Packing (${cleanPack}%)`;
    } else {
      packingAmt = packNum;
      packingLabel = `Packing (â‚¹${packNum.toLocaleString('en-IN')})`;
    }
  } else {
    packingLabel = 'Packing Charges';
  }

  // Tax calculation (Manual flat amount)
  const rawTaxStr = String(bill.tax ?? '').trim().replace(/[^0-9.]/g, '');
  const taxNum = parseFloat(rawTaxStr) || 0;
  let taxAmt = 0;
  let taxLabel = 'Tax Amount';
  if (taxNum > 0) {
    taxAmt = taxNum;
    taxLabel = `Tax Amount (â‚¹${taxNum.toLocaleString('en-IN')})`;
  } else {
    taxLabel = 'Tax Amount';
  }

  // Grand Total calculation
  const calculatedTotal = Math.max(0, subtotal - discountAmt + packingAmt + taxAmt);
  const rawTotalNum = parseFloat(String(bill.total ?? bill.amount ?? '0').replace(/,/g, '')) || 0;
  const finalTotalNum = rawTotalNum > 0 && Math.abs(rawTotalNum - calculatedTotal) < 0.05 ? rawTotalNum : calculatedTotal;
  const formattedTotal = finalTotalNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const computedCases = bill.caseCount !== undefined && bill.caseCount !== ''
    ? bill.caseCount
    : (bill.products || []).reduce((acc, p) => acc + (parseFloat(String(p.quantity)) || 0), 0);

  const custAddr = bill.customerAddress && bill.customerAddress.trim() ? bill.customerAddress.trim() : '';
  const custGst = bill.customerGst && bill.customerGst.trim() ? bill.customerGst.trim() : '-';
  const custPhone = bill.customerMobile || bill.customerPhone || bill.phone || '';

  const fromCompanyName = (bill.traderName || bill.companyName || 'BUSSY BEE').trim();
  const fromAddress = (bill.traderAddress || bill.companyAddress || '').trim();
  const fromGst = (bill.traderGst || bill.companyGst || '').trim();
  const fromPhone = (bill.companyPhone || bill.traderPhone || (bill.phone && bill.phone !== custPhone ? bill.phone : '') || '').trim();

  // Taxable Value & GST Calculation
  const totalTaxableValue = Math.max(0, subtotal - discountAmt);

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

  const productRowsHtml = (bill.products || []).map((item, idx) => {
    const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
    const isEven = idx % 2 === 1;
    return `
      <tr style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
        <td style="border: 1px solid #CBD5E1; padding: 7px 5px; text-align: center; color: #475569; font-weight: 600;">${idx + 1}</td>
        <td style="border: 1px solid #CBD5E1; padding: 7px 10px; text-align: left; font-weight: 700; color: #0F172A;">${item.particular || '-'}</td>
        <td style="border: 1px solid #CBD5E1; padding: 7px 6px; text-align: center; color: #475569; font-weight: 600;">${item.hsn && item.hsn.trim() !== '' ? item.hsn.trim() : '-'}</td>
        <td style="border: 1px solid #CBD5E1; padding: 7px 6px; text-align: center; font-weight: 700; color: #0F172A;">${item.quantity || '-'}</td>
        <td style="border: 1px solid #CBD5E1; padding: 7px 8px; text-align: right; color: #334155;">₹ ${(parseFloat(String(item.rate)) || 0).toFixed(2)}</td>
        <td style="border: 1px solid #CBD5E1; padding: 7px 6px; text-align: center; color: #64748B;">${item.pktUnit && item.pktUnit !== '-' ? item.pktUnit : '-'}</td>
        <td style="border: 1px solid #CBD5E1; padding: 7px 10px; text-align: right; font-weight: 800; color: #0F172A;">₹ ${numAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `;
  }).join('');

  const gstRowsHtml = gstGroups.map((g, idx) => `
    <tr style="background-color: ${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'};">
      <td style="border: 1px solid #CBD5E1; padding: 6px 4px; text-align: center; font-weight: 700;">${g.hsn}</td>
      <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; font-weight: 600;">₹ ${g.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="border: 1px solid #CBD5E1; padding: 6px 4px; text-align: center; color: #475569;">${g.cgstRate}%</td>
      <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; font-weight: 600;">₹ ${g.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="border: 1px solid #CBD5E1; padding: 6px 4px; text-align: center; color: #475569;">${g.sgstRate}%</td>
      <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; font-weight: 600;">₹ ${g.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; font-weight: 700;">₹ ${g.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bill #${bill.billNo || 'Invoice'} - Bussy Bee</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #FFFFFF;
      color: #0F172A;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .bill-wrapper {
      width: 100%;
      max-width: 794px;
      margin: 0 auto;
      padding: 6px;
    }
    .top-header {
      text-align: center;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .comp-name {
      font-size: 26px;
      font-weight: 900;
      color: #0B4DB7;
      margin-bottom: 2px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .comp-trader {
      font-size: 13.5px;
      font-weight: 800;
      color: #0F172A;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-bottom: 2px;
    }
    .comp-addr {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 2px;
    }
    .comp-gst {
      font-size: 11px;
      font-weight: 700;
      color: #1E293B;
      margin-bottom: 6px;
    }
    .doc-type-badge {
      display: inline-block;
      background: #0F172A;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 3px 18px;
      border-radius: 4px;
    }
    .meta-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      padding: 6px 12px;
      margin-bottom: 10px;
      font-size: 12px;
    }
    .boxes-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
    }
    .party-box {
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 10px 12px;
      background-color: #FAFAFA;
      font-size: 11.5px;
    }
    .party-title {
      font-size: 11px;
      font-weight: 800;
      color: #0B4DB7;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 4px;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .party-name {
      font-size: 13px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 3px;
    }
    .prod-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #0F172A;
      font-size: 12px;
      margin-bottom: 14px;
    }
    .prod-table th {
      background-color: #0F172A;
      color: #FFFFFF;
      border: 1px solid #0F172A;
      padding: 8px 6px;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .prod-table td {
      border: 1px solid #CBD5E1;
      padding: 7px 6px;
      vertical-align: middle;
    }
    .summary-split {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      gap: 12px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .words-box {
      flex: 1 1 52%;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 12px 14px;
      background-color: #F8FAFC;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .summary-box {
      flex: 1 1 48%;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #0F172A;
      font-size: 12px;
    }
    .summary-table td {
      border: 1px solid #CBD5E1;
      padding: 5px 8px;
    }
    .summary-label-cell {
      font-weight: 600;
      color: #334155;
      background-color: #F8FAFC;
    }
    .summary-val-cell {
      text-align: right;
      font-weight: 700;
      color: #0F172A;
    }
    .summary-total-row td {
      background-color: #0F172A !important;
      color: #FFFFFF !important;
      font-weight: 900;
      font-size: 13.5px;
      padding: 7px 8px;
      border: 1px solid #0F172A !important;
    }
    .summary-total-row .summary-val-cell {
      color: #FFFFFF !important;
    }
    .gst-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #0F172A;
      font-size: 11px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .gst-table th {
      background-color: #F8FAFC;
      color: #0F172A;
      border: 1px solid #CBD5E1;
      padding: 5px 4px;
      font-weight: 800;
    }
    .gst-table td {
      border: 1px solid #CBD5E1;
      padding: 6px 6px;
    }
    .sig-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px dashed #CBD5E1;
      font-size: 11.5px;
      page-break-inside: avoid;
    }
    .sig-block {
      text-align: center;
      width: 170px;
    }
    .sig-line {
      border-top: 1px solid #0F172A;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="bill-wrapper">
    <!-- Header -->
    <div class="top-header">
      <div class="comp-name">${fromCompanyName}</div>
      ${fromAddress ? `<div class="comp-addr">${fromAddress}</div>` : ''}
      ${(fromGst || fromPhone) ? `
        <div class="comp-gst">
          ${fromGst ? `<span>${fromGst.toUpperCase().startsWith('GST') || fromGst.toUpperCase().startsWith('PAN') || fromGst.toUpperCase().startsWith('AADHAR') ? fromGst : `GST / PAN / AADHAR: ${fromGst}`}</span>` : ''}
          ${fromGst && fromPhone ? `<span style="color:#94A3B8; margin: 0 6px;">•</span>` : ''}
          ${fromPhone ? `<span>Phone: ${fromPhone}</span>` : ''}
        </div>
      ` : ''}
      <div><span class="doc-type-badge">ESTIMATE</span></div>
    </div>

    <!-- Meta Bar -->
    <div class="meta-bar">
      <div><span style="color:#64748B; font-weight:600;">Bill No: </span><strong style="color:#0B4DB7; font-size:13.5px;">#${bill.billNo || '-'}</strong></div>
      <div><span style="color:#64748B; font-weight:600;">Date: </span><strong style="color:#0F172A;">${bill.date || '-'}</strong></div>
      <div><span style="color:#64748B; font-weight:600;">Total Counts: </span><strong style="color:#0B4DB7;">${computedCases}</strong></div>
      <div><span style="color:#64748B; font-weight:600;">Phone: </span><strong style="color:#0F172A;">${custPhone}</strong></div>
    </div>

    <!-- 2 Boxes: Consignee & Buyer -->
    <div class="boxes-grid">
      <div class="party-box">
        <div class="party-title">Consignee (Ship to)</div>
        <div class="party-name">${bill.customerName || '-'}</div>
        <div style="color:#475569; margin-bottom:3px; line-height:1.4;">${custAddr}</div>
        <div style="color:#334155; margin-bottom:2px;"><strong>GSTIN / UIN:</strong> ${custGst}</div>
        <div style="color:#334155;"><strong>State Name:</strong> Tamil Nadu, Code: 33</div>
      </div>
      <div class="party-box">
        <div class="party-title">Buyer (Bill to)</div>
        <div class="party-name">${bill.customerName || '-'}</div>
        <div style="color:#475569; margin-bottom:3px; line-height:1.4;">${custAddr}</div>
        <div style="color:#334155; margin-bottom:2px;"><strong>GSTIN / UIN:</strong> ${custGst}</div>
        <div style="color:#334155;"><strong>State Name:</strong> Tamil Nadu, Code: 33</div>
      </div>
    </div>

    <!-- Products Table -->
    <table class="prod-table">
      <thead>
        <tr>
          <th style="width: 35px; text-align: center;">#</th>
          <th style="text-align: left;">Particular / Product Description</th>
          <th style="width: 90px; text-align: center;">HSN / SAC</th>
          <th style="width: 75px; text-align: center;">Counts</th>
          <th style="width: 85px; text-align: right;">Rate (₹)</th>
          <th style="width: 80px; text-align: center;">Pkt / Unit</th>
          <th style="width: 105px; text-align: right;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${productRowsHtml || '<tr><td colspan="7" style="text-align:center; padding:16px; color:#64748B;">No product items attached.</td></tr>'}
      </tbody>
    </table>

    <!-- Amount Chargeable in words + Summary -->
    <div class="summary-split">
      <div class="words-box">
        <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-bottom: 5px;">
          Amount Chargeable (in words):
        </div>
        <div style="font-size: 13px; font-weight: 800; color: #0F172A; line-height: 1.4;">
          ${numberToWords(finalTotalNum)}
        </div>
      </div>

      <div class="summary-box">
        <table class="summary-table">
          <tbody>
            <tr>
              <td class="summary-label-cell">Subtotal / Particular Amount</td>
              <td class="summary-val-cell">₹ ${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            ${
              discountAmt > 0
                ? `<tr>
                     <td class="summary-label-cell" style="color: #DC2626;">${discountLabel}</td>
                     <td class="summary-val-cell" style="color: #DC2626;">- ₹ ${discountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                   </tr>`
                : ''
            }
            ${
              packingAmt > 0
                ? `<tr>
                     <td class="summary-label-cell">${packingLabel}</td>
                     <td class="summary-val-cell">+ ₹ ${packingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                   </tr>`
                : ''
            }
            ${
              taxAmt > 0
                ? `<tr>
                     <td class="summary-label-cell">${taxLabel}</td>
                     <td class="summary-val-cell">+ ₹ ${taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                   </tr>`
                : ''
            }
            <tr class="summary-total-row">
              <td>NET TOTAL AMOUNT</td>
              <td class="summary-val-cell">₹ ${formattedTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- GST Breakdown Table -->
    <table class="gst-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 85px; text-align: center;">HSN / SAC</th>
          <th rowspan="2" style="text-align: right;">Taxable Value (₹)</th>
          <th colspan="2" style="text-align: center;">Central Tax (CGST)</th>
          <th colspan="2" style="text-align: center;">State Tax (SGST / UTGST)</th>
          <th rowspan="2" style="text-align: right;">Total Tax Amount (₹)</th>
        </tr>
        <tr>
          <th style="width: 60px; text-align: center;">Rate (%)</th>
          <th style="width: 80px; text-align: right;">Amount (₹)</th>
          <th style="width: 60px; text-align: center;">Rate (%)</th>
          <th style="width: 80px; text-align: right;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${gstRowsHtml}
      </tbody>
      <tfoot>
        <tr style="background-color: #F1F5F9; font-weight: 800;">
          <td style="text-align: center;">Total</td>
          <td style="text-align: right; color: #0F172A;">₹ ${totalTaxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td></td>
          <td style="text-align: right;">₹ ${totalCgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td></td>
          <td style="text-align: right;">₹ ${totalSgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; color: #0B4DB7; font-weight: 900;">₹ ${totalGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      </tfoot>
    </table>
    ${
      taxAmt > 0
        ? `<div style="font-size: 11px; color: #475569; margin-top: -8px; margin-bottom: 12px; font-style: italic;">
             Tax Amount (in words): <strong>${numberToWords(totalGstAmount)}</strong>
           </div>`
        : ''
    }

    <!-- Signatures -->
    <div class="sig-section">
      <div class="sig-block">
        <div style="height: 24px;"></div>
        <div class="sig-line"></div>
        <div style="font-weight: 700; color:#334155;">Customer Signature</div>
      </div>
      <div class="sig-block">
        <div style="font-weight: 800; color:#0F172A; margin-bottom: 22px;">For ${fromCompanyName || 'BUSSY BEE'}</div>
        <div class="sig-line"></div>
        <div style="font-weight: 700; color:#334155;">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Direct print function that opens an isolated, clean print window
 * Guaranteed to print ONLY the full-page A4 bill document!
 */
export const printBillDirectly = (bill: BillPrintData) => {
  const htmlContent = generateBillHtml(bill);
  triggerBrowserPrint(htmlContent);
};

/**
 * =======================================================================
 * MASTER / BULK LIST PRINT GENERATORS (Standard A4 Format)
 * =======================================================================
 */

export const generateCustomerListPrintHtml = (
  customers: any[],
  reportTitle = 'CUSTOMERS MASTER LEDGER & BALANCES REPORT',
  dateRangeText?: string
): string => {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));

  let overallDebit = 0;
  let overallCredit = 0;
  let overallPendingDue = 0;
  let overallAdvanceHeld = 0;

  customers.forEach((c) => {
    const deb = c.totalDebit || 0;
    const cred = c.totalCredit || 0;
    const due = c.pendingDue || 0;
    const net = c.netBalance || 0;

    overallDebit += deb;
    overallCredit += cred;
    overallPendingDue += due;
    if (net > 0) overallAdvanceHeld += net;
  });

  const pagesHtml = Array.from({ length: totalPages }).map((_, pageIdx) => {
    const startIndex = pageIdx * PAGE_SIZE;
    const pageCustomers = customers.slice(startIndex, startIndex + PAGE_SIZE);
    const isFirstPage = pageIdx === 0;
    const isFinalPage = pageIdx === totalPages - 1;

    let pageDebit = 0;
    let pageCredit = 0;
    let pagePendingDue = 0;
    let pageAdvanceHeld = 0;

    pageCustomers.forEach((c) => {
      const deb = c.totalDebit || 0;
      const cred = c.totalCredit || 0;
      const due = c.pendingDue || 0;
      const net = c.netBalance || 0;

      pageDebit += deb;
      pageCredit += cred;
      pagePendingDue += due;
      if (net > 0) pageAdvanceHeld += net;
    });

    const pageRowsHtml = pageCustomers.map((c, localIdx) => {
      const globalIdx = startIndex + localIdx;
      const idDisplay = c.idCode || `#${(globalIdx + 1).toString().padStart(4, '0')}`;
      const deb = (c.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const cred = (c.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const isEven = localIdx % 2 === 1;

      let balanceHtml = '';
      if ((c.pendingDue || 0) > 0) {
        balanceHtml = `<span style="color:#DC2626; font-weight:800;">â‚¹ ${(c.pendingDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Due)</span>`;
      } else if ((c.netBalance || 0) > 0) {
        balanceHtml = `<span style="color:#0284C7; font-weight:800;">+â‚¹ ${(c.netBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Adv)</span>`;
      } else {
        balanceHtml = `<span style="color:#16A34A; font-weight:700;">â‚¹ 0.00 (Settled)</span>`;
      }

      return `
        <tr class="data-row" style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
          <td class="text-center" style="width: 30px;">${globalIdx + 1}</td>
          <td class="text-center" style="width: 55px; font-weight:700; color:#475569;">${idDisplay}</td>
          <td style="font-weight:800; color:#0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${c.name}</td>
          <td style="color:#475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 195px;">${c.address || '-'}</td>
          <td class="text-right" style="font-weight:700; color:#1E293B; width: 90px;">â‚¹ ${deb}</td>
          <td class="text-right" style="font-weight:700; color:#16A34A; width: 90px;">â‚¹ ${cred}</td>
          <td class="text-right" style="width: 105px;">${balanceHtml}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="print-page ${isFinalPage ? 'final-page' : ''}">
        ${
          isFirstPage
            ? `
        <!-- Full Header Banner (Page 1) -->
        <div class="company-banner">
          <div>
            <div class="comp-name">BUSSY BEE</div>
            <div class="comp-sub">Wholesale & Retail Trading â€¢ Sivakasi</div>
            <div class="report-heading">${reportTitle}</div>
            ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
          </div>
          <div class="meta-box">
            <div>Generated: <span class="meta-bold">${currentDate} ${currentTime}</span></div>
            <div>Total Records: <span class="meta-bold">${customers.length} Customers</span></div>
            <div>Page: <span class="meta-bold">1 of ${totalPages}</span></div>
          </div>
        </div>

        <!-- Summary Metrics (Page 1) -->
        <div class="kpi-summary-grid">
          <div class="kpi-card">
            <div class="kpi-title">Total Customers</div>
            <div class="kpi-val">${customers.length}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Debit (Purchases)</div>
            <div class="kpi-val">â‚¹ ${overallDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Credit (Paid)</div>
            <div class="kpi-val" style="color:#16A34A;">â‚¹ ${overallCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card" style="background-color:#FEF2F2; border-color:#FECACA;">
            <div class="kpi-title" style="color:#991B1B;">Total Pending Due</div>
            <div class="kpi-val" style="color:#DC2626;">â‚¹ ${overallPendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card" style="background-color:#F0F9FF; border-color:#BAE6FD;">
            <div class="kpi-title" style="color:#0369A1;">Total Advance Balances</div>
            <div class="kpi-val" style="color:#0284C7;">â‚¹ ${overallAdvanceHeld.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>`
            : `
        <!-- Compact Header (Subsequent Pages) -->
        <div class="subsequent-header">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0F172A; padding-bottom: 4px; margin-bottom: 6px;">
            <div>
              <span style="font-size: 15px; font-weight: 900; color: #0B4DB7;">BUSSY BEE</span>
              <span style="font-size: 10.5px; font-weight: 700; color: #475569; margin-left: 8px;">â€¢ ${reportTitle}</span>
              ${dateRangeText ? `<span class="date-badge" style="margin-left: 8px; font-size: 9px; padding: 1px 6px;">${dateRangeText}</span>` : ''}
            </div>
            <div style="font-size: 10px; color: #334155; font-weight: 700;">
              <span>Date: ${currentDate}</span> | <span>Records: ${startIndex + 1} - ${startIndex + pageCustomers.length}</span> | <span>Page ${pageIdx + 1} of ${totalPages}</span>
            </div>
          </div>
        </div>`
        }

        <!-- Master Customer Table -->
        <table class="data-table">
          <thead>
            <tr>
              <th class="text-center" style="width: 30px;">#</th>
              <th class="text-center" style="width: 55px;">ID</th>
              <th style="width: 180px;">Customer Name</th>
              <th style="width: 195px;">Address</th>
              <th class="text-right" style="width: 90px;">Debit (Dr)</th>
              <th class="text-right" style="width: 90px;">Credit (Cr)</th>
              <th class="text-right" style="width: 105px;">Net Balance / Status</th>
            </tr>
          </thead>
          <tbody>
            ${pageRowsHtml || '<tr><td colspan="7" class="text-center" style="padding: 20px;">No customer records found for the selected range.</td></tr>'}
          </tbody>
          <tfoot>
            <!-- Page Total Row (Printed at bottom of EVERY page) -->
            <tr class="page-total-row">
              <td colspan="4" class="text-right" style="padding-right: 8px;">
                PAGE ${pageIdx + 1} TOTAL (${pageCustomers.length} Records):
              </td>
              <td class="text-right">â‚¹ ${pageDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">â‚¹ ${pageCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">
                ${
                  pagePendingDue > 0
                    ? `Due: â‚¹ ${pagePendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : pageAdvanceHeld > 0
                    ? `+â‚¹ ${pageAdvanceHeld.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Adv)`
                    : `Settled`
                }
              </td>
            </tr>

            <!-- Final Page Only: OVERALL GRAND TOTALS -->
            ${
              isFinalPage
                ? `
            <tr class="grand-total-row">
              <td colspan="4" class="text-right" style="padding-right: 8px;">
                OVERALL GRAND TOTALS (${customers.length} Customers):
              </td>
              <td class="text-right">â‚¹ ${overallDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">â‚¹ ${overallCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">
                ${
                  overallPendingDue > 0
                    ? `Due: â‚¹ ${overallPendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : overallAdvanceHeld > 0
                    ? `+â‚¹ ${overallAdvanceHeld.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Adv)`
                    : `Settled`
                }
              </td>
            </tr>`
                : ''
            }
          </tfoot>
        </table>

        ${
          isFinalPage
            ? `
        <!-- Signature Section (Final Page Only) -->
        <div class="signature-section">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Prepared By</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Checked & Verified By</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Authorized Signatory</div>
          </div>
        </div>`
            : ''
        }
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${reportTitle} - ${currentDate}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm 8mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-page {
      width: 100%;
      box-sizing: border-box;
      page-break-after: always;
      break-after: page;
      padding: 0;
    }
    .print-page:last-child,
    .print-page.final-page {
      page-break-after: auto;
      break-after: auto;
    }
    @media screen {
      .print-page {
        margin-bottom: 25px;
        padding-bottom: 25px;
        border-bottom: 2px dashed #94A3B8;
      }
      .print-page:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }
    }
    @media print {
      .print-page {
        margin: 0;
        border: none;
        padding: 0;
        page-break-after: always;
        break-after: page;
      }
      .print-page:last-child,
      .print-page.final-page {
        page-break-after: auto;
        break-after: auto;
      }
    }
    .company-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 4px;
      margin-bottom: 5px;
    }
    .comp-name {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.01em;
      color: #0B4DB7;
      line-height: 1.1;
    }
    .comp-sub {
      font-size: 9px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .report-heading {
      font-size: 12px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 2px;
    }
    .date-badge {
      display: inline-block;
      background-color: #EFF6FF;
      color: #0B4DB7;
      border: 1px solid #BFDBFE;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 700;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 9.5px;
      color: #334155;
      line-height: 1.35;
    }
    .meta-bold {
      font-weight: 700;
      color: #000000;
    }
    .kpi-summary-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 5px;
      margin-bottom: 6px;
    }
    .kpi-card {
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      padding: 3px 6px;
      background-color: #F8FAFC;
    }
    .kpi-title {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .kpi-val {
      font-size: 11px;
      font-weight: 900;
      color: #0F172A;
      margin-top: 1px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      border: 1.5px solid #0F172A;
      table-layout: fixed;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-row-group;
    }
    tr {
      page-break-inside: avoid;
    }
    .data-table th {
      background-color: #0F172A;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 10px;
      padding: 5px 4px;
      border: 1px solid #0F172A;
      text-align: left;
      letter-spacing: 0.02em;
    }
    .data-table td {
      padding: 0 4px;
      border: 1px solid #CBD5E1;
      vertical-align: middle;
    }
    .data-row {
      height: 33px;
    }
    .text-center {
      text-align: center !important;
    }
    .text-right {
      text-align: right !important;
    }
    .page-total-row td {
      background-color: #F1F5F9 !important;
      color: #0F172A !important;
      border: 1px solid #CBD5E1 !important;
      font-size: 10px;
      font-weight: 800;
      padding: 4px 4px;
      height: 25px;
    }
    .grand-total-row td {
      background-color: #0F172A !important;
      color: #FFFFFF !important;
      border: 1px solid #0F172A !important;
      font-size: 10.5px;
      font-weight: 900;
      padding: 4px 4px;
      height: 26px;
    }
    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 12px;
      padding: 0 15px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      width: 160px;
    }
    .sig-line {
      border-top: 1px solid #000000;
      margin-bottom: 3px;
    }
    .sig-label {
      font-size: 9px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
  `;
};

export const printCustomerListDirectly = (customers: any[], reportTitle?: string, dateRangeText?: string) => {
  const htmlContent = generateCustomerListPrintHtml(customers, reportTitle, dateRangeText);
  triggerBrowserPrint(htmlContent);
};

/**
 * Print Customer Account Statement / Ledger History (A4 Standard)
 */
export const generateLedgerStatementHtml = (
  customerName: string,
  ledgerEntries: any[],
  dateRangeText?: string
): string => {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const PAGE_SIZE = 30;
  const sortedEntries = [...ledgerEntries].sort((a, b) => {
    const timeA = parseDateToTimestamp(a.date) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const timeB = parseDateToTimestamp(b.date) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    if (timeB !== timeA) return timeB - timeA;
    const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return cB - cA;
  });
  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / PAGE_SIZE));

  let totalDeb = 0;
  let totalCred = 0;

  sortedEntries.forEach((entry) => {
    const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
    const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;
    totalDeb += deb;
    totalCred += cred;
  });

  const netBalance = totalDeb - totalCred;

  const pagesHtml = Array.from({ length: totalPages }).map((_, pageIdx) => {
    const startIndex = pageIdx * PAGE_SIZE;
    const pageEntries = sortedEntries.slice(startIndex, startIndex + PAGE_SIZE);
    const isFirstPage = pageIdx === 0;
    const isFinalPage = pageIdx === totalPages - 1;

    let pageDeb = 0;
    let pageCred = 0;

    pageEntries.forEach((entry) => {
      const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
      const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;
      pageDeb += deb;
      pageCred += cred;
    });

    const pageNet = pageDeb - pageCred;

    const pageRowsHtml = pageEntries.map((entry, localIdx) => {
      const globalIdx = startIndex + localIdx;
      const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
      const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;
      const isEven = localIdx % 2 === 1;

      const desc = entry.billNo ? `Bill #${entry.billNo}` : entry.type || 'PAYMENT / RECEIPT';

      return `
        <tr class="data-row" style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
          <td class="text-center" style="width:30px;">${globalIdx + 1}</td>
          <td class="text-center" style="width:75px; color:#334155;">${entry.date || '-'}</td>
          <td style="font-weight:700; color:#0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${desc}</td>
          <td style="color:#475569; font-size:9.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 155px;">${entry.companyName || '-'}</td>
          <td class="text-right" style="width:105px; color:#1E293B; font-weight:700;">${deb > 0 ? `â‚¹ ${deb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
          <td class="text-right" style="width:105px; color:#16A34A; font-weight:700;">${cred > 0 ? `â‚¹ ${cred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
          <td class="text-right" style="width:110px; font-weight:800; color:#0B4DB7;">â‚¹ ${entry.balance || '0.00'}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="print-page ${isFinalPage ? 'final-page' : ''}">
        ${
          isFirstPage
            ? `
        <!-- Full Header Banner (Page 1) -->
        <div class="company-banner">
          <div>
            <div class="comp-name">BUSSY BEE</div>
            <div class="comp-sub">Wholesale & Retail Trading â€¢ Sivakasi</div>
            <div class="report-heading">ACCOUNT STATEMENT: ${customerName.toUpperCase()}</div>
            ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
          </div>
          <div class="meta-box">
            <div>Generated: <span class="meta-bold">${currentDate} ${currentTime}</span></div>
            <div>Total Transactions: <span class="meta-bold">${ledgerEntries.length} Records</span></div>
            <div>Page: <span class="meta-bold">1 of ${totalPages}</span></div>
          </div>
        </div>

        <!-- Summary Metrics (Page 1) -->
        <div class="kpi-summary-grid">
          <div class="kpi-card">
            <div class="kpi-title">Total Purchases / Debit (Dr)</div>
            <div class="kpi-val" style="color:#0F172A;">â‚¹ ${totalDeb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Received / Credit (Cr)</div>
            <div class="kpi-val" style="color:#16A34A;">â‚¹ ${totalCred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card" style="background-color:${netBalance > 0 ? '#FEF2F2' : '#F0FDF4'}; border-color:${netBalance > 0 ? '#FECACA' : '#BBF7D0'};">
            <div class="kpi-title" style="color:${netBalance > 0 ? '#991B1B' : '#166534'};">Net Balance Status</div>
            <div class="kpi-val" style="color:${netBalance > 0 ? '#DC2626' : '#16A34A'};">
              â‚¹ ${Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${netBalance > 0 ? '(Due Pending)' : netBalance < 0 ? '(Advance Held)' : '(Settled)'}
            </div>
          </div>
        </div>`
            : `
        <!-- Compact Header (Subsequent Pages) -->
        <div class="subsequent-header">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0F172A; padding-bottom: 4px; margin-bottom: 5px;">
            <div>
              <span style="font-size: 15px; font-weight: 900; color: #0B4DB7;">BUSSY BEE</span>
              <span style="font-size: 10.5px; font-weight: 700; color: #475569; margin-left: 8px;">â€¢ ACCOUNT STATEMENT: ${customerName.toUpperCase()}</span>
              ${dateRangeText ? `<span class="date-badge" style="margin-left: 8px; font-size: 9px; padding: 1px 6px;">${dateRangeText}</span>` : ''}
            </div>
            <div style="font-size: 9.5px; color: #334155; font-weight: 700;">
              <span>Date: ${currentDate}</span> | <span>Records: ${startIndex + 1} - ${startIndex + pageEntries.length}</span> | <span>Page ${pageIdx + 1} of ${totalPages}</span>
            </div>
          </div>
        </div>`
        }

        <!-- Master Account Table -->
        <table class="data-table">
          <thead>
            <tr>
              <th class="text-center" style="width:30px;">#</th>
              <th class="text-center" style="width:75px;">Date</th>
              <th style="width:150px;">Particulars / Description</th>
              <th style="width:155px;">Company Name</th>
              <th class="text-right" style="width:105px;">Debit (Dr)</th>
              <th class="text-right" style="width:105px;">Credit (Cr)</th>
              <th class="text-right" style="width:110px;">Balance (â‚¹)</th>
            </tr>
          </thead>
          <tbody>
            ${pageRowsHtml || '<tr><td colspan="7" class="text-center" style="padding:18px; color:#64748B;">No transaction entries found for the selected period.</td></tr>'}
          </tbody>
          <tfoot>
            <!-- Page Total Row (Bottom of EVERY page) -->
            <tr class="page-total-row">
              <td colspan="4" class="text-right" style="padding-right:8px;">PAGE ${pageIdx + 1} TOTAL (${pageEntries.length} Records):</td>
              <td class="text-right">â‚¹ ${pageDeb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">â‚¹ ${pageCred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">
                â‚¹ ${Math.abs(pageNet).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${pageNet > 0 ? 'Dr' : pageNet < 0 ? 'Cr' : ''}
              </td>
            </tr>

            <!-- Final Page Only: OVERALL GRAND TOTAL -->
            ${
              isFinalPage
                ? `
            <tr class="grand-total-row">
              <td colspan="4" class="text-right" style="padding-right:8px;">OVERALL GRAND TOTALS (${ledgerEntries.length} Records):</td>
              <td class="text-right">â‚¹ ${totalDeb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">â‚¹ ${totalCred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">
                â‚¹ ${Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${netBalance > 0 ? 'Dr' : netBalance < 0 ? 'Cr' : ''}
              </td>
            </tr>`
                : ''
            }
          </tfoot>
        </table>

        ${
          isFinalPage
            ? `
        <!-- Signature Section (Final Page Only) -->
        <div class="signature-section">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Customer Verification</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Checked & Verified By</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Authorized Signatory</div>
          </div>
        </div>`
            : ''
        }
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Account Statement - ${customerName} - ${currentDate}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm 8mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-page {
      width: 100%;
      box-sizing: border-box;
      page-break-after: always;
      break-after: page;
      padding: 0;
    }
    .print-page:last-child,
    .print-page.final-page {
      page-break-after: auto;
      break-after: auto;
    }
    @media screen {
      .print-page {
        margin-bottom: 25px;
        padding-bottom: 25px;
        border-bottom: 2px dashed #94A3B8;
      }
      .print-page:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }
    }
    @media print {
      .print-page {
        margin: 0;
        border: none;
        padding: 0;
        page-break-after: always;
        break-after: page;
      }
      .print-page:last-child,
      .print-page.final-page {
        page-break-after: auto;
        break-after: auto;
      }
    }
    .company-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .comp-name {
      font-size: 19px;
      font-weight: 900;
      letter-spacing: -0.01em;
      color: #0B4DB7;
      line-height: 1.1;
    }
    .comp-sub {
      font-size: 9px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .report-heading {
      font-size: 12px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 2px;
    }
    .date-badge {
      display: inline-block;
      background-color: #EFF6FF;
      color: #0B4DB7;
      border: 1px solid #BFDBFE;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 700;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 9.5px;
      color: #334155;
      line-height: 1.35;
    }
    .meta-bold {
      font-weight: 700;
      color: #000000;
    }
    .kpi-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 5px;
    }
    .kpi-card {
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      padding: 3px 6px;
      background-color: #F8FAFC;
    }
    .kpi-title {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .kpi-val {
      font-size: 11.5px;
      font-weight: 900;
      color: #0F172A;
      margin-top: 1px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      border: 1.5px solid #0F172A;
      table-layout: fixed;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-row-group;
    }
    tr {
      page-break-inside: avoid;
    }
    .data-table th {
      background-color: #0F172A;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 9.5px;
      padding: 4px 4px;
      border: 1px solid #0F172A;
      text-align: left;
      letter-spacing: 0.02em;
    }
    .data-table td {
      padding: 0 4px;
      border: 1px solid #CBD5E1;
      vertical-align: middle;
    }
    .data-row {
      height: 28px;
    }
    .text-center {
      text-align: center !important;
    }
    .text-right {
      text-align: right !important;
    }
    .page-total-row td {
      background-color: #F1F5F9 !important;
      color: #0F172A !important;
      border: 1px solid #CBD5E1 !important;
      font-size: 9.5px;
      font-weight: 800;
      padding: 3px 4px;
      height: 23px;
    }
    .grand-total-row td {
      background-color: #0F172A !important;
      color: #FFFFFF !important;
      border: 1px solid #0F172A !important;
      font-size: 10.5px;
      font-weight: 900;
      padding: 4px 4px;
      height: 25px;
    }
    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      padding: 0 15px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      width: 160px;
    }
    .sig-line {
      border-top: 1px solid #000000;
      margin-bottom: 3px;
    }
    .sig-label {
      font-size: 9px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
  `;
};

export const printLedgerStatementDirectly = (customerName: string, ledgerEntries: any[], dateRangeText?: string) => {
  const htmlContent = generateLedgerStatementHtml(customerName, ledgerEntries, dateRangeText);
  triggerBrowserPrint(htmlContent);
};

/**
 * Print Particulars Bills Master List (A4 Standard)
 */
export const generateParticularsListPrintHtml = (particulars: any[], dateRangeText?: string): string => {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const PAGE_SIZE = 30;
  const sortedParticulars = [...particulars].sort((a, b) => {
    const timeA = parseDateToTimestamp(a.date) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const timeB = parseDateToTimestamp(b.date) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    if (timeB !== timeA) return timeB - timeA;
    const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return cB - cA;
  });
  const totalPages = Math.max(1, Math.ceil(sortedParticulars.length / PAGE_SIZE));

  let overallTotalSum = 0;
  let overallSubtotalSum = 0;
  let overallCasesSum = 0;

  sortedParticulars.forEach((p) => {
    const amt = parseFloat(String(p.total || p.amount || '0').replace(/,/g, '')) || 0;
    const subAmt = parseFloat(String(p.amount || p.total || '0').replace(/,/g, '')) || amt;
    const cases = parseFloat(String(p.caseCount || '0')) || 0;
    overallTotalSum += amt;
    overallSubtotalSum += subAmt;
    overallCasesSum += cases;
  });

  const pagesHtml = Array.from({ length: totalPages }).map((_, pageIdx) => {
    const startIndex = pageIdx * PAGE_SIZE;
    const pageItems = sortedParticulars.slice(startIndex, startIndex + PAGE_SIZE);
    const isFirstPage = pageIdx === 0;
    const isFinalPage = pageIdx === totalPages - 1;

    let pageTotalSum = 0;
    let pageSubtotalSum = 0;
    let pageCasesSum = 0;

    pageItems.forEach((p) => {
      const amt = parseFloat(String(p.total || p.amount || '0').replace(/,/g, '')) || 0;
      const subAmt = parseFloat(String(p.amount || p.total || '0').replace(/,/g, '')) || amt;
      const cases = parseFloat(String(p.caseCount || '0')) || 0;
      pageTotalSum += amt;
      pageSubtotalSum += subAmt;
      pageCasesSum += cases;
    });

    const pageRowsHtml = pageItems.map((p, localIdx) => {
      const globalIdx = startIndex + localIdx;
      const isEven = localIdx % 2 === 1;
      const amt = parseFloat(String(p.total || p.amount || '0').replace(/,/g, '')) || 0;
      const subAmt = parseFloat(String(p.amount || p.total || '0').replace(/,/g, '')) || amt;

      const discStr = p.discount && String(p.discount).trim() !== '' && p.discount !== '0' && p.discount !== '-' ? String(p.discount) : '-';
      const taxStr = p.tax && String(p.tax).trim() !== '' && p.tax !== '0' && p.tax !== '-' ? `₹${p.tax}` : '-';

      const prodNames = (p.products || []).map((x: any) => x.particular).filter(Boolean);
      const prodDisplay = prodNames.length > 0 ? prodNames.join(', ') : (p.companyName || '-');

      return `
        <tr class="data-row" style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
          <td class="text-center" style="width:26px;">${globalIdx + 1}</td>
          <td class="text-center" style="font-weight:800; color:#0B4DB7; width:52px;">#${p.billNo || '-'}</td>
          <td class="text-center" style="width:65px; color:#334155;">${p.date || '-'}</td>
          <td style="font-weight:700; color:#0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${p.customerName || '-'}</td>
          <td style="color:#475569; font-size:9.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${prodDisplay}</td>
          <td class="text-center" style="width:38px; font-weight:700;">${p.caseCount || '-'}</td>
          <td class="text-right" style="width:72px; color:#334155;">₹ ${subAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="text-center" style="width:42px; color:${discStr !== '-' ? '#DC2626' : '#94A3B8'}; font-weight:600;">${discStr}</td>
          <td class="text-center" style="width:42px; color:${taxStr !== '-' ? '#0F172A' : '#94A3B8'}; font-weight:600;">${taxStr}</td>
          <td class="text-right" style="font-weight:800; width:82px; color:#0F172A;">₹ ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="print-page ${isFinalPage ? 'final-page' : ''}">
        ${
          isFirstPage
            ? `
        <!-- Full Header Banner (Page 1) -->
        <div class="company-banner">
          <div>
            <div class="comp-name">BUSSY BEE</div>
            <div class="comp-sub">Wholesale & Retail Trading â€¢ Sivakasi</div>
            <div class="report-heading">PARTICULARS BILLS MASTER REPORT</div>
            ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
          </div>
          <div class="meta-box">
            <div>Generated: <span class="meta-bold">${currentDate} ${currentTime}</span></div>
            <div>Total Records: <span class="meta-bold">${particulars.length} Bills</span></div>
            <div>Page: <span class="meta-bold">1 of ${totalPages}</span></div>
          </div>
        </div>

        <!-- Summary Metrics (Page 1) -->
        <div class="kpi-summary-grid">
          <div class="kpi-card">
            <div class="kpi-title">Total Bills Count</div>
            <div class="kpi-val">${particulars.length}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Cases Billed</div>
            <div class="kpi-val" style="color:#0B4DB7;">${overallCasesSum}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Billed Amount</div>
            <div class="kpi-val" style="color:#16A34A;">â‚¹ ${overallTotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>`
            : `
        <!-- Compact Header (Subsequent Pages) -->
        <div class="subsequent-header">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0F172A; padding-bottom: 4px; margin-bottom: 5px;">
            <div>
              <span style="font-size: 15px; font-weight: 900; color: #0B4DB7;">BUSSY BEE</span>
              <span style="font-size: 10.5px; font-weight: 700; color: #475569; margin-left: 8px;">â€¢ PARTICULARS BILLS MASTER REPORT</span>
              ${dateRangeText ? `<span class="date-badge" style="margin-left: 8px; font-size: 9px; padding: 1px 6px;">${dateRangeText}</span>` : ''}
            </div>
            <div style="font-size: 9.5px; color: #334155; font-weight: 700;">
              <span>Date: ${currentDate}</span> | <span>Records: ${startIndex + 1} - ${startIndex + pageItems.length}</span> | <span>Page ${pageIdx + 1} of ${totalPages}</span>
            </div>
          </div>
        </div>`
        }

        <!-- Master Particulars Table -->
        <table class="data-table">
          <thead>
            <tr>
              <th class="text-center" style="width:26px;">#</th>
              <th class="text-center" style="width:52px;">Bill No</th>
              <th class="text-center" style="width:65px;">Date</th>
              <th style="width:140px;">Customer Name</th>
              <th style="width:120px;">Product Name</th>
              <th class="text-center" style="width:38px;">Cases</th>
              <th class="text-right" style="width:72px;">Subtotal</th>
              <th class="text-center" style="width:42px;">Disc</th>
              <th class="text-center" style="width:42px;">Tax</th>
              <th class="text-right" style="width:82px;">Net Total</th>
            </tr>
          </thead>
          <tbody>
            ${pageRowsHtml || '<tr><td colspan="10" class="text-center" style="padding:18px; color:#64748B;">No bill records found for the selected period.</td></tr>'}
          </tbody>
          <tfoot>
            <!-- Page Total Row (Bottom of EVERY page) -->
            <tr class="page-total-row">
              <td colspan="5" class="text-right" style="padding-right:8px;">PAGE ${pageIdx + 1} TOTAL (${pageItems.length} Bills):</td>
              <td class="text-center">${pageCasesSum}</td>
              <td class="text-right">₹ ${pageSubtotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td colspan="2"></td>
              <td class="text-right">₹ ${pageTotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>

            <!-- Final Page Only: OVERALL GRAND TOTAL -->
            ${
              isFinalPage
                ? `
            <tr class="grand-total-row">
              <td colspan="5" class="text-right" style="padding-right:8px;">OVERALL GRAND TOTAL (${particulars.length} Bills):</td>
              <td class="text-center">${overallCasesSum}</td>
              <td class="text-right">₹ ${overallSubtotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td colspan="2"></td>
              <td class="text-right">₹ ${overallTotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>`
                : ''
            }
          </tfoot>
        </table>

        ${
          isFinalPage
            ? `
        <!-- Signature Section (Final Page Only) -->
        <div class="signature-section">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Prepared By</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Checked & Verified By</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Authorized Signatory</div>
          </div>
        </div>`
            : ''
        }
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Particulars Bills Master Report - ${currentDate}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm 8mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-page {
      width: 100%;
      box-sizing: border-box;
      page-break-after: always;
      break-after: page;
      padding: 0;
    }
    .print-page:last-child,
    .print-page.final-page {
      page-break-after: auto;
      break-after: auto;
    }
    @media screen {
      .print-page {
        margin-bottom: 25px;
        padding-bottom: 25px;
        border-bottom: 2px dashed #94A3B8;
      }
      .print-page:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }
    }
    @media print {
      .print-page {
        margin: 0;
        border: none;
        padding: 0;
        page-break-after: always;
        break-after: page;
      }
      .print-page:last-child,
      .print-page.final-page {
        page-break-after: auto;
        break-after: auto;
      }
    }
    .company-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .comp-name {
      font-size: 19px;
      font-weight: 900;
      letter-spacing: -0.01em;
      color: #0B4DB7;
      line-height: 1.1;
    }
    .comp-sub {
      font-size: 9px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .report-heading {
      font-size: 12px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 2px;
    }
    .date-badge {
      display: inline-block;
      background-color: #EFF6FF;
      color: #0B4DB7;
      border: 1px solid #BFDBFE;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 700;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 9.5px;
      color: #334155;
      line-height: 1.35;
    }
    .meta-bold {
      font-weight: 700;
      color: #000000;
    }
    .kpi-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 5px;
    }
    .kpi-card {
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      padding: 3px 6px;
      background-color: #F8FAFC;
    }
    .kpi-title {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .kpi-val {
      font-size: 11.5px;
      font-weight: 900;
      color: #0F172A;
      margin-top: 1px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
      border: 1.5px solid #0F172A;
      table-layout: fixed;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-row-group;
    }
    tr {
      page-break-inside: avoid;
    }
    .data-table th {
      background-color: #0F172A;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 9px;
      padding: 4px 3px;
      border: 1px solid #0F172A;
      text-align: left;
      letter-spacing: 0.02em;
    }
    .data-table td {
      padding: 0 3px;
      border: 1px solid #CBD5E1;
      vertical-align: middle;
    }
    .data-row {
      height: 28px;
    }
    .text-center {
      text-align: center !important;
    }
    .text-right {
      text-align: right !important;
    }
    .page-total-row td {
      background-color: #F1F5F9 !important;
      color: #0F172A !important;
      border: 1px solid #CBD5E1 !important;
      font-size: 9.5px;
      font-weight: 800;
      padding: 3px 3px;
      height: 23px;
    }
    .grand-total-row td {
      background-color: #0F172A !important;
      color: #FFFFFF !important;
      border: 1px solid #0F172A !important;
      font-size: 10px;
      font-weight: 900;
      padding: 4px 3px;
      height: 24px;
    }
    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      padding: 0 15px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      width: 160px;
    }
    .sig-line {
      border-top: 1px solid #000000;
      margin-bottom: 3px;
    }
    .sig-label {
      font-size: 9px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
  `;
};

export const printParticularsListDirectly = (particulars: any[], dateRangeText?: string) => {
  const htmlContent = generateParticularsListPrintHtml(particulars, dateRangeText);
  triggerBrowserPrint(htmlContent);
};

/**
 * Print Companies List (A4 Standard)
 */
export const generateCompaniesListPrintHtml = (companies: any[]): string => {
  const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  const rowsHtml = companies.map((c, idx) => {
    const isEven = idx % 2 === 1;
    return `
    <tr style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
      <td class="text-center" style="width:40px; border: 1px solid #CBD5E1; padding: 6px;">${idx + 1}</td>
      <td style="font-weight:700; color:#0F172A; border: 1px solid #CBD5E1; padding: 6px 8px;">${c.name}</td>
      <td style="color:#334155; border: 1px solid #CBD5E1; padding: 6px 8px;">${c.gstin || '-'}</td>
      <td style="color:#475569; border: 1px solid #CBD5E1; padding: 6px 8px;">${c.address || '-'}</td>
    </tr>
  `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Companies List - ${currentDate}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin:0; padding:8px; color:#0F172A; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0F172A; padding-bottom: 8px; margin-bottom: 12px; }
    .table { width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #0F172A; }
    .table th { background: #0F172A; color:#FFFFFF; border: 1px solid #0F172A; padding: 7px; font-weight: 800; font-size: 11px; text-transform: uppercase; }
    .table td { border: 1px solid #CBD5E1; padding: 6px; }
    .text-center { text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size:24px; font-weight:900; color:#0B4DB7;">BUSSY BEE</div>
      <h2 style="font-size:15px; margin-top:2px;">COMPANIES DIRECTORY</h2>
    </div>
    <div style="text-align:right; font-size:11.5px;">
      <div>Date: <b>${currentDate}</b></div>
      <div>Total Companies: <b>${companies.length}</b></div>
    </div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th class="text-center">#</th>
        <th>Company Name</th>
        <th>GSTIN</th>
        <th>Address</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="4" class="text-center" style="padding:16px;">No companies found.</td></tr>'}
    </tbody>
  </table>
</body>
</html>
  `;
};

export const printCompaniesListDirectly = (companies: any[]) => {
  const htmlContent = generateCompaniesListPrintHtml(companies);
  triggerBrowserPrint(htmlContent);
};

/**
 * Print Products List (A4 Standard)
 */
export const generateProductsListPrintHtml = (products: any[]): string => {
  const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  const rowsHtml = products.map((p, idx) => {
    const isEven = idx % 2 === 1;
    return `
    <tr style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
      <td class="text-center" style="width:40px; border: 1px solid #CBD5E1; padding: 6px;">${idx + 1}</td>
      <td style="font-weight:700; color:#0F172A; border: 1px solid #CBD5E1; padding: 6px 8px;">${p.name}</td>
      <td class="text-center" style="color:#64748B; border: 1px solid #CBD5E1; padding: 6px;">${p.hsnCode || '-'}</td>
      <td style="text-align:right; font-weight:700; color:#0B4DB7; border: 1px solid #CBD5E1; padding: 6px 8px;">â‚¹ ${(parseFloat(p.rate) || 0).toFixed(2)}</td>
    </tr>
  `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Products Catalog - ${currentDate}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin:0; padding:8px; color:#0F172A; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0F172A; padding-bottom: 8px; margin-bottom: 12px; }
    .table { width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #0F172A; }
    .table th { background: #0F172A; color:#FFFFFF; border: 1px solid #0F172A; padding: 7px; font-weight: 800; font-size: 11px; text-transform: uppercase; }
    .table td { border: 1px solid #CBD5E1; padding: 6px; }
    .text-center { text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size:24px; font-weight:900; color:#0B4DB7;">BUSSY BEE</div>
      <h2 style="font-size:15px; margin-top:2px;">PRODUCTS PRICE CATALOG</h2>
    </div>
    <div style="text-align:right; font-size:11.5px;">
      <div>Date: <b>${currentDate}</b></div>
      <div>Total Products: <b>${products.length}</b></div>
    </div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th class="text-center">#</th>
        <th>Product Name</th>
        <th class="text-center">HSN Code</th>
        <th style="text-align:right;">Default Rate</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="4" class="text-center" style="padding:16px;">No products found.</td></tr>'}
    </tbody>
  </table>
</body>
</html>
  `;
};

export const printProductsListDirectly = (products: any[]) => {
  const htmlContent = generateProductsListPrintHtml(products);
  triggerBrowserPrint(htmlContent);
};

/**
 * Reusable hidden-iframe print helper with image loading support
 */
const triggerBrowserPrint = (htmlContent: string) => {
  let iframe = document.getElementById('bussybee-print-iframe') as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'bussybee-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();

    const doPrint = () => {
      setTimeout(() => {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      }, 150);
    };

    // Wait for all images in the print document to load
    const images = Array.from(doc.images);
    if (images.length === 0) {
      doPrint();
    } else {
      let loaded = 0;
      const total = images.length;
      const checkAllLoaded = () => {
        loaded++;
        if (loaded >= total) {
          doPrint();
        }
      };

      images.forEach((img) => {
        if (img.complete) {
          checkAllLoaded();
        } else {
          img.onload = checkAllLoaded;
          img.onerror = checkAllLoaded;
        }
      });

      // Safety timeout
      setTimeout(doPrint, 1200);
    }
  }
};
