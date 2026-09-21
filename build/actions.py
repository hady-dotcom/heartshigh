"""
Practical actions — the doing half of the workbook.

Each is something a person can finish today and show, not just think about.
`capture` says what closes it: a photo, a written note, or simply done.
`tags` are matched against the clip's lane and theme.
"""
ACTIONS = [
 # prayer
 {"id":"a01","capture":"photo","tags":["prayer","presence","salah"],"text":"Photograph the spot where you pray. Tidy it first if it needs it."},
 {"id":"a02","capture":"photo","tags":["prayer","time","fajr"],"text":"Set an alarm for Fajr and photograph the sky when you finish."},
 {"id":"a03","capture":"tick","tags":["prayer","presence"],"text":"Pray one prayer today at its first time, not its last."},
 {"id":"a04","capture":"note","tags":["prayer","presence"],"text":"Write the one prayer you most often lose. Name what usually takes it."},
 {"id":"a05","capture":"tick","tags":["prayer","ease"],"text":"Pray two rakʿah you were not obliged to pray. Do not tell anyone."},
 # qur'an
 {"id":"a06","capture":"photo","tags":["belief","quran","revelation"],"text":"Photograph the page you stopped at. Start there tomorrow."},
 {"id":"a07","capture":"note","tags":["belief","quran"],"text":"Copy out one āyah by hand. Write underneath what you did not understand."},
 {"id":"a08","capture":"tick","tags":["belief","quran"],"text":"Read two lines aloud to someone in your house."},
 # family and character
 {"id":"a09","capture":"tick","tags":["character","family"],"text":"Say a full salaam to someone at home, face to face, before anything else."},
 {"id":"a10","capture":"note","tags":["character","family"],"text":"Message the person you last spoke sharply to. Write what you sent."},
 {"id":"a11","capture":"tick","tags":["character","family"],"text":"Call a parent, or the person who raised you, with nothing to ask for."},
 {"id":"a12","capture":"note","tags":["character"],"text":"Name the room where your manners are worst. Write why it is that room."},
 {"id":"a13","capture":"tick","tags":["character","ease"],"text":"Let one thing go today without correcting it."},
 # giving
 {"id":"a14","capture":"photo","tags":["gratitude","giving","agency"],"text":"Give something away today and photograph the empty space it left."},
 {"id":"a15","capture":"tick","tags":["giving","nearness"],"text":"Give something small where nobody will know it was you."},
 # gratitude
 {"id":"a16","capture":"note","tags":["gratitude","nearness"],"text":"Before you sleep, write three things from today. Nothing large."},
 {"id":"a17","capture":"photo","tags":["gratitude"],"text":"Photograph one ordinary thing you would miss if it went."},
 # community
 {"id":"a18","capture":"tick","tags":["community","fellowship","prophet"],"text":"Sit next to someone you do not know at the masjid. Ask their name."},
 {"id":"a19","capture":"note","tags":["community","fellowship"],"text":"Name someone who stopped coming. Write the message you will send."},
 {"id":"a20","capture":"tick","tags":["community","ease"],"text":"Greet three people first today, before they greet you."},
 # return and repentance
 {"id":"a21","capture":"note","tags":["return","repentance"],"text":"Name one habit you would end if it were easy. Write the first small step."},
 {"id":"a22","capture":"tick","tags":["return","ease"],"text":"Come back to one thing you stopped doing. Once is enough to count."},
 {"id":"a23","capture":"note","tags":["return","hope"],"text":"Write what you think Allah thinks of you today. Then write where you learned that."},
 # presence and time
 {"id":"a24","capture":"tick","tags":["presence","time","attention"],"text":"Put the phone in another room for one hour. Notice what you reach for."},
 {"id":"a25","capture":"photo","tags":["presence","time"],"text":"Photograph your screen time. Do not edit it."},
 {"id":"a26","capture":"note","tags":["presence"],"text":"Write what you were thinking about during your last prayer. All of it."},
 # the prophet, knowledge
 {"id":"a27","capture":"note","tags":["prophet","knowledge","seerah"],"text":"Write one thing the Prophet ﷺ did that you have never tried. Try it this week."},
 {"id":"a28","capture":"tick","tags":["knowledge","prophet"],"text":"Teach one thing you learned today to one person, out loud."},
 {"id":"a29","capture":"photo","tags":["knowledge"],"text":"Photograph your notes. Even if there are only two lines."},
 # last day
 {"id":"a30","capture":"note","tags":["last day","hour","death"],"text":"Write the name of someone who has died and one thing you would thank them for."},
]
