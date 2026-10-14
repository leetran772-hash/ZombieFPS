// Zombies: one body (boxes) with random skin and clothes. They wander, hear gunfire, chase, and bite.
import * as THREE from 'three'
import { ctx } from './ctx.js'
import { hurt, vit } from './state.js'

const SKIN = ['#a9c28c', '#9fb87f', '#b5c99a', '#bcc7a0']
const CLOTH = ['#cfe4d6', '#d9e3ef', '#f3d6d6', '#8f8aa8', '#4a6fa5', '#b58a4a', '#c8603f', '#3f8f86', '#e8d6a3']
const PANTS = ['#4a6fa5', '#3d4658', '#8a8a5a', '#5bc0de', '#6a5a4a']
const box = new THREE.BoxGeometry(1, 1, 1)
const mats = new Map()
const mat = hex => { let m = mats.get(hex); if (!m) { m = new THREE.MeshToonMaterial({ color: hex, gradientMap: ctx.ramp }); mats.set(hex, m) } return m }
const pick = (r, a) => a[Math.floor(r() * a.length)]

function part(w, h, d, hex, x, y, z) {
  const m = new THREE.Mesh(box, mat(hex)); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true
  return m
}

export function spawn(x, z, r) {
  const skin = pick(r, SKIN), shirt = pick(r, CLOTH), pants = pick(r, PANTS)
  const g = new THREE.Group()
  const sc = 0.92 + r() * 0.2
  g.scale.setScalar(sc)
  g.add(part(0.52, 0.7, 0.28, shirt, 0, 1.12, 0))
  const head = part(0.3, 0.3, 0.3, skin, 0, 1.64, 0); g.add(head)
  g.add(part(0.34, 0.1, 0.34, pick(r, ['#3a2a22', '#6a4a30', '#2a2230', '#c9b07a']), 0, 1.82, 0))
  const mk = (px, hex, pivotY, len, w) => { const p = new THREE.Group(); p.position.set(px, pivotY, 0); const m = part(w, len, w, hex, 0, -len / 2, 0); p.add(m); g.add(p); return p }
  const legL = mk(-0.14, pants, 0.78, 0.78, 0.2), legR = mk(0.14, pants, 0.78, 0.78, 0.2)
  const armL = mk(-0.34, skin, 1.4, 0.62, 0.16), armR = mk(0.34, skin, 1.4, 0.62, 0.16)
  armL.rotation.x = armR.rotation.x = -1.35
  g.position.set(x, 0, z)
  ctx.scene.add(g)
  const z0 = { g, x, z, home: { x, z }, hp: 90, state: 'idle', t: r() * 10, wander: { x, z }, wanderT: 0, atk: 0, windup: 0, dead: false, deadT: 0, stun: 0, parts: { legL, legR, armL, armR }, speed: 0, face: r() * 6.28, alert: 0 }
  ctx.zombies.push(z0)
  return z0
}

function die(z) {
  z.dead = true; z.deadT = 0
  if (Math.random() < 0.55) ctx.dropLoot(z.x, z.z, 'zombie')
}

export function hit(z, dmg, head) {
  if (z.dead) return false
  z.hp -= dmg * (head ? 2.4 : 1)
  z.stun = 0.25
  z.state = 'chase'; z.alert = 12
  if (z.hp <= 0) { die(z); return true }
  return false
}

/** Ray against zombies: a body cylinder and a head sphere. Returns {z, dist, head} for the nearest. */
export function rayZombies(o, d, max) {
  let best = null
  for (const z of ctx.zombies) {
    if (z.dead) continue
    // head sphere at 1.7m
    const hy = 1.72 * z.g.scale.y
    const tc = { x: z.x - o.x, y: hy - o.y, z: z.z - o.z }
    const proj = tc.x * d.x + tc.y * d.y + tc.z * d.z
    if (proj > 0 && proj < max) {
      const px = tc.x - d.x * proj, py = tc.y - d.y * proj, pz = tc.z - d.z * proj
      if (px * px + py * py + pz * pz < 0.26 * 0.26 && (!best || proj < best.dist)) best = { z, dist: proj, head: true }
    }
    // body: vertical cylinder radius .38, from the ground to 1.5m
    const dx = z.x - o.x, dz = z.z - o.z
    const h2 = d.x * d.x + d.z * d.z
    if (h2 > 1e-6) {
      const t = (dx * d.x + dz * d.z) / h2
      if (t > 0 && t < max) {
        const cx = o.x + d.x * t - z.x, cz = o.z + d.z * t - z.z
        const y = o.y + d.y * t
        if (cx * cx + cz * cz < 0.38 * 0.38 && y > 0 && y < 1.5 * z.g.scale.y && (!best || t < best.dist)) best = { z, dist: t, head: false }
      }
    }
  }
  return best
}

