import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // A static export: the viewer and the editor run in the browser alone, so
    // this app needs no server. One with a server mounts them the same way.
    output: "export",
};

export default nextConfig;
