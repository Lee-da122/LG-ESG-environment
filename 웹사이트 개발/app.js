const state = {
  screen: 'home',
  item: null,
  condition: null,
  route: null,
  resultView: 'hub',   // 'hub' | detail key (result 내부 화면)
};

/* ── 이동 기록 ── */

const history = [];

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
    </div>
  `;
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
      navigate('result');
      return;
    }
  }

  // 분류 실패 → 인라인 안내 (직접 선택 유도)
  if (statusEl) {
    statusEl.textContent = '정확히 인식하지 못했어요. 아래에서 직접 선택해 주세요.';
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

function selectCondition(idx) {
  const itemData = ITEMS.find((i) => i.id === state.item);
  const cond = itemData.conditions[idx];
  state.condition = cond.label;
  state.route = cond.route;
  state.resultView = 'hub';   // result 진입 시 항상 허브로
  navigate('result');
}

/* ── 결과: 공통 레이아웃 헬퍼 ── */

function resultLayout(badge, verdictText, bodyHtml, footerNote) {
  const note = footerNote || '※ 지역마다 분리수거 규정이 다를 수 있습니다. OO구 기준 · 확인일 미정';
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
      <p class="footer-note">${note}</p>
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

function getMatchedCenters() {
  const itemData = ITEMS.find((i) => i.id === state.item);
  const itemLabel = itemData ? itemData.label : '';
  return centers.filter((c) =>
    c.route === state.route &&
    (c.items.length === 0 || c.items.includes(itemLabel))
  );
}

function renderCenterList(matched) {
  if (matched.length === 0) {
    return '<p class="empty-state">거점 정보 준비 중</p>';
  }
  return `
    <ul class="center-list">
      ${matched.map((c) => `
        <li class="center-item">
          <div class="center-top">
            <span class="center-name">${c.name}</span>
            <span class="center-type-badge">${c.centerType}</span>
          </div>
          <p class="center-addr">${c.address}</p>
          ${c.hours ? `<p class="center-detail">${c.hours}</p>` : ''}
          ${c.phone ? `<p class="center-detail">${c.phone}</p>` : ''}
          ${c.note  ? `<p class="center-note">${c.note}</p>`   : ''}
        </li>
      `).join('')}
    </ul>
  `;
}

/* ── 결과: self / pro / reuse ── */

function renderSelf() {
  const guide = repairGuides.find(
    (g) => g.item === state.item && g.state === state.condition
  );

  let guideContent;
  if (!guide) {
    guideContent = '<p class="empty-state">수리 방법 준비 중</p>';
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
    </div>`
  );
}

function renderPro() {
  return resultLayout(
    ROUTE_LABELS.pro,
    `${state.condition} — 수리 전문점에 맡겨 보세요.`,
    `<div class="content-section">
      <h2 class="section-title">수리 안내</h2>
      <p class="empty-state">내용 준비 중</p>
    </div>
    <div class="content-section">
      <h2 class="section-title">근처 거점</h2>
      ${renderCenterList(getMatchedCenters())}
    </div>`
  );
}

function renderReuse() {
  return resultLayout(
    ROUTE_LABELS.reuse,
    `${state.condition} — 기부처에 전달해 주세요.`,
    `<div class="content-section">
      <h2 class="section-title">기부 안내</h2>
      <p class="empty-state">내용 준비 중</p>
    </div>
    <div class="content-section">
      <h2 class="section-title">근처 거점</h2>
      ${renderCenterList(getMatchedCenters())}
    </div>`
  );
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
    : '※ 지역마다 분리수거 규정이 다를 수 있습니다. OO구 기준 · 확인일 미정';

  const menuCards = d.sections.map((sec) => `
    <button class="menu-card" onclick="showDetail('${sec.key}')">
      <span class="menu-icon">${sec.icon}</span>
      <div class="menu-text">
        <span class="menu-title">${sec.title}</span>
        <span class="menu-desc">${sec.desc}</span>
      </div>
      <span class="menu-arrow">›</span>
    </button>
  `).join('');

  return resultLayout(
    ROUTE_LABELS.recycle,
    `${state.condition} — 분리 배출해 주세요.`,
    `<div class="info-box warn-box">
      <p class="info-box-title">${warningTitle}</p>
      <p class="info-box-text">${warningText}</p>
    </div>
    <div class="section-title" style="margin-top:4px;">버리는 방법</div>
    <div class="menu-list">${menuCards}</div>`,
    footerNote
  );
}

