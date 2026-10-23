/**
 * The editor's words in the host's language: udoc-ui's packs with edit mode's
 * strings laid over each, chosen by the `locale` option, with the host's
 * `translations` laid over that. Built as udoc-ui builds its own, from the same
 * options, so the shell's chrome and edit mode's speak one language.
 */
import * as ui from "@docmentis/udoc-ui/internal";
import type { EditMessages, Messages } from "./messages.js";
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

/** The editor's words: udoc-ui's `I18n` over {@link Messages}. */
export type I18n = ui.I18n<MessageKey>;

/** Edit mode's packs, by language tag as `Intl` writes it — one for each of udoc-ui's. */
const EDIT_PACKS: Readonly<Record<string, EditMessages>> = {
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

/** The editor's packs: each of udoc-ui's with edit mode's strings laid over it. */
export const MESSAGE_PACKS: Readonly<Record<string, Messages>> = Object.fromEntries(
    Object.entries(EDIT_PACKS).map(([tag, pack]) => [tag, { ...ui.MESSAGE_PACKS[tag]!, ...pack }]),
);

/**
 * The {@link I18n} for `locale` — the browser's language when absent — with
 * `translations` replacing the pack's strings key by key.
 */
export function createI18n(locale?: string, translations?: Partial<Messages>): I18n {
    return ui.createI18n(MESSAGE_PACKS, locale, translations);
}
