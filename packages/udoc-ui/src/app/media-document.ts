// The built-in media document: video and audio — a file, an HLS stream, a
// YouTube or a Vimeo video — played on Video.js 10, whose modules load only
// when a media document opens, so a PDF's reader downloads none of them
// (docs/design/ui-extension-document.md).
//
// The player is Video.js's own, controls, error dialog and words included:
// `<media-i18n>` › `<video-player>` or `<audio-player>` › its skin › the media
// element. Its colors take the chrome's accent through the skin's `--media-*`
// variables, and an audio skin follows the `color-scheme` the chrome sets, so
// a theme change needs nothing from here.

import { UDocError } from "@docmentis/udoc-wasm/error";
import type {
    ExtensionDocument,
    ExtensionDocumentHost,
    ExtensionDocumentOpenRequest,
    ExtensionDocumentViewer,
} from "./extension-documents.js";
import type { I18n } from "./i18n/index.js";
import {
    MEDIA_FORMATS,
    isAudioFormat,
    isMediaFormat,
    mediaFormatOfBytes,
    mediaFormatOfName,
    mediaFormatOfType,
    videoSiteOf,
} from "./media-formats.js";
import type { MediaFormat } from "./media-formats.js";

/** How long an open waits for the media's metadata before showing the player as it is, loading. */
const METADATA_WAIT_MS = 10_000;

/** The sites a video can be opened on, by format, as the link to them names them. */
const VIDEO_SITES: Partial<Record<MediaFormat, string>> = { youtube: "YouTube", vimeo: "Vimeo" };

/** The media document, its words from `i18n`. */
export function createMediaDocument(i18n: I18n): ExtensionDocument {
    return {
        docType: "media",
        formats: MEDIA_FORMATS,
        canOpen: async (request) => (await formatOf(request)) !== undefined,
        open: async (container, request, host) => {
            const format = await formatOf(request);
            if (format === undefined) throw new UDocError("unsupported", "the media document doesn't play this source");
            return openMedia(container, request, host, format, i18n);
        },
    };
}

/**
 * The media format of `request`: the one its `format` names; a video site's,
 * known by its address; a stream's or a file's, by its name; else by the media
 * type it declares, then its first bytes. `undefined` for none of them.
 */
async function formatOf(request: ExtensionDocumentOpenRequest): Promise<MediaFormat | undefined> {
    const given = request.options.format;
    if (given !== undefined) return isMediaFormat(given) ? given : undefined;
    const site = request.url === undefined ? undefined : videoSiteOf(request.url);
    if (site) return site;
    const named = mediaFormatOfName(request.name);
    if (named) return named;
    const head = await request.head();
    return mediaFormatOfType(head.mediaType) ?? mediaFormatOfBytes(head.bytes);
}

/** A media element, Video.js's own as they mirror `HTMLMediaElement`: the members read here. */
type MediaElement = HTMLElement & {
    src: string;
    source?: { src: string; type: string };
    readonly error: { readonly code: number } | null;
    readonly videoWidth?: number;
    readonly videoHeight?: number;
};

/** A player shown: its media element, and how to take it down. */
interface Player {
    readonly media: MediaElement;
    destroy(): void;
}

/** Open `format`'s player on `request` in `container`, resolving once its metadata is read, it fails, or the wait runs out. */
async function openMedia(
    container: HTMLDivElement,
    request: ExtensionDocumentOpenRequest,
    host: ExtensionDocumentHost,
    format: MediaFormat,
    i18n: I18n,
): Promise<ExtensionDocumentViewer> {
    const area = document.createElement("div");
    area.className = "udoc-ui__media-document";
    container.append(area);
    // A Blob's or bytes' object URL, revoked once the player is down.
    const objectUrl = request.url === undefined ? URL.createObjectURL(blobOf(request.source)) : undefined;
    const src = request.url ?? objectUrl!;
    let player: Player | null = null;
    const close = (): void => {
        player?.destroy();
        player = null;
        area.remove();
        if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl);
    };
    try {
        player = await mountPlayer(area, isAudioFormat(format) ? "audio" : "video", format, src, host.locale);
        let settled = await settle(player.media, host.signal);
        // A file that can hold a picture and has none plays as audio: its
        // metadata says, where its format can't.
        if (settled === "metadata" && player.media instanceof HTMLVideoElement && hasNoPicture(player.media)) {
            player.destroy();
            player = await mountPlayer(area, "audio", format, src, host.locale);
            settled = await settle(player.media, host.signal);
        }
        // Another document opened, or this one closed: given up.
        if (settled === "aborted") host.signal.throwIfAborted();
        // A video a site won't let play here — private, removed, or not to be
        // embedded — is the site's to show, at its own address.
        const site = VIDEO_SITES[format];
        if (site !== undefined && request.url !== undefined) {
            const link = siteLink(request.url, i18n.t("media.openOnSite", { site }));
            const shown = player;
            const offer = (): void => {
                if (shown.media.error) area.append(link);
            };
            if (shown.media.error) offer();
            else shown.media.addEventListener("error", offer, { once: true });
        }
    } catch (error) {
        close();
        throw error;
    }
    return {
        sourceFormat: format,
        close,
        // The skins follow the chrome by themselves (see the top of the file).
        setTheme: () => {},
    };
}

