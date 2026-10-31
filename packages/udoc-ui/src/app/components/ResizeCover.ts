// A worker-painted canvas's stand-in while the browser catches up with its
// resize.
//
// The worker paints a viewer's canvas at its new size and acks the resize; the
// host then gives the canvas its new CSS box and lays what is over it at the
// frame's geometry. But the browser shows a transferred canvas's frame at a new
// size only once its GPU process has told the page of it, and that can land a
// frame after the page's own change — until then it stretches the old frame to
// the new box, and the page squeezes or stretches, then springs back. So the
// ack carries a copy of the frame, and the host shows it here, over the canvas
// and in step with the rest, until the canvas's own frame is surely shown.

/** Animation frames the cover holds for at least: the browser's word of the
 *  canvas's new frame lands within one or two. */
const HOLD_FRAMES = 4;
/** Milliseconds it holds for at least, on a display whose frames come fast. */
const HOLD_MS = 80;

/** The inline styles the host places its canvas by, which the cover takes. */
const PLACEMENT = ["width", "height", "transform"] as const;

export class ResizeCover {
    readonly el = document.createElement("canvas");
    readonly #canvas: HTMLCanvasElement;
    #ctx: ImageBitmapRenderingContext | null = null;
    #shownAt = 0;
    #frames = 0;
    #raf: number | null = null;

    /** A cover for `canvas`, laid just over it and styled as it is — its class
     *  carries where it sits and how it shows. */
    constructor(canvas: HTMLCanvasElement) {
        this.#canvas = canvas;
        this.el.className = `${canvas.className} udoc-ui__resize-cover`;
        this.el.setAttribute("aria-hidden", "true");
        this.el.style.display = "none";
        canvas.after(this.el);
    }

    /** Show `frame` over the canvas, at its place, for a moment. */
    show(frame: ImageBitmap): void {
        this.#ctx ??= this.el.getContext("bitmaprenderer");
        if (!this.#ctx) {
            frame.close();
            return;
        }
        this.#ctx.transferFromImageBitmap(frame);
        this.sync();
        this.el.style.display = "";
        this.#shownAt = performance.now();
        this.#frames = 0;
        this.#raf ??= requestAnimationFrame(this.#tick);
    }

    /** Take the canvas's place again — called as the host moves or sizes it. */
    sync(): void {
        for (const prop of PLACEMENT) this.el.style[prop] = this.#canvas.style[prop];
    }

    destroy(): void {
        if (this.#raf !== null) cancelAnimationFrame(this.#raf);
        this.#raf = null;
        this.#hide();
        this.el.remove();
    }

    readonly #tick = (): void => {
        this.#frames++;
        if (this.#frames < HOLD_FRAMES || performance.now() - this.#shownAt < HOLD_MS) {
            this.#raf = requestAnimationFrame(this.#tick);
            return;
        }
        this.#raf = null;
        this.#hide();
    };

    #hide(): void {
        this.el.style.display = "none";
        // Let the frame go.
        this.#ctx?.transferFromImageBitmap(null);
    }
}
