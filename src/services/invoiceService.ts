import gatewayConfig from "../config/gatewayConfig";
import { env } from "../config/env";
import {
    InvoiceModel,
    type InvoiceDocument,
    type InvoiceLean,
} from "../models/Invoice";
import { getNextSequence } from "../models/Counter";
import { normalizeSiteOrigin } from "../utils/siteGuard";

export type CreateInvoiceDto = {
    amount: number;
    currency?: string;
    siteUrl: string;
    description?: string;
    webhookUrl?: string;
};

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

    const invoice = await InvoiceModel.create({
        invoiceId,
        memoCode,
        siteUrl: dto.siteUrl,
        siteOrigin,
        amount: dto.amount,
        currency,
        description: dto.description,
        webhookUrl: dto.webhookUrl,
    });

    return invoice;
}

export function getInvoiceById(invoiceId: number): Promise<InvoiceLean | null> {
    return InvoiceModel.findOne({ invoiceId }).lean();
}
