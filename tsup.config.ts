import { defineConfig } from "tsup";

// `clean` is off in both configs and done once by the build script instead:
// tsup runs the two in parallel, and one cleaning dist/ would delete what the
// other had just written.
const shared = {
  format: ["esm", "cjs"] as ("esm" | "cjs")[],
  dts: true,
  clean: false,
  sourcemap: true,
  // NOT `treeshake: true`: it post-processes through rollup, which strips the
  // "use client" banner. esbuild already tree-shakes when bundling.
  target: "es2020",
  // Peers are never bundled — a second React breaks hooks and portals in the host.
  external: ["react", "react-dom", "react/jsx-runtime"],
  outExtension: ({ format }: { format: string }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
};

export default defineConfig([
  {
    ...shared,
    entry: { index: "src/index.ts" },
    // esbuild strips top-of-file directives, so "use client" is re-attached to
    // every output chunk. The provider uses state and effects; without the
    // directive Next's RSC compiler treats it as a server component.
    banner: { js: '"use client";' },
  },
  {
    ...shared,
    // The pure validator. Imported by bin/starterkit-intro.mjs and by a host's
    // build gate under plain Node, so it carries no directive and no React.
    entry: { schema: "src/schema.ts" },
  },
]);
