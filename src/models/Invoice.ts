import { Schema, model, type Document, Types } from "mongoose";
import gatewayConfig from "../config/gatewayConfig";

export type InvoiceStatus = "pending" | "completed" | "failed" | "expired";
export type PaymentMethod = string;

export const INVOICE_EXPIRY_MINUTES = 15;

export interface TransactionSnapshot {
    transactionID?: string;
    amount?: number;
    description?: string;
    transactionDate?: string;
    type?: string;
    paymentMethod?: PaymentMethod;
}

export interface Invoice {
    userId: Types.ObjectId;
    invoiceId: number;
    memoCode: string;
    amount: number;
    currency: string;
    verifySecret: string;
    paymentMethods: PaymentMethod[];
    description?: string;
    status: InvoiceStatus;
    webhookUrl?: string;
    transactionSnapshot?: TransactionSnapshot;
    expiresAt: Date;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    isDepositProcessed?: boolean;
}

export interface InvoiceDocument extends Invoice, Document {}

export type InvoiceLean = Omit<InvoiceDocument, keyof Document>;

const invoiceSchema = new Schema<InvoiceDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        invoiceId: { type: Number, unique: true, required: true },
        memoCode: { type: String, unique: true, required: true },
        amount: { type: Number, required: true },
        currency: {
            type: String,
            default: (gatewayConfig.defaultCurrency || "VND").toUpperCase(),
        },
        verifySecret: { type: String, required: true },
        paymentMethods: {
            type: [
                {
                    type: String,
                },
            ],
            required: true,
            default: () => [],
        },
        description: { type: String },
        status: {
            type: String,
            enum: ["pending", "completed", "failed", "expired"],
            default: "pending",
        },
        expiresAt: { type: Date, required: true },
        webhookUrl: { type: String },
        transactionSnapshot: {
            transactionID: { type: String },
            amount: { type: Number },
            description: { type: String },
            transactionDate: { type: String },
            type: { type: String },
        },
        completedAt: { type: Date },
        isDepositProcessed: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    },
);

invoiceSchema.index({ status: 1, invoiceId: 1 });

export const InvoiceModel = model<InvoiceDocument>("Invoice", invoiceSchema);
