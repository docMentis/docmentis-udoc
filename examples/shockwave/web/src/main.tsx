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
import { CollectionFilePage } from "./pages/CollectionFilePage";
import { CollectionPage } from "./pages/CollectionPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { DealRoomFilePage } from "./pages/DealRoomFilePage";
import { DealRoomPage } from "./pages/DealRoomPage";
import { DealRoomsPage } from "./pages/DealRoomsPage";
import { FilePage } from "./pages/FilePage";
import { FrontstageFilePage, FrontstagePage } from "./pages/FrontstagePage";
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
            // What a buyer opens, at a link, with no account.
            { path: "/rooms/:token", element: <FrontstagePage /> },
            { path: "/rooms/:token/files/:fileId", element: <FrontstageFilePage /> },
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
                    { path: "collections", element: <CollectionsPage /> },
                    { path: "collections/:collectionId", element: <CollectionPage /> },
                    { path: "collections/:collectionId/files/:assetId", element: <CollectionFilePage /> },
                    { path: "deal-rooms", element: <DealRoomsPage /> },
                    { path: "deal-rooms/:roomId", element: <DealRoomPage /> },
                    { path: "deal-rooms/:roomId/files/:assetId", element: <DealRoomFilePage /> },
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
