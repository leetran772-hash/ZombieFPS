// OC survival, milestone 2: houses you can enter, loot, clothes and armour, guns, zombies, hunger and thirst.
// Style rules: simple shapes, flat colour from a fixed palette, three-step toon shading, pastel haze.
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { ctx } from './ctx.js'
import { ITEMS, rollLoot } from './items.js'
import { inv, vit, reset as resetInv, resetVitals, tickVitals, addItem, SLOTS } from './state.js'
import * as Z from './zombies.js'
import * as W from './weapons.js'
import * as UI from './ui.js'

// ---------- seed
const params = new URLSearchParams(location.search)
let seed = Number(params.get('seed')) || 20261013
const mulberry = s => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

// ---------- palette (the style: a short, fixed list)
const PAL = {
  stucco: ['#f3e5cb', '#f4cdaa', '#ead8a4', '#cfe4d6', '#f3d6d6', '#d9e3ef', '#f1dfc4'],
  roof: ['#c8603f', '#b5523b', '#a2503a', '#7e93a6', '#d27a4a'],
  trim: '#fff8ea', door: ['#4a6fa5', '#b5523b', '#3f8f86', '#e0a63a'], glass: '#9cc9e6',
  grass: ['#92c26d', '#a6cb7a', '#86b862'], road: '#4d515c', walk: '#dbd6ca', line: '#f4e9b8',
  concrete: '#bdb8ae', palmTrunk: '#a98b6a', palm: ['#4f9a5a', '#5aa863', '#43875a'],
  car: ['#d9534f', '#f0ad4e', '#5bc0de', '#f5f1e6', '#6c7a89', '#8fbf6a', '#c06bd1', '#2f3b52'],
  pool: '#6fd0e8', hill: ['#c9a98a', '#b8967c', '#d6b99a'], sign: ['#e0524c', '#3f8f86', '#e0a63a', '#4a6fa5'],
}

// ---------- renderer, scene, light
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.prepend(renderer.domElement)

const scene = new THREE.Scene()
const FOG = new THREE.Color('#f1d9b5')
scene.fog = new THREE.Fog(FOG, 70, 330)
const hemi = new THREE.HemisphereLight('#fff1d6', '#8fa27a', 1.35)
scene.add(hemi)
const sun = new THREE.DirectionalLight('#fff0d0', 2.4)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
const SC = 70
Object.assign(sun.shadow.camera, { left: -SC, right: SC, top: SC, bottom: -SC, near: 1, far: 400 })
sun.shadow.bias = -0.0006
scene.add(sun, sun.target)
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 700)
scene.add(camera)

// three-step toon ramp, shared
const ramp = (() => {
  const d = new Uint8Array([120, 120, 132, 255, 180, 176, 178, 255, 226, 222, 218, 255, 255, 255, 255, 255])
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true
  return t
})()
const mats = new Map()
const M = hex => { let m = mats.get(hex); if (!m) { m = new THREE.MeshToonMaterial({ color: hex, gradientMap: ramp }); mats.set(hex, m) } return m }
const geoBox = new THREE.BoxGeometry(1, 1, 1)
const geoCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10)
const geoCone4 = new THREE.ConeGeometry(0.5, 1, 4)
const geoSphere = new THREE.IcosahedronGeometry(0.5, 0)

// ---------- shared context for the other modules
const solids = ctx.solids
const player = { x: 0, y: 1.7, z: 14, vy: 0, yaw: Math.PI, pitch: 0, onGround: true, bob: 0, locked: false, moving: false, sprinting: false }
Object.assign(ctx, { THREE, scene, camera, player, ramp })

let worldGroup = null
const lootPoints = [] // { x, y, z, table }
const spawnPoints = []
const pickupGroup = new THREE.Group()
scene.add(pickupGroup)

function box(parent, w, h, d, x, y, z, hex, opts = {}) {
  const m = new THREE.Mesh(geoBox, M(hex))
  m.scale.set(w, h, d); m.position.set(x, y + h / 2, z)
  m.castShadow = opts.cast !== false; m.receiveShadow = true
  parent.add(m)
  return m
}
const pick = (r, a) => a[Math.floor(r() * a.length)]
const wpos = (f, lx, lz) => ({ x: f.x + lx * Math.cos(f.rot) + lz * Math.sin(f.rot), z: f.z - lx * Math.sin(f.rot) + lz * Math.cos(f.rot) })

