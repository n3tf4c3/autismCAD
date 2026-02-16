import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  time,
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

export const accessLogs = pgTable(
  "access_logs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    userId: bigint("user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    userEmail: varchar("user_email", { length: 160 }).notNull(),
    ipOrigem: varchar("ip_origem", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    browser: varchar("browser", { length: 120 }),
    status: varchar("status", { length: 16 }).notNull().default("SUCESSO"),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_access_logs_created_at").on(table.createdAt),
    index("idx_access_logs_user_id").on(table.userId),
    index("idx_access_logs_status_created_at").on(table.status, table.createdAt),
  ]
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

export const terapeutas = pgTable(
  "terapeutas",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    nome: varchar("nome", { length: 120 }).notNull(),
    cpf: varchar("cpf", { length: 11 }).notNull(),
    dataNascimento: date("data_nascimento"),
    email: varchar("email", { length: 120 }),
    telefone: varchar("telefone", { length: 20 }),
    endereco: varchar("endereco", { length: 255 }),
    logradouro: varchar("logradouro", { length: 180 }),
    numero: varchar("numero", { length: 20 }),
    bairro: varchar("bairro", { length: 120 }),
    cidade: varchar("cidade", { length: 120 }),
    cep: varchar("cep", { length: 8 }),
    especialidade: varchar("especialidade", { length: 80 }).notNull(),
    usuarioId: bigint("usuario_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uk_terapeutas_cpf").on(table.cpf),
    index("idx_terapeutas_usuario").on(table.usuarioId),
    index("idx_terapeutas_nome").on(table.nome),
  ]
);

export const atendimentos = pgTable(
  "atendimentos",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedByDefaultAsIdentity(),
    pacienteId: bigint("paciente_id", { mode: "number" })
      .notNull()
      .references(() => pacientes.id, { onDelete: "cascade" }),
    terapeutaId: bigint("terapeuta_id", { mode: "number" }).references(
      () => terapeutas.id,
      { onDelete: "set null" }
    ),
    data: date("data").notNull(),
    horaInicio: time("hora_inicio").notNull(),
    horaFim: time("hora_fim").notNull(),
    turno: varchar("turno", { length: 20 }).notNull().default("Matutino"),
    periodoInicio: date("periodo_inicio"),
    periodoFim: date("periodo_fim"),
    presenca: varchar("presenca", { length: 20 })
      .notNull()
      .default("Nao informado"),
    realizado: boolean("realizado").notNull().default(false),
    statusRepasse: varchar("status_repasse", { length: 20 })
      .notNull()
      .default("Pendente"),
    resumoRepasse: text("resumo_repasse"),
    motivo: text("motivo"),
    observacoes: text("observacoes"),
    deletedAt: timestamp("deleted_at", { withTimezone: false }),
    deletedByUserId: bigint("deleted_by_user_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_atend_paciente").on(table.pacienteId),
    index("idx_atend_terapeuta").on(table.terapeutaId),
    index("idx_atend_data_terapeuta").on(table.data, table.terapeutaId),
    index("idx_atend_deleted_at").on(table.deletedAt),
  ]
);

export const anamnese = pgTable(
  "anamnese",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    pacienteId: bigint("paciente_id", { mode: "number" })
      .notNull()
      .references(() => pacientes.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uk_anamnese_paciente").on(table.pacienteId)]
);

export const anamneseVersions = pgTable(
  "anamnese_versions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    pacienteId: bigint("paciente_id", { mode: "number" })
      .notNull()
      .references(() => pacientes.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("Rascunho"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uk_anamnese_versions_paciente_version").on(table.pacienteId, table.version),
    index("idx_anamnese_versions_paciente_created").on(table.pacienteId, table.createdAt),
  ]
);

export const prontuarioDocumentos = pgTable(
  "prontuario_documentos",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    pacienteId: bigint("paciente_id", { mode: "number" })
      .notNull()
      .references(() => pacientes.id, { onDelete: "cascade" }),
    tipo: varchar("tipo", { length: 40 }).notNull(),
    version: integer("version").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("Rascunho"),
    titulo: varchar("titulo", { length: 180 }),
    payload: jsonb("payload").notNull(),
    createdByUserId: bigint("created_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdByRole: varchar("created_by_role", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: false }),
    deletedByUserId: bigint("deleted_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("uk_prontuario_documentos_paciente_tipo_version").on(
      table.pacienteId,
      table.tipo,
      table.version
    ),
    index("idx_prontuario_documentos_paciente").on(table.pacienteId),
    index("idx_prontuario_documentos_tipo").on(table.tipo),
    index("idx_prontuario_documentos_created_at").on(table.createdAt),
    index("idx_prontuario_documentos_deleted_at").on(table.deletedAt),
  ]
);

export const evolucoes = pgTable(
  "evolucoes",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    pacienteId: bigint("paciente_id", { mode: "number" })
      .notNull()
      .references(() => pacientes.id, { onDelete: "cascade" }),
    terapeutaId: bigint("terapeuta_id", { mode: "number" })
      .notNull()
      .references(() => terapeutas.id, { onDelete: "restrict" }),
    atendimentoId: bigint("atendimento_id", { mode: "number" }).references(() => atendimentos.id, {
      onDelete: "set null",
    }),
    data: date("data").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: false }),
    deletedByUserId: bigint("deleted_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("uk_evolucoes_paciente_terapeuta_data_ativo")
      .on(table.pacienteId, table.terapeutaId, table.data)
      .where(sql`${table.deletedAt} is null`),
    index("idx_evolucoes_paciente").on(table.pacienteId),
    index("idx_evolucoes_terapeuta").on(table.terapeutaId),
    index("idx_evolucoes_data").on(table.data),
    index("idx_evolucoes_deleted_at").on(table.deletedAt),
  ]
);
