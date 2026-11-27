import type { BillPrintData } from '../components/BillPrintTemplate';
import { numberToWords, formatStateName } from '../components/BillPrintTemplate';

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
    const isDiscFlat = rawDiscStr.startsWith('₹') || rawDiscStr.toLowerCase().includes('rs');
    if (rawDiscStr.includes('%') || (!isDiscFlat && discNum <= 100)) {
      discountAmt = (subtotal * discNum) / 100;
      discountLabel = `Discount (${cleanDisc}%)`;
    } else {
      discountAmt = discNum;
      discountLabel = `Discount (₹${discNum.toLocaleString('en-IN')})`;
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
    const isPackFlat = rawPackStr.startsWith('₹') || rawPackStr.toLowerCase().includes('rs');
    if (rawPackStr.includes('%') || (!isPackFlat && packNum <= 100)) {
      packingAmt = (baseAfterDiscount * packNum) / 100;
      packingLabel = `Packing (${cleanPack}%)`;
    } else {
      packingAmt = packNum;
      packingLabel = `Packing (₹${packNum.toLocaleString('en-IN')})`;
    }
  } else {
    packingLabel = 'Packing Charges';
  }

  // Tax calculation (Manual flat amount)
  const rawTaxStr = String(bill.tax ?? '').trim().replace(/[^0-9.]/g, '');
  const taxNum = parseFloat(rawTaxStr) || 0;
  let taxAmt = 0;
  if (taxNum > 0) {
    taxAmt = taxNum;
  }

  // Grand Total calculation with mathematical Round Off (.5 & above rounds up (+1), below .5 rounds down)
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

  const custAddr = bill.customerAddress && bill.customerAddress.trim() ? bill.customerAddress.trim() : '';
  const custGst = bill.customerGst && bill.customerGst.trim() ? bill.customerGst.trim() : '';

  const fromCompanyName = (
    bill.companyName && bill.companyName !== 'BUSSY BEE'
      ? bill.companyName
      : (bill.traderName && bill.traderName !== 'BUSSY BEE'
        ? bill.traderName
        : (typeof window !== 'undefined' ? localStorage.getItem('bussy_bee_company_name') : null) || 'Sri Shanmuga Traders')
  ).trim();
  const fromAddress = (
    bill.traderAddress ||
    bill.companyAddress ||
    (typeof window !== 'undefined' ? localStorage.getItem('bussy_bee_company_address') : null) ||
    '352, Amman Kovil Patti Middle Street, Sivakasi - 626123'
  ).trim();
  const fromGst = (
    bill.traderGst ||
    bill.companyGst ||
    (typeof window !== 'undefined' ? localStorage.getItem('bussy_bee_company_gst') : null) ||
    '33BUMPR9147N1ZQ'
  ).trim();
  const fromState = (typeof window !== 'undefined' ? localStorage.getItem('bussy_bee_company_state') : null) || 'Tamil Nadu';

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

  const displayBillNo = bill.billNo || '-';

  const productRowsHtml = (bill.products || []).length === 0
    ? `
      <tr>
        <td style="border-right: 1px solid #000000; text-align: center; padding: 6px;">1</td>
        <td style="border-right: 1px solid #000000; padding: 6px 8px;">-</td>
        <td style="border-right: 1px solid #000000; text-align: center; padding: 6px;">4819</td>
        <td style="border-right: 1px solid #000000; text-align: right; padding: 6px;">0 nos</td>
        <td style="border-right: 1px solid #000000; text-align: right; padding: 6px;">0.00</td>
        <td style="border-right: 1px solid #000000; text-align: center; padding: 6px;">nos</td>
        <td style="text-align: right; padding: 6px 8px;">0.00</td>
      </tr>
    `
    : (bill.products || []).map((item, idx) => {
        const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
        const unit = item.pktUnit && item.pktUnit !== '-' ? item.pktUnit : 'nos';
        const isLast = idx === (bill.products.length - 1);
        return `
          <tr>
            <td style="border-right: 1px solid #000000; text-align: center; padding: 6px 2px; vertical-align: top;">${idx + 1}</td>
            <td style="border-right: 1px solid #000000; padding: 6px 8px; vertical-align: top;">
              <div style="font-weight: bold; text-transform: uppercase; font-size: 12px;">${item.particular || '-'}</div>
              ${isLast ? `
                <div style="margin-top: 14px; font-style: italic; font-size: 11px; font-weight: bold;">
                  ${taxAmt > 0 ? `
                    <div style="display: flex; justify-content: space-between; padding-right: 20px;">
                      <span>CGST-${effectiveCgstRate}%</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding-right: 20px; margin-top: 2px;">
                      <span>SGST-${effectiveSgstRate}%</span>
                    </div>
                  ` : ''}
                  ${packingAmt > 0 ? `
                    <div style="display: flex; justify-content: space-between; padding-right: 20px; margin-top: 2px;">
                      <span>${packingLabel}</span>
                    </div>
                  ` : ''}
                  ${discountAmt > 0 ? `
                    <div style="display: flex; justify-content: space-between; padding-right: 20px; margin-top: 2px; color: #DC2626;">
                      <span>${discountLabel}</span>
                    </div>
                  ` : ''}
                  ${Math.abs(roundOffDiff) > 0.001 ? `
                    <div style="display: flex; justify-content: space-between; padding-right: 20px; margin-top: 2px;">
                      <span>ROUND OFF</span>
                    </div>
                  ` : ''}
                </div>
              ` : ''}
            </td>
            <td style="border-right: 1px solid #000000; text-align: center; padding: 6px 4px; vertical-align: top;">${item.hsn && item.hsn.trim() !== '' ? item.hsn.trim() : '4819'}</td>
            <td style="border-right: 1px solid #000000; text-align: right; padding: 6px 6px; vertical-align: top; font-weight: bold;">${item.quantity ? `${item.quantity} ${unit}` : '-'}</td>
            <td style="border-right: 1px solid #000000; text-align: right; padding: 6px 6px; vertical-align: top;">
              <div>${(parseFloat(String(item.rate)) || 0).toFixed(2)}</div>
              ${isLast && taxAmt > 0 ? `
                <div style="margin-top: 14px; font-size: 11px;">
                  <div>${effectiveCgstRate} %</div>
                  <div style="margin-top: 2px;">${effectiveSgstRate} %</div>
                </div>
              ` : ''}
            </td>
            <td style="border-right: 1px solid #000000; text-align: center; padding: 6px 4px; vertical-align: top;">
              <div>${unit}</div>
            </td>
            <td style="text-align: right; padding: 6px 8px; vertical-align: top; font-weight: bold;">
              <div>${numAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              ${isLast ? `
                <div style="margin-top: 14px; font-size: 11px; font-weight: bold;">
                  ${taxAmt > 0 ? `
                    <div>${totalCgstAmount.toFixed(2)}</div>
                    <div style="margin-top: 2px;">${totalSgstAmount.toFixed(2)}</div>
                  ` : ''}
                  ${packingAmt > 0 ? `<div style="margin-top: 2px;">${packingAmt.toFixed(2)}</div>` : ''}
                  ${discountAmt > 0 ? `<div style="margin-top: 2px; color: #DC2626;">-${discountAmt.toFixed(2)}</div>` : ''}
                  ${Math.abs(roundOffDiff) > 0.001 ? `<div style="margin-top: 2px;">${roundOffDiff >= 0 ? `+${roundOffDiff.toFixed(2)}` : roundOffDiff.toFixed(2)}</div>` : ''}
                </div>
              ` : ''}
            </td>
          </tr>
        `;
      }).join('');

  const gstRowsHtml = gstGroups.map((g) => `
    <tr>
      <td style="border-right: 1px solid #000000; padding: 4px; text-align: center;">${g.hsn}</td>
      <td style="border-right: 1px solid #000000; padding: 4px 6px; text-align: right;">${g.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="border-right: 1px solid #000000; padding: 4px; text-align: center;">${g.cgstRate}%</td>
      <td style="border-right: 1px solid #000000; padding: 4px 6px; text-align: right;">${g.cgstAmount.toFixed(2)}</td>
      <td style="border-right: 1px solid #000000; padding: 4px; text-align: center;">${g.sgstRate}%</td>
      <td style="border-right: 1px solid #000000; padding: 4px 6px; text-align: right;">${g.sgstAmount.toFixed(2)}</td>
      <td style="padding: 4px 6px; text-align: right; font-weight: bold;">${g.totalTax.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Estimate #${bill.billNo || ''} - ${fromCompanyName}</title>
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
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      font-size: 11.5px;
      line-height: 1.3;
    }
    .bill-wrapper {
      width: 100%;
      max-width: 794px;
      margin: 0 auto;
      border: 1.5px solid #000000;
      background: #FFFFFF;
    }
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 10px;
      border-bottom: 1px solid #000000;
    }
    .top-title {
      font-size: 15px;
      font-weight: bold;
      text-align: center;
      letter-spacing: 0.04em;
    }
    .top-right {
      font-size: 10px;
      font-style: italic;
      font-weight: bold;
      color: #333333;
      text-align: right;
    }
    .grid-2col {
      display: flex;
      border-bottom: 1px solid #000000;
    }
    .grid-left {
      width: 50%;
      border-right: 1px solid #000000;
      display: flex;
      flex-direction: column;
    }
    .grid-right {
      width: 50%;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      height: 100%;
      font-size: 11px;
    }
    .meta-table td {
      border-bottom: 1px solid #000000;
      padding: 4px 6px;
      vertical-align: top;
    }
    .meta-table .col-right-border {
      border-right: 1px solid #000000;
      width: 50%;
    }
    .meta-label {
      font-size: 10px;
      color: #444444;
    }
    .meta-val {
      font-weight: bold;
      font-size: 11.5px;
      margin-top: 1px;
    }
    .party-cell {
      border-top: 1px solid #000000;
      padding: 6px 10px;
      min-height: 68px;
    }
    .prod-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
    }
    .prod-table th {
      border-bottom: 1px solid #000000;
      font-size: 11px;
      font-weight: bold;
      padding: 5px 6px;
    }
    .prod-table td {
      padding: 6px;
    }
    .gst-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      border-bottom: 1px solid #000000;
    }
    .gst-table th {
      border-bottom: 1px solid #000000;
      padding: 4px;
      font-size: 10px;
    }
    .gst-table td {
      padding: 4px 6px;
    }
  </style>
</head>
<body>
  <div class="bill-wrapper">
    <!-- 1. Top Bar -->
    <div class="top-bar">
      <div style="width: 160px;"></div>
      <div class="top-title">Estimate</div>
      <div class="top-right" style="width: 160px;">(ORIGINAL FOR RECIPIENT)</div>
    </div>

    <!-- 2. Header Grid -->
    <div class="grid-2col">
      <!-- Left Column: Company Info & Buyer -->
      <div class="grid-left">
        <!-- Company Info -->
        <div style="padding: 8px 10px; display: flex; gap: 8px; align-items: flex-start;">
          <div style="flex-shrink: 0; margin-top: 2px;">
            <svg width="40" height="40" viewBox="0 0 100 100" style="border: 1.5px solid #000000; border-radius: 50%;">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#000000" stroke-width="2" />
              <path d="M50 18 L55 35 L73 35 L59 46 L64 63 L50 52 L36 63 L41 46 L27 35 L45 35 Z" fill="#000000" />
            </svg>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 2px;">${fromCompanyName}</div>
            <div style="font-size: 11px; margin-bottom: 2px;">${fromAddress}</div>
            <div style="font-size: 11px;"><span style="font-weight: bold;">GSTIN/UIN: </span><span>${fromGst}</span></div>
            <div style="font-size: 11px;"><span style="font-weight: bold;">State Name : </span><span>${formatStateName(fromState)}</span></div>
          </div>
        </div>

        <!-- Consignee (Ship to) -->
        <div class="party-cell">
          <div style="font-size: 10.5px; color: #444444; margin-bottom: 2px;">Consignee (Ship to)</div>
          <div style="font-size: 12px; font-weight: bold; text-transform: uppercase;">${bill.customerName || '-'}</div>
          <div style="font-size: 11px; text-transform: uppercase; line-height: 1.25;">${custAddr}</div>
          <div style="font-size: 11px; margin-top: 2px;">
            <span style="font-weight: bold;">State Name</span> : ${formatStateName(bill.customerState)}
          </div>
          ${custGst && custGst !== '-' ? `<div style="font-size: 11px; margin-top: 1px;"><span style="font-weight: bold;">GSTIN/UIN</span> : ${custGst}</div>` : ''}
        </div>

        <!-- Buyer (Bill to) -->
        <div class="party-cell">
          <div style="font-size: 10.5px; color: #444444; margin-bottom: 2px;">Buyer (Bill to)</div>
          <div style="font-size: 12px; font-weight: bold; text-transform: uppercase;">${bill.customerName || '-'}</div>
          <div style="font-size: 11px; text-transform: uppercase; line-height: 1.25;">${custAddr}</div>
          <div style="font-size: 11px; margin-top: 2px;">
            <span style="font-weight: bold;">State Name</span> : ${formatStateName(bill.customerState)}
          </div>
          ${custGst && custGst !== '-' ? `<div style="font-size: 11px; margin-top: 1px;"><span style="font-weight: bold;">GSTIN/UIN</span> : ${custGst}</div>` : ''}
        </div>
      </div>

      <!-- Right Column: Metadata Grid Table -->
      <div class="grid-right">
        <table class="meta-table">
          <tbody>
            <tr style="height: 33.33%;">
              <td class="col-right-border">
                <div class="meta-label">Bill No.</div>
                <div class="meta-val">${displayBillNo}</div>
              </td>
              <td>
                <div class="meta-label">Dated</div>
                <div class="meta-val">${bill.date || '-'}</div>
              </td>
            </tr>
            <tr style="height: 33.33%;">
              <td class="col-right-border">
                <div class="meta-label">Transport</div>
                <div class="meta-val">${bill.transport && bill.transport !== '-' ? bill.transport : '-'}</div>
              </td>
              <td>
                <div class="meta-label">Destination</div>
                <div class="meta-val">${custAddr ? custAddr.split(',')[0].trim() : '-'}</div>
              </td>
            </tr>
            <tr style="height: 33.34%;">
              <td class="col-right-border" style="border-bottom: none;">
                <div class="meta-label">LR No.</div>
                <div class="meta-val">${bill.lrNo && bill.lrNo !== '-' ? bill.lrNo : '-'}</div>
              </td>
              <td style="border-bottom: none;">
                <div class="meta-label">Bundles Qty</div>
                <div class="meta-val">${computedCases ? `${computedCases} bundles` : '-'}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 3. Goods Table matching Image 2 -->
    <table class="prod-table">
      <thead>
        <tr>
          <th style="width: 5%; border-right: 1px solid #000000; text-align: center;">Sl<br/>No.</th>
          <th style="width: 45%; border-right: 1px solid #000000; text-align: left; padding-left: 8px;">Description of Goods</th>
          <th style="width: 12%; border-right: 1px solid #000000; text-align: center;">HSN/SAC</th>
          <th style="width: 14%; border-right: 1px solid #000000; text-align: right;">Quantity</th>
          <th style="width: 10%; border-right: 1px solid #000000; text-align: right;">Rate</th>
          <th style="width: 5%; border-right: 1px solid #000000; text-align: center;">per</th>
          <th style="width: 9%; text-align: right; padding-right: 8px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${productRowsHtml}
      </tbody>
      <tfoot>
        <tr style="border-top: 1px solid #000000; border-bottom: 1px solid #000000; font-weight: bold;">
          <td colspan="2" style="border-right: 1px solid #000000; text-align: right; padding: 6px 8px;">Total</td>
          <td style="border-right: 1px solid #000000;"></td>
          <td style="border-right: 1px solid #000000; text-align: right; padding: 6px 6px; font-weight: bold;">${totalQuantity} ${primaryUnit}</td>
          <td style="border-right: 1px solid #000000;"></td>
          <td style="border-right: 1px solid #000000;"></td>
          <td style="text-align: right; padding: 6px 8px; font-weight: bold; font-size: 12px;">₹ ${formattedTotal}</td>
        </tr>
        <tr>
          <td colspan="7" style="text-align: right; padding: 2px 8px; font-size: 10px; font-style: italic; color: #444444;">E. & O.E</td>
        </tr>
      </tfoot>
    </table>

    <!-- 4. Amount Chargeable (in words) -->
    <div style="border-top: 1px solid #000000; padding: 6px 10px; border-bottom: 1px solid #000000;">
      <div style="font-size: 10px; color: #444444;">Amount Chargeable (in words)</div>
      <div style="font-size: 12.5px; font-weight: bold; margin-top: 2px;">${numberToWords(roundedTotalNum)}</div>
    </div>

    <!-- 5. Tax Breakdown Table -->
    <table class="gst-table">
      <thead>
        <tr style="border-bottom: 1px solid #000000;">
          <th rowspan="2" style="width: 15%; border-right: 1px solid #000000; text-align: center;">HSN/SAC</th>
          <th rowspan="2" style="width: 15%; border-right: 1px solid #000000; text-align: right;">Taxable<br/>Value</th>
          <th colspan="2" style="width: 25%; border-right: 1px solid #000000; text-align: center; border-bottom: 1px solid #000000;">CGST</th>
          <th colspan="2" style="width: 25%; border-right: 1px solid #000000; text-align: center; border-bottom: 1px solid #000000;">SGST/UTGST</th>
          <th rowspan="2" style="width: 20%; text-align: right;">Total<br/>Tax Amount</th>
        </tr>
        <tr style="border-bottom: 1px solid #000000;">
          <th style="width: 10%; border-right: 1px solid #000000; text-align: center;">Rate</th>
          <th style="width: 15%; border-right: 1px solid #000000; text-align: right;">Amount</th>
          <th style="width: 10%; border-right: 1px solid #000000; text-align: center;">Rate</th>
          <th style="width: 15%; border-right: 1px solid #000000; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${gstRowsHtml}
        <tr style="border-top: 1px solid #000000; font-weight: bold;">
          <td style="border-right: 1px solid #000000; text-align: right; padding: 4px;">Total</td>
          <td style="border-right: 1px solid #000000; text-align: right; padding: 4px 6px;">${totalTaxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="border-right: 1px solid #000000;"></td>
          <td style="border-right: 1px solid #000000; text-align: right; padding: 4px 6px;">${totalCgstAmount.toFixed(2)}</td>
          <td style="border-right: 1px solid #000000;"></td>
          <td style="border-right: 1px solid #000000; text-align: right; padding: 4px 6px;">${totalSgstAmount.toFixed(2)}</td>
          <td style="text-align: right; padding: 4px 6px; font-weight: bold;">${totalGstAmount.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Tax Amount in words -->
    <div style="padding: 4px 10px; font-size: 11px; border-bottom: 1px solid #000000;">
      <span style="color: #444444;">Tax Amount (in words) : </span>
      <strong style="text-transform: capitalize;">${numberToWords(totalGstAmount)}</strong>
    </div>

    <!-- 6. Declaration & Signatures (NO BANK DETAILS per user request!) -->
    <div style="display: flex; min-height: 90px;">
      <div style="width: 55%; border-right: 1px solid #000000; padding: 8px 10px;">
        <div style="font-weight: bold; font-size: 11px; text-decoration: underline; margin-bottom: 4px;">Declaration</div>
        <div style="font-size: 10.5px; color: #222222; line-height: 1.35;">
          We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
        </div>
      </div>
      <div style="width: 45%; padding: 8px 10px; display: flex; flex-direction: column; justify-content: space-between; text-align: right;">
        <div style="font-weight: bold; font-size: 11px;">for ${fromCompanyName}</div>
        <div style="height: 40px;"></div>
        <div style="font-weight: bold; font-size: 11px;">Authorised Signatory</div>
      </div>
    </div>

    <!-- 7. Bottom Disclaimer -->
    <div style="border-top: 1px solid #000000; text-align: center; padding: 3px; font-size: 10px; color: #555555;">
      This is a Computer Generated Invoice
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
        balanceHtml = `<span style="color:#DC2626; font-weight:800;">₹ ${(c.pendingDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Due)</span>`;
      } else if ((c.netBalance || 0) > 0) {
        balanceHtml = `<span style="color:#0284C7; font-weight:800;">+₹ ${(c.netBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Adv)</span>`;
      } else {
        balanceHtml = `<span style="color:#16A34A; font-weight:700;">₹ 0.00 (Settled)</span>`;
      }

      return `
        <tr class="data-row" style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
          <td class="text-center" style="width: 30px;">${globalIdx + 1}</td>
          <td class="text-center" style="width: 55px; font-weight:700; color:#475569;">${idDisplay}</td>
          <td style="font-weight:800; color:#0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${c.name}</td>
          <td style="color:#475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 195px;">${c.address || '-'}</td>
          <td class="text-right" style="font-weight:700; color:#1E293B; width: 90px;">₹ ${deb}</td>
          <td class="text-right" style="font-weight:700; color:#16A34A; width: 90px;">₹ ${cred}</td>
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
            <div class="comp-sub">Wholesale & Retail Trading • Sivakasi</div>
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
            <div class="kpi-val">₹ ${overallDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Credit (Paid)</div>
            <div class="kpi-val" style="color:#16A34A;">₹ ${overallCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card" style="background-color:#FEF2F2; border-color:#FECACA;">
            <div class="kpi-title" style="color:#991B1B;">Total Pending Due</div>
            <div class="kpi-val" style="color:#DC2626;">₹ ${overallPendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card" style="background-color:#F0F9FF; border-color:#BAE6FD;">
            <div class="kpi-title" style="color:#0369A1;">Total Advance Balances</div>
            <div class="kpi-val" style="color:#0284C7;">₹ ${overallAdvanceHeld.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>`
            : `
        <!-- Compact Header (Subsequent Pages) -->
        <div class="subsequent-header">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0F172A; padding-bottom: 4px; margin-bottom: 6px;">
            <div>
              <span style="font-size: 15px; font-weight: 900; color: #0B4DB7;">BUSSY BEE</span>
              <span style="font-size: 10.5px; font-weight: 700; color: #475569; margin-left: 8px;">• ${reportTitle}</span>
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
              <td class="text-right">₹ ${pageDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">₹ ${pageCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">
                ${
                  pagePendingDue > 0
                    ? `Due: ₹ ${pagePendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : pageAdvanceHeld > 0
                    ? `+₹ ${pageAdvanceHeld.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Adv)`
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
              <td class="text-right">₹ ${overallDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">₹ ${overallCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">
                ${
                  overallPendingDue > 0
                    ? `Due: ₹ ${overallPendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : overallAdvanceHeld > 0
                    ? `+₹ ${overallAdvanceHeld.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Adv)`
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
          <td class="text-right" style="width:105px; color:#1E293B; font-weight:700;">${deb > 0 ? `₹ ${deb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
          <td class="text-right" style="width:105px; color:#16A34A; font-weight:700;">${cred > 0 ? `₹ ${cred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
          <td class="text-right" style="width:110px; font-weight:800; color:#0B4DB7;">₹ ${entry.balance || '0.00'}</td>
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
            <div class="comp-sub">Wholesale & Retail Trading • Sivakasi</div>
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
            <div class="kpi-val" style="color:#0F172A;">₹ ${totalDeb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Received / Credit (Cr)</div>
            <div class="kpi-val" style="color:#16A34A;">₹ ${totalCred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card" style="background-color:${netBalance > 0 ? '#FEF2F2' : '#F0FDF4'}; border-color:${netBalance > 0 ? '#FECACA' : '#BBF7D0'};">
            <div class="kpi-title" style="color:${netBalance > 0 ? '#991B1B' : '#166534'};">Net Balance Status</div>
            <div class="kpi-val" style="color:${netBalance > 0 ? '#DC2626' : '#16A34A'};">
              ₹ ${Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${netBalance > 0 ? '(Due Pending)' : netBalance < 0 ? '(Advance Held)' : '(Settled)'}
            </div>
          </div>
        </div>`
            : `
        <!-- Compact Header (Subsequent Pages) -->
        <div class="subsequent-header">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0F172A; padding-bottom: 4px; margin-bottom: 5px;">
            <div>
              <span style="font-size: 15px; font-weight: 900; color: #0B4DB7;">BUSSY BEE</span>
              <span style="font-size: 10.5px; font-weight: 700; color: #475569; margin-left: 8px;">• ACCOUNT STATEMENT: ${customerName.toUpperCase()}</span>
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
              <th class="text-right" style="width:110px;">Balance (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${pageRowsHtml || '<tr><td colspan="7" class="text-center" style="padding:18px; color:#64748B;">No transaction entries found for the selected period.</td></tr>'}
          </tbody>
          <tfoot>
            <!-- Page Total Row (Bottom of EVERY page) -->
            <tr class="page-total-row">
              <td colspan="4" class="text-right" style="padding-right:8px;">PAGE ${pageIdx + 1} TOTAL (${pageEntries.length} Records):</td>
              <td class="text-right">₹ ${pageDeb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">₹ ${pageCred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">
                ₹ ${Math.abs(pageNet).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${pageNet > 0 ? 'Dr' : pageNet < 0 ? 'Cr' : ''}
              </td>
            </tr>

            <!-- Final Page Only: OVERALL GRAND TOTAL -->
            ${
              isFinalPage
                ? `
            <tr class="grand-total-row">
              <td colspan="4" class="text-right" style="padding-right:8px;">OVERALL GRAND TOTALS (${ledgerEntries.length} Records):</td>
              <td class="text-right">₹ ${totalDeb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">₹ ${totalCred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">
                ₹ ${Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${netBalance > 0 ? 'Dr' : netBalance < 0 ? 'Cr' : ''}
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

      const rawPack = p.packing !== undefined && p.packing !== null && String(p.packing).trim() !== ''
        ? String(p.packing).replace(/[^0-9.]/g, '')
        : (p.discount !== undefined && p.discount !== null ? String(p.discount).replace(/[^0-9.]/g, '') : '');
      const packStr = rawPack && parseFloat(rawPack) > 0 ? `${rawPack}%` : '-';
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
          <td class="text-center" style="width:42px; color:${packStr !== '-' ? '#0284C7' : '#94A3B8'}; font-weight:600;">${packStr}</td>
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
            <div class="comp-sub">Wholesale & Retail Trading • Sivakasi</div>
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
            <div class="kpi-val" style="color:#16A34A;">₹ ${overallTotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>`
            : `
        <!-- Compact Header (Subsequent Pages) -->
        <div class="subsequent-header">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0F172A; padding-bottom: 4px; margin-bottom: 5px;">
            <div>
              <span style="font-size: 15px; font-weight: 900; color: #0B4DB7;">BUSSY BEE</span>
              <span style="font-size: 10.5px; font-weight: 700; color: #475569; margin-left: 8px;">• PARTICULARS BILLS MASTER REPORT</span>
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
              <th class="text-center" style="width:42px;">Packing</th>
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
      <td style="text-align:right; font-weight:700; color:#0B4DB7; border: 1px solid #CBD5E1; padding: 6px 8px;">₹ ${(parseFloat(p.rate) || 0).toFixed(2)}</td>
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
