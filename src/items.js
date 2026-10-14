// Every item in the game, and what each kind of place can hold. Our own names and numbers.
// cat: food | drink | medical | ammo | gun | melee | clothing
// clothing has a slot (hat, glasses, mask, shirt, vest, pants, backpack), `slots` of storage it adds, and `armor` (0..1 damage cut).

export const ITEMS = {
  // food
  beans: { name: 'Canned Beans', cat: 'food', food: 26, color: '#c8603f', shape: 'can', tip: 'Cold, but it counts.' },
  granola: { name: 'Granola Bar', cat: 'food', food: 14, color: '#d9a441', shape: 'box', tip: 'Dry and chewy.' },
  apple: { name: 'Apple', cat: 'food', food: 10, water: 4, color: '#d9534f', shape: 'ball', tip: 'From someone\'s backyard tree.' },
  chips: { name: 'Corn Chips', cat: 'food', food: 18, color: '#e8b53a', shape: 'box', tip: 'Salty. Makes you thirsty.', thirst: -4 },
  taco: { name: 'Fish Taco', cat: 'food', food: 32, color: '#e8d6a3', shape: 'box', tip: 'Surprisingly fine.' },
  // drink
  water: { name: 'Water Bottle', cat: 'drink', water: 34, color: '#6fd0e8', shape: 'can', tip: 'Clean, and getting rare.' },
  soda: { name: 'Orange Soda', cat: 'drink', water: 16, food: 4, color: '#f08a2c', shape: 'can', tip: 'Fizzy. Not very hydrating.' },
  juice: { name: 'Orange Juice', cat: 'drink', water: 26, food: 6, color: '#f6b13a', shape: 'can', tip: 'Fresh squeezed, a long time ago.' },
  // medical
  bandage: { name: 'Bandage', cat: 'medical', heal: 8, stopBleed: true, color: '#f4f1e6', shape: 'box', tip: 'Stops bleeding.' },
  medkit: { name: 'First Aid Kit', cat: 'medical', heal: 55, stopBleed: true, color: '#e0524c', shape: 'box', tip: 'Heals a lot and stops bleeding.' },
  splint: { name: 'Splint', cat: 'medical', fixLeg: true, color: '#cdb892', shape: 'box', tip: 'Sets a broken leg.' },
  // ammo (one stack per slot)
  ammo9: { name: '9mm Rounds', cat: 'ammo', ammo: '9mm', stack: 30, color: '#d9b45a', shape: 'box', tip: 'Pistol ammunition.' },
  ammo12: { name: '12 Gauge Shells', cat: 'ammo', ammo: '12ga', stack: 16, color: '#c0453a', shape: 'box', tip: 'Shotgun shells.' },
  ammo30: { name: '.30 Cartridges', cat: 'ammo', ammo: '.30', stack: 20, color: '#8a7a55', shape: 'box', tip: 'Rifle ammunition.' },
  // guns
  pistol: { name: 'Service Pistol', cat: 'gun', slot: 'secondary', ammo: '9mm', mag: 12, dmg: 26, rpm: 420, spread: 0.014, recoil: 0.018, range: 90, pellets: 1, reload: 1.3, color: '#3e4452', tip: 'Reliable. Not loud enough to ignore.', noise: 55 },
  shotgun: { name: 'Pump Shotgun', cat: 'gun', slot: 'primary', ammo: '12ga', mag: 6, dmg: 13, rpm: 72, spread: 0.075, recoil: 0.06, range: 32, pellets: 8, reload: 2.4, color: '#5a4636', tip: 'Wide and loud. Do not use in a crowd.', noise: 85 },
  rifle: { name: 'Hunting Rifle', cat: 'gun', slot: 'primary', ammo: '.30', mag: 5, dmg: 78, rpm: 64, spread: 0.004, recoil: 0.05, range: 240, pellets: 1, reload: 2.2, color: '#4a5a3a', tip: 'One good shot at a distance.', noise: 100 },
  // melee
  bat: { name: 'Aluminum Bat', cat: 'melee', slot: 'melee', dmg: 38, rate: 0.75, range: 2.5, color: '#c9ccd4', tip: 'Quiet, if you can stand it close.' },
  crowbar: { name: 'Crowbar', cat: 'melee', slot: 'melee', dmg: 30, rate: 0.55, range: 2.3, color: '#b8503a', tip: 'Fast and sturdy.' },
  // clothing: hats
  cap: { name: 'Ball Cap', cat: 'clothing', slot: 'hat', slots: 0, armor: 0, color: '#4a6fa5', shape: 'cloth', tip: 'Keeps the sun off.' },
  helmet: { name: 'Bike Helmet', cat: 'clothing', slot: 'hat', slots: 0, armor: 0.16, color: '#e0524c', shape: 'cloth', tip: 'Better than nothing.' },
  visor: { name: 'Sun Visor', cat: 'clothing', slot: 'hat', slots: 0, armor: 0, color: '#f4f1e6', shape: 'cloth', tip: 'Very Orange County.' },
  // glasses / masks
  shades: { name: 'Sunglasses', cat: 'clothing', slot: 'glasses', slots: 0, armor: 0, color: '#2a2230', shape: 'cloth', tip: 'Looks good in any apocalypse.' },
  bandana: { name: 'Bandana', cat: 'clothing', slot: 'mask', slots: 0, armor: 0.02, color: '#c8603f', shape: 'cloth', tip: 'Covers your face.' },
  // shirts
  tee: { name: 'Graphic Tee', cat: 'clothing', slot: 'shirt', slots: 2, armor: 0, color: '#3f8f86', shape: 'cloth', tip: '2 slots.' },
  hoodie: { name: 'Zip Hoodie', cat: 'clothing', slot: 'shirt', slots: 4, armor: 0.03, color: '#8f8aa8', shape: 'cloth', tip: '4 slots.' },
  jacket: { name: 'Work Jacket', cat: 'clothing', slot: 'shirt', slots: 5, armor: 0.06, color: '#b58a4a', shape: 'cloth', tip: '5 slots. Tough canvas.' },
  // vests
  vest: { name: 'Tactical Vest', cat: 'clothing', slot: 'vest', slots: 4, armor: 0.28, color: '#4f5a48', shape: 'cloth', tip: '4 slots. Takes the edge off bites.' },
  hivis: { name: 'Hi-Vis Vest', cat: 'clothing', slot: 'vest', slots: 2, armor: 0.02, color: '#e8d23a', shape: 'cloth', tip: '2 slots. Please do not wear this now.' },
  // pants
  shorts: { name: 'Board Shorts', cat: 'clothing', slot: 'pants', slots: 2, armor: 0, color: '#5bc0de', shape: 'cloth', tip: '2 slots.' },
  jeans: { name: 'Jeans', cat: 'clothing', slot: 'pants', slots: 4, armor: 0.03, color: '#4a6fa5', shape: 'cloth', tip: '4 slots.' },
  cargo: { name: 'Cargo Pants', cat: 'clothing', slot: 'pants', slots: 6, armor: 0.04, color: '#8a8a5a', shape: 'cloth', tip: '6 slots.' },
  // backpacks
  daypack: { name: 'School Backpack', cat: 'clothing', slot: 'backpack', slots: 7, armor: 0, color: '#d9534f', shape: 'cloth', tip: '7 slots.' },
  hikepack: { name: 'Hiking Pack', cat: 'clothing', slot: 'backpack', slots: 13, armor: 0, color: '#3f6f4a', shape: 'cloth', tip: '13 slots.' },
}

