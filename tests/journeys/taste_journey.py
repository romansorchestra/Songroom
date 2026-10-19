# The taste test in a real browser against the stand-in (18 Oct 2026). Start the app with
# SONGROOM_STANDIN=1 APP_PASSWORD=dev SESSION_SECRET=dev PORT=8743 DB_PATH=<fresh file>, then
# `python3 tests/journeys/taste_journey.py`. Needs playwright (dev only). Screenshots go to
# JOURNEY_OUT. Plays a preview round (nothing saved), then a real round, at 393x720; checks
# 320 wide, a short 393x659 screen, dark and desktop for the cards.
import asyncio, json, os, sys
from playwright.async_api import async_playwright

BASE = os.environ.get('JOURNEY_BASE', 'http://127.0.0.1:8743')
OUT = os.environ.get('JOURNEY_OUT', '/tmp/songroom-taste')
os.makedirs(OUT, exist_ok=True)
results = []

def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail and not ok else ''))

async def api(page, method, path, body=None):
    return await page.evaluate("""async ([m, p, b]) => { const r = await fetch('/api' + p, { method: m, headers: { 'content-type': 'application/json', 'x-songroom': '1' }, body: b === null ? undefined : JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => null) }; }""", [method, path, body])

async def off_glass(page):
    return await page.evaluate("""() => { const bad = []; for (const e of document.querySelectorAll('.tabs, .taste-option, .taste-chorus, .taste-under, .chips, .actions')) { const r = e.getBoundingClientRect(); if (r.right > window.innerWidth + 1) bad.push(e.className); } if (document.documentElement.scrollWidth > window.innerWidth + 1) bad.push('page scrolls sideways'); return bad; }""")

