# Gather

Gather is how Hady Core takes a talk off the phone and into the room. A portal admin or an imam plans the meeting. A learner can suggest one. People who are not on Hady Core yet can still say they are coming.

The name stays Gather. It is the ordinary word for meeting, and it sits next to the garden and the harvest without sounding like a campaign.

## What a gathering is

A circle after Isha, a tea and talk on a course, a food-bank run, a sisters’ walk, a youth football night, a family picnic. Each one has a title, a time in London, a place and a map link, a capacity, who it is for (brothers, sisters, families, youth, or everyone), what to bring, and a host. It can point at a door (W1 to W20), a course, a talk, or an activation task. The public line reads like “Discussing W7: Fasting Ramadan, after Class 20”.

Sisters’ and brothers’ titles default to that audience. The desk can still change it. A hors d’oeuvre or an appetiser still does not count toward a course. Showing up at a gathering that matches an activation task does.

## How it borrows from the research

Claims below are critic KEEP from the Community Activation set. The id is what the design used.

| What Gather does | Claim |
| --- | --- |
| Home and Gather show this masjid’s meetings first. The portal is the “set as my masjid”. | `religion-001` |
| A gathering is tied to a talk, a course, or a door, so the week’s learning and the meeting are the same thing. | `religion-002`, `religion-006` |
| Time, place, and a map link are on the card. | `religion-003` |
| WhatsApp is the share that people already use. The public page also shows the link preview. | `religion-004` |
| After a talk: “People from your masjid are meeting to talk about this on Thursday.” | `religion-006`, `apps-005` |
| RSVP is going, maybe, or can’t. Only “going” takes a seat. | `religion-parish-event-rsvp`, `apps-meetup-native-irl`, `apps-002` |
| A public page, no account. Name and phone or email is enough. | `apps-popin-zero-account-guest-rsvp`, `apps-hanghut-guest-web-gcash-qrph`, `apps-sokal-calendar-friends-free-rsvp`, `apps-radius-activity-timevote-guestrsvp` |
| One link for the event, plus a personal bring-a-friend link that records who brought whom. | `religion-sameteam-one-link-rsvp-roles`, `diet-friend-challenge-invite`, `cross-cold-vs-warm-discovery` |
| Copy for Meetup, Eventbrite, or Facebook, and an `.ics` file, so the desk can post where people already look. | `apps-luma-calendar-vs-partiful-invite`, `apps-engine-open-source-ownership`, `diet-003` |
| When it is full, the next person waits. If someone steps back, the earliest person on the list is offered the place. | `apps-whosin-waitlist-qr-door`, `sports-brunchie-waitlist-autoprime-stripe`, `religion-openmasjid-capacity-autoclose-stripe` |
| On the day, the host shows a QR. The learner scans it and checks in. The host can also mark someone who has no phone. A poster PDF can sit on the door. | `religion-masjid-checkin-instrument`, `religion-pco-volunteer-door-checkin`, `religion-gathrik-noapp-qr-absence`, `religion-masjidapp-volunteer-qr-hours`, `cross-attendance-instrument` |
| A family gathering is marked as such. The public page does not ask children to check in on their own. | `religion-subsplash-household-precheck-qr`, `religion-jumuah-wallet-qr-circles` |
| Optional circles of about four to six. Newcomers sit with regulars. Bands used for the mix are not shown, and no score is shown. | `apps-gist-rounds-then-microcohort`, `apps-offscreen-prematched-small-group`, `sports-squadbalance-anon-rate-fairteams`, `sports-nextgame-qr-feeblock-autobalance`, `sports-playq-offline-kiosk-sos-draw`, `sports-happyroster-auto-spare-cascade` |
| Discussion lines come from the linked talk’s questions. | `religion-006` |
| A short line afterwards (“One thing you’ll carry from tonight”) goes into the harvest and lights the garden. It is the receipt that the night happened. | `apps-plns-friends-expire-didhappen`, `apps-meetup-native-irl` |
| Attending completes a matching activation task. That answer counts toward the course. | `apps-005`, `sports-001` |
| The desk groups upcoming and past, then by door, and shows counts. Attendance over time, newcomers against regulars, who brought whom, and an export. | `cross-attendance-instrument`, `apps-003` |
| Newcomers who came for the first time can be sent a welcome from the desk. | `religion-clerkcat-firstvisitor-kiosk-mondaylist`, `religion-process-queue-to-group` |
| A guest who has RSVPed gets the portal’s learner access code already filled in. | `apps-friend-apps-group-plans`, `sports-003` |
| Learner proposals wait for the desk before anyone else sees them. | `apps-friend-apps-group-plans` |
| Photos only if the host ticks that everyone in the picture said yes, and only inside the portal. | `apps-thirdspace-sidequest-2min-photo` (the photo is a keepsake, not proof) |

## What Gather does not take

- No GPS fence, no fines, and no “you were here for twenty minutes” proof. `sports-geotend-geofence-fines` and `diet-gymstake-pact-gps20-stake` treat location as a penalty. A phone can lie about where it is, and a masjid door does not need that.
- No fee to hold a place. NextGame, Brunchie, and OpenMasjid block unpaid players or take Stripe. Gather’s waitlist is only about seats.
- No Wallet pass. `religion-jumuah-wallet-qr-circles` is used for the family circle and the door QR, not for Apple or Google Wallet.
- No AI reading a group photo to mark attendance. `religion-flock-photo-attendance-atrisk` is the opposite of a host who asks first. Photos stay behind the consent tick.
- No public full names. First names, or a first name and an initial when two people share a first name. The desk still sees the name it needs for a welcome.

## Demo

`npm run demo:gather` writes six upcoming and eight past gatherings on the portal whose slug is `hearts-demo`, and only there. It uses `demo-learner@hearts.foundation` and `demo-complete@hearts.foundation` when those accounts already belong to that portal. It also keeps six bringer accounts on that portal, each bringing a different newcomer. It does not create the portal. A second run finds the same seed keys and does not add another copy.
