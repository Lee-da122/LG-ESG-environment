const state = {
  screen: 'home',
  item: null,
  condition: null,
  route: null,
  resultView: 'hub',       // 'hub' | detail key (result 내부 화면)
  clothingCategory: null,  // 의류 CO2 카테고리 id (self/pro 경로에서만 사용)
};

/* ── 이동 기록 ── */

const history = [];

/* ── 거점 데이터 (CSV 로드 전: null, 로드 후: 배열) ── */

let liveCenters = null;

/* ── CO₂ 그래프 Chart.js 인스턴스 ── */

let co2Chart = null;

function navigate(screen) {
  history.push({ ...state });
  state.screen = screen;
  render();
}

function showDetail(key) {
  history.push({ ...state });
  state.resultView = key;
  render();
}

function goBack() {
  if (history.length === 0) {
    state.screen = 'home';
    render();
    return;
  }
  const prev = history.pop();
  Object.assign(state, prev);
  render();
}

function resetAndGoHome() {
  history.length = 0;
  state.item = null;
  state.condition = null;
  state.route = null;
  state.resultView = 'hub';
  state.clothingCategory = null;
  state.screen = 'home';
  render();
}

/* ── 공통 UI 헬퍼 ── */

function logoLockup() {
  return `
    <div class="logo-lockup">
      <img class="logo-img" src="assets/logo-esg.png" alt="ESG 아카데미"
           onerror="this.style.display='none'" />
      <span class="logo-sep"></span>
      <img class="logo-img" src="assets/logo-lg.png" alt="LG전자"
           onerror="this.style.display='none'" />
    </div>
  `;
}

function logoFooter() {
  return `<div class="logo-footer">${logoLockup()}</div>`;
}

function renderBackButton() {
  if (state.screen === 'home') return '';
  return `<button class="btn-back" onclick="goBack()">‹ 뒤로</button>`;
}

/* ── 진단 화면 ── */

function renderHome() {
  return `
    <div class="screen home-screen">
      <div class="home-logo">${logoLockup()}</div>
      <div class="home-body">
        <p class="home-slogan">버리지 말고,<br>먼저 고쳐보세요</p>
        <p class="home-desc">Re:born은 우산·의류의 상태를 진단하고<br>수리·재사용·재활용 경로를 안내합니다.</p>
      </div>
      <button class="btn-primary" onclick="navigate('itemSelect')">진단 시작</button>
      <button class="btn-secondary" onclick="location.href='circular.html'">순환경제 알아보기</button>
    </div>
  `;
}

/* ── 키워드 매칭 폴백 ── */

// 우선순위 순으로 정렬. 동사 어미는 어근만 기재해 부분 일치로 커버.
// 공백은 매칭 전에 모두 제거하므로 "안 입다"→"안입다" 처리됨.
const KEYWORD_RULES = [
  // 우산 — 녹슴·곰팡이
  {
    item: 'umbrella', state: '녹슴·곰팡이',
    re: /녹슬|녹이슬|녹이|곰팡이|냄새나|냄새난|삭다|삭았/,
  },
  // 우산 — 살대·천·손잡이 파손 (우산 특정 명칭)
  {
    item: 'umbrella', state: '살대·천·손잡이 파손',
    re: /살대|우산살|뼈대|프레임|손잡이|핸들|방수천|우산천/,
  },
  // 우산 명시 + 파손 동사 (예: "우산이 찢어졌어요")
  {
    item: 'umbrella', state: '살대·천·손잡이 파손',
    re: /우산.{0,8}(휘|부러|찌그|꺾|찢어|터졌|구멍)/,
  },
  // 의류 — 단추 떨어짐
  {
    item: 'clothing', state: '단추 떨어짐',
    re: /단추/,
  },
  // 의류 — 지퍼 고장
  {
    item: 'clothing', state: '지퍼 고장',
    re: /지퍼/,
  },
  // 의류 — 솔기 터짐
  {
    item: 'clothing', state: '솔기 터짐',
    re: /솔기|시접/,
  },
  // 의류 — 기장·품 수선
  {
    item: 'clothing', state: '기장·품 수선',
    re: /기장|밑단/,
  },
  // 의류 — 멀쩡하지만 안 입음
  {
    item: 'clothing', state: '멀쩡하지만 안 입음',
    re: /안입|기부|나눔|새옷|깨끗|멀쩡/,
  },
  // 의류 — 오염·훼손 심함
  {
    item: 'clothing', state: '오염·훼손 심함',
    re: /오염|훼손|얼룩|낡았|낡다|헤졌|헤지/,
  },
];

function matchByKeyword(text) {
  const t = text.replace(/\s+/g, '');
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(t)) return { item: rule.item, state: rule.state };
  }
  return null;
}

/* ── 자율 진단: AI 분류 후 결과로 바로 이동 ── */

async function handleClassifySubmit() {
  const input     = document.getElementById('classify-input');
  const submitBtn = document.getElementById('classify-submit');
  const statusEl  = document.getElementById('classify-status');
  const text      = input ? input.value.trim() : '';

  if (!text) {
    if (statusEl) statusEl.textContent = '내용을 입력해 주세요.';
    return;
  }

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '분류 중…'; }
  if (statusEl)  statusEl.textContent = '';

  const result = (typeof classifyText === 'function') ? await classifyText(text) : null;

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '보내기'; }

  if (result && result.item && result.state) {
    const itemData = ITEMS.find((i) => i.id === result.item);
    const condData = itemData && itemData.conditions.find((c) => c.label === result.state);
    if (condData) {
      state.item       = result.item;
      state.condition  = result.state;
      state.route      = condData.route;
      state.resultView = 'hub';
      navigateAfterCondition();
      return;
    }
  }

  // Gemini 실패 → 키워드 매칭 폴백
  const kwResult = matchByKeyword(text);
  if (kwResult) {
    const itemData = ITEMS.find((i) => i.id === kwResult.item);
    const condData = itemData && itemData.conditions.find((c) => c.label === kwResult.state);
    if (condData) {
      state.item       = kwResult.item;
      state.condition  = kwResult.state;
      state.route      = condData.route;
      state.resultView = 'hub';
      navigateAfterCondition();
      return;
    }
  }

  // 최종 실패 → 서버 메시지 우선, 없으면 기본 안내
  if (statusEl) {
    statusEl.textContent = (result && result.message)
      || '정확히 인식하지 못했어요. 아래에서 직접 선택해 주세요.';
  }
}

function renderItemSelect() {
  const cards = ITEMS.map((item) => `
    <button class="card" onclick="selectItem('${item.id}')">
      ${item.label}
    </button>
  `).join('');

  // classifyEndpoint가 설정된 경우에만 자율 진단 입력란 표시
  const aiActive = typeof classifyEndpoint !== 'undefined' && !!classifyEndpoint;

  const classifySection = aiActive ? `
    <div class="classify-section">
      <p class="classify-label">상태를 직접 설명할게요</p>
      <div class="classify-row">
        <input
          id="classify-input"
          class="classify-input"
          type="text"
          placeholder="예: 우산 살대가 휘어서 펴지지 않아요"
          maxlength="200"
          onkeydown="if(event.key==='Enter') handleClassifySubmit()"
        />
        <button id="classify-submit" class="classify-btn" onclick="handleClassifySubmit()">
          보내기
        </button>
      </div>
      <p id="classify-status" class="classify-status"></p>
    </div>
    <div class="divider"><span>또는 직접 선택</span></div>
  ` : '';

  return `
    <div class="screen">
      ${renderBackButton()}
      <h1 class="screen-title">품목 선택</h1>
      ${classifySection}
      <div class="card-list">${cards}</div>
      ${logoFooter()}
    </div>
  `;
}

