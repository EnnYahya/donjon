// localStorage persistence: settings, meta statistics and the active run (saved on entering a floor).
const SET = 'abyss_settings_v1', RUN = 'abyss_run_v1', META = 'abyss_meta_v1';
export const DEFAULT_SETTINGS = { sens: 1, volume: 0.7, quality: 'medium', shadows: false, effects: true, brightness: 1, smooth: 0.5, compass: 'auto', invMode: 'pause', seenWarning: false, scares: 'many' };

const rd = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };

export const loadSettings = () => ({ ...DEFAULT_SETTINGS, ...(rd(SET) || {}) });
export const saveSettings = (s) => wr(SET, s);
export const loadMeta = () => ({ cycles: 0, bestFloor: 0, deaths: 0, ...(rd(META) || {}) });
export const saveMeta = (m) => wr(META, m);
export const loadRun = () => rd(RUN);
export const saveRun = (r) => wr(RUN, r);
export const clearRun = () => { try { localStorage.removeItem(RUN); } catch (e) { /* ignore */ } };
