import crypto from "crypto";
import { Schema, model, type Document, Types } from "mongoose";

export interface Settings {
    userId: Types.ObjectId;
    apiKey: string;
    webhookUrl: string;
    allowedSites: string[];
    updatedAt: Date;
}

export interface SettingsDocument extends Settings, Document { }

const settingsSchema = new Schema<SettingsDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
        apiKey: { type: String, required: true },
        webhookUrl: { type: String, default: "" },
        allowedSites: { type: [String], default: [] },
    },
    {
        timestamps: true,
    },
);

export const SettingsModel = model<SettingsDocument>("Settings", settingsSchema);

// Helper to get or create per-user settings document
export async function getSettings(userId: string): Promise<SettingsDocument> {
    let settings = await SettingsModel.findOne({ userId });
    if (!settings) {
        settings = await SettingsModel.create({
            userId,
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
