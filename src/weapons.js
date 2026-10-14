// Held weapons: a viewmodel on the camera, hit-scan guns with recoil and reloads, and melee swings.
import * as THREE from 'three'
import { ctx } from './ctx.js'
import { inv, takeAmmo, ammoCount } from './state.js'
import { ITEMS } from './items.js'
import { hit, rayZombies, alertAt } from './zombies.js'

export const wp = { sel: null, cd: 0, reload: 0, reloadMax: 1, kick: 0, swing: 0, swingHit: false, flash: 0, bob: 0 }
const root = new THREE.Group()
const models = new Map()
const box = new THREE.BoxGeometry(1, 1, 1)
const SKIN = '#e8c9a0'
const toon = hex => new THREE.MeshToonMaterial({ color: hex, gradientMap: ctx.ramp })
const part = (w, h, d, hex, x, y, z) => { const m = new THREE.Mesh(box, toon(hex)); m.scale.set(w, h, d); m.position.set(x, y, z); return m }
let flashMesh = null

function build(id) {
  const g = new THREE.Group()
  const d = id ? ITEMS[id] : null
  if (!d) { // fists
    g.add(part(0.06, 0.06, 0.1, SKIN, 0.17, -0.27, -0.55), part(0.06, 0.06, 0.1, SKIN, -0.17, -0.27, -0.55))
    return g
  }
  if (d.cat === 'melee') {
    const len = id === 'bat' ? 0.95 : 0.7
    const shaft = part(0.05, 0.05, len, d.color, 0.22, -0.16, -0.5)
    shaft.rotation.x = 0.35
    g.add(shaft, part(0.09, 0.09, 0.14, SKIN, 0.22, -0.2, -0.3))
    return g
  }
  const dark = '#2a2e38'
  const L = id === 'pistol' ? 0.3 : id === 'shotgun' ? 0.78 : 0.95
  g.add(part(0.065, 0.1, L, d.color, 0.2, -0.18, -0.35 - L / 2))
  g.add(part(0.04, 0.04, L * 0.45, dark, 0.2, -0.15, -0.35 - L * 0.9))
  g.add(part(0.06, 0.16, 0.08, dark, 0.2, -0.28, -0.32))
  if (id !== 'pistol') g.add(part(0.07, 0.12, 0.25, id === 'shotgun' ? '#5a4636' : d.color, 0.2, -0.2, -0.26))
  g.add(part(0.09, 0.09, 0.14, SKIN, 0.2, -0.26, -0.32))
  const tip = part(0.1, 0.1, 0.12, '#ffd36a', 0.2, -0.15, -0.35 - L - 0.05)
  tip.material = new THREE.MeshBasicMaterial({ color: '#ffe08a' })
  tip.visible = false; tip.name = 'flash'
  g.add(tip)
  return g
}

let shown = null
function show(id) {
  if (shown?.id === id) return
  if (shown) root.remove(shown.g)
  let g = models.get(id ?? '_fists')
  if (!g) { g = build(id); models.set(id ?? '_fists', g) }
  root.add(g)
  shown = { id, g }
  flashMesh = g.getObjectByName('flash') ?? null
}

export function init() {
  ctx.camera.add(root)
  root.position.set(0.0, 0, 0)
  show(null)
}

export const held = () => (wp.sel ? inv.equip[wp.sel] : null)
export function select(slot) {
  if (slot && !inv.equip[slot]) slot = null
  wp.sel = slot
  wp.reload = 0
  wp.cd = 0.25
}
export function info() {
  const it = held()
  if (!it) return { name: wp.sel ? '' : 'Fists', mag: null }
  const d = ITEMS[it.id]
  if (d.cat === 'gun') return { name: d.name, mag: it.mag, reserve: ammoCount(d.ammo), reloading: wp.reload > 0 }
  return { name: d.name, mag: null }
}

export function startReload() {
  const it = held()
  if (!it) return
  const d = ITEMS[it.id]
  if (d.cat !== 'gun' || wp.reload > 0 || it.mag >= d.mag || ammoCount(d.ammo) <= 0) return
  wp.reload = wp.reloadMax = d.reload
}

const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
function aimVectors() {
  const p = ctx.player
  fwd.set(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)).normalize()
  right.crossVectors(fwd, up).normalize()
  return fwd
}

