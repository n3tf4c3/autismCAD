import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  AnamnesePayloadJson,
  AnamneseVersionPayloadJson,
  EvolucaoPayloadJson,
  ProntuarioDocumentoPayloadJson,
  UserPacienteVinculosAuditPayload,
} from "./jsonb-types";

export const users = pgTable(
  "users",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    nome: varchar("nome", { length: 120 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    senhaHash: varchar("senha_hash", { length: 255 }).notNull(),
    role: varchar("role", { length: 32 })
      .notNull()
      .default("profissional")
      .references(() => roles.slug, { onDelete: "restrict", onUpdate: "cascade" }),
    ativo: boolean("ativo").notNull().default(true),
    // Achado 103: versão de credencial dos tokens Bearer mobile. Incrementada na troca de
    // senha para invalidar access/refresh tokens emitidos antes (revogação sem store).
    tokenVersion: integer("token_version").notNull().default(0),
    // Consentimento LGPD: versão da Política de Privacidade aceita + quando. Nulo = nunca
    // aceitou (precisa consentir). Reconsentimento quando a versão vigente muda.
    politicaVersaoAceita: varchar("politica_versao_aceita", { length: 16 }),
    politicaAceitaEm: timestamp("politica_aceita_em", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByUserId: bigint("deleted_by_user_id", { mode: "number" }).references(
      (): AnyPgColumn => users.id,
      {
        onDelete: "set null",
      }
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Achado 61: unico parcial por registros ativos, igual a pacientes/terapeutas,
    // permitindo reuso do e-mail apos exclusao logica.
    uniqueIndex("uk_users_email_ativo")
      .on(table.email)
      .where(sql`${table.deletedAt} is null`),
    index("idx_users_deleted_at").on(table.deletedAt),
  ]
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_access_logs_created_at").on(table.createdAt),
    index("idx_access_logs_user_id").on(table.userId),
    // created_at desc espelha a baseline (0000_baseline; listagem mais recente primeiro).
    index("idx_access_logs_status_created_at").on(table.status, table.createdAt.desc()),
    // Achado 121: dominio fechado (espelha ACCESS_LOG_STATUSES; app so grava esses dois).
    check("ck_access_logs_status", sql`${table.status} in ('SUCESSO', 'FALHA')`),
  ]
);

// Achado 80: store dos refresh tokens da API mobile. Cada refresh token emitido tem seu
// jti registrado aqui; o refresh rotaciona (revoga o usado e grava o novo) e o logout
// revoga, permitindo revogacao individual antes da expiracao. O JWT continua assinado —
// o store so decide se ele ainda vale (vazamento do banco nao permite forjar token).
export const apiRefreshTokens = pgTable(
  "api_refresh_tokens",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jti: varchar("jti", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uk_api_refresh_tokens_jti").on(table.jti),
    index("idx_api_refresh_tokens_user").on(table.userId),
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
    role: varchar("role", { length: 32 })
      .notNull()
      .references(() => roles.slug, { onDelete: "cascade", onUpdate: "cascade" }),
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
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByUserId: bigint("deleted_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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

export const userPacienteVinculos = pgTable(
  "user_paciente_vinculos",
  {
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pacienteId: bigint("paciente_id", { mode: "number" })
      .notNull()
      .references(() => pacientes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.pacienteId],
      name: "pk_user_paciente_vinculos",
    }),
    index("idx_user_paciente_vinculos_paciente").on(table.pacienteId),
  ]
);

export const userPacienteVinculosAudit = pgTable(
  "user_paciente_vinculos_audit",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    actorUserId: bigint("actor_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    targetUserId: bigint("target_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    previousRole: varchar("previous_role", { length: 32 }),
    nextRole: varchar("next_role", { length: 32 }).notNull(),
    removedPacienteIds: jsonb("removed_paciente_ids").$type<UserPacienteVinculosAuditPayload>().notNull(),
    reason: varchar("reason", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "ck_user_paciente_vinculos_audit_removed_ids_array",
      sql`jsonb_typeof(${table.removedPacienteIds}) = 'array'`
    ),
    check(
      "ck_user_paciente_vinculos_audit_removed_ids_positive_int",
      sql`public.jsonb_is_positive_int_array(${table.removedPacienteIds})`
    ),
    index("idx_user_paciente_vinc_audit_target").on(table.targetUserId),
    index("idx_user_paciente_vinc_audit_actor").on(table.actorUserId),
    index("idx_user_paciente_vinc_audit_created_at").on(table.createdAt),
  ]
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
    // Default espelha a baseline (0000_baseline; compat de inserts diretos no banco).
    especialidade: varchar("especialidade", { length: 80 }).notNull().default("Nao informado"),
    observacao: text("observacao"),
    ativo: boolean("ativo").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByUserId: bigint("deleted_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    usuarioId: bigint("usuario_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uk_terapeutas_cpf_ativo")
      .on(table.cpf)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("uk_terapeutas_usuario_ativo")
      .on(table.usuarioId)
      .where(sql`${table.deletedAt} is null and ${table.usuarioId} is not null`),
    index("idx_terapeutas_usuario").on(table.usuarioId),
    index("idx_terapeutas_nome").on(table.nome),
    index("idx_terapeutas_deleted_at").on(table.deletedAt),
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
    profissionalId: bigint("profissional_id", { mode: "number" })
      .notNull()
      .references(() => terapeutas.id, { onDelete: "restrict" }),
    data: date("data").notNull(),
    horaInicio: time("hora_inicio").notNull(),
    horaFim: time("hora_fim").notNull(),
    isGrupo: boolean("is_grupo").notNull().default(false),
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
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByUserId: bigint("deleted_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Business rule:
    // - Presente => realizado = true
    // - Any other presenca => realizado = false
    // Keep this invariant in DB so service-level updates cannot diverge silently.
    check(
      "ck_atendimentos_realizado_presenca",
      sql`${table.realizado} = (${table.presenca} = 'Presente')`
    ),
    // Achado 66: restringe dominios criticos aos valores usados pela aplicacao.
    check("ck_atendimentos_turno", sql`${table.turno} in ('Matutino', 'Vespertino')`),
    check(
      "ck_atendimentos_presenca",
      sql`${table.presenca} in ('Presente', 'Ausente', 'Nao informado')`
    ),
    check(
      "ck_atendimentos_status_repasse",
      sql`${table.statusRepasse} in ('Pendente', 'Concluido')`
    ),
    // Achado 86/100: garante ordem de horario no banco, alem dos validators.
    check("ck_atendimentos_hora_ordem", sql`${table.horaFim} > ${table.horaInicio}`),
    index("idx_atend_paciente").on(table.pacienteId),
    index("idx_atend_profissional").on(table.profissionalId),
    index("idx_atend_data_profissional").on(table.data, table.profissionalId),
    index("idx_atend_deleted_at").on(table.deletedAt),
    // Achado 104: alvo da FK composta de evolucoes (id ja e unico; o triplo permite
    // que evolucoes referencie atendimento + paciente + profissional de uma vez).
    unique("uk_atendimentos_id_paciente_profissional").on(
      table.id,
      table.pacienteId,
      table.profissionalId
    ),
  ]
);

export const agendaBloqueios = pgTable(
  "agenda_bloqueios",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    profissionalId: bigint("profissional_id", { mode: "number" })
      .notNull()
      .references(() => terapeutas.id, { onDelete: "cascade" }),
    data: date("data").notNull(),
    horaInicio: time("hora_inicio").notNull(),
    horaFim: time("hora_fim").notNull(),
    observacoes: text("observacoes"),
    createdByUserId: bigint("created_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_agenda_bloqueios_prof_data").on(table.profissionalId, table.data),
    // Achado 86/100: garante ordem de horario no banco, alem dos validators.
    check("ck_agenda_bloqueios_hora_ordem", sql`${table.horaFim} > ${table.horaInicio}`),
  ]
);

export const anamnese = pgTable(
  "anamnese",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    pacienteId: bigint("paciente_id", { mode: "number" })
      .notNull()
      // Achado 115: restrict protege historico clinico de hard-delete acidental do paciente
      // (fluxo normal usa soft-delete; purga deliberada deve remover os filhos por rotina).
      .references(() => pacientes.id, { onDelete: "restrict" }),
    payload: jsonb("payload").$type<AnamnesePayloadJson>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uk_anamnese_paciente").on(table.pacienteId)]
);

export const anamneseVersions = pgTable(
  "anamnese_versions",
  {
    // Immutable snapshots: versions are append-only and removed with hard-delete.
    // The mutable "current" view lives in `anamnese`, so this table intentionally
    // does not track `updatedAt` or soft-delete metadata.
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    pacienteId: bigint("paciente_id", { mode: "number" })
      .notNull()
      // Achado 115: restrict protege o historico clinico de hard-delete acidental do paciente.
      .references(() => pacientes.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("Rascunho"),
    payload: jsonb("payload").$type<AnamneseVersionPayloadJson>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uk_anamnese_versions_paciente_version").on(table.pacienteId, table.version),
    index("idx_anamnese_versions_paciente_created").on(table.pacienteId, table.createdAt),
    // Achado 66: status restrito ao dominio da aplicacao.
    check("ck_anamnese_versions_status", sql`${table.status} in ('Rascunho', 'Finalizada')`),
    // Achado 120: versao sempre positiva (inserts diretos nao podem criar historico invalido).
    check("ck_anamnese_versions_version_pos", sql`${table.version} > 0`),
  ]
);

export const prontuarioDocumentos = pgTable(
  "prontuario_documentos",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    pacienteId: bigint("paciente_id", { mode: "number" })
      .notNull()
      // Achado 115: restrict protege o historico clinico de hard-delete acidental do paciente.
      .references(() => pacientes.id, { onDelete: "restrict" }),
    tipo: varchar("tipo", { length: 40 }).notNull(),
    version: integer("version").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("Rascunho"),
    titulo: varchar("titulo", { length: 180 }),
    payload: jsonb("payload").$type<ProntuarioDocumentoPayloadJson>().notNull(),
    createdByUserId: bigint("created_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    // Snapshot do papel no momento da criacao; intencionalmente sem FK para preservar historico.
    createdByRole: varchar("created_by_role", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByUserId: bigint("deleted_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    // Achado 117: unique parcial (apenas registros ativos), permitindo recriar um
    // documento do mesmo tipo/versao apos soft-delete — mesmo padrao de evolucoes.
    uniqueIndex("uk_prontuario_documentos_paciente_tipo_version")
      .on(table.pacienteId, table.tipo, table.version)
      .where(sql`${table.deletedAt} is null`),
    index("idx_prontuario_documentos_paciente").on(table.pacienteId),
    index("idx_prontuario_documentos_tipo").on(table.tipo),
    index("idx_prontuario_documentos_created_at").on(table.createdAt),
    index("idx_prontuario_documentos_updated_at").on(table.updatedAt),
    index("idx_prontuario_documentos_deleted_at").on(table.deletedAt),
    // Achado 66: status restrito ao dominio da aplicacao.
    check("ck_prontuario_documentos_status", sql`${table.status} in ('Rascunho', 'Finalizado')`),
    // Achado 87/100: dominio fechado de tipo, espelhando DOC_TYPES do validator.
    check(
      "ck_prontuario_documentos_tipo",
      sql`${table.tipo} in ('ANAMNESE', 'PLANO_TERAPEUTICO', 'PLANO_ENSINO', 'RELATORIO_MULTIPROFISSIONAL', 'OUTRO')`
    ),
    // Achado 120: versao sempre positiva.
    check("ck_prontuario_documentos_version_pos", sql`${table.version} > 0`),
  ]
);

export const evolucoes = pgTable(
  "evolucoes",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    pacienteId: bigint("paciente_id", { mode: "number" })
      .notNull()
      // Achado 115: restrict protege o historico clinico de hard-delete acidental do paciente.
      .references(() => pacientes.id, { onDelete: "restrict" }),
    profissionalId: bigint("profissional_id", { mode: "number" })
      .notNull()
      .references(() => terapeutas.id, { onDelete: "restrict" }),
    // Achado 104: integridade composta abaixo (FK para atendimentos por id+paciente+profissional).
    atendimentoId: bigint("atendimento_id", { mode: "number" }),
    data: date("data").notNull(),
    payload: jsonb("payload").$type<EvolucaoPayloadJson>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByUserId: bigint("deleted_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    // Achado 104: evolucao so pode apontar para um atendimento cujo paciente E profissional
    // coincidam. FK composta para atendimentos (id, paciente_id, profissional_id). Quando
    // atendimento_id e null, a FK nao e checada (evolucao avulsa). ON DELETE SET NULL anula
    // apenas atendimento_id (clausula de coluna ajustada na migration; ver achado 104).
    foreignKey({
      name: "evolucoes_atendimento_composto_fk",
      columns: [table.atendimentoId, table.pacienteId, table.profissionalId],
      foreignColumns: [atendimentos.id, atendimentos.pacienteId, atendimentos.profissionalId],
    }).onDelete("set null"),
    uniqueIndex("uk_evolucoes_atendimento_ativo")
      .on(table.atendimentoId)
      .where(sql`${table.deletedAt} is null and ${table.atendimentoId} is not null`),
    index("idx_evolucoes_paciente").on(table.pacienteId),
    index("idx_evolucoes_profissional").on(table.profissionalId),
    index("idx_evolucoes_data").on(table.data),
    index("idx_evolucoes_deleted_at").on(table.deletedAt),
  ]
);
