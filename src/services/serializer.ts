import type {
    InvoiceDocument,
    InvoiceLean,
    InvoiceStatus,
    TransactionSnapshot,
} from "../models/Invoice";

export type InvoicePayload = {
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
        description: plain.description,
        status: plain.status,
        webhookUrl: plain.webhookUrl,
        transactionSnapshot: plain.transactionSnapshot,
        completedAt: plain.completedAt,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    };
}
