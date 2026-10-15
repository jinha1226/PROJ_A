import * as THREE from 'three';

// (MODEL 0) 부드러운 시야: 칸마다 밝기(보임 1 · 기억 SEEN · 모름 0)를 작은 텍스처에 담아 흐리게 하고,
// 바닥·벽·기둥 셰이더가 월드 위치로 읽어 곱한다. 칸 경계의 계단 모양 대신 자연스러운 감쇠가 된다.

/** 칸 하나를 몇 텍셀로 나눌지 (클수록 부드럽다) */
const SUB = 4;

export const FOG = {
  tex: { value: new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1) as THREE.DataTexture },
  /** 맵 크기 (칸) */
  size: { value: new THREE.Vector2(1, 1) },
};

let w = 0, h = 0;
let data = new Uint8Array(4);
let src = new Float32Array(1), tmp = new Float32Array(1);

/** 칸 밝기(level, 칸 수 = mw×mh)로 시야 텍스처를 다시 만든다 */
export function updateFog(mw: number, mh: number, level: (i: number) => number, isWall: (i: number) => boolean): void {
  const W = mw * SUB, H = mh * SUB;
  if (W !== w || H !== h) {
    w = W; h = H;
    data = new Uint8Array(W * H * 4);
    src = new Float32Array(W * H);
    tmp = new Float32Array(W * H);
    FOG.tex.value.dispose();
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    FOG.tex.value = t;
    FOG.size.value.set(mw, mh);
  }
  // 벽 칸은 이웃 바닥 중 가장 밝은 값을 받는다 (벽면이 바닥 시야를 따라가게)
  const cell = new Float32Array(mw * mh);
  for (let i = 0; i < mw * mh; i++) cell[i] = level(i);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const i = y * mw + x;
    if (!isWall(i)) continue;
    let best = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= mw || ny >= mh) continue;
      const j = ny * mw + nx;
      if (!isWall(j)) best = Math.max(best, level(j));
    }
    cell[i] = best;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) src[y * W + x] = cell[Math.floor(y / SUB) * mw + Math.floor(x / SUB)]!;
  // 상자 흐림 두 번 (가로·세로), 반경 = 칸 하나
  const r = SUB;
  const blur = (a: Float32Array, b: Float32Array, horiz: boolean) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) {
        const xx = horiz ? x + k : x, yy = horiz ? y : y + k;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        s += a[yy * W + xx]!; n++;
      }
      b[y * W + x] = s / n;
    }
  };
  for (let pass = 0; pass < 2; pass++) { blur(src, tmp, true); blur(tmp, src, false); }
  for (let i = 0; i < W * H; i++) {
    const v = Math.round(Math.min(1, src[i]!) * 255);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  FOG.tex.value.needsUpdate = true;
}

/** 재질에 시야 감쇠를 건다 (이미 걸린 onBeforeCompile 뒤에 이어 붙인다) */
export function applyFog(m: THREE.Material): void {
  if (m.userData.fog) return;
  m.userData.fog = true;
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.uniforms.uFogTex = FOG.tex;
    sh.uniforms.uFogSize = FOG.size;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFogW;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 fw = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          fw = instanceMatrix * fw;
        #endif
        vFogW = ( modelMatrix * fw ).xyz;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFogW;\nuniform sampler2D uFogTex;\nuniform vec2 uFogSize;')
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        gl_FragColor.rgb *= texture2D( uFogTex, ( vFogW.xz + 0.5 ) / uFogSize ).r;`,
      );
  };
  m.customProgramCacheKey = () => `${prevKey.call(m)}|fog`;
  m.needsUpdate = true;
}
