import axios from "axios";
import cron from "node-cron";
import type { FastifyBaseLogger } from "fastify";
import { env } from "../config/env";
import { type PaymentMethod, InvoiceModel } from "../models/Invoice";
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

interface HistorySourceConfig {
    paymentMethod: PaymentMethod;
    apiUrl: string;
    headers?: Record<string, string>;
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

function getHistorySourceConfigs(): HistorySourceConfig[] {
    const sources: HistorySourceConfig[] = [];

    if (env.historyApiMbToken) {
        sources.push({
            paymentMethod: "mbbank",
            apiUrl: `https://api.sieuthicode.net/historyapimbbankv2/${env.historyApiMbToken}`,
        });
    }

    if (env.historyApiVcbToken) {
        const headers: Record<string, string> = {};
        if (env.historyApiVcbToken) {
            headers["x-api-key"] = env.historyApiVcbToken;
        }

        sources.push({
            paymentMethod: "vietcombank",
            apiUrl: `https://api.sieuthicode.net/historyapivcbv2/${env.historyApiVcbToken}`,
            headers: Object.keys(headers).length > 0 ? headers : undefined,
        });
    }

    return sources;
}

async function fetchTransactions(
    source: HistorySourceConfig,
): Promise<RemoteTransaction[]> {
    const response = await axios.get(source.apiUrl, {
        timeout: 10000,
        headers: source.headers,
    });

    return Array.isArray(response.data?.transactions)
        ? (response.data.transactions as RemoteTransaction[])
        : [];
}

export function startInvoiceReconciliationJob(logger: FastifyBaseLogger): void {
    const sources = getHistorySourceConfigs();

    if (!sources.length) {
        logger.warn(
            "Chua cau hinh token history API cho MBBank/Vietcombank; tam tat cron doi soat.",
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

                for (const source of sources) {
                    try {
                        const transactions = await fetchTransactions(source);

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
                                $or: [
                                    { paymentMethods: source.paymentMethod },
                                    { paymentMethods: { $exists: false } },
                                ],
                            });

                            if (!invoice) {
                                continue;
                            }

                            const amountValue = normalizeAmount(
                                transaction.amount,
                            );

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
                                paymentMethod: source.paymentMethod,
                            };

                            await invoice.save();
                            await notifyInvoiceWebhook(
                                invoice,
                                "invoice.completed",
                                logger,
                            );
                        }
                    } catch (error) {
                        logger.error(
                            { err: error, paymentMethod: source.paymentMethod },
                            "Lay lich su giao dich that bai",
                        );
                    }
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
