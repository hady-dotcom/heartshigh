'use client'

import { HelpTip } from '@/components/help-tip'

const LEARNER: Record<string, string> = {
  settings:
    'This is your account: the password, the email we write to, and whether we may email you. Only you see this page. Changes take effect as soon as you save them.',
  confirm:
    'This page finishes confirming that an email address is yours. Anyone with the link from that inbox can use it. After it works, the reminder on Home goes away.',
  loginCode:
    'This is the second step after your password. Only people with the app on your phone, or a backup code, can pass it. A backup code works once.',
  loginSetup:
    'This turns on two-step sign-in. Scan the picture with an authenticator app, then type the code it shows. We show backup codes once; keep them somewhere safe.',
  changePassword:
    'Choose a new password while you are signed in. Use one that is not shared. After it saves, other devices are signed out.',
  deleteAccount:
    'This asks us to delete your account in 14 days. Your reflections go; anonymous counts stay. Signing in before then cancels the request.',
  downloadData:
    'This gathers a copy of what we hold about you: answers, plans, and your uploads. The file is for you. You can ask once a day.',
  notifications:
    'Choose whether each kind of note stays in the app, also comes by email, or is off. Quiet at night pauses emails from 22:00 to 07:00 in your portal’s time zone.',
  confirmNeeded:
    'Your portal asks people to confirm their email before they go further. Check your inbox, or send the link again. You can still sign out.',
}

export function PageHelp({ topic, label }: { topic: keyof typeof LEARNER | string; label?: string }) {
  const text = LEARNER[topic]
  if (!text) return null
  return (
    <HelpTip topic={topic} label={label || 'What is this?'}>
      {text}
    </HelpTip>
  )
}

export const LEARNER_HELP = LEARNER
