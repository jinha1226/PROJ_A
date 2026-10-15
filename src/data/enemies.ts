// 적도 플레이어와 같은 규칙: 몸체 + 유물. 보이는 유물이 실제로 쓰는 유물이고, 쓰러지면 그 중 하나를 떨어뜨린다.
export interface EnemyTemplate {
  id: string;
  name: string;
  hp: number;
  baseDamage: number;
  relics: string[];
  ai: 'melee' | 'ranged' | 'skirmisher' | 'boss';
  zone: number[]; // 등장 구역
  weight: number;
  engraving?: string;
  boss?: boolean;
  dropChance: number;
}

export const ENEMIES: EnemyTemplate[] = [
  // 구역 1: 녹슨 회랑
  { id: 'husk', name: '빈 껍데기 순례자', hp: 10, baseDamage: 3, relics: ['claw', 'bone_plates'], ai: 'melee', zone: [1], weight: 10, dropChance: 0.35 },
  { id: 'ember_acolyte', name: '잿불 복사', hp: 11, baseDamage: 2, relics: ['censer_flail', 'ember_eye'], ai: 'ranged', zone: [1, 2], weight: 7, dropChance: 0.5 },
  { id: 'frost_novice', name: '서리 수련자', hp: 12, baseDamage: 2, relics: ['frost_hook', 'frost_shell'], ai: 'ranged', zone: [1, 2], weight: 6, dropChance: 0.5 },
  { id: 'brass_hound', name: '놋쇠 사냥개', hp: 9, baseDamage: 3, relics: ['claw', 'bone_stilts'], ai: 'skirmisher', zone: [1], weight: 6, dropChance: 0.4 },
  { id: 'bell_deacon', name: '종탑 부제', hp: 13, baseDamage: 2, relics: ['bell_clapper', 'storm_coil'], ai: 'ranged', zone: [1, 2], weight: 5, dropChance: 0.5 },
  { id: 'bone_reaper', name: '뼈 수확자', hp: 15, baseDamage: 3, relics: ['bone_sickle', 'rusted_cuirass', 'pilgrim_greaves'], ai: 'melee', zone: [1, 2], weight: 5, dropChance: 0.5 },
  // 구역 2: 용광로 성당
  { id: 'cinder_zealot', name: '잿불 광신자', hp: 20, baseDamage: 4, relics: ['furnace_arm', 'ember_mantle', 'cinder_soles'], ai: 'melee', zone: [2], weight: 8, dropChance: 0.5 },
  { id: 'glacier_monk', name: '빙하 수도승', hp: 24, baseDamage: 4, relics: ['icicle_lance', 'crystal_carapace'], ai: 'skirmisher', zone: [2], weight: 6, dropChance: 0.5 },
  { id: 'storm_choir', name: '폭풍 성가대원', hp: 18, baseDamage: 3, relics: ['thunder_rosary', 'bell_tongue'], ai: 'ranged', zone: [2], weight: 5, dropChance: 0.55 },
  { id: 'maul_templar', name: '망치 성전사', hp: 30, baseDamage: 5, relics: ['rusted_maul', 'brass_ribcage', 'brass_hooves'], ai: 'melee', zone: [2], weight: 5, dropChance: 0.5 },
  { id: 'seraph_husk', name: '타락한 세라프', hp: 22, baseDamage: 4, relics: ['saint_cleaver', 'seraph_talons'], ai: 'skirmisher', zone: [2], weight: 3, dropChance: 0.6 },
  // 정예 순찰대 (경보 3단계)
  { id: 'inquisitor', name: '정예 이단심문관', hp: 34, baseDamage: 6, relics: ['cathedral_hammer', 'reliquary_plate', 'storm_tendons'], ai: 'melee', zone: [], weight: 0, engraving: 'iron_gospel', dropChance: 0.3 },
  // 보스
  { id: 'rust_warden', name: '녹슨 수문장', hp: 80, baseDamage: 6, relics: ['warden_gate', 'sutured_bulwark', 'brass_ribcage'], ai: 'boss', zone: [], weight: 0, boss: true, engraving: 'scar_tissue', dropChance: 1 },
  { id: 'furnace_archbishop', name: '용광로 대주교', hp: 130, baseDamage: 7, relics: ['archbishop_censer', 'heretic_hide', 'seraph_talons'], ai: 'boss', zone: [], weight: 0, boss: true, engraving: 'pyre_heart', dropChance: 1 },
];

export const ENEMY_BY_ID: Record<string, EnemyTemplate> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

export interface ZoneDef {
  name: string;
  floors: number; // 전투층 수 (보스층 제외)
  boss: string;
  bossLoot: string[];
}

export const ZONES: ZoneDef[] = [
  { name: '녹슨 회랑', floors: 3, boss: 'rust_warden', bossLoot: ['sutured_bulwark', 'thunder_rosary', 'storm_tendons'] },
  { name: '용광로 성당', floors: 3, boss: 'furnace_archbishop', bossLoot: [] },
];
