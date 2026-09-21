"""
Engagement questions, written against the CMS clip analysis for each course part.
Each is tied to what is said in that clip, not matched on topic.

In the lecture these are REFLECTIONS, not tasks. Leon's note: the voice should be a
friend sitting next to you, not an instructor setting homework. So: no imperatives,
no "name one thing and write it down" — an invitation, and the option to say nothing.
Practical tasks still exist; they live on the hors d'oeuvres, where a small action fits.
Keyed by CMS video id, then clip_number (see build/clips/<id>.json).
"""
QUESTIONS_BY_VIDEO = {
 9: {
   1: {'kind': 'Reflection', 'prompt': "The companions wanted to jump on him. He said, leave him. I wonder if there's a time you corrected someone in front of others, when quietly would have done it."},
   2: {'kind': 'Reflection', 'prompt': 'Somebody you know stopped coming. If you sent them something this week with no correction in it at all, what would you want it to say?'},
   3: {'kind': 'Reflection', 'prompt': "He shortened the prayer for the mother, not the child. Is there someone near you carrying something heavy that you've been reading as an inconvenience?"},
   4: {'kind': 'Multi-choice', 'prompt': 'Where has "make it easy" been hardest in your family?', 'options': ['The mahr', 'The wedding itself', 'What relatives expect', 'Somewhere else']},
   5: {'kind': 'Reflection', 'prompt': 'She said, I have so many sins. Where do you think your own idea of how Allah sees you came from? Nobody arrives at that on their own.'},
   6: {'kind': 'Reflection', 'prompt': 'Hayyin, layyin, sahl — easy, gentle, uncomplicated. If someone who knows you well picked the one you find hardest, which do you think they would pick?'},
   7: {'kind': 'Reflection', 'prompt': 'Most of us were handed a ruling early on that arrived like an 18-wheeler. If it came to you again tomorrow, how would you want to hear it?'},
   8: {'kind': 'Reflection', 'prompt': 'افعل ولا حرج — do it, and don’t worry. Is there something you’ve been waiting to do properly before you do it at all?'},
   9: {'kind': 'Reflection', 'prompt': 'Where did you first learn to talk about your religion in the language of hardship? Whoever taught you that probably didn’t mean to.'},
  10: {'kind': 'Reflection', 'prompt': 'Muyassir is who you are, not how you feel today. Where would it be easiest, this week, to be the one who makes things lighter?'},
 },
 15: {
   1: {'kind': 'Reflection', 'prompt': 'ʻUmar wept at a hadith he had narrated himself. Is there something you know so well you’ve stopped hearing it? What might let you hear it again?'},
   2: {'kind': 'Multi-choice', 'prompt': 'Honestly — who gets your best manners?', 'options': ['People at work', 'Strangers', 'My family at home', 'About the same everywhere']},
   3: {'kind': 'Reflection', 'prompt': 'If the heaviest thing on the scale is character, which habit of yours do you think would weigh least at the moment?'},
   4: {'kind': 'Reflection', 'prompt': 'He said only, your mother had a moment, and left it there. Think of someone close to you acting from a weak place. What did you say, and what do you wish you had said?'},
   5: {'kind': 'Reflection', 'prompt': 'Matching someone’s energy is the default; disarming them is a choice. What would you want to say next time, if you’d already decided?'},
   6: {'kind': 'Reflection', 'prompt': 'Abu Hanifa gave respect for a beard, then took it back for the speech. What do you notice yourself giving respect to before anyone has said a word?'},
   7: {'kind': 'Reflection', 'prompt': 'You could be the person others walk on eggshells around and never know. Who in your life would tell you honestly — and has anyone ever asked them?'},
   8: {'kind': 'Reflection', 'prompt': 'He brushed his teeth in the driveway because his wife deserved his best. What would the small version of that look like, before you walk through your own door?'},
   9: {'kind': 'Reflection', 'prompt': 'If character and faith are attached, what is your character saying about your faith today — not on your best day, just today?'},
  10: {'kind': 'Reflection', 'prompt': 'Where is your goodness still a trade — good to those who are good to you? That one is hardest in the closest relationships.'},
 },
}

# back-compat for the original single-part build
QUESTIONS = QUESTIONS_BY_VIDEO[9]
