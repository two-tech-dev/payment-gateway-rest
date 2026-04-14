import type { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { jwtGuard } from "../middleware/jwtAuth";
import { InvoiceModel, INVOICE_EXPIRY_MINUTES } from "../models/Invoice";
import { UserBankApiModel } from "../models/UserBankApi";
import { UserModel } from "../models/User";
import { getNextSequence } from "../models/Counter";
import { env } from "../config/env";

const createDepositSchema = z.object({
    amount: z.coerce
        .number()
        .int()
        .min(10000, "Số tiền nạp tối thiểu là 10.000₫")
        .max(50000000, "Số tiền nạp tối đa là 50.000.000₫"),
});

export default async function depositRoutes(
    fastify: FastifyInstance,
): Promise<void> {
    // POST /api/deposit/create
    fastify.post(
        "/deposit/create",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const parseResult = createDepositSchema.safeParse(request.body);
            if (!parseResult.success) {
                return reply.code(400).send({
                    message:
                        parseResult.error.errors[0]?.message ||
                        "Dữ liệu không hợp lệ",
                });
            }

            const { amount } = parseResult.data;
            const userId = request.user!.userId;

            try {
                // Get admin user (system account receives deposits)
                const adminUser = await UserModel.findOne({
                    email: env.adminEmail,
                }).lean();
                if (!adminUser) {
                    return reply
                        .code(500)
                        .send({ message: "Hệ thống chưa được cấu hình" });
                }

                let paymentMethodIds: string[] = ["69d2760a983539fd63003ed7"];

                // Create a deposit invoice
                const invoiceId = await getNextSequence("invoice");
                const memoCode = `NAP${invoiceId}`;
                const verifySecret = crypto.randomBytes(16).toString("hex");
                const expiresAt = new Date(
                    Date.now() + INVOICE_EXPIRY_MINUTES * 60 * 1000,
                );

                const invoice = await InvoiceModel.create({
                    userId,
                    invoiceId,
                    memoCode,
                    amount,
                    currency: "VND",
                    verifySecret,
                    paymentMethods: paymentMethodIds,
                    description: `Nạp tiền tài khoản - ${amount.toLocaleString("vi-VN")}₫`,
                    expiresAt,
                    webhookUrl: `http://127.0.0.1:${env.port}/api/deposit/callback`,
                });

                const checkoutUrl = `/pay?invoiceId=${invoice.invoiceId}`;

                return reply.code(201).send({
                    success: true,
                    invoiceId: invoice.invoiceId,
                    memoCode: invoice.memoCode,
                    amount: invoice.amount,
                    checkoutUrl,
                });
            } catch (error) {
                request.log.error(
                    { err: error },
                    "Tạo giao dịch nạp tiền thất bại",
                );
                return reply
                    .code(500)
                    .send({ message: "Không thể tạo giao dịch nạp tiền" });
            }
        },
    );

    // GET /api/deposit/history — lịch sử nạp tiền
    fastify.get(
        "/deposit/history",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const userId = request.user!.userId;

            try {
                const deposits = await InvoiceModel.find({
                    userId,
                    memoCode: { $regex: /^NAP/ },
                })
                    .sort({ createdAt: -1 })
                    .limit(20)
                    .lean();

                const result = deposits.map((d) => ({
                    invoiceId: d.invoiceId,
                    amount: d.amount,
                    status: d.status,
                    memoCode: d.memoCode,
                    createdAt: d.createdAt,
                    completedAt: d.completedAt,
                }));

                return reply.send({ deposits: result });
            } catch (error) {
                request.log.error(
                    { err: error },
                    "Lấy lịch sử nạp tiền thất bại",
                );
                return reply
                    .code(500)
                    .send({ message: "Không thể lấy lịch sử nạp tiền" });
            }
        },
    );
    // POST /api/deposit/callback — Internal webhook receiver for deposit
    fastify.post("/deposit/callback", async (request, reply) => {
        const body = request.body as any;
        const signatureHeader = request.headers["x-2tech-signature"] as string;

        if (!signatureHeader || !body.invoice || !body.invoice.invoiceId) {
            return reply
                .code(400)
                .send({ message: "Thiếu thông tin signature hoặc payload" });
        }

        try {
            // Find invoice to get verifySecret
            const invoice = await InvoiceModel.findOne({
                invoiceId: body.invoice.invoiceId,
            });
            if (!invoice) {
                return reply
                    .code(404)
                    .send({ message: "Không tìm thấy hóa đơn" });
            }

            // Verify signature
            const parts = signatureHeader.split(",");
            let timestamp = "";
            let hash = "";

            for (const part of parts) {
                const [key, val] = part.split("=");
                if (key === "t") timestamp = val;
                if (key === "v1") hash = val;
            }

            if (!timestamp || !hash) {
                return reply
                    .code(401)
                    .send({ message: "Signature format không đúng" });
            }

            const rawBody = JSON.stringify(body);
            const expectedHash = crypto
                .createHmac("sha256", invoice.verifySecret)
                .update(`${timestamp}.${rawBody}`)
                .digest("hex");

            if (hash !== expectedHash) {
                return reply.code(401).send({ message: "Chữ ký không hợp lệ" });
            }

            // If event is completed and invoice is internal deposit
            if (
                body.event === "invoice.completed" &&
                invoice.memoCode?.startsWith("NAP")
            ) {
                // Atomic duplicate-check via isDepositProcessed flag
                const updatedInvoice = await InvoiceModel.findOneAndUpdate(
                    { _id: invoice._id, isDepositProcessed: { $ne: true } },
                    { $set: { isDepositProcessed: true } },
                    { new: true }
                );

                if (!updatedInvoice) {
                    request.log.info({ invoiceId: invoice.invoiceId }, "Bỏ qua webhook nạp tiền do đã xử lý cộng tiền trước đó");
                    return reply.send({ success: true, message: "Đã xử lý trước đó" });
                }

                const user = await UserModel.findByIdAndUpdate(
                    invoice.userId,
                    { $inc: { walletBalanceVnd: invoice.amount } },
                    { new: true },
                );

                request.log.info(
                    {
                        userId: invoice.userId,
                        updatedBalance: user?.walletBalanceVnd,
                        invoiceId: invoice.invoiceId,
                    },
                    "Đã cộng tiền vào ví người dùng qua webhook callback",
                );
            }

            return reply.send({ success: true });
        } catch (error) {
            request.log.error(
                { err: error },
                "Lỗi khi xử lý deposit callback webhook",
            );
            return reply.code(500).send({ message: "Internal server error" });
        }
    });
}
