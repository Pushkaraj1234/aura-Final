# Threat model

Written because the systematic review of AI mental-health monitoring for
atrocity victims (September 2026) names its absence as gap G14, and because a
safety feature whose limits are not written down is a safety feature that will
be over-trusted.

The short version: AURA now defends against someone picking up the phone. It
does not defend against someone examining the phone, and it must never be
described as though it does.

## Who this is protecting people from

Every digital-phenotyping system in the published literature assumes the person
using it controls the device. For AURA's users that is frequently false. The
review states the consequence plainly: "naive deployment could endanger
participants."

**Adversary 1: a household or community member with casual access.**
A husband, in-law, or neighbour who picks up an unlocked phone and looks
through it. No technical skill, minutes of access, not specifically searching.
This is the common case and it is the one AURA now addresses.

**Adversary 2: someone who walks in.**
A person entering the room while a survivor is mid-check-in. Seconds matter,
and what is on screen is the disclosure.

**Adversary 3: a determined examiner.**
Someone with the phone for an extended period, willing to use developer tools,
recovery software, or installed monitoring. **AURA does not defend against
this and cannot.** A web application has no answer to a compromised device.

**Adversary 4: institutional misuse.**
A request to use risk scores for case assessment, benefit eligibility, or
policing. Addressed by policy below, not by code.

## What is implemented

**Quick exit.** A small control on every participant screen, plus three
presses of Escape inside two seconds. It clears all AURA web storage
synchronously, attempts sign-out without waiting longer than 1.2 seconds, and
replaces the current history entry with an ordinary search page. The wipe runs
first so it survives every failure after it. See `src/services/safetyExit.ts`.

**Sign-out now means sign-out.** `authService.logout()` previously removed the
session token and nothing else, leaving `aura_participants_v2` holding every
check-in, note and alert in plain localStorage indefinitely. On a shared phone
that meant the next person to open the browser could read a survivor's full
history without signing in as anybody. Logout now clears everything AURA wrote.

**The exit control does not look like an exit control.** It reads as a close
button. A large red "ESCAPE" banner is itself a disclosure: it tells anyone
glancing at the phone that this is an app someone needed to hide from them.

**No confirmation dialog.** Asking "are you sure?" while the person someone is
afraid of crosses the room is worse than useless. The cost of an accidental
press is one sign-in.

**No lock-screen leakage.** AURA does not use the Web Notifications API and
does not modify `document.title`, so nothing about a person's state appears
outside the tab. This is a property to preserve, not a feature that was built:
adding push notifications later would break it.

**Nothing personal in the offline cache.** The service worker refuses `/api`,
Supabase and the voice backend outright, so no participant data reaches the
HTTP cache. See `public/sw.js`.

## What is not implemented, and why

**Full history clearing.** JavaScript cannot remove history entries before the
current one. `location.replace` overwrites the entry being left, so Back does
not return to AURA, but a sufficiently curious person can still reach earlier
entries. There is no web API that fixes this.

**A decoy or PIN-gated interface.** Deliberately deferred. A decoy view that is
wrong in any detail is worse than none, because it teaches a survivor to trust
something that will expose them. This needs design work with survivors before
it is worth building.

**Duress-triggered wipe.** Same reasoning. A second PIN that wipes is only
useful if the person can reach it under observation, which is a question about
the actual situations people are in, not about code.

**Encrypted local storage at rest.** Any key the browser can read, an examiner
can read. It would raise the bar against Adversary 1 slightly while creating a
misleading impression of protection against Adversary 3.

**The encrypted offline queue is not wiped on quick exit.** It holds check-ins
written without a connection that have not reached the server. It is not
readable by looking at the phone, and discarding it would silently destroy
something a person wrote and believed they had submitted.

## Policy commitments

These are commitments about conduct, not properties of the software. They are
written here so that breaking one is visible.

1. **Risk scores are never disclosed administratively.** Not to police, not to
   courts, not to benefit or compensation assessors, not to employers. A
   distress score is a prompt for a counsellor to make contact. Used as
   evidence about a complainant it becomes a way to discredit them.
2. **The system is not used for case assessment or eligibility.** AURA does not
   evaluate whether an atrocity occurred, and no output of it may inform that
   question.
3. **Requests to repurpose the system for surveillance are refused**, and the
   refusal is recorded.
4. **A participant may be monitored without being contacted**, and may pause
   entirely, without losing access to support.
5. **Staff access is scoped and logged.** Every staff read of participant data
   passes through row-level security and writes an audit row.

## Known gaps in the current implementation

Recorded rather than hidden.

- Any authenticated staff account can read every participant record. The review
  asks for independent access control and per-caseload scoping; RLS enforces
  staff-versus-participant, not counsellor-versus-counsellor.
- There is no Data Protection Impact Assessment, and no analysis against
  India's Digital Personal Data Protection Act 2023. Data residency is
  satisfied incidentally: the Supabase project is in `ap-south-1`.
- Withdrawal of consent marks the consent record revoked. It does not delete
  historical check-ins, and the review's standard for erasure is model
  unlearning rather than record deletion. The consent screen should not claim
  more than this.
- No independent ethics oversight body exists for this project, with or
  without survivor membership.
