import type { Hono, Env } from "hono";
import type {
  ActionResponse,
  AioLoggerLike,
  OpenWhiskParamsEnv,
  OWRawHttpParams,
} from "../types/openwhisk-types";
import { paramsToRequest, responseToActionResponse } from "./utils";

export type OpenWhiskEnv = {
  Bindings: {
    params: OWRawHttpParams;
  };
};

/**
 * Hono adapter for OpenWhisk.
 * Optionally pass a params type for full type safety on `c.env.params` and the action handler.
 *
 * @param app - Hono app typed with OpenWhiskParamsEnv<TParams>
 * @returns Async function (params: TParams) => Promise<ActionResponse>
 *
 * @example
 * // Default: params and c.env.params are OpenWhiskActionParams
 * const app = new Hono<OpenWhiskParamsEnv>().get('/hello', (c) => c.text(c.env.params?.__ow_path ?? ''));
 * export const main = ToOpenWhiskAction(app);
 *
 * @example
 * // Custom params type for type safety
 * type MyParams = OpenWhiskActionParams & { userId: string; tenantId: string };
 * const app = new Hono<OpenWhiskParamsEnv<MyParams>>()
 *   .get('/hello', (c) => c.text(c.env.params.userId));
 * export const main = ToOpenWhiskAction<MyParams>(app);
 */
export function ToOpenWhiskAction(
  app: Hono<any>,
  logger?: AioLoggerLike,
): (params: any) => Promise<ActionResponse> {
  return async (params: any): Promise<ActionResponse> => {
    logger?.debug("ToOpenWhiskAction - params", params);
    const request = paramsToRequest(params);
    const response = await app.fetch(request, { params });
    logger?.debug("ToOpenWhiskAction - response", response);
    return responseToActionResponse(response);
  };
}
