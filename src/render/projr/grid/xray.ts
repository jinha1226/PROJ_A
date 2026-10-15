import * as THREE from 'three';

// (MODEL 0) 벽 투시: 주인공이 벽 뒤에 서면, 주인공 둘레에서 카메라 쪽(+z)에 있는 벽·기둥을 디더링으로 비쳐 보이게 한다.
// 투명 재질 대신 4×4 디더로 픽셀을 걸러내므로 인스턴스 벽에도 쓸 수 있고 그리는 순서 문제가 없다. 그림자에는 영향이 없다.

/** 모든 투시 재질이 함께 쓰는 값: 주인공 위치, 켜짐 (0~1, 시점이 탑뷰에 가까우면 0) */
export const XRAY = { hero: { value: new THREE.Vector3() }, on: { value: 1 } };
/** 투시 반경 (m): 이 안쪽부터 점점 비친다 */
const RADIUS = 2.4;

export function applyXray(m: THREE.Material): void {
  if (m.userData.xray) return;
  m.userData.xray = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uXrayHero = XRAY.hero;
    sh.uniforms.uXrayOn = XRAY.on;
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
        if ( uXrayOn > 0.01 && vXray.z > uXrayHero.z + 0.2 && vXray.y > 0.06 ) {
          float d = length( vXray.xz - uXrayHero.xz );
          float a = smoothstep( ${RADIUS.toFixed(2)}, ${(RADIUS * 0.45).toFixed(2)}, d ) * 0.7 * uXrayOn;
          if ( xrayBayer( gl_FragCoord.xy ) < a ) discard;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'xray';
  m.needsUpdate = true;
}
