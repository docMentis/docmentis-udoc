// What just happened in the app, announced for whoever listens: the narrator,
// which the app knows nothing of (docs/design/examples-shockwave.md). The app
// announces a moment and never hears back; with no one listening, nothing
// comes of it.

/** Something that just happened in the app. */
export type Moment = DocumentOpened | DocumentClosed | ThumbnailsShown | ThumbnailsHidden;

/** A document opened in the browser. */
export interface DocumentOpened {
    kind: "document:opened";
    /** Where: a file picked for upload, opened in the browser before it's sent. */
    where: "upload";
    /** udoc's name for its format, as the viewer read it: `pdf`, `pptx`, …; `null` when it didn't say. */
    format: string | null;
    /** From the viewer's making to the document open, in milliseconds. */
    ms: number;
}

/** A document opened in the browser closed, its viewer gone. */
export interface DocumentClosed {
    kind: "document:closed";
    /** Where: the upload's preview, gone with its dialog, the file uploaded or not. */
    where: "upload";
}

/** Thumbnails in view, where there were none: the first of them shown, its file's first page, kept at upload. */
export interface ThumbnailsShown {
    kind: "thumbnails:shown";
    /** Where: files' cards, in the library's grid or on Home. */
    where: "card";
    /** udoc's name for the format of the first one's document: `pdf`, `pptx`, … */
    format: string;
    /** From its card's making to its thumbnail loaded, in milliseconds. */
    ms: number;
}

/** No thumbnail in view any more: the last of them gone. */
export interface ThumbnailsHidden {
    kind: "thumbnails:hidden";
    /** Where: files' cards, in the library's grid or on Home. */
    where: "card";
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