// ---------- pieces
function palm(r, parent, x, z, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z)
  const h = (6 + r() * 4) * scale
  const trunk = new THREE.Mesh(geoCyl, M(PAL.palmTrunk)); trunk.scale.set(0.32 * scale, h, 0.32 * scale); trunk.position.y = h / 2
  trunk.rotation.z = (r() - 0.5) * 0.14; trunk.castShadow = true
  g.add(trunk)
  const col = pick(r, PAL.palm)
  for (let i = 0; i < 8; i++) {
    const f = new THREE.Mesh(geoBox, M(col)); f.scale.set(0.5 * scale, 0.07, 3.2 * scale)
    const a = (i / 8) * Math.PI * 2 + r() * 0.3
    f.position.set(Math.cos(a) * 1.35 * scale, h + 0.25 - 0.1 * (i % 2), Math.sin(a) * 1.35 * scale)
    f.rotation.set(0, -a + Math.PI / 2, 0); f.rotateX(0.5)
    f.castShadow = true; g.add(f)
  }
  parent.add(g)
  solids.push({ t: 'c', x, z, r: 0.45 * scale })
}
function bush(r, parent, x, z, s = 1) {
  const m = new THREE.Mesh(geoSphere, M(pick(r, PAL.palm)))
  m.scale.set(1.6 * s, 1.2 * s, 1.6 * s); m.position.set(x, 0.55 * s, z); m.castShadow = true; m.receiveShadow = true
  parent.add(m)
}
function car(r, parent, x, z, rot, hex = pick(r, PAL.car)) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot
  const body = new THREE.Mesh(geoBox, M(hex)); body.scale.set(4.5, 0.85, 1.9); body.position.y = 0.75; body.castShadow = true; body.receiveShadow = true
  const cab = new THREE.Mesh(geoBox, M(PAL.glass)); cab.scale.set(2.3, 0.75, 1.7); cab.position.set(-0.2, 1.5, 0); cab.castShadow = true
  const roof = new THREE.Mesh(geoBox, M(hex)); roof.scale.set(2.2, 0.12, 1.75); roof.position.set(-0.2, 1.93, 0)
  g.add(body, cab, roof)
  for (const [wx, wz] of [[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]]) {
    const w = new THREE.Mesh(geoCyl, M('#2a2a32')); w.scale.set(0.8, 0.3, 0.8); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.4, wz); g.add(w)
  }
  parent.add(g)
  solids.push({ t: 'o', x, z, hw: 2.3, hd: 1.0, rot })
}
function lamp(parent, x, z) {
  box(parent, 0.18, 6.5, 0.18, x, 0, z, '#5d5f6a', { cast: false })
  box(parent, 1.4, 0.18, 0.18, x + 0.55, 6.4, z, '#5d5f6a', { cast: false })
}

// walls with colliders, in a building's local frame
function wall(g, f, lx, lz, w, d, h, hex, y0 = 0) {
  box(g, w, h, d, lx, y0, lz, hex)
  const p = wpos(f, lx, lz)
  solids.push({ t: 'o', x: p.x, z: p.z, hw: w / 2, hd: d / 2, rot: f.rot })
}
function furniture(g, f, lx, lz, w, h, d, hex) { wall(g, f, lx, lz, w, d, h, hex) }
function hollow(g, f, w, d, h, hex, gaps, t = 0.3) {
  wall(g, f, 0, -d / 2 + t / 2, w, t, h, hex)
  wall(g, f, -w / 2 + t / 2, 0, t, d, h, hex)
  wall(g, f, w / 2 - t / 2, 0, t, d, h, hex)
  const fz = d / 2 - t / 2
  let x0 = -w / 2
  for (const gp of [...gaps].sort((a, b) => a.x - b.x)) {
    const x1 = gp.x - gp.w / 2
    if (x1 - x0 > 0.05) wall(g, f, (x0 + x1) / 2, fz, x1 - x0, t, h, hex)
    box(g, gp.w, h - 2.4, t, gp.x, 2.4, fz, hex)
    x0 = gp.x + gp.w / 2
  }
  if (w / 2 - x0 > 0.05) wall(g, f, (x0 + w / 2) / 2, fz, w / 2 - x0, t, h, hex)
  box(g, w - 2 * t, 0.1, d - 2 * t, 0, 0, 0, '#e2d6bc', { cast: false })
}
function door(g, f, x, z, w, hex) {
  const pivot = new THREE.Group(); pivot.position.set(x - w / 2, 0, z); pivot.userData.keep = true; g.add(pivot)
  box(pivot, w - 0.06, 2.35, 0.12, w / 2, 0, 0, hex)
  const p = wpos(f, x, z)
  const col = { t: 'o', x: p.x, z: p.z, hw: w / 2, hd: 0.12, rot: f.rot, door: true }
  solids.push(col)
  ctx.doors.push({ pivot, col, open: false, x: p.x, z: p.z, ang: 0, rot: f.rot })
}
function lootAt(f, lx, lz, y, table) { const p = wpos(f, lx, lz); lootPoints.push({ x: p.x, y, z: p.z, table }) }

