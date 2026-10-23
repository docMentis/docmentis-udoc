/**
 * The UI's words in the host's language: one pack of {@link Messages} per
 * language shipped, chosen by the `locale` option, with the host's
 * `translations` laid over it. The shell builds one {@link I18n} per instance
 * and hands it to every component that draws a word.
 */
import type { Messages } from "./messages.js";
import { en } from "./en.js";
import { zhCN } from "./zh-CN.js";
import { zhTW } from "./zh-TW.js";
import { ja } from "./ja.js";
import { ko } from "./ko.js";
import { es } from "./es.js";
import { fr } from "./fr.js";
import { de } from "./de.js";
import { ptBR } from "./pt-BR.js";
import { ar } from "./ar.js";
import { ru } from "./ru.js";

export type { Messages } from "./messages.js";

/** A key into {@link Messages}. */
export type MessageKey = keyof Messages;

/** A message counted with a number — its keys are `<key>.one`, `<key>.other`
 *  and the rest of the plural categories a language needs. `K` is the keys of
 *  the message set — udoc-ui's, or a package's that extends it. */
export type PluralKey<K extends string = MessageKey> = { [Q in K]: Q extends `${infer P}.other` ? P : never }[K];

/** The values a message's `{name}` placeholders take. A number is written the
 *  way the locale writes one — `1,15` in German. */
export type MessageParams = Readonly<Record<string, string | number>>;

/** A message a label holds until it is drawn: its key, or its key with the
 *  values its placeholders take. */
export type Message<K extends string = MessageKey> = K | readonly [K, MessageParams];

/** The packs udoc-ui ships, by language tag as `Intl` writes it — the ones a
 *  package extending the message set lays its own over. */
export const MESSAGE_PACKS: Readonly<Record<string, Messages>> = {
    en,
    "zh-CN": zhCN,
    "zh-TW": zhTW,
    ja,
    ko,
    es,
    fr,
    de,
    "pt-BR": ptBR,
    ar,
    ru,
};

/** The chrome's words: `K` is the keys of its message set — udoc-ui's, or a
 *  package's that extends it. */
export interface I18n<K extends string = MessageKey> {
    /** The language tag asked for — `locale`, else the
     *  browser's — as `Intl` writes it; `en` for a tag `Intl` doesn't take. */
    readonly locale: string;
    /** `message` in the UI's language, its `{name}` placeholders filled
     *  from `params`, else from the message's own. A message in a language
     *  written right to left comes isolated in its own direction, each value
     *  filled in isolated in its own, so its numbers, Latin words and
     *  punctuation keep their order in the left-to-right chrome. */
    t(message: Message<K>, params?: MessageParams): string;
    /** The message for `count` of a thing — `<key>.<category>` for `count`'s
     *  plural category in the UI's language (`one`, `few`, …), else
     *  `<key>.other` — its `{count}` filled with `count`. */
    plural(key: PluralKey<K>, count: number): string;
}

/** The scripts written right to left, by their ISO 15924 codes. */
const RIGHT_TO_LEFT_SCRIPTS: readonly string[] = ["Adlm", "Arab", "Hebr", "Nkoo", "Rohg", "Syrc", "Thaa"];

/** A letter of a script written right to left. */
const RIGHT_TO_LEFT_LETTER = new RegExp(
    `[${RIGHT_TO_LEFT_SCRIPTS.map((code) => `\\p{Script=${code}}`).join("")}]`,
    "u",
);

/** The marks that isolate a run of text in a direction (UAX #9): left to
 *  right (LRI), right to left (RLI), or that of its first strong letter
 *  (FSI), up to the mark that ends it (PDI). */
const LEFT_TO_RIGHT_ISOLATE = "\u2066";
const RIGHT_TO_LEFT_ISOLATE = "\u2067";
const FIRST_STRONG_ISOLATE = "\u2068";
const POP_DIRECTIONAL_ISOLATE = "\u2069";

/** `locale`'s language and the script it is written in — `zh-Hant` for
 *  `zh-HK` and `zh-TW` alike, `pt-Latn` for `pt` and `pt-BR`. */
