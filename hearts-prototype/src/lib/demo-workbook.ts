import { BOOK_SWARM } from '@/lib/book-swarm'
import { keptAnswerKey } from '@/lib/swarm-plan'

/** The first ten Guiding Home Learning films, in sheet order. Welcome film 1 is not in the course. */
export type WorkbookOther = { name: string; body: string }

export type WorkbookFilm = {
  vimeoId: string
  title: string
  prompt: string
  others: WorkbookOther[]
}

export const WORKBOOK_FILMS: WorkbookFilm[] = [
  {
    vimeoId: '1239173362',
    title: 'Home Learning Introduction 2: How To Use This Course',
    prompt: 'What aspects of home learning would you like further guidance with? For each area briefly note why this is the case.',
    others: [
      { name: 'Nadia Hussain', body: 'Maths is the one I keep putting off. My son is 8 and the school sheets assume I remember fractions. I need someone to show me how to sit with him when I do not know the answer either.' },
      { name: 'James O\'Brien', body: 'Reading is fine. It is the behaviour when my daughter will not start. She is 6 and will sharpen every pencil in the house first. I want help with getting her into the chair without a row.' },
      { name: 'Fatima Noor', body: 'I have two at home, 5 and 10, and they need different things at the same time. I would like guidance on splitting an hour so neither one is just waiting.' },
      { name: 'Ben Carter', body: 'Writing. My lad\'s letters are still all over the page and I correct every word, which makes him stop. I need a better way than hovering with a rubber.' },
      { name: 'Aisha Begum', body: 'Planning the week. I work nights and the mornings are a scramble. I want a short list I can actually keep, not a timetable that falls apart by Tuesday.' },
    ],
  },
  {
    vimeoId: '1239453080',
    title: 'Home Learning Introduction 3: Implementing Advice',
    prompt: 'After watching the video, what information did you find most interesting and why?',
    others: [
      { name: 'Chris Doyle', body: 'The bit about trying one change, not the whole list, stayed with me. We already have too many charts on the fridge.' },
      { name: 'Mei Lin', body: 'I liked that you can come back to the same advice later. Last term I heard something about breaks and forgot it by the afternoon.' },
      { name: 'Hassan Ali', body: 'What stuck was doing the hard task earlier, while they are still fresh. My girl does spelling late and she is already done in.' },
      { name: 'Ruth Evans', body: 'I wrote down "say what done looks like before they start". I usually say "get on with it" and then we argue about whether it is finished.' },
      { name: 'Kwame Mensah', body: 'The reminder that the child should do the work, not me. I have been filling in the blanks on his sheet so it looks tidy for the teacher.' },
    ],
  },
  {
    vimeoId: '1239173364',
    title: 'Home Learning Preparation 1: Introduction to Preparations',
    prompt: 'Describe the current way in which you provide learning at home. You may wish to include a video which helps you to highlight the space and structures you use',
    others: [
      { name: 'Sarah Doyle', body: 'We use the kitchen table after breakfast is cleared. Books live in a crate by the radiator. There is no separate room, so I put the little one\'s toys in the hall first or she climbs on the work.' },
      { name: 'Imran Qureshi', body: 'School sends a pack on Monday. I sit with my son for the maths and leave the reading for after dinner, when his sister is in bed. The space is the end of the sofa, which is not ideal.' },
      { name: 'Claire Murphy', body: 'I follow the class email and we do it in short goes. The table is the one in the front room, next to the window. I keep pencils in a jam jar so we are not hunting.' },
      { name: 'Joseph Adeyemi', body: 'Right now it is me reading the instructions out loud and him nodding. We work at the dining table. I have not set up a proper corner yet because the landlord said no shelves.' },
      { name: 'Hanae Bensaid', body: 'Three children, one table. The oldest has the end with the lamp. The younger two share the other side and I move between them. It is noisy and I have not found a better shape.' },
    ],
  },
  {
    vimeoId: '1239453076',
    title: 'Home Learning Preparation 2: Child Centered - Our Meaning',
    prompt: 'What is your understanding of the term \'child-centred\'?',
    others: [
      { name: 'Peter Walsh', body: 'I think it means the work starts from what the child can do today, not from the page I wish they were on. My son is ahead in numbers and behind in writing, so the same sheet does not fit both.' },
      { name: 'Zara Iqbal', body: 'To me it is letting her choose the order sometimes. She will do art before literacy if I let her, and then the writing actually happens.' },
      { name: 'Mark Hughes', body: 'Child-centred is not "they do whatever they like". It is me noticing when he is lost and changing the task, instead of pushing through because the clock says so.' },
      { name: 'Layla Osman', body: 'I take it as following their interest without dropping the school work. My boy will talk about trains for an hour. I can count carriages and still call it maths.' },
      { name: 'Fiona Grant', body: 'It means asking them what they already know before I explain. I skip that and launch into the answer, and then she switches off.' },
    ],
  },
  {
    vimeoId: '1239453079',
    title: 'Home Learning Preparation 3: Considering Time Use',
    prompt: 'How has this video altered you view of the time you spend on activities and learning? Explain your reasons here.',
    others: [
      { name: 'Samir Haddad', body: 'I thought we spent an hour on learning. We do not. A lot of it is me finding the login and him asking for a snack. The actual work is closer to a short sitting.' },
      { name: 'Emma Brooks', body: 'The film made me count the gaps. We start, stop for the baby, start again. I had been blaming the school for sending too much, and half of it is the stopping.' },
      { name: 'Patrick Nolan', body: 'I moved reading to the time she is already on the sofa after tea. Fighting her first thing was using the best part of the morning on one argument.' },
      { name: 'Grace Adeyemi', body: 'I used to block a long stretch and feel we had failed when we stopped early. A shorter sitting that finishes is worth more. He is 11 and still fades quickly.' },
      { name: 'Rukhsar Khan', body: 'The twins share the afternoon and I had them both at the table the whole time. One is waiting while the other works. I am going to stagger them so the waiting is play, not sitting still.' },
    ],
  },
  {
    vimeoId: '1239453077',
    title: 'Home Learning Preparation 4: Considering your Goals',
    prompt: 'What are your goals for home learning? Record your goals (and the reason for those goals) here. You should also begin to note down how you will achieve those goals and by when.',
    others: [
      { name: 'Helen Brooks', body: 'Goal for this month is that my girl reads one page aloud without me jumping in. She is 9 and guesses. We will do it after dinner, four nights, and I will keep a tick on the calendar.' },
      { name: 'David Okeke', body: 'I want my boy to start a task without me sitting down first. He is 5 and waits for me. We will use a picture card of the first step, and I will check it by the end of next week.' },
      { name: 'Sana Rahman', body: 'The older one, 13, hands work in late. The goal is one piece finished the day it is set, not Sunday night. I will look at the list with him on the walk home, before the football.' },
      { name: 'Callum Fraser', body: 'I want fewer tears over maths. She stays at her gran some weeks, so the goal has to work in both houses. A short go at the same sheet, three times, and we stop even if it is not done.' },
      { name: 'Niamh Kelly', body: 'My lad is 14 and shuts the door. The goal is not a perfect essay. It is that he tells me the title before he starts, so I know he has opened it. We will try that this week, after tea.' },
    ],
  },
  {
    vimeoId: '1239453110',
    title: 'Home Learning Preparation 5: Skills - Not Just Lessons',
    prompt: 'Select at least one tip you intend to trial. Why have you selected that particular idea?',
    others: [
      { name: 'Owen Price', body: 'I am going to try naming the first tiny step out loud. "Open the book to page 4" instead of "do your English". My daughter gets stuck on the size of the job.' },
      { name: 'Amira Saleh', body: 'The tip about a finished box. When the page is in the box, it is done, and I stop adding "just one more". I picked it because I keep extending the session and then everyone is cross.' },
      { name: 'Gareth Lewis', body: 'I will try working beside him on my own thing, not watching his pencil. He writes worse when I stare. That one fits our table.' },
      { name: 'Noor Fatima', body: 'A timer they can see. I am always saying "five more minutes" and they do not believe me. A kitchen timer is honest.' },
      { name: 'Paul Nguyen', body: 'I will trial letting him mark his own sums with the answer sheet before I look. I usually grab the pen. He needs to see the mistake himself.' },
    ],
  },
  {
    vimeoId: '1239453111',
    title: 'Home Learning Preparation 6: Tools to consider',
    prompt: 'Which tools do you consider a strength of your home learning and which areas do you wish to explore further? Justify your points.',
    others: [
      { name: 'Rebecca Cole', body: 'The strength is a pencil pot and a folder for finished sheets. We are not losing pages any more. I want to get better at a simple weekly list, because I still keep the plan in my head and forget Thursday.' },
      { name: 'Tariq Mahmood', body: 'Number lines and the hundred square are working for maths. I want to look at something for spelling. Copying the word five times is not sticking for her.' },
      { name: 'Joanne Wright', body: 'We are good with books from the library. The weak bit is a quiet place to read them. The front room has the telly and I have not sorted a corner.' },
      { name: 'Idris Diallo', body: 'A whiteboard on the fridge is the tool that works. He will write a word there and not in the book. I want a way to get that word back onto the school sheet without a fight.' },
      { name: 'Chloe Bennett', body: 'Scissors, glue, and scrap paper are a strength when the task is making something. Worksheets are the area I want to handle better. We rush them.' },
    ],
  },
  {
    vimeoId: '1239453125',
    title: 'Home Learning Preparation 7: Technology to consider',
    prompt: 'How do you intend to use technology to support home learning? Write or record your response.',
    others: [
      { name: 'Farah Siddiqui', body: 'I will use the school site for the video the teacher recorded, and then close the laptop. My son will wander into games if I leave it open. The laptop stays in the kitchen, not his room.' },
      { name: 'Martin Ellis', body: 'One tablet for the reading app, a short sitting, then it goes on the shelf. I am not adding more apps. We already argue about YouTube.' },
      { name: 'Amina Yusuf', body: 'I record him reading on my phone so he can hear himself, then I delete it. He likes that more than me correcting him mid-sentence. No accounts, just the voice memo.' },
      { name: 'Stephen Ward', body: 'The oldest can type his story. The younger two stay on paper. I do not have three devices and I am not pretending I do.' },
      { name: 'Khadija Omar', body: 'I will put the class link on my phone and read the task out, so he is not scrolling the page. He gets lost in the menus.' },
    ],
  },
  {
    vimeoId: '1239453126',
    title: 'Home Learning Preparation 8: Rhythm and Flow',
    prompt: 'Explain the structure of your typical learning day; why have you structured it in the way you have? You may also wish to record a discussion between yourself and your child regarding this topic.',
    others: [
      { name: 'Lucy Hart', body: 'We do school work after a snack, then outside if it is not raining, then one more short sitting before lunch. I put the hard thing first because she is kinder in the morning.' },
      { name: 'Adam Nowak', body: 'Mornings are for the sheet the teacher set. After lunch is Lego and I do not call that a waste. If I fill the whole day he refuses tomorrow.' },
      { name: 'Yasmin Chowdhury', body: 'Breakfast, dressed, one lesson, a break with the football in the garden, then reading on the sofa. The break is in the middle or he will not come back.' },
      { name: 'Robert Kane', body: 'I work until two, so her day starts when I get in. We keep it to one block before dinner and reading in bed. A morning timetable would be a lie in this house.' },
      { name: 'Maryam Shah', body: 'Same order most days: a short reading, then maths, then whatever the school asked that is not maths. He knows the order, which matters more than the clock time.' },
    ],
  },
]

const HANDWRITTEN = new Set([
  ...WORKBOOK_FILMS.flatMap((film) => film.others.map((row) => keptAnswerKey(row.body))),
  ...BOOK_SWARM.flatMap((film) => film.others.map((row) => keptAnswerKey(row.body))),
])

export function isHandwrittenAnswer(body: string) {
  const key = keptAnswerKey(body)
  return Boolean(key) && HANDWRITTEN.has(key)
}

export function workbookParentEmail(name: string) {
  const local = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')
  return `${local}@hady.home`
}
