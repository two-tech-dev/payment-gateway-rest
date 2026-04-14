import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { jwtGuard } from "../middleware/jwtAuth";
import { UserModel } from "../models/User";
import { ActivityLogModel, logActivity } from "../models/ActivityLog";

const renewSchema = z.object({
    months: z.number().int().min(1).max(12).default(1),
});

const PLAN_PRICE_PER_MONTH = 30000;

function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export default async function accountRoutes(
    fastify: FastifyInstance,
): Promise<void> {
    fastify.get(
        "/account/overview",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const user = await UserModel.findById(request.user?.userId);
            if (!user) {
                return reply
                    .code(404)
                    .send({ message: "Khong tim thay nguoi dung" });
            }

            const now = Date.now();
            const active = Boolean(
                user.subscriptionExpiresAt &&
                user.subscriptionExpiresAt.getTime() > now,
            );

            return reply.send({
                wallet: {
                    balanceVnd: user.walletBalanceVnd || 0,
                },
                subscription: {
                    active,
                    planCode: user.planCode,
                    planPriceVnd: user.planPriceVnd,
                    planDurationDays: user.planDurationDays,
                    expiresAt: user.subscriptionExpiresAt,
                },
            });
        },
    );

    fastify.post(
        "/account/subscription/renew",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const parsed = renewSchema.safeParse(request.body);
            if (!parsed.success) {
                return reply.code(400).send({
                    success: false,
                    message: "Payload không hợp lệ",
                    issues: parsed.error.flatten(),
                });
            }

            const user = await UserModel.findById(request.user?.userId);
            if (!user) {
                return reply.code(404).send({
                    success: false,
                    message: "Khong tim thay nguoi dung",
                });
            }

            const months = parsed.data.months;
            const totalCost = PLAN_PRICE_PER_MONTH * months;

            if ((user.walletBalanceVnd || 0) < totalCost) {
                return reply.code(400).send({
                    success: false,
                    message: "So du vi khong du de gia han goi",
                    requiredVnd: totalCost,
                    balanceVnd: user.walletBalanceVnd || 0,
                });
            }

            const now = new Date();
            const base =
                user.subscriptionExpiresAt && user.subscriptionExpiresAt > now
                    ? user.subscriptionExpiresAt
                    : now;

            user.subscriptionExpiresAt = addDays(base, 30 * months);
            user.walletBalanceVnd = (user.walletBalanceVnd || 0) - totalCost;
            await user.save();

            await logActivity(
                user._id,
                "Gia hạn gói đăng ký",
                `Gia hạn gói ${user.planCode} thêm ${months} tháng`,
                "Thanh toán tự động",
                "billing",
            );

            return reply.send({
                success: true,
                message: "Gia han goi thanh cong",
                wallet: { balanceVnd: user.walletBalanceVnd },
                subscription: {
                    active: true,
                    planCode: user.planCode,
                    planPriceVnd: user.planPriceVnd,
                    planDurationDays: user.planDurationDays,
                    expiresAt: user.subscriptionExpiresAt,
                },
            });
        },
    );

    fastify.get(
        "/account/activities",
        { preHandler: jwtGuard },
        async (request, reply) => {
            const activities = await ActivityLogModel.find({
                userId: request.user?.userId,
            })
                .sort({ createdAt: -1 })
                .limit(20)
                .lean();

            return reply.send(
                activities.map((a) => ({
                    action: a.action,
                    detail: a.detail,
                    source: a.source,
                    type: a.type,
                    time: formatTimeAgo(a.createdAt),
                })),
            );
        },
    );
}

function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " năm trước";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " tháng trước";
    interval = seconds / 86400;
    if (interval > 1) {
        if (Math.floor(interval) === 1) return "Hôm qua";
        return Math.floor(interval) + " ngày trước";
    }
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " giờ trước";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " phút trước";
    return Math.floor(seconds) + " giây trước";
}
