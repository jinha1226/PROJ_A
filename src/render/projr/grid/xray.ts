import * as THREE from 'three';

// (MODEL 0) 벽 투시: 주인공이 벽 뒤에 서면, 주인공 둘레에서 카메라 쪽(+z)에 있는 벽·기둥을 디더링으로 비쳐 보이게 한다.
// 투명 재질 대신 4×4 디더로 픽셀을 걸러내므로 인스턴스 벽에도 쓸 수 있고 그리는 순서 문제가 없다. 그림자에는 영향이 없다.

/** 함께 비쳐 볼 몬스터 수 (주인공에서 가까운 순) */
export const XRAY_FOES = 8;
/** 모든 투시 재질이 함께 쓰는 값: 주인공 위치, 보이는 몬스터 위치(w=1이면 사용), 켜짐 (0~1, 시점이 탑뷰에 가까우면 0) */
export const XRAY = {
  hero: { value: new THREE.Vector3() },
  foes: { value: Array.from({ length: XRAY_FOES }, () => new THREE.Vector4()) },
  on: { value: 1 },
};
/** 몬스터 둘레의 투시 반경 (m) */
const FOE_RADIUS = 1.5;
/** 투시 반경 (m): 이 안쪽부터 점점 비친다 */
const RADIUS = 2.4;

export function applyXray(m: THREE.Material): void {
  if (m.userData.xray) return;
  m.userData.xray = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uXrayHero = XRAY.hero;
    sh.uniforms.uXrayOn = XRAY.on;
    sh.uniforms.uXrayFoes = XRAY.foes;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vXray;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 xw = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          xw = instanceMatrix * xw;
        #endif
        vXray = ( modelMatrix * xw ).xyz;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vXray;
        uniform vec3 uXrayHero;
        uniform float uXrayOn;
        uniform vec4 uXrayFoes[${XRAY_FOES}];
        float xrayBayer( vec2 p ) {
          ivec2 i = ivec2( mod( p, 4.0 ) );
          int k = i.x + i.y * 4;
          int b[16] = int[16]( 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 );
          return ( float( b[k] ) + 0.5 ) / 16.0;
        }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        if ( uXrayOn > 0.01 && vXray.y > 0.06 ) {
          float a = 0.0;
          if ( vXray.z > uXrayHero.z + 0.2 ) a = smoothstep( ${RADIUS.toFixed(2)}, ${(RADIUS * 0.45).toFixed(2)}, length( vXray.xz - uXrayHero.xz ) );
          // 보이는 몬스터도 벽 뒤에 있으면 그 둘레를 비춘다
          for ( int k = 0; k < ${XRAY_FOES}; k++ ) {
            vec4 f = uXrayFoes[ k ];
            if ( f.w > 0.5 && vXray.z > f.z + 0.2 ) a = max( a, smoothstep( ${FOE_RADIUS.toFixed(2)}, ${(FOE_RADIUS * 0.4).toFixed(2)}, length( vXray.xz - f.xz ) ) );
          }
          a *= 0.7 * uXrayOn;
          if ( xrayBayer( gl_FragCoord.xy ) < a ) discard;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'xray';
  m.needsUpdate = true;
}