function selectItem(itemId) {
  state.item = itemId;
  state.condition = null;
  state.route = null;
  navigate('stateSelect');
}

function renderStateSelect() {
  const itemData = ITEMS.find((i) => i.id === state.item);

  if (!itemData) {
    return `
      <div class="screen">
        ${renderBackButton()}
        <h1 class="screen-title">상태 선택</h1>
        <p class="notice">품목을 먼저 선택해 주세요.</p>
        <button class="btn-primary" onclick="navigate('itemSelect')">품목 선택으로</button>
        ${logoFooter()}
      </div>
    `;
  }

  const cards = itemData.conditions.map((cond, idx) => `
    <button class="card" onclick="selectCondition(${idx})">
      ${cond.label}
    </button>
  `).join('');

  return `
    <div class="screen">
      ${renderBackButton()}
      <h1 class="screen-title">상태 선택</h1>
      <div class="card-list">${cards}</div>
      ${logoFooter()}
    </div>
  `;
}

function renderClothingCategory() {
  const cards = CLOTHING_CATEGORIES.map((cat) => `
    <button class="card${state.clothingCategory === cat.id ? ' selected' : ''}"
            onclick="selectClothingCategory('${cat.id}')">
      ${cat.label}
    </button>
  `).join('');

  return `
    <div class="screen">
      ${renderBackButton()}
      <h1 class="screen-title">의류 종류 선택</h1>
      <p class="notice" style="margin-bottom:16px;font-size:14px;color:#52514e;">아래 탄소 절감량 계산에만 사용돼요.<br>수선 방법에는 영향을 주지 않아요.</p>
      <div class="card-list">${cards}</div>
      ${logoFooter()}
    </div>
  `;
}

function selectClothingCategory(categoryId) {
  state.clothingCategory = categoryId;
  navigate('result');
}

function selectCondition(idx) {
  const itemData = ITEMS.find((i) => i.id === state.item);
  const cond = itemData.conditions[idx];
  state.condition = cond.label;
  state.route = cond.route;
  state.resultView = 'hub';
  navigateAfterCondition();
}

/* ── 결과: 공통 레이아웃 헬퍼 ── */

function resultLayout(badge, verdictText, bodyHtml, footerNote) {
  return `
    <div class="screen">
      ${renderBackButton()}
      <div class="result-header">
        <span class="route-badge badge-${state.route}">${badge}</span>
        <p class="verdict">${verdictText}</p>
      </div>
      <div class="result-body">
        ${bodyHtml}
      </div>
      ${footerNote ? `<p class="footer-note">${footerNote}</p>` : ''}
      <button class="btn-primary" onclick="resetAndGoHome()">처음으로</button>
      ${logoFooter()}
    </div>
  `;
}

function detailLayout(title, bodyHtml) {
  return `
    <div class="screen">
      ${renderBackButton()}
      <h2 class="detail-title">${title}</h2>
      <div class="result-body">
        ${bodyHtml}
      </div>
      <button class="btn-primary" onclick="resetAndGoHome()">처음으로</button>
      ${logoFooter()}
    </div>
  `;
}

/* ── 거점 헬퍼 ── */

/* ── 거점 신고 & 마커 헬퍼 ── */

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function centerActionButtons() {
  const hasSubmit = typeof reportSubmitFormUrl !== 'undefined' && reportSubmitFormUrl;
  const hasReport = typeof reportFormUrl !== 'undefined' && reportFormUrl;
  if (!hasSubmit && !hasReport) return '';
  return `
    <div class="center-action-buttons">
      ${hasSubmit ? `<a href="${escHtml(reportSubmitFormUrl)}" target="_blank" rel="noopener" class="btn-outline">거점 제보하기</a>` : ''}
      ${hasReport ? `<a href="${escHtml(reportFormUrl)}" target="_blank" rel="noopener" class="btn-outline">잘못된 정보 신고하기</a>` : ''}
    </div>
  `;
}

function makeMarkerIcon(origin) {
  const isReport = origin === 'report';
  return L.divIcon({
    className: '',
    html: isReport
      ? '<div style="width:14px;height:14px;background:#fff;border:2.5px solid #D20565;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.35);"></div>'
      : '<div style="width:14px;height:14px;background:#D20565;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.35);"></div>',
    iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -10],
  });
}

function centerPopupHtml(c) {
  const badge = c.origin === 'report'
    ? ' <span style="font-size:10px;font-weight:700;color:#D20565;border:1px solid #D20565;border-radius:3px;padding:1px 4px;vertical-align:middle;">제보</span>'
    : '';
  const sourceLink = c.sourceUrl
    ? `<a href="${escHtml(c.sourceUrl)}" target="_blank" rel="noopener noreferrer"
         style="color:#D20565;text-decoration:underline;">${escHtml(c.source || '출처')}</a>`
    : null;
  return [
    `<strong>${escHtml(c.name)}</strong>${badge}`,
    c.address  ? escHtml(c.address) : null,
    c.hours    ? escHtml(c.hours)   : null,
    c.phone    ? escHtml(c.phone)   : null,
    sourceLink,
  ].filter(Boolean).join('<br>');
}

function getMatchedCenters() {
  const source = liveCenters !== null ? liveCenters : centers;
  const itemData = ITEMS.find((i) => i.id === state.item);
  return source.filter((c) => {
    if (c.route !== state.route) return false;
    const categoryOk = !c.category || c.category === state.item;
    const itemsOk    = !c.items || c.items.length === 0 || c.items.includes(state.item);
    return categoryOk && itemsOk;
  });
}

function renderCenterList(matched) {
  if (liveCenters === null) {
    return '<p class="empty-state">거점 불러오는 중…</p>';
  }
  if (matched.length === 0) {
    return '<p class="empty-state">거점 정보 준비 중</p>';
  }
  return `
    <ul class="center-list">
      ${matched.map((c) => `
        <li class="center-item">
          <div class="center-top">
            <span class="center-name">${escHtml(c.name)}${c.origin === 'report' ? '<span class="center-report-badge">제보</span>' : ''}</span>
            <span class="center-type-badge">${escHtml(c.centerType || '')}</span>
          </div>
          <p class="center-addr">${escHtml(c.address || '')}</p>
          ${c.detail ? `<p class="center-loc">${escHtml(c.detail)}</p>` : ''}
          ${c.hours  ? `<p class="center-detail">${escHtml(c.hours)}</p>` : ''}
          ${c.phone  ? `<p class="center-detail">${escHtml(c.phone)}</p>` : ''}
          ${c.note   ? `<p class="center-note">${escHtml(c.note)}</p>`    : ''}
        </li>
      `).join('')}
    </ul>
  `;
}

