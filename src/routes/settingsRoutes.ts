import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { jwtGuard } from "../middleware/jwtAuth";
import {
    SettingsModel,
    getSettings,
    generateApiKey,
} from "../models/Settings";

const updateWebhookSchema = z.object({
    webhookUrl: z.string().url("Webhook URL khong hop le").or(z.literal("")),
});

const addSiteSchema = z.object({
    site: z.string().url("URL khong hop le"),
});

const updateSettingsSchema = z.object({
    webhookUrl: z.string().url().or(z.literal("")).optional(),
    allowedSites: z.array(z.string().url()).optional(),
});

export default async function settingsRoutes(
    fastify: FastifyInstance,
): Promise<void> {
    // GET /api/settings
    fastify.get(
        "/settings",
        { preHandler: jwtGuard },
        async (request, reply) => {
            try {
                const settings = await getSettings();
                return reply.send({
                    apiKey: settings.apiKey,
                    webhookUrl: settings.webhookUrl,
                    allowedSites: settings.allowedSites,
                });
            } catch (error) {
                request.log.error({ err: error }, "Lay settings that bai");
                return reply.code(500).send({ message: "Khong the lay settings" });
            }
        },
    );

    // PUT /api/settings
    fastify.put(
        "/settings",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const parseResult = updateSettingsSchema.safeParse(request.body);

            if (!parseResult.success) {
                return reply.code(400).send({
                    message: "Payload khong hop le",
                    issues: parseResult.error.flatten(),
                });
            }

            try {
                const settings = await getSettings();

                if (parseResult.data.webhookUrl !== undefined) {
                    settings.webhookUrl = parseResult.data.webhookUrl;
                }
                if (parseResult.data.allowedSites !== undefined) {
                    settings.allowedSites = parseResult.data.allowedSites;
                }

                await settings.save();

                return reply.send({
                    success: true,
                    message: "Luu settings thanh cong",
                    settings: {
                        apiKey: settings.apiKey,
                        webhookUrl: settings.webhookUrl,
                        allowedSites: settings.allowedSites,
                    },
                });
            } catch (error) {
                request.log.error({ err: error }, "Luu settings that bai");
                return reply.code(500).send({ message: "Khong the luu settings" });
            }
        },
    );

    // PUT /api/settings/webhook
    fastify.put(
        "/settings/webhook",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const parseResult = updateWebhookSchema.safeParse(request.body);

            if (!parseResult.success) {
                return reply.code(400).send({
                    message: "Payload khong hop le",
                    issues: parseResult.error.flatten(),
                });
            }

            try {
                const settings = await getSettings();
                settings.webhookUrl = parseResult.data.webhookUrl;
                await settings.save();

                return reply.send({
                    success: true,
                    message: "Cap nhat webhook thanh cong",
                    webhookUrl: settings.webhookUrl,
                });
            } catch (error) {
                request.log.error({ err: error }, "Cap nhat webhook that bai");
                return reply.code(500).send({ message: "Khong the cap nhat webhook" });
            }
        },
    );

    // POST /api/settings/api-key/regenerate
    fastify.post(
        "/settings/api-key/regenerate",
        { preHandler: jwtGuard },
        async (request, reply) => {
            try {
                const settings = await getSettings();
                settings.apiKey = generateApiKey();
                await settings.save();

                return reply.send({
                    success: true,
                    message: "Tao API key moi thanh cong",
                    apiKey: settings.apiKey,
                });
            } catch (error) {
                request.log.error({ err: error }, "Tao API key that bai");
                return reply.code(500).send({ message: "Khong the tao API key moi" });
            }
        },
    );

    // POST /api/settings/allowed-sites
    fastify.post(
        "/settings/allowed-sites",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const parseResult = addSiteSchema.safeParse(request.body);

            if (!parseResult.success) {
                return reply.code(400).send({
                    message: "Payload khong hop le",
                    issues: parseResult.error.flatten(),
                });
            }

            try {
                const settings = await getSettings();
                const site = parseResult.data.site;

                if (settings.allowedSites.includes(site)) {
                    return reply.code(400).send({
                        message: "Site da ton tai trong danh sach",
                    });
                }

                settings.allowedSites.push(site);
                await settings.save();

                return reply.send({
                    success: true,
                    message: "Them site thanh cong",
                    allowedSites: settings.allowedSites,
                });
            } catch (error) {
                request.log.error({ err: error }, "Them site that bai");
                return reply.code(500).send({ message: "Khong the them site" });
            }
        },
    );

    // DELETE /api/settings/allowed-sites/:site
    fastify.delete<{ Params: { site: string } }>(
        "/settings/allowed-sites/:site",
        { preHandler: jwtGuard },
        async (request, reply) => {
            try {
                const settings = await getSettings();
                const siteToRemove = decodeURIComponent(request.params.site);

                const index = settings.allowedSites.indexOf(siteToRemove);
                if (index === -1) {
                    return reply.code(404).send({
                        message: "Site khong ton tai trong danh sach",
                    });
                }

                settings.allowedSites.splice(index, 1);
                await settings.save();

                return reply.send({
                    success: true,
                    message: "Xoa site thanh cong",
                    allowedSites: settings.allowedSites,
                });
            } catch (error) {
                request.log.error({ err: error }, "Xoa site that bai");
                return reply.code(500).send({ message: "Khong the xoa site" });
            }
        },
    );
}
