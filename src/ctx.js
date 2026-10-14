// Shared handles, filled in by main.js, so the other modules can reach the scene and the world without importing each other in circles.
export const ctx = {
  THREE: null,
  scene: null,
  camera: null,
  player: null,
  solids: [],
  zombies: [],
  pickups: [],
  doors: [],
  world: null,
  fx: null, // { puff(x,y,z,color,n), tracer(a,b) }
  collideCircle: null, // (p:{x,z}, r) -> void
  rayWorld: null, // (origin, dir, max) -> distance or Infinity
  dropLoot: null, // (x, z, table) -> void
  toast: () => {},
  noise: null, // (x, z, radius) -> void
}
