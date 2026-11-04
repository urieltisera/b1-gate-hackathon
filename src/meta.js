// B1 Gate optional untrusted proposal adapter. No GitHub credentials or execution authority.
const META_ENDPOINT = 'https://api.meta.ai/v1/chat/completions';
const MODEL = 'muse-spark-1.3';
const REPOSITORY = 'urieltisera/b1-gate2-demo';
const PATH = 'b1-demo/proof.txt';
const schema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
    content: { type: 'string' }
  },
  required: ['title', 'body', 'content'],
  additionalProperties: false
};

export function effectFromModel(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) throw Error('Invalid model proposal');
  if (Object.keys(output).sort().join(',') !== 'body,content,title') throw Error('Unexpected model proposal fields');
  const { title, body, content } = output;
  if (typeof title !== 'string' || !title.trim() || title.length > 120 ||
      typeof body !== 'string' || body.length > 1000 ||
      typeof content !== 'string' || !content.trim() || content.length > 2000) {
    throw Error('Model proposal failed validation');
  }
  return {
    action: 'github.create_draft_pr',
    repository: REPOSITORY,
    title,
    body,
    path: PATH,
    content
  };
}

export async function museProposal(request, { key = process.env.MODEL_API_KEY, fetchImpl = fetch } = {}) {
  if (!key) throw Error('MODEL_API_KEY not configured');
  if (typeof request !== 'string' || !request.trim() || request.length > 500) throw Error('Invalid proposal request (max 500 characters)');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetchImpl(META_ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'developer', content: 'You are an untrusted proposal generator for a demonstration of governed AI execution. Suggest a harmless short proof text to be written to a single demo file. Never include secrets, credentials, code execution instructions, or sensitive data. You cannot authorize or execute anything. Return only a JSON object with title, body, content. Keep title under 120 chars, body under 1000 chars, and content under 2000 chars.' },
          { role: 'user', content: request }
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'b1_proposal', strict: true, schema } }
      }),
      signal: controller.signal
    });
    if (!response.ok) throw Error(`Meta Model API HTTP ${response.status}`);
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== 'string' || raw.length > 20000) throw Error('Invalid Meta Model API response');
    let output;
    try { output = JSON.parse(raw); } catch { throw Error('Meta returned non-JSON proposal'); }
    return effectFromModel(output);
  } catch (e) {
    if (e?.name === 'AbortError') throw Error('Meta Model API timeout');
    throw e;
  } finally { clearTimeout(timeout); }
}
