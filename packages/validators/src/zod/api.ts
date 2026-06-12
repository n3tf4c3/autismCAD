import { z, ZodTypeAny } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function parseJsonBody<T extends ZodTypeAny>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  const data = await request.json();
  return schema.parse(data);
}
