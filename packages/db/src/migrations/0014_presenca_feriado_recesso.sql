ALTER TABLE "atendimentos" DROP CONSTRAINT "ck_atendimentos_presenca";--> statement-breakpoint
UPDATE "atendimentos" SET "presenca" = 'Feriado' WHERE "presenca" = 'Férias';--> statement-breakpoint
ALTER TABLE "atendimentos" ADD CONSTRAINT "ck_atendimentos_presenca" CHECK ("atendimentos"."presenca" in ('Presente', 'Ausente', 'Feriado', 'Recesso', 'Nao informado'));
