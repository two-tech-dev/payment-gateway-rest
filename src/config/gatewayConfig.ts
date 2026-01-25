import rawConfig from "../../config/config.js";

type RawGatewayConfig = {
    allowedSites?: unknown;
    fallbackApiKey?: string;
    defaultCurrency?: string;
};

type GatewayConfig = {
    allowedSites: string[];
    fallbackApiKey?: string;
    defaultCurrency: string;
};

const normalizedConfig = (rawConfig as RawGatewayConfig) || {};

const allowedSites = Array.isArray(normalizedConfig.allowedSites)
    ? normalizedConfig.allowedSites
          .map((site) => (typeof site === "string" ? site.trim() : ""))
          .filter((site) => Boolean(site))
    : [];

const gatewayConfig: GatewayConfig = {
    allowedSites,
    fallbackApiKey: normalizedConfig.fallbackApiKey,
    defaultCurrency: normalizedConfig.defaultCurrency || "VND",
};

export default gatewayConfig;
