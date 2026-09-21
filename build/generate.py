#!/usr/bin/env python3
"""
Hud-hud demo — build-time data generator.

Joins three sources into a single baked app/data.js (no runtime API calls):
  1. build/cms_snapshot.json   — Hearts CMS (creators, series, videos + HLS, Qur'an, hadith, reflection questions)
  2. canon-dual-export-FINAL   — 3,963 editorially-mapped clips (Jibril clause, Ghuniyya seat, hook/turn/land)
  3. demo10-CLIPS + fahmy-s6   — Leon's curated reel bites and the deep single-talk analysis

Join key: canon.talk_title <-> CMS video.title (normalised). Verified exact for all 18 videos.
"""
import json, re, os, sys
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
UP   = "/root/.claude/uploads/3f25a5bb-9a14-5bb7-aeb3-0ad20b981de1"
XL_CANON = os.path.join(UP, "b500eed3-canon-dual-export-FINAL.xlsx")
XL_DEMO  = os.path.join(UP, "5ac5eece-demo10-CLIPS.xlsx")
XL_FAHMY = os.path.join(UP, "863ff916-extract-fahmy-s6-dual-export.xlsx")

import openpyxl
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from questions import QUESTIONS_BY_VIDEO

def sheet(path, name=None):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    out = {}
    for ws in wb.worksheets:
        if name and ws.title != name: continue
        it = ws.iter_rows(values_only=True)
        hdr = [str(h).strip() if h is not None else "" for h in next(it)]
        out[ws.title] = [dict(zip(hdr, r)) for r in it if any(c is not None for c in r)]
    wb.close()
    return out

def norm(t):  return re.sub(r'[^a-z0-9]+', '', str(t or '').lower())
def clean(s):
    s = re.sub(r'\s+', ' ', str(s or '').strip())
    # Saheeh-style interpolation brackets read as mojibake on a phone; keep the words.
    return s.replace('\u02f9', '').replace('\u02fa', '').replace('\u02f8', '')

def whole_sentence(s):
    """Canon lands are transcript excerpts; many start mid-sentence. Those read as
    broken captions on a full-bleed clip, so they are not eligible for the reel."""
    s = clean(s)
    if len(s) < 28 or len(s) > 190: return False
    if not (s[0].isupper() or s[0] in '"\u201c\u2018'): return False
    if re.match(r'^(And|But|So|Because|That|Which|Who|Where|When|Then|Or)\b', s): return False
    return True

def lands_well(s):
    s = clean(s)
    return bool(s) and s[-1] in '.!?\u201d"'


def secs(ts):
    """'29:55' or '1:39:54' -> seconds. Canon mm:ss can exceed 59 (e.g. '77:45')."""
    p = [int(x) for x in re.findall(r'\d+', str(ts or '0'))]
    if not p: return 0
    if len(p) == 1: return p[0]
    if len(p) == 2: return p[0]*60 + p[1]
    return p[0]*3600 + p[1]*60 + p[2]

# ---------------------------------------------------------------- lanes
# Canon 'Theme' reads "Primary / Secondary" (e.g. "Messengers / Prophetic manners").
# Lane = the primary token mapped onto a small, swipeable set.
LANE_MAP = [
    ("The Prophet ﷺ", r'messenger|prophetic|prophet|seerah|sunna|sahaba|companion'),
    ("Belief",        r'believe|tawhid|iman|faith|angels|books'),
    ("Nearness",      r'god & religion|god and religion|connection|dawah|nearness'),
    ("Ease",          r'ease|harsh|difficult|hardship|burden'),
    ("Character",     r'character|manner|adab|envy|comparison|anger|arrogan|humility'),
    ("Presence",      r'ihsan|presence|sitting|attention|scroll|witness'),
    ("The Last Day",  r'last day|hour|hereafter|perish|grave|akhira'),
    ("Decree",        r'qadar|decree|design|suffering|trial|test'),
    ("Gratitude",     r'gratitude|shukr|thank|abundance|provision|wealth|rizq'),
    ("Return",        r'hope|forgive|repent|tawba|sin|door|replace|falling|mercy'),
    ("Agency",        r'agency|identity|freer|strive|effort|do not underrate|don.t tire'),
    ("Prayer",        r'prayer|salah|dua|fasting|worship|ritual|time'),
]
# Where a thin lane folds if it cannot stand on its own.
LANE_MERGE = {"Agency": "Nearness", "Prayer": "Presence", "Decree": "Ease",
              "The Last Day": "Belief", "Gratitude": "Nearness", "Return": "Ease"}

