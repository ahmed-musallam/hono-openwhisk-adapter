import type { OwRawHttpParams, OwActionResponse } from "../types";

/**
 * Reads `Content-Type` from OpenWhisk `__ow_headers` (case-insensitive key).
 */
function contentTypeFromOwHeaders(headers: Record<string, string> | undefined): string | undefined {
  if (!headers) return undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === "content-type");
  return key !== undefined ? headers[key] : undefined;
}

/**
 * Media type only (no parameters), lowercased.
 */
function mediaTypeOnly(contentTypeHeader: string | undefined): string | undefined {
  if (!contentTypeHeader) return undefined;
  return contentTypeHeader.split(";")[0].trim().toLowerCase();
}

/**
 * Whether OpenWhisk / Adobe I/O Runtime passes `__ow_body` as a **base64**
 * string for this request `Content-Type`.
 *
 * Mirrors OpenWhisk's web-action packaging (`WhiskWebActionsApi`): the entity is
 * base64-encoded when the media type is **binary** or exactly **`application/json`**.
 * For typical text bodies (`text/plain`, `application/x-www-form-urlencoded`, …)
 * the runtime passes the body as a plain UTF-8 string in the activation JSON
 * (not base64) — decoding those as base64 corrupts the payload.
 *
 * @see OpenWhisk controller source — strict request entity → `__ow_body`
 *      (`JsString(Base64...)` vs `JsString(utf8String)`):
 *      https://github.com/apache/openwhisk/blob/master/core/controller/src/main/scala/org/apache/openwhisk/core/controller/WebActions.scala#L614-L623
 * @see Adobe I/O Runtime HTTP context (table): https://developer.adobe.com/app-builder/docs/guides/runtime_guides/creating-actions/#http-context
 */
export function isOwRawHttpBodyBase64Encoded(contentTypeHeader: string | undefined): boolean {
  const mt = mediaTypeOnly(contentTypeHeader);
  if (!mt) return false;
  if (mt === "application/json") return true;
  if (mt.startsWith("image/")) return true;
  if (mt.startsWith("video/")) return true;
  if (mt.startsWith("audio/")) return true;
  if (mt.startsWith("font/")) return true;
  if (mt === "application/octet-stream") return true;
  if (mt === "application/pdf") return true;
  if (mt === "application/zip") return true;
  if (mt === "application/gzip") return true;
  if (mt === "application/x-gzip") return true;
  if (mt === "application/x-tar") return true;
  if (mt === "application/wasm") return true;
  return false;
}

/**
 * Serializes an outgoing request body the same way OpenWhisk puts it in
 * `__ow_body` for raw web actions — useful for local tests and tooling.
 */
export function encodeOwRawHttpBody(
  body: string | Buffer,
  contentTypeHeader: string | undefined,
): string {
  const buf = typeof body === "string" ? Buffer.from(body, "utf-8") : body;
  if (isOwRawHttpBodyBase64Encoded(contentTypeHeader)) {
    return buf.toString("base64");
  }
  return buf.toString("utf-8");
}

function decodeOwRawHttpBody(bodyRaw: string, contentTypeHeader: string | undefined): BodyInit {
  if (isOwRawHttpBodyBase64Encoded(contentTypeHeader)) {
    return Buffer.from(bodyRaw, "base64");
  }
  return bodyRaw;
}

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
 *
 * `__ow_body` encoding follows the OpenWhisk / Adobe I/O Runtime raw web-action
 * contract: **base64** for `application/json` and binary media types; **plain
 * UTF-8 string** for everything else (e.g. `text/plain`). See
 * {@link isOwRawHttpBodyBase64Encoded}.
 */
export function paramsToRequest(params: OwRawHttpParams): Request {
  const path = params.__ow_path ?? "/";
  const method = (params.__ow_method ?? "GET").toUpperCase();
  const searchParams = parseQuery(params.__ow_query as string | Record<string, string> | undefined);
  const headers = params.__ow_headers ?? {};
  const bodyRaw = params.__ow_body;
  const contentType = contentTypeFromOwHeaders(params.__ow_headers);
  const body =
    bodyRaw !== undefined && bodyRaw !== "" ? decodeOwRawHttpBody(bodyRaw, contentType) : undefined;

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
  // 4xx/5xx are wrapped in an `error` object so OpenWhisk treats the activation
  // as an applicationError. The controller projects only the `error` field on
  // the error path, so headers must live inside it to reach the HTTP client.
  // 1xx/2xx/3xx (incl. redirects) are returned at the top level as success.
  // See: https://github.com/apache/openwhisk/blob/master/docs/webactions.md#error-handling
  if (statusCode >= 400) {
    return {
      error: {
        statusCode,
        headers,
        body,
      },
    };
  }
  return {
    headers,
    statusCode,
    body,
  };
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
