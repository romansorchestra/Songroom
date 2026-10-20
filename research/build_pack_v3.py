#!/usr/bin/env python3
"""Stage the 19 Oct 2026 song-analysis round as a CANDIDATE pack (pilot-1.3-candidate).

Reads research/raw/songs-{pop,ballad,country,songwriter}/ and writes
research/pack/candidates/. Nothing here is loaded by the app: the commission says the
expanded pack is compared with pilot-1.2 only after the route-level test, with every other
input fixed. Run: python3 -I research/build_pack_v3.py  (idempotent)

Review decisions (19 Oct, the builder):
- 7 of the 12 proposed cards add a distinction no existing card makes and become C62-C68.
- 2 counterexamples to C43 become a limit on C43 (a v3 line), not new cards.
- Declined as cards, kept as findings: the gendered-word card (one case, narrow), the moving
  image card (low confidence; the two descriptions disagree), the fantasy-verse key change and
  the set-the-feel-to-where-it-ends card (both musical, room-only, no generator use).
- Lyric displays seen only through the fetch tool on press pages whose licence is not shown
  (TODAY.com, Capital FM, Wide Open Country, Holler) are kept as a basis but labelled so;
  every observation resting on them says "via a press print, licence not shown".
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / 'raw'
PACK = ROOT / 'pack'
OUT = PACK / 'candidates'
SLICES = ['songs-pop', 'songs-ballad', 'songs-country', 'songs-songwriter']
VERSION = 'pilot-1.3-candidate'
DATE = '2026-10-19'


def jl(path):
    return [json.loads(l) for l in path.read_text().splitlines() if l.strip()] if path.exists() else []


def latest(rows):
    best = {}
    for r in rows:
        if r['id'] not in best or r.get('version', 1) >= best[r['id']].get('version', 1):
            best[r['id']] = r
    return best


# ---------------------------------------------------------------- sources and findings
old_sources = {s['url'].rstrip('/'): s['id'] for s in jl(PACK / 'sources.jsonl') if s.get('url')}
sources, findings, seen_url = [], [], {}
for sl in SLICES:
    for s in jl(RAW / sl / 'sources.jsonl'):
        u = (s.get('url') or '').rstrip('/')
        s = {**s, 'slice': sl, 'access_method': s.get('access_method', 'tool_extract')}
        if u and u in old_sources:
            s['duplicate_of'] = old_sources[u]
        elif u and u in seen_url:
            s['duplicate_of'] = seen_url[u]
        elif u:
            seen_url[u] = s['id']
        sources.append(s)
    for f in jl(RAW / sl / 'findings.jsonl'):
        f = {**f, 'slice': sl}
        if f.get('quote') and not f.get('quote_basis'):
            f['quote_basis'] = 'tool_extract'
        findings.append(f)
src_by_id = {s['id']: s for s in sources} | {s['id']: s for s in jl(PACK / 'sources.jsonl')}
find_by_id = {f['id']: f for f in findings} | {f['id']: f for f in jl(RAW / 'ALL_FINDINGS.jsonl')}

# ---------------------------------------------------------------- song records
SONG_NOTES = {
    'SB-SONG1': "Sam Roman, who owns this app, is one of the five credited writers. No source here attributes any line to any writer; his own account would outrank every source in this record.",
}
songs = []
for sl in SLICES:
    for s in jl(RAW / sl / 'songs.jsonl'):
        s = {**s, 'slice': sl}
        if s['id'] in SONG_NOTES:
            s['builder_note'] = SONG_NOTES[s['id']]
        if s['id'] in ('SP-SONG1', 'SP-SONG2', 'SC-SONG1', 'SC-SONG2'):
            s['lyric_basis_note'] = 'Lyric seen only as the fetch tool\'s description of a press page that prints it (licence not shown); no lyric is stored here.'
        songs.append(s)
assert len(songs) == 8, len(songs)

# ---------------------------------------------------------------- cards
proposed = {}
for sl in SLICES:
    for i, c in enumerate(jl(RAW / sl / 'proposed_cards.jsonl')):
        proposed[f'{sl}#{i + 1}'] = c


def support(fids):
    out = []
    for fid in fids:
        f = find_by_id.get(fid, {})
        sid = (f.get('source') or '').split('#')[0]
        s = src_by_id.get(sid, {})
        out.append({'finding': fid, 'source': sid, 'claim_type': f.get('evidence'), 'confidence': f.get('confidence'),
                    'recorded_access': s.get('access_status'), 'quote': ('tool_extract' if f.get('quote') else None)})
    return out


# id, proposal, retrieval tags, applies_to, generator wording (None = technique as written), effect
NEW = [
    ('C62', 'songs-ballad#1', ['plainness', 'generic', 'love', 'breakup', 'title', 'chorus'], ['singer_songwriter', 'pop', 'any'], ['ideas', 'lines', 'draft'], 'generator', None,
     'The song can hold more than one listener\'s loss without going vague, because the narrator\'s side stays concrete.'),
    ('C63', 'songs-ballad#2', ['chorus', 'confession', 'admission', 'hook', 'double_meaning'], ['singer_songwriter', 'pop', 'any'], ['lines', 'edit', 'draft', 'ideas'], 'generator', None,
     'The chorus can be sung with full conviction and still be heard as its opposite.'),
    ('C64', 'songs-country#1', ['title', 'hook', 'chorus', 'double_meaning', 'detail'], ['country', 'singer_songwriter', 'any'], ['ideas', 'lines', 'draft'], 'generator', None,
     'The title turns without new vocabulary: the same words give opposite verdicts.'),
    ('C65', 'songs-country#2', ['title', 'hook', 'double_meaning', 'idiom_flip', 'opening', 'chorus'], ['country', 'pop', 'any'], ['ideas', 'lines', 'draft'], 'both',
     'State the misleadable title phrase plainly in the first line, as an admission. Let the chorus give the reason in a plain line addressed to the real object of the feeling, explaining the opening without contradicting it, so the turn is an explanation, not a trick. Choose the reading that makes the everyday sense partly true, pushed to an extreme.',
     'The listener is misled for a line, then understands; nobody feels tricked.'),
    ('C66', 'songs-pop#1', ['chorus', 'humour', 'sarcasm', 'bluntness', 'attitude', 'escalation'], ['pop'], ['lines', 'draft', 'edit'], 'generator', None,
     'The title stays sweet and repeatable while the chorus still ends with a sting.'),
    ('C67', 'songs-pop#2', ['title', 'place', 'concept', 'angle'], ['pop', 'any'], ['ideas', 'draft'], 'generator', None,
     'Listeners put their own town in the blank; the cost is that critics may call it vague.'),
    ('C68', 'songs-songwriter#1', ['chorus', 'detail', 'specificity', 'confession', 'structure'], ['singer_songwriter', 'any'], ['lines', 'draft', 'edit'], 'generator', None,
     'A private loss becomes singable by everyone without being explained in the chorus.'),
]
cards = []
for cid, key, contexts, genres, tasks, applies, gen, effect in NEW:
    p = proposed[key]
    cards.append({
        'id': cid, 'version': 1, 'problem': p['problem'], 'technique': p['technique'], 'example': p.get('example', ''),
        'sources': p['sources'], 'findings': p['findings'], 'evidence': p['claim_type'], 'effect': effect,
        'contexts': contexts, 'genres': genres, 'tasks': tasks, 'when_not': p.get('when_not', ''),
        'audio_caveat': None, 'confidence': p['confidence'], 'related': [d.split(':')[0].split(' ')[0] for d in p.get('distinct_from', [])][:4],
        'claim_type': p['claim_type'], 'applies_to': applies, 'routes': p['routes'], 'limits': p.get('limits', ''),
        'generator_technique': gen, 'support': support(p['findings']), 'active': True,
        'changes': {'date': DATE, 'pack': VERSION, 'notes': [f'new from the song-analysis round ({key})']},
    })

current = latest(jl(PACK / 'cards.jsonl'))
c43 = dict(current['C43'])
c43.update({
    'version': c43['version'] + 1,
    'when_not': (c43.get('when_not', '').rstrip('. ') + '. ' if c43.get('when_not') else '') +
    'Two documented counterexamples: Sam Fender\'s People Watching chorus deliberately does not tell the song (someone hearing only the chorus would not know anyone had died; it watches strangers instead), and Noah Kahan\'s Stick Season keeps its local facts in the chorus, each paired with an admission anyone could make. The test is a lens, not a rule.',
    'support': c43.get('support', []) + support(['SS-F1', 'SS-F2', 'SS-F11', 'SS-F14']),
    'changes': {'date': DATE, 'pack': VERSION, 'notes': ['limit added from two song records (songs-songwriter #1 and #3)']},
})
cards.append(c43)

DECLINED = {
    'songs-ballad#3': 'one documented case and narrow (pitching to several artists); kept as finding SB-F13',
    'songs-country#3': 'low confidence; the two descriptions disagree on which verse holds which light; kept as finding SC-F9',
    'songs-pop#3': 'musical (key change), room-only, no generator use; kept as findings SP-F1, SP-F7',
    'songs-songwriter#2': 'musical setting, room-only, no generator use; kept as findings SS-F5, SS-F9',
    'songs-songwriter#3': 'folded into C43 as a limit rather than a new card',
}

# ---------------------------------------------------------------- profiles
prof_cur = latest(jl(PACK / 'profiles.jsonl'))
updates = []
for sl in SLICES:
    for u in jl(RAW / sl / 'profile_updates.jsonl'):
        updates.append({**u, 'slice': sl})

profiles = []
for pid in ('P01', 'P03', 'P13', 'P16'):
    base = dict(prof_cur[pid])
    ups = [u for u in updates if u['profile'] == pid]
    adds = [c for u in ups for c in u.get('add_characteristics', [])]
    base.update({
        'version': base.get('version', 1) + 1,
        'characteristics': base['characteristics'] + adds,
        'sample': base.get('sample', []) + [s for u in ups for s in u.get('sample_add', [])],
        'coverage': ' '.join(u['coverage'] for u in ups) or base.get('coverage', ''),
        'changes': {'date': DATE, 'pack': VERSION, 'notes': [f'{len(adds)} characteristics added from the song-analysis round; coverage rewritten']},
    })
    profiles.append(base)

fender_sw = next(u for u in updates if u['profile'] == 'NEW:Sam Fender')
fender_bd = next(u for u in updates if u['profile'].startswith('NEW:Sam Fender ('))
NEWP = [
    ('P17', 'Sam Fender', ['Sam Fender'], fender_sw.get('identity', ''), fender_sw.get('sample', []),
     fender_sw['add_characteristics'] + [c for c in fender_bd['add_characteristics'] if 'stubborn chorus' in c['text'].lower()],
     fender_sw['coverage']),
]
for name, alias in (('Lewis Capaldi', ['Lewis Capaldi']), ('Adele', ['Adele']), ('Sam Smith', ['Sam Smith'])):
    u = next(x for x in updates if x['profile'].startswith(f'NEW:{name}'))
    NEWP.append((None, name, alias, '', [], u['add_characteristics'], u['coverage']))
for i, (pid, name, aliases, identity, sample, chars, coverage) in enumerate(NEWP):
    profiles.append({
        'id': pid or f'P{18 + i - 1}', 'version': 1, 'name': name, 'aliases': aliases, 'resolved': identity or name,
        'sample': sample, 'sources': sorted({m for c in chars for m in re.findall(r'[A-Z]{2}-S\d+', c.get('evidence', ''))}),
        'characteristics': chars, 'variation': '', 'uncertain': 'Rests on one song examined as a whole work; see coverage.',
        'coverage': coverage, 'active': True, 'changes': {'date': DATE, 'pack': VERSION, 'notes': ['new profile from the song-analysis round']},
    })

# ---------------------------------------------------------------- write
OUT.mkdir(parents=True, exist_ok=True)
for name, rows in (('sources', sources), ('findings', findings), ('songs', songs), ('cards', cards), ('profiles', profiles)):
    (OUT / f'{name}.jsonl').write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows))
(OUT / 'manifest.json').write_text(json.dumps({
    'pack_version': VERSION, 'built': DATE, 'base': 'pilot-1.2',
    'status': 'candidate: NOT loaded by the app; compare with pilot-1.2 only after the route-level test',
    'counts': {'songs': len(songs), 'sources': len(sources), 'sources_duplicate': sum(1 for s in sources if s.get('duplicate_of')),
               'findings': len(findings), 'new_cards': len(NEW), 'card_updates': 1, 'profile_updates': 4, 'new_profiles': len(NEWP)},
    'declined_cards': DECLINED,
    'lyrics_reproduced': 'none; identifying phrases of six words or fewer only',
    'audio': 'none; every musical statement is a writer statement or press description',
}, indent=2, ensure_ascii=False) + '\n')
print(f'{VERSION}: {len(songs)} songs, {len(sources)} sources, {len(findings)} findings, {len(cards)} card lines, {len(profiles)} profile lines')
