import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

let fontBytes: Promise<Buffer[]> | undefined;
export function loadPdfFonts() {
  fontBytes ??= Promise.all(["NotoSans-Regular.ttf", "NotoSans-Bold.ttf"].map((name) =>
    readFile(join(process.cwd(), "src/assets/fonts", name))));
  return fontBytes;
}
