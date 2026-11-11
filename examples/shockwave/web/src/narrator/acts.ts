// What a guide does in the app, as a visitor would: through the app's own forms
// and buttons. The narrator knows the app's pages and forms; the app knows
// nothing of it.
import { DEMO_PASSWORD } from "../../../shared/personas.ts";

/**
 * Sign in as `email` through the app's sign-in form, as a visitor would:
 * fill in the email and the demo's password, then press its button.
 */
export function signInAs(email: string): void {
    const user = document.querySelector<HTMLInputElement>('input[autocomplete="username"]');
    const password = document.querySelector<HTMLInputElement>('input[autocomplete="current-password"]');
    const submit = user?.form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!user || !password || !submit) return;
    enter(user, email);
    enter(password, DEMO_PASSWORD);
    // A moment to see it filled in before it's sent.
    setTimeout(() => submit.click(), 400);
}

/** Put `value` in `input` as typing does, so that the app's form hears it. */
function enter(input: HTMLInputElement, value: string): void {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
}
