/**
 * Vercel Serverless Function — POST /api/classify
 *
 * 환경변수:
 *   GEMINI_API_KEY   — Google AI API 키 (절대 코드·레포에 넣지 말 것)
 *   ALLOWED_ORIGIN   — (선택) 허용 도메인. 미설정 시 request Host에서 자동 유도.
 *
 * 배포 후 Vercel 대시보드 → Settings → Environment Variables 에서 키 설정.
 */

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

const MAX_TEXT_LEN     = 500;
const MAX_STATES       = 20;    // 상태 항목 최대 개수 (남용 방지)
const RETRY_DELAYS_MS  = [500, 1000, 2000]; // 최대 3회 시도 (초기 + 2회 재시도)
const TOTAL_TIMEOUT_MS = 9_000;             // Vercel Hobby 10초 한도 — 1초 버퍼 확보

// AbortSignal을 인식하는 sleep
const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason || new Error('aborted'));
    }, { once: true });
  });

// 503·429·5xx는 재시도 대상. 4xx(429 제외)는 영구 오류.
const isRetryable = (status) => status === 429 || status >= 500;

function isAllowedOrigin(req) {
  const origin = req.headers['origin'] || req.headers['referer'] || '';
  if (!origin) return true;                                 // 동일 출처 요청
  if (/localhost|127\.0\.0\.1/.test(origin)) return true;  // 로컬 개발

  const allowed = process.env.ALLOWED_ORIGIN
    || `https://${req.headers['host'] || ''}`;
  return origin.startsWith(allowed);
}

module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { text, states } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (text.length > MAX_TEXT_LEN) {
    return res.status(400).json({ error: `text must be under ${MAX_TEXT_LEN} characters` });
  }
  if (!Array.isArray(states) || states.length === 0 || states.length > MAX_STATES) {
    return res.status(400).json({ error: 'states must be a non-empty array' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[classify] GEMINI_API_KEY not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // states 목록 문자열 (systemInstruction에 주입)
  const stateList = states
    .slice(0, MAX_STATES)
    .map((s) => `- ${s.item}(${s.label}): ${(s.conditions || []).slice(0, 30).join(', ')}`)
    .join('\n');

  // systemInstruction: 역할·출력 형식·제약을 고정. 사용자 입력과 섞지 않음.
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
    generationConfig: {
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  // ── 재시도 루프 (전체 9초 타임아웃) ──────────────────────────
  const ac = new AbortController();
  const totalTimer = setTimeout(() => ac.abort(new Error('total timeout')), TOTAL_TIMEOUT_MS);

  let geminiRes = null;

  try {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        try {
          await sleep(RETRY_DELAYS_MS[attempt - 1], ac.signal);
        } catch {
          break; // 전체 타임아웃 중 sleep 중단
        }
      }

      try {
        const t0 = Date.now();
        console.log('[classify] gemini 호출 시작', t0);
        geminiRes = await fetch(GEMINI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(requestBody),
          signal: ac.signal,
        });
        console.log('[classify] gemini 응답 수신', Date.now(), '소요(ms):', Date.now() - t0);
      } catch (e) {
        console.error('[classify] fetch 실패:', e.name, e.message, 'aborted:', ac.signal.aborted);
        if (ac.signal.aborted) break; // 타임아웃 → 루프 종료
        geminiRes = null;
        continue;                     // 네트워크 오류 → 재시도
      }

      if (geminiRes.ok) break;        // 성공

      if (!isRetryable(geminiRes.status)) {
        console.error('[classify] Gemini permanent error', geminiRes.status);
        return res.status(200).json({ item: null, state: null }); // 영구 오류 → 폴백
      }

      console.warn(`[classify] Gemini ${geminiRes.status} — attempt ${attempt + 1}`);
      geminiRes = null; // 재시도
    }
  } finally {
    clearTimeout(totalTimer);
  }

  // 재시도 소진 또는 타임아웃
  if (!geminiRes || !geminiRes.ok) {
    return res.status(503).json({
      item:    null,
      state:   null,
      message: '지금 분류가 혼잡합니다. 잠시 후 다시 시도하거나 직접 선택해 주세요.',
    });
  }

  // ── 응답 파싱 ────────────────────────────────────────────────
  try {
    const geminiData = await geminiRes.json();
    const raw     = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonStr = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

    console.log('[classify] RAW   :', raw);
    console.log('[classify] PARSED:', jsonStr);

    const parsed  = JSON.parse(jsonStr);

    return res.status(200).json({
      item:  parsed.item  || null,
      state: parsed.state || null,
    });
  } catch (err) {
    console.error('[classify] parse error', err);
    return res.status(200).json({ item: null, state: null });
  }
};
