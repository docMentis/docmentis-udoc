// Who is signed in, for every page: loaded once, and changed by signing in
// and out.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Navigate } from "react-router";

import type { Tenant, User } from "../../shared/api.ts";
import { api } from "./api";

interface Session {
    /** The user signed in: `null` for no one, `undefined` until it's known. */
    user: User | null | undefined;
    signIn(email: string, password: string): Promise<void>;
    signOut(): Promise<void>;
    /** Show the user's tenant as it is now, changed in the workspace's settings. */
    setTenant(tenant: Tenant): void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null | undefined>(undefined);
    useEffect(() => {
        let gone = false;
        api.session().then((found) => gone || setUser(found));
        return () => {
            gone = true;
        };
    }, []);
    const signIn = useCallback(
        async (email: string, password: string) => setUser(await api.signIn(email, password)),
        [],
    );
    const signOut = useCallback(async () => {
        await api.signOut();
        setUser(null);
    }, []);
    const setTenant = useCallback((tenant: Tenant) => setUser((before) => before && { ...before, tenant }), []);
    const session = useMemo(() => ({ user, signIn, signOut, setTenant }), [user, signIn, signOut, setTenant]);
    return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
    const session = useContext(SessionContext);
    if (!session) throw new Error("useSession is for a page inside SessionProvider");
    return session;
}

/** The user signed in, for a page inside `RequireSession`. */
export function useUser(): User {
    const { user } = useSession();
    if (!user) throw new Error("useUser is for a page inside RequireSession");
    return user;
}

/** `children` for a user signed in; the sign-in page for no one. */
export function RequireSession({ children }: { children: ReactNode }) {
    const { user } = useSession();
    if (user === undefined) return null;
    if (!user) return <Navigate to="/sign-in" replace />;
    return children;
}
