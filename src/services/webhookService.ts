import axios from "axios";
import type { FastifyBaseLogger } from "fastify";
import type { InvoiceDocument, InvoiceLean } from "../models/Invoice";
import { toInvoicePayload } from "./serializer";

export async function notifyInvoiceWebhook(
    invoice: InvoiceDocument | InvoiceLean,
    event: "invoice.completed",
    logger?: FastifyBaseLogger,
): Promise<void> {
    const payload = toInvoicePayload(invoice);

    if (!payload.webhookUrl) {
        return;
    }

    try {
        await axios.post(
            payload.webhookUrl,
            {
                event,
                invoice: payload,
            },
            { timeout: 8000 },
        );
    } catch (error) {
        logger?.error({ err: error }, "Gui webhook hoa don that bai");
    }
}
