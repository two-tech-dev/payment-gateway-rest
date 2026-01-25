import { Schema, model, type Document } from "mongoose";
import gatewayConfig from "../config/gatewayConfig";

export type InvoiceStatus = "pending" | "completed" | "failed";

export interface TransactionSnapshot {
    transactionID?: string;
    amount?: number;
    description?: string;
    transactionDate?: string;
    type?: string;
}

export interface Invoice {
    invoiceId: number;
    memoCode: string;
    siteUrl: string;
    siteOrigin: string;
    amount: number;
    currency: string;
    description?: string;
    status: InvoiceStatus;
    webhookUrl?: string;
    transactionSnapshot?: TransactionSnapshot;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface InvoiceDocument extends Invoice, Document {}

export type InvoiceLean = Omit<InvoiceDocument, keyof Document>;

const invoiceSchema = new Schema<InvoiceDocument>(
    {
        invoiceId: { type: Number, unique: true, required: true },
        memoCode: { type: String, unique: true, required: true },
        siteUrl: { type: String, required: true },
        siteOrigin: { type: String, required: true },
        amount: { type: Number, required: true },
        currency: {
            type: String,
            default: (gatewayConfig.defaultCurrency || "VND").toUpperCase(),
        },
        description: { type: String },
        status: {
            type: String,
            enum: ["pending", "completed", "failed"],
            default: "pending",
        },
        webhookUrl: { type: String },
        transactionSnapshot: {
            transactionID: { type: String },
            amount: { type: Number },
            description: { type: String },
            transactionDate: { type: String },
            type: { type: String },
        },
        completedAt: { type: Date },
    },
    {
        timestamps: true,
    },
);

invoiceSchema.index({ status: 1, invoiceId: 1 });

export const InvoiceModel = model<InvoiceDocument>("Invoice", invoiceSchema);
