// The computer's screens, as the Window Management API tells of them —
// Chrome's and Edge's, behind a permission the browser asks for once and
// remembers: what Set Up Screens asks for, so that a slide show can fill the
// audience's screen and open the presenter view on the presenter's in the
// one press that starts it — and which of them the show plays on.

/** A screen as the Window Management API describes it. */
export interface ScreenDetailed extends Screen {
    /** Its top-left corner, and its available area's, on the screens' shared
     *  grid. */
    readonly left: number;
    readonly top: number;
    readonly availLeft: number;
    readonly availTop: number;
    readonly isPrimary: boolean;
    readonly label: string;
}

/** The computer's screens, and the one the window is on. */
export interface ScreenDetails {
    readonly screens: readonly ScreenDetailed[];
    readonly currentScreen: ScreenDetailed;
}

/** The permission's name, as `navigator.permissions` takes it. */
const PERMISSION = "window-management" as PermissionName;

type ScreensWindow = Window & { getScreenDetails?: () => Promise<ScreenDetails> };

/** Whether the browser has the Window Management API. */
export function hasScreensApi(): boolean {
    return typeof (window as ScreensWindow).getScreenDetails === "function";
}

/** The computer's screens — asking for the permission the first time, which
 *  takes a press — or `null` where the browser has no such API, or the
 *  permission is refused. */
export async function readScreens(): Promise<ScreenDetails | null> {
    const get = (window as ScreensWindow).getScreenDetails;
    if (typeof get !== "function") return null;
    try {
        return await get.call(window);
    } catch {
        return null;
    }
}

/**
 * Tell `listener` whether the permission is granted — now, and each time it
 * changes, as in the browser's site settings. Never where the browser can't
 * say. Returns a function that stops telling.
 */
export function watchScreensPermission(listener: (granted: boolean) => void): () => void {
    let status: PermissionStatus | null = null;
    let stopped = false;
    const onChange = (): void => {
        if (status) listener(status.state === "granted");
    };
    if (hasScreensApi()) {
        navigator.permissions
            ?.query({ name: PERMISSION })
            .then((answer) => {
                if (stopped) return;
                status = answer;
                answer.addEventListener("change", onChange);
                onChange();
            })
            .catch(() => {
                // The browser doesn't know the permission by this name.
            });
    }
    return () => {
        stopped = true;
        status?.removeEventListener("change", onChange);
    };
}

/** What a screen is chosen by: its name, and where it stands among the
 *  others, which tells two of one model apart. */
export function screenKey(screen: ScreenDetailed): string {
    return `${screen.label}@${screen.left},${screen.top}`;
}

/**
 * The screen a slide show plays on: the one `key` chose — by its name alone,
 * the screens arranged anew — else the first but the one the window is on.
 * `undefined` with no other screen.
 */
export function audienceScreen(details: ScreenDetails, key: string | null): ScreenDetailed | undefined {
    const { screens, currentScreen } = details;
    const label = key?.slice(0, key.lastIndexOf("@"));
    return (
        screens.find((screen) => screenKey(screen) === key) ??
        screens.find((screen) => screen.label === label) ??
        screens.find((screen) => screen !== currentScreen)
    );
}

/** The screen the presenter view shows on while a show plays on `audience`:
 *  the one the window is on, else the first other. */
export function presenterScreen(details: ScreenDetails, audience: ScreenDetailed): ScreenDetailed | undefined {
    const { screens, currentScreen } = details;
    return currentScreen !== audience ? currentScreen : screens.find((screen) => screen !== audience);
}
