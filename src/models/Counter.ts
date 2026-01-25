import { Schema, model } from "mongoose";

interface CounterDocument {
    _id: string;
    seq: number;
}

const counterSchema = new Schema<CounterDocument>(
    {
        _id: { type: String, required: true },
        seq: { type: Number, default: 1000 },
    },
    {
        versionKey: false,
    },
);

const CounterModel = model<CounterDocument>(
    "Counter",
    counterSchema,
    "counters",
);

export async function getNextSequence(sequenceName: string): Promise<number> {
    const updatedCounter = await CounterModel.findByIdAndUpdate(
        sequenceName,
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    if (!updatedCounter) {
        throw new Error(`Tang counter that bai: ${sequenceName}`);
    }

    return updatedCounter.seq;
}
