import { Schema, model, type Document } from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";

export interface User {
    email: string;
    password: string;
    name: string;
    planCode: "starter_monthly";
    planPriceVnd: number;
    planDurationDays: number;
    subscriptionExpiresAt?: Date;
    walletBalanceVnd: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserDocument extends User, Document {
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<UserDocument>(
    {
        email: { type: String, required: true, unique: true, lowercase: true },
        password: { type: String, required: true },
        name: { type: String, required: true },
        planCode: { type: String, default: "starter_monthly" },
        planPriceVnd: { type: Number, default: 30000 },
        planDurationDays: { type: Number, default: 30 },
        subscriptionExpiresAt: { type: Date },
        walletBalanceVnd: { type: Number, default: 0 },
    },
    {
        timestamps: true,
    },
);

// Hash password before saving
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (
    candidatePassword: string,
): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

export const UserModel = model<UserDocument>("User", userSchema);

// Seed default admin user if not exists (uses env variables)
export async function seedAdminUser(): Promise<void> {
    const existingAdmin = await UserModel.findOne({ email: env.adminEmail });
    if (!existingAdmin) {
        await UserModel.create({
            email: env.adminEmail,
            password: env.adminPassword,
            name: env.adminName,
            planCode: "starter_monthly",
            planPriceVnd: 30000,
            planDurationDays: 30,
            subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        return;
    }

    let needsSave = false;
    if (!existingAdmin.planCode) {
        existingAdmin.planCode = "starter_monthly";
        needsSave = true;
    }
    if (!existingAdmin.planPriceVnd) {
        existingAdmin.planPriceVnd = 30000;
        needsSave = true;
    }
    if (!existingAdmin.planDurationDays) {
        existingAdmin.planDurationDays = 30;
        needsSave = true;
    }
    if (!existingAdmin.subscriptionExpiresAt) {
        existingAdmin.subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        needsSave = true;
    }
    if (needsSave) {
        await existingAdmin.save();
    }
}
