// Player state that is not about the world: what you wear and carry, and your body.
import { ITEMS, START } from './items.js'

export const SLOTS = ['hat', 'glasses', 'mask', 'shirt', 'vest', 'pants', 'backpack', 'primary', 'secondary', 'melee']
export const SLOT_LABEL = { hat: 'Hat', glasses: 'Glasses', mask: 'Mask', shirt: 'Shirt', vest: 'Vest', pants: 'Pants', backpack: 'Backpack', primary: 'Primary', secondary: 'Sidearm', melee: 'Melee' }
const STORAGE_SLOTS = ['shirt', 'vest', 'pants', 'backpack']

export const inv = { equip: Object.fromEntries(SLOTS.map(s => [s, null])), bag: [] }

const capOf = eq => 3 + STORAGE_SLOTS.reduce((a, s) => a + (eq[s] ? ITEMS[eq[s].id].slots : 0), 0)
export const capacity = () => capOf(inv.equip)
export const armor = () => Math.min(0.7, SLOTS.reduce((a, s) => a + (inv.equip[s] ? ITEMS[inv.equip[s].id].armor ?? 0 : 0), 0))
const gunExtra = id => (ITEMS[id].cat === 'gun' ? { mag: 0 } : {})

export function reset() {
  for (const s of SLOTS) inv.equip[s] = null
  inv.bag = []
  inv.equip.shirt = { id: START.shirt }
  inv.equip.pants = { id: START.pants }
  for (const [id, n] of START.bag) addItem(id, n)
}

/** Add to the bag, stacking ammo. Returns how many did not fit. */
export function addItem(id, n = 1, extra = null) {
  const def = ITEMS[id], stack = def.stack ?? 1
  let left = n
  if (stack > 1) for (const s of inv.bag) { if (left <= 0) break; if (s.id === id && s.n < stack) { const t = Math.min(stack - s.n, left); s.n += t; left -= t } }
  while (left > 0 && inv.bag.length < capacity()) {
    const t = Math.min(stack, left)
    inv.bag.push({ id, n: t, ...(extra ?? gunExtra(id)) })
    left -= t
  }
  return left
}
export const ammoCount = type => inv.bag.reduce((a, s) => a + (ITEMS[s.id].ammo === type ? s.n : 0), 0)
export function takeAmmo(type, want) {
  let got = 0
  for (const s of [...inv.bag]) {
    if (got >= want) break
    if (ITEMS[s.id].ammo !== type) continue
    const t = Math.min(s.n, want - got)
    s.n -= t; got += t
    if (s.n <= 0) inv.bag.splice(inv.bag.indexOf(s), 1)
  }
  return got
}

/** Wear or wield the item at bag[i]. The item that was there goes back to the bag. */
export function equipFromBag(i) {
  const item = inv.bag[i]
  if (!item) return { ok: false }
  const def = ITEMS[item.id], slot = def.slot
  if (!slot) return { ok: false }
  const bag = inv.bag.filter((_, k) => k !== i)
  const prev = inv.equip[slot]
  const eq = { ...inv.equip, [slot]: item }
  const next = prev ? [...bag, prev] : bag
  if (next.length > capOf(eq)) return { ok: false, msg: 'Not enough space' }
  inv.bag = next
  inv.equip = eq
  return { ok: true, slot }
}
export function unequip(slot) {
  const item = inv.equip[slot]
  if (!item) return { ok: false }
  const eq = { ...inv.equip, [slot]: null }
  const next = [...inv.bag, item]
  if (next.length > capOf(eq)) return { ok: false, msg: 'Not enough space' }
  inv.bag = next
  inv.equip = eq
  return { ok: true }
}
export function removeAt(i, n = 1) {
  const s = inv.bag[i]
  if (!s) return null
  const out = { ...s, n: Math.min(n, s.n) }
  s.n -= out.n
  if (s.n <= 0) inv.bag.splice(i, 1)
  return out
}

// ---------- the body
export const vit = { health: 100, food: 100, water: 100, stamina: 100, bleeding: false, leg: false, dead: false, lastHit: 0 }
export function resetVitals() { Object.assign(vit, { health: 100, food: 90, water: 90, stamina: 100, bleeding: false, leg: false, dead: false, lastHit: 0 }) }

export function tickVitals(dt, { sprinting }) {
  if (vit.dead) return
  vit.food = Math.max(0, vit.food - 0.032 * dt)
  vit.water = Math.max(0, vit.water - (0.055 + (sprinting ? 0.05 : 0)) * dt)
  if (sprinting) vit.stamina = Math.max(0, vit.stamina - 14 * dt)
  else vit.stamina = Math.min(100, vit.stamina + 11 * dt)
  let hp = 0
  if (vit.food <= 0) hp -= 0.4
  if (vit.water <= 0) hp -= 0.6
  if (vit.bleeding) hp -= 1.3
  if (hp === 0 && vit.food > 55 && vit.water > 55) hp += 0.25
  vit.health = Math.min(100, vit.health + hp * dt)
  vit.lastHit += dt
  if (vit.health <= 0) { vit.health = 0; vit.dead = true }
}
/** Armor is applied here. Returns the damage actually taken. */
export function hurt(amount, { bleed = 0, leg = 0 } = {}) {
  if (vit.dead) return 0
  const taken = amount * (1 - armor())
  vit.health = Math.max(0, vit.health - taken)
  vit.lastHit = 0
  if (Math.random() < bleed * (1 - armor())) vit.bleeding = true
  if (Math.random() < leg) vit.leg = true
  if (vit.health <= 0) vit.dead = true
  return taken
}
export function useItem(i) {
  const s = inv.bag[i]
  if (!s) return null
  const d = ITEMS[s.id]
  if (!['food', 'drink', 'medical'].includes(d.cat)) return null
  if (d.food) vit.food = Math.min(100, vit.food + d.food)
  if (d.water) vit.water = Math.min(100, vit.water + d.water)
  if (d.thirst) vit.water = Math.max(0, vit.water + d.thirst)
  if (d.heal) vit.health = Math.min(100, vit.health + d.heal)
  if (d.stopBleed) vit.bleeding = false
  if (d.fixLeg) vit.leg = false
  removeAt(i, 1)
  return d
}
