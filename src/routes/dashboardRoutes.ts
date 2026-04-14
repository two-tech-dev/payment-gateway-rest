import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { InvoiceModel } from "../models/Invoice";
import { jwtGuard } from "../middleware/jwtAuth";

const revenueQuerySchema = z.object({
    days: z.coerce.number().int().positive().default(7),
});

const recentTransactionsQuerySchema = z.object({
    limit: z.coerce.number().int().positive().default(5),
});

// Helper to format date as DD/MM
function formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${day}/${month}`;
}

// Helper to get start of day
function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Helper to get end of day
function endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

// Helper to get start of month
function startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

// Helper to get end of month
function endOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export default async function dashboardRoutes(
    fastify: FastifyInstance,
): Promise<void> {
    // GET /api/dashboard/stats
    fastify.get("/dashboard/stats", { preHandler: jwtGuard }, async (request, reply) => {
        try {
            const userId = request.user!.userId;
            const now = new Date();
            const todayStart = startOfDay(now);
            const todayEnd = endOfDay(now);
            const monthStart = startOfMonth(now);
            const monthEnd = endOfMonth(now);

            // Last month range
            const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthStart = startOfMonth(lastMonthDate);
            const lastMonthEnd = endOfMonth(lastMonthDate);

            // Query for today's stats
            const todayStats = await InvoiceModel.aggregate([
                {
                    $match: {
                        userId: userId,
                        status: "completed",
                        completedAt: { $gte: todayStart, $lte: todayEnd },
                    },
                },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: "$amount" },
                        bills: { $sum: 1 },
                    },
                },
            ]);

            // Query for this month's stats
            const monthlyStats = await InvoiceModel.aggregate([
                {
                    $match: {
                        userId: userId,
                        status: "completed",
                        completedAt: { $gte: monthStart, $lte: monthEnd },
                    },
                },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: "$amount" },
                        bills: { $sum: 1 },
                    },
                },
            ]);

            // Query for last month's stats
            const lastMonthStats = await InvoiceModel.aggregate([
                {
                    $match: {
                        userId: userId,
                        status: "completed",
                        completedAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
                    },
                },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: "$amount" },
                        bills: { $sum: 1 },
                    },
                },
            ]);

            return reply.send({
                todayRevenue: todayStats[0]?.revenue || 0,
                monthlyRevenue: monthlyStats[0]?.revenue || 0,
                todayBills: todayStats[0]?.bills || 0,
                monthlyBills: monthlyStats[0]?.bills || 0,
                lastMonthRevenue: lastMonthStats[0]?.revenue || 0,
                lastMonthBills: lastMonthStats[0]?.bills || 0,
            });
        } catch (error) {
            request.log.error({ err: error }, "Lấy thống kê dashboard thất bại");
            return reply.code(500).send({ message: "Không thể lấy thống kê dashboard" });
        }
    });

    // GET /api/charts/revenue?days=7
    fastify.get("/charts/revenue", { preHandler: jwtGuard }, async (request, reply) => {
        const parseResult = revenueQuerySchema.safeParse(request.query);
        const days = parseResult.success ? parseResult.data.days : 7;

        try {
            const userId = request.user!.userId;
            const now = new Date();
            const result: { date: string; revenue: number; bills: number }[] = [];

            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                const dayStart = startOfDay(date);
                const dayEnd = endOfDay(date);

                const dayStats = await InvoiceModel.aggregate([
                    {
                        $match: {
                            userId: userId,
                            status: "completed",
                            completedAt: { $gte: dayStart, $lte: dayEnd },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            revenue: { $sum: "$amount" },
                            bills: { $sum: 1 },
                        },
                    },
                ]);

                result.push({
                    date: formatDate(date),
                    revenue: dayStats[0]?.revenue || 0,
                    bills: dayStats[0]?.bills || 0,
                });
            }

            return reply.send(result);
        } catch (error) {
            request.log.error({ err: error }, "Lấy biểu đồ doanh thu thất bại");
            return reply.code(500).send({ message: "Không thể lấy dữ liệu biểu đồ" });
        }
    });

    // GET /api/transactions/recent?limit=5
    fastify.get("/transactions/recent", { preHandler: jwtGuard }, async (request, reply) => {
        const parseResult = recentTransactionsQuerySchema.safeParse(request.query);
        const limit = parseResult.success ? parseResult.data.limit : 5;

        try {
            const userId = request.user!.userId;
            const transactions = await InvoiceModel.find({ userId })
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();

            const result = transactions.map((tx) => ({
                id: `INV-${tx.invoiceId.toString().padStart(6, "0")}`,
                amount: tx.amount,
                status: tx.status === "completed" ? "completed" :
                    tx.status === "pending" ? "pending" : "expired",
                time: new Date(tx.createdAt).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                description: tx.description || `Order #${tx.invoiceId}`,
            }));

            return reply.send(result);
        } catch (error) {
            request.log.error({ err: error }, "Lấy giao dịch gần đây thất bại");
            return reply.code(500).send({ message: "Không thể lấy giao dịch" });
        }
    });
}
