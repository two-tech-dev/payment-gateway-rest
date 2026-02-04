import { Schema, model, type Document } from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";

export interface User {
    email: string;
    password: string;
    name: string;
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
        });
    }
}