function house(r, parent, x, z, rot) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot
  const f = { x, z, rot }
  const w = 9 + r() * 3, d = 8 + r() * 2.5, h = 3.4 + r() * 0.6
  const wallC = pick(r, PAL.stucco), roofC = pick(r, PAL.roof)
  const side = r() < 0.5 ? -1 : 1
  const doorX = -side * 1.8
  hollow(g, f, w, d, h, wallC, [{ x: doorX, w: 1.5 }])
  door(g, f, doorX, d / 2 - 0.15, 1.5, pick(r, PAL.door))
  const roof = new THREE.Mesh(geoCone4, M(roofC)); roof.scale.set(w * 1.55, 2.4, d * 1.55); roof.position.y = h + 1.2; roof.rotation.y = Math.PI / 4; roof.castShadow = true
  g.add(roof)
  // attached garage (solid)
  const gw = 5.2, gd = 6.5, gh = 3
  const gx = side * (w / 2 + gw / 2 - 0.4), gz = (gd - d) / 2 - 0.3
  wall(g, f, gx, gz, gw, gd, gh, wallC)
  const groof = new THREE.Mesh(geoBox, M(roofC)); groof.scale.set(gw + 0.5, 0.35, gd + 0.5); groof.position.set(gx, gh + 0.17, gz); groof.castShadow = true; g.add(groof)
  box(g, 3.8, 2.4, 0.12, gx, 0, gz + gd / 2 + 0.02, '#e9e3d3', { cast: false })
  box(g, 1.7, 1.3, 0.12, side * 1.7, 1.1, d / 2 + 0.03, PAL.glass, { cast: false })
  box(g, 1.7, 1.3, 0.12, -side * 3.3, 1.1, d / 2 + 0.03, PAL.glass, { cast: false })
  box(g, w + 0.3, 0.25, 0.3, 0, h - 0.3, d / 2 + 0.05, PAL.trim, { cast: false })
  box(g, w + gw + 4, 0.06, 9, 0, 0, d / 2 + 3.5, pick(r, PAL.grass), { cast: false })
  box(g, 3.8, 0.1, 10, gx, 0, d / 2 + 4, PAL.concrete, { cast: false })
  if (r() < 0.4) box(g, 5, 0.05, 3.5, -side * 1.5, 0.02, -d / 2 - 3.5, PAL.pool, { cast: false })
  if (r() < 0.75) palm(r, g, -side * (w / 2 + 1.5), d / 2 + 5.5, 0.8 + r() * 0.5)
  if (r() < 0.8) bush(r, g, -side * (w / 2 - 1.5), d / 2 + 0.9, 0.9)
  // inside: bed, counter, table, sofa, with things to find
  const t = 0.3, ix = w / 2 - t, iz = d / 2 - t
  const bs = r() < 0.5 ? -1 : 1
  furniture(g, f, bs * (ix - 1.2), -iz + 0.9, 2.0, 0.55, 1.5, '#d9a8a0')
  furniture(g, f, -bs * (ix - 2.0), -iz + 0.4, 3.4, 0.95, 0.6, '#cdb892')
  const tx = (r() - 0.5) * 2, tz = -0.3 + (r() - 0.5)
  furniture(g, f, tx, tz, 1.8, 0.8, 1.0, '#a9835a')
  furniture(g, f, bs * (ix - 1.4), iz - 1.4, 2.2, 0.7, 0.9, '#7e93a6')
  const spots = [
    [-bs * (ix - 1.3), -iz + 0.4, 0.97], [-bs * (ix - 2.8), -iz + 0.4, 0.97], [tx - 0.4, tz, 0.82], [tx + 0.5, tz + 0.1, 0.82],
    [bs * (ix - 1.2), -iz + 0.9, 0.6], [-bs * (ix - 0.8), iz - 1.2, 0.1], [bs * (ix - 2.2), 0.2, 0.1], [0, -iz + 1.8, 0.1],
  ]
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]] }
  const n = 3 + (r() < 0.5 ? 1 : 0) + (r() < 0.3 ? 1 : 0)
  for (let i = 0; i < n; i++) lootAt(f, spots[i][0], spots[i][1], spots[i][2], 'house')
  parent.add(g)
  if (r() < 0.5) { const p = wpos(f, 0, d / 2 + 5); spawnPoints.push({ x: p.x, z: p.z }) }
  // a car in the driveway, most of the time
  if (r() < 0.65) {
    const p = wpos(f, gx, d / 2 + 6.5)
    car(r, parent, p.x, p.z, rot + Math.PI / 2 + (r() - 0.5) * 0.15)
  }
}

