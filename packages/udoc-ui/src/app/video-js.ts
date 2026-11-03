// Video.js, as the media document loads it: its video and audio presets —
// each a player and its skin — and the media elements a stream and the video
// sites play in, each by a dynamic import of its own, so a media document
// loads only what it plays, and any other document none of it.
//
// What ships is this module bundled (scripts/bundle-video-js.mjs): each import
// a chunk of udoc-ui's own beside it, so a host resolves no Video.js package
// and installs none — not even one without a bundler, whose import map names
// udoc's packages alone. `npm run dev` runs tsc's output as it is, the
// imports resolved from the workspace.
//
// Each loader resolves with nothing, so no Video.js type reaches udoc-ui's
// declarations.

/** Load Video.js's `preset` — its player and its skin, which define their elements. */
export async function loadPreset(preset: "video" | "audio"): Promise<void> {
    if (preset === "video") {
        await Promise.all([import("@videojs/html/video/player"), import("@videojs/html/video/skin")]);
    } else {
        await Promise.all([import("@videojs/html/audio/player"), import("@videojs/html/audio/skin")]);
    }
}

/** A media element of Video.js's own, which a stream or a video site plays in. */
export type CustomMediaTag = "hlsjs-video" | "youtube-video" | "vimeo-video";

/** Load the module that defines `tag`. */
export async function loadMediaElement(tag: CustomMediaTag): Promise<void> {
    switch (tag) {
        case "hlsjs-video":
            await import("@videojs/html/media/hlsjs-video");
            return;
        case "youtube-video":
            await import("@videojs/html/media/youtube-video");
            return;
        case "vimeo-video":
            await import("@videojs/html/media/vimeo-video");
            return;
    }
}
