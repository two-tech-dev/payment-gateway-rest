import type { FastifyReply, FastifyRequest } from "fastify";
import { normalizeSiteOrigin } from "../utils/siteGuard";

const ALLOWED_CHECK_ORIGINS = new Set([
    "https://payment.hypertechstudio.xyz",
    "http://localhost:3000",
]);

export async function originGuard(
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<void> {
    const origin = request.headers.origin;
    const referer = request.headers.referer;

    // Lấy origin từ header Origin hoặc Referer
    const requestOrigin =
        origin || (referer ? normalizeSiteOrigin(referer) : null);

    if (!requestOrigin) {
        return reply.code(403).send({
            message: "Khong xac dinh duoc nguon goc request",
        });
    }

    const normalizedOrigin = normalizeSiteOrigin(requestOrigin);

    if (!normalizedOrigin || !ALLOWED_CHECK_ORIGINS.has(normalizedOrigin)) {
        return reply.code(403).send({
            message: "Khong duoc phep truy cap tu origin nay",
        });
    }
}