// ---------- the neighbourhood
function generate(seedValue) {
  const r = mulberry(seedValue)
  solids.length = 0; lootPoints.length = 0; spawnPoints.length = 0; ctx.doors.length = 0
  const g = new THREE.Group()

  box(g, 1400, 0.1, 1400, 0, -0.1, 0, PAL.grass[0], { cast: false })
  box(g, 520, 0.12, 13, 0, 0, 0, PAL.road, { cast: false })
  box(g, 520, 0.14, 2.2, 0, 0, -7.6, PAL.walk, { cast: false })
  box(g, 520, 0.14, 2.2, 0, 0, 7.6, PAL.walk, { cast: false })
  for (let x = -250; x < 250; x += 8) box(g, 3.5, 0.02, 0.25, x, 0.12, 0, PAL.line, { cast: false })
  for (let x = -240; x < 240; x += 40) { lamp(g, x, -9.2); lamp(g, x + 20, 9.2) }
  for (let x = -240; x < 240; x += 18 + r() * 8) { palm(r, g, x, -10.2, 1); if (r() < 0.9) palm(r, g, x + 8, 10.4, 1) }

  const streets = 6
  for (let i = 0; i < streets; i++) {
    const sx = -150 + i * 60 + (r() - 0.5) * 12
    const L = 110 + r() * 40
    box(g, 9.5, 0.12, L, sx, 0, -6.5 - L / 2, PAL.road, { cast: false })
    const disc = new THREE.Mesh(geoCyl, M(PAL.road)); disc.scale.set(34, 0.12, 34); disc.position.set(sx, 0.06, -6.5 - L - 8); disc.receiveShadow = true; g.add(disc)
    const island = new THREE.Mesh(geoCyl, M(pick(r, PAL.grass))); island.scale.set(9, 0.16, 9); island.position.set(sx, 0.08, -6.5 - L - 8); g.add(island)
    palm(r, g, sx, -6.5 - L - 8, 1.1)
    box(g, 2.2, 0.14, L, sx - 6.4, 0, -6.5 - L / 2, PAL.walk, { cast: false }); box(g, 2.2, 0.14, L, sx + 6.4, 0, -6.5 - L / 2, PAL.walk, { cast: false })
    for (let z = -26; z > -L; z -= 22) {
      for (const side of [-1, 1]) {
        if (r() < 0.08) continue
        house(r, g, sx + side * 20, z - 6.5 + (r() - 0.5) * 2, side < 0 ? Math.PI / 2 : -Math.PI / 2)
      }
      if (r() < 0.5) car(r, g, sx + (r() < 0.5 ? -2.3 : 2.3), z + 4, Math.PI / 2 + (r() - 0.5) * 0.1)
      if (r() < 0.5) lamp(g, sx + (r() < 0.5 ? -7.2 : 7.2), z + 10)
      if (r() < 0.35) spawnPoints.push({ x: sx + (r() - 0.5) * 6, z: z + 2 })
    }
    for (let a = 0; a < 360; a += 34) {
      const ang = (a * Math.PI) / 180
      if (Math.abs(Math.sin(ang)) < 0.35 && Math.cos(ang) > 0) continue
      house(r, g, sx + Math.cos(ang) * 30, -6.5 - L - 8 + Math.sin(ang) * 30, -ang - Math.PI / 2)
    }
    if (r() < 0.6) car(r, g, sx + (r() - 0.5) * 3, -6.5 - 30 - r() * (L - 40), (r() - 0.5) * 1.2 + Math.PI / 2, '#8a7a6a')
  }

  // the strip mall: hollow, six open doorways, shelves and shop goods
  const mx = -20
  box(g, 90, 0.08, 36, mx, 0, 28, PAL.road, { cast: false })
  for (let i = 0; i < 18; i++) box(g, 0.2, 0.02, 5, mx - 42 + i * 5, 0.08, 18, PAL.line, { cast: false })
  const mall = new THREE.Group(); mall.position.set(mx, 0, 41); mall.rotation.y = Math.PI
  const mf = { x: mx, z: 41, rot: Math.PI }
  const gaps = []
  for (let i = 0; i < 6; i++) gaps.push({ x: -33.75 + i * 13.5, w: 3.4 })
  hollow(mall, mf, 80, 14, 6, '#efe0c6', gaps)
  box(mall, 82, 0.8, 16, 0, 6, 0, pick(r, PAL.roof))
  for (let i = 0; i < 6; i++) {
    const cx = gaps[i].x
    box(mall, 11, 1.1, 0.4, cx, 4.5, 7.1, PAL.sign[i % 4], { cast: false })
    if (i < 5) box(mall, 7, 2.2, 0.1, cx + 6.75, 0.6, 7.03, PAL.glass, { cast: false })
    furniture(mall, mf, cx - 3, -1.5, 5.5, 1.05, 0.8, '#cdb892')
    furniture(mall, mf, cx + 3, 1.5, 5.5, 1.05, 0.8, '#cdb892')
    for (let k = 0; k < 4; k++) lootAt(mf, cx + (k < 2 ? -3 : 3) + (k % 2 ? 1.6 : -1.6), k < 2 ? -1.5 : 1.5, 1.08, 'store')
    spawnPoints.push(wpos(mf, cx, -2))
  }
  g.add(mall)
  for (let i = 0; i < 14; i++) car(r, g, mx - 38 + (i % 7) * 12 + r() * 2, 14 + Math.floor(i / 7) * 10, Math.PI / 2 + (r() - 0.5) * 0.15)
  for (let x = -45; x <= 5; x += 10) palm(r, g, mx + x, 9.8, 0.9)
  for (let i = 0; i < 6; i++) spawnPoints.push({ x: mx - 36 + i * 14, z: 18 + r() * 8 })

  // petrol station with a small shop
  const px = 120
  box(g, 24, 0.5, 20, px, 0, 22, PAL.concrete, { cast: false })
  box(g, 18, 0.5, 8, px, 6, 22, '#f5f1e6')
  for (const dx of [-7, 7]) { box(g, 0.5, 6, 0.5, px + dx, 0, 22, '#9a968c'); solids.push({ t: 'c', x: px + dx, z: 22, r: 0.4 }) }
  const kg = new THREE.Group(); kg.position.set(px + 14, 0, 33); kg.rotation.y = Math.PI
  const kf = { x: px + 14, z: 33, rot: Math.PI }
  hollow(kg, kf, 7.5, 5.5, 3.6, '#e6dcc4', [{ x: 0, w: 1.8 }])
  furniture(kg, kf, 0, -1.4, 5, 1.0, 0.7, '#cdb892')
  for (let k = 0; k < 3; k++) lootAt(kf, -1.6 + k * 1.6, -1.4, 1.03, 'gas')
  g.add(kg)
  car(r, g, px - 3, 24, 0)
  spawnPoints.push({ x: px - 6, z: 18 })

  for (let i = 0; i < 5; i++) {
    const bx = 175, bz = 30 + i * 22
    const w = 24 + r() * 16, d = 14 + r() * 8, h = 7 + r() * 8
    box(g, w, h, d, bx + w / 2, 0, bz, pick(r, PAL.stucco))
    box(g, w + 1, 0.8, d + 1, bx + w / 2, h, bz, '#8a8e99')
    solids.push({ t: 'o', x: bx + w / 2, z: bz, hw: w / 2, hd: d / 2, rot: 0 })
  }

  const ox = -190
  box(g, 16, 1.4, 90, ox, 7, 0, '#a9a69c')
  for (const dz of [-9, 9]) { box(g, 2.2, 7, 2.2, ox, 0, dz, '#a9a69c'); solids.push({ t: 'o', x: ox, z: dz, hw: 1.1, hd: 1.1, rot: 0 }) }
  box(g, 16, 0.8, 90, ox, 8.4, 0, '#8c8a82', { cast: false })
  for (let i = 0; i < 5; i++) car(r, g, ox + 28 + i * 8, 2.2 - (i % 2) * 4, (r() - 0.5) * 0.3)
  for (let i = 0; i < 8; i++) spawnPoints.push({ x: ox + 10 + i * 9, z: (r() - 0.5) * 8 })

  for (let i = 0; i < 26; i++) {
    const ang = (i / 26) * Math.PI * 2 + r() * 0.2, dist = 430 + r() * 70
    const hill = new THREE.Mesh(geoCone4, M(pick(r, PAL.hill)))
    hill.scale.set(130 + r() * 120, 60 + r() * 70, 130 + r() * 120); hill.position.set(Math.cos(ang) * dist, 28, Math.sin(ang) * dist); hill.rotation.y = r() * 3
    hill.userData.keep = true
    g.add(hill)
  }
  return g
}

