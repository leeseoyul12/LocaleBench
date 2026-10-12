import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { ValidationError } from "./domain";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function owner(request?: Request) {
  if (request && !["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin)
      throw new HttpError(403, "ORIGIN", "이 요청의 출처를 확인할 수 없습니다.");
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new HttpError(415, "CONTENT_TYPE", "JSON 요청이 필요합니다.");
  }
  const user = await getChatGPTUser();
  if (!user)
    throw new HttpError(401, "SIGN_IN", "클라우드 저장과 Google 번역에는 로그인이 필요합니다.");
  return user;
}
export function database() {
  if (!env.DB)
    throw new HttpError(
      503,
      "DATABASE",
      "클라우드 저장소가 연결되지 않았습니다. 로컬 저장을 이용해 주세요.",
    );
  return env.DB;
}
export async function readJson(request: Request, max = 256 * 1024): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > max)
    throw new HttpError(413, "TOO_LARGE", "입력 데이터가 너무 큽니다.");
  // Bound the stream as well: Content-Length can be absent or inaccurate.
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "INPUT", "요청 본문이 없습니다.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > max) {
        await reader.cancel();
        throw new HttpError(413, "TOO_LARGE", "입력 데이터가 너무 큽니다.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(bytes);
  let pos = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, pos);
    pos += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw new HttpError(400, "JSON", "JSON 형식을 확인해 주세요.");
  }
}
export function failure(error: unknown): Response {
  if (error instanceof HttpError)
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof ValidationError)
    return Response.json({ error: error.message, code: "VALIDATION" }, { status: 400 });
  // External errors can contain credentials. Never serialize/log the error itself.
  return Response.json(
    {
      error: "요청을 완료하지 못했습니다. 입력을 유지한 채 다시 시도해 주세요.",
      code: "UNEXPECTED",
    },
    { status: 500 },
  );
}
export async function digest(text: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function secret(name: string): string | undefined {
  return (env as unknown as Record<string, string | undefined>)[name] || process.env[name];
}
