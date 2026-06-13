DROP INDEX "uk_users_email";--> statement-breakpoint
CREATE UNIQUE INDEX "uk_users_email_ativo" ON "users" USING btree ("email") WHERE "users"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "anamnese_versions" ADD CONSTRAINT "ck_anamnese_versions_status" CHECK ("anamnese_versions"."status" in ('Rascunho', 'Finalizada'));--> statement-breakpoint
ALTER TABLE "atendimentos" ADD CONSTRAINT "ck_atendimentos_turno" CHECK ("atendimentos"."turno" in ('Matutino', 'Vespertino'));--> statement-breakpoint
ALTER TABLE "atendimentos" ADD CONSTRAINT "ck_atendimentos_presenca" CHECK ("atendimentos"."presenca" in ('Presente', 'Ausente', 'Nao informado'));--> statement-breakpoint
ALTER TABLE "atendimentos" ADD CONSTRAINT "ck_atendimentos_status_repasse" CHECK ("atendimentos"."status_repasse" in ('Pendente', 'Concluido'));--> statement-breakpoint
ALTER TABLE "prontuario_documentos" ADD CONSTRAINT "ck_prontuario_documentos_status" CHECK ("prontuario_documentos"."status" in ('Rascunho', 'Finalizado'));