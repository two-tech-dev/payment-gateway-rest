import type {
    FastifyReply,
    FastifyRequest,
    preHandlerHookHandler,
} from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtPayload {
    userId: string;
    email: string;
}

declare module "fastify" {
    interface FastifyRequest {
        user?: JwtPayload;
    }
}

export function signToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
    try {
        return jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] }) as JwtPayload;
    } catch {
        return null;
    }
}

export const jwtGuard: preHandlerHookHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        reply.code(401).send({
            message: "Khong duoc phep: Token khong hop le",
        });
        return reply;
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
        reply.code(401).send({
            message: "Khong duoc phep: Token het han hoac khong hop le",
        });
        return reply;
    }

    request.user = payload;
};
