import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    nome: varchar("nome", { length: 120 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    senhaHash: varchar("senha_hash", { length: 255 }).notNull(),
    role: varchar("role", { length: 32 }).notNull().default("terapeuta"),
    ativo: boolean("ativo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uk_users_email").on(table.email)]
);

export const roles = pgTable("roles", {
  slug: varchar("slug", { length: 32 }).primaryKey(),
  nome: varchar("nome", { length: 80 }).notNull(),
});

export const permissions = pgTable(
  "permissions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    resource: varchar("resource", { length: 80 }).notNull(),
    action: varchar("action", { length: 40 }).notNull(),
    descricao: text("descricao"),
  },
  (table) => [uniqueIndex("uk_permissions_resource_action").on(table.resource, table.action)]
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    role: varchar("role", { length: 32 }).notNull(),
    permissionId: bigint("permission_id", { mode: "number" })
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.role, table.permissionId], name: "pk_role_permissions" }),
    index("idx_role_permissions_role").on(table.role),
    index("idx_role_permissions_permission").on(table.permissionId),
  ]
);

export const pacientes = pgTable(
  "pacientes",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    nome: varchar("nome", { length: 120 }).notNull(),
    cpf: varchar("cpf", { length: 11 }).notNull(),
    dataNascimento: date("data_nascimento"),
    convenio: varchar("convenio", { length: 40 }).notNull().default("Particular"),
    email: varchar("email", { length: 120 }),
    nomeResponsavel: varchar("nome_responsavel", { length: 120 }),
    telefone: varchar("telefone", { length: 20 }),
    telefone2: varchar("telefone2", { length: 20 }),
    nomeMae: varchar("nome_mae", { length: 120 }),
    nomePai: varchar("nome_pai", { length: 120 }),
    sexo: varchar("sexo", { length: 20 }),
    dataInicio: date("data_inicio"),
    foto: varchar("foto", { length: 255 }),
    laudo: varchar("laudo", { length: 255 }),
    documento: varchar("documento", { length: 255 }),
    ativo: boolean("ativo").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: false }),
    deletedByUserId: bigint("deleted_by_user_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uk_pacientes_cpf_ativo")
      .on(table.cpf)
      .where(sql`${table.deletedAt} is null`),
    index("idx_pacientes_nome").on(table.nome),
  ]
);

export const terapias = pgTable("terapias", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  nome: varchar("nome", { length: 40 }).notNull().unique(),
});

export const pacienteTerapia = pgTable(
  "paciente_terapia",
  {
    pacienteId: bigint("paciente_id", { mode: "number" })
      .notNull()
      .references(() => pacientes.id, { onDelete: "cascade" }),
    terapiaId: integer("terapia_id")
      .notNull()
      .references(() => terapias.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.pacienteId, table.terapiaId], name: "pk_paciente_terapia" })]
);
