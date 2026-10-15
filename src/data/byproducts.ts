import type { ByproductDef } from '../core/types';

// 부산물: 몬스터에게서 얻어 슈트 부위에 장착한다. 기본 역할(수치) + 원소 태그 0~2개 + 팔 부산물은 쿨다운 기술 1개.
// (무기는 2단계에서 별도 데이터로 분리한다.)
export const BYPRODUCTS: ByproductDef[] = [
  // ── 몸 (장갑) ──
  { id: 'rusted_cuirass', name: '해골 흉곽', slot: 'body', grade: 'common', elements: [], stats: { integrity: 14, burden: 3 } },
  { id: 'bone_plates', name: '고블린 두꺼운 가죽', slot: 'body', grade: 'common', elements: [], stats: { integrity: 10, dodge: 3, burden: 2 } },
  { id: 'brass_ribcage', name: '미노타우로스 가슴판', slot: 'body', grade: 'common', elements: ['impact'], stats: { integrity: 16, burden: 4 } },
  { id: 'ember_mantle', name: '불 도마뱀 비늘', slot: 'body', grade: 'common', elements: ['fire'], stats: { integrity: 11, burden: 3 } },
  { id: 'frost_shell', name: '서리 거미 껍질', slot: 'body', grade: 'common', elements: ['cold'], stats: { integrity: 13, burden: 3 } },
  { id: 'storm_coil', name: '도롱뇽 전기 가죽', slot: 'body', grade: 'common', elements: ['lightning'], stats: { integrity: 10, dodge: 2, burden: 2 } },
  { id: 'reliquary_plate', name: '묘지기 기사의 핵갑', slot: 'body', grade: 'holy', elements: ['fire', 'impact'], stats: { integrity: 22, hp: 6, burden: 5 } },
  { id: 'crystal_carapace', name: '얼음 망령 수정핵', slot: 'body', grade: 'holy', elements: ['cold', 'lightning'], stats: { integrity: 20, burden: 4 } },
  { id: 'sutured_bulwark', name: '골렘 바위 몸', slot: 'body', grade: 'holy', elements: [], stats: { integrity: 26, burden: 6 } },
  { id: 'heretic_hide', name: '리치의 망토', slot: 'body', grade: 'forbidden', elements: ['fire', 'cold'], stats: { integrity: 30, hp: 10, burden: 4 }, curse: { text: '매 턴 체력 1% 잃음', kind: 'hpDrain' } },

  // ── 팔 (공격 + 액티브) ──
  { id: 'brass_fist', name: '오우거 주먹', slot: 'arm', grade: 'common', elements: ['impact'], stats: { damage: 5, attackCost: 90, burden: 2 }, active: { form: 'dash', element: 'impact', power: 7, cooldown: 7, range: 4 } },
  { id: 'furnace_arm', name: '불 도마뱀 앞발', slot: 'arm', grade: 'common', elements: ['fire'], stats: { damage: 5, burden: 3 }, active: { form: 'sweep', element: 'fire', power: 6, cooldown: 6 } },
  { id: 'frost_hook', name: '서리 거미 독니', slot: 'arm', grade: 'common', elements: ['cold'], stats: { damage: 5, burden: 3 }, active: { form: 'throw', element: 'cold', power: 7, cooldown: 6, range: 6 } },
  { id: 'bell_clapper', name: '도롱뇽 방전 꼬리', slot: 'arm', grade: 'common', elements: ['lightning'], stats: { damage: 4, attackCost: 90, burden: 2 }, active: { form: 'bolt', element: 'lightning', power: 7, cooldown: 5, range: 7 } },
  { id: 'bone_sickle', name: '해골 낫팔', slot: 'arm', grade: 'common', elements: [], stats: { damage: 7, attackCost: 90, burden: 2 }, active: { form: 'sweep', power: 6, cooldown: 5 } },
  { id: 'censer_flail', name: '주술사의 화염 주머니', slot: 'arm', grade: 'common', elements: ['fire'], stats: { damage: 6, attackCost: 110, burden: 3 }, active: { form: 'throw', element: 'fire', power: 8, cooldown: 7, range: 5 } },
  { id: 'icicle_lance', name: '얼음 망령 창팔', slot: 'arm', grade: 'common', elements: ['cold'], stats: { damage: 6, burden: 3 }, active: { form: 'dash', element: 'cold', power: 7, cooldown: 7, range: 4 } },
  { id: 'rusted_maul', name: '미노타우로스 주먹', slot: 'arm', grade: 'common', elements: ['impact'], stats: { damage: 9, attackCost: 130, burden: 5 }, active: { form: 'nova', element: 'impact', power: 7, cooldown: 8 } },
  { id: 'spark_censer', name: '도깨비불 꼬리', slot: 'arm', grade: 'common', elements: ['lightning'], stats: { damage: 5, burden: 3 }, active: { form: 'sweep', element: 'lightning', power: 6, cooldown: 6 } },
  { id: 'saint_cleaver', name: '그리폰 부리', slot: 'arm', grade: 'holy', elements: ['fire', 'lightning'], stats: { damage: 9, burden: 4 }, active: { form: 'dash', element: 'fire', power: 11, cooldown: 6, range: 5 } },
  { id: 'glacier_reliquary', name: '서리 와이번 날개', slot: 'arm', grade: 'holy', elements: ['cold'], stats: { damage: 8, burden: 4 }, active: { form: 'nova', element: 'cold', power: 10, cooldown: 7 } },
  { id: 'thunder_rosary', name: '뇌조 깃털', slot: 'arm', grade: 'holy', elements: ['lightning', 'impact'], stats: { damage: 8, attackCost: 90, burden: 3 }, active: { form: 'throw', element: 'lightning', power: 11, cooldown: 5, range: 7 } },
  { id: 'cathedral_hammer', name: '묘지기 기사의 팔', slot: 'arm', grade: 'holy', elements: ['impact', 'fire'], stats: { damage: 12, attackCost: 130, burden: 6 }, active: { form: 'sweep', element: 'impact', power: 12, cooldown: 6 } },
  { id: 'godsplinter', name: '마왕의 심장 조각', slot: 'arm', grade: 'forbidden', elements: ['fire', 'cold'], stats: { damage: 13, burden: 4 }, active: { form: 'nova', element: 'fire', power: 16, cooldown: 8, unique: 'steam' }, curse: { text: '액티브 사용 시 자신도 화상', kind: 'burnSelf' } },
  { id: 'heavens_spine', name: '천둥 거신의 척추', slot: 'arm', grade: 'forbidden', elements: ['lightning'], stats: { damage: 11, burden: 5 }, active: { form: 'bolt', element: 'lightning', power: 15, cooldown: 4, range: 9, unique: 'pierceAll' }, curse: { text: '부담 +4, 이동 비용 증가', kind: 'heavy' } },

  // ── 다리 (이동·회피) ──
  { id: 'pilgrim_greaves', name: '해골 다리뼈', slot: 'leg', grade: 'common', elements: [], stats: { moveBonus: 10, dodge: 4, burden: 2 } },
  { id: 'bone_stilts', name: '사냥개 뒷다리', slot: 'leg', grade: 'common', elements: [], stats: { moveBonus: 15, burden: 2 } },
  { id: 'brass_hooves', name: '미노타우로스 발굽', slot: 'leg', grade: 'common', elements: ['impact'], stats: { moveBonus: 5, dodge: 2, integrity: 0, hp: 4, burden: 3 } },
  { id: 'cinder_soles', name: '불 도마뱀 발', slot: 'leg', grade: 'common', elements: ['fire'], stats: { moveBonus: 10, dodge: 3, burden: 2 } },
  { id: 'rime_spurs', name: '설원 늑대 다리', slot: 'leg', grade: 'common', elements: ['cold'], stats: { moveBonus: 8, dodge: 6, burden: 2 } },
  { id: 'storm_tendons', name: '묘지기 기사의 다리', slot: 'leg', grade: 'holy', elements: ['lightning'], stats: { moveBonus: 22, dodge: 6, burden: 3 } },
  { id: 'seraph_talons', name: '그리폰 발톱', slot: 'leg', grade: 'holy', elements: ['fire', 'lightning'], stats: { moveBonus: 15, dodge: 10, burden: 3 } },
  { id: 'unbound_legs', name: '그림자 추적자 다리', slot: 'leg', grade: 'forbidden', elements: ['impact', 'cold'], stats: { moveBonus: 30, dodge: 14, burden: 2 }, curse: { text: '다리 슈트 장갑 절반', kind: 'fragile' } },

  // ── 감각 ──
  { id: 'glass_eye', name: '박쥐 귀', slot: 'sense', grade: 'common', elements: [], stats: { sight: 2, dodge: 2, burden: 1 } },
  { id: 'ember_eye', name: '불꽃 고블린 눈', slot: 'sense', grade: 'common', elements: ['fire'], stats: { sight: 1, hp: 4, burden: 1 } },
  { id: 'frost_ear', name: '서리 올빼미 눈', slot: 'sense', grade: 'common', elements: ['cold'], stats: { dodge: 4, burden: 1 } },
  { id: 'bell_tongue', name: '뇌조 볏', slot: 'sense', grade: 'common', elements: ['lightning'], stats: { sight: 1, dodge: 3, burden: 1 } },
  { id: 'brass_nose', name: '멧돼지 코', slot: 'sense', grade: 'common', elements: ['impact'], stats: { hp: 6, burden: 2 } },
  { id: 'oracle_lens', name: '바실리스크 눈', slot: 'sense', grade: 'holy', elements: ['cold', 'lightning'], stats: { sight: 3, dodge: 6, burden: 2 } },
  { id: 'martyr_heart_valve', name: '불사조 깃털', slot: 'sense', grade: 'holy', elements: ['fire'], stats: { hp: 14, burden: 2 } },
  { id: 'eye_of_old_god', name: '비홀더의 눈', slot: 'sense', grade: 'forbidden', elements: ['fire', 'cold'], stats: { sight: 4, dodge: 10, hp: 10, burden: 2 }, curse: { text: '매 턴 체력 1% 잃음', kind: 'hpDrain' } },

  // ── 적 전용 ──
  { id: 'claw', name: '고블린 손톱', slot: 'arm', grade: 'common', elements: [], stats: { damage: 4, burden: 0 }, enemyOnly: true },
  { id: 'warden_gate', name: '골렘 주먹', slot: 'arm', grade: 'holy', elements: ['impact'], stats: { damage: 10, attackCost: 120, burden: 0 }, active: { form: 'nova', element: 'impact', power: 10, cooldown: 6 }, enemyOnly: true },
  { id: 'archbishop_censer', name: '리치의 홀', slot: 'arm', grade: 'holy', elements: ['fire'], stats: { damage: 11, burden: 0 }, active: { form: 'throw', element: 'fire', power: 12, cooldown: 4, range: 7 }, enemyOnly: true },
];

export const BYPRODUCT_BY_ID: Record<string, ByproductDef> = Object.fromEntries(BYPRODUCTS.map((r) => [r.id, r]));
export const DROP_POOL = BYPRODUCTS.filter((r) => !r.enemyOnly);
