import React, { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, Search, LifeBuoy, Loader2, ShieldAlert, UserPlus } from "lucide-react";
import { User, Participant, Message } from "../types";
import { apiService } from "../services/apiService";

interface Props {
  currentUser: User;
  participants: Participant[];
  participantRecord: Participant | null;
  onOpenEmergency: () => void;
  /** Offered from the empty state, which is where an unassigned user lands. */
  onChooseCounsellor?: () => void;
}

const POLL_INTERVAL_MS = 8000;

// participants.assigned_worker is a free-text field elsewhere in the app (a
// legacy "quick assign by name" flow writes a plain name into it), but the
// Admin Panel's formal assignment flow — the one the messages_select/insert
// RLS policies actually key off — always writes a real Supabase auth uuid.
// Only a uuid-shaped value can ever resolve to an assigned worker's profile,
// so that's what gates whether messaging is offered at all.
const isUuid = (id?: string | null) =>
  !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const SafetyBanner: React.FC<{ onOpenEmergency: () => void }> = ({ onOpenEmergency }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#FDF9F5] border-b border-[#EFE8E2] text-[11px] text-[#7A726C]">
    <span className="flex items-center gap-1.5">
      <ShieldAlert size={13} className="text-[#A55D25] shrink-0" />
      This chat isn't monitored in real time. If you're in immediate danger, don't wait for a reply.
    </span>
    <button
      onClick={onOpenEmergency}
      className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#A55D25]/15 text-[#A55D25] font-bold hover:bg-[#A55D25]/25 transition-colors cursor-pointer"
    >
      <LifeBuoy size={12} />
      Emergency Help
    </button>
  </div>
);

const MessageBubble: React.FC<{ message: Message; isOwn: boolean }> = ({ message, isOwn }) => (
  <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
    <div
      className={`max-w-[75%] px-4 py-2.5 text-sm rounded-2xl ${
        isOwn
          ? "bg-[#3C3530] text-white rounded-tr-none"
          : "bg-white text-[#3C3530] border border-[#EFE8E2] rounded-tl-none shadow-xs"
      }`}
    >
      <p data-no-translate className="whitespace-pre-wrap leading-relaxed">{message.body}</p>
      <p className={`text-[10px] mt-1 ${isOwn ? "text-white/60" : "text-[#B9B0A6]"}`}>{formatTimestamp(message.createdAt)}</p>
    </div>
  </div>
);

const ThreadComposer: React.FC<{
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder: string;
}> = ({ draft, setDraft, onSend, sending, placeholder }) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      onSend();
    }}
    className="p-3 border-t border-[#EFE8E2] bg-white flex items-center gap-2"
  >
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      placeholder={placeholder}
      className="flex-1 px-4 py-2.5 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-sm text-[#3C3530] focus:bg-white focus:ring-2 focus:ring-[#5A5049] focus:outline-none"
    />
    <button
      type="submit"
      disabled={!draft.trim() || sending}
      className="w-10 h-10 shrink-0 rounded-xl bg-[#3C3530] text-white flex items-center justify-center hover:bg-[#3F4E4E] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
    >
      {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
    </button>
  </form>
);