/** One mesh per colour: thousands of boxes become a few dozen draw calls. */
function mergeStatic(group) {
  group.updateMatrixWorld(true)
  const buckets = new Map(), gone = []
  group.traverse(o => {
    if (!o.isMesh) return
    for (let a = o; a; a = a.parent) if (a.userData.keep) return
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    geo.applyMatrix4(o.matrixWorld)
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k)
    const k = o.material.uuid
    if (!buckets.has(k)) buckets.set(k, { mat: o.material, list: [] })
    buckets.get(k).list.push(geo)
    gone.push(o)
  })
  for (const o of gone) o.parent.remove(o)
  for (const { mat, list } of buckets.values()) {
    const m = new THREE.Mesh(mergeGeometries(list), mat)
    m.castShadow = true; m.receiveShadow = true
    group.add(m)
    for (const l of list) l.dispose()
  }
}

// ---------- pickups
const SHAPES = {
  can: () => new THREE.CylinderGeometry(0.1, 0.1, 0.24, 10), box: () => new THREE.BoxGeometry(0.28, 0.14, 0.2), ball: () => new THREE.IcosahedronGeometry(0.12, 0),
  cloth: () => new THREE.BoxGeometry(0.42, 0.1, 0.32), gun: () => new THREE.BoxGeometry(0.7, 0.12, 0.14), melee: () => new THREE.BoxGeometry(0.9, 0.07, 0.07),
}
function pickupAt(id, x, y, z, extra = null, n = 1) {
  const d = ITEMS[id]
  const shape = d.cat === 'gun' ? 'gun' : d.cat === 'melee' ? 'melee' : d.shape ?? 'box'
  const m = new THREE.Mesh(SHAPES[shape](), M(d.color))
  m.castShadow = true
  const grp = new THREE.Group()
  const ring = new THREE.Mesh(geoCyl, new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.45 }))
  ring.scale.set(0.75, 0.02, 0.75); ring.position.y = -0.0
  grp.add(m, ring)
  grp.position.set(x, y, z)
  m.position.y = 0.18
  pickupGroup.add(grp)
  const item = { id, n, ...(extra ?? (d.cat === 'gun' ? { mag: Math.min(d.mag, Math.floor(Math.random() * (d.mag + 1))) } : {})) }
  if (d.stack) item.n = n > 1 ? n : 1 + Math.floor(Math.random() * Math.min(d.stack, 12))
  const p = { item, grp, mesh: m, y0: y, t: Math.random() * 6 }
  ctx.pickups.push(p)
  return p
}
ctx.dropLoot = (x, z, table) => pickupAt(rollLoot(table, Math.random), x + (Math.random() - 0.5) * 0.6, 0.06, z + (Math.random() - 0.5) * 0.6)
ctx.dropItem = it => {
  const fwd = { x: -Math.sin(player.yaw), z: -Math.cos(player.yaw) }
  pickupAt(it.id, player.x + fwd.x * 1.1, 0.06, player.z + fwd.z * 1.1, it.mag !== undefined ? { mag: it.mag } : null, it.n)
}
function populate(r) {
  for (const p of ctx.pickups) pickupGroup.remove(p.grp)
  ctx.pickups.length = 0
  for (const lp of lootPoints) pickupAt(rollLoot(lp.table, r), lp.x, lp.y, lp.z)
  for (const z of ctx.zombies) scene.remove(z.g)
  ctx.zombies.length = 0
  let n = 0
  for (const sp of spawnPoints) {
    if (Math.hypot(sp.x - 0, sp.z - 14) < 30) continue
    if (n >= 95) break
    Z.spawn(sp.x, sp.z, r); n++
    if (r() < 0.25) Z.spawn(sp.x + 2, sp.z + 1.5, r)
  }
}

