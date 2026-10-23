// Shapes TypeDoc's modules into the reference a reader navigates: one per
// published package, named as it is imported and summarized by its
// `package.json` description, in the order a reader reaches for them.
//
// udoc-ui is nobody's import: the viewer and the editor each re-export all of
// it, so its module is "Common", and theirs list only what each adds — not a
// "Re-exports" line for every symbol of Common, which would bury it. udoc-ui is
// the first entry point, so it is where TypeDoc converts those symbols; another
// package that re-exports a few of them (udoc-node, its error) keeps its
// "Re-exports" lines, which link into Common.
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
    makeRecursiveVisitor,
} from "typedoc";

/** Each entry point's package directory, in sidebar order, and the module it becomes. */
const MODULES = [
    { dir: "udoc-viewer", name: "@docmentis/udoc-viewer", common: true },
    { dir: "udoc-editor", name: "@docmentis/udoc-editor", common: true },
    {
        dir: "udoc-ui",
        name: "Common",
        summary:
            "The base class the viewer and the editor extend, and the types their calls take and return. " +
            "Both packages export all of it: import it from whichever you use, not from `@docmentis/udoc-ui`.",
    },
    { dir: "udoc-node", name: "@docmentis/udoc-node" },
    { dir: "udoc-server", name: "@docmentis/udoc-server" },
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

export function load(app) {
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
        },
        -200,
    );
}
