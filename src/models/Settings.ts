import { Schema, model, type Document } from "mongoose";

export interface Settings {
    apiKey: string;
    webhookUrl: string;
    allowedSites: string[];
    updatedAt: Date;
}

export interface SettingsDocument extends Settings, Document { }

const settingsSchema = new Schema<SettingsDocument>(
    {
        apiKey: { type: String, required: true },
        webhookUrl: { type: String, default: "" },
        allowedSites: { type: [String], default: [] },
    },
    {
        timestamps: true,
    },
);

export const SettingsModel = model<SettingsDocument>("Settings", settingsSchema);

// Helper to get or create singleton settings document
export async function getSettings(): Promise<SettingsDocument> {
    let settings = await SettingsModel.findOne();
    if (!settings) {
        settings = await SettingsModel.create({
            apiKey: generateApiKey(),
            webhookUrl: "",
            allowedSites: [],
        });
    }
    return settings;
}

// Helper to generate API key
export function generateApiKey(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const segments = [];
    for (let s = 0; s < 4; s++) {
        let segment = "";
        for (let i = 0; i < 4; i++) {
            segment += chars[Math.floor(Math.random() * chars.length)];
        }
        segments.push(segment);
    }
    return `hypertech-api-${segments.join("-")}`;
}
