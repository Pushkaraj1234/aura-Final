import React from "react";
import { ArrowLeft, ShieldCheck, Phone } from "lucide-react";
import { VoiceAssistant } from "../voice/components/VoiceAssistant";

interface Props {
  onBack: () => void;
  onOpenEmergency: () => void;
}

/**
 * The voice companion, given a page of its own inside AURA.
 *
 * The component below comes from Pushkaraj1234/voice_companion and is the
 * upstream one: connection, barge-in, safety handling and consent all still
 * belong to it. This file only puts it where someone can find it and frames
 * what it is — deliberately, so that pulling a newer version of the companion
 * stays a copy rather than a merge.
 *
 * It is offered to participants only, like the first-aid kit. It is also
 * separate from the text chatbot rather than a mode of it: someone who wants
 * to speak and someone who wants to type are usually in different states, and
 * a person in the middle of a hard moment should not have to find a toggle.
 */
export const VoiceCompanion: React.FC<Props> = ({ onBack, onOpenEmergency }) => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
    <button
      onClick={onBack}
      className="inline-flex items-center gap-2 text-sm font-bold text-[#5A5049] hover:text-[#3C3530] cursor-pointer"
    >
      <ArrowLeft size={16} />
      Back
    </button>

    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-[#3C3530]">Talk it through</h1>
      <p className="text-sm text-[#7A726C] mt-2 max-w-2xl">
        Speak instead of typing, in English, Hindi or Marathi. You can interrupt at any
        point, and you can stop whenever you want.
      </p>
    </div>

    {/* Said before the microphone is offered, not after: what this is, and what
        it is not. The companion's own consent step covers processing and
        storage; this covers the thing people most need to know. */}
    <div className="rounded-3xl border border-[#DBC3B2]/50 bg-[#FFF6EC] p-5 flex gap-4">
      <div className="w-10 h-10 rounded-2xl bg-[#DBC3B2]/40 text-[#8A5A2B] flex items-center justify-center shrink-0">
        <ShieldCheck size={17} />
      </div>
      <div className="space-y-2 text-xs text-[#7A726C] leading-relaxed">
        <p>
          <span className="font-bold text-[#3C3530]">This is not a person.</span> It will
          not pass a message to your counsellor and it does not add to your wellbeing
          score. Nothing you say here is read by staff.
        </p>
        <p>
          If you are in danger right now, this is not the fastest way to get help.
          <button
            onClick={onOpenEmergency}
            className="ml-1.5 inline-flex items-center gap-1 font-bold text-[#9A3B2F] hover:underline cursor-pointer align-baseline"
          >
            <Phone size={11} />
            Emergency help
          </button>
        </p>
      </div>
    </div>

    <div className="bg-white rounded-3xl border border-[#EFE8E2] p-5 sm:p-8 flex justify-center shadow-xs">
      <VoiceAssistant />
    </div>
  </div>
);
