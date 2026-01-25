import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { apiKeyGuard } from "../middleware/apiKeyAuth";
import { originGuard } from "../middleware/originGuard";
import { isSiteAllowed } from "../utils/siteGuard";
import { createInvoice, getInvoiceById } from "../services/invoiceService";
import { toInvoicePayload } from "../services/serializer";
import { notifyInvoiceCreated } from "../services/discordService";

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

export default async function invoiceRoutes(
    fastify: FastifyInstance,
): Promise<void> {
    fastify.post(
        "/invoices",
        { preHandler: apiKeyGuard },
        async (
            request: FastifyRequest<{ Body: unknown }>,
            reply: FastifyReply,
        ) => {
            const parseResult = createInvoiceSchema.safeParse(request.body);

            if (!parseResult.success) {
                return reply.code(400).send({
                    message: "Payload khong hop le",
                    issues: parseResult.error.flatten(),
                });
            }

            const payload = parseResult.data;

            if (!isSiteAllowed(payload.siteUrl)) {
                return reply.code(403).send({
                    message:
                        "siteUrl khong nam trong danh sach duoc phep (config.js)",
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
