/**
 * Handwritten parent lines for the first book in Raising calm, happy children.
 * Each line is one person's words. Nothing here is built by filling a sentence template.
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
]
