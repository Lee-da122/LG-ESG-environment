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
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';

const MAX_TEXT_LEN = 500;
const MAX_STATES   = 20;   // 상태 항목 최대 개수 (남용 방지)

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
    .map((s) => `- ${s.item}(${s.label}): ${s.conditions.slice(0, 30).join(', ')}`)
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

  try {
    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction,
        contents: [{ role: 'user', parts: [{ text: text.trim() }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '');
      console.error('[classify] Gemini error', geminiRes.status, errText);
      return res.status(502).json({ error: 'AI service error' });
    }

    const geminiData = await geminiRes.json();
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // 코드펜스 제거 후 JSON 파싱
    const jsonStr = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    const parsed  = JSON.parse(jsonStr);

    return res.status(200).json({
      item:  parsed.item  || null,
      state: parsed.state || null,
    });
  } catch (err) {
    console.error('[classify] unexpected error', err);
    // 파싱 실패 등 → "분류 불가" 로 안전하게 응답 (500 아닌 200)
    return res.status(200).json({ item: null, state: null });
  }
};
