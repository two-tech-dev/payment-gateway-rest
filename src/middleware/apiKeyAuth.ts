import type {
    FastifyReply,
    FastifyRequest,
    preHandlerHookHandler,
} from "fastify";
import { getSettings } from "../models/Settings";

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
    const settings = await getSettings();

    if (!settings.apiKey || key !== settings.apiKey) {
        reply.code(401).send({
            message: "Khong duoc phep: API key khong hop le",
        });
        return reply;
    }
};
