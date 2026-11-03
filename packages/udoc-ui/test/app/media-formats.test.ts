/**
 * Knowing a media source's format: a video site's address, a file's name, a
 * declared media type, a file's first bytes.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
    isAudioFormat,
    mediaFormatOfBytes,
    mediaFormatOfName,
    mediaFormatOfType,
    videoSiteOf,
} from "../../src/app/media-formats.ts";

const bytes = (...parts: Array<string | number[]>): Uint8Array =>
    Uint8Array.from(parts.flatMap((part) => (typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part)));

test("a YouTube or Vimeo video's address names its site", () => {
    for (const url of [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "https://www.youtube.com/shorts/abc_DEF-123",
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    ]) {
        assert.equal(videoSiteOf(url), "youtube", url);
    }
    for (const url of ["https://vimeo.com/76979871", "https://player.vimeo.com/video/76979871?h=abc"]) {
        assert.equal(videoSiteOf(url), "vimeo", url);
    }
    for (const url of [
        "https://www.youtube.com/",
        "https://www.youtube.com/watch",
        "https://www.youtube.com/@channel",
        "https://vimeo.com/about",
        "https://example.com/clip.mp4",
        "not a url",
    ]) {
        assert.equal(videoSiteOf(url), undefined, url);
    }
});

test("a file's extension names its format, a stream's manifest its protocol", () => {
    assert.equal(mediaFormatOfName("clip.MP4"), "mp4");
    assert.equal(mediaFormatOfName("talk.m4a"), "m4a");
    assert.equal(mediaFormatOfName("song.oga"), "ogg");
    assert.equal(mediaFormatOfName("index.m3u8"), "hls");
    assert.equal(mediaFormatOfName("manifest.mpd"), "dash");
    assert.equal(mediaFormatOfName("report.pdf"), undefined);
    assert.equal(mediaFormatOfName("film.mkv"), undefined);
    assert.equal(mediaFormatOfName("noextension"), undefined);
    assert.equal(mediaFormatOfName(undefined), undefined);
});

test("a declared media type names its format", () => {
    assert.equal(mediaFormatOfType("video/mp4"), "mp4");
    assert.equal(mediaFormatOfType("audio/mp4"), "m4a");
    assert.equal(mediaFormatOfType("audio/mpeg"), "mp3");
    assert.equal(mediaFormatOfType("application/vnd.apple.mpegurl"), "hls");
    assert.equal(mediaFormatOfType("application/dash+xml"), "dash");
    assert.equal(mediaFormatOfType("application/pdf"), undefined);
    assert.equal(mediaFormatOfType(undefined), undefined);
});

test("a file's first bytes name its format", () => {
    assert.equal(mediaFormatOfBytes(bytes([0, 0, 0, 0x20], "ftypisom")), "mp4");
    assert.equal(mediaFormatOfBytes(bytes([0, 0, 0, 0x14], "ftypqt  ")), "mov");
    assert.equal(mediaFormatOfBytes(bytes([0, 0, 0, 0x20], "ftypM4A ")), "m4a");
    assert.equal(mediaFormatOfBytes(bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84], "webm")), "webm");
    // Another Matroska file, which browsers don't play.
    assert.equal(mediaFormatOfBytes(bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x88], "matroska")), undefined);
    assert.equal(mediaFormatOfBytes(bytes("ID3", [4, 0])), "mp3");
    assert.equal(mediaFormatOfBytes(bytes([0xff, 0xfb, 0x90, 0x64])), "mp3");
    assert.equal(mediaFormatOfBytes(bytes([0xff, 0xf1, 0x50, 0x80])), "aac");
    assert.equal(mediaFormatOfBytes(bytes("RIFF", [0, 0, 0, 0], "WAVEfmt ")), "wav");
    assert.equal(mediaFormatOfBytes(bytes("OggS", Array(24).fill(0), "OpusHead")), "opus");
    assert.equal(mediaFormatOfBytes(bytes("OggS", Array(24).fill(0), "\u0001vorbis")), "ogg");
    assert.equal(mediaFormatOfBytes(bytes("fLaC")), "flac");
    assert.equal(mediaFormatOfBytes(bytes([0xef, 0xbb, 0xbf], "#EXTM3U\n#EXT-X-VERSION:3")), "hls");
    assert.equal(
        mediaFormatOfBytes(bytes('<?xml version="1.0"?>\n<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">')),
        "dash",
    );
    assert.equal(mediaFormatOfBytes(bytes("%PDF-1.7")), undefined);
    assert.equal(mediaFormatOfBytes(bytes('<?xml version="1.0"?><svg/>')), undefined);
    assert.equal(mediaFormatOfBytes(new Uint8Array()), undefined);
});

test("only the formats that hold sound alone are audio", () => {
    assert.equal(isAudioFormat("mp3"), true);
    assert.equal(isAudioFormat("flac"), true);
    // A container that can hold either shows as video until its metadata says.
    assert.equal(isAudioFormat("webm"), false);
    assert.equal(isAudioFormat("ogg"), false);
    assert.equal(isAudioFormat("hls"), false);
});
