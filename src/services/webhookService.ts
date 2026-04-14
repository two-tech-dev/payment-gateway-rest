import crypto from "crypto";
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

    const body = JSON.stringify({ event, invoice: payload });
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // HMAC-SHA256 signature: sign "timestamp.body" using per-invoice verifySecret
    const hash = crypto
        .createHmac("sha256", invoice.verifySecret)
        .update(`${timestamp}.${body}`)
        .digest("hex");
    const signature = `t=${timestamp},v1=${hash}`;

    try {
        await axios.post(payload.webhookUrl, JSON.parse(body), {
            timeout: 8000,
            headers: {
                "Content-Type": "application/json",
                "X-2Tech-Signature": signature,
            },
        });
    } catch (error) {
        logger?.error({ err: error }, "Gửi webhook hóa đơn thất bại");
    }
}
