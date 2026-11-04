/*
 * three.js renderer, scene and camera.
 * Fog is spherical (distance from the camera, not depth) and follows a haze curve: it grows gently with distance so
 * far terrain stays visible but soft, then reaches the sky colour at the very edge so the end of the world never shows.
 * rm / rmc remove meshes; guess() predicts a block that is not loaded yet (used at the edge of the loaded area).
 */

// spherical fog: distance from camera instead of depth, so fog looks the same up, down and sideways
// haze curve (like air in real life): grows gently with distance so far terrain stays visible but soft,
// then ramps to full sky colour right at the edge so the end of the world is never seen
THREE.ShaderChunk.fog_fragment =
  '#ifdef USE_FOG\n\tfloat ft = clamp( ( fogDepth - fogNear ) / ( fogFar - fogNear ), 0.0, 1.0 );\n\tfloat fogFactor = 0.68 * ft + 0.32 * smoothstep( 0.82, 1.0, ft );\n\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n\tfogDepth = length( mvPosition.xyz );\n#endif';
const renderer = new THREE.WebGLRenderer({ antialias: false }),
  scene = new THREE.Scene(),
  cam = new THREE.PerspectiveCamera(75, 1, 0.05, 300); // near plane close enough that wide FOV never clips into walls
const hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 0.9),
  sunL = new THREE.DirectionalLight(0xffffff, 0.35);
sunL.position.set(0.4, 1, 0.3);
scene.add(hemi, sunL); // only lights mobs (Lambert); blocks are unlit
document.body.prepend(renderer.domElement);
const canvas = renderer.domElement;
renderer.setPixelRatio(Math.min(devicePixelRatio, S.tier === 0 ? 1.25 : 2));
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 90);
cam.rotation.order = 'YXZ';
renderer.autoClear = false;
const rs = () => {
  renderer.setSize(innerWidth, innerHeight);
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
  try {
    HC.aspect = cam.aspect;
    HC.updateProjectionMatrix();
  } catch (e) {} // HC (the hand camera) only exists once camera.js has loaded
};
addEventListener('resize', rs);
rs();
const rm = m => {
    if (m) {
      scene.remove(m);
      m.geometry.dispose();
    }
  },
  rmc = c => {
    rm(c.m);
    rm(c.w);
  };
// what a not-yet-loaded block probably is (terrain without caves/trees): used at the edge of the loaded area
function guess(x, y, z) {
  const s = W.seed,
    h = hgt(x, z, s);
  if (y > h) return y <= SEA ? 5 : 0;
  const t = surf(x, z, h, s);
  return y == h ? t : y > h - 4 ? (t == 4 ? 4 : t == 1 ? 2 : 3) : 3;
}
