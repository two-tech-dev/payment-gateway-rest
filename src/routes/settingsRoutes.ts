import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { jwtGuard } from "../middleware/jwtAuth";
import {
    SettingsModel,
    getSettings,
    generateApiKey,
} from "../models/Settings";
import { logActivity } from "../models/ActivityLog";

const updateWebhookSchema = z.object({
    webhookUrl: z.string().url("Webhook URL không hợp lệ").or(z.literal("")),
});

const addSiteSchema = z.object({
    site: z.string().url("URL không hợp lệ"),
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
                const settings = await getSettings(request.user!.userId);
                return reply.send({
                    apiKey: settings.apiKey,
                    webhookUrl: settings.webhookUrl,
                    allowedSites: settings.allowedSites,
                });
            } catch (error) {
                request.log.error({ err: error }, "Lấy cài đặt thất bại");
                return reply
                    .code(500)
                    .send({ message: "Không thể lấy cài đặt" });
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
                    message: "Payload không hợp lệ",
                    issues: parseResult.error.flatten(),
                });
            }

            try {
                const settings = await getSettings(request.user!.userId);

                if (parseResult.data.webhookUrl !== undefined) {
                    settings.webhookUrl = parseResult.data.webhookUrl;
                }
                if (parseResult.data.allowedSites !== undefined) {
                    settings.allowedSites = parseResult.data.allowedSites;
                }

                await settings.save();

                return reply.send({
                    success: true,
                    message: "Lưu cài đặt thành công",
                    settings: {
                        apiKey: settings.apiKey,
                        webhookUrl: settings.webhookUrl,
                        allowedSites: settings.allowedSites,
                    },
                });
            } catch (error) {
                request.log.error({ err: error }, "Lưu cài đặt thất bại");
                return reply
                    .code(500)
                    .send({ message: "Không thể lưu cài đặt" });
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
                    message: "Payload không hợp lệ",
                    issues: parseResult.error.flatten(),
                });
            }

            try {
                const settings = await getSettings(request.user!.userId);
                settings.webhookUrl = parseResult.data.webhookUrl;
                await settings.save();

                await logActivity(
                    request.user!.userId,
                    "Cập nhật Webhook URL",
                    `Webhook endpoint đã được thay đổi thành: ${settings.webhookUrl || "Trống"}`,
                    request.ip || "Cài đặt hệ thống",
                    "settings",
                );

                return reply.send({
                    success: true,
                    message: "Cập nhật webhook thành công",
                    webhookUrl: settings.webhookUrl,
                });
            } catch (error) {
                request.log.error({ err: error }, "Cập nhật webhook thất bại");
                return reply
                    .code(500)
                    .send({ message: "Không thể cập nhật webhook" });
            }
        },
    );

    // POST /api/settings/api-key/regenerate
    fastify.post(
        "/settings/api-key/regenerate",
        { preHandler: jwtGuard },
        async (request, reply) => {
            try {
                const settings = await getSettings(request.user!.userId);
                settings.apiKey = generateApiKey();
                await settings.save();

                await logActivity(
                    request.user!.userId,
                    "Tạo khóa API mới",
                    "Khóa API Backend đã được tái tạo lại",
                    request.ip || "Cài đặt hệ thống",
                    "security",
                );

                return reply.send({
                    success: true,
                    message: "Tạo mã API mới thành công",
                    apiKey: settings.apiKey,
                });
            } catch (error) {
                request.log.error({ err: error }, "Tạo API key thất bại");
                return reply
                    .code(500)
                    .send({ message: "Không thể tạo mã API mới" });
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
                    message: "Payload không hợp lệ",
                    issues: parseResult.error.flatten(),
                });
            }

            try {
                const settings = await getSettings(request.user!.userId);
                const site = parseResult.data.site;

                if (settings.allowedSites.includes(site)) {
                    return reply.code(400).send({
                        message: "Site đã tồn tại trong danh sách",
                    });
                }

                settings.allowedSites.push(site);
                await settings.save();

                return reply.send({
                    success: true,
                    message: "Thêm site thành công",
                    allowedSites: settings.allowedSites,
                });
            } catch (error) {
                request.log.error({ err: error }, "Thêm site thất bại");
                return reply.code(500).send({ message: "Không thể thêm site" });
            }
        },
    );

    // DELETE /api/settings/allowed-sites/:site
    fastify.delete<{ Params: { site: string } }>(
        "/settings/allowed-sites/:site",
        { preHandler: jwtGuard },
        async (request, reply) => {
            try {
                const settings = await getSettings(request.user!.userId);
                const siteToRemove = decodeURIComponent(request.params.site);

                const index = settings.allowedSites.indexOf(siteToRemove);
                if (index === -1) {
                    return reply.code(404).send({
                        message: "Site không tồn tại trong danh sách",
                    });
                }

                settings.allowedSites.splice(index, 1);
                await settings.save();

                return reply.send({
                    success: true,
                    message: "Xóa site thành công",
                    allowedSites: settings.allowedSites,
                });
            } catch (error) {
                request.log.error({ err: error }, "Xóa site thất bại");
                return reply.code(500).send({ message: "Không thể xóa site" });
            }
        },
    );
}
