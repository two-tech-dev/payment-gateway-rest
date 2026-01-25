import Fastify from "fastify";
import { env } from "./config/env";
import { connectMongo } from "./lib/mongo";
import invoiceRoutes from "./routes/invoiceRoutes";
import { startInvoiceReconciliationJob } from "./jobs/invoiceReconciliation";

async function bootstrap(): Promise<void> {
    const app = Fastify({ logger: true });

    try {
        await connectMongo();
        app.log.info("Da ket noi MongoDB thanh cong");
    } catch (error) {
        app.log.error({ err: error }, "Ket noi MongoDB that bai");
        throw error;
    }

    app.register(invoiceRoutes, { prefix: "/api" });

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
