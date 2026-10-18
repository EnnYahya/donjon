// DOM user interface: HUD, menus, inventory, death screen.
import { ITEMS } from './items.js';
import { RARITY } from './items.js';
import { MAX_FLOOR, tierFor, floorName } from './config.js';
import { LV_CAP } from './player.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'warn', 'settings', 'how', 'credits', 'pause', 'inv', 'death', 'clickResume', 'fatal'];

export class UI {
  constructor(game) {
    this.g = game; this.el = {};
    for (const id of ['hud', 'floorLabel', 'tierLabel', 'hpFill', 'hpText', 'stFill', 'gWeapon', 'gLight', 'gKeys', 'buffs', 'lightFill', 'prompt', 'toasts', 'bossBar', 'bossName', 'bossFill', 'banner', 'bnTitle', 'bnSub', 'hitm', 'hurt', 'fade', 'ending', 'endText', 'bCont', 'metaLine'])
      this.el[id] = $(id);
    this.stBar = document.querySelector('.bar.st');
    this.hurtA = 0; this.promptHtml = ''; this.sel = -1; this.last = {};
  }
  screen(id) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }
  hideScreens() { for (const s of SCREENS) $(s).classList.add('hidden'); }
  hud(on) { this.el.hud.classList.toggle('hidden', !on); }

  toast(msg, color = '#d8cfc0') {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; d.style.color = color;
    this.el.toasts.appendChild(d); setTimeout(() => d.remove(), 3300);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  }
  hurtFlash(a) { this.hurtA = Math.max(this.hurtA, a); }
  hitMarker(kill) { const h = this.el.hitm; h.className = 'on' + (kill ? ' kill' : ''); void h.offsetWidth; setTimeout(() => { h.className = ''; }, 60); }
  flashStamina() { this.stBar.classList.add('flash'); setTimeout(() => this.stBar.classList.remove('flash'), 220); }
  prompt(html) { if (html === this.promptHtml) return; this.promptHtml = html; this.el.prompt.innerHTML = html || ''; }
  boss(name, pct) {
    const b = this.el.bossBar;
    if (name === null) { if (!b.classList.contains('hidden')) b.classList.add('hidden'); return; }
    b.classList.remove('hidden'); if (this.last.bn !== name) { this.el.bossName.textContent = name; this.last.bn = name; }
    this.el.bossFill.style.width = Math.max(0, pct * 100) + '%';
  }
  banner(title, sub, ms = 4000) {
    const b = this.el.banner; b.classList.add('hidden'); void b.offsetWidth;
    this.el.bnTitle.textContent = title; this.el.bnSub.textContent = sub || '';
    b.style.animationDuration = ms + 'ms'; b.classList.remove('hidden');
    clearTimeout(this.bt); this.bt = setTimeout(() => b.classList.add('hidden'), ms);
  }
  fade(a, ms = 600) { this.el.fade.style.transition = `opacity ${ms}ms`; this.el.fade.style.opacity = a; }

  updateHud(dt) {
    const g = this.g, p = g.player, e = this.el;
    this.hurtA = Math.max(0, this.hurtA - dt * 1.6); e.hurt.style.opacity = Math.max(this.hurtA, p.hp < p.maxHp * 0.25 ? 0.25 + 0.15 * Math.sin(g.time * 5) : 0);
    const hp = Math.ceil(p.hp);
    if (this.last.hp !== hp || this.last.mhp !== p.maxHp) { e.hpFill.style.width = (p.hp / p.maxHp * 100) + '%'; e.hpText.textContent = hp + ' / ' + Math.round(p.maxHp); this.last.hp = hp; this.last.mhp = p.maxHp; }
    e.stFill.style.width = (p.stamina / p.maxStamina * 100) + '%'; e.stFill.style.opacity = p.exhausted ? 0.45 : 1;
    const w = g.combat.weapon(); const ammo = w.ranged ? ` (${g.inv.count('arrows')})` : '';
    const wtxt = w.name + ammo; if (this.last.w !== wtxt) { e.gWeapon.textContent = wtxt; this.last.w = wtxt; }
    const torch = p.buffs.torch > 0;
    e.lightFill.style.width = (torch ? 100 : p.fuel) + '%';
    const lt = torch ? `Torch ${Math.ceil(p.buffs.torch)}s` : (p.fuel <= 0 ? 'Lantern dead' : 'Lantern ' + Math.ceil(p.fuel) + '%');
    if (this.last.l !== lt) { e.gLight.textContent = lt; this.last.l = lt; }
    const k = g.inv.keys; const kt = [k.stairs ? 'Iron Key x' + k.stairs : '', k.vault ? 'Bone Key x' + k.vault : ''].filter(Boolean).join('  ');
    if (this.last.k !== kt) { e.gKeys.textContent = kt; this.last.k = kt; }
    const names = { vigor: 'Vigor', sharp: 'Sharpened', hush: 'Hushed', iron: 'Ironskin' };
    const sn = { poison: 'Poisoned', bleed: 'Bleeding', burn: 'Burning', slow: 'Slowed', dim: 'Light fading' };
    const bt = Object.keys(p.buffs).filter(b => names[b]).map(b => `${names[b]} ${Math.ceil(p.buffs[b])}s`).concat(Object.keys(sn).filter(k => p.status[k] > 0).map(k => `<span style="color:#d07060">${sn[k]}</span>`)).join(' · ');
    if (this.last.b !== bt) { e.buffs.innerHTML = bt; this.last.b = bt; }
    const ph = $('pointsHud'); if (ph && this.last.pts !== p.points) { this.last.pts = p.points; ph.textContent = p.points > 0 ? `\u2605 ${p.points} level point${p.points > 1 ? 's' : ''} to spend (Tab)` : ''; ph.classList.toggle('hidden', p.points <= 0); }
  }
  compass(show, angle, dist) {
    const c = $('compass'); if (!show) { if (!c.classList.contains('hidden')) c.classList.add('hidden'); return; }
    c.classList.remove('hidden'); $('compassArrow').style.transform = `rotate(${angle}rad)`; $('compassDist').textContent = Math.round(dist) + ' m';
  }
  drawMap(game) {
    const w = game.world, cv = $('mapCanvas'), g = cv.getContext('2d'), p = game.player; if (!w.explored) return;
    const cs = Math.max(2, Math.floor(Math.min(cv.width / w.w, cv.height / w.h))), ox = Math.floor((cv.width - cs * w.w) / 2), oy = Math.floor((cv.height - cs * w.h) / 2);
    g.fillStyle = '#080605'; g.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      if (!w.explored[y * w.w + x]) continue;
      const t = w.t[y * w.w + x]; let col = '#4a3c2e';
      if (t === 0) col = '#1c1612'; else if (t === 2) col = '#8a6a3a'; else if (t === 3) col = '#a03030'; else if (t === 4) col = '#1c1612';
      g.fillStyle = col; g.fillRect(ox + x * cs, oy + y * cs, cs, cs);
    }
    const px = ox + (p.x / 3) * cs, py = oy + (p.z / 3) * cs;
    g.save(); g.translate(px, py); g.rotate(-p.yaw); g.fillStyle = '#ffd060'; g.beginPath(); g.moveTo(0, -cs * 0.9); g.lineTo(cs * 0.6, cs * 0.6); g.lineTo(-cs * 0.6, cs * 0.6); g.closePath(); g.fill(); g.restore();
  }
  setFloor(f) {
    this.el.floorLabel.textContent = `FLOOR ${f} / ${MAX_FLOOR}`; this.el.tierLabel.textContent = floorName(f) + ' · ' + tierFor(f).name;
  }

  // ---------- inventory
  rarityColor(id) { return RARITY[ITEMS[id].rarity].color; }
  renderInventory() {
    const g = this.g, inv = g.inv, p = g.player;
    $('invCount').textContent = `${inv.slots.length} / ${inv.max}`;
    const eqEl = { weapon: $('eqWeapon'), armor: $('eqArmor'), charm: $('eqCharm') };
    for (const slot of ['weapon', 'armor', 'charm']) {
      const id = inv.eq[slot], el = eqEl[slot];
      const label = { weapon: 'Weapon', armor: 'Armor', charm: 'Charm' }[slot];
      el.innerHTML = `<small>${label}</small>` + (id ? `<span style="color:${this.rarityColor(id)}">${ITEMS[id].name}</span>` : '<span style="color:#554">—</span>');
      el.onclick = () => { if (id) { this.msg(inv.unequip(slot, g)); g.audio.play('inv'); this.renderInventory(); } };
    }
    $('invKeys').textContent = (inv.keys.stairs || inv.keys.vault) ? `Rusted Iron Key x${inv.keys.stairs}, Bone Key x${inv.keys.vault}` : 'None';
    const a = p.armorDef();
    $('invStats').innerHTML = `Health ${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}<br>Damage taken -${Math.round(((a ? a.def : 0) + (p.buffs.iron > 0 ? 0.35 : 0)) * 100)}%<br>Weapon damage ${Math.round(g.combat.weapon().dmg * g.combat.dmgMul())}<br>Arrows ${inv.count('arrows')}`;
    $('lvPts').textContent = `(${p.points} point${p.points === 1 ? '' : 's'})`;
    const lvp = $('lvPanel'); lvp.innerHTML = '';
    for (const [k, name, tip] of [['atk', 'Attack', '+4% damage'], ['def', 'Defense', '-2.5% damage taken'], ['spd', 'Speed', '+2% move speed'], ['vig', 'Vigor', '+8 health, +5 stamina']]) {
      const row = document.createElement('div'); row.className = 'lvrow'; row.title = tip + ' per level';
      row.innerHTML = `<b>${name}</b><span class="pips">${'\u25cf'.repeat(p.lv[k])}${'\u25cb'.repeat(LV_CAP - p.lv[k])}</span>`;
      const b = document.createElement('button'); b.textContent = '+'; b.disabled = p.points <= 0 || p.lv[k] >= LV_CAP;
      b.onclick = () => { if (p.spend(k)) { g.audio.play('pickup'); this.renderInventory(); } }; row.appendChild(b); lvp.appendChild(row);
    }
    const slots = $('slots'); slots.innerHTML = '';
    for (let i = 0; i < inv.max; i++) {
      const s = inv.slots[i], d = document.createElement('div');
      if (!s) { d.className = 'slot empty'; d.innerHTML = '&nbsp;'; }
      else {
        const it = ITEMS[s.id]; d.className = 'slot' + (i === this.sel ? ' sel' : '');
        d.innerHTML = `<span style="color:${this.rarityColor(s.id)}" class="${it.cursed ? 'curse' : ''}">${it.name}</span>` + (s.n > 1 ? `<span class="n">x${s.n}</span>` : '');
        d.onclick = () => { this.sel = i; g.audio.play('click'); this.renderInventory(); };
      }
      slots.appendChild(d);
    }
    const det = $('detail'), s = inv.slots[this.sel];
    if (!s) { det.innerHTML = '<p class="meta">Select an item.</p>'; return; }
    const it = ITEMS[s.id], eq = ['weapon', 'armor', 'charm'].includes(it.type);
    let extra = '';
    if (it.type === 'weapon') extra = `<p class="meta">Damage ${it.dmg} · Reach ${it.range} · Stamina ${it.cost} · Speed ${it.cd}s${it.ranged ? ' · Ranged' : ''}</p>`;
    det.innerHTML = `<h4 style="color:${this.rarityColor(s.id)}">${it.name}</h4><div class="meta">${RARITY[it.rarity].name} ${it.type}</div><p class="${it.cursed ? 'curse' : ''}">${it.desc}</p>${extra}`
      + (it.type !== 'ammo' && it.type !== 'passive' ? `<button id="bUse">${eq ? 'Equip' : 'Use'}</button>` : '') + '<button id="bDrop" class="ghost">Drop</button><p id="invMsg" class="meta"></p>';
    const use = $('bUse'); if (use) use.onclick = () => { const m = inv.use(this.sel, g); this.sel = Math.min(this.sel, inv.slots.length - 1); g.audio.play('inv'); this.renderInventory(); this.msg(m); };
    $('bDrop').onclick = () => { inv.drop(this.sel, g); this.sel = Math.min(this.sel, inv.slots.length - 1); this.renderInventory(); };
  }
  msg(t) { const m = $('invMsg'); if (m) m.textContent = t || ''; }

  showDeath(d) {
    $('deathCause').textContent = d.cause;
    $('deathStats').innerHTML = [
      ['Floor reached', `${d.floor} / ${MAX_FLOOR}`], ['Deepest ever', d.best], ['Time survived', d.time], ['Monsters slain', d.kills],
      ['Chests opened', d.chests], ['Loop', d.cycle + 1],
    ].map(([a, b]) => `<div><span>${a}</span><br>${b}</div>`).join('');
    this.screen('death');
  }
  menuInfo(meta, run) {
    this.el.bCont.disabled = !run;
    this.el.bCont.textContent = run ? `Continue Run (Floor ${run.floor})` : 'Continue Run';
    this.el.metaLine.textContent = `Deepest floor: ${meta.bestFloor || '-'}   ·   Loops completed: ${meta.cycles}   ·   Deaths: ${meta.deaths}`;
  }
  ending(text, show) { this.el.endText.innerHTML = text; this.el.endText.style.opacity = show ? 1 : 0; }
}
