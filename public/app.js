const STYLES = {
  poem: ["Free verse","Sonnet","Haiku sequence","Ballad","Limerick","Rhyming couplets","Spoken word"],
  lyrics: ["Pop","Folk / acoustic","Hip-hop","Rock","R&B","Country","OPM ballad"],
};
const $ = (id) => document.getElementById(id);
let mode = "poem", current = "", busy = false;

function fillStyles() {
  $("style").innerHTML = STYLES[mode].map((s) => `<option>${s}</option>`).join("");
  $("styleLabel").textContent = mode === "poem" ? "Poem style" : "Genre";
  $("go").textContent = mode === "poem" ? "Write the poem" : "Write the lyrics";
}
$("mode").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  mode = b.dataset.m;
  [...$("mode").children].forEach((x) => x.classList.toggle("on", x === b));
  fillStyles();
});
fillStyles();

function setBusy(v) {
  busy = v;
  $("go").disabled = v;
  document.querySelectorAll("#tools button").forEach((b) => (b.disabled = v));
}

async function generate(extra = {}) {
  if (busy) return;
  const topic = $("topic").value.trim();
  if (!topic) { $("msg").textContent = "Give me a theme first."; return; }
  setBusy(true);
  $("msg").textContent = "Writing…";
  try {
    const res = await fetch("/.netlify/functions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode, topic,
        style: $("style").value, mood: $("mood").value,
        length: $("len").value, lang: $("lang").value,
        ...extra,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    current = data.text;
    $("text").textContent = current;
    $("out").hidden = false;
    $("msg").textContent = "";
    $("out").scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    $("msg").textContent = err.message;
  } finally {
    setBusy(false);
  }
}

$("go").addEventListener("click", () => generate());
$("tools").addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "copy") {
    try { await navigator.clipboard.writeText(current); b.textContent = "Copied"; }
    catch { b.textContent = "Select & copy"; }
    setTimeout(() => (b.textContent = "Copy"), 1500);
    return;
  }
  if (b.dataset.r && current) generate({ draft: current, revision: b.dataset.r });
});
