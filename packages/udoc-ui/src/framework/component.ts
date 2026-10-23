/**
 * Optional base class for complex stateful components.
 *
 * Adapted from the `docmentis-udoc-viewer` ui/framework layer (MIT).
 *
 * Rules:
 * - Root element is stable after mount.
 * - render() patches DOM inside the root only.
 * - destroy() must remove listeners and subscriptions.
 *
 * The factory pattern (a function returning `{ el, mount, destroy }`) is
 * preferred for most components; this base class is here for the
 * cases where local component state and lifecycle hooks earn their keep.
 */
export abstract class Component<P = object, S = object> {
    protected props: P;
    protected state: S;
    protected el: HTMLElement;
    private cleanups: Array<() => void> = [];

    constructor(props: P, initialState: S, root: HTMLElement) {
        this.props = props;
        this.state = initialState;
        this.el = root;
    }

    /** Patch DOM inside the stable root element. */
    abstract render(): void;

    /** Mount into a container and run initial render. */
    mount(container: HTMLElement): void {
        container.appendChild(this.el);
        this.onMount();
        this.render();
    }

    /** Clean up listeners/subscriptions and remove root. */
    destroy(): void {
        try {
            this.onUnmount();
        } finally {
            for (const off of this.cleanups) {
                try {
                    off();
                } catch (e) {
                    console.error("Component cleanup error:", e);
                }
            }
            this.cleanups = [];
            this.el.remove();
        }
    }

    protected onMount(): void {}
    protected onUnmount(): void {}
    protected onUpdate(_prevProps: P, _prevState: S): void {}

    /** Local state update; triggers render. */
    protected setState(partial: Partial<S>): void {
        const prevState = this.state;
        this.state = { ...this.state, ...partial };
        this.render();
        this.onUpdate(this.props, prevState);
    }

    /** Register a cleanup for destroy(). */
    protected track(cleanup: () => void): void {
        this.cleanups.push(cleanup);
    }
}
