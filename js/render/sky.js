/*
 * Sky and day/night: a gradient sky dome with sunrise/sunset glow, a square sun and moon, stars at night.
 * Time of day: 0 = sunrise, .25 = noon, .5 = sunset, .75 = midnight. DL = daylight (0.2..1), used to dim the world.
 */

const SKY = { g: new THREE.Group() },
  skyU = {
    top: { value: new THREE.Color() },
    hor: { value: new THREE.Color() },
    sun: { value: new THREE.Vector3(0, 1, 0) },
    glow: { value: new THREE.Color() },
  };
{
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: skyU,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader:
        'varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'uniform vec3 top,hor,sun,glow;varying vec3 vp;void main(){float h=vp.y;vec3 c=mix(hor,top,smoothstep(0.,.55,max(h,0.)));if(h<0.)c=mix(hor,hor*.55,smoothstep(0.,-.4,h));float s=max(dot(normalize(vp),sun),0.);c+=glow*(pow(s,6.)*.9+pow(s,60.)*.6)*smoothstep(-.4,.1,h);gl_FragColor=vec4(c,1.);}',
    }),
  );
  m.renderOrder = -3;
  SKY.g.add(m);
  const N = 1800,
    p = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1,
      a = Math.random() * 6.28,
      r = Math.sqrt(1 - u * u);
    p.set([r * Math.cos(a), u, r * Math.sin(a)], i * 3);
  } // whole sphere; they turn with the sky and fade in at night
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
  SKY.stars = new THREE.Points(
    sg,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2,
      sizeAttenuation: false,
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
  );
  SKY.stars.renderOrder = -2;
  SKY.g.add(SKY.stars);
  const disc = draw => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    draw(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false, transparent: true }));
    sp.renderOrder = -1;
    return sp;
  };
  SKY.sun = disc(g => {
    g.fillStyle = '#fff3a0';
    g.fillRect(4, 4, 24, 24);
    g.fillStyle = '#fffbe0';
    g.fillRect(8, 8, 16, 16);
  });
  SKY.moon = disc(g => {
    g.fillStyle = '#d8dce8';
    g.fillRect(6, 6, 20, 20);
    g.fillStyle = '#b5bacb';
    g.fillRect(10, 10, 5, 5);
    g.fillRect(18, 17, 4, 4);
    g.fillRect(12, 20, 3, 3);
  });
  SKY.g.frustumCulled = false;
  SKY.g.children.forEach(o => (o.frustumCulled = false));
  scene.add(SKY.g, SKY.sun, SKY.moon);
}
let DL = 1; // daylight 0.2..1
const C3 = h => new THREE.Color(h),
  SK = { dt: C3(0x4f8fe6), dh: C3(0xa9d3f5), nt: C3(0x02040d), nh: C3(0x0c1530), sh: C3(0xf08a4b), tmp: C3(0) };
function skyFrame(uw) {
  const f = ((W.time % 1) + 1) % 1,
    a = f * Math.PI * 2,
    sd = new THREE.Vector3(Math.cos(a), Math.sin(a), 0.25).normalize(),
    e = sd.y,
    day = smt((e + 0.12) / 0.3),
    dusk = Math.max(0, 1 - Math.abs(e) / 0.25) * (1 - Math.abs(0.5 - day) * 0.6);
  DL = 0.2 + 0.8 * day;
  skyU.top.value.copy(SK.nt).lerp(SK.dt, day);
  skyU.hor.value
    .copy(SK.nh)
    .lerp(SK.dh, day)
    .lerp(SK.sh, dusk * 0.55);
  skyU.sun.value.copy(sd);
  skyU.glow.value.copy(SK.sh).multiplyScalar(dusk * 0.8);
  const D = cam.far * 0.8;
  SKY.g.position.copy(cam.position);
  SKY.g.scale.setScalar(cam.far * 0.9);
  SKY.stars.rotation.z = a;
  SKY.stars.material.opacity = Math.max(0, 1 - day * 1.6);
  SKY.sun.position.copy(cam.position).addScaledVector(sd, D);
  SKY.sun.scale.setScalar(D * 0.09);
  SKY.moon.position.copy(cam.position).addScaledVector(sd, -D);
  SKY.moon.scale.setScalar(D * 0.07);
  SKY.g.visible = SKY.sun.visible = SKY.moon.visible = !uw;
  LU.dl.value = DL;
  mL.color.setScalar(DL);
  hemi.intensity = 0.9 * DL;
  sunL.intensity = 0.35 * day;
  sunL.position.copy(sd);
  return skyU.hor.value;
}
