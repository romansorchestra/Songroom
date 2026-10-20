"""Pack pilot-1.2: evidence hygiene (19 Oct 2026 commission, Phase A).

Appends version-2 records to cards.jsonl, pairs.jsonl and profiles.jsonl. Version-1 lines stay in
place as history; the app loads the highest version of each id. Also writes two new files:

- source_access.jsonl: per source, the recorded access status, how it was read, any duplicate,
  and any raw recheck.
- quote_checks.jsonl: per quotation behind a card, whether it was seen verbatim in raw text.

Run from the repo root:  python3 -I research/build_pack_v2.py
Re-running is safe: existing v2 lines are replaced, not duplicated.
"""
import json, re, pathlib, collections

R = pathlib.Path(__file__).resolve().parent
PACK = R / 'pack'
DATE = '2026-10-19'

def jl(p): return [json.loads(l) for l in open(p, encoding='utf-8') if l.strip()]
def latest(rows):
    by = {}
    for r in rows:
        if r['id'] not in by or r.get('version', 1) >= by[r['id']].get('version', 1): by[r['id']] = r
    return by

cards_all = jl(PACK / 'cards.jsonl'); pairs_all = jl(PACK / 'pairs.jsonl'); profiles_all = jl(PACK / 'profiles.jsonl')
cards_v1 = [c for c in cards_all if c.get('version', 1) == 1]
pairs_v1 = [p for p in pairs_all if p.get('version', 1) == 1]
profiles_v1 = [p for p in profiles_all if p.get('version', 1) == 1]
S = {s['id']: s for s in jl(PACK / 'sources.jsonl')}
F = {f['id']: f for f in jl(R / 'raw' / 'ALL_FINDINGS.jsonl')}

# ---------------------------------------------------------------- raw quote rechecks (19 Oct)
# Each quotation behind a card that was used in practice (plus C03/C32), searched for verbatim in the
# page's own text (HTML: document text in a browser; PDF: text extracted with pdf.js from the file).
VERIFIED = {  # finding id -> method
    'PB-F12': 'html', 'AD-F4': 'html', 'ST-F12': 'pdf', 'CT-F1': 'html', 'CT-F10': 'html', 'CW-F7': 'html',
    'ST-F1': 'html', 'PB-F4': 'html', 'CT-F4': 'html', 'CT-F11': 'html', 'PA-F3': 'pdf', 'AA-F2': 'pdf',
    'PA-F2': 'html', 'AA-F12': 'html', 'CT-F15': 'html', 'CT-F16': 'html', 'CW-F8': 'html', 'PB-F11': 'html',
    'AD-F3': 'html', 'CT-F13': 'html', 'CT-F6': 'html', 'CT-F8': 'html', 'CT-F14': 'html', 'PB-F1': 'pdf',
    'PB-F6': 'html', 'PB-F9': 'html', 'CW-F14': 'html', 'CW-F12': 'html', 'CW-F13': 'html', 'PB-F15': 'html',
    'PB-F16': 'html', 'PA-F12': 'html', 'AD-F10': 'html', 'PA-F1': 'html', 'CW-F9': 'html', 'CW-F6': 'html',
    'CT-F9': 'html', 'OR-F14': 'html', 'ST-F16': 'html', 'ST-F11': 'html', 'AA-F4': 'html', 'PA-F6': 'html',
}
NOT_RECHECKED = {
    'CT-F12': 'page behind bot protection (PressReader); not bypassed',
    'CW-F11': 'page behind a paywall (Boston Globe); not bypassed',
    'PB-F14': 'page no longer exists (AOL returns 404)',
}

quote_rows = []
for fid, f in F.items():
    if not f.get('quote'): continue
    src = f['source'].split('#')[0]
    if fid in VERIFIED: status, note = 'verified_raw', f"seen verbatim in the {'PDF text (pdf.js)' if VERIFIED[fid] == 'pdf' else 'page text'} on {DATE}"
    elif fid in NOT_RECHECKED: status, note = 'tool_extract_only', NOT_RECHECKED[fid]
    else: status, note = 'tool_extract_only', 'not rechecked; seen only in fetch-tool output during the 10 Oct research'
    quote_rows.append({'finding': fid, 'source': src, 'quote': f['quote'], 'status': status, 'note': note,
                       'url': S.get(src, {}).get('url'), 'checked': DATE if fid in VERIFIED or fid in NOT_RECHECKED else None})
