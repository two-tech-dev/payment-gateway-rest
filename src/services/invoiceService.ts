import gatewayConfig from "../config/gatewayConfig";
import { env } from "../config/env";
import {
    InvoiceModel,
    INVOICE_EXPIRY_MINUTES,
    PAYMENT_METHODS,
    type PaymentMethod,
    type InvoiceDocument,
    type InvoiceLean,
} from "../models/Invoice";
import { getNextSequence } from "../models/Counter";
import { normalizeSiteOrigin } from "../utils/siteGuard";

export type CreateInvoiceDto = {
    amount: number;
    currency?: string;
    siteUrl: string;
    paymentMethods?: PaymentMethod[];
    description?: string;
    webhookUrl?: string;
};

function normalizePaymentMethods(
    paymentMethods?: PaymentMethod[],
): PaymentMethod[] {
    if (!paymentMethods || paymentMethods.length === 0) {
        return [...PAYMENT_METHODS];
    }

    const allowed = new Set<PaymentMethod>(PAYMENT_METHODS);
    const unique = new Set<PaymentMethod>();

    for (const method of paymentMethods) {
        if (allowed.has(method)) {
            unique.add(method);
        }
    }

    return unique.size > 0 ? Array.from(unique) : [...PAYMENT_METHODS];
}

export async function createInvoice(
    dto: CreateInvoiceDto,
): Promise<InvoiceDocument> {
    const siteOrigin = normalizeSiteOrigin(dto.siteUrl);

    if (!siteOrigin) {
        throw new Error("siteUrl khong hop le");
    }

    const invoiceId = await getNextSequence("invoice");
    const memoCode = `${env.memoPrefix}${invoiceId}`;

    const currency = (
        dto.currency ||
        gatewayConfig.defaultCurrency ||
        "VND"
    ).toUpperCase();
    const paymentMethods = normalizePaymentMethods(dto.paymentMethods);

    const expiresAt = new Date(Date.now() + INVOICE_EXPIRY_MINUTES * 60 * 1000);

    const invoice = await InvoiceModel.create({
        invoiceId,
        memoCode,
        siteUrl: dto.siteUrl,
        siteOrigin,
        amount: dto.amount,
        currency,
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
