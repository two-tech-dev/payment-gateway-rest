import type {
    FastifyReply,
    FastifyRequest,
    preHandlerHookHandler,
} from "fastify";
import { SettingsModel } from "../models/Settings";

function extractApiKey(request: FastifyRequest): string | null {
    const headerKey = request.headers["x-api-key"];

    if (Array.isArray(headerKey)) {
        return headerKey[0];
    }

    return headerKey ?? null;
}

export const apiKeyGuard: preHandlerHookHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
) => {
    const key = extractApiKey(request);

    if (!key) {
        reply.code(401).send({
            message: "Khong duoc phep: Thieu API key",
        });
        return reply;
    }

    const settings = await SettingsModel.findOne({ apiKey: key });

    if (!settings) {
        reply.code(401).send({
            message: "Khong duoc phep: API key khong hop le",
        });
        return reply;
    }

    request.user = { userId: String(settings.userId), email: "" };
};