QSTATUS = {q['finding']: q['status'] for q in quote_rows}

# ---------------------------------------------------------------- source access overlay
def nu(u):
    u = (u or '').strip().lower(); u = re.sub(r'^https?://', '', u); u = re.sub(r'^www\.', '', u); u = re.sub(r'#.*$', '', u); return u.rstrip('/')
canon = {}
by_url = collections.defaultdict(list)
for s in S.values():
    if nu(s['url']): by_url[nu(s['url'])].append(s['id'])
for ids in by_url.values():
    for i in ids[1:]: canon[i] = ids[0]
canon['PA-S11'] = 'AA-S3'  # the same NPR interview syndicated on two station sites
RAW_PAGES = {  # sources whose raw text was opened on 19 Oct (full article or full PDF)
    'AA-S2': 'pdf', 'PA-S1': 'pdf', 'ST-S1': 'pdf', 'PB-S1': 'pdf', 'AA-S3': 'html', 'PA-S11': 'html', 'PB-S55': 'html', 'AD-S17': 'html',
    'CT-S1': 'html', 'CT-S25': 'html', 'CW-S25': 'html', 'ST-S30': 'html', 'PB-S4': 'html', 'CT-S39': 'html', 'CT-S26': 'html',
    'PA-S3': 'html', 'AA-S10': 'html', 'CT-S36': 'html', 'CT-S19': 'html', 'CW-S27': 'html', 'PB-S47': 'html', 'AD-S16': 'html',
    'CT-S33': 'html', 'CT-S11': 'html', 'CT-S14': 'html', 'CT-S34': 'html', 'PB-S9': 'html', 'PB-S29': 'html', 'CW-S19': 'html',
    'CW-S20': 'html', 'CW-S36': 'html', 'PB-S64': 'html', 'PB-S14': 'html', 'PA-S30': 'html', 'AD-S36': 'html', 'PA-S4': 'html',
    'CW-S24': 'html', 'CW-S21': 'html', 'CT-S21': 'html', 'OR-S20': 'html', 'ST-S15': 'html', 'ST-S44': 'html', 'PA-S19': 'html',
}
RAW_FAILED = {'CT-S32': 'bot protection', 'CW-S26': 'paywall', 'PB-S63': 'page gone (404)'}
source_rows = []
for s in S.values():
    st = s['access_status']
    method = 'tool_extract' if st in ('fetched_full', 'fetched_partial') else 'snippet' if st == 'snippet_only' else 'none'
    row = {'id': s['id'], 'recorded_access': st, 'access_method': method, 'duplicate_of': canon.get(s['id'])}
    if s['id'] in RAW_PAGES: row['raw_recheck'] = {'date': DATE, 'method': 'pdf.js text of the file' if RAW_PAGES[s['id']] == 'pdf' else 'page text in a browser', 'result': 'opened in full'}
    if s['id'] in RAW_FAILED: row['raw_recheck'] = {'date': DATE, 'result': 'not opened: ' + RAW_FAILED[s['id']]}
    if s['id'] in ('AA-S2', 'PA-S1'):
        row['note'] = 'Same PDF recorded as partial (AA-S2) and full (PA-S1) by two agents; both read it through the fetch tool. Reconciled: one source (AA-S2); its full text was opened on 19 Oct.'
    if s['id'] == 'CT-S41':
        row['note'] = 'Episode listing seen as a search snippet only; never opened. No longer supports any card (C45 v2).'
    source_rows.append(row)

