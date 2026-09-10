import React from "react";
import { Plus, Activity, HeartHandshake, Shield } from "lucide-react";

interface Props {
  onStartCheckin: () => void;
}

export const EmptyWellbeingState: React.FC<Props> = ({ onStartCheckin }) => {
  return (
    <div className="py-12 px-6 rounded-3xl bg-[#FDF9F5] border border-dashed border-[#DBC3B2] text-center flex flex-col items-center justify-center space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-[#DBC3B2]/25 text-[#5A5049] flex items-center justify-center shadow-inner">
        <HeartHandshake size={32} className="stroke-[2.2]" />
      </div>

      <div className="max-w-md space-y-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-[#5A5049] bg-[#DBC3B2]/20 px-3 py-1 rounded-full inline-block">
          New Participant Baseline
        </span>
        <h3 className="text-2xl font-black text-[#3C3530]">
          Your wellbeing journey starts here
        </h3>
        <p className="text-sm font-semibold text-[#7A726C]">
          You haven't completed a wellbeing check-in yet.
        </p>
        <p className="text-xs text-[#7F8C8D] leading-relaxed pt-1">
          After your first check-in, your wellbeing signal will appear here. As you complete future check-ins, AURA can help you visualize changes over time.
        </p>
      </div>

      <div className="pt-2">
        <button
          onClick={onStartCheckin}
          className="px-6 py-3.5 rounded-2xl bg-[#5A5049] text-white font-bold text-sm hover:bg-[#3C3530] transition-all shadow-xs flex items-center justify-center space-x-2 active:scale-95 cursor-pointer group"
        >
          <Plus size={18} className="group-hover:rotate-90 transition-transform" />
          <span>Start First Check-in</span>
        </button>
      </div>

      <div className="flex items-center space-x-1.5 text-[11px] text-[#7F8C8D] pt-2">
        <Shield size={13} className="text-[#5A5049]" />
        <span>AURA provides wellbeing signals, not medical diagnoses.</span>
      </div>
    </div>
  );
};
