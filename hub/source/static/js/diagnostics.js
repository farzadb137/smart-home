// Browser performance tooling can inject its own Web Vitals code into the page.
// Some current builds have a reportAllChanges/startTime exception that originates
// outside this application (for example, a VM### script in DevTools/extensions).
// Keep the application from surfacing that third-party exception as an app error,
// while leaving all application errors untouched.

let externalVitalsWarningShown = false;

function isExternalVitalsError(event) {
    const message = String(event?.message || "");
    const filename = String(event?.filename || "");
    const stack = String(event?.error?.stack || "");

    const looksLikeVitals =
        message.includes("Cannot read properties of undefined") &&
        (message.includes("startTime") || stack.includes("reportAllChanges"));

    const looksInjected =
        /^VM\d+$/i.test(filename) ||
        filename.startsWith("chrome-extension://") ||
        filename.startsWith("moz-extension://");

    return looksLikeVitals && looksInjected;
}

export function initDiagnostics() {
    window.addEventListener("error", event => {
        if (!isExternalVitalsError(event)) return;

        if (!externalVitalsWarningShown) {
            externalVitalsWarningShown = true;
            console.warn(
                "Ignored a browser-injected Web Vitals reportAllChanges error. " +
                "This does not originate from the Smart Home application."
            );
        }

        // Prevent a known third-party injected exception from appearing as an
        // application runtime error. Other errors continue normally.
        event.preventDefault();
    });
}
