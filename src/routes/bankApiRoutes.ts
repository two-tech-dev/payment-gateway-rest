import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { jwtGuard } from "../middleware/jwtAuth";
import { apiKeyGuard } from "../middleware/apiKeyAuth";
import { UserModel } from "../models/User";
import { UserBankApiModel } from "../models/UserBankApi";
import { logActivity } from "../models/ActivityLog";
import { env } from "../config/env";

const connectBankSchema = z.object({
    bankCode: z.enum(["mbbank", "seabank", "tpbank"]),
    username: z.string().min(1, "Ten dang nhap khong duoc de trong"),
    accountNumber: z.string().min(1, "Số tài khoản không được để trống"),
    password: z.string().min(1, "Mật khẩu không được để trống"),
});

function hasActiveSubscription(expiresAt?: Date): boolean {
    return Boolean(expiresAt && new Date(expiresAt).getTime() > Date.now());
}

function buildGatewayBase() {
    if (!env.gatewayApiBaseUrl) {
        throw new Error("Gateway env chua duoc cau hinh: GATEWAY_API_BASE_URL");
    }

    const baseUrl = env.gatewayApiBaseUrl.replace(/\/$/, "");
    const apiPrefix = env.gatewayApiPrefix.startsWith("/")
        ? env.gatewayApiPrefix
        : `/${env.gatewayApiPrefix}`;

    return `${baseUrl}${apiPrefix}`;
}

async function fetchMBBankInfo(jwtToken: string): Promise<{
    account_name?: string;
    account_number?: string;
    balance?: number;
}> {
    const gatewayBase = buildGatewayBase();

    const response = await fetch(`${gatewayBase}/bank/mbbank/info`, {
        headers: {
            Authorization: `Bearer ${jwtToken}`,
        },
    });

    const rawText = await response.text();
    let data: {
        account_name?: string;
        account_number?: string;
        balance?: number;
        message?: string;
    } = {};
    try {
        data = rawText ? (JSON.parse(rawText) as typeof data) : {};
    } catch {
        // keep fallback raw text
    }

    if (!response.ok) {
        throw new Error(
            data.message || rawText || "Không thể lấy thông tin MB Bank",
        );
    }

    return {
        account_name: data.account_name,
        account_number: data.account_number,
        balance: data.balance,
    };
}

async function fetchMBBankTransactions(
    jwtToken: string,
    fromDate: string,
    toDate: string,
): Promise<{
    account_number?: string;
    from_date?: string;
    to_date?: string;
    total?: number;
    transactions?: Array<{
        transaction_date?: string;
        credit_amount?: number;
        debit_amount?: number;
        description?: string;
    }>;
}> {
    const gatewayBase = buildGatewayBase();

    const response = await fetch(
        `${gatewayBase}/bank/mbbank/transactions?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`,
        {
            headers: {
                Authorization: `Bearer ${jwtToken}`,
            },
        },
    );

    const rawText = await response.text();
    let data: {
        account_number?: string;
        from_date?: string;
        to_date?: string;
        total?: number;
        transactions?: Array<{
            transaction_date?: string;
            credit_amount?: number;
            debit_amount?: number;
            description?: string;
        }>;
        message?: string;
    } = {};
    try {
        data = rawText ? (JSON.parse(rawText) as typeof data) : {};
    } catch {
        // keep fallback raw text
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
                rawText ||
                "Không thể lấy lịch sử giao dịch MB Bank",
        );
    }

    return {
        account_number: data.account_number,
        from_date: data.from_date,
        to_date: data.to_date,
        total: data.total,
        transactions: data.transactions || [],
    };
}

