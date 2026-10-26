// MeshCheck Tiger relay: runs on Cloudflare Workers and answers with Workers AI (free daily allowance).
// The page sends measured facts about the user's model plus their question. The 3D file itself is never sent.

const MODELS = ['@cf/meta/llama-3.1-8b-instruct', '@cf/meta/llama-3.1-8b-instruct-fast', '@cf/meta/llama-3.2-3b-instruct', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'];

async function ask(env, messages) {
  let last = 'no model tried';
  const list = env.MODEL ? [env.MODEL].concat(MODELS) : MODELS;
  for (const m of list) {
    try {
      const out = await env.AI.run(m, { messages: messages, max_tokens: 450, temperature: 0.3 });
      const answer = String((out && (out.response || out.result)) || '').trim();
      if (answer) return { answer: answer, model: m };
      last = m + ': empty answer';
    } catch (e) { last = m + ': ' + String(e && e.message || e).slice(0, 300); }
  }
  return { error: last };
}

const SYSTEM = `You are Tiger, the friendly assistant inside MeshCheck, a website that checks 3D-print models and whether multi-part designs will fit and move.
You get FACTS that code measured on the user's real model, then the user's question.
Rules:
- Use only numbers that appear in FACTS. Never invent or estimate a measurement. If FACTS lack what you need, say what the user should upload or tell you.
- Write for a student: plain words, short paragraphs, no headings, no tables, no em dashes. Under 150 words.
- When the user says what they want the part to do and what is going wrong, connect it to the measured facts (gaps, travel, how far a part sticks out, overlaps, differences from the version that worked). Give 2 to 4 concrete changes with numbers, for example "widen the slot by 0.2 mm on each side". Add one or two tips that improve how the whole thing works.
- Printed plastic spreads about 0.1 to 0.2 mm, so gaps under half of facts.freeSlidingGapMm usually fuse or stick. Gaps over twice it usually wobble.
- A gap or measurement tells you what the model is, not what the designer meant. If the intent is unclear, ask one short question instead of guessing.
- Stay on topic: 3D printing, this model, and designing parts that work. Politely decline anything else.`;

function cors(env, req) {
  const allow = env.ALLOWED_ORIGIN || '*';
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': allow === '*' || origin === allow ? (allow === '*' ? '*' : origin) : allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}
function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) });
}

export default {
  async fetch(req, env) {
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.method === 'GET') {   // open the Worker address in a browser tab to check that the AI works
      if (!env.AI) return json({ ok: false, problem: 'The Workers AI binding named AI is missing.' }, 500, h);
      const t = await ask(env, [{ role: 'user', content: 'Reply with the single word: ready' }]);
      return json(t.answer ? { ok: true, model: t.model, reply: t.answer.slice(0, 40) } : { ok: false, problem: t.error }, t.answer ? 200 : 500, h);
    }
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
    const allow = env.ALLOWED_ORIGIN;
    if (allow && req.headers.get('Origin') !== allow) return json({ error: 'Not allowed from this site.' }, 403, h);
    let body;
    try { body = await req.json(); } catch (e) { return json({ error: 'Bad request.' }, 400, h); }
    const question = String(body.question || '').slice(0, 600).trim();
    const facts = JSON.stringify(body.facts || {}).slice(0, 9000);
    if (!question) return json({ error: 'Ask a question first.' }, 400, h);
    const history = (Array.isArray(body.history) ? body.history : []).slice(-6).map(function (m) {
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 800) };
    });
    const messages = [{ role: 'system', content: SYSTEM }].concat(history, [{ role: 'user', content: 'FACTS (measured by code, treat as true):\n' + facts + '\n\nQUESTION: ' + question }]);
    const r = await ask(env, messages);
    if (r.answer) return json({ answer: r.answer }, 200, h);
    return json({ error: 'The AI is busy or out of free uses today.', detail: r.error }, 503, h);
  }
};