# ---------------------------------------------------------------- card annotations
LEX = 'Lexical choice: judged on the words; no audio involved.'
STRUCT = 'Structure: visible in the text; how it feels sung is not checked.'
A = {  # id: (applies_to, routes, limits, generator_technique or None)
 'C01': ('both', ['create', 'rewrite', 'continue', 'develop'], "Speech-to-melody fit (Carpenter's moved ending) is a writer's account of a recording; not checked by listening.",
         "When the brief, his notes or the song contain his own or the artist's spoken phrasing, build the lines around those exact words instead of translating them into lyric language."),
 'C02': ('generator', ['rewrite', 'continue', 'create', 'develop'], LEX, None),
 'C03': ('session', [], 'Room process: keeping and re-hearing a flagged line is a human decision.', None),
 'C04': ('both', ['create', 'rewrite', 'continue', 'ideas'], LEX, 'Write a petty or jealous line as dry sarcasm that is funny and true, not as cruelty.'),
 'C05': ('generator', ['rewrite', 'continue', 'create'], LEX, None),
 'C06': ('generator', ['create', 'rewrite', 'continue', 'ideas', 'develop'], "Pattern is the analyst's inference across four documented cases; lexical, no audio involved.", None),
 'C07': ('generator', ['create', 'rewrite', 'continue'], LEX, None),
 'C08': ('generator', ['continue', 'create'], LEX, None),
 'C09': ('generator', ['rewrite', 'continue', 'create'], "Dropping rhyme is lexical; 'conviction in the delivery' is a performance note from the writer, not checked by listening.", None),
 'C10': ('generator', ['rewrite', 'continue'], 'Rhyme classes are judged from pronunciation (dictionary), not by listening.', None),
 'C11': ('generator', ['create', 'rewrite', 'continue', 'ideas', 'develop'], LEX, None),
 'C12': ('generator', ['create', 'rewrite', 'ideas', 'title'], LEX, None),
 'C13': ('generator', ['create', 'continue', 'rewrite'], "Picture-or-stock-phrase is lexical; 'longer notes after a dense run' is a melodic claim from writer statements (McKee, Martin), not checked by listening.", None),
 'C14': ('generator', ['create', 'rewrite', 'continue', 'ideas'], LEX, None),
 'C15': ('generator', ['rewrite', 'continue'], "Stress is estimated from speech rhythm (Pattison's method); whether it lands on the beat depends on a melody the app cannot hear.", None),
 'C16': ('generator', ['rewrite'], 'Matching syllable counts and stress positions is checkable in text; whether it sings is not. Moving the pre-chorus is a musical change.', None),
 'C17': ('both', ['rewrite', 'continue'], "The vowel/stress template comes from writers' accounts of sung placeholders; nothing was heard.",
         'If he gives placeholder syllables or a dummy line, keep its syllable count and stressed positions as the template for the real words.'),
 'C18': ('session', [], 'Only singing both on the note can settle it; any vowel explanation is speculation.', None),
 'C19': ('generator', ['create', 'continue'], "Line count, length and rhyme scheme are visible in text; 'feels settled' is Pattison's claim about listening.", None),
 'C21': ('session', [], 'Key, register and full-voice delivery are musical; the app cannot hear them.', None),
 'C22': ('generator', ['ideas', 'create', 'develop', 'title'], LEX, None),
 'C23': ('generator', ['ideas', 'create', 'rewrite', 'continue'], LEX, None),
 'C24': ('generator', ['create', 'continue', 'ideas'], 'Observable from press descriptions of the records; the effect of the reply voice is a critical reading.', None),
 'C25': ('generator', ['create', 'continue', 'ideas'], "A critics' and analyst's reading of a catalogue, not a documented method; lexical.", None),
 'C26': ('generator', ['ideas', 'create', 'develop'], LEX, None),
 'C27': ('generator', ['create', 'rewrite', 'continue'], LEX, None),
 'C28': ('generator', ['rewrite', 'continue', 'create'], LEX, None),
 'C29': ('generator', ['ideas', 'develop', 'title', 'create'], LEX, None),
 'C30': ('generator', ['ideas', 'develop', 'title', 'create'], LEX, None),
 'C31': ('generator', ['ideas', 'title', 'develop'], "Double readings are critics' readings of two songs (no writer statement); lexical.", None),
 'C32': ('generator', ['title', 'ideas', 'develop'], LEX, None),
 'C33': ('generator', ['title', 'ideas'], 'Lexical. The pattern is drawn from press accounts of one album; no source says it is deliberate.', None),
 'C34': ('generator', ['rewrite', 'title', 'ideas'], "Lexical, but the 'confident, playful persona' that makes the oddness work is carried by delivery, which is not checked.", None),
 'C35': ('both', ['title', 'develop', 'ideas'], LEX, 'When a phrase someone actually said is available, try shifting its tense or person until it admits something; that can be the title.'),
 'C36': ('generator', ['ideas', 'title', 'develop', 'create'], LEX, None),
 'C37': ('generator', ['ideas'], 'Lexical; depends on the listener knowing the earlier song.', None),
 'C38': ('session', [], 'Co-writing process (where to start, how to take an artist rejecting a chorus).', None),
 'C39': ('generator', ['ideas', 'develop'], LEX, None),
 'C40': ('generator', ['title', 'ideas', 'develop'], LEX, None),
 'C41': ('generator', ['ideas', 'create', 'continue'], 'Lexical/structural; whether vagueness helps an anthem is a commercial question the sources disagree on.', None),
 'C43': ('generator', ['create', 'continue', 'title'], STRUCT, None),
 'C44': ('generator', ['create', 'continue'], 'The cliffhanger is lexical; section ranges are musical (writer statements), not checked.', None),
 'C45': ('generator', ['create', 'continue'], "Stance change is lexical; the rhythm change is the writer's (Abrams') account, not checked by listening.", None),
 'C46': ('session', [], 'Depends on material he has cut, which the writer does not see.', None),
 'C47': ('both', ['create', 'continue'], 'Only the lyric part (holding the full title or biggest statement back) is usable in text; drums and full-voice arrival are production.',
         'Consider holding the full title or the biggest statement back until late in the song so the last plain chorus feels earned.'),
 'C48': ('generator', ['create'], 'Observable from press descriptions of the record structure; not checked by listening.', None),
 'C49': ('both', ['create', 'continue', 'rewrite'], 'On paper a spoken interjection carries almost nothing; the effect is in delivery, which is not checked.',
         'If attitude will not come through in sung lines, a short spoken interjection can carry it; mark it as spoken.'),
 'C50': ('both', ['create', 'continue'], 'The lift from harmony, texture or register is musical and not checked; only the transition-writing part is lexical.',
         "Write transitions as their own job, and don't add new words to the last chorus just to make it lift."),
 'C51': ('generator', ['create', 'ideas'], 'Observable from press descriptions; niche (hip-hop portrait songs).', None),
 'C52': ('generator', ['create', 'ideas', 'continue'], LEX, None),
 'C53': ('session', [], 'Writing to a loop is a production process; a text writer has no loop.', None),
 'C54': ('session', [], 'A recording process (a long ramble then a hard edit); two cases with opposite receptions.', None),
 'C55': ('generator', ['ideas', 'create'], "The analyst's sort of genre habit vs general craft; its transfer outside country is untested. Lexical.", None),
 'C59': ('generator', ['ideas', 'create'], LEX, None),
 'C60': ('session', [], 'A judgment about keeping a plain chorus belongs to the writer in the room.', None),
 'C61': ('generator', ['continue', 'rewrite', 'create'], "Assembled by the analyst from chorus/verse statements; no writer statement on connective lines. Lexical.", None),
}
FIX = {  # rendered-field corrections: unverified quotations become paraphrase; the C45 snippet claim is removed
 'C04': {'when_not': "Abrams admits a verse line hurt the person it was about. And no source documents which lines changed between the crude draft and the release, so filing it down is her description of a direction, not a recipe."},
 'C18': {'when_not': "Gorley gives no phonetic reason beyond the line singing better, so any vowel explanation is speculation. Finneas finds boring lyrics on a beautiful melody less forgivable: sound-first is a tie-breaker, not a licence for the duller line."},
 'C27': {'when_not': "ADÉLA's Therapy was cut from a 15-minute ramble over the beat and several critics called it the album's weakest, with very simple lyrics: unedited diary material needs a strong edit."},
 'C38': {'when_not': "Allen's own album shows she drops chorus-first when writing for herself. The Greedy rewrite is documented only as a change of the chorus lyric and concept; no wording is available."},
 'C45': {'technique': "Keep a bridge when it brings a new stance (doubt, defiance, the narrator's own admission, a reversal), set apart by a change of rhythm rather than more speed. A bridge that only restates the chorus feeling may be better cut (an inference; Tyler dropped bridges on purpose for one album).",
         'when_not': "Roan's two-minute bridge came after a year of work on the song; not evidence that bridges should be fast. Abrams describes one song; the cut-it advice is the analyst's reading, not a writer's rule.",
         'sources': ['PB-S1', 'PA-S20', 'ST-S44'], 'findings': ['PB-F2', 'PA-F9', 'ST-F11'],
         'example': "Gracie Abrams says most of her album's bridges rush as manic thought but on I Love You, I'm Sorry she wanted a rhythmic change, and the bridge is where she owns her behaviour as a habit to break. Roan wrote the Good Luck, Babe! bridge alone in about two minutes over looped pre-chorus chords once the chorus's claim was settled. Tyler set a rule of no bridges for a whole album."},
}

