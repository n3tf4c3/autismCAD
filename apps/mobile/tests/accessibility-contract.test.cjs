const assert = require("node:assert/strict");
const { readdirSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const ui = readFileSync(join(__dirname, "..", "src", "ui.tsx"), "utf8");

function tsxFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.isFile() && path.endsWith(".tsx") ? [path] : [];
  });
}

test("primitivos mobile expoem nome, papel e estado acessiveis", () => {
  assert.match(ui, /accessibilityLabel=\{accessibilityLabel \?\? label\}/);
  assert.match(ui, /accessibilityRole="button"/);
  assert.match(ui, /accessibilityState=\{\{ disabled: Boolean\(disabled \|\| loading\), busy: Boolean\(loading\) \}\}/);
  assert.equal((ui.match(/accessibilityRole="radio"/g) || []).length, 2);
  assert.equal((ui.match(/accessibilityState=\{\{ selected: active \}\}/g) || []).length, 3);
  assert.match(ui, /accessibilityLiveRegion="assertive"/);
});

test("controles Pressable e Field do app recebem nome e papel", () => {
  const files = [join(__dirname, "..", "src", "ui.tsx"), ...tsxFiles(join(__dirname, "..", "app"))];

  for (const path of files) {
    const contents = readFileSync(path, "utf8");
    for (const pressable of contents.match(/<Pressable\b[\s\S]*?>/g) || []) {
      assert.match(pressable, /accessibilityRole=/, `${path}: Pressable sem accessibilityRole`);
      assert.match(pressable, /accessibilityLabel=/, `${path}: Pressable sem accessibilityLabel`);
    }
    for (const field of contents.match(/<Field\b[\s\S]*?\/>/g) || []) {
      assert.match(field, /(label|accessibilityLabel)=/, `${path}: Field sem nome acessivel`);
    }
  }
});
