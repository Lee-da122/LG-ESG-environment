const ITEMS = [
  {
    id: 'umbrella',
    label: '우산',
    // ⚠️ TEMP: 임시 추정값(출처 미확정). KEITI 에코스퀘어로 교체 예정.
    co2: { productionKg: 3.0, source: null },
    conditions: [
      { label: '살대 휨',              route: 'pro',
        conditions: ['살대가 휘었어요', '우산살이 휘었어요', '살이 구부러졌어요', '프레임이 휘었어요'] },
      { label: '천 찢어짐',            route: 'self',
        conditions: ['천이 찢어졌어요', '우산 천에 구멍났어요', '원단이 뜯어졌어요', '천이 터졌어요'] },
      { label: '손잡이 빠짐',          route: 'pro',
        conditions: ['손잡이가 빠졌어요', '손잡이가 망가졌어요', '손잡이가 부러졌어요', '손잡이가 헐거워요', '손잡이가 흔들려요', '손잡이 고장났어요'] },
      { label: '녹슴·곰팡이',          route: 'recycle',
        conditions: ['녹슬었어요', '곰팡이가 폈어요', '곰팡이 냄새나요', '살대에 녹이 슬었어요'] },
      { label: '살대 망가짐 (천 멀쩡)', route: 'reuse',
        conditions: ['살대가 부러졌어요', '우산살이 부러졌어요', '살대는 망가졌는데 천은 멀쩡해요', '뼈대가 부서졌어요'] },
    ],
  },
  {
    id: 'clothing',
    label: '의류·가방',
    // ⚠️ TEMP: 임시 추정값(출처 미확정). KEITI 에코스퀘어로 교체 예정.
    co2: { productionKg: 8.0, source: null },
    conditions: [
      { label: '단추 떨어짐',       route: 'self' },
      { label: '솔기 터짐',         route: 'self' },
      { label: '지퍼 고장',         route: 'pro' },
      { label: '기장·품 수선',      route: 'pro' },
      { label: '멀쩡하지만 안 입음', route: 'reuse' },
      { label: '오염·훼손 심함',    route: 'recycle' },
    ],
  },
];

const ROUTE_LABELS = {
  self: '자가 수리',
  pro: '전문가 수리',
  reuse: '재사용·기부',
  recycle: '재활용·폐기',
};

/* ────────────────────────────────────────────
   수리 가이드
   각 항목 형태:
   {
     item:       'umbrella' | 'clothing',   // ITEMS[].id
     state:      '천 찢어짐',               // conditions[].label 과 일치
     title:      '우산 천 바느질 수리',
     type:       'youtube' | 'cardnews',
     youtubeUrl: 'https://www.youtube.com/embed/VIDEO_ID',
     cardImages: [],                        // type === 'cardnews' 일 때 이미지 URL 배열
     cautions:   ['바늘에 찔리지 않도록 주의하세요.'],
   }
──────────────────────────────────────────── */
const repairGuides = [
  // {
  //   item: 'umbrella',
  //   state: '천 찢어짐',
  //   title: '우산 천 바느질 수리',
  //   type: 'youtube',
  //   youtubeUrl: 'https://www.youtube.com/embed/VIDEO_ID',
  //   cardImages: [],
  //   cautions: ['바늘에 찔리지 않도록 주의하세요.'],
  // },
];

