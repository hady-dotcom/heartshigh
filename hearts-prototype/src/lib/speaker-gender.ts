/** Gender the writer claims in a Book Summaries answer. Other people's parents do not count. */

const WOMAN = [
  /\bmy husband\b/i,
  /the good mother, which for me/i,
  /slow means mum/i,
  /\ba good mother\b/i,
  /a mother who heard the sentence/i,
  /a mother who pretended/i,
  /\bi am his mother\b/i,
  /different sort of mother/i,
  /his father and i/i,
  /perceive myself as a mother/i,
  /\bbad mother\b/i,
  /sort of mother i am/i,
  /a mother who, when frightened/i,
  /she has a mother who narrates/i,
  /his dad does the chairs/i,
  /eat with their dad at five/i,
  /filed under worry/i,
]

const MAN = [
  /the father who does not raise/i,
  /\ba good father\b/i,
  /a father every night/i,
  /\bi am his father\b/i,
  /careful father/i,
  /my son's mother/i,
  /his father to stop/i,
  /\bto my wife\b/i,
  /\bas his father\b/i,
  /being a good father/i,
  /modern father/i,
  /white father/i,
  /better father/i,
  /arrive as a father/i,
  /reporting him to his mother/i,
  /said it to his mother/i,
  /his mother and i/i,
]

export function speakerGender(body: string): 'woman' | 'man' | null {
  const woman = WOMAN.some((pattern) => pattern.test(body))
  const man = MAN.some((pattern) => pattern.test(body))
  if (woman && man) throw new Error('An answer claims both a mother and a father.')
  if (woman) return 'woman'
  if (man) return 'man'
  return null
}