async function deleteGatewayBank(jwtToken: string): Promise<void> {
    const gatewayBase = buildGatewayBase();

    const response = await fetch(`${gatewayBase}/bank/mbbank/delete`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${jwtToken}`,
        },
    });

    const rawText = await response.text();
    if (!response.ok) {
        throw new Error(rawText || "Không thể xóa tài khoản trên gateway");
    }
}

async function connectGatewayBank(payload: {
    bankCode: "mbbank" | "seabank" | "tpbank";
    username: string;
    accountNumber: string;
    password: string;
}): Promise<{ jwtToken: string; accountName?: string; accountNumber?: string; balance?: number; pendingVerification?: boolean; pendingId?: string; transactionId?: string }> {
    if (!env.gatewayApiBaseUrl || !env.gatewayAdminToken) {
        throw new Error(
            "Gateway env chua duoc cau hinh: GATEWAY_API_BASE_URL/GATEWAY_ADMIN_TOKEN",
        );
    }

    const baseUrl = env.gatewayApiBaseUrl.replace(/\/$/, "");
    const apiPrefix = env.gatewayApiPrefix.startsWith("/")
        ? env.gatewayApiPrefix
        : `/${env.gatewayApiPrefix}`;

    let endpoint: string;
    if (payload.bankCode === "seabank") {
        endpoint = `${baseUrl}${apiPrefix}/bank/seabank/add`;
    } else if (payload.bankCode === "tpbank") {
        endpoint = `${baseUrl}${apiPrefix}/bank/tpbank/add`;
    } else {
        endpoint = `${baseUrl}${apiPrefix}/bank/mbbank/add`;
    }

    const body = { username: payload.username, password: payload.password, accountNo: payload.accountNumber };

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.gatewayAdminToken}`,
        },
        body: JSON.stringify(body),
    });

    const rawText = await response.text();
    let data: {
        token?: string;
        account_name?: string;
        account_number?: string;
        balance?: number;
        message?: string;
        // TPBank pending verification fields
        status?: string;
        pending_id?: string;
        transaction_id?: string;
    } = {};
    try {
        data = rawText ? (JSON.parse(rawText) as typeof data) : {};
    } catch {
        // keep rawText for error message below
    }

    if (!response.ok) {
        throw new Error(
            `${response.status}::${data.message || rawText || "Gateway kết nối thất bại"}`,
        );
    }

    // TPBank pending verification case
    if (data.status === "pending_verification") {
        return {
            jwtToken: "",
            pendingVerification: true,
            pendingId: data.pending_id,
            transactionId: data.transaction_id,
        };
    }

    if (!data.token) {
        throw new Error("Gateway khong tra ve token");
    }

    return {
        jwtToken: data.token,
        accountName: data.account_name,
        accountNumber: data.account_number,
        balance: data.balance,
    };
}

/* ─── SeABank gateway helpers ─── */

async function fetchSeABankInfo(jwtToken: string): Promise<{
    account_name?: string;
    account_number?: string;
    balance?: number;
    currency?: string;
    customer_id?: string;
    product_name?: string;
}> {
    const gatewayBase = buildGatewayBase();

    const response = await fetch(`${gatewayBase}/bank/seabank/info`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
    });

    const rawText = await response.text();
    let data: any = {};
    try {
        data = rawText ? JSON.parse(rawText) : {};
    } catch {}

    if (!response.ok) {
        throw new Error(data.message || rawText || "Không thể lấy thông tin SeABank");
    }

    return {
        account_name: data.account_name,
        account_number: data.account_number,
        balance: data.balance,
        currency: data.currency,
        customer_id: data.customer_id,
        product_name: data.product_name,
    };
}

async function fetchSeABankTransactions(
    jwtToken: string,
    fromDate: string,
    toDate: string,
): Promise<{
    account_number?: string;
    from_date?: string;
    to_date?: string;
    total?: number;
    transactions?: Array<{
        transaction_id?: string;
        transaction_date?: string;
        credit_amount?: number;
        debit_amount?: number;
        description?: string;
        sender_name?: string;
        sender_bank?: string;
        receiver_name?: string;
        receiver_bank?: string;
    }>;
}> {
    const gatewayBase = buildGatewayBase();

    const response = await fetch(
        `${gatewayBase}/bank/seabank/transactions?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`,
        { headers: { Authorization: `Bearer ${jwtToken}` } },
    );

    const rawText = await response.text();
    let data: any = {};
    try {
        data = rawText ? JSON.parse(rawText) : {};
    } catch {}

    if (!response.ok) {
        throw new Error(data.message || rawText || "Không thể lấy lịch sử giao dịch SeABank");
    }

    return {
        account_number: data.account_number,
        from_date: data.from_date,
        to_date: data.to_date,
        total: data.total,
        transactions: data.transactions || [],
    };
}

