// The media players (`udoc:media`): the browser's own player of each slide
// element that plays audio or video, laid over the element in view mode.
//
// The element paints its own picture — a video's poster frame, an audio clip's
// icon — and nothing decodes the file but the browser. A player stands over
// every such element on screen, empty and transparent, so a click on the
// element is a click on its player: the player starts in that click's own
// handler, where the browser counts it as the user's, and only then is the
// file read and handed to it. A video plays in a `<video>` over the element's
// box, its corners mapped onto the screen so a rotated element plays rotated;
// audio plays in an `<audio>` bar under the box. The browser's controls pause,
// seek and set the volume; the element's trim and fade apply here. At the end
// of the file, or of its trim, the player empties again over the picture.

import type { ComposedShapeMedia, ShapeMedia } from "@docmentis/udoc-wasm";
import { applyPoint, type Affine } from "./affine.js";
import type { OverlaySource } from "./OverlayManager.js";

export interface MediaPlayerCallbacks {
    /** Whether players stand over the elements at all. */
    active: () => boolean;
    /** The elements of page `page` that play media, as last read — none until
     *  read. */
    media: (page: number) => readonly ComposedShapeMedia[];
    /** Page `page`'s page→viewport affine this frame, or null when it isn't on
     *  screen. */
    pageToViewport: (page: number) => Affine | null;
    /** The object URL of the media file `data` (a hex key), read on first ask
     *  — null when it doesn't load. */
    file: (data: string) => Promise<string | null>;
}

/** A player over each element on screen that plays a file the deck carries,
 *  on the element's box at every zoom. */
export function mediaPlayers(callbacks: MediaPlayerCallbacks): OverlaySource {
    return (frame) => {
        if (!callbacks.active()) return [];
        return frame.views.flatMap((view) => {
            const m = callbacks.pageToViewport(view.index);
            if (!m) return [];
            return callbacks.media(view.index).flatMap((element) => {
                const data = element.media.data;
                if (data === undefined) return [];
                const [upperLeft, upperRight, , lowerLeft] = element.quad;
                const origin = applyPoint(m, upperLeft.x, upperLeft.y);
                const across = applyPoint(m, upperRight.x, upperRight.y);
                const down = applyPoint(m, lowerLeft.x, lowerLeft.y);
                const width = Math.hypot(across.x - origin.x, across.y - origin.y);
                const height = Math.hypot(down.x - origin.x, down.y - origin.y);
                if (width === 0 || height === 0) return [];
                // The box's edges, as unit vectors on screen: the matrix that
                // stands the player on them from its top-left corner.
                const matrix = [
                    (across.x - origin.x) / width,
                    (across.y - origin.y) / width,
                    (down.x - origin.x) / height,
                    (down.y - origin.y) / height,
                    0,
                    0,
                ].join(", ");
                return [
                    {
                        key: `${view.index}:${element.shape}`,
                        x: origin.x,
                        y: origin.y,
                        create: () => createPlayer(element.media, data, callbacks),
                        update: (el: HTMLElement) => {
                            el.style.width = `${width}px`;
                            el.style.height = `${height}px`;
                            el.style.transform = `matrix(${matrix})`;
                        },
                    },
                ];
            });
        });
    };
}

/** The player of `media`, whose file is `data`, empty until a click starts it:
 *  from its trim's start, its volume ramped through its fades, stopping at its
 *  trim's end. */
function createPlayer(media: ShapeMedia, data: string, callbacks: MediaPlayerCallbacks): HTMLElement {
    const el = document.createElement("div");
    el.className = "udoc-ui__media";
    const video = media.kind === "videoFile" || media.kind === "quickTimeFile";
    const player = document.createElement(video ? "video" : "audio");
    if (player instanceof HTMLVideoElement) player.playsInline = true;
    el.append(player);
    // Seconds, as the player counts; a time the element leaves out is 0.
    const start = (media.trimStart ?? 0) / 1000;
    const trimEnd = (media.trimEnd ?? 0) / 1000;
    const end = (): number => player.duration - trimEnd;
    const fadeIn = (media.fadeIn ?? 0) / 1000;
    const fadeOut = (media.fadeOut ?? 0) / 1000;
    let started = false;
    // Whether the volume is the fade's, so the step past a fade restores it.
    let fading = false;
    const stop = (): void => {
        started = false;
        player.controls = false;
        player.removeAttribute("src");
        player.load();
    };
    el.addEventListener("click", () => {
        if (started) return;
        started = true;
        player.controls = true;
        // Started here, in the click's own handler, so the browser counts the
        // playback as the user's; the file follows.
        void player.play().catch(() => {});
        void callbacks.file(data).then((url) => {
            if (!started) return;
            if (url) player.src = url;
            else stop();
        });
    });
    player.addEventListener("loadedmetadata", () => {
        if (start > 0) player.currentTime = start;
    });
    player.addEventListener("timeupdate", () => {
        if (!started) return;
        const time = player.currentTime;
        if (trimEnd > 0 && time >= end()) {
            stop();
            return;
        }
        const ramp = Math.min(
            1,
            fadeIn > 0 ? Math.max(0, (time - start) / fadeIn) : 1,
            fadeOut > 0 ? Math.max(0, (end() - time) / fadeOut) : 1,
        );
        if (ramp < 1 || fading) {
            player.volume = ramp;
            fading = ramp < 1;
        }
    });
    player.addEventListener("ended", stop);
    // The player's keys are the player's: none reaches the UI's shortcuts.
    player.addEventListener("keydown", (e) => e.stopPropagation());
    return el;
}
