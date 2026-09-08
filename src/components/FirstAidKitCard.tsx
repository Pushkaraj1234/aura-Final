import React, { useState } from "react";
import { HeartPulse, Pencil, Plus, X, Lock, Eye } from "lucide-react";
import { FirstAidKit, User } from "../types";
import { FIRST_AID_PROMPTS, hasKit, itemsIn, kitItemCount } from "../services/firstAidKit";
import { FirstAidKitEditor } from "./FirstAidKitEditor";

interface Props {
  user: User;
  onSave: (kit: FirstAidKit) => void;
}

/**
 * The kit as it appears on the wellbeing board.
 *
 * Reading comes first and editing second, because the moment this matters is
 * the moment someone opens the app already struggling. In that state the kit
 * has to be legible at a glance, with nothing to click before the content
 * appears — so entries are shown outright rather than behind an accordion,
 * and the editor is a deliberate secondary action.
 */
export const FirstAidKitCard: React.FC<Props> = ({ user, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FirstAidKit | undefined>(user.firstAidKit);

  // Participants only. The board is a participant screen, but this is the most
  // personal thing the app stores, so the guard is stated here too rather than
  // relying on where the component happens to be mounted.
  if (user.role !== "participant") return null;

  const kit = user.firstAidKit;
  const filled = hasKit(kit);

  const openEditor = () => {
    setDraft(user.firstAidKit);
    setEditing(true);
  };

  const save = () => {
    if (draft) onSave(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EFE8E2] shadow-xs space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center gap-1.5">
              <HeartPulse size={14} className="text-[#A55D25]" />
              <span>Your first aid</span>
            </span>
            <h3 className="text-xl font-bold text-[#3C3530]">What helps you</h3>
          </div>
          <button
            type="button"
            onClick={() => setEditing(false)}
            aria-label="Close without saving"
            className="shrink-0 p-2 -m-2 rounded-full text-[#7F8C8D] hover:text-[#3C3530] hover:bg-[#FDF9F5] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <FirstAidKitEditor kit={draft} onChange={setDraft} />

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={save}
            className="flex-1 py-3 rounded-xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#3F4E4E] transition-colors cursor-pointer"
          >
            Save my kit
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="sm:w-auto py-3 px-5 rounded-xl border border-[#EFE8E2] text-[#5A5049] font-bold text-sm hover:bg-[#FDF9F5] transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!filled) {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EFE8E2] shadow-xs space-y-4">
        <div className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center gap-1.5">
            <HeartPulse size={14} className="text-[#A55D25]" />
            <span>Your first aid</span>
          </span>
          <h3 className="text-xl font-bold text-[#3C3530]">Make your own first aid kit</h3>
        </div>
        <p className="text-sm text-[#7A726C] leading-relaxed max-w-xl">
          A short list of the things that help <em>you</em> — your song, the place you go, the person you would
          message. Written now, while it is easier to think, so a harder day does not have to.
        </p>
        <button
          type="button"
          onClick={openEditor}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#3F4E4E] transition-colors cursor-pointer"
        >
          <Plus size={16} />
          <span>Start my kit</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EFE8E2] shadow-xs space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center gap-1.5">
            <HeartPulse size={14} className="text-[#A55D25]" />
            <span>Your first aid</span>
          </span>
          <h3 className="text-xl font-bold text-[#3C3530]">What helps you</h3>
          <p className="text-xs text-[#7F8C8D]">
            {kitItemCount(kit)} {kitItemCount(kit) === 1 ? "thing" : "things"} you wrote for yourself.
          </p>
        </div>
        <button
          type="button"
          onClick={openEditor}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#EFE8E2] text-xs font-bold text-[#5A5049] hover:border-[#DBC3B2] hover:text-[#3C3530] transition-colors cursor-pointer"
        >
          <Pencil size={13} />
          <span>Edit</span>
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {FIRST_AID_PROMPTS.map((prompt) => {
          const items = itemsIn(kit, prompt.category);
          if (!items.length) return null;
          return (
            <div key={prompt.category} className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#A99A8A]">{prompt.label}</p>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.id} className="text-sm text-[#3C3530] leading-snug break-words">
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-[#7F8C8D] flex items-center gap-1.5 pt-1 border-t border-[#EFE8E2]">
        {kit?.shareWithWorker ? (
          <>
            <Eye size={12} className="text-[#5A5049]" />
            <span>Your counsellor can see this kit. You can turn that off when you edit it.</span>
          </>
        ) : (
          <>
            <Lock size={12} className="text-[#5A5049]" />
            <span>Private to you. Nobody else can see this.</span>
          </>
        )}
      </p>
    </div>
  );
};