// ---------------------------------------------------------------------------
// Counselor view: an inbox across every currently-assigned participant.
// ---------------------------------------------------------------------------
const WorkerMessages: React.FC<{ currentUser: User; participants: Participant[]; onOpenEmergency: () => void }> = ({
  currentUser,
  participants,
  onOpenEmergency,
}) => {
  const assigned = useMemo(
    () => participants.filter((p) => isUuid(p.assignedWorker) && p.assignedWorker === currentUser.id),
    [participants, currentUser.id]
  );
  const assignedIds = useMemo(() => assigned.map((p) => p.id), [assigned]);

  const [messagesByParticipant, setMessagesByParticipant] = useState<Record<string, Message[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    if (assignedIds.length === 0) {
      setMessagesByParticipant({});
      setLoading(false);
      return;
    }
    const all = await apiService.messages.getForParticipants(assignedIds);
    const grouped: Record<string, Message[]> = {};
    assignedIds.forEach((id) => (grouped[id] = []));
    all.forEach((m) => {
      if (!grouped[m.participantId]) grouped[m.participantId] = [];
      grouped[m.participantId].push(m);
    });
    setMessagesByParticipant(grouped);
    setLoading(false);
  }, [assignedIds.join(",")]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!selectedId && assigned.length > 0) {
      setSelectedId(assigned[0].id);
    }
  }, [assigned, selectedId]);

  useEffect(() => {
    if (selectedId) {
      apiService.messages.markThreadRead(selectedId, "support_worker").catch(() => {});
    }
  }, [selectedId, messagesByParticipant[selectedId || ""]?.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedId, messagesByParticipant[selectedId || ""]?.length]);

  const conversations = useMemo(() => {
    return assigned
      .map((p) => {
        const msgs = messagesByParticipant[p.id] || [];
        const last = msgs[msgs.length - 1];
        const unread = msgs.filter((m) => m.senderRole === "participant" && !m.read).length;
        return { participant: p, last, unread };
      })
      .filter(({ participant }) => {
        const q = search.toLowerCase();
        if (!q) return true;
        return (participant.name || "").toLowerCase().includes(q) || participant.id.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const at = a.last ? new Date(a.last.createdAt).getTime() : 0;
        const bt = b.last ? new Date(b.last.createdAt).getTime() : 0;
        return bt - at;
      });
  }, [assigned, messagesByParticipant, search]);

  const selectedParticipant = assigned.find((p) => p.id === selectedId) || null;
  const threadMessages = selectedId ? messagesByParticipant[selectedId] || [] : [];

  const handleSend = async () => {
    if (!selectedId || !draft.trim() || sending) return;
    setSending(true);
    const body = draft;
    setDraft("");
    const sent = await apiService.messages.send({
      participantId: selectedId,
      senderId: currentUser.id,
      senderRole: "support_worker",
      body,
    });
    if (sent) {
      setMessagesByParticipant((prev) => ({ ...prev, [selectedId]: [...(prev[selectedId] || []), sent] }));
    } else {
      setDraft(body);
    }
    setSending(false);
  };

  if (!loading && assigned.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EFE8E2] text-[#7F8C8D] flex items-center justify-center">
          <MessageCircle size={26} />
        </div>
        <h2 className="text-lg font-black text-[#3C3530]">No conversations yet</h2>
        <p className="text-sm text-[#7F8C8D] max-w-md mx-auto">
          You'll be able to message a participant here once they're assigned to your caseload.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-3xl border border-[#EFE8E2] shadow-xs overflow-hidden grid grid-cols-1 md:grid-cols-[300px_1fr] h-[calc(100vh-220px)] min-h-[520px]">
        {/* Conversation list */}
        <div className="border-b md:border-b-0 md:border-r border-[#EFE8E2] flex flex-col">
          <div className="p-4 border-b border-[#EFE8E2] space-y-3">
            <h2 className="text-base font-black text-[#3C3530]">Messages</h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B9B0A6]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your caseload..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-xs text-[#3C3530] focus:bg-white focus:ring-2 focus:ring-[#5A5049] focus:outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.map(({ participant, last, unread }) => (
              <button
                key={participant.id}
                onClick={() => setSelectedId(participant.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-[#EFE8E2] flex items-start gap-3 transition-colors cursor-pointer ${
                  selectedId === participant.id ? "bg-[#FDF9F5]" : "hover:bg-[#FDF9F5]/60"
                }`}
              >
                <div className="w-9 h-9 shrink-0 rounded-full bg-[#DBC3B2]/40 text-[#5A5049] flex items-center justify-center text-xs font-black">
                  {initials(participant.name || participant.id)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-[#3C3530] truncate">{participant.name || participant.id}</p>
                    {last && <span className="text-[10px] text-[#B9B0A6] shrink-0">{formatTimestamp(last.createdAt)}</span>}
                  </div>
                  <p className="text-[11px] text-[#7F8C8D] truncate mt-0.5">
                    {last ? (
                      <>
                        {last.senderRole === "support_worker" ? "You: " : ""}
                        <span data-no-translate>{last.body}</span>
                      </>
                    ) : (
                      "No messages yet"
                    )}
                  </p>
                </div>
                {unread > 0 && (
                  <span className="w-[18px] h-[18px] min-w-[18px] px-1 rounded-full bg-[#A55D25] text-white text-[10px] font-bold flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className="flex flex-col min-h-0">
          {selectedParticipant ? (
            <>
              <div className="px-5 py-3.5 border-b border-[#EFE8E2] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#DBC3B2]/40 text-[#5A5049] flex items-center justify-center text-xs font-black">
                  {initials(selectedParticipant.name || selectedParticipant.id)}
                </div>
                <div>
                  <p className="text-sm font-black text-[#3C3530]">{selectedParticipant.name || selectedParticipant.id}</p>
                  {selectedParticipant.name && (
                    <p className="text-[10px] font-mono text-[#B9B0A6]">{selectedParticipant.id}</p>
                  )}
                </div>
              </div>
              <SafetyBanner onOpenEmergency={onOpenEmergency} />
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FDF9F5]/40">
                {threadMessages.length === 0 ? (
                  <p className="text-center text-xs text-[#B9B0A6] py-8">
                    No messages yet. Say hello to {selectedParticipant.name || "this participant"}.
                  </p>
                ) : (
                  threadMessages.map((m) => <MessageBubble key={m.id} message={m} isOwn={m.senderRole === "support_worker"} />)
                )}
                <div ref={bottomRef} />
              </div>
              <ThreadComposer
                draft={draft}
                setDraft={setDraft}
                onSend={handleSend}
                sending={sending}
                placeholder={`Message ${selectedParticipant.name || selectedParticipant.id}...`}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-[#B9B0A6]">
              Select a conversation to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Participant view: a single thread with their currently assigned worker.
// ---------------------------------------------------------------------------
const ParticipantMessages: React.FC<{
  currentUser: User;
  participantRecord: Participant | null;
  onOpenEmergency: () => void;
  onChooseCounsellor?: () => void;
}> = ({
  currentUser,
  participantRecord,
  onOpenEmergency,
  onChooseCounsellor,
}) => {
  const workerId = participantRecord?.assignedWorker;
  const hasAssignedWorker = isUuid(workerId);

  const [workerName, setWorkerName] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasAssignedWorker && workerId) {
      apiService.profiles.getName(workerId).then(setWorkerName);
    }
  }, [hasAssignedWorker, workerId]);

  const load = React.useCallback(async () => {
    if (!participantRecord || !hasAssignedWorker) {
      setLoading(false);
      return;
    }
    const msgs = await apiService.messages.getForParticipant(participantRecord.id);
    setMessages(msgs);
    setLoading(false);
    apiService.messages.markThreadRead(participantRecord.id, "participant").catch(() => {});
  }, [participantRecord?.id, hasAssignedWorker]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!participantRecord || !draft.trim() || sending) return;
    setSending(true);
    const body = draft;
    setDraft("");
    const sent = await apiService.messages.send({
      participantId: participantRecord.id,
      senderId: currentUser.id,
      senderRole: "participant",
      body,
    });
    if (sent) {
      setMessages((prev) => [...prev, sent]);
    } else {
      setDraft(body);
    }
    setSending(false);
  };

  if (!hasAssignedWorker) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EFE8E2] text-[#7F8C8D] flex items-center justify-center">
          <MessageCircle size={26} />
        </div>
        <h2 className="text-lg font-black text-[#3C3530]">No counselor assigned yet</h2>
        <p className="text-sm text-[#7F8C8D] max-w-md mx-auto">
          {onChooseCounsellor
            ? "You can pick a counsellor yourself and start messaging straight away, or wait for your support team to assign one."
            : "Once a counselor is assigned to you, you'll be able to message them directly here."}
        </p>

        {/* The way out of this screen. Without it, someone with no counsellor
            lands here and the only thing on offer is the emergency line — which
            is the wrong scale of response for most of the people who arrive. */}
        {onChooseCounsellor && (
          <button
            onClick={onChooseCounsellor}
            className="inline-flex items-center gap-1.5 mt-2 px-5 py-2.5 rounded-xl bg-[#3C3530] text-white text-xs font-bold hover:bg-[#5A5049] transition-colors cursor-pointer"
          >
            <UserPlus size={14} />
            Choose my counsellor
          </button>
        )}

        <div>
          <button
            onClick={onOpenEmergency}
            className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 rounded-xl bg-[#A55D25]/15 text-[#A55D25] text-xs font-bold hover:bg-[#A55D25]/25 transition-colors cursor-pointer"
          >
            <LifeBuoy size={14} />
            Need help right now? View Emergency Resources
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-3xl border border-[#EFE8E2] shadow-xs overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[520px]">
        <div className="px-5 py-3.5 border-b border-[#EFE8E2] flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#DBC3B2]/40 text-[#5A5049] flex items-center justify-center text-xs font-black">
            {initials(workerName || "Counselor")}
          </div>
          <div>
            <p className="text-sm font-black text-[#3C3530]">{workerName || "Your Counselor"}</p>
            <p className="text-[10px] text-[#7F8C8D]">Your assigned counselor</p>
          </div>
        </div>
        <SafetyBanner onOpenEmergency={onOpenEmergency} />
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FDF9F5]/40">
          {loading ? (
            <p className="text-center text-xs text-[#B9B0A6] py-8">Loading conversation...</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-xs text-[#B9B0A6] py-8">
              No messages yet. Say hello to {workerName || "your counselor"} whenever you're ready.
            </p>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} isOwn={m.senderRole === "participant"} />)
          )}
          <div ref={bottomRef} />
        </div>
        <ThreadComposer
          draft={draft}
          setDraft={setDraft}
          onSend={handleSend}
          sending={sending}
          placeholder={`Message ${workerName || "your counselor"}...`}
        />
      </div>
    </div>
  );
};

export const Messages: React.FC<Props> = ({ currentUser, participants, participantRecord, onOpenEmergency,
  onChooseCounsellor }) => {
  const isWorker = currentUser.role === "support_worker";
  return isWorker ? (
    <WorkerMessages currentUser={currentUser} participants={participants} onOpenEmergency={onOpenEmergency} />
  ) : (
    <ParticipantMessages
      currentUser={currentUser}
      participantRecord={participantRecord}
      onOpenEmergency={onOpenEmergency}
      onChooseCounsellor={onChooseCounsellor}
    />
  );
};
