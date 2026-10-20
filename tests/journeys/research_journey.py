# The 19 Oct 2026 commission's screens in a real browser against the stand-in: the research
# test (judging A/B), five quick pairs, the per-task research switches, and several references
# typed at once. Start the app with SONGROOM_STANDIN=1 APP_PASSWORD=dev SESSION_SECRET=dev
# PORT=8744 DB_PATH=<fresh file>, then `python3 tests/journeys/research_journey.py`.
# Screenshots go to JOURNEY_OUT. Phone first (393x659, the short Safari height), then 320 wide,
# dark, and desktop.
import asyncio, os, sys
from playwright.async_api import async_playwright

BASE = os.environ.get('JOURNEY_BASE', 'http://127.0.0.1:8744')
OUT = os.environ.get('JOURNEY_OUT', '/tmp/songroom-research')
os.makedirs(OUT, exist_ok=True)
results = []

def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail and not ok else ''))

async def api(page, method, path, body=None):
    return await page.evaluate("""async ([m, p, b]) => { const r = await fetch('/api' + p, { method: m, headers: { 'content-type': 'application/json', 'x-songroom': '1' }, body: b === null ? undefined : JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => null) }; }""", [method, path, body])

async def off_glass(page, sel):
    return await page.evaluate("""(sel) => { const bad = []; for (const e of document.querySelectorAll(sel)) { const r = e.getBoundingClientRect(); if (r.right > window.innerWidth + 1) bad.push(e.className); } if (document.documentElement.scrollWidth > window.innerWidth + 1) bad.push('page scrolls sideways'); return bad; }""", sel)

async def settle(page, ms=300):
    await page.wait_for_timeout(ms)

