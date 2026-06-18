ALTER TABLE "anamnese" DROP CONSTRAINT "anamnese_paciente_id_pacientes_id_fk";
--> statement-breakpoint
ALTER TABLE "anamnese_versions" DROP CONSTRAINT "anamnese_versions_paciente_id_pacientes_id_fk";
--> statement-breakpoint
ALTER TABLE "evolucoes" DROP CONSTRAINT "evolucoes_paciente_id_pacientes_id_fk";
--> statement-breakpoint
ALTER TABLE "prontuario_documentos" DROP CONSTRAINT "prontuario_documentos_paciente_id_pacientes_id_fk";
--> statement-breakpoint
ALTER TABLE "anamnese" ADD CONSTRAINT "anamnese_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnese_versions" ADD CONSTRAINT "anamnese_versions_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolucoes" ADD CONSTRAINT "evolucoes_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prontuario_documentos" ADD CONSTRAINT "prontuario_documentos_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnese_versions" ADD CONSTRAINT "ck_anamnese_versions_version_pos" CHECK ("anamnese_versions"."version" > 0);--> statement-breakpoint
ALTER TABLE "prontuario_documentos" ADD CONSTRAINT "ck_prontuario_documentos_version_pos" CHECK ("prontuario_documentos"."version" > 0);