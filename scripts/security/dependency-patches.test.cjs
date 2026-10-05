const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const Module = require("node:module");
const forge = require("node-forge");
const braces = require("braces");

function originalModule(file, undo) {
  const filename = require.resolve(file);
  const source = readFileSync(filename, "utf8").replace(/\r\n/g, "\n");
  const original = undo(source);
  assert.notEqual(original, source, "Negative control must remove the local fix");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(require("node:path").dirname(filename));
  loaded._compile(original, filename);
  return loaded.exports;
}

test("braces preserves nested patterns, ranges, escapes and micromatch contracts", () => {
  assert.deepEqual(braces.expand("src/{app,lib}/{a,b}.js"), ["src/app/a.js", "src/app/b.js", "src/lib/a.js", "src/lib/b.js"]);
  assert.deepEqual(braces.expand("file{01..03}.txt"), ["file01.txt", "file02.txt", "file03.txt"]);
  assert.deepEqual(braces("x\\{a,b\\}"), ["x{a,b}"]);
  assert.equal(braces.stringify(braces.parse("a{b,{c,d}}")), "a{b,{c,d}}");
  assert.deepEqual(require("micromatch")(["app/a.ts", "app/a.js", "lib/b.ts"], "{app,lib}/*.ts"), ["app/a.ts", "lib/b.ts"]);
  assert.doesNotThrow(() => braces.compile("{".repeat(100) + "x" + "}".repeat(100)));
});

test("braces rejects deep strings and ASTs before call-stack exhaustion, in a bounded process", () => {
  execFileSync(process.execPath, ["-e", `
    const assert = require('node:assert/strict'), b = require('braces');
    for (const [open, close] of [['{','}'], ['(',')']]) {
      for (const input of [open.repeat(4000)+'x'+close.repeat(4000), open.repeat(4000)+'x']) {
        for (const op of ['parse','compile','expand','stringify']) {
          assert.throws(() => b[op](input), {name:'SyntaxError',message:/nesting depth/});
        }
      }
    }
    function ast() {
      let node = {type:'text',value:'x'};
      for(let i=0;i<10000;i++) {const parent={type:'root',nodes:[node]};node.parent=parent;node=parent;}
      return node;
    }
    for(const op of ['compile','expand','stringify']) assert.throws(() => b[op](ast()), {name:'SyntaxError',message:/nesting depth/});
  `], { timeout: 5000, stdio: "pipe" });
});

test("braces negative control reproduces the vulnerable AST stack overflow", () => {
  const compile = originalModule("braces/lib/compile", (source) => source.replace(/^    if \(depth > 128\).*\n/m, ""));
  let node = { type: "text", value: "x" };
  for (let i = 0; i < 10000; i++) node = { type: "root", nodes: [node] };
  assert.throws(() => compile(node), { name: "RangeError", message: /call stack/ });
});

test("RSA accepts valid SHA256 signatures and rejects extra DigestAlgorithm elements", () => {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const md = forge.md.sha256.create().update("Synthetic dependency regression; no real credentials");
  const digest = md.digest().getBytes();
  assert.equal(keys.publicKey.verify(digest, keys.privateKey.sign(md)), true);
  const { asn1 } = forge;
  const make = (type, constructed, value) => asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);
  const oid = make(asn1.Type.OID, false, asn1.oidToDer(forge.oids.sha256).getBytes());
  const nil = make(asn1.Type.NULL, false, "");
  const garbage = make(asn1.Type.OCTETSTRING, false, "ignored attacker bytes");
  const sign = (algorithm) => keys.privateKey.sign(asn1.toDer(make(asn1.Type.SEQUENCE, true, [
    make(asn1.Type.SEQUENCE, true, algorithm), make(asn1.Type.OCTETSTRING, false, digest)
  ])).getBytes(), "NONE");
  for (const algorithm of [[oid], [oid, nil]]) assert.equal(keys.publicKey.verify(digest, sign(algorithm)), true);
  const originalPki = originalModule("node-forge/lib/rsa", (source) => source.replace(
    "obj.value.length !== 2 ||\n            obj.value[0].value.length < 1 ||\n            obj.value[0].value.length > 2 ||\n            (obj.value[0].value.length === 2 && capture.parameters !== '')",
    "obj.value.length !== 2"
  ));
  const originalKey = originalPki.setPublicKey(keys.publicKey.n, keys.publicKey.e);
  for (const algorithm of [[oid, nil, garbage], [oid, garbage], [oid, make(asn1.Type.NULL, false, "garbage")]]) {
    const signature = sign(algorithm);
    assert.equal(originalKey.verify(digest, signature), true, "Unpatched verifier accepted the malformed signature");
    assert.throws(() => keys.publicKey.verify(digest, signature), /valid RSASSA-PKCS1-v1_5 DigestInfo/);
  }
});