def unquote_unverified(text, verified_quotes):
    def rep(m):
        inner = m.group(1) or m.group(2)
        norm = inner.lower().strip(" .?!")
        if any(norm and norm in v for v in verified_quotes): return m.group(0)
        return inner
    return re.sub(r'[\"“]([^\"”]{3,140})[\"”]|(?<![A-Za-z])\'([^\']{3,80})\'(?![A-Za-z])', rep, text)

verified_quotes = [q['quote'].lower().strip(' .?!') for q in quote_rows if q['status'] == 'verified_raw']

cards_v2 = []
for c in cards_v1:
    a = A[c['id']]
    v = dict(c)
    v['version'] = 2
    v['claim_type'] = c['evidence']
    v['applies_to'], v['routes'], v['limits'] = a[0], a[1], a[2]
    v['generator_technique'] = a[3]
    v['audio_caveat'] = None
    v.update(FIX.get(c['id'], {}))
    for k in ('example', 'effect'):
        if v.get(k): v[k] = unquote_unverified(v[k], verified_quotes)
    sup = []
    for fid in v.get('findings', []):
        f = F[fid]; sid = f['source'].split('#')[0]
        sup.append({'finding': fid, 'source': canon.get(sid, sid), 'claim_type': f['evidence'], 'confidence': f['confidence'],
                    'recorded_access': S.get(sid, {}).get('access_status'), 'quote': QSTATUS.get(fid)})
    v['support'] = sup
    v['active'] = True
    notes = ['separate claim type / access / confidence labels', 'claim-specific limits replace the blanket audio caveat']
    if a[0] == 'session': notes.append('human co-writing process: kept as reference, not retrieved for generation')
    if a[3]: notes.append('generator_technique added: the part a text writer can act on')
    if c['id'] in FIX: notes.append('rendered text corrected (unverified quotation made paraphrase' + ('; snippet-only source CT-S41 and its claim removed' if c['id'] == 'C45' else '') + ')')
    v['changes'] = {'date': DATE, 'pack': 'pilot-1.2', 'notes': notes}
    cards_v2.append(v)

