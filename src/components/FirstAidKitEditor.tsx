import React, { useState } from "react";
import { Plus, X, Lock, Check, HeartPulse } from "lucide-react";
import { FirstAidCategory, FirstAidKit } from "../types";
import {
  FIRST_AID_PROMPTS,
  MAX_ITEMS_PER_CATEGORY,
  MAX_ITEM_LENGTH,
  addItem,
  itemsIn,
  kitItemCount,
  removeItem,
  setSharing,
} from "../services/firstAidKit";

interface Props {
  kit: FirstAidKit | undefined;
  onChange: (next: FirstAidKit) => void;
  /** Hides the sharing control where it would be premature (during sign-up). */
  showSharing?: boolean;
  /** Trims the intro when the surrounding screen has already explained it. */
  compact?: boolean;
}

/**
 * Builds a participant's own first-aid kit, one prompt at a time.
 *
 * Every field is optional and there is no completion state to reach — a kit
 * with one line in it is a real kit. Nothing here is validated against a
 * "correct" answer, because there isn't one: the only thing that makes an
 * entry good is that it belongs to the person who wrote it.
 */
export const FirstAidKitEditor: React.FC<Props> = ({
  kit,
  onChange,
  showSharing = true,
  compact = false,
}) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const commit = (category: FirstAidCategory) => {
    const text = (drafts[category] || "").trim();
    if (!text) return;
    onChange(addItem(kit, category, text));
    setDrafts((d) => ({ ...d, [category]: "" }));
  };

  const total = kitItemCount(kit);

  return (
    <div className="space-y-5">
      {!compact && (
        <div className="space-y-2">
          <p className="text-sm text-[#5A5049] leading-relaxed">
            These are your things, not ours — a song you want to hear, a place you go, the person you would
            message. You are writing them now so that a harder day does not have to think of them.
          </p>
          <p className="text-xs text-[#7F8C8D] leading-relaxed">
            Add as much or as little as you want. One line is enough, everything is optional, and you can change
            any of it whenever you like.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {FIRST_AID_PROMPTS.map((prompt) => {
          const items = itemsIn(kit, prompt.category);
          const full = items.length >= MAX_ITEMS_PER_CATEGORY;

          return (
            <div
              key={prompt.category}
              className="rounded-2xl border border-[#EFE8E2] bg-[#FDF9F5] p-4 space-y-3"
            >
              <div className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <h4 className="text-sm font-bold text-[#3C3530]">{prompt.label}</h4>
                  {items.length > 0 && (
                    <span className="text-[10px] font-mono text-[#A99A8A] shrink-0">
                      {items.length}/{MAX_ITEMS_PER_CATEGORY}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#5A5049]">{prompt.question}</p>
                <p className="text-[11px] text-[#7F8C8D] italic">{prompt.why}</p>
              </div>

              {items.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="group inline-flex items-start gap-1.5 max-w-full bg-white border border-[#EFE8E2] rounded-xl pl-3 pr-2 py-1.5"
                    >
                      <span data-no-translate className="text-xs text-[#3C3530] break-words min-w-0">
                        {item.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => onChange(removeItem(kit, item.id))}
                        aria-label={`Remove "${item.text}"`}
                        className="shrink-0 mt-0.5 text-[#A99A8A] hover:text-[#A55D25] transition-colors cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {full ? (
                <p className="text-[11px] text-[#7F8C8D]">
                  That is plenty for this one — remove something above if you want to swap it.
                </p>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={drafts[prompt.category] || ""}
                    maxLength={MAX_ITEM_LENGTH}
                    placeholder={prompt.placeholder}
                    onChange={(e) => setDrafts((d) => ({ ...d, [prompt.category]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commit(prompt.category);
                      }
                    }}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-[#EFE8E2] bg-white text-sm text-[#3C3530] placeholder:text-[#B9B0A6] focus:outline-none focus:ring-2 focus:ring-[#DBC3B2]"
                  />
                  <button
                    type="button"
                    onClick={() => commit(prompt.category)}
                    disabled={!(drafts[prompt.category] || "").trim()}
                    aria-label={`Add to ${prompt.label}`}
                    className="shrink-0 px-3.5 rounded-xl bg-[#3C3530] text-white hover:bg-[#3F4E4E] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showSharing && (
        <div className="rounded-2xl border border-[#EFE8E2] bg-white p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <Lock size={15} className="text-[#5A5049] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-[#3C3530]">This is private</p>
              <p className="text-xs text-[#7A726C] leading-relaxed">
                Only you can see your kit. Your counsellor cannot, unless you decide otherwise below — and you can
                change that back at any time.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChange(setSharing(kit, !kit?.shareWithWorker))}
            aria-pressed={!!kit?.shareWithWorker}
            className={`w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left transition-colors cursor-pointer ${
              kit?.shareWithWorker
                ? "bg-[#3C3530] border-[#3C3530] text-white"
                : "bg-[#FDF9F5] border-[#EFE8E2] text-[#5A5049] hover:border-[#DBC3B2]"
            }`}
          >
            <span
              className={`w-4 h-4 rounded shrink-0 border flex items-center justify-center ${
                kit?.shareWithWorker ? "bg-white border-white" : "border-[#DBC3B2]"
              }`}
            >
              {kit?.shareWithWorker && <Check size={11} className="text-[#3C3530]" />}
            </span>
            <span className="text-xs font-bold">
              Let my counsellor see my kit, so they can help me use it
            </span>
          </button>
        </div>
      )}

      <div className="flex items-start gap-2 text-[11px] text-[#7F8C8D] leading-relaxed">
        <HeartPulse size={13} className="text-[#A55D25] shrink-0 mt-0.5" />
        <p>
          A kit is for the hard hours, not for emergencies. If you are in danger or thinking of hurting yourself,
          use Emergency Help instead — that reaches a person.
        </p>
      </div>

      {total > 0 && (
        <p className="text-[11px] text-[#7F8C8D] text-center">
          {total} {total === 1 ? "thing" : "things"} in your kit. Saved as you go.
        </p>
      )}
    </div>
  );
};
