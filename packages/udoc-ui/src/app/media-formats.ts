// The source formats the media document plays, and how a source is known as
// one of them: by its address — a YouTube or a Vimeo video's, a stream's
// manifest — by its file's name, by the media type it declares, then by its
// first bytes.
//
// Nothing here imports a sibling at runtime, so the tests can load it from `src`.

/** A source format the media document plays. */
export type MediaFormat =
    | "mp4"
    | "m4v"
    | "mov"
    | "webm"
    | "mp3"
    | "m4a"
    | "aac"
    | "wav"
    | "ogg"
    | "opus"
    | "flac"
    | "hls"
    | "dash"
    | "youtube"
    | "vimeo";

/** Every media format, in the order the media document lists them. */
export const MEDIA_FORMATS: readonly MediaFormat[] = [
    "mp4",
    "m4v",
    "mov",
    "webm",
    "mp3",
    "m4a",
    "aac",
    "wav",
    "ogg",
    "opus",
    "flac",
    "hls",
    "dash",
    "youtube",
    "vimeo",
];

/** Whether `value` names a media format. */
export function isMediaFormat(value: string): value is MediaFormat {
    return (MEDIA_FORMATS as readonly string[]).includes(value);
}

/** The formats whose files hold sound alone. The rest can hold a picture, so they show as video until their metadata says otherwise. */
const AUDIO_FORMATS: ReadonlySet<MediaFormat> = new Set(["mp3", "m4a", "aac", "wav", "opus", "flac"]);

/** Whether a file in `format` holds sound alone. */
export function isAudioFormat(format: MediaFormat): boolean {
    return AUDIO_FORMATS.has(format);
}

/**
 * The video site `url` is a video on: `"youtube"` for a YouTube watch, short,
 * live, embed or `youtu.be` address, `"vimeo"` for a Vimeo video's or its
 * player's — known without fetching it, which would fail on CORS anyway.
 * `undefined` for any other address.
 */
export function videoSiteOf(url: string): "youtube" | "vimeo" | undefined {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return undefined;
    }
    const host = parsed.hostname.replace(/^(www\.|m\.)/, "");
    const path = parsed.pathname;
    if (host === "youtu.be") return /^\/[\w-]+/.test(path) ? "youtube" : undefined;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
        if (path === "/watch" && parsed.searchParams.has("v")) return "youtube";
        return /^\/(embed|shorts|live)\/[\w-]+/.test(path) ? "youtube" : undefined;
    }
    if (host === "vimeo.com") return /\/\d+(\/|$)/.test(path) ? "vimeo" : undefined;
    if (host === "player.vimeo.com") return /^\/video\/\d+/.test(path) ? "vimeo" : undefined;
    return undefined;
}

/** The media format a file `name`'s extension names; `undefined` for any other name, and for none. */
export function mediaFormatOfName(name: string | undefined): MediaFormat | undefined {
    const extension = /\.([^./]+)$/.exec(name ?? "")?.[1]?.toLowerCase();
    switch (extension) {
        case "mp4":
        case "m4v":
        case "mov":
        case "webm":
        case "mp3":
        case "m4a":
        case "aac":
        case "wav":
        case "ogg":
        case "opus":
        case "flac":
            return extension;
        case "oga":
        case "ogv":
            return "ogg";
        case "qt":
            return "mov";
        case "m3u8":
            return "hls";
        case "mpd":
            return "dash";
        default:
            return undefined;
    }
}

/** The media format a media type names — its essence, lowercased; `undefined` for any other. */
export function mediaFormatOfType(mediaType: string | undefined): MediaFormat | undefined {
    switch (mediaType) {
        case "video/mp4":
            return "mp4";
        case "audio/mp4":
            return "m4a";
        case "video/x-m4v":
            return "m4v";
        case "video/quicktime":
            return "mov";
        case "video/webm":
        case "audio/webm":
            return "webm";
        case "audio/mpeg":
        case "audio/mp3":
            return "mp3";
        case "audio/aac":
        case "audio/x-aac":
            return "aac";
        case "audio/wav":
        case "audio/wave":
        case "audio/x-wav":
        case "audio/vnd.wave":
            return "wav";
        case "audio/ogg":
        case "video/ogg":
        case "application/ogg":
            return "ogg";
        case "audio/opus":
            return "opus";
        case "audio/flac":
        case "audio/x-flac":
            return "flac";
        case "application/vnd.apple.mpegurl":
        case "application/x-mpegurl":
        case "audio/mpegurl":
        case "audio/x-mpegurl":
            return "hls";
        case "application/dash+xml":
            return "dash";
        default:
            return undefined;
    }
}

/**
 * The media format `head`, a source's first bytes, opens with: an ISO base
 * media file's `ftyp` box, by its brand; a WebM's EBML header (not another
 * Matroska file's, which browsers don't play); an MP3's ID3 tag or frame sync;
 * an AAC's ADTS sync; a WAV's RIFF header; an Ogg page, Opus's when its first
 * packet is; FLAC's marker; an HLS playlist; a DASH manifest. `undefined` for
 * anything else.
 */
export function mediaFormatOfBytes(head: Uint8Array): MediaFormat | undefined {
    const ascii = (from: number, length: number): string => String.fromCharCode(...head.subarray(from, from + length));
    if (ascii(4, 4) === "ftyp") {
        const brand = ascii(8, 4);
        if (brand === "qt  ") return "mov";
        if (brand === "M4A " || brand === "M4B ") return "m4a";
        if (brand === "M4V ") return "m4v";
        return "mp4";
    }
    if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
        return ascii(0, Math.min(head.length, 64)).includes("webm") ? "webm" : undefined;
    }
    if (ascii(0, 3) === "ID3") return "mp3";
    if (head[0] === 0xff && head[1] !== undefined) {
        // ADTS AAC syncs with its layer bits 00; an MPEG audio frame's say its layer.
        if ((head[1] & 0xf6) === 0xf0) return "aac";
        if ((head[1] & 0xe0) === 0xe0 && (head[1] & 0x06) !== 0) return "mp3";
    }
    if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return "wav";
    if (ascii(0, 4) === "OggS") return ascii(28, 8) === "OpusHead" ? "opus" : "ogg";
    if (ascii(0, 4) === "fLaC") return "flac";
    // A text file's first bytes, after a UTF-8 byte order mark if it has one.
    const start = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf ? 3 : 0;
    const text = ascii(start, Math.min(head.length, 512)).trimStart();
    if (text.startsWith("#EXTM3U")) return "hls";
    if (text.startsWith("<?xml") || text.startsWith("<MPD")) return /<MPD[\s>]/.test(text) ? "dash" : undefined;
    return undefined;
}
