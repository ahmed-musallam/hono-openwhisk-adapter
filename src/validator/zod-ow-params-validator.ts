import type { z } from "zod";

/**
 * Builds a ParamsValidator from a Zod schema for OpenWhisk raw HTTP params.
 * Use with ToOpenWhiskAction for schema-based validation; throws on invalid params.
 *
 * @example
 * import { z } from "zod";
 * import { ToOpenWhiskAction, zodValidator } from "hono-openwhisk-adapter";
 * const schema = z.object({ __ow_path: z.string().optional(), userId: z.string() });
 * export const main = ToOpenWhiskAction(app, zodValidator(schema));
 */
export function zodOwParamsValidator(schema: z.ZodSchema) {
  return (params: unknown): void => {
    const result = schema.safeParse(params);
    if (!result.success) {
      throw new Error(result.error.message);
    }
  };
}
