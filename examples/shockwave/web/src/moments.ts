// What just happened in the app, announced for whoever listens: the narrator,
// which the app knows nothing of (docs/design/examples-shockwave.md). The app
// announces a moment and never hears back; with no one listening, nothing
// comes of it.

/** Something that just happened in the app. */
export interface Moment {
    kind: "document:opened";
    /** Where: a file picked for upload, opened in the browser before it's sent. */
    where: "upload";
    /** udoc's name for its format, as the viewer read it: `pdf`, `pptx`, …; `null` when it didn't say. */
    format: string | null;
    /** From the viewer's making to the document open, in milliseconds. */
    ms: number;
}

const moments = new EventTarget();

export function announceMoment(moment: Moment): void {
    moments.dispatchEvent(new CustomEvent<Moment>("moment", { detail: moment }));
}

/** Hear each moment announced from now on; the function returned stops hearing them. */
export function onMoment(listener: (moment: Moment) => void): () => void {
    const heard = (event: Event) => listener((event as CustomEvent<Moment>).detail);
    moments.addEventListener("moment", heard);
    return () => moments.removeEventListener("moment", heard);
}
