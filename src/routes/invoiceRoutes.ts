import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { apiKeyGuard } from "../middleware/apiKeyAuth";
import { originGuard } from "../middleware/originGuard";
import { jwtGuard } from "../middleware/jwtAuth";
import { isSiteAllowed } from "../utils/siteGuard";
import { createInvoice, getInvoiceById } from "../services/invoiceService";
import { toInvoicePayload } from "../services/serializer";
import { notifyInvoiceCreated } from "../services/discordService";
import { InvoiceModel } from "../models/Invoice";

const createInvoiceSchema = z.object({
    amount: z.coerce.number().positive("So tien phai lon hon 0"),
    currency: z.string().min(3).max(8).optional(),
    siteUrl: z.string().url("siteUrl phai la URL hop le"),
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
                        status: inv.status,
                        description: inv.description,
                        siteUrl: inv.siteUrl,
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
                request.log.error({ err: error }, "Lay danh sach invoices that bai");
                return reply.code(500).send({
                    message: "Khong the lay danh sach hoa don",
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
                    message: "Payload khong hop le",
                    issues: parseResult.error.flatten(),
                });
            }

            const payload = parseResult.data;

            // Check allowed sites from database
            const isAllowed = await isSiteAllowed(payload.siteUrl);
            if (!isAllowed) {
                return reply.code(403).send({
                    message:
                        "siteUrl khong nam trong danh sach duoc phep",
                });
            }

            try {
                const invoice = await createInvoice(payload);
                void notifyInvoiceCreated(invoice, request.log);

                return reply.code(201).send({
                    invoice: toInvoicePayload(invoice),
                });
            } catch (error) {
                request.log.error({ err: error }, "Tao hoa don that bai");
                return reply.code(500).send({
                    message: "Khong the tao hoa don",
                });
            }
        },
    );

    // GET /api/invoices/:invoiceId - Get invoice by ID
    fastify.get<{ Params: { invoiceId: string } }>(
        "/invoices/:invoiceId",
        { preHandler: originGuard },
        async (
            request: FastifyRequest<{ Params: { invoiceId: string } }>,
            reply: FastifyReply,
        ) => {
            const parsedParams = invoiceIdParamsSchema.safeParse(
                request.params,
            );

            if (!parsedParams.success) {
                return reply.code(400).send({
                    message: "Ma hoa don khong hop le",
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
}
