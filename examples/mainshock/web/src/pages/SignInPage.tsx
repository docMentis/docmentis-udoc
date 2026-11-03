// Signing in: a work email and a password.
import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router";

import { ApiError } from "../api";
import { Logo } from "../icons";
import { useSession } from "../session";
import { useDocumentTitle } from "../ui";

export function SignInPage() {
    useDocumentTitle("Sign in");
    const { user, signIn } = useSession();
    const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [signingIn, setSigningIn] = useState(false);
    const [error, setError] = useState<string>();

    async function submit(event: FormEvent) {
        event.preventDefault();
        setSigningIn(true);
        setError(undefined);
        try {
            // Signed in, the page sends them on, below.
            await signIn(email, password);
        } catch (failure) {
            setError(
                failure instanceof ApiError && failure.status === 401
                    ? "That email and password don't match."
                    : "Mainshock's server didn't answer. Try again.",
            );
            setSigningIn(false);
        }
    }

    // Back where they were sent here from.
    if (user) return <Navigate to={from} replace />;
    return (
        <div className="sign-in">
            <form className="sign-in-card" onSubmit={(event) => void submit(event)}>
                <div className="brand">
                    <Logo size={32} />
                    <span>Mainshock</span>
                </div>
                <h1>Sign in</h1>
                <label className="field">
                    <span>Email</span>
                    <input
                        type="email"
                        value={email}
                        autoComplete="username"
                        autoFocus
                        required
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </label>
                <label className="field">
                    <span>Password</span>
                    <input
                        type="password"
                        value={password}
                        autoComplete="current-password"
                        required
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </label>
                {error && (
                    <p className="error" role="alert">
                        {error}
                    </p>
                )}
                <button type="submit" className="button primary" disabled={signingIn}>
                    {signingIn ? "Signing in…" : "Sign in"}
                </button>
            </form>
        </div>
    );
}
