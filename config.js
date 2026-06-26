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

// 거점 정보 구글 시트 CSV. 비워두면 data.js의 centers 배열을 그대로 사용.
const sheetCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQrpNOwZTG7w5uUUfjqrBBJVNq3ZLupg4dZ7i7CbTwXFbih7oMTsFtPPivzExY2BcpD16bu8_EZaqGa/pub?gid=528619496&single=true&output=csv';

/**
 * 사용자 자유 텍스트를 서버리스 프록시로 보내 { item, state } 로 분류받습니다.
 * endpoint가 비어 있거나 오류 시 null 반환 → 호출자가 폴백 처리.
 */
async function classifyText(text) {
  if (!classifyEndpoint || !text || !text.trim()) return null;

  // data.js의 ITEMS를 그대로 전달해 서버에서 분류 기준으로 사용하게 함
  const states = (typeof ITEMS !== 'undefined' ? ITEMS : []).flatMap((item) =>
    item.conditions.map((c) => ({
      item:       item.id,
      label:      c.label,
      conditions: c.conditions || [],
    }))
  );

  try {
    const res = await fetch(classifyEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), states }),
    });
    // 503은 재시도 소진 메시지가 담긴 JSON을 반환하므로 ok 여부와 별개로 파싱
    const data = await res.json().catch(() => null);
    if (!data || !data.item || !data.state) {
      // 서버가 사용자에게 보여줄 메시지를 내려줬으면 그대로 전달
      return (data && data.message) ? { message: data.message } : null;
    }
    return { item: data.item, state: data.state };
  } catch {
    return null;
  }
}
