const path = require("node:path");
const { createRequire } = require("node:module");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "../..");

// Executa os modulos reais; substitui apenas as fronteiras explicitamente fornecidas.
// Nenhum bundle e escrito e nenhum .env e carregado pelo harness.
async function loadSource(entry, fixtures = {}, workspace = "web", sourceOverrides = {}) {
  const mocks = { "server-only": {}, ...fixtures };
  const file = path.join(root, entry);
  const result = await esbuild.build({
    entryPoints: [file], absWorkingDir: root, bundle: true, write: false,
    platform: "node", format: "cjs", packages: "external", jsx: "automatic",
    tsconfig: path.join(root, `apps/${workspace}/tsconfig.json`), logLevel: "silent",
    plugins: [{ name: "test-boundaries", setup(build) {
      build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, (args) => {
        const relative = path.relative(root, args.path).replaceAll("\\", "/");
        if (Object.hasOwn(sourceOverrides, relative)) return { contents: sourceOverrides[relative], loader: relative.endsWith("tsx") ? "tsx" : "ts" };
      });
      build.onResolve({ filter: /.*/ }, (args) => {
        if (Object.hasOwn(mocks, args.path)) return { path: args.path, namespace: "fixture" };
        const match = /^@autismcad\/(db|validators|shared)\/(.*)$/.exec(args.path);
        if (match) return { path: path.join(root, "packages", match[1], "src", `${match[2]}.ts`) };
      });
      build.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
        contents: Object.keys(mocks[args.path]).map((key) => key === "default"
          ? `export default __fixtures[${JSON.stringify(args.path)}].default;`
          : `export const ${key} = __fixtures[${JSON.stringify(args.path)}][${JSON.stringify(key)}];`).join("\n"),
        loader: "js",
      }));
    } }],
  });
  const mod = { exports: {} };
  new Function("require", "module", "exports", "__filename", "__dirname", "__fixtures", result.outputFiles[0].text)(
    createRequire(file), mod, mod.exports, file, path.dirname(file), mocks,
  );
  return mod.exports;
}

function queryResult(rows, capture = () => {}) {
  return new Proxy({}, { get(_target, key) {
    if (key === "then") return (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
    return (...args) => { capture(key, args); return queryResult(rows, capture); };
  } });
}
module.exports = { loadSource, queryResult, root };
