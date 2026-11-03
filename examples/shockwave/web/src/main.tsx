// The page: the app — who is signed in, around its routes, the sign-in page
// and the shell with a page for each section — and the narrator bolted on
// beside it. The app's root, `#app`, is all of the window the app knows: its
// dialogs open over it, and leave the narrator in view and in reach.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Outlet, RouterProvider, createBrowserRouter } from "react-router";
import "@fontsource-variable/inter";

import { AppShell } from "./AppShell";
import { Narrator } from "./narrator/Narrator";
import { FilePage } from "./pages/FilePage";
import { LibraryPage } from "./pages/LibraryPage";
import { NotFoundPage, PlaceholderPage } from "./pages/PlaceholderPage";
import { SignInPage } from "./pages/SignInPage";
import { RequireSession, SessionProvider } from "./session";
import "./app.css";

const router = createBrowserRouter([
    {
        element: (
            <div className="stage">
                <div id="app" className="stage-app">
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
                        element: <PlaceholderPage title="Home" subtitle="What's new, and what needs your attention." />,
                    },
                    { path: "library", element: <LibraryPage /> },
                    { path: "library/folders/:folderId", element: <LibraryPage /> },
                    { path: "library/files/:assetId", element: <FilePage /> },
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
                            <PlaceholderPage title="Analytics" subtitle="How the library's content is used and read." />
                        ),
                    },
                    {
                        path: "settings",
                        element: (
                            <PlaceholderPage title="Settings" subtitle="The workspace's name, logo and members." />
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
