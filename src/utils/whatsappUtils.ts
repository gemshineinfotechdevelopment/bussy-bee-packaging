import html2pdf from 'html2pdf.js';
import {
  generateBillHtml,
  generateLedgerStatementHtml,
  generateParticularsListPrintHtml,
  generateCustomerListPrintHtml,
} from './printUtils';
import type { BillPrintData } from '../components/BillPrintTemplate';
import { numberToWords } from '../components/BillPrintTemplate';

/**
 * Normalizes phone numbers for WhatsApp (adds 91 if 10-digit Indian number)
 */
export const normalizeWhatsAppPhone = (phone?: string): string => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length > 10 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
};

/**
 * Generates an in-memory PDF Blob from raw HTML using html2pdf.js matching exact A4 print format
 */
export const generatePdfBlobFromHtml = async (html: string, fileName: string): Promise<File | null> => {
  return new Promise((resolve) => {
    try {
      const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      const isLandscape = html.includes('size: A4 landscape') || html.includes('landscape');
      const targetWidth = isLandscape ? 1123 : 794;
      const targetHeight = isLandscape ? 794 : 1123;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = `${targetWidth}px`;
      iframe.style.height = `${targetHeight}px`;
      iframe.style.zIndex = '-99999';
      iframe.style.opacity = '1';
      iframe.style.visibility = 'visible';
      iframe.style.border = 'none';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        resolve(null);
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      if (doc.body) {
        doc.body.style.width = `${targetWidth}px`;
        doc.body.style.margin = '0';
        doc.body.style.padding = '0';
        doc.body.style.backgroundColor = '#FFFFFF';
      }

      // Allow 400ms for browser layout engine to render tables, inline CSS, borders, and fonts
      setTimeout(async () => {
        try {
          const target = doc.body;
          const opt = {
            margin: 0,
            filename: cleanFileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: '#FFFFFF',
              windowWidth: targetWidth,
              scrollX: 0,
              scrollY: 0,
            },
            jsPDF: {
              unit: 'mm',
              format: 'a4',
              orientation: isLandscape ? 'landscape' : 'portrait',
            },
            pagebreak: {
              mode: ['css', 'legacy'],
              after: ['.print-page', '.page-break-after'],
              avoid: ['tr', '.data-row', '.sig-section', '.signature-section', '.company-banner', '.kpi-summary-grid', '.page-total-row', '.grand-total-row'],
            },
          };

          const worker = (html2pdf() as any).set(opt).from(target);
          const pdfBlob: Blob = await worker.output('blob');

          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }

          if (pdfBlob && pdfBlob.size > 200) {
            resolve(new File([pdfBlob], cleanFileName, { type: 'application/pdf' }));
          } else {
            console.warn('[PDF Gen] Generated PDF Blob is too small or empty');
            resolve(null);
          }
        } catch (err) {
          console.error('[PDF Generation Worker Error]:', err);
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          resolve(null);
        }
      }, 400);
    } catch (e) {
      console.error('[PDF Gen Error]:', e);
      resolve(null);
    }
  });
};

/**
 * Base dispatcher: tries Web Share API with attached PDF File;
 * falls back to direct WhatsApp Web/App URL with pre-filled message
 * AND automatically downloads the exact same generated PDF file on Desktop browsers.
 */
export const shareToWhatsApp = async (options: {
  title: string;
  text: string;
  fileName: string;
  html?: string;
  phone?: string;
}) => {
  const { title, text, fileName, html, phone } = options;
  const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const cleanPhone = normalizeWhatsAppPhone(phone);

  let pdfFile: File | null = null;
  if (html) {
    pdfFile = await generatePdfBlobFromHtml(html, cleanFileName);
  }

  // 1. If a specific customer phone number is provided, ALWAYS open direct WhatsApp chat to that customer!
  // Web Share API does NOT support targeting recipient phone numbers, so calling navigator.share
  // forces users to search contacts manually and loses the targeted customer number.
  if (cleanPhone) {
    if (pdfFile) {
      try {
        const blobUrl = URL.createObjectURL(pdfFile);
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = cleanFileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      } catch (dErr) {
        console.warn('[Direct PDF Download fallback failed]:', dErr);
      }
    }

    const encodedText = encodeURIComponent(text);
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    window.open(waUrl, '_blank');
    return;
  }

  // 2. Try Native Web Share API if device/browser supports file sharing and NO phone is targeted
  if (pdfFile && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
        title,
        text,
      });
      return;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[WebShare API failed, falling back to WhatsApp URL]:', err);
      } else {
        return; // User cancelled share sheet
      }
    }
  }

  // 3. Direct PDF Download fallback for Desktop browsers:
  if (pdfFile) {
    try {
      const blobUrl = URL.createObjectURL(pdfFile);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = cleanFileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (dErr) {
      console.warn('[Direct PDF Download fallback failed]:', dErr);
    }
  }

  // 4. General WhatsApp URL fallback
  const encodedText = encodeURIComponent(text);
  const waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
  window.open(waUrl, '_blank');
};