def lane_of(theme):
    primary = str(theme or '').split('/')[0].strip().lower()
    whole   = str(theme or '').lower()
    for name, pat in LANE_MAP:
        if re.search(pat, primary): return name
    for name, pat in LANE_MAP:
        if re.search(pat, whole): return name
    return "Nearness"

MIN_PER_LANE = 6      # enough depth that swipe-left never repeats immediately
MIN_SPEAKERS = 2      # swipe-left means "same topic, different speaker"

def settle_lanes(clips):
    """Fold lanes that are too thin (or single-speaker) into their merge target."""
    for _ in range(4):
        cnt = Counter(c["lane"] for c in clips)
        spk = defaultdict(set)
        for c in clips: spk[c["lane"]].add(c["speaker"])
        thin = [l for l in cnt if (cnt[l] < MIN_PER_LANE or len(spk[l]) < MIN_SPEAKERS)
                                   and l in LANE_MERGE]
        if not thin: break
        for c in clips:
            if c["lane"] in thin: c["lane"] = LANE_MERGE[c["lane"]]
    # anything still thin goes to the largest lane
    cnt = Counter(c["lane"] for c in clips)
    if cnt:
        biggest = cnt.most_common(1)[0][0]
        spk = defaultdict(set)
        for c in clips: spk[c["lane"]].add(c["speaker"])
        for c in clips:
            if cnt[c["lane"]] < MIN_PER_LANE or len(spk[c["lane"]]) < MIN_SPEAKERS:
                c["lane"] = biggest
    return clips

# ---------------------------------------------------------------- Hadith Jibril
# 41 clauses. Labels for those present come from the canon itself; the branch grouping
# follows the Grow board's six rows. Clauses with no canon coverage stay as outlines.
BRANCHES = [
    ("Islām · the five",      range(13, 21), "gold"),
    ("Īmān · the six",        range(21, 29), "orange"),
    ("Iḥsān · as if you see", range(29, 32), "teal"),
    ("The Hour · signs",      range(32, 39), "purple"),
    ("The questioner",        range(1, 13),  "rose"),
    ("The teaching",          range(39, 42), "gold"),
]
CLAUSE_FALLBACK = {
    11: "… HE SAT WITH HIS THIGHS …", 12: "… HE PLACED HIS HANDS …",
    19: "… AND HAJJ …", 35: "… THE SHEPHERDS COMPETE …", 38: "… THEN HE LEFT …",
}

