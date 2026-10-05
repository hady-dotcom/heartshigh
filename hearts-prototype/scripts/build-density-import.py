#!/usr/bin/env python3
"""Build the 30-talk HEARTS import sheet from both nested density workbooks.

Every AI-passed extract arrives as suggested, with parent_start and arc when the
study named them. The confirm set's 10 new talks are added as talk rows.
The source study workbooks stay out of the code tree.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from pathlib import Path

import openpyxl
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter

EXTRACT_COLUMNS = [
    "talk_key", "youtube_id", "extract_id", "extract_type", "start", "end", "text", "score", "status",
    "order", "door", "seat", "arc", "parent_start", "words", "hook_text", "turn_text", "land_text", "notes",
]
TALK_COLUMNS = [
    "talk_key", "youtube_id", "title", "speaker", "channel", "course", "part", "order", "lane",
    "jibril_door", "jibril_clause", "ghunya_seat",
    "hors_in", "hors_out", "app_in", "app_out", "hook_in", "hook_out", "turn_in", "turn_out", "land_in", "land_out",
    "hook_text", "turn_text", "land_text", "status", "notes",
    "provider", "vimeo_id", "media_id", "duration", "transcript", "pack",
]
QUESTION_COLUMNS = [
    "talk_key", "youtube_id", "question_id", "type", "time", "text",
    "choice_1", "choice_2", "choice_3", "choice_4", "choice_5", "choice_6",
    "correct_choice", "source", "status", "notes",
    "due_days", "evidence", "show_imam", "place",
]
EXTRACT_NOTE = (
    "HEARTS extracts. One row is one hors d'oeuvre or one appetiser on a talk. "
    "status is suggested: an AI pick waiting on the admin timeline. Only approved extracts reach learners. "
    "parent_start names the appetiser this hors sits inside. arc is hook, turn or land."
)
TALK_NOTE = "HEARTS talks from the density nested study (20 talks) plus the confirm set (10 new talks)."
QUESTION_NOTE = "HEARTS questions from the 20-talk density study. All stay drafts until an admin approves them."


def header_map(ws):
    return {str(ws.cell(1, c).value or "").strip(): c for c in range(1, (ws.max_column or 1) + 1) if ws.cell(1, c).value}


def truthy(value):
    if value is True:
        return True
    if value is False or value is None:
        return False
    return str(value).strip().lower() in ("true", "1", "yes", "pass", "kept")


def seconds(value):
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    if ":" in text:
        parts = [float(p) for p in text.split(":")]
        total = 0.0
        for part in parts:
            total = total * 60 + part
        return total
    return float(text)


def arc_of(raw):
    text = str(raw or "").strip().lower().replace("_", "+")
    if not text or text in ("none", "nan"):
        return None
    if "land" in text:
        return "land"
    if "turn" in text:
        return "turn"
    if "hook" in text:
        return "hook"
    return None


def kind_of(raw):
    text = str(raw or "").strip().lower()
    if text.startswith("hors"):
        return "hors"
    if text.startswith("app"):
        return "appetiser"
    return None


def split_arc_text(text):
    hook = turn = land = ""
    if not text:
        return hook, turn, land
    blob = str(text)
    for label, key in (("HOOK:", "hook"), ("TURN:", "turn"), ("LAND:", "land")):
        if label not in blob:
            continue
        rest = blob.split(label, 1)[1]
        for other in ("HOOK:", "TURN:", "LAND:"):
            if other != label and other in rest:
                rest = rest.split(other, 1)[0]
        rest = rest.strip().strip("|").strip()
        if key == "hook":
            hook = rest
        elif key == "turn":
            turn = rest
        else:
            land = rest
    return hook, turn, land


def tidy_title(title):
    text = str(title or "").replace("|", ".").replace("  ", " ").strip()
    return text


def add_sheet(wb, name, note, columns, rows):
    ws = wb.create_sheet(name)
    ws.append([note])
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(columns))
    ws["A1"].font = Font(italic=True, color="5C5648", size=11)
    ws["A1"].alignment = Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[1].height = 48
    ws.append(list(columns))
    for cell in ws[2]:
        cell.font = Font(bold=True)
    for row in rows:
        ws.append([row.get(col) for col in columns])
    ws.freeze_panes = "A3"
    for index, col in enumerate(columns, start=1):
        ws.column_dimensions[get_column_letter(index)].width = 16 if col != "text" else 40


def load_20(path: Path):
    wb = openpyxl.load_workbook(path, data_only=True)
    talks_ws = wb["Import rows"]
    th = header_map(talks_ws)
    talks = []
    for r in range(2, talks_ws.max_row + 1):
        video = talks_ws.cell(r, th["youtube_id"]).value
        if not video:
            continue
        talks.append({
            "talk_key": talks_ws.cell(r, th["talk_key"]).value or f"yt-{video}",
            "youtube_id": str(video).strip(),
            "title": tidy_title(talks_ws.cell(r, th["title"]).value),
            "speaker": talks_ws.cell(r, th["speaker"]).value,
            "channel": talks_ws.cell(r, th.get("channel", 0)).value if th.get("channel") else None,
            "course": talks_ws.cell(r, th["course"]).value,
            "part": talks_ws.cell(r, th["part"]).value,
            "order": talks_ws.cell(r, th["order"]).value,
            "lane": talks_ws.cell(r, th["lane"]).value,
            "jibril_door": talks_ws.cell(r, th["jibril_door"]).value,
            "jibril_clause": talks_ws.cell(r, th["jibril_clause"]).value,
            "ghunya_seat": talks_ws.cell(r, th["ghunya_seat"]).value,
            "status": "draft",
            "provider": "youtube",
            "duration": seconds(talks_ws.cell(r, th["duration"]).value),
            "notes": "Density nested study, 20 talks. Extracts are on the Extracts tab.",
        })

    ext_ws = wb["Extracts"]
    eh = header_map(ext_ws)
    apps = {}
    extracts = []
    for r in range(2, ext_ws.max_row + 1):
        video = ext_ws.cell(r, eh["video"]).value
        if not video or not truthy(ext_ws.cell(r, eh["pass"]).value):
            continue
        kind = kind_of(ext_ws.cell(r, eh["type"]).value)
        if not kind:
            continue
        start = seconds(ext_ws.cell(r, eh["start_s"]).value)
        end = seconds(ext_ws.cell(r, eh["end_s"]).value)
        cid = str(ext_ws.cell(r, eh["cid"]).value or "")
        if kind == "appetiser" and cid:
            apps[(str(video), cid)] = start
        hook = ext_ws.cell(r, eh["hook"]).value if kind == "appetiser" else None
        turn = ext_ws.cell(r, eh["turn"]).value if kind == "appetiser" else None
        land = ext_ws.cell(r, eh["land"]).value if kind == "appetiser" else None
        extracts.append({
            "youtube_id": str(video).strip(),
            "talk_key": f"yt-{video}",
            "extract_type": kind,
            "start": start,
            "end": end,
            "text": ext_ws.cell(r, eh["text"]).value if kind == "hors" else (land or hook or ext_ws.cell(r, eh["text"]).value),
            "score": ext_ws.cell(r, eh["ai_score"]).value,
            "status": "suggested",
            "arc": arc_of(ext_ws.cell(r, eh["arc_part"]).value) if kind == "hors" else None,
            "parent_cid": str(ext_ws.cell(r, eh["parent_app"]).value or "") if kind == "hors" else "",
            "hook_text": hook,
            "turn_text": turn,
            "land_text": land,
            "notes": "AI pass from the 20-talk nested study.",
            "_cid": cid,
        })
    for row in extracts:
        parent = row.pop("parent_cid")
        if parent:
            row["parent_start"] = apps.get((row["youtube_id"], parent))
        else:
            row["parent_start"] = None

    q_ws = wb["Questions"]
    qh = header_map(q_ws)
    questions = []
    for r in range(2, q_ws.max_row + 1):
        text = q_ws.cell(r, qh["text"]).value
        if not text:
            continue
        questions.append({
            "talk_key": q_ws.cell(r, qh["talk_key"]).value,
            "youtube_id": q_ws.cell(r, qh["youtube_id"]).value,
            "type": q_ws.cell(r, qh["type"]).value,
            "time": seconds(q_ws.cell(r, qh["time"]).value),
            "text": text,
            "source": q_ws.cell(r, qh["source"]).value or "ai",
            "status": "draft",
            "notes": q_ws.cell(r, qh["notes"]).value,
            "choice_1": q_ws.cell(r, qh.get("choice_1", 0)).value if qh.get("choice_1") else None,
            "choice_2": q_ws.cell(r, qh.get("choice_2", 0)).value if qh.get("choice_2") else None,
            "choice_3": q_ws.cell(r, qh.get("choice_3", 0)).value if qh.get("choice_3") else None,
            "choice_4": q_ws.cell(r, qh.get("choice_4", 0)).value if qh.get("choice_4") else None,
            "correct_choice": q_ws.cell(r, qh.get("correct_choice", 0)).value if qh.get("correct_choice") else None,
            "due_days": q_ws.cell(r, qh.get("due_days", 0)).value if qh.get("due_days") else None,
            "evidence": q_ws.cell(r, qh.get("evidence", 0)).value if qh.get("evidence") else None,
            "show_imam": q_ws.cell(r, qh.get("show_imam", 0)).value if qh.get("show_imam") else None,
        })
    return talks, extracts, questions


def load_confirm(path: Path):
    wb = openpyxl.load_workbook(path, data_only=True)
    talks_ws = wb["Talks"]
    th = header_map(talks_ws)
    new_ids = []
    talks = []
    for r in range(2, talks_ws.max_row + 1):
        video = talks_ws.cell(r, th["video"]).value
        if not video or str(talks_ws.cell(r, th["set"]).value).strip() != "new":
            continue
        video = str(video).strip()
        new_ids.append(video)
        mins = seconds(talks_ws.cell(r, th["mins"]).value) or 0
        talks.append({
            "talk_key": f"yt-{video}",
            "youtube_id": video,
            "title": tidy_title(talks_ws.cell(r, th["title"]).value),
            "speaker": talks_ws.cell(r, th["speaker"]).value,
            "course": talks_ws.cell(r, th["series"]).value,
            "part": talks_ws.cell(r, th["part"]).value,
            "status": "draft",
            "provider": "youtube",
            "duration": round(mins * 60),
            "notes": "Density confirm set. Nested pipeline extracts are on the Extracts tab.",
        })

    ext_ws = wb["Extracts"]
    eh = header_map(ext_ws)
    wanted = set(new_ids)
    apps = {}
    extracts = []
    for r in range(2, ext_ws.max_row + 1):
        video = str(ext_ws.cell(r, eh["video"]).value or "").strip()
        if video not in wanted:
            continue
        kind = kind_of(ext_ws.cell(r, eh["type"]).value)
        if not kind:
            continue
        passed = truthy(ext_ws.cell(r, eh["pass_"]).value)
        status = str(ext_ws.cell(r, eh["status"]).value or "")
        if kind == "appetiser" and not (passed and status == "kept"):
            continue
        if kind == "hors" and not passed:
            continue
        start = seconds(ext_ws.cell(r, eh["start"]).value)
        end = start + (seconds(ext_ws.cell(r, eh["len_s"]).value) or 0) if start is not None else None
        # prefer explicit end if the start cell was m:ss and we can parse a matching end
        end_cell = seconds(ext_ws.cell(r, eh["end"]).value)
        if end_cell is not None:
            end = end_cell
        cid = str(ext_ws.cell(r, eh["id"]).value or "")
        text = ext_ws.cell(r, eh["text"]).value
        hook = turn = land = None
        if kind == "appetiser":
            hook, turn, land = split_arc_text(text)
            text = land or hook or text
        if kind == "appetiser" and cid:
            apps[(video, cid)] = start
        extracts.append({
            "youtube_id": video,
            "talk_key": f"yt-{video}",
            "extract_type": kind,
            "start": start,
            "end": end,
            "text": text,
            "score": ext_ws.cell(r, eh["score"]).value,
            "status": "suggested",
            "arc": arc_of(ext_ws.cell(r, eh["arc_part"]).value) if kind == "hors" else None,
            "parent_cid": str(ext_ws.cell(r, eh["parent_app"]).value or "") if kind == "hors" else "",
            "hook_text": hook,
            "turn_text": turn,
            "land_text": land,
            "notes": "AI pass from the nested confirm set." if kind == "appetiser" else f"AI pass ({ext_ws.cell(r, eh['type']).value}) from the nested confirm set.",
        })
    for row in extracts:
        parent = row.pop("parent_cid")
        row["parent_start"] = apps.get((row["youtube_id"], parent)) if parent else None
    return talks, extracts


def order_extracts(extracts):
    by_talk = defaultdict(list)
    for row in extracts:
        by_talk[row["youtube_id"]].append(row)
    ordered = []
    for rows in by_talk.values():
        rows.sort(key=lambda row: (row["start"] or 0, 0 if row["extract_type"] == "appetiser" else 1))
        for index, row in enumerate(rows, start=1):
            row["order"] = index
            ordered.append(row)
    return ordered


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--study", default="/home/ubuntu/.cursor/projects/workspace/uploads/hearts-density-20-nested_6034.xlsx")
    parser.add_argument("--confirm", default="/home/ubuntu/.cursor/projects/workspace/uploads/hearts-density-nested-confirm_e173.xlsx")
    parser.add_argument("--dest", default=str(Path(__file__).resolve().parent.parent / "content/sheets/hearts-density-30-extracts.xlsx"))
    args = parser.parse_args()

    talks20, extracts20, questions = load_20(Path(args.study))
    talks10, extracts10 = load_confirm(Path(args.confirm))
    talks = talks20 + talks10
    extracts = order_extracts(extracts20 + extracts10)

    dest = Path(args.dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    add_sheet(wb, "Talks", TALK_NOTE, TALK_COLUMNS, talks)
    add_sheet(wb, "Questions", QUESTION_NOTE, QUESTION_COLUMNS, questions)
    add_sheet(wb, "Resources", "HEARTS resources. Empty for this density import.", ["talk_key", "label", "url", "kind", "status", "body", "media_id"], [])
    add_sheet(wb, "Extracts", EXTRACT_NOTE, EXTRACT_COLUMNS, extracts)
    add_sheet(wb, "CircleAnswers", "Circle answers. Empty for this density import.", ["talk_key", "name", "body", "tone", "length", "origin", "enabled"], [])
    add_sheet(wb, "Speakers", "Speakers. Empty for this density import.", ["slug", "name", "honorific", "display_name", "aliases", "bio", "photo_url", "links", "sources", "status"], [])
    wb.save(dest)

    kinds = defaultdict(int)
    parents = 0
    for row in extracts:
        kinds[row["extract_type"]] += 1
        if row.get("parent_start") is not None:
            parents += 1
    print(f"Wrote {len(talks)} talks ({len(talks20)} study + {len(talks10)} confirm) and {len(extracts)} suggested extracts to {dest}")
    print(f"  hors={kinds['hors']} appetiser={kinds['appetiser']} hors_with_parent_start={parents} questions={len(questions)}")


if __name__ == "__main__":
    main()
