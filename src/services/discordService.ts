import axios from "axios";
import type { FastifyBaseLogger } from "fastify";
import { env } from "../config/env";
import type { InvoiceDocument, InvoiceLean } from "../models/Invoice";
import { toInvoicePayload } from "./serializer";

export async function notifyInvoiceCreated(
    invoice: InvoiceDocument | InvoiceLean,
    logger?: FastifyBaseLogger,
): Promise<void> {
    if (!env.discordWebhookUrl) {
        logger?.warn(
            "DISCORD_WEBHOOK_URL chua duoc cau hinh; bo qua thong bao Discord.",
        );
        return;
    }

    const payload = toInvoicePayload(invoice);

    const message = {
        username: "Hyper Tech Payment",
        embeds: [
            {
                title: "Co hoa don moi",
                color: 0x5865f2,
                fields: [
                    {
                        name: "Ma hoa don",
                        value: `#${payload.invoiceId}`,
                        inline: true,
                    },
                    { name: "Ma memo", value: payload.memoCode, inline: true },
                    {
                        name: "So tien",
                        value: `${payload.amount} ${payload.currency}`,
                        inline: true,
                    },
                    { name: "Trang", value: payload.siteOrigin, inline: false },
                    {
                        name: "Trang thai",
                        value: payload.status,
                        inline: true,
                    },
                ],
                timestamp: payload.createdAt.toISOString(),
            },
        ],
    };

    try {
        await axios.post(env.discordWebhookUrl, message, { timeout: 5000 });
    } catch (error) {
        logger?.error({ err: error }, "Gửi thông báo Discord thất bại");
    }
}