// ---------- fx
const puffs = [], tracers = []
const pGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07)
ctx.fx = {
  puff(x, y, z, color, n = 5) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color }))
      m.position.set(x, y, z); scene.add(m)
      puffs.push({ m, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2.5, vz: (Math.random() - 0.5) * 3, life: 0.5 })
    }
  },
  tracer(a, b) {
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    const m = new THREE.Mesh(geoBox, new THREE.MeshBasicMaterial({ color: '#fff2b0' }))
    m.scale.set(0.015, 0.015, len)
    m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
    m.lookAt(b.x, b.y, b.z)
    scene.add(m); tracers.push({ m, life: 0.06 })
  },
}
function tickFx(dt) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i]; p.life -= dt
    p.vy -= 9 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt
    if (p.life <= 0 || p.m.position.y < 0) { scene.remove(p.m); p.m.material.dispose(); puffs.splice(i, 1) }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i]; t.life -= dt
    if (t.life <= 0) { scene.remove(t.m); t.m.material.dispose(); tracers.splice(i, 1) }
  }
}

// ---------- collisions and rays
ctx.collideCircle = (p, R) => {
  for (const s of solids) {
    if (s.disabled) continue
    if (s.t === 'c') {
      const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz), min = s.r + R
      if (d < min && d > 1e-4) { p.x = s.x + (dx / d) * min; p.z = s.z + (dz / d) * min }
    } else {
      const c = Math.cos(s.rot), sn = Math.sin(s.rot)
      const dx = p.x - s.x, dz = p.z - s.z
      if (dx * dx + dz * dz > (s.hw + s.hd + 3) * (s.hw + s.hd + 3)) continue
      const lx = dx * c - dz * sn, lz = dx * sn + dz * c
      const px = s.hw + R - Math.abs(lx), pz = s.hd + R - Math.abs(lz)
      if (px > 0 && pz > 0) {
        let nx = lx, nz = lz
        if (px < pz) nx = Math.sign(lx || 1) * (s.hw + R); else nz = Math.sign(lz || 1) * (s.hd + R)
        p.x = s.x + nx * c + nz * sn
        p.z = s.z - nx * sn + nz * c
      }
    }
  }
}
const ray = new THREE.Raycaster()
ctx.rayWorld = (o, d, max) => {
  ray.set(new THREE.Vector3(o.x, o.y, o.z), new THREE.Vector3(d.x, d.y, d.z))
  ray.far = max
  const hits = ray.intersectObject(worldGroup, true)
  return hits.length ? hits[0].distance : Infinity
}

// ---------- sky dome
const sky = (() => {
  const geo = new THREE.SphereGeometry(520, 24, 16)
  const cols = [], top = new THREE.Color('#79b8e2'), mid = new THREE.Color('#bde0ee'), low = new THREE.Color('#f6dfb8')
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(-0.1, p.getY(i) / 520)
    const c = t > 0.35 ? top.clone().lerp(mid, 1 - (t - 0.35) / 0.65) : mid.clone().lerp(low, 1 - t / 0.35)
    cols.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }))
  m.renderOrder = -1
  return m
})()
scene.add(sky)

