// Shapes TypeDoc's modules into the reference a reader navigates: one per
// published package, named as it is imported and summarized by its
// `package.json` description, in the order a reader reaches for them.
//
// udoc-ui is nobody's import: the viewer and the editor each re-export all of
// it, so its module is "Common", and theirs list only what each adds — not a
// "Re-exports" line for every symbol of Common, which would bury it. udoc-ui is
// the first entry point, so it is where TypeDoc converts those symbols; another
// package that re-exports a few of them (udoc-node, its error) keeps its
// "Re-exports" lines, which link into Common. Common comes last, after the
// packages, as what they share rather than one of them.
//
// Those references are dropped from the page, not from the project: a comment
// in the editor that links `UDocBase.setTheme` resolves `UDocBase` through the
// editor's reference to it.
//
// Members sort in source order (`typedoc.json`), but a package's exports sort
// by name: in source order they would follow the files they are declared in,
// which a reader looking one up knows nothing of.
//
// typedoc-plugin-missing-exports documents the types the API uses but doesn't
// export, in a section of each module. Those it keeps are the engine's — the
// document model the API's values are built from — so the section is "Engine
// types". It also files there what no page shows — members the editor
// inherits from UDocBase, and udoc-ui's whole UI state, which they reach — so a
// section keeps only the engine's types, and of those only the ones a page
// links to, directly or through another it keeps. A type of udoc's own the API
// uses without exporting stays an unlinked name.
import { readFileSync } from "node:fs";
import {
    Comment,
    ContainerReflection,
    Converter,
    DeclarationReflection,
    ReferenceReflection,
    ReflectionKind,
    SignatureReflection,
    i18n,
    makeRecursiveVisitor,
} from "typedoc";
import { MarkdownTheme, MarkdownThemeContext } from "typedoc-plugin-markdown";

/** Each entry point's package directory, in sidebar order, and the module it becomes. */
const MODULES = [
    { dir: "udoc-viewer", name: "@docmentis/udoc-viewer", common: true },
    { dir: "udoc-editor", name: "@docmentis/udoc-editor", common: true },
    { dir: "udoc-node", name: "@docmentis/udoc-node" },
    { dir: "udoc-server", name: "@docmentis/udoc-server" },
    {
        dir: "udoc-ui",
        name: "Common",
        summary:
            "The base class the viewer and the editor extend, and the types their calls take and return. " +
            "Both packages export all of it: import it from whichever you use, not from `@docmentis/udoc-ui`.",
    },
];

function description(dir) {
    const url = new URL(`../../${dir}/package.json`, import.meta.url);
    return JSON.parse(readFileSync(url, "utf8")).description;
}

/** The package the engine's types are declared in. */
const ENGINE = "@docmentis/udoc-wasm";

/** What an "Engine types" section says of itself. */
const ENGINE_TYPES_SUMMARY =
    "The engine's types the API's values are built from — its document model — which the packages " +
    "don't export, documented so every one in a signature links to a page. Code that has to name one " +
    "imports it from `@docmentis/udoc-wasm`.";

/**
 * Remove from each of `sections` what isn't one of the engine's types, then
 * the types no reflection outside them links to, directly or through a type
 * kept. A link is any type a page shows: a signature's, a property's, what a
 * declaration extends or implements, what it inherits or overrides.
 */
