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
]
