// HUD and the inventory screen, as plain DOM over the canvas.
import { ITEMS } from './items.js'
import { SLOTS, SLOT_LABEL, inv, capacity, armor, equipFromBag, unequip, useItem, removeAt } from './state.js'
import { ctx } from './ctx.js'

const $ = id => document.getElementById(id)
const abbr = n => n.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase()
let tipEl, invEl, hitEl, dmgEl, promptEl, toastEl, deathEl, barsEl, wepEl
export const ui = { open: false, onClose: () => {}, onRespawn: () => {} }

export function init() {
  const root = document.createElement('div')
  root.id = 'ui'
  root.innerHTML = `
    <div id="dmg"></div>
    <div id="hit"></div>
    <div id="prompt"></div>
    <div id="toasts"></div>
    <div id="bars"></div>
    <div id="wep"></div>
    <div id="inv" class="hidden"></div>
    <div id="death" class="hidden"></div>`
  document.body.appendChild(root)
  tipEl = null; invEl = $('inv'); hitEl = $('hit'); dmgEl = $('dmg'); promptEl = $('prompt'); toastEl = $('toasts'); deathEl = $('death'); barsEl = $('bars'); wepEl = $('wep')
}

export function toast(msg) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg
  toastEl.appendChild(d)
  setTimeout(() => d.classList.add('fade'), 1800)
  setTimeout(() => d.remove(), 2600)
  while (toastEl.children.length > 5) toastEl.firstChild.remove()
}
export function setPrompt(text) { promptEl.textContent = text ?? ''; promptEl.style.opacity = text ? 1 : 0 }
let hitT = 0
export function hitMarker(kill, head) {
  hitEl.className = kill ? 'kill' : head ? 'head' : 'on'
  clearTimeout(hitT); hitT = setTimeout(() => (hitEl.className = ''), kill ? 260 : 120)
}
let dmgT = 0
export function flashDamage() { dmgEl.style.opacity = 0.75; clearTimeout(dmgT); dmgT = setTimeout(() => (dmgEl.style.opacity = 0), 140) }

const bar = (label, v, col, warn) => `<div class="bar"><span>${label}</span><i><b style="width:${Math.max(0, Math.min(100, v))}%;background:${warn ? '#e0524c' : col}"></b></i></div>`
export function update(vit, w) {
  barsEl.innerHTML =
    bar('HP', vit.health, '#e0524c', vit.health < 25) +
    bar('FOOD', vit.food, '#e8b53a', vit.food < 15) +
    bar('WATER', vit.water, '#4ab3e8', vit.water < 15) +
    bar('STAM', vit.stamina, '#8fbf6a', false) +
    `<div class="flags">${vit.bleeding ? '<em class="bad">BLEEDING</em>' : ''}${vit.leg ? '<em class="bad">BROKEN LEG</em>' : ''}${armor() > 0 ? `<em>ARMOR ${Math.round(armor() * 100)}%</em>` : ''}</div>`
  let h = `<div class="wname">${w.name || ''}</div>`
  if (w.mag !== null && w.mag !== undefined) h += `<div class="ammo">${w.reloading ? 'RELOADING' : `${w.mag}<small> / ${w.reserve}</small>`}</div>`
  wepEl.innerHTML = h
}

// ---------- inventory
const cell = (it, extra = '') => {
  if (!it) return `<div class="cell empty ${extra}"></div>`
  const d = ITEMS[it.id]
  const n = it.n > 1 ? `<u>${it.n}</u>` : it.mag !== undefined && d.cat === 'gun' ? `<u>${it.mag}</u>` : ''
  return `<div class="cell ${extra}" style="--c:${d.color}" title="${d.name} - ${d.tip ?? ''}"><span>${abbr(d.name)}</span>${n}</div>`
}
export function renderInventory() {
  const cap = capacity()
  const eq = SLOTS.map(s => {
    const it = inv.equip[s]
    return `<div class="row" data-slot="${s}"><label>${SLOT_LABEL[s]}</label>${cell(it)}<span class="nm">${it ? ITEMS[it.id].name : '-'}</span></div>`
  }).join('')
  let cells = ''
  for (let i = 0; i < cap; i++) cells += cell(inv.bag[i], '').replace('class="cell', `data-i="${i}" class="cell`)
  invEl.innerHTML = `
    <div class="panel">
      <div class="col"><h2>Wearing</h2>${eq}<div class="arm">Armor ${Math.round(armor() * 100)}%</div></div>
      <div class="col"><h2>Bag <small>${inv.bag.length} / ${cap}</small></h2><div class="grid">${cells}</div>
        <div id="tip" class="tip">Click an item to use or wear it. Right-click drops it. Tab closes.</div></div>
    </div>`
  tipEl = $('tip')
  invEl.querySelectorAll('.cell[data-i]').forEach(el => {
    const i = Number(el.dataset.i)
    el.addEventListener('click', () => onBag(i))
    el.addEventListener('contextmenu', e => { e.preventDefault(); onDrop(i) })
    el.addEventListener('mouseenter', () => { const s = inv.bag[i]; if (s) tipEl.textContent = describe(s) })
  })
  invEl.querySelectorAll('.row').forEach(el => {
    el.addEventListener('click', () => { const r = unequip(el.dataset.slot); if (r.msg) toast(r.msg); ctx.onEquipChange?.(); renderInventory() })
    el.addEventListener('mouseenter', () => { const s = inv.equip[el.dataset.slot]; if (s) tipEl.textContent = describe(s) })
  })
}
function describe(s) {
  const d = ITEMS[s.id]
  const bits = []
  if (d.food) bits.push(`+${d.food} food`)
  if (d.water) bits.push(`+${d.water} water`)
  if (d.heal) bits.push(`+${d.heal} health`)
  if (d.dmg) bits.push(`${d.dmg}${d.pellets > 1 ? ' x' + d.pellets : ''} damage`)
  if (d.mag) bits.push(`${d.mag} rounds`)
  if (d.armor) bits.push(`armor ${Math.round(d.armor * 100)}%`)
  if (d.slots) bits.push(`+${d.slots} slots`)
  return `${d.name}${s.n > 1 ? ' x' + s.n : ''}: ${bits.join(', ')}${bits.length ? '. ' : ''}${d.tip ?? ''}`
}
function onBag(i) {
  const s = inv.bag[i]
  if (!s) return
  const d = ITEMS[s.id]
  if (['food', 'drink', 'medical'].includes(d.cat)) {
    const used = useItem(i)
    if (used) toast(`Used ${used.name}`)
  } else if (d.slot) {
    const r = equipFromBag(i)
    if (!r.ok) toast(r.msg ?? 'Cannot equip')
    else ctx.onEquipChange?.(r.slot)
  }
  renderInventory()
}
function onDrop(i) {
  const s = inv.bag[i]
  if (!s) return
  const out = removeAt(i, s.n)
  ctx.dropItem?.(out)
  toast(`Dropped ${ITEMS[out.id].name}`)
  renderInventory()
}
export function toggleInventory(force) {
  ui.open = force ?? !ui.open
  invEl.classList.toggle('hidden', !ui.open)
  if (ui.open) renderInventory()
  else ui.onClose()
}

export function showDeath(show, info = {}) {
  deathEl.classList.toggle('hidden', !show)
  if (show) {
    deathEl.innerHTML = `<div class="box"><h1>You died</h1><p>${info.cause ?? ''}</p><p>Survived ${info.time ?? ''}. Zombies put down: ${info.kills ?? 0}.</p><button id="again">Wake up somewhere new</button></div>`
    $('again').addEventListener('click', () => ui.onRespawn())
  }
}