/**
 * 1. Share Particular Bill on WhatsApp matching exact printed invoice format
 */
export const shareBillOnWhatsApp = async (bill: BillPrintData, phone?: string) => {
  // Target customer's phone number
  const targetPhone = phone || bill.customerMobile || bill.customerPhone || '';

  // 1. Calculate Subtotal from Products or bill.amount
  const prodSubtotal = (bill.products || []).reduce((acc, p) => {
    const amt = parseFloat(String(p.amount).replace(/,/g, '')) || 0;
    return acc + amt;
  }, 0);
  const subtotal = prodSubtotal > 0 ? prodSubtotal : (parseFloat(String(bill.amount || bill.total || '0').replace(/,/g, '')) || 0);

  // 2. Discount calculation
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

  // 3. Packing calculation
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

  // 4. Tax calculation
  const rawTaxStr = String(bill.tax ?? '').trim().replace(/[^0-9.]/g, '');
  const taxNum = parseFloat(rawTaxStr) || 0;
  let taxAmt = 0;
  if (taxNum > 0) {
    taxAmt = taxNum;
  }

  // 5. Grand Total calculation
  const calculatedTotal = Math.max(0, subtotal - discountAmt + packingAmt + taxAmt);
  const rawTotalNum = parseFloat(String(bill.total ?? bill.amount ?? '0').replace(/,/g, '')) || 0;
  const finalTotalNum = rawTotalNum > 0 && Math.abs(rawTotalNum - calculatedTotal) < 0.05 ? rawTotalNum : calculatedTotal;
  const formattedTotal = finalTotalNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const computedCases = bill.caseCount !== undefined && bill.caseCount !== ''
    ? bill.caseCount
    : (bill.products || []).reduce((acc, p) => acc + (parseFloat(String(p.quantity)) || 0), 0);

  const custPhone = targetPhone || bill.customerMobile || bill.customerPhone || bill.phone || '';
  const custAddr = bill.customerAddress && bill.customerAddress.trim() ? bill.customerAddress.trim() : '';
  const custGst = bill.customerGst && bill.customerGst.trim() ? bill.customerGst.trim() : '';

  // 6. Formatted Product Items matching the printed bill columns: # | Particular | HSN | Counts | Rate | Unit | Amount
  const itemsText = (bill.products || []).length > 0
    ? (bill.products || [])
        .map((p, i) => {
          const qty = p.quantity || '0';
          const rateVal = parseFloat(String(p.rate).replace(/,/g, '')) || 0;
          const amtVal = parseFloat(String(p.amount).replace(/,/g, '')) || 0;
          const unitStr = p.pktUnit && p.pktUnit !== '-' ? p.pktUnit : 'nos';
          const hsnStr = p.hsn && p.hsn.trim() !== '' ? ` | HSN: ${p.hsn.trim()}` : '';
          return `${i + 1}. *${p.particular}*\n   Counts: ${qty}${hsnStr} | Rate: ₹${rateVal.toFixed(2)} | Unit: ${unitStr} | Amount: *₹${amtVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*`;
        })
        .join('\n\n')
    : '-';

  // 7. Full structured message matching BillPrintTemplate layout
  const text = `*BUSSY BEE - ESTIMATE / INVOICE* 🧾
========================================
*Bill No:* #${bill.billNo || '-'}
*Date:* ${bill.date || '-'}
*Total Counts:* ${computedCases}
${custPhone ? `*Phone:* ${custPhone}\n` : ''}========================================
*BUYER (BILL TO):*
*Name:* ${bill.customerName || '-'}
${custAddr ? `*Address:* ${custAddr}\n` : ''}${custGst && custGst !== '-' ? `*GSTIN / UIN:* ${custGst}\n` : ''}*State Name:* ${bill.customerState || 'Tamil Nadu'}, Code: 33
${bill.transport && bill.transport !== '-' ? `*Transport:* ${bill.transport}\n` : ''}========================================
*ITEMS:*
${itemsText}
========================================
*Subtotal / Particular Amount:* ₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
${discountAmt > 0 ? `*${discountLabel}:* -₹${discountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` : ''}${packingAmt > 0 ? `*${packingLabel}:* +₹${packingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` : ''}${taxAmt > 0 ? `*Tax Amount:* +₹${taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` : ''}*GRAND TOTAL:* ₹${formattedTotal}
*Amount in Words:* ${numberToWords(finalTotalNum)}
========================================
_Thank you for your business!_
*BUSSY BEE*`;

  const html = generateBillHtml(bill);
  await shareToWhatsApp({
    title: `Bill #${bill.billNo} - ${bill.customerName}`,
    text,
    fileName: `Bill-${bill.billNo}-${(bill.customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone: targetPhone,
  });
};

/**
 * 2. Share Account Ledger Statement on WhatsApp
 */
export const shareLedgerOnWhatsApp = async (
  customerName: string,
  accountDetails: any[],
  fromDate?: string,
  toDate?: string,
  phone?: string
) => {
  const totalDebit = accountDetails.reduce((sum, r) => sum + (parseFloat(String(r.debit).replace(/,/g, '')) || 0), 0);
  const totalCredit = accountDetails.reduce((sum, r) => sum + (parseFloat(String(r.credit).replace(/,/g, '')) || 0), 0);
  const netBalance = totalDebit - totalCredit;

  const dateRangeStr = fromDate || toDate ? ` (${fromDate || 'Start'} to ${toDate || 'Present'})` : '';

  const text = `*BUSSY BEE - ACCOUNT STATEMENT* 📊
----------------------------------------
*Customer:* ${customerName}${dateRangeStr}
*Total Transactions:* ${accountDetails.length}
----------------------------------------
*Total Debit (Bills):* ₹${totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
*Total Credit (Received):* ₹${totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
*NET BALANCE:* ₹${netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${netBalance > 0 ? '(Due)' : netBalance < 0 ? '(Advance)' : '(Settled)'}
----------------------------------------
_Generated on ${new Date().toLocaleDateString('en-GB')}_
*Bussy Bee*`;

  const rangeLabel = fromDate || toDate ? `${fromDate || ''} - ${toDate || ''}` : undefined;
  const html = generateLedgerStatementHtml(customerName, accountDetails, rangeLabel);
  await shareToWhatsApp({
    title: `Account Statement - ${customerName}`,
    text,
    fileName: `Ledger-${customerName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone,
  });
};

/**
 * 3. Share Particulars Statement / List on WhatsApp
 */
export const shareParticularsListOnWhatsApp = async (
  customerName: string,
  particularDetails: any[],
  fromDate?: string,
  toDate?: string,
  phone?: string
) => {
  const totalAmount = particularDetails.reduce(
    (sum, r) => sum + (parseFloat(String(r.total || r.amount).replace(/,/g, '')) || 0),
    0
  );
  const totalCases = particularDetails.reduce(
    (sum, r) => sum + (parseFloat(String(r.caseCount).replace(/,/g, '')) || 0),
    0
  );

  const text = `*BUSSY BEE - PARTICULAR BILLS STATEMENT* 📋
----------------------------------------
*Customer:* ${customerName}
*Total Bills:* ${particularDetails.length}
*Total Cases:* ${totalCases}
*Total Billed Amount:* ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
----------------------------------------
_Generated on ${new Date().toLocaleDateString('en-GB')}_
*Bussy Bee*`;

  const rangeLabel = fromDate || toDate ? `${fromDate || ''} - ${toDate || ''}` : undefined;
  const html = generateParticularsListPrintHtml(particularDetails, rangeLabel);
  await shareToWhatsApp({
    title: `Particulars List - ${customerName}`,
    text,
    fileName: `Particulars-${customerName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone,
  });
};

/**
 * 4. Share Customer List / Master Report on WhatsApp
 */
export const shareCustomerListOnWhatsApp = async (
  customers: any[],
  reportTitle: string = 'Customers Master Report',
  fromDate?: string,
  toDate?: string,
  phone?: string
) => {
  const totalCustomers = customers.length;
  const totalDebit = customers.reduce((acc, c) => acc + (parseFloat(c.totalDebit) || 0), 0);
  const totalCredit = customers.reduce((acc, c) => acc + (parseFloat(c.totalCredit) || 0), 0);
  const totalDue = customers.reduce((acc, c) => acc + (parseFloat(c.pendingDue) || 0), 0);

  const text = `*BUSSY BEE - CUSTOMERS MASTER REPORT* 👥
----------------------------------------
*Title:* ${reportTitle}
*Total Customers:* ${totalCustomers}
*Total Purchases (Debit):* ₹${totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
*Total Received (Credit):* ₹${totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
*Total Pending Due:* ₹${totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
----------------------------------------
_Generated on ${new Date().toLocaleDateString('en-GB')}_
*Bussy Bee*`;

  const rangeLabel = fromDate || toDate ? `${fromDate || ''} - ${toDate || ''}` : undefined;
  const html = generateCustomerListPrintHtml(customers, reportTitle, rangeLabel);
  await shareToWhatsApp({
    title: reportTitle,
    text,
    fileName: `Customers-Report-${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone,
  });
};
