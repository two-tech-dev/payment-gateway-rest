import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { UserModel } from "../models/User";
import { signToken, jwtGuard } from "../middleware/jwtAuth";
import { env } from "../config/env";
import { logActivity } from "../models/ActivityLog";

const oauthCallbackSchema = z.object({
    code: z.string().min(1, "Thieu authorization code"),
    state: z.string().min(1, "Thieu state"),
});

const oauthStateStore = new Map<string, number>();

export default async function authRoutes(
    fastify: FastifyInstance,
): Promise<void> {
    // GET /api/auth/oauth/config
    fastify.get("/auth/oauth/config", async (_request, reply) => {
        const configured = Boolean(
            env.oauthClientId && env.oauthClientSecret && env.oauthRedirectUri,
        );

        return reply.send({
            configured,
            issuerBaseUrl: env.oauthIssuerBaseUrl,
            clientId: env.oauthClientId,
            redirectUri: env.oauthRedirectUri,
            scope: env.oauthScopes,
        });
    });

    // GET /api/auth/oauth/url
    fastify.get("/auth/oauth/url", async (_request, reply) => {
        if (
            !env.oauthClientId ||
            !env.oauthClientSecret ||
            !env.oauthRedirectUri
        ) {
            return reply.code(500).send({
                success: false,
                message: "OAuth chua duoc cau hinh day du",
            });
        }

        const state = randomBytes(24).toString("hex");
        oauthStateStore.set(state, Date.now());

        const authorizeUrl = new URL(
            `${env.oauthIssuerBaseUrl}/oauth/authorize`,
        );
        authorizeUrl.searchParams.set("client_id", env.oauthClientId);
        authorizeUrl.searchParams.set("redirect_uri", env.oauthRedirectUri);
        authorizeUrl.searchParams.set("response_type", "code");
        authorizeUrl.searchParams.set("scope", env.oauthScopes);
        authorizeUrl.searchParams.set("state", state);

        return reply.send({
            success: true,
            state,
            authUrl: authorizeUrl.toString(),
        });
    });

    // POST /api/auth/oauth/callback
    fastify.post("/auth/oauth/callback", async (request, reply) => {
        if (
            !env.oauthClientId ||
            !env.oauthClientSecret ||
            !env.oauthRedirectUri
        ) {
            return reply.code(500).send({
                success: false,
                message: "OAuth chua duoc cau hinh day du",
            });
        }

        const parseResult = oauthCallbackSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.code(400).send({
                success: false,
                message: "Du lieu callback khong hop le",
                issues: parseResult.error.flatten(),
            });
        }

        const { code, state } = parseResult.data;

        const createdAt = oauthStateStore.get(state);
        if (!createdAt || Date.now() - createdAt > 10 * 60 * 1000) {
            oauthStateStore.delete(state);
            return reply.code(400).send({
                success: false,
                message: "State khong hop le hoac da het han",
            });
        }
        oauthStateStore.delete(state);

        try {
            const tokenResponse = await fetch(
                `${env.oauthIssuerBaseUrl}/api/oauth/token`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        grant_type: "authorization_code",
                        code,
                        client_id: env.oauthClientId,
                        client_secret: env.oauthClientSecret,
                        redirect_uri: env.oauthRedirectUri,
                    }),
                },
            );

            if (!tokenResponse.ok) {
                const tokenError = await tokenResponse.text();
                request.log.error({ tokenError }, "Lay OAuth token that bai");
                return reply.code(401).send({
                    success: false,
                    message: "Khong doi duoc access token",
                });
            }

            const tokenData = (await tokenResponse.json()) as {
                access_token?: string;
            };
            if (!tokenData.access_token) {
                return reply.code(401).send({
                    success: false,
                    message: "OAuth provider khong tra ve access_token",
                });
            }

            const userInfoResponse = await fetch(
                `${env.oauthIssuerBaseUrl}/api/oauth/userinfo`,
                {
                    headers: {
                        Authorization: `Bearer ${tokenData.access_token}`,
                    },
                },
            );

            if (!userInfoResponse.ok) {
                const userInfoError = await userInfoResponse.text();
                request.log.error({ userInfoError }, "Lay userinfo that bai");
                return reply.code(401).send({
                    success: false,
                    message: "Khong lay duoc thong tin nguoi dung tu OAuth",
                });
            }

            const userInfo = (await userInfoResponse.json()) as {
                email?: string;
                username?: string;
                sub?: string;
            };

            if (!userInfo.email) {
                return reply.code(400).send({
                    success: false,
                    message: "Tai khoan OAuth khong co email",
                });
            }

            const email = userInfo.email.toLowerCase();
            const name = userInfo.username || userInfo.email;

            let user = await UserModel.findOne({ email });
            if (!user) {
                user = await UserModel.create({
                    email,
                    name,
                    password: randomBytes(32).toString("hex"),
                });
            }

            const token = signToken({
                userId: user._id.toString(),
                email: user.email,
            });

            await logActivity(
                user._id,
                "Đăng nhập hệ thống",
                "Xác thực OAuth thành công",
                request.ip || "Vault Console",
                "auth",
            );

            return reply.send({
                success: true,
                user: {
                    email: user.email,
                    name: user.name,
                    planCode: user.planCode,
                    planPriceVnd: user.planPriceVnd,
                    planDurationDays: user.planDurationDays,
                    subscriptionExpiresAt: user.subscriptionExpiresAt,
                    walletBalanceVnd: user.walletBalanceVnd || 0,
                },
                token,
                oauth: {
                    sub: userInfo.sub,
                },
            });
        } catch (error) {
            request.log.error({ err: error }, "Xu ly OAuth callback that bai");
            return reply.code(500).send({
                success: false,
                message: "Khong the dang nhap bang OAuth",
            });
        }
    });

    // POST /api/auth/login (deprecated)
    fastify.post("/auth/login", async (_request, reply) => {
        return reply.code(410).send({
            success: false,
            message:
                "Phuong thuc dang nhap nay da ngung ho tro. Vui long dang nhap bang Hyper Tech Account (HTA).",
        });
    });

    // POST /api/auth/logout
    fastify.post("/auth/logout", async (_request, reply) => {
        // For JWT, logout is typically handled client-side by removing the token
        return reply.send({
            success: true,
            message: "Dang xuat thanh cong",
        });
    });

    // GET /api/auth/me
    fastify.get(
        "/auth/me",
        { preHandler: jwtGuard },
        async (request, reply) => {
            try {
                const user = await UserModel.findById(
                    request.user?.userId,
                ).select("-password");

                if (!user) {
                    return reply.code(404).send({
                        message: "Khong tim thay nguoi dung",
                    });
                }

                return reply.send({
                    email: user.email,
                    name: user.name,
                    planCode: user.planCode,
                    planPriceVnd: user.planPriceVnd,
                    planDurationDays: user.planDurationDays,
                    subscriptionExpiresAt: user.subscriptionExpiresAt,
                    walletBalanceVnd: user.walletBalanceVnd || 0,
                });
            } catch (error) {
                request.log.error(
                    { err: error },
                    "Lay thong tin user that bai",
                );
                return reply.code(500).send({
                    message: "Khong the lay thong tin nguoi dung",
                });
            }
        },
    );
}