/* ── CO₂ 산출 기준 상수 ────────────────────────────────────────────────────────
 * 의류 1벌 생산단계 CO2 (원단+원사 생산~재단/봉제/마감, 세탁·폐기 단계 제외)
 * 출처: Levi Strauss & Co., "The Life Cycle of a Jean" LCA (2015)
 *       Fiber 2.9 + Fabric assembly 9.0 + Cut·Sew·Finish 2.6 = 14.5 kg CO2-e
 * 참고: 데님 기준 프록시 값. 전과정(세탁+폐기 포함) 기준은 33.4 kg
 */
const CLOTHING_PRODUCTION_CO2_KG = 14.5;

/* 우산 원단(패브릭)만의 생산 CO2 (프레임/살 미포함)
 * 계산: 원단 약 180 g × PET 원단위 3.22 kgCO2eq/kg = 0.58 kg
 * 출처: 사회적가치연구원(CSES) SVMR 제2호 「플라스틱 패키징 감축의 사회적 가치」(2022.08)
 * ⚠️ TODO: 우산살(금속) 생산 배출량 미포함. 전체 우산 값 아님을 UI에 명시.
 */
const UMBRELLA_FABRIC_PRODUCTION_CO2_KG = 0.58;

/* 섬유 폐기물 소각 배출계수 (업사이클링 = 폐기 회피 배출량 계산용)
 * 출처: IPCC 2006 Guidelines Vol.5 Ch.2 Table 2.4 (Textiles)
 *       건조물함량 80% × 탄소함량 50% × 화석탄소비율 20~50% × 44/12
 */
const TEXTILE_INCINERATION_CO2_PER_KG_MIN = 0.29; // 화석탄소비율 기본값(20%) 적용
const TEXTILE_INCINERATION_CO2_PER_KG_MAX = 0.73; // 화석탄소비율 최댓값(50%) 적용

/* 섬유 폐기물 매립 관련 파라미터 (참고용; CH4 배출이므로 CO2 직접 환산 아님)
 * 출처: IPCC 2006 Guidelines Vol.5 Table 2.4 / Ch.3
 */
const TEXTILE_LANDFILL_DOC  = 0.24; // 건조폐기물 대비 분해가능 유기탄소
const TEXTILE_LANDFILL_DOCF = 0.77; // DOC 중 실제 분해되는 비율 (IPCC 기본값)

/* 의류 CO2 카테고리 — 무게 × 3.22 kgCO2eq/kg (CSES SVMR 제2호 2022)
 * 무게 출처: ThredUP Clothing Lifecycle Study (Green Story Inc., 2019) Table 3-7
 * 바지는 Levi's LCA(2015) 14.5 kg CO2-e 생산단계 값 유지
 */
const CLOTHING_CATEGORIES = [
  { id: 'tshirt',    label: '반소매 상의',              co2Kg: 0.18 * 3.22, isPants: false },
  { id: 'longsleeve',label: '긴소매 상의',              co2Kg: 0.17 * 3.22, isPants: false },
  { id: 'jacket',    label: '겉옷 (얇은 자켓·바람막이)', co2Kg: 0.70 * 3.22, isPants: false },
  { id: 'coat',      label: '겉옷 (코트·패딩 등)',       co2Kg: 1.10 * 3.22, isPants: false },
  { id: 'pants',     label: '바지 (롱팬츠)',             co2Kg: 14.5,         isPants: true  },
];
// ──────────────────────────────────────────────────────────────────────────────

/* 현재 state에 맞는 생산단계 CO2 (kg) 반환 */
function getEffectiveProductionKg() {
  if (state.item === 'clothing' && state.clothingCategory) {
    const cat = CLOTHING_CATEGORIES.find((c) => c.id === state.clothingCategory);
    if (cat) return cat.co2Kg;
  }
  const itemData = ITEMS.find((i) => i.id === state.item);
  return itemData && itemData.co2 && itemData.co2.productionKg;
}

/* 의류 self/pro 경로 → 카테고리 선택 화면 먼저, 나머지 → 결과 바로 */
function navigateAfterCondition() {
  if (state.item === 'clothing' && (state.route === 'self' || state.route === 'pro')) {
    state.clothingCategory = null;
    navigate('clothingCategory');
  } else {
    navigate('result');
  }
}

/* ── CO₂ 그래프: 헬퍼 & 렌더 ── */

function calcCo2(productionKg, weeks, freqPerWeek, moreWeeks) {
  const usesNow    = Math.max(1, Math.round(freqPerWeek * weeks));
  const usesFuture = Math.max(1, Math.round(freqPerWeek * (weeks + moreWeeks)));
  const perNow     = Math.round((productionKg * 1000) / usesNow);
  const perFuture  = Math.round((productionKg * 1000) / usesFuture);
  return { usesNow, usesFuture, perNow, perFuture };
}

function renderCo2Graph() {
  if (state.route !== 'pro' && state.route !== 'self') return '';
  if (!getEffectiveProductionKg()) return '';

  return `
    <div class="content-section">
      <h2 class="section-title">수리할수록 줄어드는 탄소 발자국</h2>
      ${(function() {
        if (state.item !== 'clothing' || !state.clothingCategory) return '';
        const cat = CLOTHING_CATEGORIES.find((c) => c.id === state.clothingCategory);
        if (!cat) return '';
        return `<p style="font-size:13px;color:#6b7280;margin:2px 0 12px;">선택하신 <strong>${escHtml(cat.label)}</strong> 기준으로 계산돼요</p>`;
      })()}
      <div class="co2-sliders">
        <div class="co2-slider-row">
          <label>산 지 <strong id="co2-months-val">4</strong>주</label>
          <input type="range" id="co2-months" min="1" max="520" value="4" />
        </div>
        <div class="co2-slider-row">
          <label>주당 <strong id="co2-freq-val">3</strong>회 사용</label>
          <input type="range" id="co2-freq" min="1" max="14" value="3" />
        </div>
        <div class="co2-slider-row">
          <label>앞으로 <strong id="co2-more-val">4</strong>주 더 사용</label>
          <input type="range" id="co2-more" min="1" max="260" value="4" />
        </div>
      </div>
      <div class="co2-summary">
        <div class="co2-stat">
          <span class="co2-stat-label">지금까지 사용</span>
          <span class="co2-stat-value" id="co2-uses-now">—</span>회
        </div>
        <div class="co2-stat">
          <span class="co2-stat-label">지금 1회당</span>
          <span class="co2-stat-value now" id="co2-per-now">—</span>g
        </div>
        <div class="co2-stat">
          <span class="co2-stat-label">더 쓰면 1회당</span>
          <span class="co2-stat-value future" id="co2-per-future">—</span>g
        </div>
      </div>
      <div class="co2-canvas-wrap">
        <canvas id="co2-chart"></canvas>
      </div>
      <p class="co2-note">${(function() {
        if (state.item === 'umbrella') {
          return '※ 원단(PET 패브릭 180g) 기준 · 프레임·살 미포함 / 출처: CSES SVMR 제2호(2022)';
        }
        const cat = CLOTHING_CATEGORIES.find((c) => c.id === state.clothingCategory);
        if (cat && cat.isPants) {
          return '※ 생산단계(원단+봉제) 기준 · 세탁·폐기 제외 / 출처: Levi\'s LCA(2015)';
        }
        return '※ 평균 의류 무게: ThredUP Clothing Lifecycle Study(Green Story Inc., 2019) Table 3-7 기준 · CO2 계수: CSES SVMR 제2호(2022)';
      })()}</p>
    </div>
  `;
}

