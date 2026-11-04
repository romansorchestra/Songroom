# The simple app (3 Nov 2026) in a real browser against the stand-in: the chat as the front
# door, a lyric saved to Songs, a song worked on in a chat, "remember", the drawer, and the
# chrome staying on the glass at short phone heights (393x659, 430x719), 320 wide, dark and
# desktop. Start the app with SONGROOM_STANDIN=1 APP_PASSWORD=dev SESSION_SECRET=dev
# PORT=8745 DB_PATH=<fresh file>, then `python3 tests/journeys/chat_journey.py`.
import asyncio, os, sys
from playwright.async_api import async_playwright

BASE = os.environ.get('JOURNEY_BASE', 'http://127.0.0.1:8745')
OUT = os.environ.get('JOURNEY_OUT', '/tmp/songroom-chat')
os.makedirs(OUT, exist_ok=True)
results = []

def check(name, ok, detail=''):
    results.append((name, bool(ok)))
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail and not ok else ''))

OFF_GLASS = """() => {
  const bad = [];
  for (const sel of ['.composer', '.bar', '.send']) for (const e of document.querySelectorAll(sel)) {
    const r = e.getBoundingClientRect();
    if (r.bottom > window.innerHeight + 1 || r.right > window.innerWidth + 1 || r.top < -1) bad.push(sel + ' ' + Math.round(r.bottom) + '/' + window.innerHeight);
  }
  if (document.documentElement.scrollWidth > window.innerWidth + 1) bad.push('page scrolls sideways');
  return bad;
}"""

async def wait_reply(page, n):
    for _ in range(60):
        if await page.locator('.msg.them .md').count() >= n and await page.locator('.thinking').count() == 0 and not await page.locator('.send').is_disabled() or False:
            break
        await page.wait_for_timeout(250)
    for _ in range(60):
        if await page.locator('.msg.them').count() >= n and await page.locator('.lyric-actions').count() >= n: return True
        await page.wait_for_timeout(250)
    return False

