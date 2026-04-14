import crypto from "node:crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-cbc";
const ENCRYPTION_KEY = crypto.scryptSync(
    env.jwtSecret || "default-secret",
    "salt",
    32,
);

export function encryptAES256(text: string): string {
    if (!text) return text;
    // Prevent double encryption by checking if it already matches the iv:encrypted format
    if (text.includes(":") && text.split(":")[0].length === 32) return text;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return `${iv.toString("hex")}:${encrypted}`;
}

export function decryptAES256(encryptedData: string): string {
    if (!encryptedData || !encryptedData.includes(":")) return encryptedData;

    try {
        const [ivHex, encryptedText] = encryptedData.split(":");
        if (ivHex.length !== 32) return encryptedData; // Safety check

        const iv = Buffer.from(ivHex, "hex");
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch (e) {
        return encryptedData;
    }
}