function languageScript(locale: string): string {
    const { language, script } = new Intl.Locale(locale).maximize();
    return `${language}-${script}`;
}

/** Whether `locale`'s script is written right to left — Arabic, Hebrew, … */
function writtenRightToLeft(locale: string): boolean {
    return RIGHT_TO_LEFT_SCRIPTS.includes(new Intl.Locale(locale).maximize().script ?? "");
}

/** Whether a message of a right-to-left language reads right to left: as its
 *  first letter outside its placeholders does — `Ctrl+{key}` reads left to
 *  right — or, with none, as its language does. */
function readsRightToLeft(template: string): boolean {
    const letter = /\p{L}/u.exec(template.replace(/\{\w+\}/g, ""))?.[0];
    return letter === undefined || RIGHT_TO_LEFT_LETTER.test(letter);
}

/** The pack of `packs` `locale` reads, with its tag: the one its tag names,
 *  else the one in its language and script — so `zh-HK` reads `zh-TW`, and
 *  `pt` `pt-BR` — else English. `locale` is as `Intl` writes it. */
function packFor<M>(packs: Readonly<Record<string, M>>, locale: string): [string, M] {
    const named = packs[locale];
    if (named) return [locale, named];
    const wanted = languageScript(locale);
    return Object.entries(packs).find(([tag]) => languageScript(tag) === wanted) ?? ["en", packs["en"]!];
}

/** `locale` as `Intl` writes it, or `en` when `Intl` doesn't take it. */
function canonicalLocale(locale: string): string {
    try {
        return Intl.getCanonicalLocales(locale)[0] ?? "en";
    } catch {
        return "en";
    }
}

/**
 * The {@link I18n} of the message set whose packs, by language tag, are
 * `packs` — udoc-ui's {@link MESSAGE_PACKS}, or a package's that extends them,
 * each with `en` — for `locale`, the browser's language when absent, with
 * `translations` replacing the pack's strings key by key.
 */
export function createI18n<K extends string>(
    packs: Readonly<Record<string, Readonly<Partial<Record<K, string>>>>>,
    locale?: string,
    translations?: Readonly<Partial<Record<K, string>>>,
): I18n<K> {
    const tag = canonicalLocale(locale ?? (typeof navigator !== "undefined" ? navigator.language : "en"));
    const [packTag, pack] = packFor(packs, tag);
    const messages: Readonly<Partial<Record<K, string>>> = { ...pack, ...translations };
    // The language a message is in: the pack's, or the locale's for a string
    // of the host's own.
    const packRightToLeft = writtenRightToLeft(packTag);
    const localeRightToLeft = writtenRightToLeft(tag);
    // Ungrouped, as a page number or a zoom is written.
    const numbers = new Intl.NumberFormat(tag, { useGrouping: false });
    const plurals = new Intl.PluralRules(tag);

    function t(message: Message<K>, params?: MessageParams): string {
        const [key, own] = typeof message === "string" ? [message, undefined] : message;
        const values = params ?? own;
        const template = messages[key] ?? "";
        const rightToLeft = translations !== undefined && key in translations ? localeRightToLeft : packRightToLeft;
        const text = values
            ? template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
                  const value = values[name];
                  if (value === undefined) return placeholder;
                  if (typeof value === "number") return numbers.format(value);
                  // A Latin font name or a key chord keeps its own order.
                  return rightToLeft ? `${FIRST_STRONG_ISOLATE}${value}${POP_DIRECTIONAL_ISOLATE}` : value;
              })
            : template;
        if (!rightToLeft || text === "") return text;
        const isolate = readsRightToLeft(template) ? RIGHT_TO_LEFT_ISOLATE : LEFT_TO_RIGHT_ISOLATE;
        return `${isolate}${text}${POP_DIRECTIONAL_ISOLATE}`;
    }

    return {
        locale: tag,
        t,
        plural(key, count) {
            const category = `${key}.${plurals.select(count)}`;
            const found = (category in messages ? category : `${key}.other`) as K;
            return t(found, { count });
        },
    };
}
