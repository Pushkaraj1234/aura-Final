import React, { useEffect, useState } from "react";
import { Save, RotateCcw, Info } from "lucide-react";
import { adminApiService } from "../../services/adminApiService";
import { Card, PageHeader, Spinner, ErrorBanner, PrimaryButton, SecondaryButton } from "../ui";

// Shipped defaults (kept in sync with src/services/alertConfig.ts) + a
// plain-language label and hint per tunable key.
const THRESHOLD_META: Record<string, { label: string; hint: string; def: number; unit: string }> = {
  MONITORING_MAX: { label: "Monitoring ceiling", hint: "Scores at or below this are treated as mild / monitoring.", def: 40, unit: "/100" },
  MODERATE_MAX: { label: "Moderate ceiling", hint: "Upper bound of the moderate band.", def: 60, unit: "/100" },
  ELEVATED_MAX: { label: "Elevated ceiling", hint: "Above this, a signal is treated as elevated (ORANGE).", def: 74, unit: "/100" },
  ALERT_THRESHOLD: { label: "Critical alert threshold", hint: "At or above this, a priority human-review alert is raised.", def: 75, unit: "/100" },
  HIGH_MAX: { label: "High-band ceiling", hint: "Above this counts as very-high priority (RED).", def: 85, unit: "/100" },
  VERY_HIGH_THRESHOLD: { label: "Very-high threshold", hint: "At or above this, the highest-priority wellbeing signal fires.", def: 86, unit: "/100" },
  SUDDEN_CHANGE_THRESHOLD: { label: "Sudden-jump size", hint: "Point rise between two consecutive check-ins that flags a rapid change.", def: 15, unit: " pts" },
  PERSISTENT_INCREASE_COUNT: { label: "Persistent-increase count", hint: "Consecutive rises needed to flag persistent worsening.", def: 3, unit: "×" },
  PERSISTENT_ELEVATED_COUNT: { label: "Persistent-elevated count", hint: "Consecutive elevated check-ins needed to flag persistent elevation.", def: 2, unit: "×" },
  RECOVERY_DROP_THRESHOLD: { label: "Recovery drop", hint: "Point reduction after support that counts as meaningful recovery.", def: 15, unit: " pts" },
  IMPROVEMENT_DROP_THRESHOLD: { label: "Improvement drop", hint: "General downward move that counts as improvement.", def: 10, unit: " pts" },
};

