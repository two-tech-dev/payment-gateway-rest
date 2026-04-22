import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { apiKeyGuard } from "../middleware/apiKeyAuth";
import { jwtGuard } from "../middleware/jwtAuth";
import { createInvoice, getInvoiceById } from "../services/invoiceService";
import { UserBankApiModel } from "../models/UserBankApi";
import { toInvoicePayload } from "../services/serializer";
import { notifyInvoiceCreated } from "../services/discordService";
import { getInvoicePaymentMethodInfos } from "../services/paymentMethodService";
import { InvoiceModel } from "../models/Invoice";

const createInvoiceSchema = z.object({
    amount: z.coerce.number().positive("So tien phai lon hon 0"),
    currency: z.string().min(3).max(8).optional(),
    memoCode: z.string().min(1).max(50).optional(),
    paymentMethods: z
        .array(z.string())
        .nonempty("Can it nhat 1 phuong thuc thanh toan")
        .transform((methods) => Array.from(new Set(methods))),
    description: z.string().max(255).optional(),
    webhookUrl: z.string().url().optional(),
});

const invoiceIdParamsSchema = z.object({
    invoiceId: z.coerce.number().int().positive(),
});

const listInvoicesQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(["pending", "completed", "failed", "expired"]).optional(),
});

export default async function invoiceRoutes(
    fastify: FastifyInstance,
): Promise<void> {
    // GET /api/invoices - List all invoices with pagination (requires JWT)
    fastify.get(
        "/invoices",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const parseResult = listInvoicesQuerySchema.safeParse(request.query);
            const { page, limit, status } = parseResult.success
                ? parseResult.data
                : { page: 1, limit: 20, status: undefined };

            try {
                const filter: Record<string, unknown> = {};
                if (status) {
                    filter.status = status;
                }

                const total = await InvoiceModel.countDocuments(filter);
                const invoices = await InvoiceModel.find(filter)
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .lean();

                return reply.send({
                    invoices: invoices.map((inv) => ({
                        invoiceId: inv.invoiceId,
                        memoCode: inv.memoCode,
                        amount: inv.amount,
                        currency: inv.currency,
                        paymentMethods:
                            inv.paymentMethods &&
                            inv.paymentMethods.length > 0
                                ? inv.paymentMethods
                                : [],
                        status: inv.status,
                        description: inv.description,
                        createdAt: inv.createdAt,
                        completedAt: inv.completedAt,
                        expiresAt: inv.expiresAt,
                    })),
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit),
                    },
                });
            } catch (error) {
                request.log.error({ err: error }, "Lấy danh sách hóa đơn thất bại");
                return reply.code(500).send({
                    message: "Không thể lấy danh sách hóa đơn",
                });
            }
        },
    );

    // POST /api/invoices - Create invoice (requires API key)
    fastify.post(
        "/invoices",
        { preHandler: apiKeyGuard },
        async (request, reply) => {
            const parseResult = createInvoiceSchema.safeParse(request.body);

            if (!parseResult.success) {
                return reply.code(400).send({
                    message: "Payload không hợp lệ",
                    issues: parseResult.error.flatten(),
                });
            }

            const payload = parseResult.data;

            // Kiểm tra các paymentMethods ID xem có trực thuộc vào userId này không
            const banks = await UserBankApiModel.find({
                _id: { $in: payload.paymentMethods },
                userId: request.user!.userId,
            }).lean();

            if (banks.length !== payload.paymentMethods.length) {
                return reply.code(403).send({
                    message: "Một hoặc nhiều phương thức thanh toán không tồn tại hoặc không thuộc quyền sở hữu của API Key này",
                });
            }

            try {
                const invoice = await createInvoice({ ...payload, userId: request.user!.userId });
                void notifyInvoiceCreated(invoice, request.log);

                return reply.code(201).send({
                    success: true,
                    invoice: {
                        ...toInvoicePayload(invoice),
                        verifySecret: invoice.verifySecret,
                    },
                    checkoutUrl: `https://payment.hypertechstudio.xyz/pay?${invoice.invoiceId}`,
                });
            } catch (error) {
                request.log.error({ err: error }, "Tạo hóa đơn thất bại");
                return reply.code(500).send({
                    message: "Không thể tạo hóa đơn",
                });
            }
        },
    );

    // GET /api/invoices/:invoiceId - Get invoice by ID
    fastify.get<{ Params: { invoiceId: string } }>(
        "/invoices/:invoiceId",
        async (
            request: FastifyRequest<{ Params: { invoiceId: string } }>,
            reply: FastifyReply,
        ) => {
            const parsedParams = invoiceIdParamsSchema.safeParse(
                request.params,
            );

            if (!parsedParams.success) {
                return reply.code(400).send({
                    message: "Mã hóa đơn không hợp lệ",
                });
            }

            const invoice = await getInvoiceById(parsedParams.data.invoiceId);

            if (!invoice) {
                return reply.code(404).send({
                    message: "Khong tim thay hoa don",
                });
            }

            return reply.send({
                invoice: toInvoicePayload(invoice),
            });
        },
    );

    // GET /api/invoices/:invoiceId/payment-methods - Get payment method info by invoice ID
    fastify.get<{ Params: { invoiceId: string } }>(
        "/invoices/:invoiceId/payment-methods",
        async (
            request: FastifyRequest<{ Params: { invoiceId: string } }>,
            reply: FastifyReply,
        ) => {
            const parsedParams = invoiceIdParamsSchema.safeParse(
                request.params,
            );

            if (!parsedParams.success) {
                return reply.code(400).send({
                    message: "Mã hóa đơn không hợp lệ",
                });
            }

            const invoice = await getInvoiceById(parsedParams.data.invoiceId);

            if (!invoice) {
                return reply.code(404).send({
                    message: "Khong tim thay hoa don",
                });
            }

            return reply.send({
                invoiceId: invoice.invoiceId,
                amount: invoice.amount,
                memoCode: invoice.memoCode,
                paymentMethods: await getInvoicePaymentMethodInfos(invoice),
            });
        },
    );
}
