import type { OWRawHttpParams, ActionResponse } from "../types/openwhisk-types";

function parseQuery(query: string | Record<string, string> | undefined): URLSearchParams {
  if (query === undefined || query === null) {
    return new URLSearchParams();
  }
  // most cases
  if (typeof query === "string") {
    return new URLSearchParams(query);
  }
  // local actions sometimes show query as an object, handle that just in case
  return new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
}
/**
 * Builds a standard Request from OpenWhisk raw HTTP params.
 * Mirrors the extraction used in ow-s2s-proxy: path, method, query, headers, body.
 * With raw-http: true, __ow_body is typically base64-encoded; it is decoded here.
 */
export function paramsToRequest(params: OWRawHttpParams): Request {
  const path = params.__ow_path ?? "/";
  const method = (params.__ow_method ?? "GET").toUpperCase();
  const searchParams = parseQuery(params.__ow_query as string | Record<string, string> | undefined);
  const headers = params.__ow_headers ?? {};
  const bodyRaw = params.__ow_body;
  // if body is base64-encoded, due to raw-http: true, decode it
  const body =
    bodyRaw !== undefined && bodyRaw !== ""
      ? Buffer.from(bodyRaw, "base64").toString("utf-8")
      : undefined;

  const url = new URL(path, "https://localhost");
  url.search = searchParams.toString();

  const init: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined && ["POST", "PUT", "PATCH"].includes(method)) {
    init.body = body;
  }

  return new Request(url.toString(), init);
}
/**
 * Converts a Response from Hono into OpenWhisk ActionResponse (statusCode, headers, body as string).
 */
export async function responseToActionResponse(response: Response): Promise<ActionResponse> {
  const body = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return {
    statusCode: response.status,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body,
  };
}
