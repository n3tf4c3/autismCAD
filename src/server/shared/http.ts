import { ZodError } from "zod";
import { AppError, toAppError } from "@/server/shared/errors";

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, { status: 200, ...init });
}

export function jsonError(error: AppError): Response {
  return Response.json(
    { error: error.message, code: error.code },
    { status: error.status }
  );
}

export function withErrorHandling(
  handler: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>
) {
  return async (
    request: Request,
    context: { params: Promise<Record<string, string>> }
  ): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Payload invalido", details: error.flatten() },
          { status: 400 }
        );
      }
      return jsonError(toAppError(error));
    }
  };
}
