import {
  bigint,
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

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
