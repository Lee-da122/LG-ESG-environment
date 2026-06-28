const state = {
  screen: 'home',
  item: null,
  condition: null,
  route: null,
  resultView: 'hub',   // 'hub' | detail key (result 내부 화면)
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

  // 분류 실패 → 서버 메시지 우선, 없으면 기본 안내
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
  const source = liveCenters !== null ? liveCenters : centers;
  const itemData = ITEMS.find((i) => i.id === state.item);
  const itemLabel = itemData ? itemData.label : '';
  // TODO: 확인 후 제거
  console.log('[match] 조건: 품목=%s itemLabel=%s 경로=%s', state.item, itemLabel, state.route);
  const matched = source.filter((c) => {
    if (c.route !== state.route) return false;
    const categoryOk = !c.category || c.category === state.item;
    const itemsOk    = !c.items || c.items.length === 0 || c.items.includes(state.item);
    return categoryOk && itemsOk;
  });
  // TODO: 확인 후 제거
  console.log('[match] 매칭 결과:', matched.length);
  if (matched.length === 0 && source.length > 0) {
    console.log('[match] 불일치 샘플 — 시트값 category=%o route=%o vs 기대 category=%s route=%s',
      source[0].category, source[0].route, itemLabel, state.route);
  }
  return matched;
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
            <span class="center-name">${c.name}</span>
            <span class="center-type-badge">${c.centerType}</span>
          </div>
          <p class="center-addr">${c.address}</p>
          ${c.detail ? `<p class="center-loc">${c.detail}</p>` : ''}
          ${c.hours  ? `<p class="center-detail">${c.hours}</p>` : ''}
          ${c.phone  ? `<p class="center-detail">${c.phone}</p>` : ''}
          ${c.note   ? `<p class="center-note">${c.note}</p>`    : ''}
        </li>
      `).join('')}
    </ul>
  `;
}

/* ── CO₂ 그래프: 헬퍼 & 렌더 ── */

function calcCo2(productionKg, months, freqPerWeek, moreMonths) {
  const WEEKS_PER_MONTH = 4.345;
  const usesNow    = Math.max(1, Math.round(freqPerWeek * months * WEEKS_PER_MONTH));
  const usesFuture = Math.max(1, Math.round(freqPerWeek * (months + moreMonths) * WEEKS_PER_MONTH));
  const perNow     = Math.round((productionKg * 1000) / usesNow);
  const perFuture  = Math.round((productionKg * 1000) / usesFuture);
  return { usesNow, usesFuture, perNow, perFuture };
}

function renderCo2Graph() {
  if (state.route !== 'pro' && state.route !== 'self') return '';
  const itemData = ITEMS.find((i) => i.id === state.item);
  if (!itemData || !itemData.co2 || !itemData.co2.productionKg) return '';

  return `
    <div class="content-section">
      <h2 class="section-title">수리할수록 줄어드는 탄소 발자국</h2>
      <div class="co2-sliders">
        <div class="co2-slider-row">
          <label>산 지 <strong id="co2-months-val">12</strong>개월</label>
          <input type="range" id="co2-months" min="1" max="120" value="12" />
        </div>
        <div class="co2-slider-row">
          <label>주당 <strong id="co2-freq-val">3</strong>회 사용</label>
          <input type="range" id="co2-freq" min="1" max="14" value="3" />
        </div>
        <div class="co2-slider-row">
          <label>앞으로 <strong id="co2-more-val">12</strong>개월 더 사용</label>
          <input type="range" id="co2-more" min="1" max="60" value="12" />
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
      <p class="co2-note">※ 임시 추정치 · 출처 미확정 (KEITI 에코스퀘어 교체 예정)</p>
    </div>
  `;
}

