import React, { useState } from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  Users2,
  UserCog,
  ScrollText,
  Settings,
  LogOut,
  ShieldCheck,
  ArrowLeft,
  ScanSearch,
  Scale,
} from "lucide-react";
import { adminApiService } from "../services/adminApiService";
import { OverviewTab } from "./tabs/OverviewTab";
import { PendingQueueTab } from "./tabs/PendingQueueTab";
import { WorkersTab } from "./tabs/WorkersTab";
import { AssignmentsTab } from "./tabs/AssignmentsTab";
import { AuditLogTab } from "./tabs/AuditLogTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { FlagReviewTab } from "./tabs/FlagReviewTab";
import { FairnessTab } from "./tabs/FairnessTab";

type Tab = "overview" | "queue" | "workers" | "assignments" | "flagreview" | "fairness" | "audit" | "settings";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Oversight Dashboard", icon: LayoutDashboard },
  { id: "queue", label: "Verification Queue", icon: ClipboardCheck },
  { id: "workers", label: "Counselors", icon: UserCog },
  { id: "assignments", label: "User Assignments", icon: Users2 },
  { id: "flagreview", label: "AI Flag Review", icon: ScanSearch },
  { id: "fairness", label: "Fairness Slices", icon: Scale },
  { id: "audit", label: "Audit Log", icon: ScrollText },
  { id: "settings", label: "Settings", icon: Settings },
];

interface Props {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<Props> = ({ onLogout }) => {
  const [tab, setTab] = useState<Tab>("overview");

  const handleLogout = () => {
    adminApiService.logout();
    onLogout();
  };

  return (
    <div className="min-h-screen bg-[#FDF9F5] flex">
      <aside className="w-64 shrink-0 bg-white border-r border-[#EFE8E2] flex flex-col">
        <div className="p-6 border-b border-[#EFE8E2]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[#3C3530] text-white rounded-xl flex items-center justify-center shadow-xs">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-[#3C3530] leading-tight">AURA Admin</p>
              <p className="text-[10px] text-[#68625D] uppercase tracking-wider font-bold">Control Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                tab === id
                  ? "bg-[#3C3530] text-white shadow-xs"
                  : "text-[#5A5049] hover:bg-[#FDF9F5]"
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-[#EFE8E2] space-y-1">
          <a
            href="/"
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-bold text-[#5A5049] hover:bg-[#FDF9F5] transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back to Main Site</span>
          </a>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-bold text-[#A55D25] hover:bg-[#FDF9F5] transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 sm:p-8 overflow-y-auto max-h-screen">
        {tab === "overview" && <OverviewTab onNavigate={(t) => setTab(t as Tab)} />}
        {tab === "queue" && <PendingQueueTab />}
        {tab === "workers" && <WorkersTab />}
        {tab === "assignments" && <AssignmentsTab />}
        {tab === "flagreview" && <FlagReviewTab />}
        {tab === "fairness" && <FairnessTab />}
        {tab === "audit" && <AuditLogTab />}
        {tab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
};
