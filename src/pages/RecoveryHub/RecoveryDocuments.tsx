import React, { useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Check, FileText, Trash2, Upload } from "lucide-react";
import {
  EmptyState,
  ErrorNote,
  VerificationBadge,
  formatDate,
} from "../../components/Recovery/RecoveryPrimitives";
import { DOCUMENT_LABELS, type ChecklistSummary } from "../../services/recoveryHub";
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "../../services/recoveryService";
import type { DocumentType, RecoveryDocument } from "../../types/recovery";

/**
 * The document centre.
 *
 * THE CHECKLIST NEVER SAYS "REQUIRED"
 *
 * What an office actually demands varies by scheme, by state and by the facts
 * of a case. A checklist that told someone a caste certificate was required,
 * for a scheme that did not ask for it, sends them to spend a day at a
 * Tehsildar's office for nothing; one that said a document was optional when it
 * was not is worse. So the strongest phrasing here is "usually asked for", and
 * every item says why and where to get it.
 *
 * WHAT IS AND IS NOT PROMISED ABOUT SECURITY
 *
 * Files go to a private bucket, readable only through short-lived signed links,
 * and the type and size limits are enforced by the storage service rather than
 * by this page. They are not scanned for viruses, and this screen says so
 * rather than letting a padlock icon imply it.
 */

interface Props {
  documents: RecoveryDocument[];
  checklist: ChecklistSummary;
  busy: boolean;
  error: string | null;
  onUpload: (file: File, docType: DocumentType) => Promise<void>;
  onOpen: (doc: RecoveryDocument) => Promise<void>;
  onDelete: (doc: RecoveryDocument) => Promise<void>;
  onBack: () => void;
}

const ACCEPT = ALLOWED_DOCUMENT_TYPES.join(",");

