/* Preferences that belong to the person, not the quilt: theme, text size, the colour around the
   quilt, tool labels, the canvas HUD, and whether the welcome screen has been seen. Kept in their
   own slot (quiltthing.v4.prefs), separate from the design and from v3's view state. */

const PREFS_KEY = 'quiltthing.v4.prefs';
const SURROUNDS = { mid: ['Mid grey', '#808080'], theme: ['Match the theme', ''], light: ['Light grey', '#d4d4d4'], white: ['White', '#ffffff'], dark: ['Dark grey', '#3a3a3a'] };
const prefs = (() => {
  const d = { theme: 'dark', density: 'standard', surround: 'mid', toolLabels: true, hud: {}, welcomed: false, rulers: false };
  try { return { ...d, ...(JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}) }; } catch { return d; }
})();
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {} }
function applyPrefs() {
  const r = document.documentElement;
  r.dataset.theme = prefs.theme === 'light' ? 'light' : 'dark';
  r.dataset.density = prefs.density === 'large' ? 'large' : 'standard';
  r.dataset.toolLabels = prefs.toolLabels ? '1' : '';
  const s = SURROUNDS[prefs.surround] || SURROUNDS.mid;
  r.style.setProperty('--surround', s[1] || 'var(--surround-theme)');
}
applyPrefs();

Actions.setTheme = t => { prefs.theme = t === 'light' ? 'light' : t === 'toggle' ? (prefs.theme === 'light' ? 'dark' : 'light') : 'dark'; savePrefs(); applyPrefs(); render(); };
Actions.setDensity = d => { prefs.density = d === 'large' ? 'large' : 'standard'; savePrefs(); applyPrefs(); render(); };
Actions.setSurround = s => { if (SURROUNDS[s]) { prefs.surround = s; savePrefs(); applyPrefs(); render(); } };
Actions.toggleToolLabels = () => { prefs.toolLabels = !prefs.toolLabels; savePrefs(); applyPrefs(); render(); };
