import { requireUser } from "@/server/auth/auth";
import { withErrorHandling } from "@/server/shared/http";

export const runtime = "nodejs";

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

function asViaCepResponse(value: unknown): ViaCepResponse | null {
  if (!value || typeof value !== "object") return null;
  return value as ViaCepResponse;
}

type RouteContext = {
  params: Promise<{ cep: string }>;
};

export const GET = withErrorHandling(async (
  _request: Request,
  context: RouteContext
) => {
  await requireUser(); // legado: apenas autenticado

  const { cep: raw } = await context.params;
  const cep = String(raw || "").replace(/\D/g, "");
  if (cep.length !== 8) return Response.json({ error: "CEP invalido" }, { status: 400 });

  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      cache: "no-store",
    });
    if (!resp.ok) return Response.json({ error: "CEP nao encontrado" }, { status: 502 });

    const data = asViaCepResponse(await resp.json().catch(() => null));
    if (!data || data.erro) return Response.json({ error: "CEP nao encontrado" }, { status: 404 });

    return Response.json({
      logradouro: data.logradouro || "",
      bairro: data.bairro || "",
      cidade: data.localidade || "",
      uf: data.uf || "",
    });
  } catch (error) {
    console.error("Erro ao consultar CEP", error);
    return Response.json({ error: "Falha ao consultar CEP" }, { status: 502 });
  }
});
