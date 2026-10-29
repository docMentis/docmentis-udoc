// One of the session's viewers beside the main one — a deck's notes pane — as
// the main thread drives it: the viewer verbs `WorkerClient` has for the main
// view, aimed at this one, and the frames the worker paints in it.
import type {
    ContentPadding,
    DocumentLayout,
    PageGap,
    PageView,
    PageViewsFrame,
    RgbColor,
    ScrollMode,
    Size,
    TextSelectOptions,
    Viewport,
} from "../geometry.js";
import type { PageViewsReport, ResizedReport, WorkerRequest } from "./protocol.js";

/** Floats per page in a {@link PageViewsReport} buffer:
 *  `[index, x, y, w, h, rotation]`. */
const PAGE_VIEW_STRIDE = 6;

/** The frame `report` describes, its flat `[index, x, y, w, h, …]` buffer
 *  parsed into page views; `fresh` when it reflects the latest viewport sent. */
export function pageViewsFrame(report: PageViewsReport, fresh: boolean): PageViewsFrame {
    const rects = report.rects;
    const views: PageView[] = [];
    for (let i = 0; i + PAGE_VIEW_STRIDE <= rects.length; i += PAGE_VIEW_STRIDE) {
        views.push({
            index: rects[i]!,
            x: rects[i + 1]!,
            y: rects[i + 2]!,
            width: rects[i + 3]!,
            height: rects[i + 4]!,
            rotation: rects[i + 5]!,
        });
    }
    return {
        views,
        scale: report.scale,
        scrollSize: { width: report.scrollWidth, height: report.scrollHeight },
        scrollUsedSize: { width: report.scrollUsedWidth, height: report.scrollUsedHeight },
        scrollbars: { x: report.scrollbarX, y: report.scrollbarY },
        scroll: { x: report.scrollX, y: report.scrollY },
        currentPage: report.currentPage >= 0 ? report.currentPage : null,
        plane: report.plane,
        guide: report.guide,
        repaintArea: report.repaintArea,
        fresh,
    };
}

/** How a {@link ViewerClient} reaches the worker: the {@link WorkerClient}'s own channel. */
export interface ViewerTransport {
    post(request: WorkerRequest, transfer?: Transferable[]): void;
    send(request: WorkerRequest): Promise<unknown>;
}

/**
 * The main thread's handle on a viewer the host added beside the main view —
 * another view onto the open document, painting into a canvas of its own (see
 * `WorkerClient.addViewer`). It joins every document opened after it is added,
 * keeping the settings sent to it; the selection it projects rides the main
 * selection report (`SelectionState.viewers`).
 */
export class ViewerClient {
    /** The index the worker's verbs name it by. */
    readonly index: number;
    readonly #transport: ViewerTransport;
    readonly #pageViewListeners = new Set<(frame: PageViewsFrame) => void>();
    readonly #resizedListeners = new Set<(size: Size) => void>();
    /** Seq of the latest viewport sent; reports echoing it are `fresh`. */
    #viewportSeq = 0;
    /** The `anchorShift` of the latest fresh report — what the host's scroll,
     *  adopted from it, was read against. Sent with each viewport. */
    #anchorShift = 0;

    constructor(index: number, transport: ViewerTransport) {
        this.index = index;
        this.#transport = transport;
    }

    /** Update the painted window (scroll / zoom / resize); a viewport with no
     *  area stops the viewer painting until it has one again. Latest-wins. */
    setViewport(viewport: Viewport): void {
        this.#transport.post({
            type: "setViewport",
            viewer: this.index,
            viewport,
            anchorShift: this.#anchorShift,
            seq: ++this.#viewportSeq,
        });
    }

    /** Bring page `index` (0-based) of the plane it shows to the top — in
     *  spread scrolling, show that page alone. Latest-wins. */
    goToPage(index: number): void {
        this.#transport.post({ type: "goToPage", viewer: this.index, index, seq: ++this.#viewportSeq });
    }

    /** Show plane `plane` — another view of the document, as a deck's notes
     *  text is — and resolve with its layout. */
    async goToPlane(plane: number): Promise<DocumentLayout> {
        return (await this.#transport.send({ type: "goToPlane", viewer: this.index, plane })) as DocumentLayout;
    }

    /** Lay out the pages of a plane that flows to its pane at `width`
     *  document points — the pane's width over its zoom. Sticky. */
    setPageWidth(width: number): void {
        this.#transport.post({ type: "setPageWidth", viewer: this.index, width });
    }

    /** Set the backdrop color around and between its pages. Sticky. */
    setBackdrop(color: RgbColor): void {
        this.#transport.post({ type: "setBackdrop", viewer: this.index, color });
    }

    /** Set the frame drawn around each page, or `null` for none. Sticky. */
    setPageBorder(color: RgbColor | null): void {
        this.#transport.post({ type: "setPageBorder", viewer: this.index, color });
    }

    /** Set the padding around its pages and the gap between them. Sticky. */
    setSpacing(contentPadding: ContentPadding, pageGap: PageGap): void {
        this.#transport.post({ type: "setSpacing", viewer: this.index, contentPadding, pageGap });
    }

    /** Set the strip, in CSS px, it keeps clear for a scrollbar that shows,
     *  or `0` for bars floating over it. Sticky. */
    setScrollbarSize(size: number): void {
        this.#transport.post({ type: "setScrollbarSize", viewer: this.index, size });
    }

    /** Scroll a spread at a time, or the whole stack. Sticky. */
    setScrollMode(mode: ScrollMode): void {
        this.#transport.post({ type: "setScrollMode", viewer: this.index, mode });
    }

    /**
     * Select the text a pointer gesture spans in it, from `anchor` where the
     * press began to its live end `focus` (CSS px, canvas-relative). An
     * edit-mode press into a deck's notes not written yet writes them. The
     * geometry rides the next selection report. Latest-wins.
     */
    selectText(
        anchor: { x: number; y: number },
        focus: { x: number; y: number },
        options: TextSelectOptions = {},
    ): void {
        this.#transport.post({ type: "selectText", viewer: this.index, anchor, focus, options });
    }

    /** Subscribe to the frames it paints. Returns an unsubscribe function. */
    onPageViews(listener: (frame: PageViewsFrame) => void): () => void {
        this.#pageViewListeners.add(listener);
        return () => this.#pageViewListeners.delete(listener);
    }

    /** Subscribe to its resize acks — the CSS size its canvas was repainted at,
     *  which the host commits its CSS box to. Returns an unsubscribe function. */
    onResized(listener: (size: Size) => void): () => void {
        this.#resizedListeners.add(listener);
        return () => this.#resizedListeners.delete(listener);
    }

    /** Take a report the worker posted for this viewer — the {@link WorkerClient}
     *  routes them here. */
    receive(report: PageViewsReport | ResizedReport): void {
        if (report.type === "resized") {
            for (const listener of this.#resizedListeners) listener({ width: report.width, height: report.height });
            return;
        }
        const fresh = report.seq === this.#viewportSeq;
        // Before the listeners: adopting this frame's scroll sends the viewport
        // back at once, and it was read against this report.
        if (fresh) this.#anchorShift = report.anchorShift;
        const frame = pageViewsFrame(report, fresh);
        for (const listener of this.#pageViewListeners) listener(frame);
    }
}
