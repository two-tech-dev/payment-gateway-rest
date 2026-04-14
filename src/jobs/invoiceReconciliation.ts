import axios from "axios";
import cron from "node-cron";
import type { FastifyBaseLogger } from "fastify";
import { env } from "../config/env";
import { InvoiceModel } from "../models/Invoice";
import { UserBankApiModel, type UserBankApiDocument } from "../models/UserBankApi";
import { UserModel } from "../models/User";
import { markExpiredInvoices } from "../services/invoiceService";
import { notifyInvoiceWebhook } from "../services/webhookService";

// ──────────────────────────────────────────────
// Types matching 2TECH-Gateway API response
// ──────────────────────────────────────────────
interface GatewayTransaction {
    transaction_date: string;
    credit_amount: number;
    debit_amount: number;
    description: string;
}

interface GatewayTransactionsResponse {
    account_number: string;
    from_date: string;
    to_date: string;
    total: number;
    transactions: GatewayTransaction[];
}

// ──────────────────────────────────────────────
// Fetch transactions from 2TECH-Gateway for a specific bank account
// ──────────────────────────────────────────────
async function fetchGatewayTransactions(
    bankConfig: UserBankApiDocument,
    logger?: FastifyBaseLogger,
): Promise<GatewayTransaction[]> {
    const baseUrl = env.gatewayApiBaseUrl || "https://api.2tech.studio";
    const prefix = env.gatewayApiPrefix || "/api/v1";

    // Query today's transactions
    const today = new Date();
    const fromDate = formatDateParam(today);
    const toDate = fromDate;

    const url = `${baseUrl}${prefix}/bank/${bankConfig.bankCode}/transactions?from_date=${fromDate}&to_date=${toDate}`;

    try {
        const response = await axios.get<GatewayTransactionsResponse>(url, {
            timeout: 15000,
            headers: {
                Authorization: `Bearer ${bankConfig.gatewayJwtToken}`,
            },
        });

        return Array.isArray(response.data?.transactions)
            ? response.data.transactions
            : [];
    } catch (error) {
        logger?.warn(
            { err: error, bankId: bankConfig._id, bankCode: bankConfig.bankCode },
            "Lấy giao dịch từ Gateway thất bại"
        );
        return [];
    }
}

// ──────────────────────────────────────────────
// Format date as YYYY-MM-DD for Gateway API
// ──────────────────────────────────────────────
function formatDateParam(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
}

// ──────────────────────────────────────────────
// Try to find memoCode inside a transaction description
// ──────────────────────────────────────────────
function extractMemoCode(description: string, memoCode: string): boolean {
    if (!description || !memoCode) return false;
    // Case-insensitive check: description contains the memoCode
    return description.toUpperCase().includes(memoCode.toUpperCase());
}

// ──────────────────────────────────────────────
// Main reconciliation job
// ──────────────────────────────────────────────
export function startInvoiceReconciliationJob(logger: FastifyBaseLogger): void {
    cron.schedule(
        "*/30 * * * * *",
        async () => {
            try {
                // 1. Mark expired invoices
                const expiredCount = await markExpiredInvoices();
                if (expiredCount > 0) {
                    logger.info(`Đã đánh dấu ${expiredCount} hóa đơn hết hạn`);
                }

                // 2. Get all pending invoices (not expired)
                const pendingInvoices = await InvoiceModel.find({
                    status: "pending",
                    expiresAt: { $gt: new Date() },
                }).lean();

                if (pendingInvoices.length === 0) return;

                // 3. Collect all unique Bank IDs referenced in pending invoices
                const allBankIds = new Set<string>();
                for (const inv of pendingInvoices) {
                    for (const bankId of inv.paymentMethods) {
                        allBankIds.add(bankId.toString());
                    }
                }

                if (allBankIds.size === 0) return;

                // 4. Load all referenced bank configs
                const dbBankIds = Array.from(allBankIds).filter(id => id !== "system_env_bank");
                const bankConfigs: any[] = await UserBankApiModel.find({
                    _id: { $in: dbBankIds },
                }); // No .lean() because we need Mongoose getters to decrypt gatewayJwtToken!

                // If system_env_bank is needed, add its virtual config
                if (allBankIds.has("system_env_bank") && env.depositBankCode && env.depositGatewayJwt) {
                    bankConfigs.push({
                        _id: "system_env_bank",
                        bankCode: env.depositBankCode,
                        gatewayJwtToken: env.depositGatewayJwt,
                    });
                }

                // 5. Fetch transactions per bank config and reconcile
                for (const bankConfig of bankConfigs) {
                    const bankIdStr = bankConfig._id.toString();

                    try {
                        const transactions = await fetchGatewayTransactions(bankConfig as UserBankApiDocument, logger);

                        if (transactions.length === 0) continue;

                        // Filter only incoming (credit) transactions
                        const creditTxns = transactions.filter(tx => tx.credit_amount > 0);

                        // Find matching pending invoices for this bank
                        const matchingInvoices = pendingInvoices.filter(inv =>
                            inv.paymentMethods.some(pm => pm.toString() === bankIdStr),
                        );

                        for (const tx of creditTxns) {
                            for (const invoice of matchingInvoices) {
                                // Skip already processed
                                if (invoice.status !== "pending") continue;

                                // Match by memoCode in transaction description
                                if (!extractMemoCode(tx.description, invoice.memoCode)) {
                                    continue;
                                }

                                // Verify amount >= invoice amount
                                if (tx.credit_amount < invoice.amount) {
                                    continue;
                                }

                                // ✅ Match found — mark as completed
                                const updated = await InvoiceModel.findOneAndUpdate(
                                    {
                                        _id: invoice._id,
                                        status: "pending",
                                    },
                                    {
                                        $set: {
                                            status: "completed",
                                            completedAt: new Date(),
                                            transactionSnapshot: {
                                                transactionID: `${bankConfig.bankCode}_${tx.transaction_date}_${tx.credit_amount}`,
                                                amount: tx.credit_amount,
                                                description: tx.description,
                                                transactionDate: tx.transaction_date,
                                                type: "IN",
                                                paymentMethod: bankIdStr,
                                            },
                                        },
                                    },
                                    { new: true },
                                );

                                if (updated) {
                                    logger.info(
                                        { invoiceId: invoice.invoiceId, bankCode: bankConfig.bankCode },
                                        "Hóa đơn hoàn tất đối soát",
                                    );

                                    // Mark local reference as completed to prevent double match
                                    (invoice as any).status = "completed";

                                    // Notify webhook
                                    await notifyInvoiceWebhook(updated, "invoice.completed", logger);
                                }

                                break; // One tx matches one invoice, move to next tx
                            }
                        }
                    } catch (error) {
                        logger.error(
                            { err: error, bankId: bankIdStr, bankCode: bankConfig.bankCode },
                            "Đối soát giao dịch cho bank config thất bại",
                        );
                    }
                }
            } catch (error) {
                logger.error({ err: error }, "Cron đối soát hóa đơn gặp lỗi");
            }
        },
        {
            timezone: "Asia/Ho_Chi_Minh",
        },
    );

    logger.info("Đã lên lịch cron đối soát hóa đơn (*/30 * * * * *).");
}
