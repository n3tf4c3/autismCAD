import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";

// Achado 69: carrega o env por caminho absoluto a partir da localizacao deste
// arquivo, para que os scripts funcionem independentemente do cwd (raiz do
// monorepo ou apps/web). Importar este modulo como efeito colateral, antes de
// qualquer leitura de process.env.
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(webRoot, ".env.local") });
config({ path: resolve(webRoot, ".env") });
