import {
    PAYMENT_METHODS,
    type InvoiceLean,
    type PaymentMethod,
} from "../models/Invoice";

type PaymentMethodConfig = {
    method: PaymentMethod;
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    logo: string;
};

export type InvoicePaymentMethodInfo = PaymentMethodConfig & {
    qrCode: string;
};

const PAYMENT_METHOD_CONFIGS: Record<PaymentMethod, PaymentMethodConfig> = {
    mbbank: {
        method: "mbbank",
        bankCode: "MB",
        bankName: "MBBank",
        accountNumber: "0347970961",
        accountName: "Nguyễn Viết Hiếu",
        logo: "https://cdn.vietqr.io/img/MB.png",
    },
    vietcombank: {
        method: "vietcombank",
        bankCode: "VCB",
        bankName: "Vietcombank",
        accountNumber: "3335085080",
        accountName: "Nguyễn Viết Hiếu",
        logo: "https://cdn.vietqr.io/img/VCB.png",
    },
};

function buildQrCodeUrl(
    bankCode: string,
    accountNumber: string,
    amount: number,
    memoCode: string,
): string {
    const encodedMemoCode = encodeURIComponent(memoCode);
    return `https://img.vietqr.io/image/${bankCode}-${accountNumber}-qr_only.png?amount=${amount}&addInfo=${encodedMemoCode}`;
}

export function getInvoicePaymentMethodInfos(
    invoice: Pick<InvoiceLean, "paymentMethods" | "amount" | "memoCode">,
): InvoicePaymentMethodInfo[] {
    const methods =
        invoice.paymentMethods && invoice.paymentMethods.length > 0
            ? invoice.paymentMethods
            : [...PAYMENT_METHODS];

    return methods.map((method) => {
        const config = PAYMENT_METHOD_CONFIGS[method];
        return {
            ...config,
            qrCode: buildQrCodeUrl(
                config.bankCode,
                config.accountNumber,
                invoice.amount,
                invoice.memoCode,
            ),
        };
    });
}
