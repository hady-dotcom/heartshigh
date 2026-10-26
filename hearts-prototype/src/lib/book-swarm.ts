/**
 * Handwritten parent lines for Raising calm, happy children.
 * Each line is one person's words. Nothing here is built by filling a sentence template.
 * Films whose only prompt is N/A are left out.
 */

export type BookAnswer = { name: string; body: string }

export type BookFilm = {
  vimeoId: string
  title: string
  prompt: string
  others: BookAnswer[]
}

export const BOOK_SWARM: BookFilm[] = [
  {
    vimeoId: '1239220940',
    title: 'The Whole-Brain Child 2: Part 1 - Parenting With the Brain in Mind',
    prompt: 'Do you agree with the claim that parents are more knowledgeable about their children’s bodies than about their brain? If yes, why do you think this happens?',
    others: [
      { name: 'Anita Desai', body: 'Yes. I can tell you what my daughter ate and whether she has a temperature. I could not tell you what is going on when she goes from laughing to screaming in the shop. Nobody at clinic asks about that.' },
      { name: 'Carl Jensen', body: 'I agree, and I think it is because a rash shows. A meltdown looks like bad manners, so I treat it as manners. The film made me notice I have never once thought "his brain is not holding together".' },
      { name: 'Diane Okoro', body: 'Partly. I know his body because I have been up at night with it. The brain bit I leave to school. That split is on me. I would not hand a fever to the teacher and keep the feelings for myself.' },
      { name: 'Evan Price', body: 'I do know more about the body. We get a red book for weight and jabs. There is no red book for the afternoon he cannot come back from being told no. I had put that down to being four.' },
      { name: 'Farida Hassan', body: 'Yes, and it happens because I was taught to look for a symptom I can point at. "She is tired" is allowed. "She has lost the plot and I do not know which part" sounds like I have failed.' },
    ],
  },
  {
    vimeoId: '1239217363',
    title: 'The Whole-Brain Child 3: Part 2 - Two Brains Are Better Than One',
    prompt: 'How would you define horizontal integration? Is this integration truly essential for one to live a balanced life?',
    others: [
      { name: 'George Walsh', body: 'I would say it is the feeling side and the explaining side talking to each other. My son can tell me the rule and still be on the floor. The rule has not reached the feeling. I do think you need both, or you get a child who is either all storm or all lecture.' },
      { name: 'Hiba Nasser', body: 'Horizontal integration, as I heard it, is left and right not taking turns in silence. She can name "angry" and still not be able to use it. I am not sure it is essential for a balanced life. Some days balanced is just getting to the school gate.' },
      { name: 'Ian Campbell', body: 'It means the story and the emotion are in the same conversation. I skip the emotion and go straight to "what should you have done". He shuts down. So for our house, yes, it is essential. I have tried the other way.' },
      { name: 'Jade Morgan', body: 'I define it as not leaving her in the feeling with no words, and not giving her words when she is still too far gone to hear them. Essential? I think so for the children who flip. My quieter one seems to do it without me.' },
      { name: 'Karim Elsayed', body: 'Two halves of the same moment. He knows he should not hit, and he hits. The knowing and the hitting are not in the same room. I want them in the same room. I would not call a life unbalanced without it, but ours is harder without it.' },
    ],
  },
  {
    vimeoId: '1239217360',
    title: 'The Whole-Brain Child 4: Part 3 - The Staircase of the Mind',
    prompt: 'Which of the three strategies discussed in this video appeals to you the most? Why?',
    others: [
      { name: 'Louise Bennett', body: 'Engage, don\'t enrage. I appeal to that one because I do the opposite. I match his volume and then we are both upstairs, as the film put it. If I can stay on the ground floor I might get him down. The other two can wait until I can do this.' },
      { name: 'Malik Rahman', body: 'Move it or lose it. My girl thinks with her feet. Sitting her down to talk about the row makes it longer. A walk to the end of the road has ended more arguments than any speech I have prepared.' },
      { name: 'Nina Petrova', body: 'Use the upstairs brain. I liked it because my son is eight and he can sometimes plan, and I forget and treat him as if he cannot. Asking "what is the first step" uses the part that is actually there.' },
      { name: 'Oscar Grant', body: 'The one about not fighting the downstairs brain while it is in charge. I have been reasoning with a child who cannot hear me, then calling him rude for not answering. That strategy is the one I need, not the clever ones.' },
      { name: 'Parveen Akhtar', body: 'I keep coming back to letting the body settle before the talk. Not because it sounds kind. Because the talk at the peak is wasted and I am tired of wasting it. The other strategies are for after that.' },
    ],
  },
  {
    vimeoId: '1239221065',
    title: 'The Whole-Brain Child 5: Part 4 - Kill the Butterflies',
    prompt: 'What (if anything) have you learned about the work of memory?',
    others: [
      { name: 'Quentin Doyle', body: 'I learned that a memory can stay a lump. My daughter still will not go past the dog that jumped at her in March. I had been saying "it is over". The film says the memory has to be told, not cancelled. I have not tried that yet.' },
      { name: 'Rosa Martinez', body: 'Memory is not a filing cabinet. That was the line that landed. He remembers the telling-off and not what he did. I have been adding more telling-off, which is just another lump.' },
      { name: 'Samiha Khan', body: 'I did not know you could rewind a bad moment like a remote and stop it in pieces. It sounds odd. It also sounds more possible than "don\'t think about it", which is all I have had.' },
      { name: 'Thomas Reid', body: 'What I took is that the brain stores the fear faster than the explanation. I explain after. She already has the picture. I am late every time.' },
      { name: 'Uzma Shah', body: 'I learned that retelling can make it smaller, if I let him hold the remote. When I tell the story for him he argues with my version. When he tells it, he edits it. I had that the wrong way round.' },
    ],
  },
  {
    vimeoId: '1239217362',
    title: 'The Whole-Brain Child 6: Part 5 - The United States of Me',
    prompt: 'How would you define mindsight? Do you think mindsight is important to a happy life?',
    others: [
      { name: 'Victor Adeyemi', body: 'Mindsight is seeing your own weather and someone else\'s without becoming it. My son cannot do the second yet. He thinks my tired face is about him. I do think it matters for a happier house. A happy life is a bigger claim than I am willing to make.' },
      { name: 'Wendy Clarke', body: 'I would define it as noticing "I am cross" before the cross runs the evening. Important for a happy life? For me, yes, because I do not notice until the plates are loud. The children copy that.' },
      { name: 'Xavier Brooks', body: 'It is the pause where you look at the feeling instead of being the feeling. I am not sure it is required for happiness. I know plenty of cheerful people who never examine a thing. It is required for not repeating the same row with my daughter.' },
      { name: 'Yasmin Al-Farsi', body: 'Seeing inside, and seeing that other people have an inside too. She is six and she can do the first in flashes. The second is why her brother gets hit. I want that one more than I want a calm definition of happiness.' },
      { name: 'Zoe Patterson', body: 'Mindsight, in my words, is not taking the first story. "He did it to spite me" is the first story. The second story is usually "he is five and the biscuit broke". That second story is most of our peace.' },
    ],
  },
  {
    vimeoId: '1239217361',
    title: 'The Whole-Brain Child 7: Part 6 - The Me-We Connection',
    prompt: 'Do you think the sense of “we” is as important as the sense of “me”? Can one live a happy life without the former or the latter?',
    others: [
      { name: 'Arthur Nguyen', body: 'We is not optional in a flat with four people and one bathroom. Me is also not optional or the oldest will do everyone\'s homework voice. I do not think a happy life needs a perfect balance. It needs both to show up in the same day.' },
      { name: 'Bilqis Omar', body: 'I grew up on we, and me was selfish. I hear myself saying that to my daughter and I do not like it. She needs a me that is allowed. The we can be the dinner. It does not have to be every thought.' },
      { name: 'Colin Fraser', body: 'Me without we is my teenager with the door shut, and he is not happy in there. We without me is me saying yes to every family thing and then being sharp. I have tried both. Neither one on its own lasted a week.' },
      { name: 'Deborah Cole', body: 'I think we is harder to teach because school already rewards me. Certificates, stickers, "look what I did". Nobody stamps "you waited for your brother". I would not drop me. I would stop acting as if we is the extra.' },
      { name: 'Elias Petrov', body: 'A life with no me sounds miserable, and I have seen it in my own mother. A life with no we is what I am frightened my son is practising online. I want him to have a private self and a table he comes back to. I cannot pick a winner between those.' },
    ],
  },
  {
    vimeoId: '676503904',
    title: 'The Danish Way of Parenting 2: Part 1 - Default Parenting Settings',
    prompt: 'Can you think of three behaviours, which you know are wrong but which you repeat again and again with your children or relatives under certain circumstances?',
    others: [
      { name: 'Harriet Cole', body: 'I shout when the shoes are still in the hall and we are late. I know it does nothing. Then I say "because I said so" when she asks why, and later I go silent in the car. The lateness is usually mine. The shouting is what I reach for anyway, especially if my mother is waiting at the other end.' },
      { name: 'Jamal Whitfield', body: 'The one I hate is the sigh. My boy hears it before I have said a word about the mess, and then I am already cross. Second is threatening to cancel the football when I will not actually cancel it. Third is checking his bag three times and then telling him he is careless. All three turn up on a Thursday.' },
      { name: 'Soraya Haddad', body: 'I repeat the lecture. Same words, louder, about the tablet. I also finish his sentences when relatives are round, because I am embarrassed, and I compare him to his cousin. I would not want that done to me. It still comes out when my sister is watching and I want him to look easy.' },
      { name: 'Patrick Keane', body: 'Nagging about homework from the doorway. Taking the plate away before he has finished because I want the kitchen clear. And the joke that is not a joke, about him being the slow one. That last one comes out when I am tired, and his grandad is the same way with me. I can hear it and I still say it.' },
      { name: 'Lin Wei', body: 'I hurry her through the story at bedtime so I can sit down, then I feel guilty and add another chapter, then I am sharp because it is late. The other two are answering for her when someone asks her a question, and saying "what is wrong with you" when she spills. None of those are the parent I mean to be.' },
    ],
  },
  {
    vimeoId: '676504098',
    title: 'The Danish Way of Parenting 3: Part 2 - Play',
    prompt: 'Has this video confirmed/extended/challenged your beliefs about the role of play in children’s development?',
    others: [
      { name: 'Nkechi Eze', body: 'It challenged me. I had play down as the reward after the real work, the worksheet, the reading. My daughter is four and she learns more in the bath with the cups than she does when I sit her at the table. I have been saving play for when the proper bit is finished, and the proper bit is the part she forgets.' },
      { name: 'Brendan Foley', body: 'It confirmed what I already let happen and felt bad about. My son is seven and he will build a fort for an hour and call it nothing. I was about to stop that and start a workbook from the shop. I am leaving the fort. I am less sure that every afternoon needs something I can photograph for the class.' },
      { name: 'Ayesha Mir', body: 'It extended what I already thought, rather than overturning it. Play mattered for the little one. I had not thought the ten-year-old still needed the kicking a ball with no score, or the stirring that is not really cooking. I had moved him onto serious things. He got flatter. The ball is back.' },
      { name: 'Helen McCarthy', body: 'A bit of both. I believed play was fine if it looked educational, puzzles and letter magnets. The film is wider than that. Rough play in the garden, the kind that looks like chaos from the window, is the bit I stop. I am going to let one of those afternoons go without turning it into a lesson.' },
      { name: 'Luca Romano', body: 'It confirmed the part I like and challenged the part I skip. I will get on the floor with the cars. I will not let him be bored. The film made me think the boredom is where he starts inventing, and I keep rescuing him from it with a snack and a plan. That rescue is me, not him.' },
    ],
  },
  {
    vimeoId: '676504166',
    title: 'The Danish Way of Parenting 4: Part 3 - Authenticity',
    prompt: 'Can you think of three teaching strategies that promote the development of a growth mindset?',
    others: [
      { name: 'Hannah Cho', body: 'The film is written as if I am standing at a whiteboard. At home the three things I can actually do are let her finish the sentence even when it takes a while, show her a page of mine that is messy, and ask what she would try next instead of handing her the answer. I do the third one least. It is slower, and I am impatient after work.' },
      { name: 'Samuel Briggs', body: 'I am not a teacher, so I translated it into our kitchen. Praise the trying, not the tidy sheet. Let him see me look something up. Keep yesterday\'s hard sum on the fridge so he can see it got easier. The middle one is the one I avoid, because I do not like looking stuck in front of an eight-year-old who thinks I know everything.' },
      { name: 'Fatou Camara', body: 'At our table it is three small habits, not a programme. She gets to redo one line without me sighing. We say "not yet" and I have to mean it, not use it as a delay while I think of the answer. And I stop covering the mistake with my hand. I grew up with mistakes hidden. I still catch my hand moving.' },
      { name: 'Rachel Stein', body: 'I can name three and I only do one of them. I tell my son the point is the practice. I do not yet let him choose a harder book and fail at it in front of me. And I do not tell him when I got something wrong at work. The film made that last one sound useful. I might start with the book, which is smaller than my job.' },
      { name: 'Rami Haddad', body: 'For us it is not a strategy with a name. It is me not saying "you are so clever" when the drawing is good, because then the next drawing has to be good or she is not clever. I am switching to "you kept going on the roof". I also want a retry without an audience, and me doing something badly on purpose, like the juggling I cannot do, so failing is ordinary in the room.' },
    ],
  },
  {
    vimeoId: '676503451',
    title: 'The Danish Way of Parenting 5: Part 4 - Reframing',
    prompt: 'Think of an unpleasant situation due to which your students might experience stress. How can you reframe this situation to sound supporting rather than limiting?',
    others: [
      { name: 'Catherine Boyle', body: 'I do not have students. I have a girl who dreads the Monday spelling. I have been saying "do not get them wrong again". The line I am trying is "you already know four, we are finding the two that are hiding". Same list. She cries less when it is a search and not a warning. I still slip on Sunday night, when I am the one who is tired.' },
      { name: 'Emre Demir', body: 'Swimming. He hates the cold and the waiting on the side, and I say "everyone else can do it". That is the limiting version and it is a lie. Half the class is clinging to the rail. The other version, which I have only thought in the car park, is "you got in, that was the hard bit, we are only staying for ten minutes". I have not said it out loud yet.' },
      { name: 'Siobhan Reilly', body: 'My girl panics when a friend leaves her out at pickup. I say "ignore it, they are silly". That shrinks her. A truer line is "that hurt, and you still have Maya, shall we ask Maya about tomorrow". I am not pretending the hurt is useful. I am just not leaving her alone in it while I rush us to the bus.' },
      { name: 'Andre Baptiste', body: 'The film keeps saying students. Mine is a child who will not read aloud. I have framed it as "you are behind". The frame that fits our house is "your reading voice is quiet and we can practise in the kitchen where nobody else is listening". He will do a page there. He will not do it as a performance, and I had made it a performance.' },
      { name: 'Leila Mansour', body: 'Bedtime after a bad day at school. I rush the story because I want the day shut. She reads that as me being finished with her as well. I am trying "the day was heavy, the story is the soft part, we are not in a hurry for this one". It is the same ten minutes. The sentence is the difference, when I remember it before the sigh.' },
    ],
  },
  {
    vimeoId: '676503630',
    title: 'The Danish Way of Parenting 6: Part 5 - Empathy',
    prompt: 'Can you think of three activities that teach children empathy?',
    others: [
      { name: 'Gemma Fox', body: 'We do a "who had a hard moment" at tea, and it cannot be used to tell someone off later. Second, she helps her little brother with his shoes and I name that as noticing, not as a chore. Third, we pause a programme and I ask what the quiet character wanted. The third one works better than any speech I have prepared in the car.' },
      { name: 'Bilal Hussain', body: 'One is taking a drawing to the neighbour who is ill, which she chose herself. One is the animal book, and I ask who got left out of the picture. One is when he snatches, I ask him to look at his sister\'s face before I take the toy. I forget the face and go straight to the rule. The rule has not taught him anything about her.' },
      { name: 'Ingrid Larsen', body: 'Cooking, and letting him taste something I do not like, so he sees that people want different things and it is not an insult. A postcard to his grandad in his own words, even if the spelling is wild. And pausing the game to ask how the person who lost is feeling, including me. I am bad at losing board games. He has noticed, which is embarrassing and useful.' },
      { name: 'Marcus Bell', body: 'I do not have three clever activities. I have one that is working. When his friend is sad at the gate, I ask my son what he thinks would help, and then we do that small thing, a wave or a seat saved if we can. Role play and charts feel like school. He is six. The gate is enough for now, and I am not dressing it up as a lesson.' },
      { name: 'Amal Farouk', body: 'Sharing the last biscuit by asking her brother what he would like first, not by me cutting it and calling that fair. Visiting my dad and letting her pour his tea, slowly, while he talks. And when she says something unkind I make her try the sentence again as if it had been said to her. She hates the third one. It is the one that lands.' },
    ],
  },
  {
    vimeoId: '676503854',
    title: 'The Danish Way of Parenting 7: Part 6 - Ultimatums',
    prompt: 'Do you always distinguish between a child and his/her actions when delivering feedback? Can you give an example of the feedback that contains this distinguishing and the one that does not?',
    others: [
      { name: 'Stephanie Ng', body: 'I do not always separate them. Yesterday I said "you are being impossible" when he would not put his coat on. That is about him. This morning I managed "the coat is still on the chair and we need it on". Same child, same coat. He moved for the second and argued with the first. I can hear the difference. I do not always choose it when we are late.' },
      { name: 'Kofi Asante', body: 'The line that separates them: "the water is all over the floor, and you are the boy who can fetch the towel". The line that does not: "you always make a mess". I said the second on Saturday in front of his uncle. I am writing the first one down because I will not remember it when the water is actually on the floor and I am in socks.' },
      { name: 'Ruth Callaghan', body: 'No. I say "you are so rude" when what she did was interrupt. The feedback that keeps them apart is "I was still talking, wait until I finish". I used that with my older one and she waited, surprised. With the younger one I am still on "rude". He is four. I am using his age as the excuse and I know that is thin.' },
      { name: 'Imran Syed', body: 'One that distinguishes: "leaving the bike in the rain was a poor choice, and you are still someone who looks after your things". One that does not: "you are careless". I have the first sentence in a note on my phone. I have said the second sentence out loud twice this week. The note is not winning yet. I am keeping it anyway.' },
      { name: 'Danielle Porter', body: 'I thought I did this until I heard myself say "you are lazy" about a maths sheet. The sheet was unfinished. She is not lazy. She was stuck on the third question and hiding it under her arm. The line I owe her is "the third one is not done, shall we look at it together". I have not said that. The other sentence is still sitting in the room.' },
    ],
  },
  {
    vimeoId: '676502461',
    title: 'The Danish Way of Parenting 8: Part 7 - Togetherness and Hygge',
    prompt: 'Can you think of three strategies for how hygge can be brought to your home?',
    others: [
      { name: 'Freya Nielsen', body: 'Phones in a basket for the meal. A candle only if I am not going to spend the evening fussing about the wax. And one stretch where we are in the same room without a plan. The third is the hard one, because I fill silence with jobs. The boys have started putting their phones in the basket before I ask, which I did not expect from a basket.' },
      { name: 'Hassan Dar', body: 'A hot drink for whoever is home, not as a reward for finishing homework. Blankets on the sofa that are allowed to be used, not folded for show. And Sunday soup that takes long enough for people to drift in. I cannot manufacture a Danish evening in a terrace. I can stop booking every hour of the one we have.' },
      { name: 'Claire Donnelly', body: 'Lower the light in the front room after tea, which sounds silly and does change the row about homework. A puzzle left out so anyone can add a piece, with no lecture about taking turns. And one question that is not about school. I default to school. The question is the part I fail, usually by asking what the teacher said.' },
      { name: 'Jonah Adler', body: 'I tried three things last week. Soup, a board game, and no talk about the morning rush. The game turned into an argument about the rules, so that one is out. The soup stayed. Not talking about tomorrow is the one that made the evening feel different, and I only managed it once. I am counting the once, because it was a real evening.' },
      { name: 'Anjali Nair', body: 'Shoes off and a short playlist she picks, not my classical. Ten minutes on the floor with no job attached. And a small story from my day that is not a worry I am handing her. The floor is what she asks for now. I used to think cosy had to look like a photograph. It looks like us being slightly bored together, and that is enough.' },
    ],
  },
  {
    vimeoId: '657276491',
    title: 'The Montessori Toddler 2: Part 1 - Introduction',
    prompt: 'What are your associations with the Montessori approach? Write down a few of them to see if they remain unchallenged when you complete all the videos.',
    others: [
      { name: 'Nora Lindqvist', body: 'I associate it with wooden toys that cost more than our weekly shop, and with children who pour their own water without being asked. I have never been inside a Montessori room. My picture is from a cousin who talks about trays. I am writing that down so I can see, at the end, whether I was only describing the price.' },
      { name: 'Caleb Okorie', body: 'Quiet rooms, low shelves, and a rule that you do not interrupt a child who is concentrating. That last one appeals to me because I interrupt my son constantly. I also think it means no plastic and no telly, which may just be me being strict with myself. I will check that assumption against the later films rather than deciding now.' },
      { name: 'Hanae Idrissi', body: 'I think of it as school for people who can choose their school. We did not get a choice. The other association is "let them do it themselves", which I already shout when I am late and then undo by doing it for her. So my associations are money, and a habit I claim and do not keep. Both might be unfair. I am leaving them here.' },
      { name: 'Owen Blake', body: 'Pink tower. I saw it in a photo and it lodged. Also the idea that the adult stands back, which makes me nervous, because if I stand back my two-year-old climbs the bookcase. And "prepared environment", a phrase I have heard and not pictured. Our environment is a rented flat with one cupboard. I want to see if the idea survives that.' },
      { name: 'Marta Silva', body: 'I associate it with my sister-in-law, who labels it and then describes ordinary things: a small jug, a cloth for spills, shoes he can put on. If that is all it is, I am already halfway there and calling it nothing. I also associate it with being judged for cartoons. I am not sure which of those is the approach and which is the family chat.' },
    ],
  },
  {
    vimeoId: '657276559',
    title: 'The Montessori Toddler 3: Part 2 - Introduction to Montessori',
    prompt: 'Can you think of three strengths and weaknesses of the Montessori approach as opposed to traditional education?',
    others: [
      { name: 'Theo March', body: 'Strengths, from a parent who is not a teacher: he can repeat a thing until he is done, the work is sized for his hands, and I am not the only one deciding the order. Weaknesses: I do not know how to tell if he is stuck or thinking. The materials we can afford are a jug and a sponge. And his nursery is not going to change because I watched a film. I can only change the hour before nursery.' },
      { name: 'Aaliyah Grant', body: 'What I like is the respect, the child is not a project to be finished by Friday. What worries me is the quiet. My daughter learns by being loud with other children, and a room of individual trays might bore her. Traditional nursery has a lot of sitting on the carpet, which she also hates. I am not picking a winner. I am stealing the part where she finishes what she started.' },
      { name: 'Seamus Doyle', body: 'Strength: the adult stops performing. Weakness: I am bad at not performing, so the method depends on a skill I have not got. Strength: practical life, pouring, wiping, which is our actual life. Weakness: traditional school will still want him to sit and copy, and I do not want him to arrive there unable to. We will need both, and I am not pretending the film replaces the school he will actually attend.' },
      { name: 'Priyanka Deshmukh', body: 'Compared with the classroom I remember, the strength is choice and the weakness is that choice takes an adult who is not rushing. We are rushing. Another strength is that mistakes are part of the tray, you spill, you wipe. The weakness is equipment and space, which the film shows as if everyone has a spare room. I am not going to call our hallway a weakness of the child. It is a weakness of the flat.' },
      { name: 'Soren Berg', body: 'I can see three strengths without having tried it: concentration, real tasks, and less sticker charts. The weaknesses I am wary of are social, he is an only child and I do not want his day to be him and a shelf, and language, I want him in a noisy group too. Traditional education gave me tests and not much practical skill. I do not want to swing so far that he never meets a group.' },
    ],
  },
  {
    vimeoId: '657276574',
    title: 'The Montessori Toddler 4: Part 3 - Montessori Activities for Toddlers',
    prompt: 'Have you ever used Montessori activities in your practice? What were they? Were they effective/useful?',
    others: [
      { name: 'Lila Fernandes', body: 'I do not have a practice. I have a toddler and a kitchen. The closest I have come is letting her transfer pasta from one bowl to another with a spoon while I cook. It was useful for about ten minutes, which is a long time for her, and then the pasta was on the floor and she was proud. I would do it again. I would not buy a special set to make it official.' },
      { name: 'Connor Walsh', body: 'We tried the dressing frame idea with his actual coat, big buttons, on the sofa. It was effective on a Sunday and useless on a Monday when we had to leave. The activity wants time I do not have on work mornings. So it is useful as a game, not as the way we get out of the house. I am keeping the Sunday version and stopping feeling guilty about the Monday one.' },
      { name: 'Yasemin Kaya', body: 'I put a small broom in the cupboard he can reach, after seeing someone else do it, not from a course. He sweeps the same pile of dust in circles. It is not effective at cleaning. It is useful because he is beside me while I sweep, and he is not climbing me. I am counting that. The film may want a more precise activity. This is the one our house can hold.' },
      { name: 'Idrissa Ba', body: 'Water play in the bath is the one we actually repeat. Pouring between cups. She will do it until her fingers wrinkle. It is effective at keeping her settled at the end of the day, and I think she is learning something about full and empty, though I would not swear to it. I have not set up a tray on a table. The bath is where the pouring already happens, so I am not moving it for the sake of the method.' },
      { name: 'Paula Brennan', body: 'I tried sorting socks with my three-year-old and called it an activity so I would stick with it. He matched two pairs and then wore them on his hands. Useful? He can now find the two blue ones. Effective as laundry, no. I am not a practitioner and I am not going to pretend a sock game is a curriculum. It was a good Tuesday. That is the size of it.' },
    ],
  },
  {
    vimeoId: '657276597',
    title: 'The Montessori Toddler 5: Part 4 - Setting up the Home',
    prompt: 'Based on your own experience, what role does space play in children\'s development? What do you, as a parent, normally do to create a favourable environment?',
    others: [
      { name: 'Megan Chow', body: 'Space is the difference between her playing and her clinging. When the floor is clear she builds. When it is covered in my work bag and the washing she stands at my leg. What I actually do is ten minutes after breakfast: toys back in the one basket, table wiped, the dangerous mug moved. I do not have a prepared room. I have a reset, and the reset is the environment.' },
      { name: 'Farid Mansouri', body: 'In our flat the space tells him what is allowed. If the paints are on a high shelf, painting does not exist. I moved the paper to the bottom drawer and the mess got worse and the pictures got more. That is the role of space in this house: it is the menu. What I do is keep one drawer that is his, and I shut the office door so my desk is not a climbing frame. The rest stays as it is.' },
      { name: 'Bethany Crowe', body: 'I notice she concentrates in the corner by the window and not in the middle of the room, where people walk. So space is also about not being in the traffic. I put a cushion there and stopped using that corner as a dumping ground for post. That is the whole favourable environment I have managed. It is one square metre and it works better than any speech about focusing.' },
      { name: 'Kenji Sato', body: 'Too much space and he wanders. Too little and he throws. Our table is small and that helps him stay with the puzzle. What I do is limit what is out: two puzzles, not the whole cupboard, and I sit where I can see him without hovering over the pieces. I used to tip every toy onto the rug and then wonder why he flitted. The rug was the problem. I was calling it stimulation.' },
      { name: 'Abena Owusu', body: 'The room we have is the living room, and it is also where I take calls. Space for her development is whatever is left when my laptop is shut. I normally clear the coffee table and put one activity on it, and I take the call in the kitchen if I can. When I cannot, she gets the sofa and a book. I am not going to describe that as a method. It is how we stop the day collapsing.' },
    ],
  },
  {
    vimeoId: '657276327',
    title: 'The Montessori Toddler 6: Part 5 - Raising a Curious Child',
    prompt: 'Based on the information about the composition of curiosity and the main principles of cultivating it, can you think of three or more activities that foster curiosity?',
    others: [
      { name: 'Rhiannon Price', body: 'The film had a framework. What we actually do is smaller. We open one kitchen cupboard and she names what she sees, and I do not quiz her. We walk the same way to the shop and I let her stop at the same drain. And we keep a "what is this" box, a pinecone, a screw, a feather, and she can take them out when she asks. I am not adding a fourth. Three that happen is better than a list we will not start.' },
      { name: 'Tariq El-Amin', body: 'Cooking is the one that works, because he can see the egg change. The garden, even if it is three pots, because something is different every week and he notices before I do. And letting him take a toy apart that is already broken, so the curiosity is not me saying no. I used to answer every question myself to get to the end of the walk. I am trying "what do you think" once per walk. Once is honest.' },
      { name: 'Sophie Lang', body: 'I am wary of activities designed to make a child curious, as if she is not already. She is curious about the bin lorry and bored by my flashcards. So the three are: stop at the lorry, let her ask the driver nothing if she is shy and just watch, and later draw the lorry badly with her. The principle I took is follow the thing she is already staring at. I do not need to import a new one.' },
      { name: 'Mateo Alvarez', body: 'A magnifying glass from the pound shop, which he uses on his own knee more than on leaves. A trip where we are not going anywhere, just to the end of the street and back, with time. And me saying "I don\'t know, shall we look" instead of inventing an answer about why the sky is that colour. The third one is the activity. It is also the one I skip when I am tired and I just want the question to end.' },
      { name: 'Deepa Krishnan', body: 'We plant spring onion ends in a jar because it is cheap and it does something. We keep a question on the fridge that she asked, and we do not answer it the same day. And we have a basket of real things, keys, a whisk, a measuring tape, instead of a toy version. She is four. The whisk was the most interesting object in the house for a week. I had been buying plastic food.' },
    ],
  },
  {
    vimeoId: '657276359',
    title: 'The Montessori Toddler 7: Part 6 - Nurturing Responsibility and Cooperation in Children',
    prompt: 'Based on your experience, what are some effective strategies to encourage cooperation? How do these strategies differ across ages?',
    others: [
      { name: 'Callum Reid', body: 'With the two-year-old, cooperation is a choice between two things I can live with: red cup or blue cup. A real choice, not a trick. With the eight-year-old, that reads as babyish. He cooperates when I tell him the constraint, we leave at half past, and let him decide the order of shoes and bag. Same idea, more dignity. What does not work at either age is me repeating the instruction from the other room.' },
      { name: 'Nadia Farooq', body: 'The little one cooperates if I am on the floor doing the thing with her, not directing it. The eleven-year-old cooperates if I ask at a time that is not the middle of a game, and if I accept a later time he names. I used the same cheerful voice for both and the older one heard it as false. Effective for me has been fewer words for the toddler and a negotiated time for the older one. Lectures fail both of them, in different volumes.' },
      { name: 'Elliot Barnes', body: 'I only have one child, five, and a nephew who is twelve and stays on Fridays. The five-year-old will help if the job is visible and short, drying three cups. The twelve-year-old will not be handed a job in front of people. I ask him after his mum has gone, and I ask him to choose which bit. Cooperation at twelve is privacy. At five it is being included in the doing. I mixed those up for a month.' },
      { name: 'Zainab Noor', body: 'My four-year-old cooperates when the next thing is concrete: "pyjamas, then the story". If I say "because we are a team" she looks at me. My nine-year-old needs the reason, and he will argue with a bad one, which is fair. What works for him is "I need the table clear so I can put dinner down", not a speech about character. The strategies differ because one of them can hold a reason and the other can hold a picture.' },
      { name: 'Hugh Gallagher', body: 'Toddlers in this house cooperate when I give them a job that is real, carrying the napkins, and I do not redo it in front of them. The teenager cooperates when I stop calling it cooperation. He hears that word as school. I say "can you take the bins out before the match". Age changes the pride. The little one wants to be seen doing it. The big one wants to do it without an audience. I was applauding both. Only one of them liked it.' },
    ],
  },
  {
    vimeoId: '657276381',
    title: 'The Montessori Toddler 8: Part 7 - Putting Theory into Practice',
    prompt: 'Why do you think toddlers require special support when they encounter a change in their habitual routine?',
    others: [
      { name: 'Elena Popescu', body: 'Because the routine is how she knows what happens to her. She cannot yet tell herself "nursery is shut, we are at nan\'s, the biscuits are different, it is still a safe day". I have to be that sentence. When I skip it and rush, she falls apart at the door and I call it naughtiness. It is the day with the edges missing. The support is me naming the change before we are in it, not after she is on the floor.' },
      { name: 'Tessa Quinn', body: 'He uses the order of the morning to keep his body in check. Cereal, then teeth, then shoes. If the shoes come first because we are late for a train, he has nothing to push against and he goes rigid. I think toddlers need the support because they cannot hold the new plan in their head while their body is still running the old one. My job is to walk the new plan slowly enough that his body can catch up. I rarely do it slowly enough.' },
      { name: 'Omar Khalil', body: 'A change is a loss of the thing they were about to do, and they do not have the words for disappointment yet. My daughter is two. Swapping the park for the doctor is, to her, the park being taken. I think the special support is mourning the small plan with her, "we are not going to the slide", before I sell the new one. If I only sell the new one she hears that I did not notice what she lost.' },
      { name: 'Jillian Moore', body: 'They require it because they cannot check the clock or the calendar. The routine is their clock. When it moves, nobody has told the clock. I am the person who can say "this morning is different, we are going in the car first". Without that, he is not being difficult. He is still in Tuesday and I have dragged him into a Wednesday. I forget this every time there is a holiday and then I am surprised on the first morning.' },
      { name: 'Marcus Adeyemi', body: 'I think it is physical as much as emotional. The route to the childminder has the same lampposts, and he touches one of them. A different route and he does not know where his body is in the day. Special support, for us, is keeping one piece the same: the same cup, or the same song in the car, even if the building at the end has changed. I used to change everything at once and call it an adventure. It was an adventure for me. For him it was a blank.' },
    ],
  },
  {
    vimeoId: '657276399',
    title: 'The Montessori Toddler 9: Part 8 - Being the adult',
    prompt: 'What self-care practices do you think might be useful for you to prepare yourself as the model adult?',
    others: [
      { name: 'Aoife Nolan', body: 'The useful one is not a bath with candles. It is eating my own lunch while she is eating hers, instead of standing up and wiping. If I am hungry I get sharp, and she copies the sharp. The other practice is ten minutes after she is in bed when I do not start the washing. I sit. I am a poor model when the first thing she sees in the morning is me already frantic. The sitting is so that the morning starts one notch slower.' },
      { name: 'Benjamin Cho', body: 'I need a practice that stops me narrating his mistakes. The one that might work is a walk around the block on my own before the bedtime routine, even if it is eight minutes. I come back less interested in how he holds the toothbrush. Sleep would be the real practice and I am not getting it. I am not going to write "meditate" and then fail it. The walk is the thing I have actually done twice this week.' },
      { name: 'Salma Darwish', body: 'Speaking to myself in the kitchen the way I want him to hear me speak to him. I mutter "for goodness\' sake" at the burnt toast and he is in the doorway. A useful practice is noticing the mutter and finishing the sentence kindly, out loud, so he hears the repair. The other is texting a friend one true line about the day, so I am not using him as the only person I talk to. He should not be my whole social life. That is too heavy a model.' },
      { name: 'Chris Adewale', body: 'I prepare badly. I start the evening already owed a rest, and then I am the adult who sighs at a spill. What would help is deciding the rest before the spill: a cup of tea I actually finish, made before I call him for the bath. It sounds small because it is small. The model he needs is a man who is not surprised by a spill. I cannot be that man on an empty stomach and no tea. So the tea is the practice, not a reward after I have been patient.' },
      { name: 'Fiona Kerr', body: 'I think the practice is leaving the house once without them, even to the shop, so that I return as a person and not as a service. When I do not leave, I model a woman who has no outside, and my daughter is already apologising for asking me things. The second one is saying "I need a minute" and taking it in the bedroom with the door open, so the minute is real and not a rejection. She can see that adults need minutes. I want her to learn that from me before she learns it from being snapped at.' },
    ],
  },
  {
    vimeoId: '657276426',
    title: 'The Montessori Toddler 10: Part 9 - Working Together',
    prompt: 'Can you think of three strategies that can foster cooperation between different family members?',
    others: [
      { name: 'Rowan Ellis', body: 'One job that needs two people, so the older one is not babysitting and the younger one is not the audience. We carry the recycling together, one bag each, even if I could do it faster. A weekly thing they choose, not me, which at the moment is pancakes and is chaos. And no debrief in front of them about who did not help. I was doing the debrief with my partner in the kitchen and both children heard who the problem was. That undoes the bag-carrying.' },
      { name: 'Amira Qureshi', body: 'We have started a "who is doing dinner" list that includes my husband, not only me and the oldest child. Cooperation between the adults was the missing piece. I was asking the children to be a team while the adults were not. Second, the little one sets out cups and the older one pours, so neither job is the whole job. Third, when it goes wrong we repair it together, the spill, rather than me sending one of them out. Sending someone out teaches the other one that cooperation ends at the first mistake.' },
      { name: 'Piotr Nowak', body: 'My mother lives with us and she and I disagree in front of the children about how much help a four-year-old should be. The strategy that helped was agreeing the three things she will not be corrected on, the shoes, the washing up, the park. I stop commenting. She stops commenting on the bedtime book. The children cooperate better when the adults are not having a second argument over their heads. The other two ideas can wait until that one sticks.' },
      { name: 'Keisha Grant', body: 'A shared end, not a shared speech. "The table needs to be ready for Aunty" gets more help than "we should work as a family". People take a piece: my son does the mats, his dad does the chairs, I do the food. The third strategy is thanking the person in the room, specifically, so it is not me collecting thanks on everyone\'s behalf. When I say "we all worked hard" my son hears that his mats disappeared into "we". He stops doing the mats.' },
      { name: 'David Stein', body: 'We use a Saturday morning where everyone is in the same job for twenty minutes, the living room, and then we stop even if it is not perfect. Stopping is the strategy. If it runs on, my partner gets resentful and the children vanish. Second, the children are allowed to ask an adult for help without being told they should have done it alone. Third, I do not compare the cousins. Comparison is how our cooperation usually dies, at Sunday lunch, in one sentence. I am trying to keep that sentence behind my teeth.' },
    ],
  },
  {
    vimeoId: '657276449',
    title: 'The Montessori Toddler 11: Part 10 - What’s Next?',
    prompt: 'What are the three most important takeaways from these videos?',
    others: [
      { name: 'Laura McBride', body: 'I am taking three things and leaving the rest. Give her jobs that are real. Change one thing in the room, not the whole room. And sort myself out before I sort her, because she is watching the sigh. I am not converting the flat. I am not buying a tower. If I do those three for a month I will know whether this was for us. A longer list would be a way of doing none of it.' },
      { name: 'Yusuf Demir', body: 'The takeaway I did not expect is that standing back is a skill, not a personality I lack. The second is that his concentration is fragile and I am usually the one who breaks it by talking. The third is practical: a low drawer with two activities beats a cupboard full of toys he cannot choose between. I am going to do the drawer this weekend. The skill of shutting up will take longer than the weekend.' },
      { name: 'Chloe Anders', body: 'One: she can do more with her hands than I let her. Two: the routine is her map, so I should warn her before I redraw it. Three: I do not need a different school to start. Our nursery stays. The films changed the hour at home, not the argument I was having with the admissions form. I am glad I watched them before I spent money trying to buy the feeling.' },
      { name: 'Hamza Iqbal', body: 'What I am keeping is slower mornings, one real chore, and less praise that is actually a verdict. "Good boy" is a verdict. "You got the water in the cup" is information. The third one matters most to me because I was praised in verdicts and I still chase them. I do not want that to be what he thinks a parent is for. The shelves and the wooden objects can stay in the films.' },
      { name: 'Grace Penrose', body: 'First, follow what he is already interested in instead of importing an activity. Second, cooperation in this house has to include the adults or the children will not bother. Third, when the day changes I have to say so before we leave, not at the meltdown. Those are the three I can remember without notes. Everything else I will forget by Friday, so I am not pretending it is a takeaway.' },
    ],
  },
]