/** [item id, weight]. What each kind of place can hold. */
export const LOOT = {
  house: [
    ['beans', 8], ['granola', 8], ['apple', 5], ['chips', 6], ['taco', 3], ['water', 8], ['soda', 6], ['juice', 4],
    ['bandage', 6], ['medkit', 1.5], ['ammo9', 3], ['ammo12', 1.5], ['bat', 1.5], ['crowbar', 1],
    ['tee', 5], ['hoodie', 3], ['jeans', 5], ['shorts', 4], ['cap', 4], ['visor', 3], ['shades', 3], ['bandana', 2], ['daypack', 2], ['pistol', 0.8],
  ],
  store: [
    ['beans', 7], ['granola', 6], ['chips', 7], ['taco', 3], ['water', 10], ['soda', 8], ['juice', 6], ['apple', 3],
    ['bandage', 7], ['medkit', 3], ['splint', 2], ['ammo9', 3], ['ammo12', 2], ['ammo30', 1.5],
    ['jacket', 2], ['cargo', 2], ['hikepack', 1.2], ['helmet', 2], ['vest', 0.8], ['hoodie', 3], ['shades', 3], ['pistol', 1.2], ['shotgun', 0.6], ['rifle', 0.4],
  ],
  gas: [['water', 10], ['soda', 10], ['juice', 6], ['chips', 8], ['granola', 6], ['taco', 4], ['bandage', 4], ['ammo9', 1], ['visor', 3]],
  zombie: [['beans', 3], ['granola', 3], ['water', 3], ['bandage', 4], ['ammo9', 3], ['ammo12', 1.5], ['cap', 2], ['tee', 2], ['jeans', 2], ['soda', 2], ['splint', 0.8]],
}

export function rollLoot(table, r) {
  const list = LOOT[table]
  const total = list.reduce((a, [, w]) => a + w, 0)
  let x = r() * total
  for (const [id, w] of list) { x -= w; if (x <= 0) return id }
  return list[0][0]
}

/** Starting kit: a t-shirt, jeans, a bandage and two bottles. */
export const START = { shirt: 'tee', pants: 'jeans', bag: [['water', 1], ['granola', 1], ['bandage', 1]] }
