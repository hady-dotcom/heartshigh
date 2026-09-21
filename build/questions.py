"""
Engagement questions, written against the CMS clip analysis for each course part.
Each is tied to what is said in that clip, not matched on topic.
Keyed by CMS video id, then clip_number (see build/clips/<id>.json).
"""
QUESTIONS_BY_VIDEO = {
 9: {
   1: {'kind': 'Question', 'prompt': "The companions' instinct was to jump on him. The Prophet ﷺ said “leave him.” When did you last correct someone in public that you could have handled quietly?"},
   2: {'kind': 'Task', 'prompt': 'Think of one person who stopped coming to the masjid. Write a single sentence you could send them this week — with no correction anywhere in it.'},
   3: {'kind': 'Reflection', 'prompt': "He shortened the prayer for the mother's sake, not the child's. Who around you is carrying a hardship you have been treating as a disturbance?"},
   4: {'kind': 'Multi-choice', 'prompt': 'Where has “make it easy” been hardest in your family?', 'options': ['The mahr', 'The wedding itself', 'What relatives expect', 'Somewhere else']},
   5: {'kind': 'Reflection', 'prompt': 'She said “I have so many sins.” What is your honest opinion of how Allah sees you right now — and where did that opinion come from?'},
   6: {'kind': 'Question', 'prompt': 'Hayyin, layyin, sahl — approachable, amicable, easygoing. Which of the three would people who know you say is hardest to find in you?'},
   7: {'kind': 'Task', 'prompt': 'Name one ruling that was delivered to you early like an 18-wheeler. Write how you would hand that same ruling to someone new tomorrow.'},
   8: {'kind': 'Question', 'prompt': "افعل ولا حرج — “do it, and don't worry.” What act of worship have you been putting off until you could do it properly?"},
   9: {'kind': 'Reflection', 'prompt': 'Where did you first learn to describe your religion in the language of hardship? Who taught you that, and did they mean to?'},
  10: {'kind': 'Task', 'prompt': 'Muyassir is a noun, not a mood — it is who you are, not how you feel today. Name one place this week where you will be the one who makes it easier.'},
 },
 15: {
   1: {'kind': 'Reflection', 'prompt': 'ʻUmar wept at a hadith he himself had narrated. Name something you know so well that you have stopped hearing it. What would it take to hear it again?'},
   2: {'kind': 'Multi-choice', 'prompt': 'Be honest — who gets your best manners?', 'options': ['People at work', 'Strangers', 'My family at home', 'About the same everywhere']},
   3: {'kind': 'Question', 'prompt': 'If the heaviest thing on the scale is character, which single habit of yours would weigh least right now?'},
   4: {'kind': 'Reflection', 'prompt': 'He said only “your mother had a moment,” and let it go. Think of a moment someone close to you acted from a weak place. What did you say — and what could you have said?'},
   5: {'kind': 'Task', 'prompt': 'Matching energy is the default; disarming is the choice. Write the exact sentence you will use next time, before you need it.'},
   6: {'kind': 'Question', 'prompt': 'Abu Hanifa gave respect for a beard, then withdrew it for the speech. What do you find yourself giving respect to before anyone has spoken?'},
   7: {'kind': 'Reflection', 'prompt': 'You may be the person others walk on eggshells around and not know it. Who in your life would tell you honestly — and have you ever asked them?'},
   8: {'kind': 'Task', 'prompt': 'He brushed his teeth in the driveway because his wife deserved his best. Name one small thing you will do before you walk through your own door this week.'},
   9: {'kind': 'Question', 'prompt': 'If character and faith are attached, what does your character say about your faith today — not on your best day?'},
  10: {'kind': 'Reflection', 'prompt': 'Where is your goodness still transactional — good to those who are good to you? Name the relationship where that is hardest to give up.'},
 },
}

# back-compat for the original single-part build
QUESTIONS = QUESTIONS_BY_VIDEO[9]
