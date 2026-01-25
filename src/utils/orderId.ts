export function parseOrderId(
    description: string,
    memoPrefix: string,
): number | null {
    if (!description || !memoPrefix) {
        return null;
    }

    const pattern = new RegExp(`${memoPrefix}\\d+`, "i");
    const match = description.match(pattern);

    if (!match) {
        return null;
    }

    const orderCode = match[0];
    const numericPart = orderCode.slice(memoPrefix.length);
    const orderId = Number.parseInt(numericPart, 10);

    return Number.isNaN(orderId) ? null : orderId;
}
