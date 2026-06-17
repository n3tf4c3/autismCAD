ALTER TABLE "evolucoes" DROP CONSTRAINT "evolucoes_atendimento_id_atendimentos_id_fk";
--> statement-breakpoint
ALTER TABLE "atendimentos" ADD CONSTRAINT "uk_atendimentos_id_paciente_profissional" UNIQUE("id","paciente_id","profissional_id");
--> statement-breakpoint
ALTER TABLE "evolucoes" ADD CONSTRAINT "evolucoes_atendimento_composto_fk" FOREIGN KEY ("atendimento_id","paciente_id","profissional_id") REFERENCES "public"."atendimentos"("id","paciente_id","profissional_id") ON DELETE SET NULL ("atendimento_id") ON UPDATE no action;
