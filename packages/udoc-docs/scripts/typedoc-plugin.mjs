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
import { readFileSync } from "node:fs";
import { Comment, Converter, ReferenceReflection } from "typedoc";

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
            for (const module of context.project.children) {
                for (const group of module.groups ?? []) {
                    group.children.sort((a, b) => a.name.localeCompare(b.name));
                }
            }
        },
        -200,
    );
}
