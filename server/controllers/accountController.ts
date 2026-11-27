import type { Request, Response, NextFunction } from 'express';
import { AccountLedger } from '../models/AccountLedger';
import { Particular } from '../models/Particular';
import { Customer } from '../models/Customer';
import { escapeRegex, recalculateCustomerBalance, parseDateToTimestamp } from '../utils/ledgerUtils';

export const getAccountDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerName } = req.query;
    const filter: any = {};
    if (customerName && typeof customerName === 'string' && customerName.trim() !== '' && customerName.toLowerCase() !== 'all') {
      filter.customerName = { $regex: new RegExp(`^${escapeRegex(customerName.trim())}$`, 'i') };
    }

    const accounts: any[] = await AccountLedger.find(filter).lean();

    // Populate customer addresses from Customer model
    const customerNames = Array.from(new Set(accounts.map((a: any) => a.customerName).filter(Boolean)));
    const customers = await Customer.find({ name: { $in: customerNames } }, 'name address').lean();
    const customerAddressMap = new Map<string, string>();
    customers.forEach((c: any) => {
      if (c.name && c.address) customerAddressMap.set(c.name.toLowerCase().trim(), c.address);
    });

    // Populate product names and bill addresses for BILL entries if missing
    const billEntries = accounts.filter((a: any) => a.type === 'BILL' || a.particularId || a.billNo);
    if (billEntries.length > 0) {
      const partIds = billEntries.map((a: any) => a.particularId).filter(Boolean);
      const billNos = billEntries.map((a: any) => a.billNo).filter(Boolean);
      
      const orConditions: any[] = [];
      if (partIds.length > 0) orConditions.push({ _id: { $in: partIds } });
      if (billNos.length > 0) orConditions.push({ billNo: { $in: billNos } });

      if (orConditions.length > 0) {
        const matchingParticulars = await Particular.find({ $or: orConditions }, 'billNo products customerAddress').lean();
        const partMapById = new Map<string, string>();
        const partMapByBill = new Map<string, string>();
        const partAddrById = new Map<string, string>();
        const partAddrByBill = new Map<string, string>();

        matchingParticulars.forEach((p: any) => {
          const prodStr = (p.products || []).map((x: any) => x.particular).filter(Boolean).join(', ');
          if (p._id) {
            partMapById.set(String(p._id), prodStr);
            if (p.customerAddress) partAddrById.set(String(p._id), p.customerAddress);
          }
          if (p.billNo) {
            partMapByBill.set(String(p.billNo).trim(), prodStr);
            if (p.customerAddress) partAddrByBill.set(String(p.billNo).trim(), p.customerAddress);
          }
        });

        accounts.forEach((a: any) => {
          if (!a.productName || a.productName === '-' || a.productName === 'General') {
            const pFromId = a.particularId ? partMapById.get(String(a.particularId)) : '';
            const pFromBill = a.billNo ? partMapByBill.get(String(a.billNo).trim()) : '';
            const prods = pFromId || pFromBill;
            if (prods) {
              a.productName = prods;
              a.companyName = prods;
            }
          }
          const addrFromPart = (a.particularId ? partAddrById.get(String(a.particularId)) : '') || (a.billNo ? partAddrByBill.get(String(a.billNo).trim()) : '');
          const addrFromCust = a.customerName ? customerAddressMap.get(a.customerName.toLowerCase().trim()) : '';
          a.address = a.address || addrFromPart || addrFromCust || '';
        });
      }
    } else {
      accounts.forEach((a: any) => {
        const addrFromCust = a.customerName ? customerAddressMap.get(a.customerName.toLowerCase().trim()) : '';
        a.address = a.address || addrFromCust || '';
      });
    }

    // Sort date-wise descending (today's / newest date first, previous dates below)
    accounts.sort((a: any, b: any) => {
      const timeA = parseDateToTimestamp(a.date) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = parseDateToTimestamp(b.date) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      if (timeB !== timeA) return timeB - timeA;
      const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return cB - cA;
    });

    res.status(200).json({ success: true, count: accounts.length, data: accounts });
  } catch (error) {
    next(error);
  }
};

export const addCredit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerName, companyName, creditAmount, date, paymentMode, paymentType, transferredTo, reference, notes } = req.body;

    const parsedCredit = parseFloat(String(creditAmount).replace(/,/g, '')) || 0;
    if (parsedCredit <= 0) {
      res.status(400).json({ success: false, error: 'Valid credit amount greater than 0 is required' });
      return;
    }

    const finalCustomerName = (customerName || 'General').trim();
    const finalPaymentType = paymentType || paymentMode || 'Cash';
    const finalTransferredTo = transferredTo ? String(transferredTo).trim() : '';
    const noteDetails = [
      finalPaymentType ? `Payment: ${finalPaymentType}` : '',
      finalTransferredTo ? `A/C: ${finalTransferredTo}` : '',
      notes ? String(notes).trim() : '',
    ].filter(Boolean).join(' | ');

    const ledgerEntry = await AccountLedger.create({
      billNo: reference ? String(reference).trim() : '',
      customerName: finalCustomerName,
      companyName: companyName ? String(companyName).trim() : (finalTransferredTo || 'General'),
      date: date || new Date().toISOString().split('T')[0],
      debit: '0.00',
      credit: parsedCredit.toFixed(2),
      balance: '0.00',
      paymentMode: finalPaymentType,
      paymentType: finalPaymentType,
      transferredTo: finalTransferredTo,
      reference: reference ? String(reference).trim() : '',
      notes: noteDetails || 'Payment / Credit received',
      type: 'CREDIT',
    });

    await recalculateCustomerBalance(finalCustomerName);

    res.status(201).json({
      success: true,
      message: 'Credit added successfully',
      data: ledgerEntry,
    });
  } catch (error: any) {
    console.error('[Add Credit Error]:', error);
    res.status(400).json({ success: false, error: error?.message || 'Failed to add credit' });
  }
};

export const deleteAccountEntry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const entry = await AccountLedger.findById(req.params.id);
    if (!entry) {
      res.status(404).json({ success: false, error: 'Account ledger entry not found' });
      return;
    }

    const customerName = entry.customerName;

    // If this entry was created from a particular bill, delete the corresponding particular bill as well
    const { Particular } = await import('../models/Particular');
    if (entry.particularId) {
      await Particular.findByIdAndDelete(entry.particularId);
    } else if (entry.billNo && entry.billNo.trim() !== '' && entry.type === 'BILL') {
      await Particular.findOneAndDelete({ billNo: entry.billNo.trim() });
    } else if (entry.type === 'BILL') {
      const matchCond: any = {
        customerName: { $regex: new RegExp(`^${escapeRegex(entry.customerName.trim())}$`, 'i') },
        date: entry.date,
      };
      if (entry.companyName && entry.companyName.trim() !== '') {
        matchCond.companyName = { $regex: new RegExp(`^${escapeRegex(entry.companyName.trim())}$`, 'i') };
      }
      await Particular.findOneAndDelete(matchCond);
    }

    await AccountLedger.findByIdAndDelete(req.params.id);

    // Recalculate running balances for this customer
    await recalculateCustomerBalance(customerName);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
