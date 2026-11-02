// The page: the app — who is signed in, around its routes, the sign-in page
// and the shell with a page for each section — and the narrator bolted on
// beside it.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Outlet, RouterProvider, createBrowserRouter } from "react-router";

import { AppShell } from "./AppShell";
import { Narrator } from "./narrator/Narrator";
import { NotFoundPage, PlaceholderPage } from "./pages/PlaceholderPage";
import { SignInPage } from "./pages/SignInPage";
import { RequireSession, SessionProvider } from "./session";
import "./app.css";

const router = createBrowserRouter([
    {
        element: (
            <div className="stage">
                <div className="stage-app">
                    <SessionProvider>
                        <Outlet />
                    </SessionProvider>
                </div>
                <Narrator />
            </div>
        ),
        children: [
            { path: "/sign-in", element: <SignInPage /> },
            {
                element: (
                    <RequireSession>
                        <AppShell />
                    </RequireSession>
                ),
                children: [
                    {
                        index: true,
                        element: <PlaceholderPage title="Home" subtitle="What's new, and what needs you." />,
                    },
                    {
                        path: "library",
                        element: (
                            <PlaceholderPage
                                title="Library"
                                subtitle="Every deck, datasheet and case study Acme's sellers use."
                            />
                        ),
                    },
                    {
                        path: "decks",
                        element: (
                            <PlaceholderPage
                                title="Decks"
                                subtitle="Decks built for a deal, from the library's slides."
                            />
                        ),
                    },
                    {
                        path: "deals",
                        element: (
                            <PlaceholderPage
                                title="Deals"
                                subtitle="Each deal's buyers, and what's been shared with them."
                            />
                        ),
                    },
                    {
                        path: "analytics",
                        element: (
                            <PlaceholderPage
                                title="Analytics"
                                subtitle="How the library's content is used, and read."
                            />
                        ),
                    },
                    { path: "*", element: <NotFoundPage /> },
                ],
            },
        ],
    },
]);

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>,
);
