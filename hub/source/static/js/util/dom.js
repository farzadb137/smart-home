export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ],
  );
}

export function unique(values) {
  return [...new Set(values)];
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function initials(name) {
    return (name || "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((x) => x[0])
        .join("")
        .toUpperCase() || "U";
}

export function formatTimestamp(isoString, style = 'medium') {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: style,
    timeStyle: 'short'
  }).format(date);
}
