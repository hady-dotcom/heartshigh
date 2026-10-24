# Learner mobile E2E checklist

Phone: **390 × 844** (or a real handset). British English. Every surface has a **?** — it must describe *this* page, never another.

Seed: `elm-learner@hearts.test` / `portal-learner`, portal `east-london`. Teacher: `elm-teacher@hearts.test` / `portal-teacher`. A fresh teacher access code is needed for the join step.

Teacher join, Back vs ?, timeline dots, schedule, garden Finished, and help Close were shipped in PR #52. This walk still checks them, and that **?** copy never belongs to a different page.

## Walk

1. **Join** — `/join` with a learner code. Name, email, password. **?** says how to join. Lands in Welcome, not the desk.
2. **Opening** — Begin → scenes. Skip works. Crisis option opens `/help` with contacts. **?** on the opener is opening copy; **?** on `/help` is crisis/contacts copy (not the opener).
3. **Feed** — After the door, full-screen clips. Swipe up / down / sideways. Tab bar visible, Home not lit. **?** mentions swipes and Ready for more?
4. **Appetiser player** — Tap **Ready for more?** (chip or scenic card).
   - **Back** returns to the short clip. **?** stays **?** (does not act as Back).
   - **Tap for sound** / play icon starts audio. Play icon is a triangle, not a second Back.
   - Appetiser **?** is Ready for more? copy, not the short-clip copy.
5. **Ready for more? / course player** — Learn more opens the course, then a talk.
   - **Part** label is visible (`part-label`) when the course has more than one talk.
   - Timeline **question dots**: locked until their moment; a reached dot **jumps** the film there.
   - Player **?** is talk copy. Overview **?** never previews questions.
6. **Answer save** — Write an answer, submit. Notice confirms save. Reload: the answer is still there.
7. **Lanes** — Tab **Lanes**. A lane opens its clips. Courses sit underneath. **?** is Lanes copy.
8. **Schedule the correct course** — Open a course with two or more parts → **Plan the rest of this course** (or **My week**). The course select is *this* course, not another. Save days. Notice names the right talks.
9. **My week** — Tab **My week**. Planned talks match the schedule. List sits above the tab bar. **?** is My week copy.
10. **Garden Finished / fruits** — Tab **Garden**. **Finished** counts a **full talk** in the course player, not a feed clip or appetiser. Fruit appears after sitting with a question on that talk. **?** is Garden copy.
11. **Me install card** — Tab **Me**. **Keep HEARTS on this phone** (or the install card) opens. Not a Home strip shoved over Continue. **?** is Me copy.
12. **Teacher join on a phone** — `/join` with a **teacher** code on 390 × 844. Lands in the **learner app** (Home / Welcome). Must **not** show the desk wall (“Open this on a laptop”). If the desk wall is opened on purpose, **Open the app** goes into the app.
13. **Help Close above the tab bar** — On Home (or any tab page) tap **?**. **Close** sits **above** the tab bar and is tappable. Overlay does not trap Close under Home / Lanes / My week / Garden / Me.

## Pass / fail

Tick only if the step is true on a phone. A laptop browser at 390 × 844 is acceptable for layout.

| # | Step | Pass |
|---|------|------|
| 1 | Join → Welcome | |
| 2 | Opening; `/help` copy is contacts | |
| 3 | Feed swipes + feed **?** | |
| 4 | Appetiser: Back ≠ **?**; sound; play icon | |
| 5 | Course: part label; dots jump; matching **?** | |
| 6 | Answer saves | |
| 7 | Lanes | |
| 8 | Schedule is the correct course | |
| 9 | My week | |
| 10 | Garden Finished / fruits (full talk only) | |
| 11 | Me install card | |
| 12 | Teacher join → app, not desk wall | |
| 13 | Help **Close** above tab bar | |
