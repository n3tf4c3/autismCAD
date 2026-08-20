import "server-only";

// A logica de reconhecimento vive em @autismcad/shared/pg-errors (testavel sem
// `server-only`); aqui so o ponto de entrada usado pelos services.
export { isForeignKeyViolation, isUniqueViolation } from "@autismcad/shared/pg-errors";