async def play_round(page, tag, shots=True):
    """Answer every card: first option on pairs; first flaw: tap a word; later flaws: It's fine."""
    flaws_seen = 0
    for step in range(30):
        await page.wait_for_timeout(120)
        if await page.locator('.taste-option').count():
            if shots and step < 2: await page.screenshot(path=f'{OUT}/{tag}-pair-{step}.png')
            await page.locator('.taste-option').first.click()
            await page.wait_for_timeout(380)
            continue
        if await page.locator('.taste-chorus').count():
            flaws_seen += 1
            if shots and flaws_seen == 1: await page.screenshot(path=f'{OUT}/{tag}-chorus.png')
            if flaws_seen == 1:
                await page.locator('.taste-chorus .w').first.click()
                await page.wait_for_timeout(150)
                if await page.locator('.chips .chip').count():
                    if shots: await page.screenshot(path=f'{OUT}/{tag}-why.png')
                    await page.locator('.chips .chip', has_text="wouldn't say it").click()
                    await page.wait_for_timeout(150)
                if await page.get_by_role('button', name='I don’t mind it').count():
                    if shots: await page.screenshot(path=f'{OUT}/{tag}-reveal.png')
                    await page.get_by_role('button', name='I don’t mind it').click()
                else:
                    await page.wait_for_timeout(1700)  # caught / yours: moves on by itself
            else:
                await page.get_by_role('button', name='It’s fine').click()
                await page.wait_for_timeout(150)
                if await page.get_by_role('button', name='Fair, I missed it').count():
                    await page.get_by_role('button', name='Fair, I missed it').click()
                else:
                    await page.wait_for_timeout(1300)
            continue
        break
    return flaws_seen

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 720}, device_scale_factor=2)
        page = await ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(BASE + '/')
        await page.fill('input[type=password]', 'dev')
        await page.click('button.primary')
        await page.wait_for_selector('.tabs')
        song = await api(page, 'POST', '/songs', {'text': 'It took a while to say it\nI said it in the car\nYou laughed and turned the radio up\nLike that was who we are'})
        check('a song in the Journal to ask about', song['status'] == 200)

        # Ideas offers the test while the writer knows nothing he has said about his taste
        await page.goto(BASE + '/#/ideas')
        await page.wait_for_selector('.taste-invite', timeout=8000)
        await page.screenshot(path=f'{OUT}/ideas-invite.png')
        check('Ideas shows the invite', await page.locator('.taste-invite').is_visible())

        # ---- a preview round: the real flow, nothing saved
        await page.goto(BASE + '/#/taste?preview=1')
        await page.wait_for_selector('text=Your taste.')
        check('preview says so', await page.locator('text=Preview · nothing saved').count() == 1)
        await page.get_by_role('button', name='Start').click()
        await page.wait_for_selector('.taste-bar')
        await play_round(page, 'preview', shots=False)
        await page.wait_for_selector('text=Is this you?', timeout=8000)
        await page.get_by_role('button', name='Mine', exact=True).first.click()
        await page.get_by_role('button', name='Read my answers').click()
        await page.wait_for_selector('.taste-heard', timeout=15000)
        check('preview: nothing to keep, a way back', await page.locator('text=Preview: nothing is kept.').count() == 1 and await page.get_by_role('button', name='Back to Ideas').count() == 1)
        st = (await api(page, 'GET', '/taste/status'))['body']
        check('preview saved nothing', st['sessions'] == 0 and st['voices'] == 0 and st['kept'] == 0, json.dumps(st))

        # ---- a real round from the invite
        await page.goto(BASE + '/#/ideas')
        await page.wait_for_selector('.taste-invite')
        await page.locator('.taste-invite').get_by_role('button', name='Start').click()
        await page.wait_for_selector('text=Your taste.')
        await page.screenshot(path=f'{OUT}/intro.png')
        await page.get_by_role('button', name='Start').click()
        await page.wait_for_selector('.taste-bar')
        check('the tab bar stays whole on a card', not await off_glass(page), str(await off_glass(page)))
        tabs = await page.evaluate("() => { const r = document.querySelector('.tabs').getBoundingClientRect(); return r.bottom <= window.innerHeight + 1 && r.top < window.innerHeight; }")
        check('tabs on the glass at 393x720', tabs)
        n_flaws = await play_round(page, 'real')
        check('four choruses in a round', n_flaws == 4, str(n_flaws))
        await page.wait_for_selector('text=Is this you?', timeout=8000)
        await page.screenshot(path=f'{OUT}/songs.png')
        await page.get_by_role('button', name='Mine', exact=True).first.click()
        await page.get_by_role('button', name='Read my answers').click()
        await page.wait_for_selector('.taste-heard', timeout=15000)
        await page.screenshot(path=f'{OUT}/heard.png', full_page=True)
        check('the score shows', await page.locator('.taste-score b').count() >= 2)
        await page.locator('.taste-heard').first.get_by_role('button', name='Keep').click()
        await page.get_by_role('button', name='Keep 1 for the writer').click()
        await page.wait_for_selector('text=See them in Settings')
        await page.screenshot(path=f'{OUT}/done.png')
        st = (await api(page, 'GET', '/taste/status'))['body']
        check('one session, one kept, one voice', st['sessions'] == 1 and st['kept'] == 1 and st['voices'] == 1 and not st['thin'], json.dumps(st))
        await page.get_by_role('button', name='See them in Settings').click()
        await page.wait_for_selector('text=From your taste test')
        check('Settings lists it as from the taste test', True)
        await page.goto(BASE + '/#/ideas')
        await page.wait_for_timeout(800)
        check('the invite has gone', await page.locator('.taste-invite').count() == 0)

        # ---- the cards at other sizes
        for (w, h, scheme, tag) in [(320, 640, 'light', 'w320'), (393, 659, 'light', 'short'), (393, 720, 'dark', 'dark'), (1280, 800, 'light', 'desk')]:
            c2 = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, color_scheme=scheme, storage_state=await ctx.storage_state())
            pg = await c2.new_page()
            await pg.goto(BASE + '/#/taste')
            await pg.get_by_role('button', name='Start').click()
            await pg.wait_for_selector('.taste-option, .taste-chorus')
            await pg.screenshot(path=f'{OUT}/{tag}-card.png')
            bad = await off_glass(pg)
            check(f'{tag}: nothing off the glass', not bad, str(bad))
            if w < 700:
                fits = await pg.evaluate("() => [...document.querySelectorAll('.taste-option, .taste-under')].every(e => e.getBoundingClientRect().bottom <= window.innerHeight - 56)")
                check(f'{tag}: both options and Neither above the tab bar', fits)
            await c2.close()
        check('no page errors', not errors, '; '.join(errors))
        await b.close()
    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)}/{len(results)} passed')
    sys.exit(1 if failed else 0)

asyncio.run(main())