function initCo2Chart() {
  const canvas = document.getElementById('co2-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const productionKg = getEffectiveProductionKg();
  if (!productionKg) return;

  if (co2Chart) { co2Chart.destroy(); co2Chart = null; }

  const AXIS_COLOR = '#52514e';
  const AXIS_STYLE = { color: AXIS_COLOR, font: { size: 11, weight: '500' } };

  function axisRange(usesNow, usesFuture, perNow) {
    return {
      xMin: Math.floor(usesNow * 0.4),
      xMax: Math.ceil(usesFuture * 1.25),
      yMax: Math.ceil(perNow * 1.15),
    };
  }

  function buildCurve(xMin, xMax) {
    const pts = [];
    const step = Math.max(1, Math.floor((xMax - xMin) / 80));
    for (let x = xMin; x <= xMax; x += step) {
      pts.push({ x, y: productionKg * 1000 / x });
    }
    return pts;
  }

  function updateChart() {
    const weeks = parseInt(document.getElementById('co2-months').value);
    const freq  = parseInt(document.getElementById('co2-freq').value);
    const more  = parseInt(document.getElementById('co2-more').value);

    document.getElementById('co2-months-val').textContent = weeks;
    document.getElementById('co2-freq-val').textContent   = freq;
    document.getElementById('co2-more-val').textContent   = more;

    const { usesNow, usesFuture, perNow, perFuture } = calcCo2(productionKg, weeks, freq, more);
    document.getElementById('co2-uses-now').textContent   = usesNow;
    document.getElementById('co2-per-now').textContent    = perNow;
    document.getElementById('co2-per-future').textContent = perFuture;

    const { xMin, xMax, yMax } = axisRange(usesNow, usesFuture, perNow);
    co2Chart.data.datasets[0].data = buildCurve(xMin, xMax);
    co2Chart.data.datasets[1].data = [{ x: usesNow, y: perNow }];
    co2Chart.data.datasets[2].data = [{ x: usesFuture, y: perFuture }];
    co2Chart.options.scales.x.min = xMin;
    co2Chart.options.scales.x.max = xMax;
    co2Chart.options.scales.y.max = yMax;
    co2Chart.update();
  }

  const initWeeks = 4, initFreq = 3, initMore = 4;
  const { usesNow, usesFuture, perNow, perFuture } = calcCo2(productionKg, initWeeks, initFreq, initMore);
  const { xMin, xMax, yMax } = axisRange(usesNow, usesFuture, perNow);

  document.getElementById('co2-uses-now').textContent   = usesNow;
  document.getElementById('co2-per-now').textContent    = perNow;
  document.getElementById('co2-per-future').textContent = perFuture;

  co2Chart = new Chart(canvas, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'CO₂ 곡선',
          data: buildCurve(xMin, xMax),
          borderColor: '#9ca3af',
          backgroundColor: 'transparent',
          showLine: true,
          pointRadius: 0,
          tension: 0.3,
          order: 3,
        },
        {
          label: '지금',
          data: [{ x: usesNow, y: perNow }],
          backgroundColor: '#ef4444',
          borderColor: '#ef4444',
          pointRadius: 7,
          pointHoverRadius: 9,
          order: 1,
        },
        {
          label: '더 쓰면',
          data: [{ x: usesFuture, y: perFuture }],
          backgroundColor: '#16a34a',
          borderColor: '#16a34a',
          pointRadius: 7,
          pointHoverRadius: 9,
          order: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${Math.round(ctx.parsed.y)}g CO₂ (${ctx.parsed.x}회 사용)`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: xMin,
          max: xMax,
          border: { color: AXIS_COLOR, width: 1.5 },
          ticks: AXIS_STYLE,
          title: { display: true, text: '누적 사용 횟수', ...AXIS_STYLE },
          grid: { color: '#e5e7eb' },
        },
        y: {
          type: 'linear',
          min: 0,
          max: yMax,
          border: { color: AXIS_COLOR, width: 1.5 },
          ticks: AXIS_STYLE,
          title: { display: true, text: '1회당 CO₂ (g)', ...AXIS_STYLE },
          grid: { color: '#e5e7eb' },
        },
      },
    },
  });

  ['co2-months', 'co2-freq', 'co2-more'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateChart);
  });
}

/* ── 결과: self / pro / reuse ── */

function renderSelf() {
  const guide = repairGuides.find(
    (g) => g.item === state.item && g.state === state.condition
  );

  let guideContent;
  if (!guide) {
    guideContent = REPAIR_GUIDE_MAP[state.condition]
      ? `<button class="btn-guide" onclick="openRepairModal(state.condition)">수선 방법 보기</button>`
      : '<p class="empty-state">수리 방법 준비 중</p>';
  } else if (guide.type === 'youtube') {
    const cautionsHtml = guide.cautions.length > 0
      ? `<ul class="caution-list">${guide.cautions.map((c) => `<li>${c}</li>`).join('')}</ul>`
      : '';
    guideContent = `
      <div class="yt-wrap">
        <iframe src="${guide.youtubeUrl}" frameborder="0" allowfullscreen></iframe>
      </div>
      ${cautionsHtml}
    `;
  } else if (guide.type === 'cardnews') {
    const imagesHtml = guide.cardImages.map((src) =>
      `<img class="cardnews-img" src="${src}" alt="${guide.title}" />`
    ).join('');
    const cautionsHtml = guide.cautions.length > 0
      ? `<ul class="caution-list">${guide.cautions.map((c) => `<li>${c}</li>`).join('')}</ul>`
      : '';
    guideContent = `
      <div class="cardnews-scroll">
        <div class="cardnews-track">${imagesHtml}</div>
      </div>
      ${cautionsHtml}
    `;
  } else {
    guideContent = '<p class="empty-state">수리 방법 준비 중</p>';
  }

  return resultLayout(
    ROUTE_LABELS.self,
    `${state.condition} — 직접 수리할 수 있어요.`,
    `<div class="content-section">
      <h2 class="section-title">수리 방법</h2>
      ${guideContent}
    </div>
    ${renderCo2Graph()}`
  );
}

/* ── pro/reuse 전용 지도 ── */

function renderProReuseMap() {
  if (liveCenters === null) {
    return '<p class="empty-state">거점 불러오는 중…</p>';
  }
  const matched = getMatchedCenters();
  if (matched.length === 0) {
    return '<p class="empty-state">거점 정보 준비 중</p>';
  }
  return `<div id="pro-reuse-map" style="width:100%;height:300px;border-radius:12px;overflow:hidden;background:#f3f4f6;position:relative;z-index:0;"></div>`;
}

function initProReuseMap() {
  const mapEl = document.getElementById('pro-reuse-map');
  if (!mapEl || typeof L === 'undefined') return;
  if (mapEl._leaflet_id) return;

  const matched = getMatchedCenters();
  const coords  = matched.filter((c) => c.lat && c.lng && !isNaN(Number(c.lat)));
  if (coords.length === 0) return;

  const map = L.map(mapEl, { scrollWheelZoom: false });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>',
    maxZoom: 18,
  }).addTo(map);

  coords.forEach((c) => {
    L.marker([Number(c.lat), Number(c.lng)], { icon: makeMarkerIcon(c.origin) })
      .addTo(map)
      .bindPopup(centerPopupHtml(c), { minWidth: 160 });
  });

  if (coords.length === 1) {
    map.setView([Number(coords[0].lat), Number(coords[0].lng)], 14);
  } else {
    map.fitBounds(
      L.latLngBounds(coords.map((c) => [Number(c.lat), Number(c.lng)])),
      { padding: [30, 30] }
    );
  }

  // Leaflet은 컨테이너가 숨겨진 직후 크기를 0으로 잡는 버그가 있어 강제 리사이즈
  requestAnimationFrame(() => map.invalidateSize());
}

function renderPro() {
  return resultLayout(
    ROUTE_LABELS.pro,
    `${state.condition} — 수리 전문점에 맡겨 보세요.`,
    `<div class="content-section">
      <h2 class="section-title">수리 안내</h2>
      ${REPAIR_GUIDE_MAP[state.condition]
        ? `<button class="btn-guide" onclick="openRepairModal(state.condition)">수선 방법 보기</button>`
        : '<p class="empty-state">내용 준비 중</p>'}
    </div>
    <div class="content-section">
      <h2 class="section-title">근처 거점</h2>
      ${renderProReuseMap()}
      ${centerActionButtons()}
    </div>
    ${renderCo2Graph()}`
  );
}

function renderReuse() {
  const dg = DISPOSAL.clothing.donationGuide;
  const acceptHtml = dg.acceptable.map((i) => `<li>${i}</li>`).join('');
  const rejectHtml = dg.notAcceptable.map((i) => `<li>${i}</li>`).join('');

  return resultLayout(
    ROUTE_LABELS.reuse,
    `${state.condition} — 기부처에 전달해 주세요.`,
    `<div class="content-section">
      <h2 class="section-title">기부 안내</h2>
      <div class="info-box warn-box">
        <p class="info-box-title">판단 기준</p>
        <p class="info-box-text">${dg.criteria}</p>
      </div>
      <div class="content-section" style="margin-top:0;">
        <h2 class="section-title">기부 가능한 물품</h2>
        <ul class="disposal-list">${acceptHtml}</ul>
      </div>
      <div class="info-box safety-box">
        <p class="info-box-title">⚠ 기부가 어려운 경우</p>
        <ul class="donotput-list">${rejectHtml}</ul>
        <p class="info-box-text" style="margin-top:8px;">오염·훼손이 심하다면? 기부 대신 분리배출을 확인하세요.</p>
      </div>
      <div class="source-links" style="margin-top:8px;">
        <span style="font-size:11px;color:#9ca3af;font-weight:600;">출처</span>
        <a href="${escHtml(dg.sourceUrl)}" target="_blank" rel="noopener" class="source-link">${escHtml(dg.sourceLabel)}</a>
      </div>
    </div>
    <div class="content-section">
      <h2 class="section-title">근처 거점</h2>
      ${renderProReuseMap()}
      ${centerActionButtons()}
    </div>`
  );
}

/* ── 우산 분리배출 가이드 카드 ── */

function renderUmbrellaDisposalGuide() {
  const steps = [
    '천(합성섬유)은 <strong>종량제봉투</strong>에 일반쓰레기로 배출',
    '살대·뼈대(금속)는 가위로 천과 분리 후 <strong>고철(캔류)</strong>로 배출',
    '손잡이가 플라스틱이면 분리해 <strong>플라스틱</strong>으로, 비닐우산 천은 <strong>비닐류</strong>로 배출',
    '분리가 어려우면 <strong>통째로 종량제봉투</strong>에 배출 — 자동우산은 갑자기 펴지지 않게 끈으로 묶어 고정',
    '종량제봉투보다 큰 장우산은 거주지 주민센터·구청에 <strong>대형생활폐기물</strong>로 신고 후 배출',
  ];

  const stepsHtml = steps.map((text, i) => `
    <li class="step-item">
      <span class="step-num">${i + 1}</span>
      <span class="step-text">${text}</span>
    </li>
  `).join('');

  return `
    <div class="disposal-guide">
      <div class="disposal-guide-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#D20565" aria-hidden="true">
          <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
        </svg>
        올바른 우산 분리배출 방법
      </div>
      <ol class="step-list">${stepsHtml}</ol>
      <p class="disposal-note">※ 곰팡이 핀 천은 재활용·기부가 불가하므로 종량제봉투로 배출</p>
      <p class="disposal-note" style="margin-top:8px;border-top:none;padding-top:0;">분리배출 전, 가까운 우산 수리센터를 먼저 확인해 보세요. 최근 우산 수리 센터를 운영하는 지자체가 늘고 있고, 망가진 우산에서 나온 부품을 다른 우산 수리에 활용하기도 합니다.</p>
      <div class="source-links">
        <span style="font-size:11px;color:#9ca3af;font-weight:600;">출처</span>
        <a href="https://www.seo.incheon.kr/open_content/main/part/clean/detritus_seperate.jsp" target="_blank" rel="noopener" class="source-link">인천광역시 서구 「분리수거·분리배출 요령」 (환경부·인천 서구, 공공누리)</a>
        <a href="https://www.icjg.go.kr/krpt0407c" target="_blank" rel="noopener" class="source-link">인천광역시 중구 「대형폐기물 처리 안내」</a>
        <a href="https://blisgo.com/%EC%BA%94%EB%A5%98/%EC%9A%B0%EC%82%B0-%EB%B2%84%EB%A6%AC%EB%8A%94-%EB%B2%95/" target="_blank" rel="noopener" class="source-link">블리스고 쓰레기 백과사전 — 우산 버리는 법</a>
        <a href="https://gscaltexmediahub.com/esg/esg-campaign/plastic-recycling-guide/plastic-literacy-umbrella/" target="_blank" rel="noopener" class="source-link">GS칼텍스 미디어허브 「플리를 알려줘」 — 올바른 우산 분리배출 방법 (2023.10.06)</a>
      </div>
    </div>
  `;
}

/* ── 결과: recycle 허브 ── */

function renderRecycleHub() {
  const d = DISPOSAL[state.item];
  const isClothing = state.item === 'clothing';

  const warningTitle = isClothing ? '버리기 전, 먼저 확인하세요' : '버리기 전, 한 번 더';
  const warningText  = isClothing
    ? d.judgeCriteria
    : '수리하거나 기부할 수 있다면 자원을 더 오래 쓸 수 있어요.';
  const footerNote   = isClothing
    ? '※ 지자체·수거함·업체마다 수거 품목이 다를 수 있으니 현장 안내문을 확인하세요.'
    : null;

  if (isClothing) {
    return resultLayout(
      ROUTE_LABELS.recycle,
      `${state.condition} — 분리 배출해 주세요.`,
      `<div class="info-box warn-box">
        <p class="info-box-title">${warningTitle}</p>
        <p class="info-box-text">${warningText}</p>
      </div>
      <div class="section-title" style="margin-top:4px;">버리는 방법</div>
      ${renderClothingWasteBody()}`,
      footerNote
    );
  }

  const menuCards = d.sections.map((sec) => {
    const onclick = sec.key === 'disassemble'
      ? `openRepairModal('녹슴·곰팡이')`
      : `showDetail('${sec.key}')`;
    return `
    <button class="menu-card" onclick="${onclick}">
      <span class="menu-icon">${sec.icon}</span>
      <div class="menu-text">
        <span class="menu-title">${sec.title}</span>
        <span class="menu-desc">${sec.desc}</span>
      </div>
      <span class="menu-arrow">›</span>
    </button>
    `;
  }).join('');

  return resultLayout(
    ROUTE_LABELS.recycle,
    `${state.condition} — 분리 배출해 주세요.`,
    `<div class="info-box warn-box">
      <p class="info-box-title">${warningTitle}</p>
      <p class="info-box-text">${warningText}</p>
    </div>
    <div class="section-title" style="margin-top:4px;">버리는 방법</div>
    <div class="menu-list">${menuCards}</div>
    ${renderUmbrellaDisposalGuide()}`,
    footerNote
  );
}

/* ── 결과: recycle 세부 화면 (우산) ── */

function renderUmbrellaBins() {
  const d = DISPOSAL.umbrella;
  const materialsHtml = d.materials.map((m) => `
    <tr>
      <td class="mat-part">${m.part}</td>
      <td class="mat-bin">${m.bin}</td>
    </tr>
  `).join('');
  const exceptionsHtml = d.exceptions.map((e) => `<li>${e}</li>`).join('');

  return detailLayout('어디에 버릴까', `
    <div class="content-section">
      <h2 class="section-title">재질별 배출</h2>
      <table class="mat-table">
        <thead><tr><th>부품</th><th>배출함</th></tr></thead>
        <tbody>${materialsHtml}</tbody>
      </table>
    </div>
    <div class="content-section">
      <h2 class="section-title">예외 안내</h2>
      <ul class="exception-list">${exceptionsHtml}</ul>
    </div>
  `);
}

/* ── 결과: recycle 세부 화면 (의류) ── */

function renderClothingWasteBody() {
  const d = DISPOSAL.clothing;
  const generalHtml  = d.generalWaste.items.map((i) => `<li>${i}</li>`).join('');
  const bulkyHtml    = d.bulkyWaste.items.map((i) => `<li>${i}</li>`).join('');
  const doNotPutHtml = d.doNotPutInBin.map((i) => `<li>${i}</li>`).join('');
  return `
    <div class="content-section">
      <h2 class="section-title">${d.generalWaste.title}</h2>
      <ul class="disposal-list">${generalHtml}</ul>
    </div>
    <div class="content-section">
      <h2 class="section-title">${d.bulkyWaste.title}</h2>
      <ul class="disposal-list">${bulkyHtml}</ul>
    </div>
    <div class="info-box safety-box">
      <p class="info-box-title">⚠ 의류수거함에 넣으면 안 되는 것</p>
      <ul class="donotput-list">${doNotPutHtml}</ul>
    </div>
  `;
}

function renderClothingWaste() {
  return detailLayout('못 쓰는 건 어떻게', renderClothingWasteBody());
}

/* ── 결과: recycle 세부 화면 (공통 지도) ── */

function renderRecycleMap() {
  const d = DISPOSAL[state.item];
  const sec = d.sections.find((s) => s.key === 'map');
  const title = sec ? sec.title : '근처 거점';
  const matched = getMatchedCenters();
  const hasCoords = matched.some((c) => c.lat && c.lng);

  return detailLayout(title, `
    ${hasCoords ? '<div id="center-map" class="center-map"></div>' : ''}
    <div class="content-section">
      <h2 class="section-title">목록</h2>
      ${renderCenterList(matched)}
    </div>
    ${centerActionButtons()}
  `);
}

function initMapIfPresent() {
  const mapEl = document.getElementById('center-map');
  if (!mapEl || typeof L === 'undefined') return;
  if (mapEl._leaflet_id) return; // 이미 초기화됨

  const matched = getMatchedCenters();
  const coords  = matched.filter((c) => c.lat && c.lng && !isNaN(Number(c.lat)));
  if (coords.length === 0) return;

  const avgLat = coords.reduce((s, c) => s + Number(c.lat), 0) / coords.length;
  const avgLng = coords.reduce((s, c) => s + Number(c.lng), 0) / coords.length;

  const map = L.map(mapEl, { scrollWheelZoom: false }).setView([avgLat, avgLng], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>',
    maxZoom: 18,
  }).addTo(map);

  coords.forEach((c) => {
    L.marker([Number(c.lat), Number(c.lng)], { icon: makeMarkerIcon(c.origin) })
      .addTo(map)
      .bindPopup(centerPopupHtml(c), { minWidth: 160 });
  });
}

/* ── 결과: recycle 분기 ── */

function renderRecycleDetail(key) {
  if (state.item === 'umbrella') {
    if (key === 'bins') return renderUmbrellaBins();
  }
  if (state.item === 'clothing') {
    if (key === 'waste') return renderClothingWaste();
  }
  return renderRecycleHub();
}

function renderRecycle() {
  const view = state.resultView || 'hub';
  if (view === 'hub') return renderRecycleHub();
  return renderRecycleDetail(view);
}

/* ── 수선 가이드 모달 ── */

const REPAIR_GUIDE_MAP = {
  '단추 떨어짐':  { key: 'button', title: '단추 달기 가이드',    count: 7,
    refVideoUrl: 'https://youtu.be/mQSxIOUVcGw?si=4EZ0LzAbUPKNhFiq' },
  '솔기 터짐':    { key: 'seam',   title: '솔기 수선 가이드',    count: 8,
    refVideoUrl: 'http://www.youtube.com/watch?v=xnGwMwmMvno' },
  '기장·품 수선': { key: 'hem',    title: '기장·품 수선 가이드', count: 7,
    refVideoUrl: 'https://youtu.be/2TqgGJUhlnY?si=j60Q_HpbXEcZ8N__' },
  '지퍼 고장':    { key: 'zipper', title: '지퍼 수리 가이드',    tabs: [
    { id: '1탄', label: '1탄', count: 6, refVideoUrl: 'https://youtu.be/vXtr1SdeKmk?si=ArjyJvEFPhFmw2sK' },
    { id: '2탄', label: '2탄', count: 5, refVideoUrl: 'https://youtu.be/vXtr1SdeKmk?si=ArjyJvEFPhFmw2sK' },
    { id: '3탄', label: '3탄', count: 7, refVideoUrl: 'https://youtu.be/vXtr1SdeKmk?si=ArjyJvEFPhFmw2sK' },
  ]},
  '살대·천·손잡이 파손': { key: 'sewing',      title: '바느질로 간단 수선하기', count: 8, folder: 'assets/umbrella-sewing-repair' },
  '녹슴·곰팡이':         { key: 'disassembly', title: '우산 해체 분리수거',      count: 7, folder: 'assets/umbrella-disassembly-recycle' },
};

const _rm = { images: [], idx: 0, touchStartX: 0, refVideoUrl: null };

function _rmGetImages(key, tabId) {
  if (key === 'zipper') {
    const tab = REPAIR_GUIDE_MAP['지퍼 고장'].tabs.find((t) => t.id === tabId);
    if (!tab || tab.count === 0) return [];
    return Array.from({ length: tab.count }, (_, i) =>
      `assets/repair-guide/zipper/${tabId}/${i + 1}.jpg`
    );
  }
  const guide = Object.values(REPAIR_GUIDE_MAP).find((g) => g.key === key);
  if (!guide || !guide.count) return [];
  const folder = guide.folder || `assets/repair-guide/${key}`;
  return Array.from({ length: guide.count }, (_, i) =>
    `${folder}/${i + 1}.jpg`
  );
}

function openRepairModal(condition) {
  const guide = REPAIR_GUIDE_MAP[condition];
  if (!guide) return;
  const isZipper = guide.key === 'zipper';

  document.getElementById('rm-title').textContent = guide.title;

  const tabsEl = document.getElementById('rm-tabs');
  if (isZipper) {
    tabsEl.style.display = '';
    tabsEl.innerHTML = guide.tabs.map((t) => {
      const disabled = t.count === 0;
      const isFirst  = t.id === '1탄';
      return `<button
        class="repair-tab${isFirst ? ' active' : ''}"
        id="rm-tab-${t.id}"
        ${disabled ? 'disabled' : `onclick="switchZipperTab('${t.id}')"`}
        aria-selected="${isFirst}"
      >${t.label}${disabled ? '<span class="repair-tab-badge">준비중</span>' : ''}</button>`;
    }).join('');
    _rmLoad(guide.key, '1탄');
  } else {
    tabsEl.style.display = 'none';
    tabsEl.innerHTML = '';
    _rmLoad(guide.key, null);
  }

  document.getElementById('repair-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  _rmBindTouch();
}

function closeRepairModal() {
  document.getElementById('repair-modal').classList.remove('open');
  document.body.style.overflow = '';
  _rmCloseVideoPopup();
}

function _rmLoad(key, tabId) {
  _rm.images = _rmGetImages(key, tabId);
  _rm.idx = 0;
  if (key === 'zipper') {
    const tab = REPAIR_GUIDE_MAP['지퍼 고장'].tabs.find((t) => t.id === tabId);
    _rm.refVideoUrl = tab ? (tab.refVideoUrl || null) : null;
  } else {
    const guide = Object.values(REPAIR_GUIDE_MAP).find((g) => g.key === key);
    _rm.refVideoUrl = guide ? (guide.refVideoUrl || null) : null;
  }
  _rmRender();
}

function _rmRender() {
  const track = document.getElementById('rm-track');
  const dots  = document.getElementById('rm-dots');
  const count = document.getElementById('rm-count');
  const prev  = document.getElementById('rm-prev');
  const next  = document.getElementById('rm-next');
  if (!track) return;

  const total = _rm.images.length;
  const idx   = _rm.idx;

  _rmCloseVideoPopup();

  track.innerHTML = _rm.images.map((src, i) => {
    const zone = (i === 1 && _rm.refVideoUrl)
      ? `<div class="rm-video-zone" onclick="_rmVideoZoneClick(event)"></div>`
      : '';
    return `<div class="carousel-slide"><div class="carousel-slide-img"><img src="${escHtml(src)}" alt="수선 가이드 ${i + 1}장" loading="lazy" draggable="false">${zone}</div></div>`;
  }).join('');
  track.style.transform = `translateX(-${idx * 100}%)`;

  dots.innerHTML = _rm.images.map((_, i) =>
    `<span class="carousel-dot${i === idx ? ' active' : ''}" onclick="carouselGoTo(${i})"></span>`
  ).join('');

  count.textContent = total > 0 ? `${idx + 1} / ${total}` : '';
  if (prev) prev.disabled = idx === 0;
  if (next) next.disabled = idx === total - 1;
}

function carouselGoTo(i) {
  if (i < 0 || i >= _rm.images.length) return;
  _rm.idx = i;
  _rmRender();
}

function carouselPrev() { carouselGoTo(_rm.idx - 1); }
function carouselNext() { carouselGoTo(_rm.idx + 1); }

function switchZipperTab(tabId) {
  REPAIR_GUIDE_MAP['지퍼 고장'].tabs.forEach((t) => {
    const el = document.getElementById(`rm-tab-${t.id}`);
    if (!el) return;
    const active = t.id === tabId;
    el.classList.toggle('active', active);
    el.setAttribute('aria-selected', active);
  });
  _rmLoad('zipper', tabId);
}

function _rmVideoZoneClick(e) {
  const popup = document.getElementById('rm-video-popup');
  if (!popup) return;
  if (popup.classList.contains('open')) { _rmCloseVideoPopup(); return; }

  const wrap = document.getElementById('rm-carousel-wrap');
  if (!wrap || !_rm.refVideoUrl) return;

  // 탭/클릭 지점을 wrap 기준 좌표로 변환
  const wrapRect = wrap.getBoundingClientRect();
  const clickY = e.clientY - wrapRect.top;
  const clickX = e.clientX - wrapRect.left;

  // 팝업 크기 측정 (일시적으로 보이지 않게 표시)
  popup.innerHTML = `<a href="${escHtml(_rm.refVideoUrl)}" target="_blank" rel="noopener noreferrer" class="rm-video-popup-link">▶ 참고 영상 보러가기</a>`;
  popup.classList.remove('arrow-up');
  popup.style.visibility = 'hidden';
  popup.style.top = '0';
  popup.style.left = '0';
  popup.style.bottom = 'auto';
  popup.style.transform = 'none';
  popup.classList.add('open');

  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;
  const OFFSET = 12;
  const PAD    = 8;

  // 수평: 탭 지점 중앙 정렬, wrap 안에 클램프
  let left = clickX - pw / 2;
  left = Math.max(PAD, Math.min(wrapRect.width - pw - PAD, left));

  // 수직: 탭 지점 위에 기본 배치, 공간 부족 시 아래 배치
  let top = clickY - ph - OFFSET;
  if (top < PAD) {
    top = clickY + OFFSET;
    popup.classList.add('arrow-up');
  }
  top = Math.max(PAD, Math.min(wrapRect.height - ph - PAD, top));

  popup.style.top  = top  + 'px';
  popup.style.left = left + 'px';
  popup.style.visibility = '';
}

function _rmCloseVideoPopup() {
  const popup = document.getElementById('rm-video-popup');
  if (popup) popup.classList.remove('open', 'arrow-up');
}

function _rmBindTouch() {
  const wrap = document.getElementById('rm-carousel-wrap');
  if (!wrap || wrap._rmTouchBound) return;
  wrap._rmTouchBound = true;
  wrap.addEventListener('touchstart', (e) => {
    _rm.touchStartX = e.touches[0].clientX;
  }, { passive: true });
  wrap.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - _rm.touchStartX;
    if (Math.abs(dx) > 40) { if (dx < 0) carouselNext(); else carouselPrev(); }
  }, { passive: true });
}

/* ── 빈 핸들러 (추후 연결) ── */

function onRepairDonateClick() { /* 추후 연결 */ }
function onMapClick()          { /* 추후 연결 */ }

/* ── renderResult: route에 따라 분기 ── */

function renderResult() {
  if (!state.route) {
    return `
      <div class="screen">
        ${renderBackButton()}
        <h1 class="screen-title">결과</h1>
        <p class="notice">진단을 먼저 진행해 주세요.</p>
        <button class="btn-primary" onclick="navigate('itemSelect')">진단 시작</button>
      </div>
    `;
  }

  switch (state.route) {
    case 'self':    return renderSelf();
    case 'pro':     return renderPro();
    case 'reuse':   return renderReuse();
    case 'recycle': return renderRecycle();
    default:        return renderSelf();
  }
}

/* ── 단일 진입점 ── */

function render() {
  const app = document.getElementById('app');
  switch (state.screen) {
    case 'home':             app.innerHTML = renderHome();             break;
    case 'itemSelect':       app.innerHTML = renderItemSelect();       break;
    case 'stateSelect':      app.innerHTML = renderStateSelect();      break;
    case 'clothingCategory': app.innerHTML = renderClothingCategory(); break;
    case 'result':           app.innerHTML = renderResult();           break;
    default:                 app.innerHTML = renderHome();
  }

  // result 화면 벗어나면 이전 차트 소멸
  if (state.screen !== 'result' && co2Chart) {
    co2Chart.destroy();
    co2Chart = null;
  }

  // 지도·차트 초기화 (레이아웃 계산 후 실행)
  requestAnimationFrame(initMapIfPresent);
  requestAnimationFrame(initProReuseMap);
  requestAnimationFrame(initCo2Chart);
}

/* ── 시트 한글값 → 코드 내부값 매핑 ── */

const SHEET_ROUTE_MAP = {
  '자가수리':    'self',
  '전문가수리':  'pro',
  '재사용·기부': 'reuse',
  '재활용·폐기': 'recycle',
};

const SHEET_CATEGORY_MAP = {
  '우산':      'umbrella',
  '의류·가방': 'clothing',
};

function sheetVal(map, raw, field) {
  const key = raw.trim().replace(/\s/g, '');
  if (!key) return '';
  const v = map[key];
  if (v === undefined) console.warn('[centers] 매핑 없음 (' + field + '):', JSON.stringify(raw));
  return v ?? '';
}

/* ── CSV 거점 로더 ── */

async function loadReportCenters() {
  if (typeof reportCsvUrl === 'undefined' || !reportCsvUrl) return [];
  try {
    const res = await fetch(reportCsvUrl);
    if (!res.ok) return [];
    const csv = await res.text();
    const parsed = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^﻿/, '').replace(/\s*\*+\s*$/, '').trim(),
    });
    const col = (row, key) =>
      (row[key] ?? row['﻿' + key] ?? '').toString().trim();
    return parsed.data
      .filter((row) => {
        const name = col(row, '기관·거점명');
        return name && !name.includes('예시') && !name.includes('(예시)');
      })
      .map((row) => ({
        name:       col(row, '기관·거점명'),
        category:   sheetVal(SHEET_CATEGORY_MAP, col(row, '카테고리'), '카테고리'),
        centerType: col(row, '거점유형'),
        route:      sheetVal(SHEET_ROUTE_MAP, col(row, '경로유형'), '경로유형'),
        address:    col(row, '도로명주소'),
        detail:     col(row, '상세 위치'),
        lat:        parseFloat(col(row, '위도'))  || null,
        lng:        parseFloat(col(row, '경도'))  || null,
        hours:      col(row, '운영시간'),
        phone:      col(row, '연락처'),
        items:      col(row, '취급·수리 가능 항목')
                      .split(',').map((s) => sheetVal(SHEET_CATEGORY_MAP, s.trim(), '카테고리')).filter(Boolean),
        note:       col(row, '이용조건·비고'),
        source:     col(row, '출처유형'),
        sourceUrl:  col(row, '출처 링크/메모'),
        checkedAt:  col(row, '확인일'),
        origin:     'report',
      }));
  } catch {
    return [];
  }
}

async function loadCenters() {
  if (typeof sheetCsvUrl === 'undefined' || !sheetCsvUrl) {
    liveCenters = [...centers]; // data.js 그대로 사용
    return;
  }

  try {
    const res = await fetch(sheetCsvUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();

    const parsed = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^﻿/, '').replace(/\s*\*+\s*$/, '').trim(),
    });

    // BOM 제거 헬퍼 (구글 시트 CSV 첫 헤더에 BOM이 붙는 경우 대응)
    const col = (row, key) =>
      (row[key] ?? row['﻿' + key] ?? '').toString().trim();

    const confirmed = parsed.data
      .filter((row) => {
        const name = col(row, '기관·거점명');
        return name && !name.includes('예시') && !name.includes('(예시)');
      })
      .map((row) => ({
        name:       col(row, '기관·거점명'),
        category:   sheetVal(SHEET_CATEGORY_MAP, col(row, '카테고리'), '카테고리'),
        centerType: col(row, '거점유형'),
        route:      sheetVal(SHEET_ROUTE_MAP, col(row, '경로유형'), '경로유형'),
        address:    col(row, '도로명주소'),
        detail:     col(row, '상세 위치'),
        lat:        parseFloat(col(row, '위도'))  || null,
        lng:        parseFloat(col(row, '경도'))  || null,
        hours:      col(row, '운영시간'),
        phone:      col(row, '연락처'),
        items:      col(row, '취급·수리 가능 항목')
                      .split(',').map((s) => sheetVal(SHEET_CATEGORY_MAP, s.trim(), '카테고리')).filter(Boolean),
        note:       col(row, '이용조건·비고'),
        source:     col(row, '출처유형'),
        sourceUrl:  col(row, '출처 링크/메모'),
        checkedAt:  col(row, '확인일'),
        origin:     'confirmed',
      }));

    const reported = await loadReportCenters();
    liveCenters = [...confirmed, ...reported];
  } catch (err) {
    console.warn('[loadCenters] CSV 로드 실패 → data.js centers 사용:', err);
    liveCenters = [...centers]; // data.js 폴백
  }

  // 결과 화면이 열려 있으면 다시 그림
  if (state.screen === 'result') render();
}

render();

// 헤더·푸터 로고는 화면 전환과 무관하게 한 번만 채움
(function initGlobalLogos() {
  const hl = document.getElementById('g-header-logos');
  const fl = document.getElementById('g-footer-logos');
  if (hl) hl.innerHTML = logoLockup();
  if (fl) fl.innerHTML = logoLockup();
}());

// 앱 시작 시 CSV 비동기 로드 (결과 화면 렌더 전에 완료되면 best effort)
loadCenters();