async function deleteGatewayBankByCode(jwtToken: string, bankCode: string): Promise<void> {
    const gatewayBase = buildGatewayBase();
    let endpoint: string;
    if (bankCode === "seabank") {
        endpoint = `${gatewayBase}/bank/seabank/delete`;
    } else if (bankCode === "tpbank") {
        endpoint = `${gatewayBase}/bank/tpbank/delete`;
    } else {
        endpoint = `${gatewayBase}/bank/mbbank/delete`;
    }

    const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${jwtToken}` },
    });

    const rawText = await response.text();
    if (!response.ok) {
        throw new Error(rawText || "Không thể xóa tài khoản trên gateway");
    }
}

/* ─── TPBank gateway helpers ─── */

async function fetchTPBankInfo(jwtToken: string): Promise<{
    account_name?: string;
    account_number?: string;
    balance?: number;
    currency?: string;
}> {
    const gatewayBase = buildGatewayBase();

    const response = await fetch(`${gatewayBase}/bank/tpbank/info`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
    });

    const rawText = await response.text();
    let data: any = {};
    try {
        data = rawText ? JSON.parse(rawText) : {};
    } catch {}

    if (!response.ok) {
        throw new Error(data.message || rawText || "Không thể lấy thông tin TPBank");
    }

    return {
        account_name: data.account_name,
        account_number: data.account_number,
        balance: data.balance,
        currency: data.currency,
    };
}

async function fetchTPBankTransactions(
    jwtToken: string,
    fromDate: string,
    toDate: string,
): Promise<{
    account_number?: string;
    from_date?: string;
    to_date?: string;
    total?: number;
    transactions?: Array<{
        transaction_date?: string;
        credit_amount?: number;
        debit_amount?: number;
        description?: string;
    }>;
}> {
    const gatewayBase = buildGatewayBase();

    const response = await fetch(
        `${gatewayBase}/bank/tpbank/transactions?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`,
        { headers: { Authorization: `Bearer ${jwtToken}` } },
    );

    const rawText = await response.text();
    let data: any = {};
    try {
        data = rawText ? JSON.parse(rawText) : {};
    } catch {}

    if (!response.ok) {
        throw new Error(data.message || rawText || "Không thể lấy lịch sử giao dịch TPBank");
    }

    // Normalize TPBank transactions to match the unified format
    const rawTransactions = data.transactions || [];
    const normalizedTransactions = rawTransactions.map((tx: any) => ({
        transaction_date: tx.booking_date || tx.transaction_date || "",
        credit_amount: tx.credit_debit_indicator === "CRDT" ? (tx.amount || 0) : 0,
        debit_amount: tx.credit_debit_indicator === "DBIT" ? (tx.amount || 0) : 0,
        description: tx.description || "",
    }));

    return {
        account_number: data.account_number,
        from_date: data.from_date,
        to_date: data.to_date,
        total: data.total,
        transactions: normalizedTransactions,
    };
}

export default async function bankApiRoutes(
    fastify: FastifyInstance,
): Promise<void> {
    fastify.get(
        "/bank-apis",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const user = await UserModel.findById(request.user?.userId);
            if (!user) {
                return reply
                    .code(404)
                    .send({ message: "Khong tim thay nguoi dung" });
            }

            const banks = await UserBankApiModel.find({
                userId: user._id,
            }).lean();

            return reply.send({
                availableBanks: [
                    { bankCode: "mbbank", bankName: "MBBank" },
                    { bankCode: "seabank", bankName: "SeABank" },
                    { bankCode: "tpbank", bankName: "TPBank" },
                ],
                subscription: {
                    active: hasActiveSubscription(user.subscriptionExpiresAt),
                    expiresAt: user.subscriptionExpiresAt,
                    planCode: user.planCode,
                    planPriceVnd: user.planPriceVnd,
                    planDurationDays: user.planDurationDays,
                },
                banks: banks.map((bank) => ({
                    id: String(bank._id),
                    bankCode: bank.bankCode,
                    bankName: bank.bankName,
                    username: bank.username,
                    accountNumber: bank.accountNumber,
                    createdAt: bank.createdAt,
                })),
            });
        },
    );

    fastify.get<{ Params: { bankCode: string } }>(
        "/bank-apis/:bankCode",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const { bankCode } = request.params;
            if (bankCode !== "mbbank" && bankCode !== "seabank" && bankCode !== "tpbank") {
                return reply
                    .code(404)
                    .send({ message: "Ngan hang khong duoc ho tro" });
            }

            const bankNameMap: Record<string, string> = { mbbank: "MBBank", seabank: "SeABank", tpbank: "TPBank" };

            const user = await UserModel.findById(request.user?.userId);
            if (!user) {
                return reply
                    .code(404)
                    .send({ message: "Khong tim thay nguoi dung" });
            }

            const banks = await UserBankApiModel.find({
                userId: user._id,
                bankCode,
            }).lean();
            const accounts = banks.map((item) => ({
                id: String(item._id),
                username: item.username,
                accountNumber: item.accountNumber,
                balance: undefined,
                createdAt: item.createdAt,
            }));

            return reply.send({
                bank: { bankCode, bankName: bankNameMap[bankCode] || bankCode },
                subscription: {
                    active: hasActiveSubscription(user.subscriptionExpiresAt),
                    expiresAt: user.subscriptionExpiresAt,
                },
                accounts,
            });
        },
    );

    fastify.get<{ Params: { bankId: string } }>(
        "/bank-apis/accounts/:bankId/token",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const user = await UserModel.findById(request.user?.userId);
            if (!user) {
                return reply
                    .code(404)
                    .send({ message: "Khong tim thay nguoi dung" });
            }

            const bank = await UserBankApiModel.findOne({
                _id: request.params.bankId,
                userId: user._id,
            });
            if (!bank) {
                return reply
                    .code(404)
                    .send({ message: "Không tìm thấy tài khoản ngân hàng" });
            }

            return reply.send({
                bankId: String(bank._id),
                bankCode: bank.bankCode,
                jwtToken: bank.gatewayJwtToken,
            });
        },
    );

    fastify.get<{
        Params: { bankId: string };
        Querystring: { from_date: string; to_date: string };
    }>(
        "/bank-apis/accounts/:bankId/transactions",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const user = await UserModel.findById(request.user?.userId);
            if (!user) {
                return reply
                    .code(404)
                    .send({ message: "Khong tim thay nguoi dung" });
            }

            const bank = await UserBankApiModel.findOne({
                _id: request.params.bankId,
                userId: user._id,
            });
            if (!bank) {
                return reply
                    .code(404)
                    .send({ message: "Không tìm thấy tài khoản ngân hàng" });
            }

            const fromDate = request.query.from_date;
            const toDate = request.query.to_date;

            if (!fromDate || !toDate) {
                return reply
                    .code(400)
                    .send({ message: "Thieu from_date hoac to_date" });
            }

            try {
                let data: any;
                if (bank.bankCode === "seabank") {
                    data = await fetchSeABankTransactions(bank.gatewayJwtToken, fromDate, toDate);
                } else if (bank.bankCode === "tpbank") {
                    data = await fetchTPBankTransactions(bank.gatewayJwtToken, fromDate, toDate);
                } else {
                    data = await fetchMBBankTransactions(bank.gatewayJwtToken, fromDate, toDate);
                }
                return reply.send(data);
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : "Khong the lay lich su giao dich";
                return reply.code(502).send({ message });
            }
        },
    );

    fastify.delete<{ Params: { bankId: string } }>(
        "/bank-apis/accounts/:bankId",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const user = await UserModel.findById(request.user?.userId);
            if (!user) {
                return reply.code(404).send({
                    success: false,
                    message: "Khong tim thay nguoi dung",
                });
            }

            const bank = await UserBankApiModel.findOne({
                _id: request.params.bankId,
                userId: user._id,
            });
            if (!bank) {
                return reply.code(404).send({
                    success: false,
                    message: "Không tìm thấy tài khoản ngân hàng",
                });
            }

            try {
                await deleteGatewayBankByCode(bank.gatewayJwtToken, bank.bankCode);
            } catch (error) {
                request.log.warn(
                    { err: error },
                    "Xoa tai khoan tren gateway that bai, tiep tuc xoa local",
                );
            }

            await UserBankApiModel.deleteOne({ _id: bank._id });

            await logActivity(
                user._id,
                "Bỏ liên kết tài khoản ngân hàng",
                `Đã gỡ liên kết tài khoản ${bank.bankName} (${bank.accountNumber || bank.username})`,
                request.ip || "API Ngân hàng",
                "bank",
            );

            return reply.send({
                success: true,
                message: "Đã xóa tài khoản ngân hàng",
            });
        },
    );

    fastify.post(
        "/bank-apis",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const parseResult = connectBankSchema.safeParse(request.body);
            if (!parseResult.success) {
                return reply.code(400).send({
                    success: false,
                    message: "Payload không hợp lệ",
                    issues: parseResult.error.flatten(),
                });
            }

            const user = await UserModel.findById(request.user?.userId);
            if (!user) {
                return reply.code(404).send({
                    success: false,
                    message: "Khong tim thay nguoi dung",
                });
            }

            if (!hasActiveSubscription(user.subscriptionExpiresAt)) {
                return reply.code(403).send({
                    success: false,
                    message:
                        "Goi su dung da het han. Vui long gia han de them ngan hang.",
                });
            }

            const payload = parseResult.data;

            try {
                const gatewayConnected = await connectGatewayBank(payload);

                // TPBank pending verification case
                if (gatewayConnected.pendingVerification) {
                    return reply.code(202).send({
                        success: true,
                        pendingVerification: true,
                        pendingId: gatewayConnected.pendingId,
                        transactionId: gatewayConnected.transactionId,
                        message: "Vui lòng xác nhận trên ứng dụng TPBank (eToken), sau đó gọi API confirm.",
                    });
                }

                const bankNameMap: Record<string, string> = { mbbank: "MBBank", seabank: "SeABank", tpbank: "TPBank" };

                const bank = await UserBankApiModel.create({
                    userId: user._id,
                    bankCode: payload.bankCode,
                    bankName: bankNameMap[payload.bankCode] || payload.bankCode,
                    username: payload.username,
                    accountNumber: payload.accountNumber || gatewayConnected.accountNumber || "",
                    gatewayJwtToken: gatewayConnected.jwtToken,
                });

                await logActivity(
                    user._id,
                    "Liên kết tài khoản ngân hàng",
                    `Đã kết nối tài khoản ${bank.bankName} (${bank.accountNumber}) thành công`,
                    request.ip || "API Ngân hàng",
                    "bank",
                );

                return reply.code(201).send({
                    success: true,
                    bank: {
                        id: String(bank._id),
                        bankCode: bank.bankCode,
                        bankName: bank.bankName,
                        username: bank.username,
                        accountNumber: bank.accountNumber,
                        createdAt: bank.createdAt,
                    },
                });
            } catch (error) {
                request.log.error({ err: error }, "Them bank api that bai");
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : "Khong the ket noi va them API ngan hang";

                if (errorMessage.startsWith("409::")) {
                    return reply.code(409).send({
                        success: false,
                        message:
                            errorMessage.replace("409::", "") ||
                            "Tai khoan da ton tai",
                    });
                }

                if (errorMessage.startsWith("400::")) {
                    return reply.code(400).send({
                        success: false,
                        message:
                            errorMessage.replace("400::", "") ||
                            "Dang nhap that bai",
                    });
                }

                return reply.code(502).send({
                    success: false,
                    message:
                        errorMessage ||
                        "Khong the ket noi va them API ngan hang",
                });
            }
        },
    );

    // TPBank confirm device verification
    fastify.post(
        "/bank-apis/confirm",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const body = request.body as { pendingId?: string };
            if (!body.pendingId) {
                return reply.code(400).send({ success: false, message: "Thiếu pendingId" });
            }

            const user = await UserModel.findById(request.user?.userId);
            if (!user) {
                return reply.code(404).send({ success: false, message: "Không tìm thấy người dùng" });
            }

            try {
                const gatewayBase = buildGatewayBase();
                const response = await fetch(`${gatewayBase}/bank/tpbank/confirm`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${env.gatewayAdminToken}`,
                    },
                    body: JSON.stringify({ pending_id: body.pendingId }),
                });

                const rawText = await response.text();
                let data: any = {};
                try {
                    data = rawText ? JSON.parse(rawText) : {};
                } catch {}

                if (!response.ok) {
                    return reply.code(response.status).send({
                        success: false,
                        message: data.detail || data.message || rawText || "Xác thực thất bại",
                    });
                }

                // Gateway trả status=pending khi user chưa confirm trên app
                if (data.status === "pending") {
                    return reply.code(202).send({
                        success: false,
                        pending: true,
                        message: data.message || "Chưa xác thực. Vui lòng xác nhận trên app TPBank.",
                    });
                }

                if (!data.token) {
                    return reply.code(502).send({ success: false, message: "Gateway không trả về token" });
                }

                const bank = await UserBankApiModel.create({
                    userId: user._id,
                    bankCode: "tpbank",
                    bankName: "TPBank",
                    username: data.account_name || "TPBank User",
                    accountNumber: data.account_number || "",
                    gatewayJwtToken: data.token,
                });

                await logActivity(
                    user._id,
                    "Liên kết tài khoản ngân hàng",
                    `Đã xác thực và kết nối tài khoản TPBank (${bank.accountNumber}) thành công`,
                    request.ip || "API Ngân hàng",
                    "bank",
                );

                return reply.code(201).send({
                    success: true,
                    bank: {
                        id: String(bank._id),
                        bankCode: bank.bankCode,
                        bankName: bank.bankName,
                        username: bank.username,
                        accountNumber: bank.accountNumber,
                        createdAt: bank.createdAt,
                    },
                });
            } catch (error) {
                request.log.error({ err: error }, "TPBank confirm that bai");
                const errorMessage = error instanceof Error ? error.message : "Xác thực TPBank thất bại";
                return reply.code(502).send({ success: false, message: errorMessage });
            }
        },
    );

    // Dành cho Gateway Integrator (Server to Server)
    fastify.get(
        "/payment-methods",
        { preHandler: apiKeyGuard },
        async (request, reply) => {
            try {
                // request.user was already populated by apiKeyGuard via settings
                const banks = await UserBankApiModel.find({
                    userId: request.user!.userId,
                }).lean();

                const activeMethods = banks.map((item) => ({
                    id: String(item._id),
                    bankCode: item.bankCode,
                    bankName: item.bankName,
                    accountNumber: item.accountNumber,
                    username: item.username,
                    status: "connected",
                }));

                return reply.send({
                    success: true,
                    activeMethods,
                });
            } catch (error) {
                request.log.error({ err: error }, "Failed to fetch payment methods");
                return reply.code(500).send({ message: "Lỗi hệ thống khi lấy Payment Methods" });
            }
        },
    );
}
