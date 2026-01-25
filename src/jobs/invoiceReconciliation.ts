import axios from "axios";
import cron from "node-cron";
import type { FastifyBaseLogger } from "fastify";
import { env } from "../config/env";
import { InvoiceModel } from "../models/Invoice";
import { markExpiredInvoices } from "../services/invoiceService";
import { notifyInvoiceWebhook } from "../services/webhookService";
import { parseOrderId } from "../utils/orderId";

interface RemoteTransaction {
    transactionID?: string;
    amount?: number | string;
    description?: string;
    transactionDate?: string;
    type?: string;
}

function normalizeAmount(value?: number | string): number | undefined {
    if (typeof value === "number") {
        return Number.isNaN(value) ? undefined : value;
    }

    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? undefined : parsed;
    }

    return undefined;
}

export function startInvoiceReconciliationJob(logger: FastifyBaseLogger): void {
    if (!env.historyApiToken) {
        logger.warn(
            "HISTORY_API_TOKEN chua duoc cau hinh; tam tat cron doi soat.",
        );
        return;
    }

    cron.schedule(
        "*/30 * * * * *",
        async () => {
            try {
                // Đánh dấu các invoice đã hết hạn
                const expiredCount = await markExpiredInvoices();
                if (expiredCount > 0) {
                    logger.info(`Da danh dau ${expiredCount} hoa don het han`);
                }

                const apiUrl = `https://api.sieuthicode.net/historyapimbbankv2/${env.historyApiToken}`;
                const response = await axios.get(apiUrl, { timeout: 10000 });
                const transactions = Array.isArray(response.data?.transactions)
                    ? (response.data.transactions as RemoteTransaction[])
                    : [];

                if (!transactions.length) {
                    return;
                }

                for (const transaction of transactions) {
                    if (transaction.type !== "IN") {
                        continue;
                    }

                    const orderId = parseOrderId(
                        transaction.description ?? "",
                        env.memoPrefix,
                    );

                    if (!orderId) {
                        continue;
                    }

                    const invoice = await InvoiceModel.findOne({
                        invoiceId: orderId,
                        status: "pending",
                        expiresAt: { $gt: new Date() },
                    });

                    if (!invoice) {
                        continue;
                    }

                    const amountValue = normalizeAmount(transaction.amount);

                    if (
                        typeof amountValue === "number" &&
                        amountValue < invoice.amount
                    ) {
                        continue;
                    }

                    invoice.status = "completed";
                    invoice.completedAt = new Date();
                    invoice.transactionSnapshot = {
                        transactionID: transaction.transactionID,
                        amount: amountValue,
                        description: transaction.description,
                        transactionDate: transaction.transactionDate,
                        type: transaction.type,
                    };

                    await invoice.save();
                    await notifyInvoiceWebhook(
                        invoice,
                        "invoice.completed",
                        logger,
                    );
                }
            } catch (error) {
                logger.error({ err: error }, "Cron doi soat hoa don gap loi");
            }
        },
        {
            timezone: "Asia/Ho_Chi_Minh",
        },
    );

    logger.info("Da len lich cron doi soat hoa don (*/30 * * * * *).");
}
