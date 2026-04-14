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
    gatewayApiBaseUrl: process.env.GATEWAY_API_BASE_URL || "",
    gatewayApiPrefix: process.env.GATEWAY_API_PREFIX || "/api/v1",
    gatewayAdminToken: process.env.GATEWAY_ADMIN_TOKEN || "",
    memoPrefix: "HTS",

    // Deposit System Bank (Custom via ENV)
    depositBankCode: process.env.DEPOSIT_BANK_CODE,
    depositAccountNumber: process.env.DEPOSIT_ACCOUNT_NUMBER,
    depositAccountName: process.env.DEPOSIT_ACCOUNT_NAME,
    depositGatewayJwt: process.env.DEPOSIT_GATEWAY_JWT,

    // JWT
    jwtSecret: process.env.JWT_SECRET || "hypertech-jwt-secret-key-2024",

    // HTA OAuth
    oauthIssuerBaseUrl:
        process.env.OAUTH_ISSUER_BASE_URL || "https://account.hypertech.xyz",
    oauthClientId: process.env.OAUTH_CLIENT_ID || "",
    oauthClientSecret: process.env.OAUTH_CLIENT_SECRET || "",
    oauthRedirectUri:
        process.env.OAUTH_REDIRECT_URI || "http://localhost:3000/login",
    oauthScopes:
        process.env.OAUTH_SCOPES || "openid profile_basic profile_email",

    // Admin user for seeding
    adminEmail: process.env.ADMIN_EMAIL || "admin@hpayment.vn",
    adminPassword: process.env.ADMIN_PASSWORD || "admin123",
    adminName: process.env.ADMIN_NAME || "Admin",
};
