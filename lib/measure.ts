import {
  ENGINE_VERSION,
  LOCALES,
  conditionIdentity,
  parity,
  simulate,
  type Project,
  type Measurement,
  type Run,
} from "./domain";
export async function measureProject(project: Project): Promise<Run> {
  const start = performance.now();
  const snapshot = structuredClone(project);
  await document.fonts.ready;
  // Subset fonts must load all glyphs used by this run and its custom variables.
  const glyphs = [
    ...new Set(
      "ABC가나" +
        snapshot.entries
          .flatMap((entry) =>
            LOCALES.map((locale) => simulate(entry.translations[locale], snapshot.conditions)),
          )
          .join(""),
    ),
  ].join("");
  // Mono lacks Korean glyphs; explicitly load the bundled Sans fallback.
  await document.fonts.load(`${snapshot.conditions.fontSize}px "Bench Sans"`, glyphs);
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-12000px;top:0;visibility:hidden;pointer-events:none;width:1100px;contain:layout style;";
  document.body.appendChild(host);
  const items: { measurement: Measurement; textNode?: HTMLSpanElement; inner?: HTMLDivElement }[] =
    [];
  try {
    for (const font of snapshot.conditions.fonts) {
      let fontReady = false;
      try {
        const loaded = await document.fonts.load(
          `${snapshot.conditions.fontSize}px "${font}"`,
          glyphs,
        );
        fontReady =
          loaded.length > 0 && document.fonts.check(`${snapshot.conditions.fontSize}px "${font}"`);
      } catch {
        /* Explicit measurement error below. */
      }
      for (const entry of snapshot.entries)
        for (const locale of LOCALES)
          for (const width of snapshot.conditions.widths) {
            const text = simulate(entry.translations[locale], snapshot.conditions);
            const measurement: Measurement = {
              id: JSON.stringify([entry.key, locale, width, font]),
              key: entry.key,
              locale,
              component: entry.component,
              width,
              font,
              text,
              available: 0,
              textWidth: 0,
              excess: 0,
              overflow: false,
              variables: parity(entry.source, entry.translations[locale]),
              suggestion: 0,
            };
            if (!fontReady || (entry.source.trim() && !entry.translations[locale].trim())) {
              measurement.error = !fontReady
                ? `폰트 '${font}' 로드 실패`
                : "번역문이 비어 있습니다";
              items.push({ measurement });
              continue;
            }
            const outer = document.createElement("div");
            const border = entry.component === "label" ? 0 : 1;
            const padding = snapshot.conditions.padding;
            outer.style.cssText = `box-sizing:border-box;width:${width}px;border:${border}px solid;padding:${padding}px;white-space:nowrap;font-family:"${font}","Bench Sans";font-size:${snapshot.conditions.fontSize}px;font-weight:400;letter-spacing:0;line-height:1.5;`;
            const inner = document.createElement("div");
            inner.style.cssText = "overflow:hidden;width:100%;white-space:nowrap;line-height:1.5;";
            const span = document.createElement("span");
            span.style.cssText = "display:inline-block;white-space:pre;";
            span.textContent = text;
            inner.appendChild(span);
            outer.appendChild(inner);
            host.appendChild(outer);
            items.push({ measurement, textNode: span, inner });
          }
    }
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    for (const { measurement: m, textNode, inner } of items)
      if (textNode && inner) {
        const available = inner.getBoundingClientRect().width,
          textWidth = textNode.getBoundingClientRect().width;
        if (!available || !Number.isFinite(textWidth)) {
          m.error = "표시되지 않은 요소는 측정할 수 없습니다.";
          continue;
        }
        m.available = round(available);
        m.textWidth = round(textWidth);
        m.excess = round(Math.max(0, textWidth - available));
        m.overflow = textWidth - available > 0.5;
        m.suggestion = Math.ceil(
          textWidth + snapshot.conditions.padding * 2 + (m.component === "label" ? 0 : 2),
        );
      }
    return {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      revision: snapshot.revision,
      engine: ENGINE_VERSION,
      conditionHash: conditionIdentity(snapshot),
      conditions: snapshot.conditions,
      snapshot: snapshot.entries,
      measurements: items.map((i) => i.measurement),
      duration: round(performance.now() - start),
      browser: navigator.userAgent,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      dpr: window.devicePixelRatio,
      status: items.some((i) => i.measurement.error) ? "partial" : "completed",
    };
  } finally {
    host.remove();
  }
}
function round(n: number) {
  return Math.round(n * 100) / 100;
}
