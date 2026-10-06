const assert = require("node:assert/strict");
const { test } = require("node:test");
const shellQuote = require("shell-quote");
const sharp = require("sharp");
const semver = require("semver");

test("shell-quote blocks line-terminator injection after comments and preserves valid arguments", () => {
  for (const newline of ["\n", "\r", "\u2028", "\u2029"]) {
    assert.throws(() => shellQuote.quote([
      "echo", "ok", { comment: "synthetic" }, `a${newline}QA_INJECTION;#`,
    ]), TypeError);
  }
  const args = ["echo", "hello world", "'quoted'", "$HOME", "first\nsecond"];
  assert.deepEqual(shellQuote.parse(shellQuote.quote(args)), args);
});

test("sharp uses patched librsvg and converts synthetic SVG and PNG images", async () => {
  assert.ok(semver.gte(sharp.versions.rsvg, "2.63.2"), `Unpatched librsvg: ${sharp.versions.rsvg}`);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="gold"/></svg>');
  const png = await sharp(svg).resize(24, 16).png().toBuffer();
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 24);
  assert.equal(metadata.height, 16);
});
