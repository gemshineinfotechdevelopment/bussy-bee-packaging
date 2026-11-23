import mongoose, { Schema, Document } from 'mongoose';

export interface IParticularProductItem {
  particular: string;
  hsn?: string;
  quantity: string;
  rate: string;
  pktUnit: string;
  amount: string;
}

export interface IParticular extends Document {
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  customerGst?: string;
  caseCount: string;
  companyName?: string;
  companyAddress?: string;
  companyGst?: string;
  companyPhone?: string;
  traderName?: string;
  traderAddress?: string;
  traderGst?: string;
  discount: string;
  transport: string;
  packing: string;
  billNo: string;
  tax: string;
  amount: string;
  total: string;
  date: string;
  pdfData?: string;
  pdfName?: string;
  pdfPublicId?: string;
  products: IParticularProductItem[];
  createdAt: Date;
  updatedAt: Date;
}

const ParticularProductItemSchema: Schema = new Schema({
  particular: { type: String, required: true },
  hsn: { type: String, default: '' },
  quantity: { type: String, default: '' },
  rate: { type: String, default: '' },
  pktUnit: { type: String, default: '' },
  amount: { type: String, default: '' },
});

const ParticularSchema: Schema = new Schema(
  {
    customerName: { type: String, required: true, trim: true },
    customerAddress: { type: String, default: '', trim: true },
    customerPhone: { type: String, default: '', trim: true },
    customerGst: { type: String, default: '', trim: true },
    caseCount: { type: String, default: '0' },
    companyName: { type: String, default: '', trim: true },
    companyAddress: { type: String, default: '', trim: true },
    companyGst: { type: String, default: '', trim: true },
    companyPhone: { type: String, default: '', trim: true },
    traderName: { type: String, default: '', trim: true },
    traderAddress: { type: String, default: '', trim: true },
    traderGst: { type: String, default: '', trim: true },
    discount: { type: String, default: '' },
    transport: { type: String, default: '' },
    packing: { type: String, default: '' },
    billNo: { type: String, required: true, trim: true },
    tax: { type: String, default: '' },
    amount: { type: String, default: '0.00' },
    total: { type: String, default: '0.00' },
    date: { type: String, required: true },
    pdfData: { type: String, default: '' },
    pdfName: { type: String, default: '' },
    pdfPublicId: { type: String, default: '' },
    products: [ParticularProductItemSchema],
  },
  { timestamps: true }
);

export const Particular = mongoose.model<IParticular>('Particular', ParticularSchema);
