import axios from "axios";
import cron from "node-cron";
import type { FastifyBaseLogger } from "fastify";
import { env } from "../config/env";
import { InvoiceModel } from "../models/Invoice";
import { notifyInvoiceWebhook } from "../services/webhookService";
import { parseOrderId } from "../utils/orderId";

interface RemoteTransaction {
    transactionID?: string;
    amount?: number;
    description?: string;
    transactionDate?: string;
    type?: string;
}

export function startInvoiceReconciliationJob(logger: FastifyBaseLogger): void {
    if (!env.historyApiToken) {
        logger.warn(
            "HISTORY_API_TOKEN chua duoc cau hinh; tam tat cron doi soat.",
        );
        return;
    }

    cron.schedule(
        "*/2 * * * *",
        async () => {
            try {
                const apiUrl = `https://api.sieuthicode.net/historyapiviettinv2/${env.historyApiToken}`;
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
                    });

                    if (!invoice) {
                        continue;
                    }

                    if (
                        typeof transaction.amount === "number" &&
                        transaction.amount < invoice.amount
                    ) {
                        continue;
                    }

                    invoice.status = "completed";
                    invoice.completedAt = new Date();
                    invoice.transactionSnapshot = {
                        transactionID: transaction.transactionID,
                        amount: transaction.amount,
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

    logger.info("Da len lich cron doi soat hoa don (*/2 * * * *).");
}