export const RecoveryDocumentsScreen: React.FC<Props> = ({
  documents,
  checklist,
  busy,
  error,
  onUpload,
  onOpen,
  onDelete,
  onBack,
}) => {
  const [pendingType, setPendingType] = useState<DocumentType>("fir");
  const fileInput = useRef<HTMLInputElement>(null);

  const grouped = new Map<string, typeof checklist.items>();
  for (const item of checklist.items) {
    grouped.set(item.group, [...(grouped.get(item.group) ?? []), item]);
  }

  const pick = (docType: DocumentType) => {
    setPendingType(docType);
    fileInput.current?.click();
  };

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
          Document centre
        </span>
        <h2 className="text-[1.75rem] sm:text-[2.125rem] leading-[1.15] text-[#3A2A1E]">
          Your documents, in one place
        </h2>
        <p className="max-w-[58ch] text-[1rem] leading-[1.7] text-[#6B5B4C]">
          Whatever you already have. You can add the rest later, and nothing
          here has to be complete for your file to be useful.
        </p>
      </header>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) await onUpload(file, pendingType);
        }}
      />

      {error && <ErrorNote message={error} />}

      {/* Checklist ---------------------------------------------------------- */}
      <section className="card-elev rounded-2xl p-5 sm:p-6">
        <header className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-[1.125rem] leading-[1.3] text-[#3A2A1E]">
            What applications usually ask for
          </h3>
          <span className="text-[0.875rem] font-semibold text-[#8A4A20]">
            {checklist.completed} of {checklist.total} added
          </span>
        </header>
        <p className="mb-5 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
          Based on what you&rsquo;ve told us. Requirements differ between
          schemes and states, so treat this as a good starting list rather than
          a definitive one.
        </p>

        <div
          role="progressbar"
          aria-valuenow={checklist.completed}
          aria-valuemin={0}
          aria-valuemax={checklist.total}
          aria-label="Documents added"
          className="mb-6 h-2 w-full overflow-hidden rounded-full bg-[#EDE2D4]"
        >
          <div
            className="h-full rounded-full bg-[#A85D2E] transition-[width] duration-300 ease-out"
            style={{
              width: `${checklist.total ? (checklist.completed / checklist.total) * 100 : 0}%`,
            }}
          />
        </div>

        <div className="space-y-6">
          {[...grouped.entries()].map(([group, items]) => (
            <div key={group}>
              <h4 className="mb-2.5 text-[0.75rem] uppercase tracking-[0.12em] text-[#7A6A5A]">
                {group}
              </h4>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li
                    key={item.docType}
                    className="rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] px-4 py-3.5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-[#3A2A1E]">
                          {item.present ? (
                            <Check size={15} aria-hidden="true" className="text-[#5E7A4A]" />
                          ) : (
                            <AlertCircle size={15} aria-hidden="true" className="text-[#A8763E]" />
                          )}
                          {DOCUMENT_LABELS[item.docType]}
                          <span className="font-normal text-[0.75rem] text-[#7A6A5A]">
                            {item.weight === "commonly_asked_for"
                              ? "usually asked for"
                              : "may help"}
                          </span>
                        </p>
                        <p className="mt-1.5 text-[0.875rem] leading-[1.6] text-[#6B5B4C]">
                          {item.why}
                        </p>
                        {!item.present && item.howToGet && (
                          <p className="mt-1.5 text-[0.875rem] leading-[1.6] text-[#7A6A5A]">
                            {item.howToGet}
                          </p>
                        )}
                      </div>
                      {!item.present && (
                        <button
                          onClick={() => pick(item.docType)}
                          disabled={busy}
                          className="btn-soft shrink-0 px-4 py-2.5 text-[0.8125rem] disabled:opacity-60"
                        >
                          <Upload size={14} aria-hidden="true" />
                          Add
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Uploaded ----------------------------------------------------------- */}
      <section className="card-elev rounded-2xl p-5 sm:p-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-[1.125rem] leading-[1.3] text-[#3A2A1E]">
            What you&rsquo;ve added
          </h3>
          <button
            onClick={() => pick("other")}
            disabled={busy}
            className="btn-ghost px-4 py-2.5 text-[0.8125rem] disabled:opacity-60"
          >
            <Upload size={14} aria-hidden="true" />
            Add something else
          </button>
        </header>

        {documents.length === 0 ? (
          <EmptyState
            message="Your document centre is empty."
            actionLabel="Add a document"
            onAction={() => pick("other")}
          />
        ) : (
          <ul className="space-y-2.5">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] px-4 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FileText size={18} aria-hidden="true" className="shrink-0 text-[#9A8B77]" />
                  <div className="min-w-0">
                    <p className="truncate text-[0.9375rem] font-semibold text-[#3A2A1E]">
                      {doc.label || DOCUMENT_LABELS[doc.docType]}
                    </p>
                    <p className="text-[0.75rem] text-[#7A6A5A]">
                      Added {formatDate(doc.uploadedAt)}
                      {doc.sizeBytes ? ` · ${Math.round(doc.sizeBytes / 1024)} KB` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <VerificationBadge verification={doc.verification} />
                  <button
                    onClick={() => onOpen(doc)}
                    className="btn-ghost px-3.5 py-2 text-[0.8125rem]"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => onDelete(doc)}
                    aria-label={`Remove ${doc.label || DOCUMENT_LABELS[doc.docType]}`}
                    className="rounded-xl border border-[#ECE1D3] bg-white p-2 text-[#8A7A6B] transition-colors hover:border-[#E4C3B4] hover:text-[#8A3F20]"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] p-5 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
        <p className="font-semibold text-[#3A2A1E]">How these are kept</p>
        <p className="mt-2 max-w-[66ch]">
          Documents are stored privately and only ever opened through a link
          that expires after a few minutes. Nobody else using AURA can reach
          them, and neither can a counsellor. PDFs and photos up to{" "}
          {Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB are accepted.
          They are not scanned for viruses, so only upload files you trust, and
          you can delete any of them at any time.
        </p>
      </div>

      <button onClick={onBack} className="btn-ghost px-5 py-3 text-[0.9375rem]">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to my recovery
      </button>
    </div>
  );
};