LYRIC = "[Verse]\nForget me for a weekend, I'll be dead by Monday\nI need a little feeding every hour on the hour\n\n[Chorus]\nI'm your Tamagotchi, baby, press any button\nKeep me alive with a little bit of nothing"

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 659}, device_scale_factor=2)
        page = await ctx.new_page()
        await page.goto(BASE + '/')
        await page.fill('input[type=password]', 'dev')
        await page.keyboard.press('Enter')
        await settle(page, 800)

        # --- material, made through the app
        made = (await api(page, 'POST', '/songs', {'title': 'Tamagotchi', 'text': LYRIC}))['body']
        song = (await api(page, 'GET', f"/songs/{made['id']}"))['body']
        l1 = song['sections'][0]['lines'][0]; last = song['sections'][1]['lines'][1]
        rw = (await api(page, 'POST', f"/songs/{song['id']}/suggest", {'baseRev': song['current_rev'], 'instruction': 'keep the rhythm, more bratty', 'targets': [{'kind': 'line', 'lineId': l1['id'], 'expected': l1['text']}], 'clientKey': 'j1'}))['body']
        ct = (await api(page, 'POST', f"/songs/{song['id']}/suggest", {'baseRev': song['current_rev'], 'instruction': 'A pre chorus that turns it', 'targets': [], 'afterLineId': last['id'], 'clientKey': 'j2'}))['body']
        await api(page, 'POST', '/springboard/next', {'clientKey': 'j3'})
        await settle(page, 1500)
        idea = (await api(page, 'GET', '/springboard'))['body']['current']
        ref = (await api(page, 'POST', '/references/resolve', {'query': 'Noah Kahan'}))['body']
        cases = [
            {'id': 'E1', 'route': 'ideas', 'direction': 'Flex feel good seductive', 'genre': 'pop'},
            {'id': 'E2', 'route': 'ideas', 'direction': "A male love song that doesn't make him look desperate", 'genre': 'pop', 'refId': ref['id']},
            {'id': 'E3', 'route': 'ideas', 'direction': 'Heartbreak King, folky not country', 'genre': 'country', 'refId': ref['id']},
            {'id': 'E4', 'route': 'develop', 'ideaId': idea['id'], 'feedback': 'love the title, make it more grown-up and sexier, less sad', 'keepTitle': True, 'keepConcept': False, 'keepLineIds': [idea['lines'][0]['id']], 'changeLineIds': []},
            {'id': 'E5', 'route': 'create', 'text': 'A song called He and I. The next word should rhyme with I.', 'refId': ref['id']},
            {'id': 'E6', 'route': 'rewrite', 'setId': rw['setId']},
            {'id': 'E7', 'route': 'continue', 'setId': ct['setId']},
            {'id': 'E8', 'route': 'title', 'songId': song['id'], 'ask': 'looking for the title for the next section'},
        ]
        t = await api(page, 'POST', '/trials', {'name': 'Journey test', 'cases': cases, 'seed': 11})
        check('test batch created', t['status'] == 200, str(t['body'])[:200])
        bid = t['body']['id']
        for _ in range(60):
            bb = (await api(page, 'GET', f'/trials/{bid}'))['body']
            if all(x['A'] and x['B'] for x in bb['trials']): break
            await settle(page, 500)
        check('all sixteen outputs written', all(x['A'] and x['B'] for x in bb['trials']))

        # --- judging on the phone
        await page.goto(f'{BASE}/#/trials/{bid}')
        await settle(page, 900)
        await page.screenshot(path=f'{OUT}/trials-1.png', full_page=True)
        check('trials: nothing off the glass', not await off_glass(page, '.trials, .trial-sheet, .trial-picks, .chips'), str(await off_glass(page, '.trials, .trial-sheet, .trial-picks, .chips')))
        check('trials: conditions hidden before judging', await page.locator('text=research on').count() == 0 and await page.locator('text=research off').count() == 0)
        await page.locator('.trial-spark input').nth(1).check()
        await page.get_by_role('button', name='A', exact=True).click()
        await settle(page, 900)
        eyebrow = await page.locator('.taste-top .eyebrow').inner_text()
        check('trials: progress moves on', '1 of 8' in eyebrow.lower(), eyebrow)
        picks = ['B', 'Both good', 'Neither', 'A', 'B', 'A', 'Both good']
        for p in picks:
            await page.get_by_role('button', name=p, exact=True).click()
            await settle(page, 600)
        await page.screenshot(path=f'{OUT}/trials-done.png', full_page=True)
        check('trials: results shown once all eight are judged', await page.locator('text=All 8 judged').count() == 1)
        await page.locator('.chips .chip').first.click()
        await settle(page, 300)
        check('trials: sides revealed after judging', await page.locator('.trial-side >> text=/research (on|off)/').count() == 2)
        await page.screenshot(path=f'{OUT}/trials-reveal.png', full_page=True)

        # --- five quick pairs
        await page.goto(f'{BASE}/#/taste/contrasts')
        await settle(page, 800)
        await page.screenshot(path=f'{OUT}/contrasts-1.png', full_page=True)
        check('pairs: nothing off the glass', not await off_glass(page, '.taste-option, .actions, .taste-pair'))
        await page.locator('.trial-spark input').first.check()
        await page.locator('button', has_text='Both work').click()
        await settle(page, 500)
        pos = await page.locator('.taste-top .small').inner_text()
        check('pairs: moves to the next', pos.startswith('2 of 5') or pos.startswith('3 of 5'), pos)
        ans = (await api(page, 'GET', '/taste/contrasts'))['body']['answers']
        check('pairs: answer kept with "good but wrong for this song"', ans and ans[0]['payload']['pick'] == 'both' and ans[0]['payload']['wrongForSong'] in ('a', 'b'), str(ans)[:200])

        # --- research switches in Settings
        await page.goto(f'{BASE}/#/settings/writer')
        await settle(page, 800)
        await page.locator('summary', has_text='By task').click()
        await settle(page, 200)
        await page.screenshot(path=f'{OUT}/settings-research.png', full_page=False)
        sel = page.locator('details label.field select').first  # the first per-task switch is Ideas
        await sel.select_option('cards')
        await settle(page, 600)
        st = (await api(page, 'GET', '/status'))['body']['settings']
        check('settings: one task switched alone', st.get('researchRoutes') == {'ideas': 'cards'}, str(st.get('researchRoutes')))
        await page.locator('details label.field select').first.select_option('default')
        await settle(page, 600)
        check('settings: and back to default', (await api(page, 'GET', '/status'))['body']['settings'].get('researchRoutes') == {})

        # --- several references at once (Create)
        await page.goto(f'{BASE}/#/create')
        await settle(page, 800)
        opener = page.locator('button', has_text='Reference')
        if await opener.count(): await opener.first.click(); await settle(page, 200)
        await page.fill('input[aria-label="Reference"]', 'Noah Kahan, Sam Fender')
        await page.locator('button', has_text='Check').click()
        await settle(page, 900)
        await page.screenshot(path=f'{OUT}/refs-group.png', full_page=True)
        cards = page.locator('.ref-card')
        check('refs: two cards, one each', await cards.count() == 2, str(await cards.count()))
        check('refs: the unverified one is said plainly', await page.locator('text=couldn’t identify this').count() == 1)
        check('refs: nothing off the glass', not await off_glass(page, '.ref-card'))
        await cards.nth(1).locator('button', has_text='Not this one').click()
        await settle(page, 600)
        check('refs: dropping one keeps the other', await page.locator('.ref-card').count() == 1)

        # --- 320 wide, dark, desktop
        for (w, h, scheme, tag) in [(320, 640, 'light', '320'), (393, 659, 'dark', 'dark'), (1280, 900, 'light', 'desktop')]:
            c2 = await b.new_context(viewport={'width': w, 'height': h}, color_scheme=scheme, device_scale_factor=2, storage_state=await ctx.storage_state())
            p2 = await c2.new_page()
            await p2.goto(f'{BASE}/#/trials/{bid}')
            await settle(p2, 900)
            await p2.screenshot(path=f'{OUT}/trials-{tag}.png', full_page=True)
            bad = await off_glass(p2, '.trials, .trial-sheet, .trial-picks, .chips')
            check(f'trials {tag}: nothing off the glass', not bad, str(bad))
            await p2.goto(f'{BASE}/#/taste/contrasts')
            await settle(p2, 700)
            await p2.screenshot(path=f'{OUT}/contrasts-{tag}.png', full_page=True)
            await c2.close()
        await b.close()
    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)} of {len(results)} passed')
    sys.exit(1 if failed else 0)

asyncio.run(main())
