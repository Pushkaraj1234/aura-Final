import React from "react";
import { ContactDetails, LegalPage, type LegalSection } from "./LegalPage";

const sections: LegalSection[] = [
  {
    id: "scope",
    heading: "What this policy covers",
    body: (
      <>
        <p>
          This policy covers the AURA web application: the participant experience, the counsellor
          dashboard, the guardian questionnaire and the administrator console at <code>/admin</code>.
          It describes the software as it is actually built. Where something is a limit of the
          current pilot rather than a promise, this page says so.
        </p>
        <p>
          AURA is a prototype built for the Smart India Hackathon. The public demonstration
          deployment is seeded with synthetic sample records that do not belong to real people.
          Anything you enter yourself is real, and everything below applies to it.
        </p>
      </>
    ),
  },
  {
    id: "what-you-enter",
    heading: "What you enter yourself",
    body: (
      <>
        <p>When you create a participant account, AURA asks for:</p>
        <ul>
          <li>a name to greet you by, which does not have to be your legal name;</li>
          <li>an email address and a password, so you can sign back in;</li>
          <li>your preferred language;</li>
          <li>an age band rather than a date of birth;</li>
          <li>whether you would rather have in-app support or a human counsellor;</li>
          <li>
            optionally, a complaint or case reference, and optionally the name and number of one
            person you trust. Both can be left blank, and the form says so.
          </li>
        </ul>
        <p>After that, you add things only when you choose to:</p>
        <ul>
          <li>answers to a wellbeing check-in, any question of which can be skipped;</li>
          <li>written reflections, and spoken ones if you use voice;</li>
          <li>messages to your counsellor;</li>
          <li>a first aid kit of what helps you, which is yours alone unless you share it;</li>
          <li>
            a review of a counsellor you have had a session with, and a private note about why you
            left one.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "recorded-as-you-use-it",
    heading: "What the app records as you use it",
    body: (
      <>
        <p>
          A check-in records how long you spend on a question, whether you go back and change an
          answer, and whether you leave partway through. This is used for one purpose: to tell a
          counsellor that a check-in may be worth a second look.
        </p>
        <p>
          <strong>These signals never move your distress score.</strong> The score is worked out
          from your answers alone, by fixed weights you can open and read on your own results page.
        </p>
        <p>
          How often you check in is also read, so that someone who quietly stops answering is not
          simply lost. It is measured against your own past pattern, not a fixed schedule.
        </p>
      </>
    ),
  },
  {
    id: "voice",
    heading: "Voice reflections and the voice companion",
    body: (
      <>
        <p>
          When you record a spoken reflection, the recording is analysed in your browser. The audio
          itself stays on your device and is never uploaded. What is sent for analysis is the
          transcript and a small set of numbers describing delivery: pitch variability, speaking
          pace, how much of the recording was pause, and loudness. No keyword scanning is involved.
        </p>
        <p>
          The voice companion, where it is switched on, is a live conversation. Your speech is sent
          to a separate voice service run for AURA, which passes it to Google&rsquo;s Gemini model to
          produce a reply. That service is hosted apart from the rest of AURA because a conversation
          holds a connection open for its whole length. You can mute your microphone at any point
          without ending the conversation, and nothing is sent while you are muted. A transcript is
          kept only if you have asked for it to be.
        </p>
      </>
    ),
  },
  {
    id: "who-sees-what",
    heading: "Who can see what",
    body: (
      <>
        <ul>
          <li>
            <strong>You</strong> can see everything on your own record, including the arithmetic
            behind every score.
          </li>
          <li>
            <strong>Your counsellor</strong> sees your check-ins, your scores and the reasoning
            behind them, your messages, and anything you have chosen to share. They do not see your
            first aid kit unless you turn that on, and they do not see your password.
          </li>
          <li>
            <strong>Other people using AURA</strong> see nothing of yours, with one exception: a
            review you write about a counsellor is public once it has been checked, and it is never
            shown with your name.
          </li>
          <li>
            <strong>A counsellor you leave</strong> is shown the note you wrote about why, so they
            can learn from it. They are not shown your name and not shown the day you wrote it.
          </li>
          <li>
            <strong>Administrators</strong> can reach every record in the database in order to run
            the service, approve counsellors and investigate problems. Administrator actions are
            written to an audit log.
          </li>
          <li>
            <strong>A person you name as a guardian</strong> is sent a one-time link to answer five
            questions about what they have noticed. The link expires after fourteen days, works
            once, and does not name you. Their answers go to your counsellor.
          </li>
        </ul>
        <p>
          These rules are enforced in the database itself, row by row, not only in the screens that
          display them.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    heading: "Where AI is used, and what it may not do",
    body: (
      <>
        <p>
          Anything you write or say is read by Google&rsquo;s Gemini model to produce a summary and a
          view on tone. The questionnaire itself is scored by fixed rules, not by a model. The AI may
          move that total by at most fifteen points in either direction, and when it tries to move it
          further it is held at the limit and your counsellor is told the two readings disagree.
        </p>
        <p>
          AURA does not diagnose anything, and no decision about your care is taken automatically. A
          raised signal puts a case in front of a person. Nothing is escalated, and no authority is
          contacted, without a human deciding to.
        </p>
      </>
    ),
  },
  {
    id: "translation",
    heading: "Translation",
    body: (
      <>
        <p>
          The interface can be translated into the scheduled Indian languages through Bhashini, the
          Government of India&rsquo;s translation service. Only interface text is sent: labels,
          headings, buttons and help text.
        </p>
        <p>
          <strong>
            Your own words are never sent to a translation service.
          </strong>{" "}
          Reflections, voice transcripts, messages, counsellor notes, first aid kit entries and
          names are all marked in the page as text that must not be translated, and they stay as you
          wrote them.
        </p>
      </>
    ),
  },
  {
    id: "processors",
    heading: "Where your information is kept, and who else handles it",
    body: (
      <>
        <p>AURA is not self-contained. These are the services it relies on:</p>
        <ul>
          <li>
            <strong>Supabase</strong> hosts the database and handles sign-in. Your record lives
            here.
          </li>
          <li>
            <strong>Vercel</strong> serves the website and runs the server-side routes.
          </li>
          <li>
            <strong>Google Gemini</strong> receives reflections, transcripts and check-in answers in
            order to produce the AI summary, and receives your speech during a voice conversation.
          </li>
          <li>
            <strong>Bhashini</strong> receives interface text for translation, and nothing you
            wrote.
          </li>
          <li>
            <strong>Render</strong> hosts the separate voice service, where the voice companion is
            switched on.
          </li>
          <li>
            <strong>An email provider</strong> is used to send counsellors their approval,
            password and daily escalation notices. Participants are not emailed.
          </li>
        </ul>
        <p>
          Each of these is a company with its own terms and its own locations. AURA sends them the
          least it can in order to work, but once information reaches them it is also governed by
          what they do with it.
        </p>
      </>
    ),
  },
  {
    id: "not-collected",
    heading: "What AURA does not collect",
    body: (
      <>
        <ul>
          <li>
            <strong>Location.</strong> AURA never asks your device where you are and stores no
            location history. The regional figures on the community screen are published statistics
            for broad areas and are not derived from any individual.
          </li>
          <li>
            <strong>Your keystrokes, camera or microphone in the background.</strong> The microphone
            is used only while you are recording or in a voice conversation, and only after you
            allow it.
          </li>
          <li>
            <strong>Advertising and analytics trackers.</strong> There are none. No third-party
            analytics script runs on this site, and nothing you do here is used to target
            advertising.
          </li>
          <li>
            <strong>Your contacts.</strong> The one trusted contact you may name is typed in by you
            and is optional.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "retention",
    heading: "How long things are kept",
    body: (
      <>
        <p>
          Your record is kept for as long as your account exists, so that a trajectory over months
          means something. There is no automatic deletion timer today, and this page will not
          pretend otherwise.
        </p>
        <p>
          Withdrawing consent stops new collection and stops sharing with your counsellor. It does
          not by itself erase what is already there. If you want your record erased, ask, and it is
          done by hand. Guardian links expire after fourteen days whether or not they are used.
        </p>
      </>
    ),
  },
  {
    id: "your-controls",
    heading: "What you can change or take with you",
    body: (
      <>
        <ul>
          <li>
            <strong>Consent and privacy preferences</strong> let you turn off check-ins, sharing
            with your counsellor, free-text sharing, the voice feature and inclusion in aggregate
            figures, one by one, or withdraw from all of it at once.
          </li>
          <li>
            <strong>Download My Data</strong> on your profile produces a readable copy of your
            account, your check-ins and your follow-ups, and the same thing again as a raw JSON
            file.
          </li>
          <li>
            <strong>Reset My Check-in Data</strong> clears the check-in history the app holds on the
            device you are using. It does not reach the copy on the server, which is removed by
            asking.
          </li>
          <li>
            <strong>Change counsellor</strong> at any time, for any reason, without explaining
            yourself.
          </li>
          <li>
            <strong>Your first aid kit</strong> is private by default, and you can change that back
            after sharing it.
          </li>
          <li>
            <strong>Skip anything.</strong> Every check-in question can be left unanswered, and
            leaving one blank is not treated as a signal.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "emergencies",
    heading: "Emergencies, and the limits of privacy",
    body: (
      <>
        <p>
          If an answer indicates an immediate risk to your safety, that is shown to your counsellor
          straight away and is recorded. The service is not monitored around the clock, and messages
          here are not watched in real time.
        </p>
        <p>
          If you are in danger now, use Emergency Help in the app or contact your local emergency
          services directly. Those routes reach a person; AURA does not.
        </p>
      </>
    ),
  },
  {
    id: "age",
    heading: "Age",
    body: (
      <p>
        AURA is built for adults and is not intended for children. The sign-up form offers no age
        band below eighteen. If you become aware that a child has created an account, tell us and
        the record will be removed.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <p>
        When what AURA does with your information changes, this page changes with it and the date at
        the top moves. Changes that widen what is collected or who can see it will be said plainly in
        the app, not left here to be found.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: (
      <>
        <p>
          For a question about this policy, a correction to your record, or a request to have it
          erased:
        </p>
        <ContactDetails />
      </>
    ),
  },
];

export const PrivacyPolicy: React.FC = () => (
  <LegalPage
    title="Privacy Policy"
    intro={
      <>
        <p>
          People come to AURA after serious harm, often at a point where being recorded has already
          gone badly for them once. That is the reason this page is specific rather than general: it
          names what is collected, who can read it, and which companies it passes through.
        </p>
        <p className="text-sm text-[#8A7A6B]">
          This document is written in English. The language picker will translate it like any other
          screen, for convenience. Where a translation and the English differ, the English is the
          version that applies.
        </p>
      </>
    }
    sections={sections}
    sibling={{ href: "/terms", label: "Read the Terms and Conditions" }}
  />
);
