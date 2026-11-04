/*
 * Seasons. W.time counts days (1 day = DAY seconds); each season lasts SEASON_DAYS days.
 * What changes depends on the zone: forests turn orange/red/yellow then snowy, fields go yellow then white,
 * mountains stay the same all year, oceans and beaches barely change. stint() returns a colour tint for a block face
 * and may set STX to swap the texture (e.g. snow on grass in winter). XR = x-ray mode (/xray).
 */

const DAY = 1200,
  SEASON_DAYS = 3,
  SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'],
  season = () => (!W || (W.opt && W.opt.seasons === false) ? 1 : Math.floor(W.time / SEASON_DAYS) % 4);
let STX = -1,
  XR = 0; // STX: texture override chosen by stint() (e.g. snow on grass in winter); XR: x-ray mode
function stint(b, f, zn, x, y, z, se) {
  STX = -1;
  if (zn == Z.MOUNTAIN || zn >= Z.UNDER || zn <= Z.SHALLOW) return null;
  if (b == 1) {
    if (se == 3) {
      if (f == 2) {
        STX = 40;
        return null;
      }
      return [0.92, 0.95, 1];
    }
    return f == 2 ? [[0.9, 1.1, 0.85], null, [1.6, 1.05, 0.45]][se] : null;
  } // tint only the grass top (sides have dirt in them)
  if (b == 7 || b == 11) {
    if (se == 3) {
      STX = 39;
      return null;
    }
    if (se == 2) {
      const k = hash(x, y, z, 9);
      return b == 11 ? [1.75, 1.25, 0.3] : k < 0.4 ? [1.75, 0.8, 0.35] : k < 0.7 ? [1.75, 0.5, 0.38] : [1.6, 1.3, 0.45];
    }
    return se == 0 ? [0.95, 1.15, 0.9] : null;
  }
  if (b == 13 && se == 3) return [1.3, 1.35, 1.4];
  return null;
}
