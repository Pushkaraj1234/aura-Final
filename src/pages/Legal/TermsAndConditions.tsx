import React from "react";
import { ContactDetails, LegalPage, type LegalSection } from "./LegalPage";
import { OPERATOR_NAME } from "./legalMeta";

const sections: LegalSection[] = [
  {
    id: "agreement",
    heading: "Agreeing to these terms",
    body: (
      <p>
        Creating an account or using AURA means accepting the terms on this page. If you do not
        accept them, do not create an account. Where these terms and the{" "}
        <a href="/privacy-policy" className="text-[#A85D2E] hover:text-[#8A4A20] underline">
          Privacy Policy
        </a>{" "}
        say different things about information, the Privacy Policy is the one that governs.
      </p>
    ),
  },
  {
    id: "what-aura-is",
    heading: "What AURA is, and what it is not",
    body: (
      <>
        <p>
          AURA records voluntary wellbeing check-ins, turns them into an indicator you can inspect,
          and puts that in front of a trained person who decides what to do. That is the whole of
          it.
        </p>
        <p>AURA is explicitly not:</p>
        <ul>
          <li>
            <strong>a diagnosis.</strong> Nothing here identifies a condition, and no number on this
            site is a clinical measurement;
          </li>
          <li>
            <strong>treatment or medical advice.</strong> It does not replace a doctor, a therapist
            or any medicine you have been prescribed;
          </li>
          <li>
            <strong>an emergency service.</strong> Nobody is watching this screen at three in the
            morning;
          </li>
          <li>
            <strong>a legal record.</strong> What you write here is not a complaint, a statement or
            evidence, and filing it here does not report anything to any authority.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "emergencies",
    heading: "In an emergency",
    body: (
      <p>
        If you or someone else is in immediate danger, do not use AURA. Use Emergency Help in the
        app for the helplines it lists, or contact your local emergency services directly. Messages
        to a counsellor are not monitored in real time and may not be read for some hours.
      </p>
    ),
  },
  {
    id: "who-can-use-it",
    heading: "Who can use AURA",
    body: (
      <>
        <p>
          Participant accounts are for adults. Counsellor accounts are created by application and are
          usable only after an administrator has checked the credentials submitted with them.
          Presenting yourself as a counsellor you are not is a serious matter, and an account found
          to have done so is removed.
        </p>
        <p>
          A guardian answering the five-question form does so by invitation, through a one-time link
          with no account attached.
        </p>
      </>
    ),
  },
  {
    id: "your-account",
    heading: "Your account",
    body: (
      <>
        <p>
          Keep your password to yourself, and tell us if you think someone else has it. Actions taken
          while signed in as you are treated as yours.
        </p>
        <p>
          The name you sign up with does not have to be your legal name, and the trusted contact is
          optional. Do not enter someone else&rsquo;s details without their agreement.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    heading: "How AURA may be used",
    body: (
      <>
        <p>Do not use AURA to:</p>
        <ul>
          <li>threaten, harass or abuse anyone, including a counsellor;</li>
          <li>
            impersonate another person, or create an account on someone else&rsquo;s behalf without
            their knowledge;
          </li>
          <li>
            submit someone else&rsquo;s private information, or details of a case that is not yours;
          </li>
          <li>
            attempt to reach records that are not yours, to interfere with the service, or to test
            its security without written permission;
          </li>
          <li>
            extract the content of the service in bulk, whether by hand or by an automated tool.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "counsellors",
    heading: "For counsellors and support workers",
    body: (
      <>
        <p>
          What you can see about a participant is there so you can support that person, and for no
          other purpose. Do not share it outside the care of that case.
        </p>
        <p>
          AURA raises signals; the judgement stays yours. An indicator is advisory, the screening of
          uploaded documents is advisory, and neither is a substitute for reading the case and
          speaking to the person. Administrator actions and case events are logged.
        </p>
        <p>
          Notes a participant wrote about leaving a counsellor are shown to that counsellor without
          the participant&rsquo;s name. Trying to work out who wrote one is a misuse of the service.
        </p>
      </>
    ),
  },
  {
    id: "reviews",
    heading: "Reviews and feedback",
    body: (
      <>
        <p>
          A review can be written about a counsellor you have actually had a session with. Reviews
          are checked before they appear, and one that names a person, carries contact details or
          sets out case details will not be published.
        </p>
        <p>
          Write about the support, not about the individual&rsquo;s private life. A review that is
          abusive, or that is untrue and damaging, is removed.
        </p>
      </>
    ),
  },
  {
    id: "your-words",
    heading: "What you write stays yours",
    body: (
      <p>
        Your reflections, messages, first aid kit and reviews remain yours. By putting them into
        AURA you allow it to store them, show them to the people described in the Privacy Policy, and
        process them in order to run the features you have turned on. They are not sold, and they are
        not used to advertise anything to you or to anybody else.
      </p>
    ),
  },
  {
    id: "availability",
    heading: "Availability, and the state of this software",
    body: (
      <>
        <p>
          AURA is a prototype under active development. Features change, screens move, and parts of
          it may be switched off. The public demonstration deployment is seeded with synthetic
          sample records and is not a production care system.
        </p>
        <p>
          The service is offered as it is, without a guarantee that it will be available, that it
          will keep your data indefinitely, or that a counsellor will respond within any particular
          time. Where the voice companion runs on a free hosting tier, the first connection after a
          quiet period can take about a minute.
        </p>
      </>
    ),
  },
  {
    id: "limits",
    heading: "Limits of responsibility",
    body: (
      <>
        <p>
          {OPERATOR_NAME} is responsible for running the service honestly and for handling your
          information as the Privacy Policy describes. It is not responsible for decisions you or
          anyone else takes on the strength of a number on this site, which is why the site shows you
          the reasoning behind every one of them.
        </p>
        <p>
          Nothing here limits any responsibility that cannot be limited by law, including
          responsibility for death or personal injury caused by negligence, or for fraud.
        </p>
      </>
    ),
  },
  {
    id: "ending",
    heading: "Ending your account",
    body: (
      <>
        <p>
          You can withdraw consent at any time, which stops check-ins and stops sharing with your
          counsellor. You can ask for your record to be erased, and that is done by hand. Leaving
          does not have to be explained and costs you nothing.
        </p>
        <p>
          An account may be suspended where it is being used to harm another person, to impersonate
          someone, or to attack the service.
        </p>
      </>
    ),
  },
  {
    id: "law",
    heading: "Governing law",
    body: (
      <p>
        These terms are governed by the laws of India, and disputes about them belong to the courts
        of India.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    body: (
      <p>
        These terms change as the service does, and the date at the top moves with them. A change
        that meaningfully affects what you may do, or what you can expect, is said plainly in the app
        rather than left here to be found.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: (
      <>
        <p>For a question about these terms, or to report a misuse of the service:</p>
        <ContactDetails />
      </>
    ),
  },
];

export const TermsAndConditions: React.FC = () => (
  <LegalPage
    title="Terms and Conditions"
    intro={
      <>
        <p>
          This page sets out what AURA offers, what it asks of you in return, and where its
          responsibility ends. It is written to be read rather than skipped, so it is short and says
          what it means.
        </p>
        <p className="text-sm text-[#8A7A6B]">
          This document is written in English. The language picker will translate it like any other
          screen, for convenience. Where a translation and the English differ, the English is the
          version that applies.
        </p>
      </>
    }
    sections={sections}
    sibling={{ href: "/privacy-policy", label: "Read the Privacy Policy" }}
  />
);
