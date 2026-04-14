import { Schema, model, type Document, Types } from "mongoose";

export type SupportedBank = "mbbank" | "seabank" | "tpbank";

import { encryptAES256, decryptAES256 } from "../utils/crypto";

export interface UserBankApi {
    userId: Types.ObjectId;
    bankCode: SupportedBank;
    bankName: string;
    username: string;
    accountNumber?: string;
    gatewayJwtToken: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserBankApiDocument extends UserBankApi, Document {}

const userBankApiSchema = new Schema<UserBankApiDocument>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        bankCode: { type: String, enum: ["mbbank", "seabank", "tpbank"], required: true },
        bankName: { type: String, default: "MBBank" },
        username: { type: String, required: true },
        accountNumber: { type: String },
        gatewayJwtToken: {
            type: String,
            required: true,
            set: (val: string) => encryptAES256(val),
            get: (val: string) => decryptAES256(val),
        },
    },
    {
        timestamps: true,
        toJSON: { getters: true },
        toObject: { getters: true },
    },
);

userBankApiSchema.index(
    { userId: 1, bankCode: 1, accountNumber: 1 },
    { unique: true },
);

export const UserBankApiModel = model<UserBankApiDocument>(
    "UserBankApi",
    userBankApiSchema,
);
