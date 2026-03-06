import type { OwRawHttpParams, OwActionResponse } from "../types";

function parseQuery(query: string | Record<string, string> | undefined): URLSearchParams {
  if (!query) {
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
export function paramsToRequest(params: OwRawHttpParams): Request {
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
 * Text media types from Apache Pekko HTTP MediaTypes (WithOpenCharset, WithFixedCharset, Multipart — i.e. not Binary).
 * @see https://pekko.apache.org/api/pekko-http/snapshot/org/apache/pekko/http/scaladsl/model/MediaTypes$.html
 */
// Use regexes to match major content types, subtypes, and multipart types that are considered "text"
const TEXT_CONTENT_TYPE_REGEXES: RegExp[] = [
  /^text\/.+/i,
  /^application\/((atom|rss|soap|.*\.kml|\w+\+json|\w+\+xml|javascript|json([-+][\w]+)?|merge-patch\+json|problem\+json|problem\+xml|xhtml\+xml|xml|xml-dtd|x-latex|x-vrml|x-www-form-urlencoded|base64|x-latex|x-vrml))/i,
  /^multipart\/(alternative|byteranges|encrypted|form-data|mixed|related|signed)$/i,
];

function isTextContentType(contentType: string | null): boolean {
  if (!contentType) return true;
  const mediaType = contentType.split(";")[0].trim().toLowerCase();
  return TEXT_CONTENT_TYPE_REGEXES.some((regex) => regex.test(mediaType));
}

export function buildOwResponse(
  statusCode: number,
  headers: Record<string, string>,
  body: string,
): OwActionResponse {
  const owResponse = {
    statusCode,
    headers,
    body,
  };
  // if status is not 2xx, wrap response  in error object, see: https://developer.adobe.com/app-builder/docs/guides/runtime_guides/creating-actions#unsuccessful-response
  if (statusCode < 200 || statusCode >= 300) {
    return {
      error: owResponse,
    };
  }
  return owResponse;
}

/**
 * Converts a Response from Hono into OpenWhisk ActionResponse (statusCode, headers, body).
 * Body is a string: plain text or JSON as-is; binary data (e.g. image/*, application/octet-stream) is base64-encoded.
 */
export async function responseToActionResponse(response: Response): Promise<OwActionResponse> {
  const contentType = response.headers?.get?.("content-type") ?? null;
  const arrayBuffer = await response.arrayBuffer();

  const body = isTextContentType(contentType)
    ? new TextDecoder().decode(arrayBuffer)
    : Buffer.from(arrayBuffer).toString("base64");

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return buildOwResponse(response.status, headers, body);
}
