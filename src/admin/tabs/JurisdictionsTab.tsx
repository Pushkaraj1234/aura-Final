import React, { useCallback, useEffect, useState } from "react";
import { ChevronRight, MapPin, Send, Trash2, UserPlus, AlertTriangle } from "lucide-react";
import {
  adminApiService,
  DistrictOfficerRecord,
  JurisdictionAreaMetrics,
  JurisdictionViewResponse,
} from "../../services/adminApiService";
import { INDIAN_STATES } from "../../services/indianStates";
import {
  Badge,
  Card,
  DangerButton,
  EmptyState,
  ErrorBanner,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  Spinner,
} from "../ui";

/**
 * District, State and national oversight.
 *
 * Everything shown here is de-identified by the server
 * (src/services/jurisdictionAggregates.ts): counts, risk bands, trends and
 * response-time status, with areas of fewer than five people suppressed.
 * Individual high-risk cases appear only at district level and only by case
 * reference; the assigned counsellor is the link to the person.
 */

const UNSPECIFIED = "Not specified";

const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(v));
const trend = (v: number | null) =>
  v === null ? "—" : v > 0 ? `+${v} (worse)` : v < 0 ? `${v} (better)` : "0 (steady)";
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const MetricTile: React.FC<{ label: string; value: string; tone?: "bad" | "warn" }> = ({ label, value, tone }) => (
  <Card className="p-4">
    <p className="text-[10px] font-bold uppercase tracking-wider text-[#68625D]">{label}</p>
    <p
      className={`text-2xl font-black mt-1 ${
        tone === "bad" ? "text-[#B23A2E]" : tone === "warn" ? "text-[#A55D25]" : "text-[#3C3530]"
      }`}
    >
      {value}
    </p>
  </Card>
);

const emptyOfficer = { state: "", district: "", officerName: "", designation: "", email: "", phone: "" };