// ---------- game flow
let kills = 0, elapsed = 0, lastCause = ''
function build() {
  if (worldGroup) scene.remove(worldGroup)
  worldGroup = generate(seed)
  mergeStatic(worldGroup)
  scene.add(worldGroup)
  ctx.world = worldGroup
  populate(mulberry(seed ^ 0x9e3779b9))
}
function newLife() {
  resetInv(); resetVitals()
  const spots = spawnPoints.filter(s => Math.abs(s.z) < 60)
  const s = spots.length ? spots[Math.floor(Math.random() * spots.length)] : { x: 0, z: 14 }
  player.x = s.x; player.z = s.z + 3; player.yaw = Math.PI; player.pitch = 0; player.y = 1.7; player.vy = 0
  W.select(null)
  kills = 0; elapsed = 0
  UI.showDeath(false)
}
ctx.toast = UI.toast
ctx.hitMarker = (kill, head) => { if (kill) kills++; UI.hitMarker(kill, head) }
ctx.onHurt = () => { UI.flashDamage(); lastCause = 'Torn apart by the dead.' }
ctx.onEquipChange = slot => {
  if (slot === 'primary' || slot === 'secondary' || slot === 'melee') W.select(slot)
  else if (W.wp.sel && !inv.equip[W.wp.sel]) W.select(null)
}

// ---------- input
const keys = new Set()
let mouseDown = false
const startEl = document.getElementById('start')
function lock() { if (!UI.ui.open && !vit.dead) renderer.domElement.requestPointerLock?.() }
startEl.addEventListener('click', () => { startEl.classList.add('hide'); lock() })
renderer.domElement.addEventListener('click', () => { if (!player.locked) lock() })
document.addEventListener('pointerlockchange', () => { player.locked = document.pointerLockElement === renderer.domElement })
UI.ui.onClose = () => lock()
UI.ui.onRespawn = () => { newLife(); lock() }
addEventListener('mousedown', e => {
  if (e.button !== 0) return
  mouseDown = true
  if (player.locked || (!UI.ui.open && !vit.dead && startEl.classList.contains('hide'))) W.trigger(true, true)
})
addEventListener('mouseup', () => { mouseDown = false })
addEventListener('mousemove', e => {
  if (player.locked) {
    player.yaw -= e.movementX * 0.0022
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0022))
  } else if (mouseDown && !UI.ui.open) {
    player.yaw -= e.movementX * 0.0022
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0022))
  }
})
let timeOfDay = 0.34
addEventListener('keydown', e => {
  if (e.repeat) return
  keys.add(e.code)
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
  if (vit.dead) return
  if (e.code === 'Tab') {
    const open = !UI.ui.open
    if (open) document.exitPointerLock?.()
    UI.toggleInventory(open)
  }
  if (UI.ui.open) return
  if (e.code === 'KeyT') timeOfDay = (timeOfDay + 0.12) % 1
  if (e.code === 'KeyN') { seed = Math.floor(Math.random() * 1e9); build(); newLife() }
  if (e.code === 'KeyR') W.startReload()
  if (e.code === 'KeyE') interact()
  if (e.code === 'Digit1') W.select('primary')
  if (e.code === 'Digit2') W.select('secondary')
  if (e.code === 'Digit3') W.select('melee')
  if (e.code === 'Digit4') W.select(null)
})
addEventListener('keyup', e => keys.delete(e.code))

// ---------- interaction: doors and things on the ground
function aimDot(x, y, z) {
  const dx = x - player.x, dy = y - player.y, dz = z - player.z, d = Math.hypot(dx, dy, dz) || 1
  const fx = -Math.sin(player.yaw) * Math.cos(player.pitch), fy = Math.sin(player.pitch), fz = -Math.cos(player.yaw) * Math.cos(player.pitch)
  return { dot: (dx * fx + dy * fy + dz * fz) / d, d }
}
function focus() {
  let best = null, bs = 0
  for (const p of ctx.pickups) {
    const pos = p.grp.position
    const a = aimDot(pos.x, pos.y + 0.2, pos.z)
    if (a.d < 2.6 && a.dot > 0.82 && a.dot / (a.d + 1) > bs) { bs = a.dot / (a.d + 1); best = { kind: 'pickup', p } }
  }
  if (best) return best
  for (const d of ctx.doors) {
    const a = aimDot(d.x, 1.2, d.z)
    if (a.d < 3.2 && a.dot > 0.75 && a.dot / (a.d + 1) > bs) { bs = a.dot / (a.d + 1); best = { kind: 'door', d } }
  }
  return best
}
function interact() {
  const f = focus()
  if (!f) return
  if (f.kind === 'door') { f.d.open = !f.d.open; f.d.col.disabled = f.d.open; return }
  const it = f.p.item
  const left = addItem(it.id, it.n, it.mag !== undefined ? { mag: it.mag } : null)
  if (left >= it.n) { UI.toast('Bag full'); return }
  UI.toast(`Picked up ${ITEMS[it.id].name}${it.n - left > 1 ? ' x' + (it.n - left) : ''}`)
  if (left > 0) it.n = left
  else { pickupGroup.remove(f.p.grp); ctx.pickups.splice(ctx.pickups.indexOf(f.p), 1) }
}

// ---------- time of day
function applyTime() {
  const a = Math.PI * (0.08 + timeOfDay * 0.84)
  sun.position.set(player.x + Math.cos(a) * 150, Math.sin(a) * 150 + 20, player.z - 40)
  sun.target.position.set(player.x, 0, player.z)
  sun.target.updateMatrixWorld()
  const warm = 1 - Math.sin(a)
  sun.color.set('#fff3dc').lerp(new THREE.Color('#ffb070'), Math.pow(warm, 2))
  sun.intensity = 1.0 + Math.sin(a) * 1.5
  hemi.intensity = 0.9 + Math.sin(a) * 0.55
  FOG.set('#f1d9b5').lerp(new THREE.Color('#f3b890'), Math.pow(warm, 2))
  scene.fog.color.copy(FOG)
  renderer.setClearColor(FOG)
}

