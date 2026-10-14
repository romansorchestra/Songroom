# The simplification plan's acceptance journeys (14 Oct 2026), driven in a real browser against the
# stand-in writer: start the app with SONGROOM_STANDIN=1 … PORT=8742 DB_PATH=<fresh file>, then
# `python3 tests/journeys/simplification_journeys.py`. Needs playwright (dev only). Screenshots
# land in JOURNEY_OUT. Not part of `npm test`.
import asyncio, json, sys
from playwright.async_api import async_playwright

BASE = __import__('os').environ.get('JOURNEY_BASE', 'http://127.0.0.1:8742')
OUT = __import__('os').environ.get('JOURNEY_OUT', '/tmp/songroom-journeys')
VERSE = "It's a chance I'm willing to take\nA mistake I'm willing to make\nCouldn't tell you where it'll go\nBut baby just know I'm good either way"
TRANSCRIPT = "[0:04] Speaker 1: so how are you, like actually\n[0:07] Speaker 2: I'm good. I'm fine. I'm being so normal about everything.\n[0:11] Speaker 3: that's the most un-fine sentence I've ever heard\n[0:14] Speaker 2: I'm not changing the locks, I'm just telling everyone I did.\n[0:31] Speaker 1: a fire exit for a relationship, that's what that is"
OVERFLOW = "() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.tagName + '.' + String(e.className).slice(0, 30)).slice(0, 6)"
results = []
def ok(name, cond, extra=''):
    results.append((name, bool(cond), extra)); print(('PASS ' if cond else 'FAIL ') + name + (f' — {extra}' if extra else ''))