export function alertAt(x, z, radius) {
  for (const k of ctx.zombies) {
    if (k.dead) continue
    if (Math.hypot(k.x - x, k.z - z) < radius) { k.state = 'chase'; k.alert = 14 }
  }
}

export function update(dt, p) {
  for (let i = ctx.zombies.length - 1; i >= 0; i--) {
    const z = ctx.zombies[i]
    z.t += dt
    if (z.dead) {
      z.deadT += dt
      const f = Math.min(1, z.deadT / 0.5)
      z.g.rotation.x = -f * 1.45
      z.g.position.y = f * 0.12
      if (z.deadT > 14) { ctx.scene.remove(z.g); ctx.zombies.splice(i, 1) }
      continue
    }
    if (z.stun > 0) { z.stun -= dt; continue }
    const dx = p.x - z.x, dz = p.z - z.z, dist = Math.hypot(dx, dz)
    // senses: close and awake, or a sprinting player nearby
    if (!vit.dead && z.state !== 'chase') {
      const see = dist < 16, hear = p.sprinting && dist < 26
      if (see || hear) { z.state = 'chase'; z.alert = 10 }
    }
    if (z.state === 'chase') {
      z.alert -= dt
      if (dist > 40 || z.alert <= 0 && dist > 14 || vit.dead) { z.state = 'idle'; z.alert = 0 }
    }
    let speed = 0, tx = z.x, tz = z.z
    if (z.state === 'chase' && !vit.dead) {
      tx = p.x; tz = p.z
      speed = 2.5
      z.face = Math.atan2(dx, dz)
      if (dist < 1.55) {
        speed = 0
        if (z.windup <= 0 && z.atk <= 0) z.windup = 0.45
      }
    } else {
      z.wanderT -= dt
      if (z.wanderT <= 0) {
        z.wanderT = 3 + Math.random() * 6
        const a = Math.random() * 6.28, r = Math.random() * 7
        z.wander = { x: z.home.x + Math.cos(a) * r, z: z.home.z + Math.sin(a) * r }
        z.paused = Math.random() < 0.4
      }
      if (!z.paused) {
        const wx = z.wander.x - z.x, wz = z.wander.z - z.z, wd = Math.hypot(wx, wz)
        if (wd > 0.6) { speed = 0.9; tx = z.wander.x; tz = z.wander.z; z.face = Math.atan2(wx, wz) }
      }
    }
    if (z.windup > 0) {
      z.windup -= dt
      if (z.windup <= 0) {
        z.atk = 1.1
        if (dist < 2.0 && !vit.dead) { hurt(13, { bleed: 0.25, leg: 0.04 }); ctx.onHurt?.() }
      }
    }
    if (z.atk > 0) z.atk -= dt
    if (speed > 0) {
      const d = Math.hypot(tx - z.x, tz - z.z) || 1
      z.x += ((tx - z.x) / d) * speed * dt
      z.z += ((tz - z.z) / d) * speed * dt
    }
    // push apart from neighbours and out of walls
    for (let j = 0; j < ctx.zombies.length; j++) {
      const o = ctx.zombies[j]
      if (o === z || o.dead) continue
      const ox = z.x - o.x, oz = z.z - o.z, od = Math.hypot(ox, oz)
      if (od < 0.7 && od > 1e-3) { z.x += (ox / od) * (0.7 - od) * 0.5; z.z += (oz / od) * (0.7 - od) * 0.5 }
    }
    const pos = { x: z.x, z: z.z }
    ctx.collideCircle(pos, 0.38)
    z.x = pos.x; z.z = pos.z
    // pose
    z.g.position.set(z.x, 0, z.z)
    let dy = z.face - z.g.rotation.y
    dy = Math.atan2(Math.sin(dy), Math.cos(dy))
    z.g.rotation.y += dy * Math.min(1, dt * 8)
    const swing = Math.sin(z.t * (speed > 1.5 ? 9 : 5)) * (speed > 0 ? 0.7 : 0.05)
    z.parts.legL.rotation.x = swing; z.parts.legR.rotation.x = -swing
    const lunge = z.windup > 0 ? -0.4 - (0.45 - z.windup) : 0
    z.parts.armL.rotation.x = -1.35 + lunge + Math.sin(z.t * 3) * 0.08
    z.parts.armR.rotation.x = -1.35 + lunge - Math.sin(z.t * 3) * 0.08
  }
}
