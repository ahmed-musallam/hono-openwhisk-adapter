/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * OpenWhisk raw HTTP invocation params (when web: "raw").
 * @see https://github.com/apache/openwhisk/blob/master/docs/actions.md#raw-http-handling
 */
export type OwRawHttpParams = {
  __ow_path?: string;
  __ow_method?: string;
  __ow_query?: string;
  __ow_headers?: Record<string, string>;
  /**
   * Request body as delivered by the raw web-action runtime.
   * Encoding depends on request `Content-Type`: base64 for `application/json`
   * and binary media types; plain UTF-8 string for `text/plain` and other
   * non-binary types (see `isOwRawHttpBodyBase64Encoded` in the adapter).
   */
  __ow_body?: string;
};

/**
 * Response headers for a web action. Use an array value to send a header
 * multiple times (e.g. several `Set-Cookie` headers).
 * @see https://github.com/apache/openwhisk/blob/master/docs/webactions.md#handling-http-requests-with-actions
 */
export type OwResponseHeaders = Record<string, string | string[]>;

/**
 * OpenWhisk action response shape (for raw web actions).
 */
export type OwActionResponse = {
  statusCode?: number;
  headers?: OwResponseHeaders;
  body?: string;
  error?: {
    statusCode: number;
    headers?: OwResponseHeaders;
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
export type OwParamsValidator<TParams = OwRawHttpParams> = (
  params: TParams,
) => void | Promise<void>;