async def api(page, method, path, body=None):
    return await page.evaluate("""async ([m, p, b]) => { const r = await fetch('/api' + p, { method: m, headers: { 'content-type': 'application/json', 'x-songroom': '1' }, body: b == null ? undefined : JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => null) }; }""", [method, path, body])

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 760}, device_scale_factor=2)
        page = await ctx.new_page()
        await page.goto(BASE + '/'); await page.wait_for_timeout(800)
        await page.get_by_label('Password').fill('dev'); await page.get_by_role('button', name='Sign in').click(); await page.wait_for_timeout(1200)

        # ---- 1. Ideas: one focused idea; Another; Previous restores ----
        await page.goto(BASE + '/#/ideas'); await page.wait_for_timeout(600)
        ok('tabs visible at phone width', await page.locator('nav.tabs a').count() == 4)
        await page.get_by_role('button', name='Give me an idea').click(); await page.wait_for_timeout(2500)
        t1 = (await page.locator('h1.idea-title').inner_text()).replace('\n', ' ')
        top = await page.evaluate("document.querySelector('h1.idea-title').getBoundingClientRect().top")
        ok('idea title near the top of the phone screen', top < 300, f'top={top:.0f}px')
        await page.screenshot(path=f'{OUT}/ideas.png')
        await page.get_by_role('button', name='Another idea').click(); await page.wait_for_timeout(1200)
        t2 = (await page.locator('h1.idea-title').inner_text()).replace('\n', ' ')
        ok('Another gives a different idea', t1 != t2)
        await page.get_by_role('button', name='← Previous').click(); await page.wait_for_timeout(800)
        ok('Previous restores the previous idea', (await page.locator('h1.idea-title').inner_text()).replace('\n', ' ') == t1)

        # ---- 2. Add a thought; switch tabs; return; still there; save independently ----
        await page.get_by_role('button', name='Add a thought').click(); await page.wait_for_timeout(200)
        await page.get_by_label('Add a thought to this idea').fill('half a line I had in the car')
        ok('tabs hidden while typing', await page.evaluate("document.body.classList.contains('typing')"))
        await page.goto(BASE + '/#/journal'); await page.wait_for_timeout(500)
        await page.goto(BASE + '/#/ideas'); await page.wait_for_timeout(800)
        ok('pending thought survives switching tabs', await page.get_by_label('Add a thought to this idea').input_value() == 'half a line I had in the car')
        await page.get_by_role('button', name='Keep this thought with the idea').click(); await page.wait_for_timeout(600)
        ok('thought kept as the exact words', (await page.locator('.fragment p').first.inner_text()) == 'half a line I had in the car')
        await page.locator('.fragment').first.get_by_role('button', name='Save fragment to Journal').click(); await page.wait_for_timeout(600)
        j = await api(page, 'GET', '/journal?filter=fragments&q=')
        ok('fragment saved to Journal on its own', any(e['text'] == 'half a line I had in the car' for e in j['body']['entries']))
        ideas_j = await api(page, 'GET', '/journal?filter=ideas&q=')
        ok('… without saving the whole idea', not any(e['title'] == t1 for e in ideas_j['body']['entries']))

        # ---- 3. Save twice → one entry; Start writing twice → one song ----
        await page.get_by_role('button', name='Save', exact=True).click(); await page.wait_for_timeout(500)
        await page.get_by_role('button', name='Saved ✓').click(force=True); await page.wait_for_timeout(300)
        ideas_j = await api(page, 'GET', '/journal?filter=ideas&q=')
        ok('save twice → one Journal entry', sum(1 for e in ideas_j['body']['entries'] if e['title'] == t1) == 1)
        sb = await api(page, 'GET', '/springboard')
        cur_id = sb['body']['current']['id']
        s1 = await api(page, 'POST', f'/ideas/{cur_id}/start'); s2 = await api(page, 'POST', f'/ideas/{cur_id}/start')
        ok('start writing twice → one linked song', s1['body']['songId'] == s2['body']['songId'])
        await page.reload(); await page.wait_for_timeout(900)
        await page.get_by_role('button', name='Continue writing').click(); await page.wait_for_timeout(900)
        ok('Continue writing opens the song', '/song/' in page.url and page.url.endswith(s1['body']['songId']))
        ed_top = await page.evaluate("document.getElementById('lyric-editor').getBoundingClientRect().top")
        ok('draft is visible first on the song page', ed_top < 420, f'editor top={ed_top:.0f}px')
        ok('seed lines are in Scraps, not the draft', (await page.locator('#lyric-editor').input_value()).strip() == '' and await page.locator('details.scraps').count() == 1)
        await page.screenshot(path=f'{OUT}/song.png')

        # ---- 4. Journal song: select a phrase → suggest → browse → unchanged → Keep → Undo ----
        await page.locator('#lyric-editor').fill('I kept coming home\nLike that was the same as staying')
        await page.locator('#lyric-editor').blur(); await page.wait_for_timeout(1800)
        await page.locator('#lyric-editor').click(position={'x': 10, 'y': 20})
        await page.keyboard.press('Control+Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight')
        for _ in range(4): await page.keyboard.press('Shift+ArrowRight')
        await page.wait_for_timeout(400)
        ok('selection shows what will change', 'kept' in (await page.locator('.ask .target').inner_text()).lower())
        await page.get_by_role('button', name='Rewrite').click(); await page.wait_for_timeout(300)
        try:
            await page.get_by_role('button', name='Suggest').click(timeout=8000)
        except Exception as e:
            await page.screenshot(path=f'{OUT}/fail-suggest.png')
            print('suggest state:', await page.get_by_role('button', name='Suggest').is_disabled(), repr(await page.get_by_label('Help with this').input_value()), await page.locator('.ask .target').inner_text())
            raise
        await page.wait_for_timeout(2500)
        ok('one suggestion at a time', await page.locator('.proposal').count() == 1)
        draft_before = await page.locator('#lyric-editor').input_value()
        await page.get_by_role('button', name='Next →').click(); await page.wait_for_timeout(300)
        ok('browsing leaves the draft unchanged', await page.locator('#lyric-editor').input_value() == draft_before)
        await page.get_by_role('button', name='Keep', exact=True).click(); await page.wait_for_timeout(1500)
        after = await page.locator('#lyric-editor').input_value()
        ok('Keep changes only the selected words', after != draft_before and after.split('\n')[1] == 'Like that was the same as staying' and '[stand-in' in after.split('\n')[0], after.split('\n')[0])
        await page.get_by_role('button', name='Undo').click(); await page.wait_for_timeout(1200)
        ok('Undo restores it', await page.locator('#lyric-editor').input_value() == draft_before)
        # type while a suggestion is pending: the result must not overwrite
        song_id = page.url.split('/song/')[1]

        # ---- 5. Create: brief → result → save; paste lyrics → Open in Journal exact ----
        await page.goto(BASE + '/#/create'); await page.wait_for_timeout(600)
        await page.get_by_label('What are you working on?').fill('three ideas about an ex at a wedding, country')
        await page.get_by_text('Fine-tune').click(); await page.wait_for_timeout(200)
        await page.get_by_label('Rhyme with (a word)').fill('tonight')
        await page.get_by_role('button', name='Generate').click(); await page.wait_for_timeout(3000)
        ok('Create shows one result', await page.locator('.create .result').count() == 1)
        await page.screenshot(path=f'{OUT}/create.png')
        await page.locator('.create .result').get_by_role('button', name='Save', exact=True).click(); await page.wait_for_timeout(600)
        ok('result saved to Journal', 'Saved' in (await page.locator('.create .status').inner_text()) or await page.locator('.create .result').get_by_role('button', name='Saved ✓').count() == 1)
        await page.get_by_role('button', name='New brief').click(); await page.wait_for_timeout(200)
        await page.get_by_label('What are you working on?').fill(VERSE)
        await page.get_by_role('button', name='Open in Journal').click(); await page.wait_for_timeout(1000)
        ok('Open in Journal keeps the pasted text exactly', (await page.locator('#lyric-editor').input_value()).strip() == VERSE)
        pasted_song = page.url.split('/song/')[1]

        # ---- 6. Develop in Create from Ideas ----
        await page.goto(BASE + '/#/ideas'); await page.wait_for_timeout(600)
        await page.get_by_role('button', name='More').click(); await page.wait_for_timeout(200)
        await page.get_by_role('menuitem', name='Develop in Create').click(); await page.wait_for_timeout(600)
        ok('Develop in Create shows which idea', 'Developing' in (await page.locator('.develop-base').inner_text()))
        await page.get_by_label('What should change?').fill('keep the title, more grown-up')
        await page.get_by_role('button', name='Generate').click(); await page.wait_for_timeout(3000)
        ok('developed version shown, original untouched', await page.locator('.create .result').count() == 1 and (await api(page, 'GET', '/springboard'))['body']['current']['title'] == t1)

        # ---- 7. Hang: paste → candidates → Start writing → song carries the source ----
        await page.goto(BASE + '/#/hang'); await page.wait_for_timeout(500)
        await page.get_by_role('button', name='Paste a transcript').click(); await page.wait_for_timeout(200)
        await page.get_by_label('Session (who, when)').fill('Tuesday with M')
        await page.get_by_role('textbox', name='Transcript').fill(TRANSCRIPT)
        await page.get_by_role('button', name='Read it').click()
        await page.locator('.hang-card').first.wait_for(timeout=15000)
        ok('hang candidates shown', await page.locator('.hang-card').count() >= 1)
        await page.screenshot(path=f'{OUT}/hang.png')
        await page.locator('.hang-card').first.get_by_role('button', name='Start writing').click(); await page.wait_for_timeout(1200)
        ok('Start writing from the hang opens a song', '/song/' in page.url)
        hsong = page.url.split('/song/')[1]
        ws = await api(page, 'GET', f'/songs/{hsong}')
        idea = await api(page, 'GET', f"/ideas/{ws['body']['idea']['id']}")
        ok('the song knows which session it came from', 'From the hang' in (idea['body'].get('note') or ''), idea['body'].get('note'))

        # ---- 8. legacy links ----
        await page.goto(BASE + '/#/write'); await page.wait_for_timeout(500)
        ok('#/write opens Ideas', await page.locator('h1.idea-title').count() == 1)
        await page.goto(BASE + '/#/browse'); await page.wait_for_timeout(500)
        ok('#/browse opens Create', await page.get_by_label('What are you working on?').count() == 1)
        await page.goto(BASE + f'/#/song/{pasted_song}'); await page.wait_for_timeout(700)
        ok('direct song link opens the song', (await page.locator('#lyric-editor').input_value()).strip() == VERSE)
        await page.reload(); await page.wait_for_timeout(900)
        runs_before = (await api(page, 'GET', '/receipts'))['body']
        await page.goto(BASE + '/#/ideas'); await page.wait_for_timeout(900)
        runs_after = (await api(page, 'GET', '/receipts'))['body']
        ok('reload restores the idea without a new generation', len(runs_after) == len(runs_before) and await page.locator('h1.idea-title').count() == 1)

        # ---- 9. widths, dark, desktop ----
        for w in (320, 393, 430):
            for route in ('ideas', 'create', 'journal', 'hang', f'song/{song_id}'):
                await page.set_viewport_size({'width': w, 'height': 760}); await page.goto(BASE + '/#/' + route); await page.wait_for_timeout(400)
                sw = await page.evaluate('document.documentElement.scrollWidth'); bad = await page.evaluate(OVERFLOW)
                if sw > w or bad: ok(f'no sideways scroll at {w} on {route}', False, f'{sw} {bad}')
        ok('no sideways scroll at 320/393/430 on every page', all(r[1] for r in results if r[0].startswith('no sideways')) if any(r[0].startswith('no sideways') for r in results) else True)
        await page.set_viewport_size({'width': 393, 'height': 760})
        await page.goto(BASE + '/#/journal'); await page.wait_for_timeout(500); await page.screenshot(path=f'{OUT}/journal.png')
        # keyboard: focusing the lyric editor hides the tabs and keeps submit reachable
        await page.goto(BASE + f'/#/song/{song_id}'); await page.wait_for_timeout(600)
        await page.locator('#lyric-editor').focus(); await page.wait_for_timeout(100)
        ok('tabs step aside while typing in the draft', await page.evaluate("getComputedStyle(document.querySelector('nav.tabs')).display") == 'none')
        dark = await b.new_context(viewport={'width': 393, 'height': 760}, device_scale_factor=2, color_scheme='dark')
        dp = await dark.new_page(); await dp.goto(BASE + '/'); await dp.wait_for_timeout(600)
        await dp.get_by_label('Password').fill('dev'); await dp.get_by_role('button', name='Sign in').click(); await dp.wait_for_timeout(1000)
        await dp.goto(BASE + '/#/ideas'); await dp.wait_for_timeout(700); await dp.screenshot(path=f'{OUT}/ideas-dark.png')
        desk = await b.new_context(viewport={'width': 1280, 'height': 860})
        dk = await desk.new_page(); await dk.goto(BASE + '/'); await dk.wait_for_timeout(600)
        await dk.get_by_label('Password').fill('dev'); await dk.get_by_role('button', name='Sign in').click(); await dk.wait_for_timeout(1000)
        await dk.goto(BASE + '/#/create'); await dk.wait_for_timeout(700); await dk.screenshot(path=f'{OUT}/desktop-create.png')
        ok('desktop shows the four destinations in the top nav, no tab bar', await dk.locator('.nav .nav-tab').count() == 4 and await dk.evaluate("getComputedStyle(document.querySelector('nav.tabs')).display") == 'none')
        await b.close()
    fails = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(fails)} passed, {len(fails)} failed')
    sys.exit(1 if fails else 0)
asyncio.run(main())
