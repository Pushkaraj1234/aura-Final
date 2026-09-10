import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { LanguageCode } from "../types";
import { Translations, getTranslation, hasBuiltInTranslation } from "../services/i18n";
import {
  LANGUAGE_OPTIONS,
  LanguageOption,
  cachedTranslation,
  ensureTranslations,
  isRtl,
  lastTranslationOutcome,
  loadSavedLanguage,
  saveLanguage,
  translateDictionary,
} from "../services/translation";
import {
  DomTranslationStatus,
  onDomTranslationStatus,
  startDomTranslation,
  stopDomTranslation,
} from "../services/domTranslator";

/**
 * One language for the whole app.
 *
 * Before this, the picker was local state inside the check-in page: choosing
 * Marathi changed that one screen and nothing else, and the choice was gone
 * the moment you navigated away or reloaded. Holding it here is what makes the
 * selector mean something — every screen reads the same value, and it is
 * written to storage so it survives the next visit.
 */

export type TranslationStatus = "ready" | "loading" | "degraded";

interface LanguageContextValue {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  /** The check-in dictionary in the active language. */
  t: Translations;
  /**
   * Translates an arbitrary English string. Returns the English until the
   * translation lands, then re-renders with it — so a screen is always
   * readable, never blank or half-loaded.
   */
  tr: (text: string) => string;
  status: TranslationStatus;
  /** Set when Bhashini could not be reached, so the UI can say so honestly. */
  degradedReason?: string;
  languages: LanguageOption[];
  rtl: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<LanguageCode>(() => loadSavedLanguage());
  const [t, setT] = useState<Translations>(() => getTranslation(loadSavedLanguage()));
  const [status, setStatus] = useState<TranslationStatus>("ready");
  const [degradedReason, setDegradedReason] = useState<string | undefined>();

  // Bumped whenever new translations arrive, to re-render consumers of `tr`
  // whose strings were English a moment ago.
  const [, setRevision] = useState(0);

  // Strings requested through `tr` that were not cached yet, gathered across a
  // render pass and fetched together on the next tick.
  const queue = useRef(new Set<string>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;

  const flush = useCallback(() => {
    const target = langRef.current;
    const texts: string[] = Array.from(queue.current);
    queue.current.clear();
    flushTimer.current = null;
    if (!texts.length || target === "en") return;

    setStatus("loading");
    ensureTranslations(texts, target).then(() => {
      // A language change mid-flight makes this result irrelevant.
      if (langRef.current !== target) return;
      const outcome = lastTranslationOutcome();
      setStatus(outcome.degraded ? "degraded" : "ready");
      setDegradedReason(outcome.degraded ? outcome.reason : undefined);
      setRevision((r) => r + 1);
    });
  }, []);

  const tr = useCallback(
    (text: string): string => {
      if (!text || langRef.current === "en") return text;
      const hit = cachedTranslation(text, langRef.current);
      if (hit !== undefined) return hit;

      queue.current.add(text);
      if (flushTimer.current === null) flushTimer.current = setTimeout(flush, 60);
      return text;
    },
    [flush]
  );

  // Load the check-in dictionary for the chosen language: instantly for the
  // three that ship with one, through Bhashini for the rest.
  useEffect(() => {
    let cancelled = false;

    if (hasBuiltInTranslation(lang)) {
      setT(getTranslation(lang));
      setStatus("ready");
      setDegradedReason(undefined);
      return;
    }

    // Show English while the translation is fetched rather than the previous
    // language's text, which would be actively misleading.
    setT(getTranslation("en"));
    setStatus("loading");

    translateDictionary(getTranslation("en"), lang).then((translated) => {
      if (cancelled) return;
      const outcome = lastTranslationOutcome();
      setT(translated);
      setStatus(outcome.degraded ? "degraded" : "ready");
      setDegradedReason(outcome.degraded ? outcome.reason : undefined);
    });

    return () => {
      cancelled = true;
    };
  }, [lang]);

  // Tell the browser what it is rendering, so screen readers announce it in
  // the right language and right-to-left scripts lay out correctly.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }, [lang]);

  // Translate the screens that were written with their English inline — which
  // is nearly all of them. Without this the picker changes the check-in
  // questionnaire and leaves every other page in English, which is what
  // "the language feature does not work" actually looked like.
  useEffect(() => {
    startDomTranslation(lang);
    return () => stopDomTranslation();
  }, [lang]);

  // Surface what that pass is doing. The page translates a few hundred strings
  // the first time a language is chosen, and on a real connection that takes
  // long enough that silence reads as failure — someone reloads, sees the now
  // cached translation appear instantly, and concludes the control only works
  // after a refresh.
  useEffect(
    () =>
      onDomTranslationStatus((domStatus: DomTranslationStatus) => {
        if (domStatus === "loading") {
          setStatus("loading");
          return;
        }
        setStatus(domStatus);
        setDegradedReason(
          domStatus === "degraded" ? lastTranslationOutcome().reason : undefined
        );
      }),
    []
  );

  const setLang = useCallback((next: LanguageCode) => {
    setLangState(next);
    saveLanguage(next);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang,
      t,
      tr,
      status,
      degradedReason,
      languages: LANGUAGE_OPTIONS,
      rtl: isRtl(lang),
    }),
    [lang, setLang, t, tr, status, degradedReason]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

/**
 * Reads the active language.
 *
 * Falls back to a working English context rather than throwing when used
 * outside the provider: a missing provider should never be the thing that
 * takes a wellbeing screen down.
 */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  return {
    lang: "en",
    setLang: () => {},
    t: getTranslation("en"),
    tr: (text: string) => text,
    status: "ready",
    languages: LANGUAGE_OPTIONS,
    rtl: false,
  };
}
