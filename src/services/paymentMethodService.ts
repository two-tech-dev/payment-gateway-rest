import { UserBankApiModel } from "../models/UserBankApi";
import type { InvoiceLean } from "../models/Invoice";
import { env } from "../config/env";

// Bank code → VietQR bank code mapping
const BANK_CODE_MAP: Record<string, { vietqrCode: string; logo: string }> = {
    mbbank: { vietqrCode: "MB", logo: "https://cdn.vietqr.io/img/MB.png" },
    seabank: { vietqrCode: "SEAB", logo: "https://cdn.vietqr.io/img/SEAB.png" },
    tpbank: { vietqrCode: "TPB", logo: "https://cdn.vietqr.io/img/TPB.png" },
};

export type InvoicePaymentMethodInfo = {
    method: string;
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    logo: string;
    qrCode: string;
};

function buildQrCodeUrl(
    vietqrCode: string,
    accountNumber: string,
    amount: number,
    memoCode: string,
): string {
    const encodedMemoCode = encodeURIComponent(memoCode);
    return `https://img.vietqr.io/image/${vietqrCode}-${accountNumber}-qr_only.png?amount=${amount}&addInfo=${encodedMemoCode}`;
}

export async function getInvoicePaymentMethodInfos(
    invoice: Pick<InvoiceLean, "paymentMethods" | "amount" | "memoCode">,
): Promise<InvoicePaymentMethodInfo[]> {
    const bankIds = invoice.paymentMethods ?? [];

    if (bankIds.length === 0) return [];

    const infos: InvoicePaymentMethodInfo[] = [];
    const dbBankIds: string[] = [];

    // Separate "system_env_bank" from normal DB bank IDs
    for (const id of bankIds) {
        if (id === "system_env_bank") {
            const bankCode = env.depositBankCode || "mbbank";
            const mapping = BANK_CODE_MAP[bankCode] || BANK_CODE_MAP["mbbank"];
            const accountNumber = env.depositAccountNumber || "";
            const accountName = env.depositAccountName || bankCode.toUpperCase();

            infos.push({
                method: "system_env_bank",
                bankCode: mapping.vietqrCode,
                bankName: bankCode.toUpperCase(),
                accountNumber,
                accountName,
                logo: mapping.logo,
                qrCode: buildQrCodeUrl(
                    mapping.vietqrCode,
                    accountNumber,
                    invoice.amount,
                    invoice.memoCode,
                ),
            });
        } else {
            dbBankIds.push(id.toString());
        }
    }

    if (dbBankIds.length > 0) {
        // Query UserBankApi by IDs
        const bankConfigs = await UserBankApiModel.find({
            _id: { $in: dbBankIds },
        }).lean();

        const dbInfos = bankConfigs
            .map((bank) => {
                const mapping = BANK_CODE_MAP[bank.bankCode];
                if (!mapping) return null;

                const accountNumber = bank.accountNumber || "";
                const accountName = bank.bankName || bank.bankCode.toUpperCase();

                return {
                    method: bank._id.toString(),
                    bankCode: mapping.vietqrCode,
                    bankName: bank.bankName,
                    accountNumber,
                    accountName,
                    logo: mapping.logo,
                    qrCode: buildQrCodeUrl(
                        mapping.vietqrCode,
                        accountNumber,
                        invoice.amount,
                        invoice.memoCode,
                    ),
                };
            })
            .filter((item): item is InvoicePaymentMethodInfo => item !== null);

        infos.push(...dbInfos);
    }

    return infos;
}