# ---------------------------------------------------------------- pairs: both sides must meet the same brief and constraints
PAIR_FIX = {
 'E02': (['Her candle has burned down to the glass', "I didn't see it getting low"], "The original A did not show that she had stopped expecting him; replaced with an atmospheric detail that meets the brief, so the contrast is ornamental vs behavioural, not on-brief vs off-brief."),
 'E05': (["You know he's never gonna change", 'and you go running back again'], "The original A stacked three stock phrases no professional would offer; replaced with a competent stock-phrase chorus so the contrast is stock vs purposeful."),
 'E06': (['the moonlight keeps your name awake'], "The original A did not carry the required meaning (still awake, still him); replaced with a poetic line that does."),
 'E07': (['I scroll through every photo of you two', "I can't help it, I'm only human"], "The original A did not admit the checking, which the brief requires; replaced with generic-vulnerability wording that does."),
 'E08': (["He talks like he's a millionaire", "but he can't even pay his share"], "The original A was a deliberately clumsy sentence; replaced with a competent full-sentence hook so the contrast is sentence vs fragment."),
 'E16': (['Jealous of the ex he still follows online, and how she makes you feel second best.'], "The original A was a topic with adjectives attached (a strawman); replaced with a plausible topic-level concept."),
}
pairs_v2 = []
for p in pairs_v1:
    if p['id'] not in PAIR_FIX: continue
    v = dict(p); v['version'] = 2; v['a'] = PAIR_FIX[p['id']][0]
    v['analyst_view'] = "Analyst's view, not a correct answer: " + p['analyst_view']
    v['changes'] = {'date': DATE, 'pack': 'pilot-1.2', 'notes': [PAIR_FIX[p['id']][1], 'A is original and synthetic, written 19 Oct.']}
    pairs_v2.append(v)