def main():
    snap = json.load(open(os.path.join(HERE, "cms_snapshot.json")))
    canon = sheet(XL_CANON, "dual")["dual"]
    demo  = sheet(XL_DEMO, "CLIPS")["CLIPS"]
    fah   = sheet(XL_FAHMY)
    fdeep = fah["Deep why it works"]
    fnotes = {r["field"]: r["value"] for r in fah["Match notes"]}

    vids   = {v["id"]: v for v in snap["videos"]}
    by_t   = {norm(v["title"]): v for v in snap["videos"]}
    creators = {c["handle"]: c for c in snap["creators"]}
    series = {s["id"]: s for s in snap["series"]}

    # ---------------- canon clips joined to real playable videos
    canon_by_talk = defaultdict(list)
    for r in canon:
        canon_by_talk[norm(r["talk_title"])].append(r)

    clips, seen = [], set()
    for key, v in by_t.items():
        rows = canon_by_talk.get(key, [])
        rows.sort(key=lambda r: (0 if str(r.get("hang_strength")) == "strong" else 1, secs(r.get("timestamp"))))
        for r in rows:
            hook, turn, land = clean(r.get("hook")), clean(r.get("turn")), clean(r.get("land"))
            if not (hook and land) or not whole_sentence(land): continue
            t = secs(r.get("timestamp"))
            if t <= 0 or t > v["durationSec"] - 30: continue
            sig = (v["id"], t // 20)
            if sig in seen: continue
            seen.add(sig)
            m = re.match(r'\s*(\d+)\s*·\s*(.*)', str(r.get("Clause relevance to Hadeeth Jibreel") or ''))
            clips.append({
                "id": f"c{v['id']}-{t}", "videoId": v["id"], "speaker": v["speaker"],
                "start": t, "hook": hook, "turn": turn, "land": land,
                "theme": clean(r.get("Theme")), "lane": lane_of(r.get("Theme")),
                "clause": int(m.group(1)) if m else None,
                "clauseLabel": clean(m.group(2)).strip('… ') if m else None,
                "seat": clean(r.get("Place against Ghunya course")),
                "form": clean(r.get("stage2_form")), "strength": clean(r.get("hang_strength")),
                "appeal": clean(r.get("Appeal")), "why": clean(r.get("Why Use this?")),
                "currency": clean(r.get("currency_note")),
                "source": "hls",
                "len": 18,
                "source_sheet": "canon",
            })

    # Keep the reel varied: cap per video, balance lanes.
    per_video = Counter(); reel = []
    for c in sorted(clips, key=lambda c: (0 if lands_well(c["land"]) else 1,
                                          0 if c["strength"] == "strong" else 1,
                                          c["videoId"], c["start"])):
        if per_video[c["videoId"]] >= 14: continue
        per_video[c["videoId"]] += 1; reel.append(c)

    # ---------------- Leon's curated demo-10 bites (editorial layer, kept distinct)
    HANDLE = {"Yasir Fahmy":"yasirfahmy","Khalid Latif":"khalidlatif","Mikaeel Smith":"mikaeelsmith",
              "Suleiman Hani":"suleimanhani","Sh. Mohammad Elshinawy":"shmohammadelshinawy",
              "Mohammad Elshinawy":"shmohammadelshinawy","Shadee Elmasry":"shadeeelmasry",
              "Amjad Tarsin":"amjadtarsin"}
    curated = []
    for r in demo:
        curated.append({
            "clipId": clean(r.get("Clip ID")), "speaker": clean(r.get("Speaker")),
            "title": clean(r.get("Title")), "ts": clean(r.get("Approx Time")),
            "seconds": int(r.get("Approx Seconds") or 18),
            "audience": [clean(r.get("Audience Primary")), clean(r.get("Audience Secondary"))],
            "twist": clean(r.get("C4 Twist")),
            "hook": clean(r.get("Hook")), "turn": clean(r.get("Turn")), "land": clean(r.get("Land")),
            "theme": clean(r.get("Theme")), "lane": lane_of(r.get("Theme")),
            "youtube": clean(r.get("Video ID")),
            "speakerHandle": HANDLE.get(clean(r.get("Speaker")), ""),
            "startSec": secs(r.get("Approx Time")),
        })

    # Curated demo-10 bites are reel entries in their own right, played from YouTube.
    # They need no CORS and work on any host, so they are the reliable playback path.
    yt_reel = []
    for c in curated:
        if not (c["youtube"] and c["speakerHandle"] and whole_sentence(c["land"])): continue
        yt_reel.append({
            "id": "y" + c["clipId"], "source": "youtube", "youtube": c["youtube"],
            "videoId": None, "speaker": c["speakerHandle"],
            "start": c["startSec"], "len": max(12, min(30, c["seconds"])),
            "hook": c["hook"], "turn": c["turn"], "land": c["land"],
            "theme": c["theme"], "lane": lane_of(c["theme"]),
            "clause": None, "clauseLabel": None, "seat": "", "form": "Direct Soundbite",
            "strength": "strong", "appeal": c["twist"], "why": "", "currency": "",
            "title": c["title"], "audience": c["audience"], "source_sheet": "demo10",
        })
    HERO = {
        "id": "local-mikaeel", "source": "file", "src": "media/mikaeel-bait-fade.mp4", "srcAlt": "media/mikaeel-bait-fade.webm",
        "wholeFile": True, "burnedIn": True,   # the clip carries its own kinetic captions
        "speaker": "mikaeelsmith", "videoId": None, "start": 0, "len": 18,
        # transcribed from the clip's own on-screen typography
        "hook": "This is so beautiful. He says\u2026",
        "turn": "Never let a sin become so big in your mind\u2026",
        "land": "\u2026that it stops you from expecting good from God.",
        "theme": "Hope / Never let a sin become so big", "lane": "Return",
        "clause": None, "clauseLabel": None, "seat": "", "form": "Direct Soundbite",
        "strength": "strong", "appeal": "", "why": "", "currency": "",
        "title": "Never let a sin become so big", "source_sheet": "drive",
    }
    reel = settle_lanes([HERO] + reel + yt_reel)

    # ---------------- Hadith Jibril map (real counts from the canon)
    clause_rows = defaultdict(list)
    for r in canon:
        m = re.match(r'\s*(\d+)\s*·\s*(.*)', str(r.get("Clause relevance to Hadeeth Jibreel") or ''))
        if m: clause_rows[int(m.group(1))].append((clean(m.group(2)).strip('… '), r))
    labels = {n: Counter(l for l, _ in v).most_common(1)[0][0] for n, v in clause_rows.items()}

    # "10 different chefs might talk about it" -> a section is 'opened' per distinct speaker covering it.
    jibril = []
    for name, rng, tone in BRANCHES:
        sections = []
        for n in rng:
            rows = [r for _, r in clause_rows.get(n, [])]
            chefs = sorted({str(r.get("speaker")) for r in rows if str(r.get("speaker")) != "unknown"})
            sections.append({
                "n": n, "label": labels.get(n) or CLAUSE_FALLBACK.get(n, "…"),
                "clips": len(rows), "chefs": len(chefs),
                "chefNames": [creators[h]["name"] for h in chefs if h in creators][:4],
            })
        jibril.append({"branch": name, "tone": tone, "sections": sections})

    PIECES_PER_SECTION = 10   # confirmed by Leon: 41 sections x ~10 covering places ("chefs")
    total_sections = sum(len(b["sections"]) for b in jibril)
    # REAL: what the library actually covers today, straight from the canon.
    lib_sections = sum(1 for b in jibril for s in b["sections"] if s["chefs"] > 0)
    lib_pieces   = sum(min(s["chefs"], PIECES_PER_SECTION) for b in jibril for s in b["sections"])
    # MOCK: this learner's own progress (the Grow board's headline: 12 of 41, 47 pieces).
    # Banking rule from the board: hors d'oeuvres do not bank to the maps; appetisers may;
    # course parts always do. So opened sections track appetisers + course parts only.
    USER_OPEN = {"Islām · the five": 4, "Īmān · the six": 3, "Iḥsān · as if you see": 2,
                 "The Hour · signs": 1, "The questioner": 2, "The teaching": 0}
    USER_PIECES = {"Islām · the five": 15, "Īmān · the six": 12, "Iḥsān · as if you see": 9,
                   "The Hour · signs": 4, "The questioner": 7, "The teaching": 0}
    for b in jibril:
        n_open = USER_OPEN.get(b["branch"], 0)
        b["userSections"] = n_open
        b["userPieces"]   = USER_PIECES.get(b["branch"], 0)
        b["sectionsTotal"] = len(b["sections"])
        b["capacity"] = len(b["sections"]) * PIECES_PER_SECTION
        # mark which sections this learner has opened (the strongest-covered first)
        order = sorted(b["sections"], key=lambda s: -s["chefs"])
        lit = {s["n"] for s in order[:n_open]}
        for sec in b["sections"]:
            sec["userOpened"] = sec["n"] in lit
    opened = sum(b["userSections"] for b in jibril)
    pieces = sum(b["userPieces"] for b in jibril)

    # ---------------- al-Ghuniyya: one cell = one narration / chapter / mas'ala
    seat_named = [c for c in clips if c["seat"] and not c["seat"].startswith("Seat TBD")]
    cells = Counter()
    for r in canon:
        th = clean(r.get("Theme")); cl = str(r.get("Clause relevance to Hadeeth Jibreel") or '')
        if th: cells[(lane_of(th), th[:60])] += 1
    ghuniyya = {
        "denominator": 9600, "lit": 38,
        "note": "One cell is one narration, chapter or masʾala.",
        "distinctCells": len(cells),
        "chapter": {
            "tag": "ḤADĪTH", "title": "Ṭahāra · chapter 3",
            "sub": "3 cells lit here, from Part 4 with Shaykh Yasir Fahmy",
        },
        "namedSeats": [{"seat": c["seat"], "theme": c["theme"], "speaker": c["speaker"]} for c in seat_named[:8]],
    }

    # ---------------- Harvest: real Qur'an + hadith, real provenance
    def met_in(vid):
        v = vids.get(vid)
        if not v: return None, None
        return v["title"], creators.get(v["speaker"], {}).get("name", v["speaker"])
    harvest = []
    for q in snap["quran"]:
        t, sp = met_in(q["sourceVideoId"])
        harvest.append({"kind": "quran", "tag": "QURʾĀN", "ref": q["ref"], "arabic": q["arabic"],
                        "text": q["translation"], "metIn": t, "speaker": sp, "ts": q["ts"],
                        "videoId": q["sourceVideoId"] if t else None, "cta": "Read the tafsīr"})
    for h in snap["hadith"]:
        t, sp = met_in(h["sourceVideoId"])
        harvest.append({"kind": "hadith", "tag": "ḤADĪTH", "ref": h["ref"], "arabic": h["arabic"],
                        "text": h["translation"], "metIn": t, "speaker": sp, "ts": h["ts"],
                        "grading": h["grading"], "narrator": h["narrator"],
                        "videoId": h["sourceVideoId"] if t else None, "cta": "See the full ḥadīth"})
    harvest_with_source = [h for h in harvest if h["metIn"]]
    harvest = harvest_with_source + [h for h in harvest if not h["metIn"]]

    # ---------------- Mains: the course + engagement points from the Fahmy S6 deep analysis
    course_vid = vids[9]
    rq = snap["reflectionQuestions"]
    def q_for(theme, i):
        t = str(theme).lower()
        for q in rq:
            if any(w in t for w in str(q["topic"]).lower().split()): return q
        return rq[i % len(rq)]
    # Engagement points come from the CMS clip analysis for each part: real clip windows,
    # real titles and overlays. Each question is written against that clip's own content.
    deep_by_ts = {}
    for r in fdeep:
        deep_by_ts[secs(r.get("timestamp")) // 60] = r

    def points_for(vid):
        path = os.path.join(HERE, "clips", "%d.json" % vid)
        if not os.path.exists(path): return []
        ca = json.load(open(path))
        v = vids.get(vid)
        out = []
        for c in sorted(ca["clips"], key=lambda c: secs(c["start"])):
            at = secs(c["start"])
            if not (0 < at < (v["durationSec"] if v else 10 ** 9)): continue
            q = QUESTIONS_BY_VIDEO.get(vid, {}).get(c["n"], {})
            deep = deep_by_ts.get(at // 60) if vid == 9 else None
            m = re.match(r'\s*(\d+)\s*·\s*(.*)', str((deep or {}).get("clause_hang") or ''))
            out.append({
                "at": at, "end": secs(c["end"]), "dur": c["dur"], "clipNo": c["n"],
                "kind": q.get("kind", "Reflection"),
                "title": c["title"], "quote": c["overlay"], "arabic": c.get("arabic"),
                "hook": c["hook"], "tags": c.get("tags", []),
                "theme": clean((deep or {}).get("theme")) or "",
                "why": clean((deep or {}).get("why_it_allures")),
                "seat": clean((deep or {}).get("seat_hint")),
                "clause": int(m.group(1)) if m else None,
                "clauseLabel": clean(m.group(2)).strip('… ') if m else None,
                "prompt": q.get("prompt", ""), "options": q.get("options"),
                "promptSource": "Written for this clip · Hearts CMS clip #%d" % c["n"],
                "answered": False,
            })
        out.sort(key=lambda p: p["at"])
        for i, p in enumerate(out): p["answered"] = i < 4
        return out

    points_by_video = {}
    for f in sorted(os.listdir(os.path.join(HERE, "clips"))):
        if f.endswith(".json"):
            vid = int(f[:-5])
            pts = points_for(vid)
            if pts: points_by_video[vid] = pts
    points = points_by_video.get(9, [])

    # course parts from the real series
    PART_BLURB = {
        9:  "Religion's governing spirit is ease — never nafs-convenience, never harshness.",
        15: "Character is not a manner you put on outside. It is what your family meets at the door.",
        11: "What the Prophet \ufdfa did with power, and what gentleness looked like when he had every reason not to be gentle.",
    }
    course_parts = [
        {"n": v["position"] or i+1, "videoId": v["id"], "title": v["title"], "hls": v["hls"],
         "durationSec": v["durationSec"], "blurb": PART_BLURB.get(v["id"], ""),
         "label": "Part %s · %s" % (v["position"] or i+1, v["title"].split("-")[-1].strip()),
         "points": len(points_by_video.get(v["id"], []))}
        for i, v in enumerate(sorted([v for v in snap["videos"] if v["seriesId"] == 2],
                                     key=lambda v: v["position"]))
    ]

    # Real media shipped with the demo (from Drive: Hudhud-UX-Demo/media). Same-origin,
    # so it plays on every host including sandboxes that block external media.


    data = {
        "meta": {
            "app": "Hud-hud", "brand": "Hearts Together",
            "built": "2026-09-20",
            "principle": "It banks what was done — watched, answered, given — as a floor to build from. "
                         "It is a treasury and a workbook, never a score of righteousness and never a balance that earns.",
            "videoPrinciple": ["Every sheikh and teacher will recognise this as an attempted alignment of Ḥadīth Jibrīl.",
                               "Teams working with the Sheikhs will never have had this much trackable feedback on their content before."],
            "counts": {"canonClips": len(canon), "playableVideos": len(snap["videos"]),
                       "reelClips": len(reel), "curated": len(curated),
                       "quran": len(snap["quran"]), "hadith": len(snap["hadith"])},
        },
        "creators": snap["creators"], "series": snap["series"], "videos": snap["videos"],
        "reel": reel, "curated": curated,
        "jibril": {"branches": jibril, "sectionsTotal": total_sections,
                   "sectionsOpened": opened, "piecesOpened": pieces,
                   "piecesTotal": total_sections * PIECES_PER_SECTION,
                   "perSection": PIECES_PER_SECTION,
                   "library": {"sectionsCovered": lib_sections, "pieces": lib_pieces,
                               "clips": len(canon)}},
        "ghuniyya": ghuniyya, "harvest": harvest,
        "localMedia": {"hero": "media/mikaeel-bait-fade.mp4", "lecture": "media/lecture-sitting.mp4"},
        "course": {"videoId": 9, "seriesId": 2, "title": series[2]["title"],
                   "fallbackSrc": "media/lecture-sitting.mp4", "fallbackSrcAlt": "media/lecture-sitting.webm",
                   "partLabel": "Part 6 · Ease as the governing spirit",
                   "thesis": clean(fnotes.get("thesis")), "speaker": "yasirfahmy",
                   "hls": course_vid["hls"], "durationSec": course_vid["durationSec"],
                   "points": points, "pointsByVideo": points_by_video, "parts": course_parts},
        "reflectionQuestions": rq,
    }

    out = os.path.join(ROOT, "app", "data.js")
    with open(out, "w") as f:
        f.write("// Generated by build/generate.py — do not edit by hand.\n")
        f.write("// Sources: Hearts CMS (prod) + canon-dual-export-FINAL + demo10-CLIPS + fahmy-s6.\n")
        f.write("window.HUDHUD = ")
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write(";\n")

    # Mirror the app into docs/ so GitHub Pages can serve it (Settings -> Pages -> /docs).
    import shutil
    docs = os.path.join(ROOT, "docs")
    os.makedirs(os.path.join(docs, "vendor"), exist_ok=True)
    for f in ("index.html", "app.css", "app.js", "data.js"):
        src_f = os.path.join(ROOT, "app", f)
        if os.path.exists(src_f): shutil.copy2(src_f, os.path.join(docs, f))
    v = os.path.join(ROOT, "app", "vendor", "hls.min.js")
    if os.path.exists(v): shutil.copy2(v, os.path.join(docs, "vendor", "hls.min.js"))
    md = os.path.join(ROOT, "app", "media")
    if os.path.isdir(md):
        os.makedirs(os.path.join(docs, "media"), exist_ok=True)
        for f in os.listdir(md): shutil.copy2(os.path.join(md, f), os.path.join(docs, "media", f))

    print(f"wrote {out}  ({os.path.getsize(out)//1024} KB)")
    print(f"mirrored to docs/ for GitHub Pages")
    print(f"  reel clips      : {len(reel)} across {len(per_video)} videos, {len(set(c['lane'] for c in reel))} lanes")
    print(f"  lanes           : {Counter(c['lane'] for c in reel).most_common()}")
    print(f"  jibril (user)   : {opened}/{total_sections} sections opened, {pieces} of {total_sections*PIECES_PER_SECTION} pieces")
    print(f"  jibril (library): {lib_sections}/{total_sections} sections have content, {lib_pieces} covering places, {len(canon)} clips")
    print(f"  harvest         : {len(harvest_with_source)}/{len(harvest)} entries with real provenance")
    for vid, pts in points_by_video.items():
        print(f"  engagement pts  : video {vid}: {len(pts)} at {[p['at'] for p in pts][:6]}...")
    print(f"  youtube reel    : {len(yt_reel)} curated clips playable without CORS")
    print(f"  curated (demo10): {len(curated)}")

main()
