import { apiRequestFn } from "./api.js";

const RANGE_LABEL_FORMATS = {
    "24h": { hour: "2-digit", minute: "2-digit" },
    "7d": { weekday: "short", hour: "2-digit" },
    "30d": { month: "short", day: "numeric" }
};

// Backend timestamps come in two shapes depending on source:
//  - raw readings (Python's datetime.isoformat()): "...T15:43:47+00:00"
//  - SQLite strftime() rollups (7d/30d):           "...T15:00:00" (no offset)
// Only append "Z" when there's genuinely no timezone info already -
// blindly appending it to the first shape produces an invalid
// double-marked string ("...+00:00Z") that Date() silently rejects.
function toParsableIso(timestamp) {
    const hasTimezone = /[Zz]$|[+-]\d{2}:\d{2}$/.test(timestamp);
    return hasTimezone ? timestamp : timestamp + "Z";
}

export function renderHistoryChart(canvas, points, rangeKey) {
    if (!canvas)
        return null;

    const labelFormat = RANGE_LABEL_FORMATS[rangeKey] || RANGE_LABEL_FORMATS["24h"];

    const validPoints = points.filter(p => !Number.isNaN(new Date(toParsableIso(p.timestamp)).getTime()));

    if (validPoints.length < points.length)
        console.warn(`Dropped ${points.length - validPoints.length} history point(s) with unparsable timestamps`);

    const labels = validPoints.map(p => new Date(toParsableIso(p.timestamp)).toLocaleString([], labelFormat));
    const averages = validPoints.map(p => p.value_avg);
    const minimums = validPoints.map(p => p.value_min);
    const maximums = validPoints.map(p => p.value_max);

    return new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Max",
                    data: maximums,
                    borderColor: "transparent",
                    backgroundColor: "rgba(230,161,92,0.12)",
                    pointRadius: 0,
                    fill: "+1"
                },
                {
                    label: "Min",
                    data: minimums,
                    borderColor: "transparent",
                    backgroundColor: "rgba(230,161,92,0.12)",
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: "Average",
                    data: averages,
                    borderColor: "#e6a15c",
                    backgroundColor: "transparent",
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    filter: (item) => item.dataset.label === "Average"
                }
            },
            scales: {
                x: { ticks: { color: "#a9a19a", maxTicksLimit: 6 }, grid: { display: false } },
                y: { ticks: { color: "#a9a19a" }, grid: { color: "#3a312b" } }
            }
        }
    });
}

export async function fetchDeviceHistory(hardwareIdHex, capability, range) {
    return apiRequestFn(`/devices/${encodeURIComponent(hardwareIdHex)}/history?capability=${encodeURIComponent(capability)}&range=${encodeURIComponent(range)}`);
}