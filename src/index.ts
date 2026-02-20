import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env";
import { connectMongo } from "./lib/mongo";
import invoiceRoutes from "./routes/invoiceRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import settingsRoutes from "./routes/settingsRoutes";
import authRoutes from "./routes/authRoutes";
import { startInvoiceReconciliationJob } from "./jobs/invoiceReconciliation";
import { seedAdminUser } from "./models/User";

async function bootstrap(): Promise<void> {
    const app = Fastify({ logger: true });

    // Enable CORS
    await app.register(cors, {
        origin: true, // Allow all origins
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Webhook-Signature", "X-Webhook-Timestamp"],
    });

    try {
        await connectMongo();
        app.log.info("Da ket noi MongoDB thanh cong");

        // Seed admin user
        await seedAdminUser();
        app.log.info("Da kiem tra/tao admin user");
    } catch (error) {
        app.log.error({ err: error }, "Ket noi MongoDB that bai");
        throw error;
    }

    app.register(invoiceRoutes, { prefix: "/api" });
    app.register(dashboardRoutes, { prefix: "/api" });
    app.register(settingsRoutes, { prefix: "/api" });
    app.register(authRoutes, { prefix: "/api" });

    startInvoiceReconciliationJob(app.log);

    try {
        await app.listen({ port: env.port, host: "0.0.0.0" });
        app.log.info(`Hyper Tech Payment API dang chay tren cong ${env.port}`);
    } catch (error) {
        app.log.error(error);
        throw error;
    }
}

bootstrap().catch((error) => {
    console.error("Hyper Tech Payment API khoi dong that bai", error);
    process.exit(1);
});
