/*
 * Settings screen: name, render distance, far terrain, FOV, sensitivity, AO, minimap, clouds,
 * touch controls, and the key-binding list (click a key, press the new one; Esc cancels).
 */

$('#sn').value = S.name;
$('#sr').value = S.rd;
$('#sf').value = S.fov;
$('#ss').value = S.sens;
$('#sao').checked = !!S.ao;
$('#sfm').value = S.fm;
$('#sfmv').textContent = fmLabel();
$('#smini').checked = !!S.mini;
$('#scl').checked = !!S.clouds;
$('#stc').value = S.touch;
$('#srv').textContent = S.rd;
$('#settings').oninput = () => {
  S.name = $('#sn').value.trim().slice(0, 16) || 'Player';
  S.rd = +$('#sr').value;
  S.fov = +$('#sf').value;
  S.sens = +$('#ss').value;
  $('#srv').textContent = S.rd;
  const ao = $('#sao').checked ? 1 : 0;
  if (ao != S.ao) {
    S.ao = ao;
    if (W) W.chunks.forEach(c => W.dirty.add(c));
  }
  const fm = +$('#sfm').value;
  if (fm != S.fm) {
    S.fm = fm;
    lk = '';
    if (!FMUL()) lodClear();
  }
  $('#sfmv').textContent = fmLabel();
  S.mini = $('#smini').checked ? 1 : 0;
  S.clouds = $('#scl').checked ? 1 : 0;
  S.touch = $('#stc').value;
  saveS();
};
$('#settings').onchange = $('#settings').oninput;
const kname = c =>
  c
    .replace(/^Key|^Digit/, '')
    .replace(/Left$/, ' (L)')
    .replace(/Right$/, ' (R)');
let rebind = null;
function buildKeys() {
  const l = $('#kbl');
  l.textContent = '';
  for (const a in DK) {
    const r = document.createElement('div'),
      s = document.createElement('span');
    r.className = 'kb';
    s.textContent = KN[a];
    const b = btn(rebind == a ? 'Press a key… (Esc cancels)' : kname(S.keys[a]), () => {
      rebind = a;
      buildKeys();
    });
    if (rebind == a) b.className = 'wait';
    r.append(s, b);
    l.append(r);
  }
  $('#help').textContent =
    `${kname(S.keys.fwd)}${kname(S.keys.left)}${kname(S.keys.back)}${kname(S.keys.right)} move · ${kname(S.keys.jump)} jump (double-tap = fly) · hold ${kname(S.keys.sprint)} sprint · ${kname(S.keys.sneak)} descend · LMB break/hit · RMB place · 1-9 / wheel select · ${kname(S.keys.inv)} inventory · ${kname(S.keys.drop)} drop · ${kname(S.keys.chat)} chat · / commands · ${kname(S.keys.map)} map · ${kname(S.keys.view)} camera · ${kname(S.keys.shot)} screenshot · ${kname(S.keys.hud)} hide HUD · ${kname(S.keys.debug)} debug info`;
}
const resetKeys = () => {
  S.keys = { ...DK };
  rebind = null;
  saveS();
  buildKeys();
};
addEventListener(
  'keydown',
  e => {
    if (!rebind) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.code != 'Escape') {
      for (const a in S.keys) if (S.keys[a] == e.code) S.keys[a] = S.keys[rebind];
      S.keys[rebind] = e.code;
      saveS();
    }
    rebind = null;
    buildKeys();
  },
  true,
);
const back = () => {
  rebind = null;
  buildKeys();
  show(W ? 'pause' : 'menu');
};
buildKeys();
