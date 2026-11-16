'''Browser test: two real Chrome players play a 1v1 of prop hunt (create, join by link, stake, ready ring, pick,
hide, a missed tag, a catch, round two swap), then the shop, a Mystery Box and the locker. Screenshots go to qa-screens/.
Run the server first:  PORT=3000 npm start   then   python3 tests/browser.py [http://localhost:3000]'''
import asyncio, json, shutil
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
import os, sys
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000').rstrip('/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'qa-screens'); os.makedirs(OUT, exist_ok=True)
errs = []
async def until(p, js, ms=20000, what=''):
    for _ in range(ms // 100):
        if await p.evaluate(js): return
        await p.wait_for_timeout(100)
    print('DEBUG', await p.evaluate("JSON.stringify({ph: FOUND_APP.S.phase, layer: FOUND_APP.S.layer, role: FOUND_APP.W.role, me: [FOUND_APP.W.me.x, FOUND_APP.W.me.z], path: FOUND_APP.W.me.path && FOUND_APP.W.me.path.length, canTag: FOUND_APP.W.canTag, key: FOUND_APP.W.mapKey})"), errs[-4:])
    raise AssertionError('timeout ' + what)
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(**({'executable_path': shutil.which('google-chrome') or shutil.which('chromium')} if (shutil.which('google-chrome') or shutil.which('chromium')) else {}), args=ARGS)
        async def page(name):
            c = await b.new_context(viewport={'width': 880, 'height': 540}); p = await c.new_page()
            p.on('pageerror', lambda e: errs.append(name + ': ' + str(e))); p.on('console', lambda m: errs.append(name + ' console: ' + m.text) if m.type == 'error' else None); return p
        A = await page('A'); B = await page('B')
        await A.goto(URL); await until(A, '!!(window.FOUND_APP && FOUND_APP.S.me)'); await A.screenshot(path=OUT + '/home.png')
        await A.click('[data-a=create]'); await until(A, '!!FOUND_APP.S.party'); code = await A.evaluate('FOUND_APP.S.party.code')
        await B.goto(URL + '/#' + code); await until(B, 'FOUND_APP.S.party && FOUND_APP.S.party.players.length === 2')
        await A.wait_for_timeout(1200); await A.click('[data-a=stake]'); await A.wait_for_timeout(500); await A.screenshot(path=OUT + '/lobby.png')
        for p, dx in ((A, -1.2), (B, 1.2)): await p.evaluate(f'() => {{ const R = FOUND_LAYOUT.lobby.ring; FOUND_APP.W.walkTo(R.x + {dx}, R.z); }}')
        await until(A, "FOUND_APP.S.layer === 'pick'", 25000, 'pick')
        roleA = await A.evaluate('FOUND_APP.S.offer.role'); H, S = (B, A) if roleA == 'seeker' else (A, B)
        await H.wait_for_timeout(500); await H.screenshot(path=OUT + '/pick-hider.png')
        await H.evaluate("document.querySelector('.pcard').click()")
        await until(H, "FOUND_APP.S.phase === 'hide'", 20000, 'hide'); await H.wait_for_timeout(1200)
        await S.screenshot(path=OUT + '/blind.png')
        print('hider walks', await H.evaluate("(() => { const W = FOUND_APP.W, d = s => Math.hypot(s.x - W.me.x, s.z - W.me.z), sp = W.mapObj.spots.filter(s => s.on === 'floor' && d(s) > 6).sort((a, b) => d(a) - d(b)); return sp.some(s => W.walkTo(s.x, s.z)); })()")); await until(H, '!FOUND_APP.W.me.path', 15000, 'hider settles'); await H.wait_for_timeout(300); await H.screenshot(path=OUT + '/hider.png')
        await until(S, "FOUND_APP.S.phase === 'seek'", 30000, 'seek'); await S.wait_for_timeout(600)
        print('map', await S.evaluate('FOUND_APP.W.map'), 'coins after stake', await A.evaluate('FOUND_APP.S.me.coins'))
        # seeker walks to a decoy copy and tags it (a miss), then to the hider
        hp = await H.evaluate('[FOUND_APP.W.me.x, FOUND_APP.W.me.z, FOUND_APP.S.round.prop]'); print('hider at', hp)
        dec = await S.evaluate(f"(() => {{ const m = FOUND_APP.W.me, it = [...FOUND_APP.W.items.values()].filter(i => !i.gift).sort((a, b) => Math.hypot(a.x - m.x, a.z - m.z) - Math.hypot(b.x - m.x, b.z - m.z))[0]; return [it.x, it.z, it.id]; }})()")
        # a wrong tag first, if an object is close enough to reach without running the clock down in slow headless rendering
        if await S.evaluate(f'Math.hypot(FOUND_APP.W.me.x - {dec[0]}, FOUND_APP.W.me.z - {dec[1]}) < 10'):
            await S.evaluate(f'() => FOUND_APP.W.walkTo({dec[0]}, {dec[1]})'); await until(S, 'FOUND_APP.W.canTag', 25000, 'reach decoy'); await S.wait_for_timeout(300)
            await S.screenshot(path=OUT + '/seek-decoy.png'); await S.keyboard.press('e'); await S.wait_for_timeout(1500)
        print('seeker walks', await S.evaluate(f'FOUND_APP.W.walkTo({hp[0]}, {hp[1]})'), await S.evaluate('[FOUND_APP.W.me.x, FOUND_APP.W.me.z, FOUND_APP.S.phase, FOUND_APP.W.role]'))
        await until(S, f"Math.hypot(FOUND_APP.W.me.x - {hp[0]}, FOUND_APP.W.me.z - {hp[1]}) < 3.2 && FOUND_APP.W.canTag", 30000, 'reach hider'); await S.wait_for_timeout(400)
        await S.screenshot(path=OUT + '/seek-hider.png')
        for _ in range(4):
            await S.keyboard.press('e'); await S.wait_for_timeout(1300)
            if await S.evaluate("FOUND_APP.S.layer === 'results'"): break
        await until(S, "FOUND_APP.S.layer === 'results'", 8000, 'results'); await S.wait_for_timeout(500); await S.screenshot(path=OUT + '/results1.png')
        await until(S, "FOUND_APP.S.layer === 'pick'", 15000, 'round 2 pick'); print('round 2 roles', await A.evaluate('FOUND_APP.S.offer.role'), await B.evaluate('FOUND_APP.S.offer.role'))
        await A.evaluate("() => FOUND_APP.send({ t: 'leave' })"); await B.wait_for_timeout(1500)
        print('B coins after refund', await B.evaluate('FOUND_APP.S.me.coins'), 'phase', await B.evaluate('FOUND_APP.S.phase'))
        js = lambda sel: f"document.querySelector('{sel}').click()"
        await B.evaluate(js('.hud-tr [data-a=shop]')); await B.wait_for_timeout(2500); await B.screenshot(path=OUT + '/shop.png')
        await B.evaluate("document.querySelectorAll('#lk-body .it')[3].click()"); await B.wait_for_timeout(700); await B.screenshot(path=OUT + '/shop-pick.png')
        await B.evaluate(js('[data-a=open]')); await B.wait_for_timeout(500); await B.evaluate("document.querySelector('#rv-c').dispatchEvent(new PointerEvent('pointerdown'))")
        await until(B, "!!document.querySelector('[data-rv=done]')", 8000, 'reveal'); await B.wait_for_timeout(600); await B.screenshot(path=OUT + '/reveal.png')
        await B.evaluate(js('[data-rv=done]')); await B.wait_for_timeout(500); await B.evaluate(js('.mtools [data-a=locker]')); await B.wait_for_timeout(2000); await B.screenshot(path=OUT + '/locker.png')
        M = await (await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)).new_page()
        await M.goto(URL); await until(M, '!!(window.FOUND_APP && FOUND_APP.S.me)'); await M.wait_for_timeout(1500); await M.screenshot(path=OUT + '/phone-home.png')
        await b.close()
    bad = [e for e in errs if 'GPU stall' not in e and 'GL Driver' not in e]
    print('page errors:', json.dumps(bad) if bad else 'none')
    if bad: sys.exit(1)
    print('browser test passed; screenshots in qa-screens/')
asyncio.run(main())
