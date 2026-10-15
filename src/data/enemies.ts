// 적도 플레이어와 같은 규칙: 몸 + 부산물. 보이는 부위가 실제로 쓰는 부산물이고, 쓰러지면 그 중 하나를 떨어뜨린다.
export interface EnemyTemplate {
  id: string;
  name: string;
  hp: number;
  baseDamage: number;
  byproducts: string[];
  ai: 'melee' | 'ranged' | 'skirmisher' | 'boss';
  zone: number[]; // 등장 구역
  weight: number;
  engraving?: string;
  boss?: boolean;
  dropChance: number;
}

export const ENEMIES: EnemyTemplate[] = [
  // 구역 1: 버섯 동굴
  { id: 'husk', name: '고블린', hp: 10, baseDamage: 3, byproducts: ['claw', 'bone_plates'], ai: 'melee', zone: [1], weight: 10, dropChance: 0.35 },
  { id: 'ember_acolyte', name: '불꽃 고블린 주술사', hp: 11, baseDamage: 2, byproducts: ['censer_flail', 'ember_eye'], ai: 'ranged', zone: [1, 2], weight: 7, dropChance: 0.5 },
  { id: 'frost_novice', name: '서리 거미', hp: 12, baseDamage: 2, byproducts: ['frost_hook', 'frost_shell'], ai: 'ranged', zone: [1, 2], weight: 6, dropChance: 0.5 },
  { id: 'brass_hound', name: '동굴 사냥개', hp: 9, baseDamage: 3, byproducts: ['claw', 'bone_stilts'], ai: 'skirmisher', zone: [1], weight: 6, dropChance: 0.4 },
  { id: 'bell_deacon', name: '뇌전 도롱뇽', hp: 13, baseDamage: 2, byproducts: ['bell_clapper', 'storm_coil'], ai: 'ranged', zone: [1, 2], weight: 5, dropChance: 0.5 },
  { id: 'bone_reaper', name: '해골 수확자', hp: 15, baseDamage: 3, byproducts: ['bone_sickle', 'rusted_cuirass', 'pilgrim_greaves'], ai: 'melee', zone: [1, 2], weight: 5, dropChance: 0.5 },
  // 구역 2: 불타는 지하 묘지
  { id: 'cinder_zealot', name: '불 도마뱀 전사', hp: 20, baseDamage: 4, byproducts: ['furnace_arm', 'ember_mantle', 'cinder_soles'], ai: 'melee', zone: [2], weight: 8, dropChance: 0.5 },
  { id: 'glacier_monk', name: '얼음 망령', hp: 24, baseDamage: 4, byproducts: ['icicle_lance', 'crystal_carapace'], ai: 'skirmisher', zone: [2], weight: 6, dropChance: 0.5 },
  { id: 'storm_choir', name: '뇌조', hp: 18, baseDamage: 3, byproducts: ['thunder_rosary', 'bell_tongue'], ai: 'ranged', zone: [2], weight: 5, dropChance: 0.55 },
  { id: 'maul_templar', name: '미노타우로스', hp: 30, baseDamage: 5, byproducts: ['rusted_maul', 'brass_ribcage', 'brass_hooves'], ai: 'melee', zone: [2], weight: 5, dropChance: 0.5 },
  { id: 'seraph_husk', name: '그리폰', hp: 22, baseDamage: 4, byproducts: ['saint_cleaver', 'seraph_talons'], ai: 'skirmisher', zone: [2], weight: 3, dropChance: 0.6 },
  // 정예 순찰대 (경보 3단계)
  { id: 'inquisitor', name: '묘지기 기사', hp: 34, baseDamage: 6, byproducts: ['cathedral_hammer', 'reliquary_plate', 'storm_tendons'], ai: 'melee', zone: [], weight: 0, engraving: 'iron_gospel', dropChance: 0.3 },
  // 보스
  { id: 'rust_warden', name: '동굴 골렘', hp: 80, baseDamage: 6, byproducts: ['warden_gate', 'sutured_bulwark', 'brass_ribcage'], ai: 'boss', zone: [], weight: 0, boss: true, engraving: 'stitched_heart', dropChance: 1 },
  { id: 'furnace_archbishop', name: '리치', hp: 130, baseDamage: 7, byproducts: ['archbishop_censer', 'heretic_hide', 'seraph_talons'], ai: 'boss', zone: [], weight: 0, boss: true, engraving: 'ember_hand', dropChance: 1 },
];

export const ENEMY_BY_ID: Record<string, EnemyTemplate> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

export interface ZoneDef {
  name: string;
  floors: number; // 전투층 수 (보스층 제외)
  boss: string;
  bossLoot: string[];
}

export const ZONES: ZoneDef[] = [
  { name: '버섯 동굴', floors: 3, boss: 'rust_warden', bossLoot: ['sutured_bulwark', 'thunder_rosary', 'storm_tendons'] },
  { name: '불타는 지하 묘지', floors: 3, boss: 'furnace_archbishop', bossLoot: [] },
];
