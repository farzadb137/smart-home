export function formatDeviceName(name) {
    if (!name)
        return "Unnamed Device";

    return name
        .replaceAll("_", " ")
        .replace(/\b\w/g, character => character.toUpperCase());
}

// Turns an ISO timestamp (as returned by the hub's readings table)
// into a relative label. Real data only - no fallback to a fake
// "Just now" when we don't actually know.
export function formatRelativeTime(isoString) {
    if (!isoString)
        return "Unknown";

    const then = new Date(isoString);
    if (Number.isNaN(then.getTime()))
        return "Unknown";

    const diffSeconds = Math.round((Date.now() - then.getTime()) / 1000);

    if (diffSeconds < 60)
        return "Just now";
    if (diffSeconds < 3600)
        return `${Math.floor(diffSeconds / 60)} min ago`;
    if (diffSeconds < 86400)
        return `${Math.floor(diffSeconds / 3600)} hr ago`;

    return `${Math.floor(diffSeconds / 86400)} d ago`;
}