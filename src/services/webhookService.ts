import crypto from "crypto";
import axios from "axios";
import type { FastifyBaseLogger } from "fastify";
import type { InvoiceDocument, InvoiceLean } from "../models/Invoice";
import { toInvoicePayload } from "./serializer";
import { getSettings } from "../models/Settings";

export async function notifyInvoiceWebhook(
    invoice: InvoiceDocument | InvoiceLean,
    event: "invoice.completed",
    logger?: FastifyBaseLogger,
): Promise<void> {
    const payload = toInvoicePayload(invoice);

    if (!payload.webhookUrl) {
        return;
    }

    const settings = await getSettings();
    const body = JSON.stringify({ event, invoice: payload });
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // HMAC-SHA256 signature: sign "timestamp.body" to prevent replay attacks
    const signature =
        "sha256=" +
        crypto
            .createHmac("sha256", settings.webhookSecret)
            .update(`${timestamp}.${body}`)
            .digest("hex");

    try {
        await axios.post(payload.webhookUrl, JSON.parse(body), {
            timeout: 8000,
            headers: {
                "Content-Type": "application/json",
                "X-Webhook-Signature": signature,
                "X-Webhook-Timestamp": timestamp,
            },
        });
    } catch (error) {
        logger?.error({ err: error }, "Gui webhook hoa don that bai");
    }
}
