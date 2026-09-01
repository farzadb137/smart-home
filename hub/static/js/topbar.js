const GREETING_PERIODS = [
    { untilHour: 5, text: "Good Night" },
    { untilHour: 12, text: "Good Morning" },
    { untilHour: 18, text: "Good Afternoon" },
    { untilHour: 22, text: "Good Evening" },
];

function getGreeting(date) {
    const hour = date.getHours();
    const period = GREETING_PERIODS.find(p => hour < p.untilHour);
    return period ? period.text : "Good Night";
}

export function renderTopbar(userName) {
    const greetingEl = document.querySelector(".greeting-text");
    const dateEl = document.querySelector(".topbar-date");
    const timeEl = document.querySelector(".topbar-time");

    if (!greetingEl || !dateEl || !timeEl)
        return;

    const now = new Date();
    const namePart = userName ? `${userName}` : "";

    greetingEl.textContent = `${getGreeting(now)}, ${namePart}`;
    dateEl.textContent = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
    timeEl.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}