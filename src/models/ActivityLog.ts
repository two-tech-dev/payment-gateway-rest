import mongoose from "mongoose";

export interface IActivityLog extends mongoose.Document {
    userId: mongoose.Types.ObjectId;
    action: string;
    detail: string;
    source: string;
    type: "auth" | "bank" | "security" | "settings" | "billing";
    createdAt: Date;
}

const activityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    action: { type: String, required: true },
    detail: { type: String, required: true },
    source: { type: String, required: true },
    type: {
        type: String,
        enum: ["auth", "bank", "security", "settings", "billing"],
        required: true,
    },
    createdAt: { type: Date, default: Date.now },
});

// Index for fast querying by user
activityLogSchema.index({ userId: 1, createdAt: -1 });

export const ActivityLogModel = mongoose.model<IActivityLog>(
    "ActivityLog",
    activityLogSchema,
);

export async function logActivity(
    userId: string | mongoose.Types.ObjectId,
    action: string,
    detail: string,
    source: string,
    type: IActivityLog["type"],
): Promise<void> {
    try {
        await ActivityLogModel.create({
            userId,
            action,
            detail,
            source,
            type,
        });
    } catch (error) {
        console.error("Ghi log activity that bai:", error);
    }
}
