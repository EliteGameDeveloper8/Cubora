/*
 * Clouds: a flat layer of 12x12-block cells, 4 blocks thick, drifting east and rebuilt as you move.
 * Drawn twice (a depth-only pass, then colour) so only the outer surface shows; they fade out towards the edge.
 */

// Drawn twice: an invisible depth-only pass first, then the colour pass, so only the outer surface shows (no stripes of inner faces).
// The colour pass fades out towards the edge of the cloud layer instead of cutting off.
const CL = { m: null, md: null, cx: 1e9, cz: 1e9, off: 0 },
  CY = 150,
  CC = 12,
  CN = 36,
  CU = { far: { value: 300 } },
  mC = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  }),
  mCd = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide, fog: false });
mC.onBeforeCompile = sh => {
  sh.uniforms.uF = CU.far;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vCd;')
    .replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvCd=length((modelMatrix*vec4(position,1.)).xz-cameraPosition.xz);',
    );
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uF;varying float vCd;')
    .replace('#include <fog_fragment>', '#include <fog_fragment>\ngl_FragColor.a*=1.-smoothstep(uF*.55,uF,vCd);');
};
function buildClouds(cx, cz) {
  if (CL.m) {
    scene.remove(CL.m, CL.md);
    CL.m.geometry.dispose();
    CL.m = CL.md = null;
  }
  const s = W.seed,
    on = (i, j) => n2(i / 7, j / 7, s + 90) * 0.7 + n2(i / 2.3, j / 2.3, s + 91) * 0.3 > 0.6,
    p = [],
    c = [],
    ix = [];
  const q = (a, b, e, f, l) => {
    const v = p.length / 3;
    p.push(...a, ...b, ...e, ...f);
    for (let i = 0; i < 4; i++) c.push(l, l, l);
    ix.push(v, v + 1, v + 2, v, v + 2, v + 3);
  };
  const rad = Math.min(CN, Math.sqrt(Math.max(0, (cam.far * 0.9) ** 2 - (CY - P.y) ** 2)) / CC);
  for (let j = -CN; j < CN; j++)
    for (let i = -CN; i < CN; i++) {
      const gi = cx + i,
        gj = cz + j;
      if (i * i + j * j > rad * rad || !on(gi, gj)) continue;
      const x0 = gi * CC,
        z0 = gj * CC,
        x1 = x0 + CC,
        z1 = z0 + CC,
        H = 4;
      q([x0, H, z0], [x1, H, z0], [x1, H, z1], [x0, H, z1], 1);
      q([x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], 0.75);
      if (!on(gi + 1, gj)) q([x1, 0, z0], [x1, H, z0], [x1, H, z1], [x1, 0, z1], 0.88);
      if (!on(gi - 1, gj)) q([x0, 0, z0], [x0, H, z0], [x0, H, z1], [x0, 0, z1], 0.88);
      if (!on(gi, gj + 1)) q([x0, 0, z1], [x0, H, z1], [x1, H, z1], [x1, 0, z1], 0.82);
      if (!on(gi, gj - 1)) q([x0, 0, z0], [x0, H, z0], [x1, H, z0], [x1, 0, z0], 0.82);
    }
  if (!ix.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  g.setIndex(ix);
  g.computeBoundingSphere();
  CL.m = new THREE.Mesh(g, mC);
  CL.md = new THREE.Mesh(g, mCd);
  CL.m.position.y = CL.md.position.y = CY;
  CL.md.renderOrder = 2;
  CL.m.renderOrder = 3;
  scene.add(CL.md, CL.m);
  CL.cx = cx;
  CL.cz = cz;
  CU.far.value = rad * CC;
}
function cloudFrame(dt) {
  if (!S.clouds) {
    if (CL.m) {
      scene.remove(CL.m, CL.md);
      CL.m.geometry.dispose();
      CL.m = CL.md = null;
      CL.cx = 1e9;
    }
    return;
  }
  CL.off += dt * 1.5;
  const gx = Math.floor((P.x - CL.off) / CC),
    gz = Math.floor(P.z / CC);
  if (
    Math.abs(gx - CL.cx) > 4 ||
    Math.abs(gz - CL.cz) > 4 ||
    Math.abs(cam.far - CL.far) > 20 ||
    (!CL.m && CL.cx == 1e9)
  ) {
    CL.far = cam.far;
    buildClouds(gx, gz);
  }
  if (CL.m) CL.m.position.x = CL.md.position.x = CL.off;
  mC.color.setScalar(0.3 + 0.7 * DL);
}
