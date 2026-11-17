# FOUND: setup in 5 minutes

## Play on your own computer (free, 2 minutes)
1. Install Node 20 or newer from nodejs.org.
2. Unzip, open a terminal in the `found` folder, then run:
   ```
   npm install
   npm start
   ```
3. Open http://localhost:3000. Open it in a second browser window to play against yourself.
4. Press **Create party**, send a friend the 4-letter code. Both stand in the READY ring.

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
4. Send friends your `https://....onrender.com` link. `/#CODE` joins a party directly.

Run one instance only: parties live in memory.

## Playing
- Alone: walk around the home screen straight away, or press **Practice** (seek 3 computer hiders) or **Explore** (walk any map).
- Host sets **Map**, **Rules** and (1v1) **Stake** in the lobby. WASD to move, E to tag, Space to jump.
- Hiders pick an object and stay still among the copies. Seekers tag. A wrong tag costs time.
- Home screen: collect idle coins, spin the daily wheel, play Odd one out. Lobby: gift coins to friends.
- Win rounds for coins and Mystery Boxes. Spend them in **Shop** and **Locker**.

## Checking it works
`npm test` runs 30 unit and 27 integration checks. `tests/browser.py` plays a full 1v1 in Chrome (README has details).