/* ────────────────────────────────────────────
   거점 정보 (엑셀 수집 양식과 동일 필드)
   각 항목 형태:
   {
     name:       'OO구 우산 수리 센터',
     category:   '우산',          // 품목 분류 (ITEMS[].label 과 일치)
     centerType: '수리',          // '수리' | '기부' | '재활용' | '수거'
     route:      'pro',           // ROUTE_LABELS 키와 일치
     address:    'OO시 OO구 OO동 123',
     lat:        37.5665,
     lng:        126.9780,
     hours:      '평일 09:00–18:00',
     phone:      '02-1234-5678',
     items:      ['우산'],        // 접수 가능 품목 (빈 배열 = 품목 무관)
     note:       '방문 전 전화 확인 필요',
     source:     'OO구청',
     sourceUrl:  'https://example.com',
     checkedAt:  '2025-01-01',
   }
──────────────────────────────────────────── */
const centers = [
  // {
  //   name: 'OO구 우산 수리 센터',
  //   category: '우산',
  //   centerType: '수리',
  //   route: 'pro',
  //   address: 'OO시 OO구 OO동 123',
  //   lat: 37.5665,
  //   lng: 126.9780,
  //   hours: '평일 09:00–18:00',
  //   phone: '02-1234-5678',
  //   items: ['우산'],
  //   note: '방문 전 전화 확인 필요',
  //   source: 'OO구청',
  //   sourceUrl: 'https://example.com',
  //   checkedAt: '2025-01-01',
  // },
];

const DISPOSAL = {
  umbrella: {
    steps: [
      { text: '실 제거',           detail: '천과 살대를 연결하는 실을 가위로 끊는다.' },
      { text: '손잡이·꼭지 분리',  detail: '돌리거나 잡아당겨 분리한다.' },
      { text: '천 끝 금속 팁 제거', detail: '살대 끝의 작은 금속 팁을 펜치로 뺀다.' },
      { text: '살대 끈으로 묶기',  detail: '흩어지지 않게 묶어 수거자 안전을 배려한다.' },
      { text: '재질별 배출',        detail: '아래 재질별 배출 기준을 참고한다.' },
    ],
    materials: [
      { part: '천 (합성섬유)',    bin: '종량제 봉투' },
      { part: '살대·우산대 (철)', bin: '고철·캔류 분리수거' },
      { part: '손잡이·꼭지',      bin: '플라스틱 분리수거' },
      { part: '비닐우산 천',      bin: '비닐류 분리수거' },
    ],
    exceptions: [
      '분리가 어려우면 통째로 고철 수거함에 배출 가능.',
      '분해가 힘들면 종량제 봉투에 넣어 배출.',
      '종량제 봉투보다 크면 대형생활폐기물 신고 후 배출.',
    ],
    sections: [
      { key: 'disassemble', icon: '🔧', title: '분해하기',           desc: '5단계로 안전하게' },
      { key: 'bins',        icon: '♻️',  title: '어디에 버릴까',      desc: '재질별 배출 기준' },
      { key: 'map',         icon: '📍', title: '근처 배출처·신고처', desc: '지도에서 보기' },
    ],
  },

  clothing: {
    judgeCriteria: '다른 사람이 다시 입거나 쓸 수 있는 상태인가? 그렇다면 수거함·기부, 아니라면 폐기합니다.',

    collectionBin: {
      title: '의류수거함 (재사용)',
      items: [
        '깨끗하고 마른 옷',
        '두 짝 다 있고 다시 신을 수 있는 신발',
        '파손·곰팡이 없는 가방',
      ],
      caution: '젖지 않게 배출하세요.',
    },

    generalWaste: {
      title: '종량제 봉투 (또는 지자체 특수마대)',
      items: [
        '오염·젖음·곰팡이·심하게 찢어진 옷',
        '속옷·양말',
      ],
    },

    bulkyWaste: {
      title: '대형폐기물 신고',
      items: [
        '솜이불·베개·방석·쿠션',
        '캐리어',
        '큰 인형 등 부피가 크거나 충전재가 든 것',
      ],
    },

    doNotPutInBin: [
      '오염·젖은·곰팡이 옷',
      '솜이불·베개·방석·라텍스',
      '큰 인형',
      '바퀴 달린 가방 (캐리어)',
      '슬리퍼·장화·고무신·바닥 부서진 신발',
      '속옷·양말 (지자체별 상이)',
    ],
    sections: [
      { key: 'collection', icon: '👕', title: '수거함에 넣어도 될까', desc: '재사용 가능 여부' },
      { key: 'waste',      icon: '🗑️', title: '못 쓰는 건 어떻게',   desc: '종량제·대형폐기물' },
      { key: 'map',        icon: '📍', title: '근처 수거함·기부처',  desc: '지도에서 보기' },
    ],
  },
};