# ---------------------------------------------------------------- profiles: say what each rests on
profiles_v2 = []
for p in profiles_v1:
    v = dict(p); v['version'] = 2
    sample = p.get('sample', [])
    v['coverage'] = (f"Rests on {len(sample)} song{'s' if len(sample) != 1 else ''} ({', '.join(sample[:8])}{'…' if len(sample) > 8 else ''}) "
                     f"and {len(p.get('sources', []))} sources, checked 10 Oct 2026. It describes those, not the whole catalogue.")
    v['changes'] = {'date': DATE, 'pack': 'pilot-1.2', 'notes': ['coverage boundary added and shown with the reference']}
    profiles_v2.append(v)

# ---------------------------------------------------------------- write
def write_versioned(path, v1, v2):
    with open(path, 'w', encoding='utf-8') as fh:
        for r in v1: fh.write(json.dumps(r, ensure_ascii=False) + '\n')
        for r in v2: fh.write(json.dumps(r, ensure_ascii=False) + '\n')
write_versioned(PACK / 'cards.jsonl', cards_v1, cards_v2)
write_versioned(PACK / 'pairs.jsonl', pairs_v1, pairs_v2)
write_versioned(PACK / 'profiles.jsonl', profiles_v1, profiles_v2)
with open(PACK / 'source_access.jsonl', 'w', encoding='utf-8') as fh:
    for r in source_rows: fh.write(json.dumps(r, ensure_ascii=False) + '\n')
with open(PACK / 'quote_checks.jsonl', 'w', encoding='utf-8') as fh:
    for r in quote_rows: fh.write(json.dumps(r, ensure_ascii=False) + '\n')

m = json.load(open(PACK / 'manifest.json', encoding='utf-8'))
m.update({
    'pack_version': 'pilot-1.2', 'built': DATE,
    'counts': {'sources': len(S), 'sources_distinct_evidence_bearing': 104, 'cards': len(cards_v2),
               'cards_for_generation': sum(1 for c in cards_v2 if c['applies_to'] != 'session'),
               'cards_session_only': sum(1 for c in cards_v2 if c['applies_to'] == 'session'),
               'profiles': len(profiles_v2), 'pairs': len(pairs_v1), 'pairs_repaired': len(pairs_v2), 'sam_judgments': 22},
    'quotes': dict(collections.Counter(q['status'] for q in quote_rows)),
    'versioning': 'cards/pairs/profiles hold every version; the app loads the highest version of each id. v1 lines are history.',
    'notes': 'pilot-1.2 (19 Oct): evidence hygiene only, no new research. See research/CHANGELOG.md. pilot-1.1 (11 Oct) added sam_judgments.jsonl.',
})
json.dump(m, open(PACK / 'manifest.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('cards v2', len(cards_v2), 'session-only', sum(1 for c in cards_v2 if c['applies_to'] == 'session'), 'pairs repaired', len(pairs_v2), 'profiles v2', len(profiles_v2))
print('quotes', collections.Counter(q['status'] for q in quote_rows))
