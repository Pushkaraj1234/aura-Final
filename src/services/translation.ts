import { LanguageCode } from "../types";

/**
 * Client side of Bhashini translation.
 *
 * Three things drive the design, all of them about the phone this runs on
 * rather than the API at the other end:
 *
 *  - **Cache hard.** The interface is a fixed set of a few hundred phrases. A
 *    person checking in daily should pay for translating them once, not once
 *    per visit, so results are kept in localStorage against the source text.
 *  - **Coalesce.** Screens ask for strings independently and all at once. Every
 *    request inside the same tick is gathered into one network call, because on
 *    a shared phone over mobile data the round trips cost more than the bytes.
 *  - **Never block the screen.** Nothing here throws or rejects. If Bhashini is
 *    unreachable the caller gets English, which is readable, rather than a
 *    spinner that never resolves.
 */

const CACHE_PREFIX = "aura_i18n_v1_";
const LANGUAGE_KEY = "aura_language";

/** Bounded so a long-running install cannot fill a device's storage quota. */
const MAX_CACHED_ENTRIES_PER_LANGUAGE = 1200;

/** Bhashini is asked for at most this many strings in one request. */
const MAX_BATCH = 200;

export interface LanguageOption {
  code: LanguageCode;
  english: string;
  native: string;
  rtl?: boolean;
}

/**
 * The picker's contents, duplicated from the server list so the selector can
 * render before — or entirely without — a network call. The server remains the
 * authority; this is the offline-safe copy.
 */
export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", english: "English", native: "English" },
  { code: "as", english: "Assamese", native: "অসমীয়া" },
  { code: "bn", english: "Bengali", native: "বাংলা" },
  { code: "brx", english: "Bodo", native: "बड़ो" },
  { code: "doi", english: "Dogri", native: "डोगरी" },
  { code: "gom", english: "Konkani", native: "कोंकणी" },
  { code: "gu", english: "Gujarati", native: "ગુજરાતી" },
  { code: "hi", english: "Hindi", native: "हिन्दी" },
  { code: "kn", english: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ks", english: "Kashmiri", native: "کٲشُر", rtl: true },
  { code: "mai", english: "Maithili", native: "मैथिली" },
  { code: "ml", english: "Malayalam", native: "മലയാളം" },
  { code: "mni", english: "Manipuri", native: "ꯃꯤꯇꯩꯂꯣꯟ" },
  { code: "mr", english: "Marathi", native: "मराठी" },
  { code: "ne", english: "Nepali", native: "नेपाली" },
  { code: "or", english: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "pa", english: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "sa", english: "Sanskrit", native: "संस्कृतम्" },
  { code: "sat", english: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { code: "sd", english: "Sindhi", native: "سنڌي", rtl: true },
  { code: "ta", english: "Tamil", native: "தமிழ்" },
  { code: "te", english: "Telugu", native: "తెలుగు" },
  { code: "ur", english: "Urdu", native: "اردو", rtl: true },
];

export const LANGUAGE_BY_CODE: Record<string, LanguageOption> = LANGUAGE_OPTIONS.reduce(
  (acc, l) => {
    acc[l.code] = l;
    return acc;
  },
  {} as Record<string, LanguageOption>
);

export const isRtl = (lang: LanguageCode): boolean => !!LANGUAGE_BY_CODE[lang]?.rtl;

// ---------------------------------------------------------------------------
// Persisted choice
// ---------------------------------------------------------------------------

export function loadSavedLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved && LANGUAGE_BY_CODE[saved]) return saved as LanguageCode;
  } catch {
    // Private browsing or blocked storage — English is a fine default.
  }
  return "en";
}

export function saveLanguage(lang: LanguageCode): void {
  try {
    localStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    // The choice still applies for this session; it just will not survive it.
  }
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

type CacheShape = Record<string, string>;

const memory = new Map<LanguageCode, CacheShape>();

function cacheFor(lang: LanguageCode): CacheShape {
  const held = memory.get(lang);
  if (held) return held;

  let loaded: CacheShape = {};
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + lang);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) loaded = parsed;
    }
  } catch {
    // A corrupt or unreadable cache is simply an empty one.
  }
  memory.set(lang, loaded);
  return loaded;
}

function persist(lang: LanguageCode): void {
  const cache = memory.get(lang);
  if (!cache) return;
  try {
    const keys = Object.keys(cache);
    // Trimming oldest-first is not possible without timestamps, and timestamps
    // would double the stored size for a cache this small. Dropping the tail
    // is enough: the interface re-requests whatever it still needs.
    if (keys.length > MAX_CACHED_ENTRIES_PER_LANGUAGE) {
      const trimmed: CacheShape = {};
      keys.slice(-MAX_CACHED_ENTRIES_PER_LANGUAGE).forEach((k) => {
        trimmed[k] = cache[k];
      });
      memory.set(lang, trimmed);
      localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(trimmed));
      return;
    }
    localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(cache));
  } catch {
    // Over quota: the in-memory cache still serves this session.
  }
}

