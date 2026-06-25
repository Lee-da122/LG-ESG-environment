/**
 * 자율 진단 AI 설정
 *
 * classifyEndpoint 값에 따라 동작이 달라집니다:
 *
 *   ''               → AI 비활성. 로컬 더블클릭용. 폴백(직접 선택)으로만 동작.
 *   '/api/classify'  → 서버리스 프록시 사용 (Vercel / Cloudflare Pages 배포 후).
 *                      GEMINI_API_KEY는 서버 환경변수에서만 읽힘 — 프론트에 노출 없음.
 *
 * ⚠ Gemini URL을 직접 여기에 넣지 마세요. 키가 브라우저에 노출됩니다.
 */
const classifyEndpoint = '/api/classify';

/**
 * 사용자 자유 텍스트를 서버리스 프록시로 보내 { item, state } 로 분류받습니다.
 * endpoint가 비어 있거나 오류 시 null 반환 → 호출자가 폴백 처리.
 */
async function classifyText(text) {
  if (!classifyEndpoint || !text || !text.trim()) return null;

  // data.js의 ITEMS를 그대로 전달해 서버에서 분류 기준으로 사용하게 함
  const states = (typeof ITEMS !== 'undefined' ? ITEMS : []).map((item) => ({
    item:       item.id,
    label:      item.label,
    conditions: item.conditions.map((c) => c.label),
  }));

  try {
    const res = await fetch(classifyEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), states }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.item || !data.state) return null;
    return { item: data.item, state: data.state };
  } catch {
    return null;
  }
}