export const JurisdictionsTab: React.FC = () => {
  const [state, setState] = useState<string | undefined>();
  const [district, setDistrict] = useState<string | undefined>();
  const [view, setView] = useState<JurisdictionViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [officers, setOfficers] = useState<DistrictOfficerRecord[]>([]);
  const [form, setForm] = useState(emptyOfficer);
  const [saving, setSaving] = useState(false);
  const [officerError, setOfficerError] = useState<string | null>(null);

  const [notifying, setNotifying] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, o] = await Promise.all([
        adminApiService.getJurisdictionView(state, district),
        adminApiService.getDistrictOfficers(),
      ]);
      setView(v);
      setOfficers(o);
    } catch (err: any) {
      setError(err?.message || "Could not load the jurisdiction view.");
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [state, district]);

  useEffect(() => {
    load();
  }, [load]);

  // At district level, prefill the officer form with that district.
  useEffect(() => {
    if (view?.level === "district" && view.state && view.district) {
      setForm((f) => (f.state || f.district ? f : { ...f, state: view.state!, district: view.district! }));
    }
  }, [view]);

  const drill = (row: JurisdictionAreaMetrics) => {
    if (row.name === UNSPECIFIED || !view) return;
    if (view.level === "national") {
      setState(row.name);
      setDistrict(undefined);
    } else if (view.level === "state") {
      setDistrict(row.name);
    }
  };

  const saveOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setOfficerError(null);
    try {
      const updated = await adminApiService.saveDistrictOfficer({
        state: form.state,
        district: form.district,
        officerName: form.officerName,
        designation: form.designation || null,
        email: form.email,
        phone: form.phone || null,
      });
      setOfficers(updated);
      setForm(emptyOfficer);
      load();
    } catch (err: any) {
      setOfficerError(err?.message || "Could not save the officer.");
    } finally {
      setSaving(false);
    }
  };

  const removeOfficer = async (o: DistrictOfficerRecord) => {
    if (!window.confirm(`Remove ${o.officerName} as the officer for ${o.district}, ${o.state}?`)) return;
    try {
      setOfficers(await adminApiService.removeDistrictOfficer(o.id));
      load();
    } catch (err: any) {
      setOfficerError(err?.message || "Could not remove the officer.");
    }
  };

  const notifyNow = async () => {
    setNotifying(true);
    setNotifyMessage(null);
    try {
      const r = await adminApiService.notifyDistrictOfficers();
      const parts = [`${r.notified} officer${r.notified === 1 ? "" : "s"} notified about ${r.alertsMarked} alert${r.alertsMarked === 1 ? "" : "s"}.`];
      if (r.withoutOfficer.length) {
        parts.push(
          `No officer on file for: ${r.withoutOfficer.map((w) => `${w.district}, ${w.state} (${w.cases})`).join("; ")}.`
        );
      }
      if (r.note) parts.push(r.note);
      setNotifyMessage(parts.join(" "));
    } catch (err: any) {
      setNotifyMessage(err?.message || "Could not send the notices.");
    } finally {
      setNotifying(false);
    }
  };

  const t = view?.totals;

  return (
    <div>
      <PageHeader
        title="District, State & National Oversight"
        subtitle="De-identified: counts, risk levels and response times only. Areas with fewer than 5 people are hidden."
        action={
          <PrimaryButton onClick={notifyNow} disabled={notifying} className="inline-flex items-center gap-1.5">
            <Send size={13} />
            {notifying ? "Sending…" : "Notify district officers now"}
          </PrimaryButton>
        }
      />

      {notifyMessage && (
        <div className="bg-[#FDF9F5] border border-[#EFE8E2] text-[#3C3530] text-sm rounded-xl px-4 py-3 mb-4">
          {notifyMessage}
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm font-bold text-[#5A5049] mb-5 flex-wrap" aria-label="Level">
        <button
          onClick={() => {
            setState(undefined);
            setDistrict(undefined);
          }}
          className={`cursor-pointer hover:underline ${!state ? "text-[#3C3530]" : ""}`}
        >
          India (national)
        </button>
        {state && (
          <>
            <ChevronRight size={14} />
            <button
              onClick={() => setDistrict(undefined)}
              className={`cursor-pointer hover:underline ${!district ? "text-[#3C3530]" : ""}`}
              data-no-translate
            >
              {view?.state || state}
            </button>
          </>
        )}
        {district && (
          <>
            <ChevronRight size={14} />
            <span className="text-[#3C3530]" data-no-translate>
              {view?.district || district}
            </span>
          </>
        )}
      </nav>

      {error && <ErrorBanner message={error} />}
      {loading && <Spinner />}

      {!loading && view && t && (
        <>
          {t.suppressed ? (
            <Card className="p-4 mb-6 text-sm text-[#68625D]">
              Fewer than 5 people are registered here, so the totals are hidden to protect their privacy.
            </Card>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <MetricTile label="People monitored" value={num(t.participants)} />
              <MetricTile label="High risk now" value={num(t.highRisk)} tone={t.highRisk ? "bad" : undefined} />
              <MetricTile
                label="Alerts past response time"
                value={num(t.overdueAlerts)}
                tone={t.overdueAlerts ? "bad" : undefined}
              />
              <MetricTile label="Open high alerts" value={num(t.openHighAlerts)} tone={t.openHighAlerts ? "warn" : undefined} />
              <MetricTile label="Mean latest score" value={num(t.meanLatestScore)} />
              <MetricTile label="Trend, last 14 days" value={trend(t.trendDelta)} tone={(t.trendDelta ?? 0) > 0 ? "warn" : undefined} />
              <MetricTile label="Quiet over 14 days" value={num(t.quiet14d)} tone={t.quiet14d ? "warn" : undefined} />
              <MetricTile label="No counsellor yet" value={num(t.unassigned)} tone={t.unassigned ? "warn" : undefined} />
            </div>
          )}

          {view.level !== "district" && (
            <Card className="mb-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-[#68625D] border-b border-[#EFE8E2]">
                    <th className="px-4 py-3">{view.level === "national" ? "State / UT" : "District"}</th>
                    <th className="px-3 py-3">People</th>
                    <th className="px-3 py-3">High risk</th>
                    <th className="px-3 py-3">Elevated</th>
                    <th className="px-3 py-3">Open high alerts</th>
                    <th className="px-3 py-3">Overdue</th>
                    <th className="px-3 py-3">Mean score</th>
                    <th className="px-3 py-3">Trend</th>
                    <th className="px-3 py-3">Quiet</th>
                    <th className="px-3 py-3">No counsellor</th>
                  </tr>
                </thead>
                <tbody>
                  {view.groups.length === 0 && (
                    <tr>
                      <td colSpan={10}>
                        <EmptyState message="No participants here yet." />
                      </td>
                    </tr>
                  )}
                  {view.groups.map((g) => {
                    const clickable = g.name !== UNSPECIFIED;
                    return (
                      <tr
                        key={g.name}
                        onClick={() => clickable && drill(g)}
                        className={`border-b border-[#F4EEE8] ${clickable ? "cursor-pointer hover:bg-[#FDF9F5]" : ""}`}
                      >
                        <td className="px-4 py-3 font-bold text-[#3C3530]">
                          <span className="inline-flex items-center gap-1.5" data-no-translate>
                            <MapPin size={13} className="text-[#A55D25]" />
                            {g.name}
                          </span>
                          {g.suppressed && (
                            <span className="ml-2">
                              <Badge>fewer than 5, hidden</Badge>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">{num(g.participants)}</td>
                        <td className="px-3 py-3">{g.highRisk ? <Badge tone="bad">{g.highRisk}</Badge> : num(g.highRisk)}</td>
                        <td className="px-3 py-3">{num(g.elevated)}</td>
                        <td className="px-3 py-3">{num(g.openHighAlerts)}</td>
                        <td className="px-3 py-3">
                          {g.overdueAlerts ? <Badge tone="bad">{g.overdueAlerts}</Badge> : num(g.overdueAlerts)}
                        </td>
                        <td className="px-3 py-3">{num(g.meanLatestScore)}</td>
                        <td className="px-3 py-3">{trend(g.trendDelta)}</td>
                        <td className="px-3 py-3">{num(g.quiet14d)}</td>
                        <td className="px-3 py-3">{num(g.unassigned)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

          {view.level === "district" && (
            <>
              <Card className="p-5 mb-6">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#68625D] mb-2">District officer</p>
                {view.officer ? (
                  <p className="text-sm text-[#3C3530]" data-no-translate>
                    <strong>{view.officer.officerName}</strong>
                    {view.officer.designation ? `, ${view.officer.designation}` : ""} · {view.officer.email}
                    {view.officer.phone ? ` · ${view.officer.phone}` : ""}
                  </p>
                ) : (
                  <p className="text-sm text-[#A55D25] inline-flex items-center gap-1.5">
                    <AlertTriangle size={14} /> No officer on file for this district, so high-risk alerts here reach
                    no official. Add one below.
                  </p>
                )}
              </Card>

              <Card className="mb-6 overflow-x-auto">
                <div className="px-4 pt-4">
                  <p className="text-sm font-black text-[#3C3530]">High-risk cases</p>
                  <p className="text-xs text-[#68625D] mt-0.5">
                    By case reference only. Coordinate through the assigned counsellor, who holds the person's identity
                    and consent.
                  </p>
                </div>
                <table className="w-full text-sm mt-3">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-[#68625D] border-b border-[#EFE8E2]">
                      <th className="px-4 py-3">Case</th>
                      <th className="px-3 py-3">Latest score</th>
                      <th className="px-3 py-3">Trend</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Open alert</th>
                      <th className="px-3 py-3">Raised</th>
                      <th className="px-3 py-3">Response</th>
                      <th className="px-3 py-3">Counsellor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.cases.length === 0 && (
                      <tr>
                        <td colSpan={8}>
                          <EmptyState message="No high-risk cases in this district right now." />
                        </td>
                      </tr>
                    )}
                    {view.cases.map((c) => (
                      <tr key={c.caseRef} className="border-b border-[#F4EEE8]">
                        <td className="px-4 py-3 font-mono font-bold text-[#3C3530]" data-no-translate>
                          {c.caseRef}
                        </td>
                        <td className="px-3 py-3">{num(c.latestScore)}</td>
                        <td className="px-3 py-3">{trend(c.trendDelta)}</td>
                        <td className="px-3 py-3">{c.status || "—"}</td>
                        <td className="px-3 py-3">
                          {c.openAlertSeverity ? (
                            <Badge tone={["RED", "URGENT"].includes(c.openAlertSeverity.toUpperCase()) ? "bad" : "warn"}>
                              {c.openAlertSeverity}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-3">{when(c.alertRaisedAt)}</td>
                        <td className="px-3 py-3">
                          {c.responseState === "overdue" ? (
                            <Badge tone="bad">Overdue</Badge>
                          ) : c.responseState === "pending" ? (
                            <Badge tone="warn">Awaiting</Badge>
                          ) : c.responseState === "acknowledged" ? (
                            <Badge tone="good">Acknowledged</Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {c.counsellorAssigned ? <Badge tone="good">Assigned</Badge> : <Badge tone="bad">None</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </>
      )}

      {/* District officers */}
      <Card className="p-5">
        <p className="text-sm font-black text-[#3C3530]">District officers</p>
        <p className="text-xs text-[#68625D] mt-0.5 mb-4">
          The designated official for each district. They receive a de-identified notice (case references, severity
          and time only) when a high-risk alert is raised in their district, daily and whenever you press "Notify".
        </p>

        {officerError && <ErrorBanner message={officerError} />}

        {officers.length > 0 && (
          <ul className="divide-y divide-[#F4EEE8] mb-5">
            {officers.map((o) => (
              <li key={o.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <span data-no-translate>
                  <strong className="text-[#3C3530]">
                    {o.district}, {o.state}
                  </strong>
                  <span className="text-[#68625D]">
                    {" "}
                    · {o.officerName}
                    {o.designation ? `, ${o.designation}` : ""} · {o.email}
                    {o.phone ? ` · ${o.phone}` : ""}
                  </span>
                </span>
                <DangerButton onClick={() => removeOfficer(o)} className="inline-flex items-center gap-1 shrink-0">
                  <Trash2 size={12} /> Remove
                </DangerButton>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={saveOfficer} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            required
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            className="p-2.5 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530] bg-white"
            aria-label="State or UT"
          >
            <option value="">State / UT…</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            required
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
            placeholder="District"
            className="p-2.5 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530]"
          />
          <input
            required
            value={form.officerName}
            onChange={(e) => setForm({ ...form, officerName: e.target.value })}
            placeholder="Officer name"
            className="p-2.5 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530]"
          />
          <input
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            placeholder="Designation (e.g. District Social Welfare Officer)"
            className="p-2.5 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530]"
          />
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Official email"
            className="p-2.5 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530]"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone (optional)"
            className="p-2.5 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530]"
          />
          <div className="md:col-span-3 flex gap-2">
            <PrimaryButton type="submit" disabled={saving} className="inline-flex items-center gap-1.5">
              <UserPlus size={13} />
              {saving ? "Saving…" : "Save officer"}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => setForm(emptyOfficer)}>
              Clear
            </SecondaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
};
