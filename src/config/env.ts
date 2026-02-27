import dotenv from "dotenv";

dotenv.config();

const requiredVars = ["MONGO_URI"] as const;

for (const variable of requiredVars) {
    if (!process.env[variable]) {
        throw new Error(`Thieu bien moi truong bat buoc: ${variable}`);
    }
}

export const env = {
    port: Number(process.env.PORT) || 4000,
    mongoUri: process.env.MONGO_URI as string,
    apiKey: process.env.API_KEY,
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
    historyApiMbToken:
        process.env.HISTORY_API_MBBANK_TOKEN || process.env.HISTORY_API_TOKEN,
    historyApiVcbToken: process.env.HISTORY_API_VCB_TOKEN,
    memoPrefix: "HTS",

    // JWT
    jwtSecret: process.env.JWT_SECRET || "hypertech-jwt-secret-key-2024",

    // Admin user for seeding
    adminEmail: process.env.ADMIN_EMAIL || "admin@hpayment.vn",
    adminPassword: process.env.ADMIN_PASSWORD || "admin123",
    adminName: process.env.ADMIN_NAME || "Admin",
};
