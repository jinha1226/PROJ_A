import type { RelicDef } from '../core/types';

// MVP 유물 40종. 유물 = 기본 역할(수치) + 원소 태그 0~2개 + 팔 유물은 쿨다운 기술 1개.
export const RELICS: RelicDef[] = [
  // ── 몸 (장갑) ──
  { id: 'rusted_cuirass', name: '녹슨 청동 흉갑', slot: 'body', grade: 'common', elements: [], stats: { integrity: 14, burden: 3 } },
  { id: 'bone_plates', name: '뼈 판갑', slot: 'body', grade: 'common', elements: [], stats: { integrity: 10, dodge: 3, burden: 2 } },
  { id: 'brass_ribcage', name: '놋쇠 늑골', slot: 'body', grade: 'common', elements: ['impact'], stats: { integrity: 16, burden: 4 } },
  { id: 'ember_mantle', name: '잿불 망토', slot: 'body', grade: 'common', elements: ['fire'], stats: { integrity: 11, burden: 3 } },
  { id: 'frost_shell', name: '서리 껍질', slot: 'body', grade: 'common', elements: ['cold'], stats: { integrity: 13, burden: 3 } },
  { id: 'storm_coil', name: '폭풍 감은 띠', slot: 'body', grade: 'common', elements: ['lightning'], stats: { integrity: 10, dodge: 2, burden: 2 } },
  { id: 'reliquary_plate', name: '성유물함 갑주', slot: 'body', grade: 'holy', elements: ['fire', 'impact'], stats: { integrity: 22, hp: 6, burden: 5 } },
  { id: 'crystal_carapace', name: '수정 갑각', slot: 'body', grade: 'holy', elements: ['cold', 'lightning'], stats: { integrity: 20, burden: 4 } },
  { id: 'sutured_bulwark', name: '봉합된 성벽', slot: 'body', grade: 'holy', elements: [], stats: { integrity: 26, burden: 6 } },
  { id: 'heretic_hide', name: '이단자의 가죽', slot: 'body', grade: 'forbidden', elements: ['fire', 'cold'], stats: { integrity: 30, hp: 10, burden: 4 }, curse: { text: '매 턴 체력 1% 잃음', kind: 'hpDrain' } },

  // ── 팔 (무기 + 액티브) ──
  { id: 'brass_fist', name: '놋쇠 주먹', slot: 'arm', grade: 'common', elements: ['impact'], stats: { damage: 5, attackCost: 90, burden: 2 }, active: { form: 'dash', element: 'impact', power: 7, cooldown: 7, range: 4 } },
  { id: 'furnace_arm', name: '용광로 팔', slot: 'arm', grade: 'common', elements: ['fire'], stats: { damage: 5, burden: 3 }, active: { form: 'sweep', element: 'fire', power: 6, cooldown: 6 } },
  { id: 'frost_hook', name: '서리 갈고리', slot: 'arm', grade: 'common', elements: ['cold'], stats: { damage: 5, burden: 3 }, active: { form: 'throw', element: 'cold', power: 7, cooldown: 6, range: 6 } },
  { id: 'bell_clapper', name: '종의 추', slot: 'arm', grade: 'common', elements: ['lightning'], stats: { damage: 4, attackCost: 90, burden: 2 }, active: { form: 'bolt', element: 'lightning', power: 7, cooldown: 5, range: 7 } },
  { id: 'bone_sickle', name: '뼈 낫', slot: 'arm', grade: 'common', elements: [], stats: { damage: 7, attackCost: 90, burden: 2 }, active: { form: 'sweep', power: 6, cooldown: 5 } },
  { id: 'censer_flail', name: '향로 도리깨', slot: 'arm', grade: 'common', elements: ['fire'], stats: { damage: 6, attackCost: 110, burden: 3 }, active: { form: 'throw', element: 'fire', power: 8, cooldown: 7, range: 5 } },
  { id: 'icicle_lance', name: '고드름 창', slot: 'arm', grade: 'common', elements: ['cold'], stats: { damage: 6, burden: 3 }, active: { form: 'dash', element: 'cold', power: 7, cooldown: 7, range: 4 } },
  { id: 'rusted_maul', name: '녹슨 망치', slot: 'arm', grade: 'common', elements: ['impact'], stats: { damage: 9, attackCost: 130, burden: 5 }, active: { form: 'nova', element: 'impact', power: 7, cooldown: 8 } },
  { id: 'spark_censer', name: '불꽃 향로', slot: 'arm', grade: 'common', elements: ['lightning'], stats: { damage: 5, burden: 3 }, active: { form: 'sweep', element: 'lightning', power: 6, cooldown: 6 } },
  { id: 'saint_cleaver', name: '성인의 식칼', slot: 'arm', grade: 'holy', elements: ['fire', 'lightning'], stats: { damage: 9, burden: 4 }, active: { form: 'dash', element: 'fire', power: 11, cooldown: 6, range: 5 } },
  { id: 'glacier_reliquary', name: '빙하 성유물', slot: 'arm', grade: 'holy', elements: ['cold'], stats: { damage: 8, burden: 4 }, active: { form: 'nova', element: 'cold', power: 10, cooldown: 7 } },
  { id: 'thunder_rosary', name: '천둥 묵주', slot: 'arm', grade: 'holy', elements: ['lightning', 'impact'], stats: { damage: 8, attackCost: 90, burden: 3 }, active: { form: 'throw', element: 'lightning', power: 11, cooldown: 5, range: 7 } },
  { id: 'cathedral_hammer', name: '대성당 망치', slot: 'arm', grade: 'holy', elements: ['impact', 'fire'], stats: { damage: 12, attackCost: 130, burden: 6 }, active: { form: 'sweep', element: 'impact', power: 12, cooldown: 6 } },
  { id: 'godsplinter', name: '신의 파편', slot: 'arm', grade: 'forbidden', elements: ['fire', 'cold'], stats: { damage: 13, burden: 4 }, active: { form: 'nova', element: 'fire', power: 16, cooldown: 8, unique: 'steam' }, curse: { text: '액티브 사용 시 자신도 화상', kind: 'burnSelf' } },
  { id: 'heavens_spine', name: '천상의 척추', slot: 'arm', grade: 'forbidden', elements: ['lightning'], stats: { damage: 11, burden: 5 }, active: { form: 'bolt', element: 'lightning', power: 15, cooldown: 4, range: 9, unique: 'pierceAll' }, curse: { text: '부담 +4, 이동 비용 증가', kind: 'heavy' } },

  // ── 다리 (이동·회피) ──
  { id: 'pilgrim_greaves', name: '순례자의 정강이', slot: 'leg', grade: 'common', elements: [], stats: { moveBonus: 10, dodge: 4, burden: 2 } },
  { id: 'bone_stilts', name: '뼈 죽마', slot: 'leg', grade: 'common', elements: [], stats: { moveBonus: 15, burden: 2 } },
  { id: 'brass_hooves', name: '놋쇠 발굽', slot: 'leg', grade: 'common', elements: ['impact'], stats: { moveBonus: 5, dodge: 2, integrity: 0, hp: 4, burden: 3 } },
  { id: 'cinder_soles', name: '잿불 밑창', slot: 'leg', grade: 'common', elements: ['fire'], stats: { moveBonus: 10, dodge: 3, burden: 2 } },
  { id: 'rime_spurs', name: '서리 박차', slot: 'leg', grade: 'common', elements: ['cold'], stats: { moveBonus: 8, dodge: 6, burden: 2 } },
  { id: 'storm_tendons', name: '폭풍 힘줄', slot: 'leg', grade: 'holy', elements: ['lightning'], stats: { moveBonus: 22, dodge: 6, burden: 3 } },
  { id: 'seraph_talons', name: '세라프의 발톱', slot: 'leg', grade: 'holy', elements: ['fire', 'lightning'], stats: { moveBonus: 15, dodge: 10, burden: 3 } },
  { id: 'unbound_legs', name: '풀려난 다리', slot: 'leg', grade: 'forbidden', elements: ['impact', 'cold'], stats: { moveBonus: 30, dodge: 14, burden: 2 }, curse: { text: '이 유물은 손상되기 쉬움', kind: 'fragile' } },

  // ── 감각 ──
  { id: 'glass_eye', name: '유리 눈', slot: 'sense', grade: 'common', elements: [], stats: { sight: 2, dodge: 2, burden: 1 } },
  { id: 'ember_eye', name: '잿불 눈', slot: 'sense', grade: 'common', elements: ['fire'], stats: { sight: 1, hp: 4, burden: 1 } },
  { id: 'frost_ear', name: '서리 귀', slot: 'sense', grade: 'common', elements: ['cold'], stats: { dodge: 4, burden: 1 } },
  { id: 'bell_tongue', name: '종의 혀', slot: 'sense', grade: 'common', elements: ['lightning'], stats: { sight: 1, dodge: 3, burden: 1 } },
  { id: 'brass_nose', name: '놋쇠 코', slot: 'sense', grade: 'common', elements: ['impact'], stats: { hp: 6, burden: 2 } },
  { id: 'oracle_lens', name: '신탁의 수정체', slot: 'sense', grade: 'holy', elements: ['cold', 'lightning'], stats: { sight: 3, dodge: 6, burden: 2 } },
  { id: 'martyr_heart_valve', name: '순교자의 판막', slot: 'sense', grade: 'holy', elements: ['fire'], stats: { hp: 14, burden: 2 } },
  { id: 'eye_of_old_god', name: '옛 신의 눈', slot: 'sense', grade: 'forbidden', elements: ['fire', 'cold'], stats: { sight: 4, dodge: 10, hp: 10, burden: 2 }, curse: { text: '매 턴 체력 1% 잃음', kind: 'hpDrain' } },

  // ── 적 전용 ──
  { id: 'claw', name: '녹슨 발톱', slot: 'arm', grade: 'common', elements: [], stats: { damage: 4, burden: 0 }, enemyOnly: true },
  { id: 'warden_gate', name: '수문장의 문짝', slot: 'arm', grade: 'holy', elements: ['impact'], stats: { damage: 10, attackCost: 120, burden: 0 }, active: { form: 'nova', element: 'impact', power: 10, cooldown: 6 }, enemyOnly: true },
  { id: 'archbishop_censer', name: '대주교의 향로', slot: 'arm', grade: 'holy', elements: ['fire'], stats: { damage: 11, burden: 0 }, active: { form: 'throw', element: 'fire', power: 12, cooldown: 4, range: 7 }, enemyOnly: true },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
export const DROP_POOL = RELICS.filter((r) => !r.enemyOnly);