function pruneUnlinked(project, sections) {
    const types = ReflectionKind.ClassOrInterface | ReflectionKind.TypeAlias | ReflectionKind.Enum;
    const engineType = (refl) => refl.kindOf(types) && project.getSymbolIdFromReflection(refl)?.packageName === ENGINE;
    for (const section of sections) {
        for (const child of [...(section.children ?? [])]) {
            if (!engineType(child)) project.removeReflection(child);
        }
    }

    const inSection = (refl) => {
        for (let r = refl; r; r = r.parent) if (sections.has(r.parent)) return r;
        return undefined;
    };
    const kept = new Set();
    const queue = [];
    const visitor = makeRecursiveVisitor({
        reference(type) {
            const top = type.reflection && inSection(type.reflection);
            if (top && !kept.has(top)) {
                kept.add(top);
                queue.push(top);
            }
        },
        reflection(type) {
            queue.push(type.declaration);
        },
    });
    const add = (item) => item && queue.push(...(Array.isArray(item) ? item : [item]));
    const visit = (refl) => {
        if (refl instanceof ContainerReflection) {
            add(refl.children?.filter((child) => !sections.has(child)));
        }
        if (refl instanceof DeclarationReflection) {
            refl.type?.visit(visitor);
            add(refl.typeParameters);
            add(refl.signatures);
            add(refl.indexSignatures);
            add(refl.getSignature);
            add(refl.setSignature);
            for (const type of [
                refl.overwrites,
                refl.inheritedFrom,
                refl.implementationOf,
                ...(refl.implementedTypes ?? []),
                ...(refl.extendedTypes ?? []),
            ]) {
                type?.visit(visitor);
            }
        }
        if (refl instanceof SignatureReflection) {
            add(refl.parameters);
            add(refl.typeParameters);
            for (const type of [refl.type, refl.overwrites, refl.inheritedFrom, refl.implementationOf]) {
                type?.visit(visitor);
            }
        }
        if (!(refl instanceof DeclarationReflection || refl instanceof SignatureReflection)) {
            // A parameter's type, or a type parameter's constraint and default.
            refl.type?.visit(visitor);
            refl.default?.visit(visitor);
        }
    };
    queue.push(project);
    const seen = new Set();
    while (queue.length) {
        const refl = queue.pop();
        if (seen.has(refl)) continue;
        seen.add(refl);
        visit(refl);
    }
    for (const section of sections) {
        for (const child of [...(section.children ?? [])]) {
            if (!kept.has(child)) project.removeReflection(child);
        }
        if (section.children?.length) section.comment = new Comment([{ kind: "text", text: ENGINE_TYPES_SUMMARY }]);
        else project.removeReflection(section);
    }
}

