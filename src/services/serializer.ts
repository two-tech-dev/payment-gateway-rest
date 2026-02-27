import type {
    InvoiceDocument,
    InvoiceLean,
    InvoiceStatus,
    PaymentMethod,
    TransactionSnapshot,
} from "../models/Invoice";
import { PAYMENT_METHODS } from "../models/Invoice";

export type InvoicePayload = {
    invoiceId: number;
    memoCode: string;
    siteUrl: string;
    siteOrigin: string;
    amount: number;
    currency: string;
    paymentMethods: PaymentMethod[];
    description?: string;
    status: InvoiceStatus;
    webhookUrl?: string;
    transactionSnapshot?: TransactionSnapshot;
    expiresAt: Date;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};

function extractPlainInvoice(
    invoice: InvoiceDocument | InvoiceLean,
): InvoiceLean {
    if (typeof (invoice as InvoiceDocument).toJSON === "function") {
        return (invoice as InvoiceDocument).toJSON() as InvoiceLean;
    }

    return invoice as InvoiceLean;
}

export function toInvoicePayload(
    invoice: InvoiceDocument | InvoiceLean,
): InvoicePayload {
    const plain = extractPlainInvoice(invoice);

    return {
        invoiceId: plain.invoiceId,
        memoCode: plain.memoCode,
        siteUrl: plain.siteUrl,
        siteOrigin: plain.siteOrigin,
        amount: plain.amount,
        currency: plain.currency,
        paymentMethods:
            plain.paymentMethods && plain.paymentMethods.length > 0
                ? plain.paymentMethods
                : [...PAYMENT_METHODS],
        description: plain.description,
        status: plain.status,
        webhookUrl: plain.webhookUrl,
        transactionSnapshot: plain.transactionSnapshot,
        expiresAt: plain.expiresAt,
        completedAt: plain.completedAt,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    };
}