/** Reads a translation already known for this language, if there is one. */
export function cachedTranslation(text: string, lang: LanguageCode): string | undefined {
  if (lang === "en") return text;
  return cacheFor(lang)[text];
}

export function clearTranslationCache(lang?: LanguageCode): void {
  try {
    if (lang) {
      memory.delete(lang);
      localStorage.removeItem(CACHE_PREFIX + lang);
      return;
    }
    memory.clear();
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    memory.clear();
  }
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

export interface TranslationOutcome {
  /** True when the server could not translate and returned the source text. */
  degraded: boolean;
  reason?: string;
}

let lastOutcome: TranslationOutcome = { degraded: false };

export const lastTranslationOutcome = (): TranslationOutcome => lastOutcome;

async function postBatch(texts: string[], target: LanguageCode): Promise<string[]> {
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, target, source: "en" }),
    });

    if (!res.ok) {
      lastOutcome = { degraded: true, reason: `Translation service returned HTTP ${res.status}.` };
      return texts;
    }

    const body = await res.json();
    const out = Array.isArray(body?.translations) ? body.translations : texts;
    lastOutcome = body?.degraded
      ? { degraded: true, reason: body?.reason }
      : { degraded: false };
    return out.map((t: unknown, i: number) => (typeof t === "string" && t ? t : texts[i]));
  } catch (err: any) {
    lastOutcome = { degraded: true, reason: err?.message || "Translation service unreachable." };
    return texts;
  }
}

/** Requests in flight, so the same phrase is never fetched twice at once. */
const pending = new Map<string, Promise<void>>();

/**
 * Ensures every one of `texts` has a translation cached for `lang`, fetching
 * only what is missing. Resolves when the cache is as complete as it is going
 * to get — including when Bhashini failed and the English was kept.
 */
export async function ensureTranslations(
  texts: string[],
  lang: LanguageCode
): Promise<void> {
  if (lang === "en") return;

  const cache = cacheFor(lang);
  const missing = Array.from(
    new Set(texts.filter((t) => typeof t === "string" && t.trim() && !(t in cache)))
  );
  if (!missing.length) return;

  // Join any batch already fetching these exact strings rather than issuing a
  // second identical request — screens mount together and ask together.
  const key = `${lang}:${missing.length}:${missing[0]}:${missing[missing.length - 1]}`;
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const work = (async () => {
    for (let i = 0; i < missing.length; i += MAX_BATCH) {
      const slice = missing.slice(i, i + MAX_BATCH);
      const translated = await postBatch(slice, lang);
      slice.forEach((source, idx) => {
        const value = translated[idx];
        // Storing the English when translation failed would poison the cache
        // permanently, so only real translations are kept.
        if (typeof value === "string" && value && value !== source) cache[source] = value;
      });
    }
    persist(lang);
  })().finally(() => {
    pending.delete(key);
  });

  pending.set(key, work);
  return work;
}

/** Translates one string, returning English until the translation arrives. */
export function translateNow(text: string, lang: LanguageCode): string {
  if (lang === "en" || !text) return text;
  return cacheFor(lang)[text] ?? text;
}

// ---------------------------------------------------------------------------
// Translating a whole dictionary object
// ---------------------------------------------------------------------------

/** Collects every string leaf in a nested object, with its path. */
function collectStrings(value: any, path: string[], out: { path: string[]; text: string }[]): void {
  if (typeof value === "string") {
    if (value.trim()) out.push({ path: [...path], text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectStrings(v, [...path, String(i)], out));
    return;
  }
  // Functions (the pluralised helpers) are left alone: their output is built
  // from a count at call time, so there is no fixed string to translate.
  if (value && typeof value === "object") {
    Object.keys(value).forEach((k) => collectStrings(value[k], [...path, k], out));
  }
}

function setAtPath(root: any, path: string[], value: string): void {
  let node = root;
  for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
  node[path[path.length - 1]] = value;
}

/**
 * Produces a translated copy of a dictionary object.
 *
 * Functions and structure are preserved; only string leaves change. Used to
 * carry the whole check-in questionnaire into a language that has no
 * hand-written dictionary, in a single batched call.
 */
export async function translateDictionary<T extends object>(
  dictionary: T,
  lang: LanguageCode
): Promise<T> {
  if (lang === "en") return dictionary;

  const leaves: { path: string[]; text: string }[] = [];
  collectStrings(dictionary, [], leaves);

  await ensureTranslations(
    leaves.map((l) => l.text),
    lang
  );

  // structuredClone drops functions, so the copy is built by hand to keep the
  // helpers (stepOf, pendingSync) callable on the translated object.
  const copy = cloneWithFunctions(dictionary);
  leaves.forEach(({ path, text }) => {
    const translated = translateNow(text, lang);
    if (translated !== text) setAtPath(copy, path, translated);
  });
  return copy;
}

function cloneWithFunctions<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => cloneWithFunctions(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: any = {};
    Object.keys(value as any).forEach((k) => {
      out[k] = cloneWithFunctions((value as any)[k]);
    });
    return out;
  }
  return value;
}
