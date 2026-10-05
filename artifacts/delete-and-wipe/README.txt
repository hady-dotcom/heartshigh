Proof for delete-and-wipe, round 2. Not part of the app tree.

Stills (desktop 1440x900):
- master-delete-summary.png — centred dialog, pinned nav, non-zero counts on a seeded wipe portal
- master-seeded-portal-summary.png — East London seeded portal (15 learners, 31 answers, workbook, garden, files, sessions)
- admin-delete-summary.png — Teach desk, Aisha Patel fully visible, centred dialog, pinned nav
- admin-seeded-learner-summary.png — Maryam Begum with answers, workbook, garden, files, watch history
- learner-self-delete-confirm.png / learner-self-delete-done.png
- admin-delete-done.png / admin-delete-session-dead.png / master-delete-done.png

db:orphans:
- db-orphans-after.txt — "No orphans. The database is clean."
- db-orphans-missing-tables.txt — erase_s3_retries and later-PR tables (#20/#22/#25/#26/#27) are absent; the script still exits clean with no errors
