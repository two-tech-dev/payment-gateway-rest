import gatewayConfig from "../config/gatewayConfig";

const allowedOrigins = new Set(
    gatewayConfig.allowedSites
        .map((site) => normalizeSiteOrigin(site))
        .filter((origin): origin is string => Boolean(origin)),
);

export function normalizeSiteOrigin(siteUrl: string): string | null {
    try {
        return new URL(siteUrl).origin.toLowerCase();
    } catch (error) {
        return null;
    }
}

export function isSiteAllowed(siteUrl: string): boolean {
    const origin = normalizeSiteOrigin(siteUrl);

    if (!origin) {
        return false;
    }

    if (allowedOrigins.size === 0) {
        return false;
    }

    return allowedOrigins.has(origin);
}
