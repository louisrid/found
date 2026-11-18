# FOUND: setup in 5 minutes

## Play on your own computer (free, 2 minutes)
1. Install Node 20 or newer from nodejs.org.
2. Unzip, open a terminal in the `found` folder, then run:
   ```
   npm install
   npm start
   ```
3. Open http://localhost:3000. Open it in a second browser window to play against yourself.
4. You land in the shared lobby automatically. Tap **Hide & Seek**, then **I'm ready** (60% of the room ready starts a round).

Profiles save to `data/found.json`. Delete that file to reset everyone.

## Put it online so friends can join (about 5 minutes)
1. Create a **private** GitHub repo called `found` and push:
   ```
   git remote add origin https://github.com/louisrid/found.git
   git push -u origin main
   ```
2. On render.com: **New, Blueprint**, pick the repo. `render.yaml` does the rest.
3. Optional but recommended: add a free Postgres database and set its URL as `DATABASE_URL`
   on the service, so coins and items survive restarts. (This path is written but untested
   against a real database; check a profile survives one restart before inviting people.)
5. Send friends your `https://....onrender.com` link. `/#CODE` joins a party directly.

Run one instance only: parties live in memory.

## Playing
- Alone: walk around the home screen straight away, or press **Practice** (seek 3 computer hiders) or **Explore** (walk any map).
- Host sets **Map**, **Rules** and (1v1) **Stake** in the lobby. WASD to move, E to tag, Space to jump.
- Hiders pick an object and stay still among the copies. Seekers tag. A wrong tag costs time.
- Home screen: collect idle coins, spin the daily wheel, play Odd one out. Lobby: gift coins to friends.
- Win rounds for coins and Mystery Boxes. Spend them in **Shop** and **Locker**.

## Guns and crates
- **Double-tap A or D** to barrel roll sideways (dodges shots). On a phone, flick the joystick left or right twice.
- Everyone joins one public lobby automatically (no codes), and guns are always on there. **Hold F**, hold the **FIRE** button or hold **right-click** to shoot; shots aim at whoever is in front of you. 150 HP, 12,000 coins per kill and 4,000 lost when you die. Hold FIRE to steady a sniper's scope, press **G** (or the round button next to FIRE) to throw your gadget, and heal on the white marble platform in the middle.
- Everyone earns **2,000 coins a minute** while connected. The **Gun Crate** (4,000) and **Armour Box** (3,500) are in the shop, rolling Common to Cosmic by their odds; duplicates pay 10% back. 26 guns, 16 armours and 8 gadgets; the Locker and Shop have a **Guns** tab.

## Checking it works
`npm test` runs 41 unit and 31 integration checks. `tests/browser.py` plays a full 1v1 in Chrome (README has details).
