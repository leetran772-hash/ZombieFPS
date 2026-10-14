# ZombieFPS

First-person zombie survival in a seeded, fictional Orange County, California. Browser game (three.js), our own simple 3D style.

## Run
```
python -m http.server 5860
# open http://127.0.0.1:5860/index.html
```
(any static file server works; three.js loads from a CDN)

## Controls
WASD move, Shift sprint, Space jump, mouse look (click to lock), Tab inventory, E pick up / open doors,
1-4 weapon slots, R reload, left click shoot / swing, T time of day, N new world.

## What is in
- Seeded neighbourhood: cul-de-sacs, enterable houses, a strip mall, petrol station, overpass
- Vitals: health, food, water, stamina, bleeding, broken leg
- Inventory with storage from clothing, armour from hats and vests, item wear is not in yet
- Loot tables by place, pistols, a shotgun, a rifle, bats
- Zombies that wander, hear gunfire, chase and bite

See DESIGN.md for the plan and milestones.
