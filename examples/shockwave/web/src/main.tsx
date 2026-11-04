// The page: the app — who is signed in, around its routes, the sign-in page
// and the shell with a page for each section — and the narrator bolted on
// beside it. The app's root, `#app`, is all of the window the app knows: its
// dialogs open over it, and leave the narrator in view and in reach.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Navigate, Outlet, RouterProvider, createBrowserRouter } from "react-router";
import "@fontsource-variable/inter";

import { AppShell } from "./AppShell";
import { Narrator } from "./narrator/Narrator";
import { FilePage } from "./pages/FilePage";
import { HomePage } from "./pages/HomePage";
import { LibraryPage } from "./pages/LibraryPage";
import { NotFoundPage, PlaceholderPage } from "./pages/PlaceholderPage";
import { BrandSettings, SettingsPage, UsersSettings } from "./pages/SettingsPage";
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
                    { index: true, element: <HomePage /> },
                    { path: "library", element: <LibraryPage /> },
                    { path: "library/folders/:folderId", element: <LibraryPage /> },
                    { path: "library/files/:assetId", element: <FilePage /> },
                    {
                        path: "collections",
                        element: (
                            <PlaceholderPage
                                title="Collections"
                                subtitle="Content arranged for selling, and how to use it."
                            />
                        ),
                    },
                    {
                        path: "deal-rooms",
                        element: (
                            <PlaceholderPage
                                title="Deal Rooms"
                                subtitle="Content prepared for each deal, and shared with its buyers."
                            />
                        ),
                    },
                    {
                        path: "learning",
                        element: <PlaceholderPage title="Learning" subtitle="What to learn, and what to teach." />,
                    },
                    {
                        path: "insights",
                        element: (
                            <PlaceholderPage
                                title="Insights"
                                subtitle="How content is used and read, up to the buyer."
                            />
                        ),
                    },
                    {
                        path: "settings",
                        element: <SettingsPage />,
                        children: [
                            { index: true, element: <Navigate to="brand" replace /> },
                            { path: "brand", element: <BrandSettings /> },
                            { path: "users", element: <UsersSettings /> },
                        ],
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
