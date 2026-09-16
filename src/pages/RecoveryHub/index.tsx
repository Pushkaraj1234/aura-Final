import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ErrorNote } from "../../components/Recovery/RecoveryPrimitives";
import { recoveryService } from "../../services/recoveryService";
import {
  buildChecklist,
  nextStep,
  pendingReminders,
  recoveryProgress,
  type RecoveryDestination,
} from "../../services/recoveryHub";
import type {
  CompensationApplication,
  LegalAidApplication,
  RecoveryCaseBundle,
  RecoveryDocument,
  RecoveryFir,
  RecoveryIncident,
  RecoveryNotification,
  RecoveryTimelineEvent,
  TimelineStage,
  DocumentType,
} from "../../types/recovery";
import { RecoveryEntry } from "./RecoveryEntry";
import { RecoveryCaseForm } from "./RecoveryCaseForm";
import { RecoveryIncidentIntake } from "./RecoveryIncident";
import { RecoveryFirScreen } from "./RecoveryFir";
import { RecoveryTimelineScreen } from "./RecoveryTimeline";
import { RecoveryDocumentsScreen } from "./RecoveryDocuments";
import { RecoveryLegalAidScreen } from "./RecoveryLegalAid";
import { RecoveryFinancialScreen } from "./RecoveryFinancial";
import { RecoveryCompensationScreen } from "./RecoveryCompensation";
import { RecoveryDashboard } from "./RecoveryDashboard";

/**
 * The Recovery Hub shell.
 *
 * WHY ONE ROUTE AND NOT TWELVE
 *
 * App.tsx switches on a currentView string and gains one case, `recovery_hub`.
 * The sub-screens are held here instead, which keeps a large feature out of an
 * already long switch and, more importantly, keeps the case bundle in one place
 * so moving between the FIR screen and the document centre does not refetch
 * everything or lose what is half-typed.
 *
 * WHY THE VIEW IS NOT IN THE URL
 *
 * A case id in an address bar is a case id in browser history, in a shared
 * screen, and in whatever a partner scrolls through. §21 says no sensitive data
 * in URLs, and on this feature that is not a formality.
 *
 * SAVE AND COME BACK LATER IS NOT A BUTTON, IT IS THE ARCHITECTURE
 *
 * Every step writes to Supabase before advancing, so leaving is never a loss
 * and nothing depends on a draft held in a tab that may be closed in a hurry.
 * That is also why quick-exit stays reachable throughout: this section must be
 * abandonable mid-sentence.
 */

type View =
  | "entry"
  | "new_case"
  | "dashboard"
  | "incident"
  | "fir"
  | "timeline"
  | "documents"
  | "legal_aid"
  | "financial"
  | "compensation";

interface Props {
  userName?: string;
  userEmail?: string;
  language: string;
  onBack: () => void;
  onOpenEmergency: () => void;
}

