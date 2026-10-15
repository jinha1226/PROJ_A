import * as THREE from 'three';

/** Rough pixel look: the scene is drawn to a small linear-colour target (one pixel per `px` screen pixels) and blown up with hard edges; a dark one-pixel outline where depth jumps keeps figures and walls apart; tone mapping and sRGB happen on the way out, then colours are slightly posterised. */
export class PixelPass {
  private readonly target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType, stencilBuffer: true });
  private readonly quad: THREE.Mesh;
  private readonly scene = new THREE.Scene();
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly size = new THREE.Vector2();

  constructor(private readonly renderer: THREE.WebGLRenderer, public px = 3) {
    this.target.texture.generateMipmaps = false;
    // 깊이 + 스텐실 (스텐실은 마우스를 올린 몬스터의 외곽선이 쓴다)
    this.target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedInt248Type);
    this.target.depthTexture.format = THREE.DepthStencilFormat;
    const mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: this.target.texture }, depth: { value: this.target.depthTexture }, texel: { value: new THREE.Vector2(1, 1) }, levels: { value: 28 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tex; uniform sampler2D depth; uniform vec2 texel; uniform float levels; varying vec2 vUv;
        float dz(vec2 o) { return texture2D(depth, vUv + o * texel).x; }
        vec3 col(vec2 o) { return texture2D(tex, vUv + o * texel).rgb; }
        void main() {
          // (MODEL 0) 외곽선은 물체 바깥 픽셀에 그린다: 이웃이 이 픽셀보다 확 가까우면(앞에 물체가 있으면) 이 픽셀이 그 물체의 테두리.
          // 물체 자신의 가장자리를 칠하지 않으므로 1~2픽셀 굵기의 무기·팔다리가 살아남는다
          float d = dz(vec2(0.0));
          float n1 = dz(vec2(1.0, 0.0)), n2 = dz(vec2(-1.0, 0.0)), n3 = dz(vec2(0.0, 1.0)), n4 = dz(vec2(0.0, -1.0));
          float nearest = min(min(n1, n2), min(n3, n4));
          float outer = step(0.0025, d - nearest);
          vec3 c = col(vec2(0.0));
          // 테두리 색: 앞 물체의 색을 아주 어둡게 (검정보다 덜 뭉개진다)
          vec3 front = n1 == nearest ? col(vec2(1.0, 0.0)) : n2 == nearest ? col(vec2(-1.0, 0.0)) : n3 == nearest ? col(vec2(0.0, 1.0)) : col(vec2(0.0, -1.0));
          c = mix(c, front * 0.18, outer);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          gl_FragColor.rgb = floor(gl_FragColor.rgb * levels + 0.5) / levels;
        }`,
      depthTest: false, depthWrite: false, toneMapped: true,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.scene.add(this.quad);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    const r = this.renderer;
    r.getSize(this.size);
    const h = Math.max(120, Math.round(this.size.y / this.px));
    const w = Math.max(1, Math.round(this.size.x / this.px));
    if (this.target.width !== w || this.target.height !== h) {
      this.target.setSize(w, h);
      ((this.quad.material as THREE.ShaderMaterial).uniforms.texel!.value as THREE.Vector2).set(1 / w, 1 / h);
    }
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
  }

  /** Moves a camera target onto the low-res pixel grid (screen x is world x; screen y is world z foreshortened by the elevation), so a moving camera does not make edges crawl. */
  snap(target: THREE.Vector3, halfHeight: number, elevation: number): void {
    const step = (2 * halfHeight) / Math.max(1, this.target.height);
    target.x = Math.round(target.x / step) * step;
    const sz = step / Math.sin(elevation);
    target.z = Math.round(target.z / sz) * sz;
  }

  dispose(): void {
    this.target.dispose();
    this.quad.geometry.dispose();
    (this.quad.material as THREE.Material).dispose();
  }
}