function shootGun(it, d) {
  const p = ctx.player
  wp.cd = 60 / d.rpm
  it.mag--
  wp.kick = 1; wp.flash = 0.06
  const o = { x: p.x, y: p.y, z: p.z }
  aimVectors()
  const moving = p.moving ? 0.012 : 0
  let anyKill = false, anyHit = false, anyHead = false
  for (let i = 0; i < d.pellets; i++) {
    const s = d.spread + moving
    const dir = new THREE.Vector3().copy(fwd)
    const upv = new THREE.Vector3().crossVectors(right, fwd).normalize()
    dir.addScaledVector(right, (Math.random() - 0.5) * 2 * s).addScaledVector(upv, (Math.random() - 0.5) * 2 * s).normalize()
    const wd = ctx.rayWorld(o, dir, d.range)
    const zh = rayZombies(o, dir, Math.min(d.range, wd))
    let end = Math.min(wd, d.range)
    if (zh) {
      end = zh.dist
      const killed = hit(zh.z, d.dmg, zh.head)
      anyHit = true; anyKill = anyKill || killed; anyHead = anyHead || zh.head
      ctx.fx.puff(o.x + dir.x * end, o.y + dir.y * end, o.z + dir.z * end, '#a8323a', 6)
    } else if (wd < d.range) ctx.fx.puff(o.x + dir.x * end, o.y + dir.y * end, o.z + dir.z * end, '#e8dcc0', 4)
    const m = { x: o.x + right.x * 0.2 + fwd.x * 0.6, y: o.y - 0.15, z: o.z + right.z * 0.2 + fwd.z * 0.6 }
    ctx.fx.tracer(m, { x: o.x + dir.x * end, y: o.y + dir.y * end, z: o.z + dir.z * end })
  }
  if (anyHit) ctx.hitMarker?.(anyKill, anyHead)
  p.pitch += d.recoil * (0.7 + Math.random() * 0.6)
  p.yaw += (Math.random() - 0.5) * d.recoil * 0.6
  alertAt(p.x, p.z, d.noise)
}

function swingMelee() {
  const it = held()
  const d = it ? ITEMS[it.id] : { dmg: 9, rate: 0.5, range: 1.9, name: 'Fists' }
  const p = ctx.player
  aimVectors()
  let best = null, bd = d.range
  for (const z of ctx.zombies) {
    if (z.dead) continue
    const dx = z.x - p.x, dz = z.z - p.z, dist = Math.hypot(dx, dz)
    if (dist > bd) continue
    if ((dx * fwd.x + dz * fwd.z) / (dist * Math.hypot(fwd.x, fwd.z) || 1) < 0.55) continue
    if (ctx.rayWorld({ x: p.x, y: p.y, z: p.z }, { x: dx / dist, y: 0, z: dz / dist }, dist) < dist - 0.3) continue
    bd = dist; best = z
  }
  if (best) {
    const killed = hit(best, d.dmg, false)
    ctx.fx.puff(best.x, 1.3, best.z, '#a8323a', 7)
    ctx.hitMarker?.(killed, false)
  }
  alertAt(p.x, p.z, 14)
}

/** pressed: true on the frame the button went down; down: the button is held. */
export function trigger(pressed, down) {
  const it = held()
  if (wp.cd > 0 || wp.reload > 0 || wp.swing > 0) return
  if (!it || ITEMS[it.id].cat === 'melee') {
    if (!pressed) return
    wp.swing = 0.36; wp.swingHit = false
    wp.cd = (it ? ITEMS[it.id].rate : 0.5)
    return
  }
  const d = ITEMS[it.id]
  if (!(pressed || (down && d.auto))) return
  if (it.mag <= 0) {
    if (pressed) { if (ammoCount(d.ammo) > 0) startReload(); else ctx.toast('Out of ammo') }
    return
  }
  shootGun(it, d)
}

export function update(dt) {
  show(held() && ITEMS[held().id].cat !== 'ammo' ? held().id : null)
  if (wp.cd > 0) wp.cd -= dt
  if (wp.flash > 0) wp.flash -= dt
  if (flashMesh) flashMesh.visible = wp.flash > 0
  wp.kick = Math.max(0, wp.kick - dt * 7)
  if (wp.swing > 0) {
    wp.swing -= dt
    if (!wp.swingHit && wp.swing < 0.2) { wp.swingHit = true; swingMelee() }
  }
  if (wp.reload > 0) {
    wp.reload -= dt
    if (wp.reload <= 0) {
      const it = held()
      if (it) {
        const d = ITEMS[it.id]
        const got = takeAmmo(d.ammo, d.mag - it.mag)
        it.mag += got
      }
    }
  }
  // pose: bob with movement, kick back, dip while reloading, swing arc for melee
  const p = ctx.player
  wp.bob += dt * (p.moving ? (p.sprinting ? 12 : 8) : 1.5)
  const bobAmp = p.moving ? 0.012 : 0.003
  let rx = 0, ry = 0, rz = 0, px = 0, py = Math.sin(wp.bob) * bobAmp, pz = 0
  px += Math.cos(wp.bob * 0.5) * bobAmp
  pz += wp.kick * 0.07
  rx += wp.kick * 0.1
  if (wp.reload > 0) { const t = 1 - wp.reload / wp.reloadMax; py -= Math.sin(t * Math.PI) * 0.18; rx -= Math.sin(t * Math.PI) * 0.6 }
  if (wp.swing > 0) { const t = 1 - wp.swing / 0.36; rx += -Math.sin(t * Math.PI) * 1.1; ry += Math.sin(t * Math.PI) * 0.5; px -= Math.sin(t * Math.PI) * 0.2 }
  if (p.sprinting && p.moving) { rx += 0.25; ry += -0.4; py -= 0.06 }
  root.scale.setScalar(0.62)
  root.position.set(px + 0.07, py - 0.02, pz - 0.05)
  root.rotation.set(rx, ry, rz)
}