/** A link target the docs site can reach: a URL, or an anchor on the page. */
const reachable = (target) => /^(https?:|mailto:|#)/.test(target);
/** An inline Markdown link, not an image: its text and target. */
const INLINE_LINK = /(?<!!)\[([^\]]*)\]\(([^)\s]*)[^)]*\)/g;
/** A link reference definition, `[label]: target`, on a line of its own. */
const DEFINITION = /^ {0,3}\[([^\]]+)\]:[ \t]*(\S+)[^\n]*\n?/gm;
/** A full or collapsed reference link, `[text][label]` or `[text][]`. */
const FULL_REFERENCE = /(?<!!)\[([^\]]+)\]\[([^\]]*)\]/g;
/** A shortcut reference link, `[label]`. */
const SHORTCUT_REFERENCE = /(?<![!\]])\[([^\]]+)\](?![[(:])/g;

/**
 * Unlink each Markdown link in a comment that can't resolve on the docs site,
 * keeping its text: the engine's Rust doc comments link to its own repo's
 * files, and to Rust items by path, rustdoc resolving `[text][Path::Item]`
 * with no definition. TypeDoc splits a comment at inline code and at relative
 * URLs it can't find, so each run of such parts is matched as one.
 */
function unlinkUnreachable(project) {
    const plain = (part) =>
        part.kind === "text" || part.kind === "code" || (part.kind === "relative-link" && part.target === undefined);
    const runs = (parts, each) => {
        const out = [];
        for (let i = 0; i < parts.length; ) {
            if (!plain(parts[i])) {
                out.push(parts[i++]);
                continue;
            }
            const run = [];
            while (i < parts.length && plain(parts[i])) run.push(parts[i++]);
            const text = run.map((part) => part.text).join("");
            const rewritten = each(text);
            if (rewritten === text) out.push(...run);
            else out.push({ kind: "text", text: rewritten });
        }
        return out;
    };
    for (const refl of Object.values(project.reflections)) {
        const comment = refl.comment;
        if (!comment) continue;
        const contents = [comment.summary, ...comment.blockTags.map((tag) => tag.content)];
        // The labels this comment defines, by whether their target is reachable.
        const live = new Set();
        const dead = new Set();
        for (const parts of contents) {
            runs(parts, (text) => {
                for (const [, label, target] of text.matchAll(DEFINITION)) {
                    (reachable(target) ? live : dead).add(label.toLowerCase());
                }
                return text;
            });
        }
        const rewrite = (text) =>
            text
                .replace(INLINE_LINK, (link, label, target) => (reachable(target) ? link : label))
                .replace(DEFINITION, (line, label) => (dead.has(label.toLowerCase()) ? "" : line))
                .replace(FULL_REFERENCE, (link, label, ref) => (live.has((ref || label).toLowerCase()) ? link : label))
                .replace(SHORTCUT_REFERENCE, (link, label) => (dead.has(label.toLowerCase()) ? label : link));
        comment.summary = runs(comment.summary, rewrite);
        for (const tag of comment.blockTags) tag.content = runs(tag.content, rewrite);
    }
}

/**
 * Markdown on one line of a table row, as typedoc-plugin-markdown's own tables
 * put it (its `formatTableCell`, which it doesn't export): line breaks and runs
 * of spaces as one space, a code block as inline code.
 */
function tableCell(markdown) {
    return markdown
        .replace(/\r?\n/g, " ")
        .replace(/```(\w+\s)?([\s\S]*?)```/g, (_block, _lang, code) => `\`${code.trim()}\``)
        .replace(/ +/g, " ")
        .trim();
}

/**
 * typedoc-plugin-markdown's pages less what a reader skims past. A signature
 * is a code block (`useCodeBlocks`), so a "Returns" that only repeats its type
 * goes, and a getter — the API has no setters — loses its "Get Signature"
 * heading, its code block saying as much. "Inherited from" and "Overrides"
 * go: what a member inherits from udoc-ui's base class is nothing a reader
 * acts on, and on the viewer's and the editor's pages it is nearly every one.
 *
 * A table of described properties is two columns, each property's type under
 * its name. In three, the names, the longest types and the URLs in the
 * descriptions came to more than the page's width, and the descriptions
 * scrolled out of sight. A property of an object type is one row, the type
 * written out, unless its fields say something of their own: then a row
 * apiece follows it, `property.field` — an event's payload, say.
 */
class UDocThemeContext extends MarkdownThemeContext {
    constructor(theme, page, options) {
        super(theme, page, options);
        const { accessor, inheritance, propertiesTable, signatureReturns } = this.partials;
        this.partials = {
            ...this.partials,
            accessor: (model, options) => {
                const get = model.getSignature;
                if (!get || model.setSignature) return accessor(model, options);
                const { headingLevel } = options;
                return [
                    this.partials.signatureTitle(get, { accessor: "get" }),
                    get.comment ? this.partials.comment(get.comment, { headingLevel }) : "",
                    get.type ? this.partials.signatureReturns(get, { headingLevel }) : "",
                    model.comment ? this.partials.comment(model.comment, { headingLevel }) : "",
                    this.partials.inheritance(model, { headingLevel }),
                ]
                    .filter(Boolean)
                    .join("\n\n");
            },
            // The partial reads no more of the model than these.
            inheritance: (model, options) => inheritance({ implementationOf: model.implementationOf }, options),
            propertiesTable: (model, options) => {
                const fieldRows = new Set(
                    model.filter((property) => property.type?.declaration?.children?.some((field) => field.comment)),
                );
                const properties = model.flatMap((property) =>
                    fieldRows.has(property) ? this.helpers.getFlattenedDeclarations([property]) : [property],
                );
                const comments = properties.map((property) =>
                    property.comment ? this.partials.comment(property.comment, { isTableColumn: true }).trim() : "",
                );
                if (!comments.some(Boolean)) return propertiesTable(model, options);
                const rows = properties.map((property, index) => {
                    const anchor = this.router.hasUrl(property)
                        ? `<a id="${this.router.getAnchor(property)}"></a> `
                        : "";
                    const modifier = this.helpers.getModifier(property);
                    let name = `\`${modifier ? `${modifier} ` : ""}${property.name}${property.flags.isOptional ? "?" : ""}\``;
                    if (property.isDeprecated?.()) name = `~~${name}~~`;
                    const type = this.helpers.getDeclarationType(property);
                    const forceCollapse = !fieldRows.has(property);
                    const typeLine = type ? `<br>${this.partials.someType(type, { forceCollapse })}` : "";
                    return `| ${tableCell(anchor + name + typeLine)} | ${tableCell(comments[index] || "-")} |`;
                });
                const kind = options?.isEventProps
                    ? i18n.theme_event()
                    : ReflectionKind.singularString(ReflectionKind.Property);
                return [`| ${kind} | ${i18n.theme_description()} |`, "| ------ | ------ |", ...rows].join("\n");
            },
            signatureReturns: (model, options) => {
                const declaration = model.type?.declaration;
                const repeatsType =
                    !model.comment?.getTag("@returns") &&
                    !(model.type && this.helpers.hasUsefulTypeDetails(model.type)) &&
                    !declaration?.signatures?.length &&
                    !declaration?.children;
                return repeatsType ? "" : signatureReturns(model, options);
            },
        };
    }
}

class UDocTheme extends MarkdownTheme {
    getRenderContext(page) {
        return new UDocThemeContext(this, page, this.application.options);
    }
}

export function load(app) {
    app.renderer.defineTheme("udoc", UDocTheme);

    let common;
    const exportingCommon = [];

    app.converter.on(Converter.EVENT_RESOLVE_BEGIN, (context) => {
        const project = context.project;
        // TypeDoc names a module by its entry point's path: `udoc-viewer/dist`.
        const byDir = new Map(project.children.map((module) => [module.name.split("/")[0], module]));
        common = byDir.get("udoc-ui");

        for (const { dir, name, summary, common: exportsCommon } of MODULES) {
            const module = byDir.get(dir);
            if (!module) throw new Error(`typedoc-plugin: no entry point for ${dir}`);
            module.name = name;
            const parts = [{ kind: "text", text: summary ?? description(dir) }];
            if (exportsCommon) {
                exportingCommon.push(module);
                parts.push(
                    { kind: "text", text: "\n\nAlso exports everything in " },
                    { kind: "inline-tag", tag: "@link", text: "Common", target: common },
                    { kind: "text", text: "." },
                );
            }
            module.comment = new Comment(parts);
        }

        const order = (module) => MODULES.findIndex((m) => m.name === module.name);
        project.children.sort((a, b) => order(a) - order(b));
        project.childrenIncludingDocuments?.sort((a, b) => order(a) - order(b));
    });

    // After typedoc-plugin-missing-exports fills the sections (at priority 0).
    app.converter.on(
        Converter.EVENT_RESOLVE_BEGIN,
        (context) => {
            const name = app.options.getValue("internalModule");
            const sections = context.project.children.flatMap(
                (module) => module.children?.filter((child) => child.name === name) ?? [],
            );
            pruneUnlinked(context.project, new Set(sections));
            unlinkUnreachable(context.project);
        },
        -50,
    );

    // After TypeDoc groups each module's members (at priority -100).
    app.converter.on(
        Converter.EVENT_RESOLVE_END,
        (context) => {
            const fromCommon = (child) =>
                child instanceof ReferenceReflection && child.getTargetReflectionDeep().parent === common;
            for (const module of exportingCommon) {
                module.groups = module.groups
                    ?.map((group) => {
                        group.children = group.children.filter((child) => !fromCommon(child));
                        return group;
                    })
                    .filter((group) => group.children.length > 0);
            }
            // Each package's exports, and each of its "Unexported types".
            for (const module of context.project.getReflectionsByKind(ReflectionKind.Module)) {
                for (const group of module.groups ?? []) {
                    group.children.sort((a, b) => a.name.localeCompare(b.name));
                }
            }
            // TypeDoc files a package's "Engine types" under "Modules", its
            // first group. It is what the package's types are built from,
            // so it goes last, under its own name.
            const name = app.options.getValue("internalModule");
            for (const module of context.project.children ?? []) {
                const index = module.groups?.findIndex((group) => group.children.every((child) => child.name === name));
                if (index === undefined || index < 0) continue;
                const [group] = module.groups.splice(index, 1);
                group.title = name;
                module.groups.push(group);
            }
        },
        -200,
    );
}
