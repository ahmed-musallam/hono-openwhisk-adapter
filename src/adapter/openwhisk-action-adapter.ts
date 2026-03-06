import type { Hono } from "hono";
import type { OwAction, OwActionResponse, OwParamsValidator, OwRawHttpParams } from "../types";
import { paramsToRequest, responseToActionResponse } from "./utils";

export type { OwEnv } from "../types";

/**
 * Hono adapter for OpenWhisk.
 * Optionally pass a params validator for runtime validation and type-safe `c.env.params`.
 *
 * @param app - Hono app (receives params in env as `c.env.params`)
 * @param validateParams - Optional validator (params: unknown) => T; throw on invalid. Use any library (Zod, ArkType, etc.).
 * @returns Async function (params) => Promise<ActionResponse>
 *
 * @example
 * const app = new Hono().get('/hello', (c) => c.text(c.env.params?.__ow_path ?? ''));
 * export const main = ToOpenWhiskAction(app);
 *
 * @example
 * // With Zod
 * import { z } from 'zod';
 * const schema = z.object({ __ow_path: z.string().optional(), userId: z.string() });
 * export const main = ToOpenWhiskAction(app, (p) => schema.parse(p) as Params);
 *
 * @example
 * // With ArkType
 * import { type } from 'arktype';
 * const paramsType = type({ __ow_path: 'string?', userId: 'string' });
 * export const main = ToOpenWhiskAction(app, (p) => paramsType(p).data);
 */
export function ToOpenWhiskAction<TParams = OwRawHttpParams>(
  app: Hono<any>,
  validateOwParams?: OwParamsValidator<TParams>,
): OwAction<TParams> {
  return async (params: OwRawHttpParams): Promise<OwActionResponse> => {
    // validate action params
    try {
      validateOwParams?.(params as TParams);
    } catch (error) {
      console?.error?.("Error validating Action params:", error);
      return {
        error: {
          statusCode: 500,
          headers: {
            "content-type": "text/plain; charset=UTF-8",
          },
          body: "Internal Server Error: action params validation failed",
        },
      };
    }

    // process the request
    const request = paramsToRequest(params);
    const response = await app.fetch(request, { params });
    return responseToActionResponse(response);
  };
}