export const SettingsTab: React.FC = () => {
  const [value, setValue] = useState<number>(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Alert thresholds
  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const [thKeys, setThKeys] = useState<string[]>([]);
  const [thSaving, setThSaving] = useState(false);
  const [thSaved, setThSaved] = useState(false);
  const [thError, setThError] = useState("");

  useEffect(() => {
    Promise.all([adminApiService.getMaxCaseload(), adminApiService.getAlertThresholds()])
      .then(([mc, th]) => {
        setValue(mc.maxCaseload);
        setThKeys(th.keys || Object.keys(THRESHOLD_META));
        setThresholds(th.thresholds || {});
      })
      .catch((err) => setError(err.message || "Failed to load settings."))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await adminApiService.setMaxCaseload(value);
      setSaved(true);
    } catch (err: any) {
      setError(err.message || "Failed to save setting.");
    } finally {
      setSaving(false);
    }
  };

  const effective = (k: string) => (k in thresholds ? thresholds[k] : THRESHOLD_META[k]?.def ?? 0);

  const handleThSave = async () => {
    setThSaving(true);
    setThError("");
    setThSaved(false);
    try {
      // Send the full effective set so a partial edit still persists cleanly.
      const payload: Record<string, number> = {};
      (thKeys.length ? thKeys : Object.keys(THRESHOLD_META)).forEach((k) => (payload[k] = effective(k)));
      const res = await adminApiService.setAlertThresholds(payload);
      setThresholds(res.thresholds);
      setThSaved(true);
    } catch (err: any) {
      setThError(err.message || "Failed to save alert thresholds.");
    } finally {
      setThSaving(false);
    }
  };

  const resetDefaults = () => {
    const d: Record<string, number> = {};
    (thKeys.length ? thKeys : Object.keys(THRESHOLD_META)).forEach((k) => (d[k] = THRESHOLD_META[k]?.def ?? 0));
    setThresholds(d);
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Platform-wide configuration for the admin module." />
      {error && <ErrorBanner message={error} />}
      {loading ? (
        <Spinner label="Loading settings..." />
      ) : (
        <div className="space-y-6">
          <Card className="p-6 max-w-md">
            <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider mb-1.5">
              Default Max Caseload per Counselor
            </label>
            <p className="text-xs text-[#7F8C8D] mb-3">
              Assigning a user beyond this limit will prompt admins for confirmation before proceeding.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-28 px-4 py-2.5 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] font-bold focus:outline-none focus:ring-2 focus:ring-[#5A5049]"
              />
              <PrimaryButton onClick={handleSave} disabled={saving}>
                <span className="flex items-center gap-1.5">
                  <Save size={13} /> {saving ? "Saving..." : "Save"}
                </span>
              </PrimaryButton>
            </div>
            {saved && <p className="text-xs font-bold text-[#2F6B4F] mt-3">Saved.</p>}
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
              <div>
                <h3 className="text-sm font-black text-[#3C3530] uppercase tracking-wider">AI Alert Thresholds — Sensitivity</h3>
                <p className="text-xs text-[#7F8C8D] mt-1 max-w-xl">
                  Tunes the client-side alert engine that decides when a distress signal is raised for human review.
                  Lower thresholds = more alerts (fewer missed cases, more noise); higher = fewer alerts. Applied the
                  next time the app loads. Prototype rules — not clinically validated.
                </p>
              </div>
              <SecondaryButton onClick={resetDefaults}>
                <span className="flex items-center gap-1.5">
                  <RotateCcw size={12} /> Reset to defaults
                </span>
              </SecondaryButton>
            </div>

            {thError && <ErrorBanner message={thError} />}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {(thKeys.length ? thKeys : Object.keys(THRESHOLD_META)).map((k) => {
                const meta = THRESHOLD_META[k];
                if (!meta) return null;
                const cur = effective(k);
                const modified = cur !== meta.def;
                return (
                  <div key={k} className="p-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#3C3530]">{meta.label}</span>
                      {modified && (
                        <span className="text-[9px] font-black uppercase text-[#B4762B] bg-[#F8ECD9] px-1.5 py-0.5 rounded">
                          modified
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#7F8C8D] mt-0.5 leading-snug">{meta.hint}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={cur}
                        onChange={(e) =>
                          setThresholds((prev) => ({ ...prev, [k]: Math.max(0, Math.min(100, Number(e.target.value))) }))
                        }
                        className="w-20 px-2.5 py-1.5 rounded-lg border border-[#EFE8E2] bg-white text-sm font-bold text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049]"
                      />
                      <span className="text-[10px] text-[#7F8C8D]">
                        {meta.unit} · default {meta.def}
                        {meta.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 mt-5">
              <PrimaryButton onClick={handleThSave} disabled={thSaving}>
                <span className="flex items-center gap-1.5">
                  <Save size={13} /> {thSaving ? "Saving..." : "Save thresholds"}
                </span>
              </PrimaryButton>
              {thSaved && <span className="text-xs font-bold text-[#2F6B4F]">Saved. Takes effect on next app load.</span>}
            </div>

            <p className="text-[10px] text-[#B9B0A6] mt-4 flex items-start gap-1.5">
              <Info size={11} className="shrink-0 mt-0.5" />
              These values map 1:1 onto <span className="font-mono">alertConfig.ts</span>. The alert engine still never
              auto-escalates without a human — this only changes when a case is surfaced.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
};