/* ── 결과: recycle 세부 화면 (우산) ── */

function renderUmbrellaDisassemble() {
  const d = DISPOSAL.umbrella;
  const stepsHtml = d.steps.map((s, i) => `
    <li class="step-item">
      <span class="step-num">${i + 1}</span>
      <span class="step-text"><strong>${s.text}</strong> — ${s.detail}</span>
    </li>
  `).join('');

  return detailLayout('분해하기', `
    <div class="content-section">
      <h2 class="section-title">분해 5단계</h2>
      <ol class="step-list">${stepsHtml}</ol>
    </div>
    <div class="info-box safety-box">
      <p class="info-box-title">⚠ 안전 주의</p>
      <p class="info-box-text">일부 우산 살대에는 유리섬유가 포함되어 있어 손에 박힐 수 있습니다. 목장갑을 끼고 가위를 사용하세요.</p>
    </div>
    <button class="btn-next" onclick="showDetail('bins')">다음: 어디에 버릴까 →</button>
  `);
}

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

function renderClothingCollection() {
  const d = DISPOSAL.clothing;
  const itemsHtml = d.collectionBin.items.map((i) => `<li>${i}</li>`).join('');

  return detailLayout('수거함에 넣어도 될까', `
    <div class="info-box warn-box">
      <p class="info-box-title">판단 기준</p>
      <p class="info-box-text">${d.judgeCriteria}</p>
    </div>
    <div class="content-section">
      <h2 class="section-title">${d.collectionBin.title}</h2>
      <ul class="disposal-list">${itemsHtml}</ul>
      <p class="disposal-caution">${d.collectionBin.caution}</p>
    </div>
  `);
}

function renderClothingWaste() {
  const d = DISPOSAL.clothing;
  const generalHtml  = d.generalWaste.items.map((i) => `<li>${i}</li>`).join('');
  const bulkyHtml    = d.bulkyWaste.items.map((i) => `<li>${i}</li>`).join('');
  const doNotPutHtml = d.doNotPutInBin.map((i) => `<li>${i}</li>`).join('');

  return detailLayout('못 쓰는 건 어떻게', `
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
  `);
}

/* ── 결과: recycle 세부 화면 (공통 지도) ── */

function renderRecycleMap() {
  const d = DISPOSAL[state.item];
  const sec = d.sections.find((s) => s.key === 'map');
  const title = sec ? sec.title : '근처 거점';

  return detailLayout(title, `
    <div class="content-section">
      <h2 class="section-title">근처 거점</h2>
      ${renderCenterList(getMatchedCenters())}
    </div>
  `);
}

/* ── 결과: recycle 분기 ── */

function renderRecycleDetail(key) {
  if (state.item === 'umbrella') {
    switch (key) {
      case 'disassemble': return renderUmbrellaDisassemble();
      case 'bins':        return renderUmbrellaBins();
      case 'map':         return renderRecycleMap();
    }
  }
  if (state.item === 'clothing') {
    switch (key) {
      case 'collection': return renderClothingCollection();
      case 'waste':      return renderClothingWaste();
      case 'map':        return renderRecycleMap();
    }
  }
  return renderRecycleHub();
}

function renderRecycle() {
  const view = state.resultView || 'hub';
  if (view === 'hub') return renderRecycleHub();
  return renderRecycleDetail(view);
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
    case 'home':        app.innerHTML = renderHome();        break;
    case 'itemSelect':  app.innerHTML = renderItemSelect();  break;
    case 'stateSelect': app.innerHTML = renderStateSelect(); break;
    case 'result':      app.innerHTML = renderResult();      break;
    default:            app.innerHTML = renderHome();
  }
}

render();

// 헤더·푸터 로고는 화면 전환과 무관하게 한 번만 채움
(function initGlobalLogos() {
  const hl = document.getElementById('g-header-logos');
  const fl = document.getElementById('g-footer-logos');
  if (hl) hl.innerHTML = logoLockup();
  if (fl) fl.innerHTML = logoLockup();
}());