export const RecoveryHub: React.FC<Props> = ({
  userName,
  userEmail,
  language,
  onBack,
  onOpenEmergency,
}) => {
  const [view, setView] = useState<View>("entry");
  const [bundle, setBundle] = useState<RecoveryCaseBundle | null>(null);
  const [notifications, setNotifications] = useState<RecoveryNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // -- derived --------------------------------------------------------------

  const checklist = useMemo(
    () =>
      buildChecklist({
        category: bundle?.incident?.category,
        impacts: bundle?.incident?.impacts ?? [],
        financialImpacts: bundle?.case.financialImpacts ?? [],
        hasFir: bundle?.fir?.hasFir,
        priorAssistance: bundle?.case.priorAssistance,
        heldDocTypes: bundle?.documents.map((d) => d.docType) ?? [],
      }),
    [bundle]
  );

  const progress = useMemo(() => recoveryProgress(bundle), [bundle]);
  const step = useMemo(() => nextStep({ bundle, checklist }), [bundle, checklist]);

  // -- loading --------------------------------------------------------------

  const refresh = useCallback(async (caseId: string) => {
    const next = await recoveryService.loadBundle(caseId);
    setBundle(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cases = await recoveryService.listCases();
        if (cancelled) return;
        if (cases.length > 0) {
          const loaded = await recoveryService.loadBundle(cases[0].id);
          if (cancelled) return;
          setBundle(loaded);
          setNotifications(await recoveryService.listNotifications());
          setView("dashboard");
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Could not load your recovery file.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Reminders are written when the dashboard is looked at, rather than on a
   * schedule, because there is no background worker here and inventing one
   * would mean a server process holding case data it has no reason to hold.
   * pushNotification refuses to duplicate an unread reminder of the same kind,
   * so this cannot pile up.
   */
  useEffect(() => {
    if (!bundle || view !== "dashboard") return;
    let cancelled = false;
    (async () => {
      const drafts = pendingReminders(bundle, checklist, new Date());
      if (drafts.length === 0) return;
      for (const d of drafts) {
        await recoveryService.pushNotification(bundle.case.id, d.kind, d.title, d.body);
      }
      if (!cancelled) setNotifications(await recoveryService.listNotifications());
    })();
    return () => {
      cancelled = true;
    };
  }, [bundle, checklist, view]);

  /**
   * Returns to the entry screen after fifteen quiet minutes.
   *
   * Not a sign-out, and nothing is discarded: every step has already written
   * to the database, so this only takes the case off the screen. That is the
   * risk being managed. Phones in this population get borrowed, checked and
   * taken, and a case left open on a kitchen table for an hour is the same
   * disclosure as handing it over.
   *
   * Fifteen minutes rather than five because reading a government page in
   * another tab, or finding a certificate in a drawer, is normal use of this
   * feature and being thrown out mid-task would teach people not to use it.
   */
  useEffect(() => {
    if (!bundle) return;
    const IDLE_MS = 15 * 60 * 1000;
    let timer = window.setTimeout(() => setView("entry"), IDLE_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setView("entry"), IDLE_MS);
    };
    const events = ["pointerdown", "keydown", "visibilitychange"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [bundle]);

  // -- actions --------------------------------------------------------------

  /** Every mutation goes through here, so busy and error are never forgotten. */
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      setBusy(true);
      setError(null);
      try {
        return await fn();
      } catch (e: any) {
        setError(e?.message || "Something went wrong. Nothing you saved has been lost.");
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const go = (destination: RecoveryDestination) => {
    const map: Record<RecoveryDestination, View> = {
      recovery_hub: "dashboard",
      recovery_case_new: "new_case",
      recovery_incident: "incident",
      recovery_fir: "fir",
      recovery_documents: "documents",
      recovery_legal_aid: "legal_aid",
      recovery_financial: "financial",
      recovery_compensation: "compensation",
      recovery_timeline: "timeline",
    };
    setError(null);
    setView(map[destination]);
  };

  const createCase = (fields: Parameters<typeof recoveryService.createCase>[0]) =>
    run(async () => {
      const created = await recoveryService.createCase(fields);
      await refresh(created.id);
      setView("incident");
    });

  const saveIncident = async (patch: Partial<RecoveryIncident>) => {
    if (!bundle) return;
    await run(async () => {
      await recoveryService.saveIncident(bundle.case.id, patch);
      await refresh(bundle.case.id);
    });
  };

  const saveFir = async (patch: Partial<RecoveryFir>) => {
    if (!bundle) return;
    await run(async () => {
      await recoveryService.saveFir(bundle.case.id, patch);
      // The timeline should reflect a registered FIR without the person having
      // to add the same fact twice.
      if (patch.hasFir && patch.firNumber) {
        const already = bundle.timeline.some((t) => t.stage === "fir");
        if (!already) {
          await recoveryService.addTimelineEvent(bundle.case.id, {
            stage: "fir",
            occurredOn: patch.firDate,
            status: "COMPLETED",
            description: `FIR ${patch.firNumber} recorded.`,
            verification: "USER_REPORTED",
          });
        }
      }
      await refresh(bundle.case.id);
    });
  };

  const addTimelineEvent = async (
    event: Partial<RecoveryTimelineEvent> & { stage: TimelineStage }
  ) => {
    if (!bundle) return;
    await run(async () => {
      await recoveryService.addTimelineEvent(bundle.case.id, event);
      await refresh(bundle.case.id);
    });
  };

  const uploadDocument = async (file: File, docType: DocumentType) => {
    if (!bundle) return;
    await run(async () => {
      await recoveryService.uploadDocument(bundle.case.id, file, docType);
      await refresh(bundle.case.id);
    });
  };

  const openDocument = async (doc: RecoveryDocument) => {
    await run(async () => {
      const url = await recoveryService.documentUrl(doc.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    });
  };

  const deleteDocument = async (doc: RecoveryDocument) => {
    if (!bundle) return;
    await run(async () => {
      await recoveryService.deleteDocument(doc);
      await refresh(bundle.case.id);
    });
  };

  const saveLegalAid = async (patch: Partial<LegalAidApplication> & { id?: string }) => {
    if (!bundle) return;
    await run(async () => {
      await recoveryService.saveLegalAid(bundle.case.id, patch);
      await refresh(bundle.case.id);
    });
  };

  const saveCompensation = async (
    patch: Partial<CompensationApplication> & { id?: string }
  ) => {
    if (!bundle) return;
    await run(async () => {
      await recoveryService.saveCompensation(bundle.case.id, patch);
      await refresh(bundle.case.id);
    });
  };

  const saveFinancial = async (patch: {
    financialImpacts: RecoveryCaseBundle["case"]["financialImpacts"];
    priorAssistance?: RecoveryCaseBundle["case"]["priorAssistance"];
  }) => {
    if (!bundle) return;
    await run(async () => {
      await recoveryService.updateCase(bundle.case.id, patch);
      await refresh(bundle.case.id);
    });
  };

  const deleteCase = async () => {
    if (!bundle) return;
    setConfirmDelete(false);
    await run(async () => {
      await recoveryService.deleteCase(bundle.case.id);
      setBundle(null);
      setNotifications([]);
      setView("entry");
    });
  };

  /**
   * Hands the person a file. Built and revoked in the same tick so the blob URL
   * does not sit in memory, and named with the case id so several exports do
   * not overwrite each other in a Downloads folder.
   */
  const exportCase = async () => {
    if (!bundle) return;
    await run(async () => {
      const json = await recoveryService.exportCase(bundle.case.id);
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bundle.case.id}-recovery-file.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const dismissNotification = async (id: string) => {
    await recoveryService.markNotificationRead(id);
    setNotifications(await recoveryService.listNotifications());
  };

  // -- render ---------------------------------------------------------------

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto max-w-[840px] px-5 py-10 sm:px-8 sm:py-14">
      {children}
      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete your recovery file?"
        message="This removes the file and every document in it. It cannot be undone. Nothing else in your AURA account changes."
        confirmText="Delete it"
        cancelText="Keep it"
        onConfirm={deleteCase}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );

  if (loading) {
    return shell(
      <p className="text-[0.9375rem] text-[#6B5B4C]" role="status">
        Opening your recovery file&hellip;
      </p>
    );
  }

  if (view === "entry" || (!bundle && view !== "new_case")) {
    return shell(
      <>
        {error && (
          <div className="mb-6">
            <ErrorNote message={error} />
          </div>
        )}
        <RecoveryEntry
          hasExistingCase={Boolean(bundle)}
          language={language}
          onStartReport={() => setView(bundle ? "dashboard" : "new_case")}
          onOpenExisting={() => setView("dashboard")}
          onOpenEmergency={onOpenEmergency}
          onBack={onBack}
        />
      </>
    );
  }

  if (view === "new_case") {
    return shell(
      <RecoveryCaseForm
        defaultName={userName}
        defaultEmail={userEmail}
        defaultLanguage={language}
        busy={busy}
        error={error}
        onCreate={createCase}
        onBack={() => setView("entry")}
      />
    );
  }

  if (!bundle) return shell(null);

  switch (view) {
    case "incident":
      return shell(
        <RecoveryIncidentIntake
          incident={bundle.incident}
          caseState={bundle.case.state}
          caseDistrict={bundle.case.district}
          busy={busy}
          error={error}
          onSave={saveIncident}
          onDone={() => setView("fir")}
          onExit={() => setView("dashboard")}
        />
      );

    case "fir":
      return shell(
        <RecoveryFirScreen
          fir={bundle.fir}
          caseState={bundle.case.state}
          language={language}
          busy={busy}
          error={error}
          onSave={saveFir}
          onBack={() => setView("dashboard")}
        />
      );

    case "timeline":
      return shell(
        <RecoveryTimelineScreen
          bundle={bundle}
          progress={progress}
          busy={busy}
          error={error}
          onAdd={addTimelineEvent}
          onBack={() => setView("dashboard")}
        />
      );

    case "documents":
      return shell(
        <RecoveryDocumentsScreen
          documents={bundle.documents}
          checklist={checklist}
          busy={busy}
          error={error}
          onUpload={uploadDocument}
          onOpen={openDocument}
          onDelete={deleteDocument}
          onBack={() => setView("dashboard")}
        />
      );

    case "legal_aid":
      return shell(
        <RecoveryLegalAidScreen
          applications={bundle.legalAid}
          language={language}
          busy={busy}
          error={error}
          onSave={saveLegalAid}
          onDelete={async (id) => {
            await run(async () => {
              await recoveryService.deleteLegalAid(id);
              await refresh(bundle.case.id);
            });
          }}
          onBack={() => setView("dashboard")}
        />
      );

    case "financial":
      return shell(
        <RecoveryFinancialScreen
          financialImpacts={bundle.case.financialImpacts}
          priorAssistance={bundle.case.priorAssistance}
          incidentCategory={bundle.incident?.category}
          incidentImpacts={bundle.incident?.impacts ?? []}
          district={bundle.case.district}
          hasFir={bundle.fir?.hasFir}
          heldDocTypes={bundle.documents.map((d) => d.docType)}
          state={bundle.case.state}
          language={language}
          busy={busy}
          error={error}
          onSave={saveFinancial}
          onBack={() => setView("dashboard")}
        />
      );

    case "compensation":
      return shell(
        <RecoveryCompensationScreen
          bundle={bundle}
          language={language}
          busy={busy}
          error={error}
          onSave={saveCompensation}
          onDelete={async (id) => {
            await run(async () => {
              await recoveryService.deleteCompensation(id);
              await refresh(bundle.case.id);
            });
          }}
          onBack={() => setView("dashboard")}
        />
      );

    default:
      return shell(
        <>
          {error && (
            <div className="mb-6">
              <ErrorNote message={error} />
            </div>
          )}
          <RecoveryDashboard
            bundle={bundle}
            progress={progress}
            checklist={checklist}
            step={step}
            notifications={notifications}
            onGo={go}
            onDismissNotification={dismissNotification}
            onExportCase={exportCase}
            onDeleteCase={() => setConfirmDelete(true)}
          />
        </>
      );
  }
};
