import React from "react";
import { Star, Globe, Video, Mic, MessageSquare, CheckCircle2, Clock } from "lucide-react";
import { CounsellorDirectoryEntry, MatchReason, SessionFormat } from "../types";

const FORMAT_ICON: Record<SessionFormat, React.ElementType> = {
  video: Video,
  audio: Mic,
  chat: MessageSquare,
};

interface Props {
  counsellor: CounsellorDirectoryEntry;
  reasons?: MatchReason[];
  isCurrent?: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
  busy?: boolean;
}

/**
 * One counsellor in the directory.
 *
 * The rating is shown only when the directory sends one, and the directory
 * withholds it below five published reviews. So "no rating yet" here means
 * genuinely not enough reviews to show safely, not a counsellor nobody likes —
 * which is why it is worded as a plain fact rather than an empty star row.
 */
export const CounsellorCard: React.FC<Props> = ({
  counsellor,
  reasons,
  isCurrent,
  onSelect,
  onOpen,
  busy,
}) => {
  const initials = counsellor.displayName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="bg-white rounded-3xl border border-[#EFE8E2] p-5 sm:p-6 shadow-xs flex flex-col gap-4">
      <div className="flex items-start gap-4">
        {counsellor.photoUrl ? (
          <img
            src={counsellor.photoUrl}
            alt=""
            className="w-14 h-14 rounded-2xl object-cover shrink-0 bg-[#EFE8E2]"
          />
        ) : (
          <div
            className="w-14 h-14 rounded-2xl bg-[#DBC3B2]/40 text-[#8A5A2B] flex items-center justify-center shrink-0 font-bold"
            aria-hidden="true"
          >
            {initials || "?"}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-[#3C3530] truncate" data-no-translate>
              {counsellor.displayName}
            </h3>
            {isCurrent && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#2F6B4F] bg-[#2F6B4F]/10 px-2 py-1 rounded-full shrink-0">
                Your counsellor
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[#7A726C]">
            {counsellor.yearsExperience != null && (
              <span>
                {counsellor.yearsExperience} year{counsellor.yearsExperience === 1 ? "" : "s"} experience
              </span>
            )}
            {counsellor.ratingAvg != null ? (
              <span className="inline-flex items-center gap-1 text-[#8A5A2B] font-semibold">
                <Star size={12} className="fill-current" />
                {counsellor.ratingAvg.toFixed(1)}
                <span className="font-normal text-[#7A726C]">({counsellor.ratingCount})</span>
              </span>
            ) : (
              <span className="text-[#9A928C]">Not enough reviews yet</span>
            )}
          </div>
        </div>
      </div>

      {counsellor.bio && (
        <p className="text-sm text-[#5A5049] leading-relaxed line-clamp-3" data-no-translate>
          {counsellor.bio}
        </p>
      )}

      {counsellor.specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {counsellor.specialties.slice(0, 5).map((s) => (
            <span
              key={s}
              className="text-[11px] font-medium text-[#5A5049] bg-[#EFE8E2] px-2.5 py-1 rounded-full"
            >
              {s.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#7A726C]">
        {counsellor.languages.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Globe size={13} />
            <span data-no-translate>{counsellor.languages.join(", ")}</span>
          </span>
        )}
        {counsellor.sessionFormats.map((f) => {
          const Icon = FORMAT_ICON[f];
          return (
            <span key={f} className="inline-flex items-center gap-1.5">
              <Icon size={13} />
              {f}
            </span>
          );
        })}
      </div>

      {reasons && reasons.length > 0 && (
        <ul className="space-y-1 border-t border-[#EFE8E2] pt-3">
          {reasons.map((r, i) => (
            <li key={i} className="text-xs text-[#5A5049] flex items-start gap-2">
              <CheckCircle2 size={13} className="text-[#2F6B4F] mt-0.5 shrink-0" />
              <span>{r.label}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 pt-1 mt-auto">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
            counsellor.acceptingNewClients ? "text-[#2F6B4F]" : "text-[#9A928C]"
          }`}
        >
          <Clock size={13} />
          {counsellor.acceptingNewClients ? "Accepting new clients" : "Currently full"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {onOpen && (
            <button
              onClick={onOpen}
              className="px-3 py-2 rounded-xl text-[#5A5049] hover:text-[#3C3530] text-xs font-bold cursor-pointer"
            >
              Read more
            </button>
          )}
          {onSelect && !isCurrent && (
            <button
              onClick={onSelect}
              disabled={busy || !counsellor.acceptingNewClients}
              className="px-4 py-2 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? "Selecting…" : "Select this counsellor"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
