import crypto from "crypto";
import gatewayConfig from "../config/gatewayConfig";
import { env } from "../config/env";
import {
    InvoiceModel,
    INVOICE_EXPIRY_MINUTES,
    type PaymentMethod,
    type InvoiceDocument,
    type InvoiceLean,
} from "../models/Invoice";
import { getNextSequence } from "../models/Counter";

export type CreateInvoiceDto = {
    userId: string;
    amount: number;
    currency?: string;
    memoCode?: string;
    paymentMethods: string[];
    description?: string;
    webhookUrl?: string;
};

function normalizePaymentMethods(
    paymentMethods: string[],
): string[] {
    if (!paymentMethods || paymentMethods.length === 0) {
        return [];
    }

    const unique = new Set<string>(paymentMethods);
    return Array.from(unique);
}

export async function createInvoice(
    dto: CreateInvoiceDto,
): Promise<InvoiceDocument> {
    const invoiceId = await getNextSequence("invoice");
    const memoCode = dto.memoCode || `${env.memoPrefix}${invoiceId}`;

    const currency = (
        dto.currency ||
        gatewayConfig.defaultCurrency ||
        "VND"
    ).toUpperCase();
    const paymentMethods = normalizePaymentMethods(dto.paymentMethods);
    const verifySecret = crypto.randomBytes(16).toString("hex");

    const expiresAt = new Date(Date.now() + INVOICE_EXPIRY_MINUTES * 60 * 1000);

    const invoice = await InvoiceModel.create({
        userId: dto.userId,
        invoiceId,
        memoCode,
        amount: dto.amount,
        currency,
        verifySecret,
        paymentMethods,
        description: dto.description,
        webhookUrl: dto.webhookUrl,
        expiresAt,
    });

    return invoice;
}

export function getInvoiceById(invoiceId: number): Promise<InvoiceLean | null> {
    return InvoiceModel.findOne({ invoiceId }).lean();
}

export function isInvoiceExpired(invoice: InvoiceLean): boolean {
    return (
        invoice.status === "pending" && new Date() > new Date(invoice.expiresAt)
    );
}

export async function markExpiredInvoices(): Promise<number> {
    const result = await InvoiceModel.updateMany(
        {
            status: "pending",
            expiresAt: { $lt: new Date() },
        },
        {
            $set: { status: "expired" },
        },
    );
    return result.modifiedCount;
}
