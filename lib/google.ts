import { mask, restore, parity, ValidationError } from "./domain";
export async function googleTranslate(
  texts: string[],
  target: string,
  key: string,
  fetcher: typeof fetch = fetch,
) {
  const masks = texts.map((text) => mask(text, crypto.randomUUID()));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetcher("https://translation.googleapis.com/language/translate/v2", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        q: masks.map((m) => m.masked),
        source: "en",
        target,
        format: "text",
        model: "nmt",
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const message =
        response.status === 429
          ? "Google 번역 사용량이 초과되었습니다. 잠시 후 다시 시도해 주세요."
          : response.status === 400 || response.status === 401 || response.status === 403
            ? "Google API 키·Translation 활성화·과금·키 제한 설정을 확인해 주세요."
            : "Google 번역 서비스가 응답하지 않습니다. 다시 시도해 주세요.";
      throw new ValidationError(message);
    }
    const data = (await response.json()) as {
      data?: { translations?: { translatedText: string }[] };
    };
    if (!Array.isArray(data.data?.translations) || data.data.translations.length !== texts.length)
      throw new ValidationError("Google 번역 응답 개수가 입력과 다릅니다.");
    return data.data.translations.map((t, i) => {
      if (typeof t.translatedText !== "string")
        throw new ValidationError("Google 번역 응답 형식이 올바르지 않습니다.");
      const text = restore(t.translatedText, masks[i]);
      if (parity(texts[i], text).length)
        throw new ValidationError("번역 후 변수 검증을 통과하지 못했습니다.");
      return text;
    });
  } catch (error) {
    if (controller.signal.aborted)
      throw new ValidationError("Google 번역이 15초 안에 응답하지 않았습니다. 다시 시도해 주세요.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
