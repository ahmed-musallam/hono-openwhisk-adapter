/**
 * OpenWhisk raw HTTP invocation params (when raw-http: true).
 * @see https://github.com/apache/openwhisk/blob/master/docs/actions.md#raw-http-handling
 */
export type OwRawHttpParams = {
  __ow_path?: string;
  __ow_method?: string;
  __ow_query?: string;
  __ow_headers?: Record<string, string>;
  __ow_body?: string;
};

/**
 * OpenWhisk action response shape (for raw-http web actions).
 */
export type OwActionResponse = {
  statusCode?: number;
  headers?: Record<string, string>;
  body?: string;
  error?: {
    statusCode: number;
    headers?: Record<string, string>;
    body: string;
  };
};

/**
 * Env type with OpenWhisk params in Bindings.
 * TParams can be anything; params is always TParams & OWRawHttpParams.
 * @example
 * type MyParams = OwParamsEnv<{ userId: string }>['Variables']['params']; // { userId: string } & OWRawHttpParams
 */
export interface OwParamsEnv<TParams = unknown> {
  Variables: {
    params: TParams & OwRawHttpParams;
  };
}

export type OwAction<TParams = OwRawHttpParams> = (
  params: TParams & OwRawHttpParams,
) => Promise<OwActionResponse>;

/**
 * Hono Bindings helper: env with params. TParams can be anything; params is TParams & OWRawHttpParams.
 * @example
 * const app = new Hono<OwEnv>().get('/x', (c) => c.json(c.env.params)); // params: OWRawHttpParams
 * const app = new Hono<OwEnv<{ userId: string }>>().get('/x', (c) => c.json(c.env.params.userId));
 */
export type OwEnv<TParams = unknown> = {
  Bindings: {
    params: TParams & OwRawHttpParams;
  };
};

/**
 * Validator function: accepts raw params, returns validated params.
 * Throw (or return a rejected promise) on validation failure.
 * Any library can be used (Zod, ArkType, Standard Schema, etc.).
 */
export type OwParamsValidator<TParams = OwRawHttpParams> = (params: TParams) => void;