function initCo2Chart() {
  const canvas = document.getElementById('co2-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const itemData = ITEMS.find((i) => i.id === state.item);
  const productionKg = itemData && itemData.co2 && itemData.co2.productionKg;
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
      pts.push({ x, y: Math.round(productionKg * 1000 / x) });
    }
    return pts;
  }

  function updateChart() {
    const months = parseInt(document.getElementById('co2-months').value);
    const freq   = parseInt(document.getElementById('co2-freq').value);
    const more   = parseInt(document.getElementById('co2-more').value);

    document.getElementById('co2-months-val').textContent = months;
    document.getElementById('co2-freq-val').textContent   = freq;
    document.getElementById('co2-more-val').textContent   = more;

    const { usesNow, usesFuture, perNow, perFuture } = calcCo2(productionKg, months, freq, more);
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

  const initMonths = 12, initFreq = 3, initMore = 12;
  const { usesNow, usesFuture, perNow, perFuture } = calcCo2(productionKg, initMonths, initFreq, initMore);
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
              `${ctx.dataset.label}: ${ctx.parsed.y}g CO₂ (${ctx.parsed.x}회 사용)`,
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
    </div>
    ${renderCo2Graph()}`
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
    </div>
    ${renderCo2Graph()}`
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
  const matched = getMatchedCenters();
  const hasCoords = matched.some((c) => c.lat && c.lng);

  return detailLayout(title, `
    ${hasCoords ? '<div id="center-map" class="center-map"></div>' : ''}
    <div class="content-section">
      <h2 class="section-title">목록</h2>
      ${renderCenterList(matched)}
    </div>
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
    const lines = [
      `<strong>${c.name}</strong>`,
      c.address,
      c.detail,
      c.hours,
    ].filter(Boolean).join('<br>');
    L.marker([Number(c.lat), Number(c.lng)]).addTo(map).bindPopup(lines);
  });
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

  // result 화면 벗어나면 이전 차트 소멸
  if (state.screen !== 'result' && co2Chart) {
    co2Chart.destroy();
    co2Chart = null;
  }

  // 지도·차트 초기화 (레이아웃 계산 후 실행)
  requestAnimationFrame(initMapIfPresent);
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

async function loadCenters() {
  if (typeof sheetCsvUrl === 'undefined' || !sheetCsvUrl) {
    liveCenters = [...centers]; // data.js 그대로 사용
    return;
  }

  try {
    const res = await fetch(sheetCsvUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    // TODO: 확인 후 제거
    console.log('[centers] fetch status:', res.status, 'text 길이:', csv.length, '앞 200자:', csv.slice(0, 200));

    const parsed = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^﻿/, '').replace(/\s*\*+\s*$/, '').trim(),
    });
    // TODO: 확인 후 제거
    console.log('[centers] 파싱 행:', parsed.data.length, '헤더:', parsed.meta.fields);
    console.log('[centers] 헤더 원본:', JSON.stringify(parsed.meta.fields));
    console.log('[centers] 첫 행 원본:', JSON.stringify(parsed.data[0]));

    // BOM 제거 헬퍼 (구글 시트 CSV 첫 헤더에 BOM이 붙는 경우 대응)
    const col = (row, key) =>
      (row[key] ?? row['﻿' + key] ?? '').toString().trim();

    // TODO: 확인 후 제거 — 필터 통과 여부 확인
    var _debugCount = 0;
    liveCenters = parsed.data
      .filter((row) => {
        const name = col(row, '기관·거점명');
        const pass = !!(name && !name.includes('예시') && !name.includes('(예시)'));
        if (_debugCount < 3) {
          console.log('[centers] filter #' + _debugCount + ' name=' + JSON.stringify(name) + ' pass=' + pass);
          _debugCount++;
        }
        return pass;
      })
      .map((row, i) => {
        const rawLat = col(row, '위도');
        const rawLng = col(row, '경도');
        const lat = parseFloat(rawLat) || null;
        const lng = parseFloat(rawLng) || null;
        if (i < 3) {
          console.log('[centers] 변환 시도 #' + i + ': 위도=' + JSON.stringify(rawLat) + ' 경도=' + JSON.stringify(rawLng) + ' → lat=' + lat + ' lng=' + lng);
        }
        return {
          name:       col(row, '기관·거점명'),
          category:   sheetVal(SHEET_CATEGORY_MAP, col(row, '카테고리'), '카테고리'),
          centerType: col(row, '거점유형'),
          route:      sheetVal(SHEET_ROUTE_MAP, col(row, '경로유형'), '경로유형'),
          address:    col(row, '도로명주소'),
          detail:     col(row, '상세 위치'),
          lat,
          lng,
          hours:      col(row, '운영시간'),
          phone:      col(row, '연락처'),
          items:      col(row, '취급·수리 가능 항목')
                        .split(',').map((s) => sheetVal(SHEET_CATEGORY_MAP, s.trim(), '카테고리')).filter(Boolean),
          note:       col(row, '이용조건·비고'),
          source:     col(row, '출처유형'),
          sourceUrl:  col(row, '출처'),
          checkedAt:  col(row, '확인일'),
        };
      });
    // TODO: 확인 후 제거
    console.log('[centers] 로드:', liveCenters.length, '첫행:', liveCenters[0] ?? null);
  } catch (err) {
    // TODO: 확인 후 제거
    console.warn('[centers] 폴백 — fetch/파싱 오류:', err);
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
