/**
 * Cloudflare Pages Function — POST /api/classify
 *
 * 환경변수 (Pages 대시보드 → Settings → Environment variables):
 *   GEMINI_API_KEY   — Google AI API 키 (절대 코드·레포에 넣지 말 것)
 *   ALLOWED_ORIGIN   — (선택) 허용 도메인. 미설정 시 request Host에서 자동 유도.
 */

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';

const MAX_TEXT_LEN     = 500;
const MAX_STATES       = 20;
const RETRY_DELAYS_MS  = [500, 1000, 2000];
const TOTAL_TIMEOUT_MS = 9_000;

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason || new Error('aborted'));
    }, { once: true });
  });

const isRetryable = (status) => status === 429 || status >= 500;

function isAllowedOrigin(request) {
  const origin  = request.headers.get('origin') || request.headers.get('referer') || '';
  if (!origin) return true;
  if (/localhost|127\.0\.0\.1/.test(origin)) return true;

  const host    = request.headers.get('host') || '';
  const allowed = `https://${host}`;
  return origin.startsWith(allowed);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isAllowedOrigin(request)) {
    return json({ error: 'Forbidden' }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { text, states } = body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return json({ error: 'text is required' }, 400);
  }
  if (text.length > MAX_TEXT_LEN) {
    return json({ error: `text must be under ${MAX_TEXT_LEN} characters` }, 400);
  }
  if (!Array.isArray(states) || states.length === 0 || states.length > MAX_STATES) {
    return json({ error: 'states must be a non-empty array' }, 400);
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: 'Server configuration error' }, 500);
  }

  const stateList = states
    .slice(0, MAX_STATES)
    .map((s) => `- ${s.item}(${s.label}): ${s.conditions.slice(0, 30).join(', ')}`)
    .join('\n');

  const systemInstruction = {
    parts: [{
      text:
        `너는 Re:born 진단 분류기다.\n` +
        `역할: 사용자가 설명하는 우산·의류 상태를 아래 카테고리 중 하나로 분류한다.\n` +
        `일반 상담, 수리 조언, 부가 설명은 절대 하지 않는다.\n\n` +
        `분류 카테고리 (형식: 아이템ID(한글명): 상태1, 상태2, ...):\n` +
        `${stateList}\n\n` +
        `출력 규칙:\n` +
        `1. 반드시 JSON 객체 하나만 출력한다. 인사·설명·코드펜스 금지.\n` +
        `2. item은 아이템ID(영문), state는 카테고리에 있는 한국어 상태명 그대로.\n` +
        `3. 목록에 없거나 모호하면 {"item":null,"state":null}.\n` +
        `4. 판단 기준 언어: 한국어.`,
    }],
  };

  const requestBody = {
    systemInstruction,
    contents: [{ role: 'user', parts: [{ text: text.trim() }] }],
    generationConfig: { responseMimeType: 'application/json' },
  };

  const ac = new AbortController();
  const totalTimer = setTimeout(() => ac.abort(new Error('total timeout')), TOTAL_TIMEOUT_MS);

  let geminiRes = null;

  try {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        try {
          await sleep(RETRY_DELAYS_MS[attempt - 1], ac.signal);
        } catch {
          break;
        }
      }

      try {
        geminiRes = await fetch(GEMINI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(requestBody),
          signal: ac.signal,
        });
      } catch {
        if (ac.signal.aborted) break;
        geminiRes = null;
        continue;
      }

      if (geminiRes.ok) break;

      if (!isRetryable(geminiRes.status)) {
        return json({ item: null, state: null }); // 영구 오류 → 폴백
      }

      geminiRes = null;
    }
  } finally {
    clearTimeout(totalTimer);
  }

  if (!geminiRes || !geminiRes.ok) {
    return json({
      item:    null,
      state:   null,
      message: '지금 분류가 혼잡합니다. 잠시 후 다시 시도하거나 직접 선택해 주세요.',
    }, 503);
  }

  let raw = '';
  try {
    const geminiData = await geminiRes.json();
    raw     = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonStr = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    const parsed  = JSON.parse(jsonStr);

    return json({ item: parsed.item || null, state: parsed.state || null, _debug: raw }); // ← _debug 임시
  } catch (e) {
    return json({ item: null, state: null, _debug: { raw, error: String(e) } });        // ← _debug 임시
  }
}

// OPTIONS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