// ---------- loop
UI.init()
W.init()
const hudHud = document.getElementById('hud')
let last = performance.now(), fpsT = 0, frames = 0, fps = 0, hudT = 0
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now
  const active = !UI.ui.open && !vit.dead && startEl.classList.contains('hide')
  if (active) {
    elapsed += dt
    if (keys.has('ArrowLeft')) player.yaw += 1.8 * dt
    if (keys.has('ArrowRight')) player.yaw -= 1.8 * dt
    if (keys.has('ArrowUp')) player.pitch = Math.min(1.45, player.pitch + 1.2 * dt)
    if (keys.has('ArrowDown')) player.pitch = Math.max(-1.45, player.pitch - 1.2 * dt)
    const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0)
    const str = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)
    const wantsSprint = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && fwd > 0
    const sprint = wantsSprint && vit.stamina > 4 && !vit.leg
    player.moving = !!(fwd || str); player.sprinting = sprint && player.moving
    const speed = (sprint ? 7.0 : 4.2) * (vit.leg ? 0.55 : 1)
    if (fwd || str) {
      const l = Math.hypot(fwd, str) || 1
      const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw)
      player.x += (-sy * fwd + cy * str) / l * speed * dt
      player.z += (-cy * fwd - sy * str) / l * speed * dt
      player.bob += dt * (sprint ? 12 : 8)
    }
    if (keys.has('Space') && player.onGround && !vit.leg) { player.vy = 5.2; player.onGround = false }
    tickVitals(dt, { sprinting: player.sprinting })
    if (mouseDown) W.trigger(false, true)
    if (vit.dead) {
      document.exitPointerLock?.()
      UI.showDeath(true, { cause: vit.bleeding ? 'You bled out.' : vit.food <= 0 ? 'You starved.' : vit.water <= 0 ? 'You died of thirst.' : lastCause, time: `${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`, kills })
    }
  } else { player.moving = false; player.sprinting = false }
  player.vy -= 14 * dt
  player.y += player.vy * dt
  const eye = 1.7 + (player.moving ? Math.sin(player.bob) * 0.035 : 0) - (vit.leg ? 0.15 : 0)
  if (player.y <= eye && player.vy <= 0) { player.y = eye; player.vy = 0; player.onGround = true }
  ctx.collideCircle(player, 0.4)
  if (active) { W.update(dt); Z.update(dt, player) } else W.update(0)
  // pickups spin, doors swing
  for (const p of ctx.pickups) { p.t += dt; p.mesh.rotation.y += dt * 1.2; p.mesh.position.y = 0.2 + Math.sin(p.t * 2) * 0.04 }
  for (const d of ctx.doors) { const tgt = d.open ? 1.75 : 0; d.ang += (tgt - d.ang) * Math.min(1, dt * 7); d.pivot.rotation.y = d.ang }
  tickFx(dt)
  camera.position.set(player.x, player.y, player.z)
  camera.rotation.order = 'YXZ'
  camera.rotation.set(player.pitch, player.yaw, 0)
  sky.position.set(player.x, 0, player.z)
  applyTime()
  renderer.render(scene, camera)
  frames++; fpsT += dt; hudT += dt
  if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0 }
  if (hudT > 0.1) {
    hudT = 0
    UI.update(vit, W.info())
    const f = active ? focus() : null
    if (f?.kind === 'pickup') UI.setPrompt(`E   ${ITEMS[f.p.item.id].name}${f.p.item.n > 1 ? ' x' + f.p.item.n : ''}`)
    else if (f?.kind === 'door') UI.setPrompt(`E   ${f.d.open ? 'Close' : 'Open'} door`)
    else UI.setPrompt('')
    hudHud.innerHTML = `<b>ORANGE COUNTY</b> &nbsp; seed ${seed} &nbsp; ${fps} fps<br>x ${player.x.toFixed(0)} &nbsp; z ${player.z.toFixed(0)} &nbsp; zombies ${ctx.zombies.filter(z => !z.dead).length}`
  }
  requestAnimationFrame(frame)
}
build()
newLife()
requestAnimationFrame(frame)
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix() })
window.__g = {
  player, camera, vit, inv, ctx, W, Z, UI,
  get seed() { return seed },
  stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, solids: solids.length, pickups: ctx.pickups.length, zombies: ctx.zombies.length, doors: ctx.doors.length }),
  setPose(x, z, yaw = 0, pitch = 0) { player.x = x; player.z = z; player.yaw = yaw; player.pitch = pitch },
  setTime(t) { timeOfDay = t }, reseed(s) { seed = s; build(); newLife() }, addItem, SLOTS, ITEMS,
  start() { startEl.classList.add('hide') },
}
