import { getSettings } from "../models/Settings";

export function normalizeSiteOrigin(siteUrl: string): string | null {
    try {
        return new URL(siteUrl).origin.toLowerCase();
    } catch (error) {
        return null;
    }
}

export async function isSiteAllowed(siteUrl: string, userId: string): Promise<boolean> {
    const origin = normalizeSiteOrigin(siteUrl);

    if (!origin) {
        return false;
    }

    const settings = await getSettings(userId);
    const allowedOrigins = new Set(
        settings.allowedSites
            .map((site) => normalizeSiteOrigin(site))
            .filter((o): o is string => Boolean(o)),
    );

    if (allowedOrigins.size === 0) {
        return false;
    }

    return allowedOrigins.has(origin);
}