async def send(page, text):
    await page.fill('.composer textarea', text)
    await page.locator('.send').click()

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 659}, device_scale_factor=2, has_touch=True)
        page = await ctx.new_page()
        await page.goto(BASE + '/')
        await page.fill('input[type=password]', 'dev')
        await page.keyboard.press('Enter')
        await page.wait_for_timeout(900)

        check('lands on the chat', await page.locator('.chat-empty h1').inner_text() == 'What are we writing?')
        check('empty chat: chrome on the glass', not await page.evaluate(OFF_GLASS), str(await page.evaluate(OFF_GLASS)))
        await page.screenshot(path=f'{OUT}/1-empty.png')

        await send(page, 'Write me a modern country song called Already Late')
        check('his message shows', await page.locator('.msg.me .bubble').first.inner_text() == 'Write me a modern country song called Already Late')
        check('reply arrives with a lyric sheet', await wait_reply(page, 1))
        check('the address is the chat', '#/chat/t_' in page.url, page.url)
        check('the lyric title is styled', await page.locator('.lyric-title').first.inner_text() == 'STAND-IN SONG')
        await page.screenshot(path=f'{OUT}/2-reply.png')

        await page.locator('.chip-btn', has_text='Save to Songs').click()
        await page.wait_for_timeout(700)
        check('saved to Songs', await page.locator('.chip-btn.done', has_text='Saved').count() == 1)

        # a longer conversation: the composer stays put, the newest reply is in view
        for i in range(3):
            await send(page, f'Another pass, number {i + 2}')
            await wait_reply(page, i + 2)
        bad = await page.evaluate(OFF_GLASS)
        check('long chat at 393x659: chrome on the glass', not bad, str(bad))
        in_view = await page.evaluate("""() => { const s = document.querySelector('.chat-scroll'), sr = s.getBoundingClientRect();
          const me = [...s.querySelectorAll('.msg.me')].pop().getBoundingClientRect(), them = [...s.querySelectorAll('.msg.them')].pop().getBoundingClientRect();
          return me.top >= sr.top - 2 && them.top < sr.bottom && them.top > sr.top; }""")
        check('long chat: his last message and the reply under it in view', in_view)
        check('long chat: the box says Reply', await page.get_attribute('.composer textarea', 'placeholder') == 'Reply')
        await page.screenshot(path=f'{OUT}/3-long.png')
        await page.set_viewport_size({'width': 430, 'height': 719})
        await page.wait_for_timeout(300)
        bad = await page.evaluate(OFF_GLASS)
        check('long chat at 430x719: chrome on the glass', not bad, str(bad))
        await page.set_viewport_size({'width': 393, 'height': 659})

        # remember
        await send(page, 'remember that I never want filler like "I know, I know"')
        await wait_reply(page, 5)
        await page.wait_for_timeout(400)
        check('remember: confirmed under the reply', await page.locator('.remembered').count() == 1)

        # the drawer
        await page.locator('.menu-btn').click()
        await page.wait_for_timeout(350)
        await page.screenshot(path=f'{OUT}/4-drawer.png')
        check('drawer lists the chat', await page.locator('.drawer-chat').count() == 1)
        await page.locator('.drawer-link', has_text='What it remembers').click()
        await page.wait_for_timeout(700)
        check('memory page shows the note', await page.locator('text=I never want filler').count() >= 1)
        await page.screenshot(path=f'{OUT}/5-memory.png', full_page=True)

        # Songs and a song
        await page.goto(BASE + '/#/songs')
        await page.wait_for_timeout(700)
        check('Songs lists the saved song', await page.locator('.song-row .t', has_text='Stand-In Song').count() == 1)
        await page.locator('.song-row').first.click()
        await page.wait_for_timeout(700)
        check('song page: title and lyric', await page.locator('.song-title').inner_text() == 'Stand-In Song' and await page.locator('.lyric-sheet').count() == 1)
        await page.screenshot(path=f'{OUT}/6-song.png', full_page=True)
        await page.locator('button', has_text='Edit').click()
        await page.fill('.lyric-edit', '[Verse 1]\nmy own first line\nmy own second line')
        await page.locator('button', has_text='Save').click()
        await page.wait_for_timeout(700)
        check('song page: edit saved', await page.locator('.lyric-line', has_text='my own first line').count() == 1)
        await page.locator('button', has_text='Work on it').click()
        await page.wait_for_timeout(700)
        check('work on it: chat knows the song', 'Stand-In Song' in await page.locator('.chat-song').inner_text())
        await send(page, 'tighten the verse')
        await wait_reply(page, 1)
        check('song chat: save makes the next version', await page.locator('.chip-btn', has_text='Save as new version').count() == 1)
        await page.locator('.chip-btn', has_text='Save as new version').click()
        await page.wait_for_timeout(700)
        check('song chat: saved', await page.locator('.chip-btn.done').count() == 1)

        # new chat from inside a chat, and the older tools still open
        await page.locator('.bar-btn[aria-label="New chat"]').click()
        await page.wait_for_timeout(600)
        check('new chat is empty', await page.locator('.chat-empty').count() == 1)
        # a chat with a long first message: its row in the drawer is cut short, not the drawer
        await send(page, 'Write me a modern country song called Spare Key. She moved out but never gave back the key, and I have not changed the lock.')
        await wait_reply(page, 1)
        await page.locator('.menu-btn').click()
        await page.wait_for_timeout(350)
        spill = await page.evaluate("""() => { const d = document.querySelector('.drawer').getBoundingClientRect();
          return [...document.querySelectorAll('.drawer-inner *')].filter(e => e.getBoundingClientRect().right > d.right + 1).map(e => e.className || e.tagName).slice(0, 5); }""")
        check('drawer: a long chat title stays inside the drawer', not spill, str(spill))
        await page.screenshot(path=f'{OUT}/4b-drawer-long.png')
        await page.keyboard.press('Escape')
        await page.goto(BASE + '/#/ideas')
        await page.wait_for_timeout(900)
        check('older tools: Ideas still opens', await page.locator('nav.tabs').count() == 1)

        # other sizes
        chat_url = None
        for (w, h, scheme, tag) in [(320, 640, 'light', '320'), (393, 659, 'dark', 'dark'), (1280, 860, 'light', 'desktop')]:
            c2 = await b.new_context(viewport={'width': w, 'height': h}, color_scheme=scheme, device_scale_factor=2, storage_state=await ctx.storage_state())
            p2 = await c2.new_page()
            await p2.goto(BASE + '/#/')
            await p2.wait_for_timeout(700)
            chats = await p2.evaluate("async () => (await (await fetch('/api/chats', {headers:{'x-songroom':'1'}})).json())")
            await p2.goto(f"{BASE}/#/chat/{chats[-1]['id']}")
            await p2.wait_for_timeout(900)
            bad = await p2.evaluate(OFF_GLASS)
            check(f'{tag}: chrome on the glass', not bad, str(bad))
            if tag == 'desktop': check('desktop: the drawer stays open beside the chat', await p2.locator('.drawer').evaluate("e => e.getBoundingClientRect().left >= 0 && e.getBoundingClientRect().right > 100"))
            await p2.screenshot(path=f'{OUT}/7-{tag}.png')
            await c2.close()
        await b.close()
    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)} of {len(results)} passed')
    sys.exit(1 if failed else 0)

asyncio.run(main())
