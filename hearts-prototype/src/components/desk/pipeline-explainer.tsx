/** Plain-English notes on what happens to a talk after it comes in. Only steps this desk really does. */

const BRING_IN_STEPS: { name: string; line: string }[] = [
  { name: '1. Add video', line: 'Paste a YouTube or Vimeo link, a playlist or a channel. Each tick becomes a draft talk with a title, a speaker and a course. Google Drive links are not taken here.' },
  { name: '2. Store', line: 'The film itself is not downloaded. The desk keeps the link and plays the film from YouTube or Vimeo.' },
  { name: '3. Transcript', line: 'The desk fetches the caption track. It tries yt-dlp, then the captions on the YouTube page, then the caption helper on a home computer. It does not transcribe the audio. If all three fail, upload a .vtt, .srt or .txt file on the talk.' },
  { name: '4. Checks', line: 'Talks with no transcript, no timings or under 5 minutes are marked so you can see them on the Transcripts page.' },
  { name: '5. Clips and extraction', line: 'The AI steps draft the short clip, the hook, turn and land, the pop-up questions, and the Qur’an and hadith quotes. Each draft is marked as needing a human check.' },
  { name: '6. Review', line: 'Nothing reaches learners until someone approves the draft on Review. Approved talks show in the library straight away. There is no drip schedule.' },
]

export function BringInExplainer() {
  return (
    <section className="panel pipeline-explainer" data-testid="bring-in-explainer" style={{ marginBottom: 18 }}>
      <header className="light"><h2>What this page does</h2></header>
      <div className="body">
        <p>Bring in turns a link into a draft talk. These are the steps, in order.</p>
        <ol className="pipeline-steps">
          {BRING_IN_STEPS.map((step) => <li key={step.name}><b>{step.name}</b> {step.line}</li>)}
        </ol>
        <AiNote />
      </div>
    </section>
  )
}

export function AiStepsExplainer() {
  return (
    <section className="panel pipeline-explainer" data-testid="ai-steps-explainer" style={{ marginBottom: 18 }}>
      <header className="light"><h2>What this page does</h2></header>
      <div className="body">
        <p>Each row is one job that runs on a talk after Bring in has its transcript. They run top to bottom. A step marked Shared text is a checklist other steps read, not a job.</p>
        <ol className="pipeline-steps">
          <li><b>Open a step</b> to read what it does and the instructions it follows.</li>
          <li><b>Try it on one talk</b> to see the draft it makes before you change anything.</li>
          <li><b>Mark a version live</b> to make new talks use it. Older versions stay, so you can go back.</li>
          <li><b>Each talk</b> shows every job for one talk. From there, send the draft to Review.</li>
        </ol>
        <p>Every draft goes to Review. Learners see nothing until a person approves it.</p>
        <AiNote />
      </div>
    </section>
  )
}

function AiNote() {
  return (
    <p className="pipeline-ai-note" data-testid="pipeline-ai-note">
      <b>About AI.</b> On the live site no AI key is set, so these drafts come from built-in rules only and nothing is paid for. If an Anthropic or OpenAI key is added to the site settings, the same steps also ask that model for suggestions, which are checked against the transcript.
    </p>
  )
}
