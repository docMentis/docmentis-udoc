// What the wheel does at a page's edge in single-page view, where the next page
// is a turn away rather than a scroll away.
//
// One swipe should turn one page, however long its momentum runs, and a swipe
// made while that momentum is still running should turn another. A wheel event
// doesn't say when a finger lands or lifts, so this reads the stream for pushes,
// each a separate intent. A push starts after the wheel rests, where the
// direction reverses, and where the pace picks up again after falling away,
// which momentum, only ever slowing, can't do.
//
// A push does one thing. It scrolls the page, and stops at the edge if it gets
// there, so that a reader sees the end of a page before leaving it. Or, starting
// at the edge, it turns the page, and whatever is left of it does nothing, so
// that the new page stays where it landed.

/** CSS px a push moves past the edge to turn the page, and inside it to be spent on it. */
const PUSH_PX = 30;
/** The least CSS px a mouse wheel's tick moves, a Mac's slowest being 4: a trackpad's first step is less. */
const TICK_PX = 3.5;
/** The ms of silence that end a push. */
const REST_MS = 120;
/** The ms past which silence can't be a stall, momentum having died by then. */
const STALL_MS = 1000;
/** The steps a pace is measured over, so that one that came late or early doesn't read as a change of pace. */
const PACE_STEPS = 3;
/** How many times over the pace falls, then rises, to start a push. */
const PACE_SWING = 3;
/** The least pace, in CSS px per ms, that starts a push by rising: 5 px a frame at 60 Hz. */
const RISEN_PACE = 0.3;

/** One wheel event, in CSS px, and where the page stands for it. */
export interface WheelStep {
    /** The event's time, in ms. */
    time: number;
    dx: number;
    dy: number;
    /** How far the page can still move along `dy` before it reaches its edge. */
    room: number;
    /** Whether there's a page past that edge. */
    adjacent: boolean;
}

/** What a wheel step does: scrolls as it would anywhere, turns the page, or nothing at all. */
export type WheelMove = "scroll" | "turn" | "hold";

/** Reads the wheel's steps into pushes, and says what each step does. */
export class WheelPaging {
    /** The latest steps, oldest first: the {@link PACE_STEPS} a pace covers, and the one they follow. */
    #steps: { time: number; px: number }[] = [];
    /** The direction the wheel last moved along `dy`. */
    #direction = 0;
    /** The highest pace in this run of steps, and the lowest since. */
    #fastest = 0;
    #slowest = 0;
    /** The next step is the first after a rest. */
    #first = false;
    /** How far this push has moved inside the page, and past its edge. */
    #inside = 0;
    #past = 0;
    /** This push has turned a page. */
    #spent = false;

    step({ time, dx, dy, room, adjacent }: WheelStep): WheelMove {
        const px = Math.abs(dy);
        const direction = Math.sign(dy);
        const rested = this.#rested(time, px);
        if (rested || (direction !== 0 && this.#direction !== 0 && direction !== this.#direction)) {
            this.#steps = [];
            this.#fastest = this.#slowest = 0;
            this.#startPush();
            this.#first = rested;
        }
        if (direction !== 0) this.#direction = direction;
        this.#steps.push({ time, px });
        if (this.#steps.length > PACE_STEPS + 1) this.#steps.shift();
        this.#trackPace();

        const first = this.#first;
        this.#first = false;
        if (this.#spent) return "hold";
        if (room > 0) {
            this.#inside += Math.min(px, room);
            return "scroll";
        }
        // A push spent inside the page stops at the edge, and one going sideways
        // only drifts towards it.
        if (!adjacent || this.#inside >= PUSH_PX || Math.abs(dx) > px) return "scroll";
        this.#past += px;
        if (this.#past < PUSH_PX && !(first && px >= TICK_PX)) return "scroll";
        this.#spent = true;
        return "turn";
    }

    /**
     * Whether the wheel rested before a step at `time` of `px`. A short gap isn't
     * a rest when the step makes up the distance the pace would have covered in
     * it, and is larger than the steps before it: a main thread that stalled gets
     * momentum's queued events as one, and they mustn't turn another page.
     */
    #rested(time: number, px: number): boolean {
        const last = this.#steps.at(-1);
        if (!last) return true;
        const gap = time - last.time;
        if (gap < REST_MS) return false;
        const distance = gap * this.#pace();
        const stalled = gap < STALL_MS && px >= 2 * last.px && px >= distance / 2 && px <= distance * 1.5;
        return !(px > 0 && stalled);
    }

    /** Note the pace, starting a push where it has fallen away and picked up again. */
    #trackPace(): void {
        const pace = this.#pace();
        const swung = this.#fastest >= PACE_SWING * this.#slowest && pace >= PACE_SWING * this.#slowest;
        if (this.#fastest > 0 && swung && pace >= RISEN_PACE) {
            this.#fastest = this.#slowest = pace;
            this.#startPush();
        } else if (pace > this.#fastest) {
            this.#fastest = this.#slowest = pace;
        } else if (pace < this.#slowest) {
            this.#slowest = pace;
        }
    }

    /** The CSS px per ms of the latest steps; 0 with too few to tell. */
    #pace(): number {
        const span = (this.#steps.at(-1)?.time ?? 0) - (this.#steps[0]?.time ?? 0);
        if (span <= 0) return 0;
        return this.#steps.slice(1).reduce((sum, step) => sum + step.px, 0) / span;
    }

    #startPush(): void {
        this.#inside = this.#past = 0;
        this.#spent = false;
    }
}
