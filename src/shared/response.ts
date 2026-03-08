import { AppError } from "./errors";
import type { ApiFailure, ApiSuccess } from "./types";

function buildHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("content-type", "application/json; charset=UTF-8");
  headers.set("cache-control", "no-store");
  return headers;
}

export function jsonOk<T>(data: T, init: ResponseInit = {}): Response {
  const body: ApiSuccess<T> = { ok: true, data };
  return new Response(JSON.stringify(body), {
    ...init,
    headers: buildHeaders(init.headers),
  });
}

export function jsonError(error: unknown, init: ResponseInit = {}): Response {
  const appError =
    error instanceof AppError
      ? error
      : new AppError("INTERNAL_ERROR", "服务器开小差了，请稍后再试。", 500);

  if (!(error instanceof AppError)) {
    console.error(error);
  }

  const body: ApiFailure = {
    ok: false,
    error: {
      code: appError.code,
      message: appError.message,
    },
  };

  return new Response(JSON.stringify(body), {
    ...init,
    status: init.status ?? appError.status,
    headers: buildHeaders(init.headers),
  });
}

export function methodNotAllowed(allowed: string[]): Response {
  return jsonError(new AppError("METHOD_NOT_ALLOWED", `只支持 ${allowed.join(", ")}。`, 405), {
    headers: {
      allow: allowed.join(", "),
    },
    status: 405,
  });
}
