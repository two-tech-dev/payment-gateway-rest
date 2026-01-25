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
    historyApiToken: process.env.HISTORY_API_TOKEN,
    memoPrefix: "HTS",
};