/** The Blob a Blob or bytes source plays from. */
function blobOf(source: ExtensionDocumentOpenRequest["source"]): Blob {
    if (source instanceof Blob) return source;
    if (source instanceof Uint8Array) return new Blob([source as Uint8Array<ArrayBuffer>]);
    throw new UDocError("invalidRequest", "a URL source plays from its URL");
}

/**
 * Load Video.js's `preset` — its player and its skin — and the media element
 * `format` plays in, then show them in `area` wrapped in `<media-i18n>` for
 * `locale`, playing `src`. The source is set once the element is in place, so
 * an error starting it reaches the player and its error dialog.
 */
async function mountPlayer(
    area: HTMLElement,
    preset: "video" | "audio",
    format: MediaFormat,
    src: string,
    locale: string,
): Promise<Player> {
    await Promise.all([
        preset === "video" ? import("@videojs/html/video/player") : import("@videojs/html/audio/player"),
        preset === "video" ? import("@videojs/html/video/skin") : import("@videojs/html/audio/skin"),
        importMediaElement(format),
    ]);
    const words = document.createElement("media-i18n");
    words.setAttribute("lang", locale);
    const player = document.createElement(`${preset}-player`) as HTMLElement & { destroy?(): void };
    const skin = document.createElement(`${preset}-skin`);
    const media = document.createElement(mediaTag(preset, format)) as MediaElement;
    media.setAttribute("playsinline", "");
    skin.append(media);
    player.append(skin);
    words.append(player);
    area.append(words);
    // A stream whose address doesn't end in its manifest's extension says
    // what it is.
    if (format === "hls" && !/\.m3u8([?#]|$)/i.test(src)) {
        media.source = { src, type: "application/vnd.apple.mpegurl" };
    } else {
        media.src = src;
    }
    return {
        media,
        destroy() {
            // A native element is only let go by the player: it stops here.
            if (media instanceof HTMLMediaElement) {
                media.pause();
                media.removeAttribute("src");
                media.load();
            }
            // Video.js takes a player down two frames after it leaves the page,
            // and frames don't run in a hidden tab: taken down now.
            player.destroy?.();
            words.remove();
        },
    };
}

/** Load the custom media element `format` plays in, if it plays in one. */
async function importMediaElement(format: MediaFormat): Promise<unknown> {
    switch (format) {
        case "hls":
            return import("@videojs/html/media/hlsjs-video");
        case "youtube":
            return import("@videojs/html/media/youtube-video");
        case "vimeo":
            return import("@videojs/html/media/vimeo-video");
        default:
            return undefined;
    }
}

/** The tag of the media element `format` plays in under `preset`. */
function mediaTag(preset: "video" | "audio", format: MediaFormat): string {
    switch (format) {
        case "hls":
            return "hlsjs-video";
        case "youtube":
            return "youtube-video";
        case "vimeo":
            return "vimeo-video";
        default:
            return preset;
    }
}

/** Whether `video`'s metadata gives it no picture: sound alone. */
function hasNoPicture(video: HTMLVideoElement): boolean {
    return video.videoWidth === 0 && video.videoHeight === 0;
}

/**
 * How `media`'s open ends: its metadata read, an error, `signal` aborted, or
 * {@link METADATA_WAIT_MS} gone by — a slow stream shows as it loads.
 */
function settle(media: MediaElement, signal: AbortSignal): Promise<"metadata" | "error" | "aborted" | "waited"> {
    if (signal.aborted) return Promise.resolve("aborted");
    if (media.error) return Promise.resolve("error");
    return new Promise((resolve) => {
        const done = (how: "metadata" | "error" | "aborted" | "waited"): void => {
            media.removeEventListener("loadedmetadata", onMetadata);
            media.removeEventListener("error", onError);
            signal.removeEventListener("abort", onAbort);
            clearTimeout(timer);
            resolve(how);
        };
        const onMetadata = (): void => done("metadata");
        const onError = (): void => done("error");
        const onAbort = (): void => done("aborted");
        const timer = setTimeout(() => done("waited"), METADATA_WAIT_MS);
        media.addEventListener("loadedmetadata", onMetadata);
        media.addEventListener("error", onError);
        signal.addEventListener("abort", onAbort);
    });
}

/** A link to `url`, the video on its own site, named `label`. */
function siteLink(url: string, label: string): HTMLAnchorElement {
    const link = document.createElement("a");
    link.className = "udoc-ui__media-document-site";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
}
