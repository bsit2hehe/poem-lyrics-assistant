// Serverless proxy: keeps the Gemini API key on the server and builds the
// prompt server-side so the endpoint can't be used as a generic LLM proxy.

const MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-flash-latest",   // alias that tracks the current free Flash model
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
].filter(Boolean);

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const clip = (v, n) => String(v ?? "").slice(0, n).trim();

function buildPrompt(p) {
  const isPoem = p.mode !== "lyrics";
  const kind = isPoem ? "poem" : "song lyrics";
  const struct = isPoem
    ? ""
    : "Label sections like [Verse 1], [Chorus], [Bridge]. Give the chorus a memorable hook. ";
  const system =
    `You are a skilled ${kind} writer. Write original work only; never reproduce ` +
    `existing copyrighted poems or lyrics. ${struct}Output ONLY the ${kind}, with an ` +
    `optional short title on the first line. No commentary, no markdown.`;
  const spec =
    `Theme: ${p.topic}\nStyle: ${p.style}\nMood: ${p.mood}\n` +
    `Length: ${p.length}\nLanguage: ${p.lang || "English"}`;
  if (p.draft && p.revision) {
    return `${system}\n\nOriginal request:\n${spec}\n\nCurrent draft:\n${p.draft}\n\nRevision: ${p.revision}`;
  }
  return `${system}\n\n${spec}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST." });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(500, { error: "Server is missing GEMINI_API_KEY." });

  let b;
  try { b = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Invalid JSON." }); }

  const p = {
    mode: b.mode === "lyrics" ? "lyrics" : "poem",
    topic: clip(b.topic, 500),
    style: clip(b.style, 60),
    mood: clip(b.mood, 40),
    length: clip(b.length, 40),
    lang: clip(b.lang, 30),
    draft: clip(b.draft, 4000),
    revision: clip(b.revision, 200),
  };
  if (!p.topic) return json(400, { error: "Please give a theme." });

  const payload = {
    contents: [{ role: "user", parts: [{ text: buildPrompt(p) }] }],
    generationConfig: { temperature: 1.0, maxOutputTokens: 2048 },
  };

  let lastErr = "Unknown error.";
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(payload),
        }
      );
      if (res.status === 429) {
        return json(429, { error: "Free-tier rate limit hit. Wait a minute and try again." });
      }
      if (res.status === 404 || res.status === 400) {
        // model name retired/unknown -> try the next one
        lastErr = `Model ${model} unavailable (${res.status}).`;
        continue;
      }
      if (!res.ok) {
        lastErr = `Gemini error ${res.status}.`;
        continue;
      }
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts || [])
        .map((x) => x.text || "").join("").trim();
      if (!text) {
        return json(502, { error: "The model returned nothing (it may have been filtered). Try rewording." });
      }
      return json(200, { text, model });
    } catch (e) {
      lastErr = "Network error reaching Gemini.";
    }
  }
  return json(502, { error: lastErr });
};
