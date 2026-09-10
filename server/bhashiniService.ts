import dotenv from 'dotenv';

dotenv.config();

/**
 * Bhashini (MeitY / ULCA) translation, used to carry AURA's interface into the
 * scheduled Indian languages.
 *
 * This lives on the server for one reason: the Bhashini credentials must never
 * reach the browser bundle. Everything the client sees is translated text.
 *
 * Two things make this different from an ordinary API wrapper, and both shape
 * the code below:
 *
 *  1. A failed translation must never blank the screen. Someone opening this
 *     app is often already in distress, and untranslated English is vastly
 *     better than an empty page or an error dialog. Every failure path here
 *     returns the source strings unchanged and says so in `degraded`.
 *  2. Bhashini's pipeline call is two-legged — a config request that hands
 *     back an inference endpoint, an auth header and a service id, then the
 *     compute request itself. The config leg is stable for a given language
 *     pair, so it is cached rather than repeated per phrase.
 */

/** The public MeitY pipeline every Bhashini account can call. */
const DEFAULT_PIPELINE_ID = '64392f96daac500b55c543cd';
const DEFAULT_CONFIG_URL =
  'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const DEFAULT_COMPUTE_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';

/** Upstream calls are bounded so a slow pipeline degrades instead of hanging. */
const REQUEST_TIMEOUT_MS = 20000;

/** Config leases are re-fetched occasionally in case Bhashini rotates an endpoint. */
const CONFIG_TTL_MS = 30 * 60 * 1000;

/**
 * Every language Bhashini's translation models cover: the 22 languages of the
 * Eighth Schedule plus English. `native` is what the person picking the
 * language actually reads, so it is written in that language's own script.
 */
export interface BhashiniLanguage {
  code: string;
  english: string;
  native: string;
  /** Written right-to-left, so the interface has to mirror for it. */
  rtl?: boolean;
}

export const BHASHINI_LANGUAGES: BhashiniLanguage[] = [
  { code: 'en', english: 'English', native: 'English' },
  { code: 'as', english: 'Assamese', native: 'অসমীয়া' },
  { code: 'bn', english: 'Bengali', native: 'বাংলা' },
  { code: 'brx', english: 'Bodo', native: 'बड़ो' },
  { code: 'doi', english: 'Dogri', native: 'डोगरी' },
  { code: 'gom', english: 'Konkani', native: 'कोंकणी' },
  { code: 'gu', english: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'hi', english: 'Hindi', native: 'हिन्दी' },
  { code: 'kn', english: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ks', english: 'Kashmiri', native: 'کٲشُر', rtl: true },
  { code: 'mai', english: 'Maithili', native: 'मैथिली' },
  { code: 'ml', english: 'Malayalam', native: 'മലയാളം' },
  { code: 'mni', english: 'Manipuri', native: 'ꯃꯤꯇꯩꯂꯣꯟ' },
  { code: 'mr', english: 'Marathi', native: 'मराठी' },
  { code: 'ne', english: 'Nepali', native: 'नेपाली' },
  { code: 'or', english: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'pa', english: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'sa', english: 'Sanskrit', native: 'संस्कृतम्' },
  { code: 'sat', english: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ' },
  { code: 'sd', english: 'Sindhi', native: 'سنڌي', rtl: true },
  { code: 'ta', english: 'Tamil', native: 'தமிழ்' },
  { code: 'te', english: 'Telugu', native: 'తెలుగు' },
  { code: 'ur', english: 'Urdu', native: 'اردو', rtl: true },
];

const LANGUAGE_CODES = new Set(BHASHINI_LANGUAGES.map((l) => l.code));

export const isSupportedLanguage = (code: string): boolean => LANGUAGE_CODES.has(code);

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

interface BhashiniCredentials {
  /** ULCA user id, when the account uses the userID + ulcaApiKey pairing. */
  userId: string;
  /** The Udyat / ULCA key that authorises the pipeline-config call. */
  ulcaApiKey: string;
  /** The inference key that authorises the compute call. */
  inferenceApiKey: string;
  pipelineId: string;
  configUrl: string;
  computeUrl: string;
}

function readCredentials(): BhashiniCredentials {
  return {
    userId: (process.env.BHASHINI_USER_ID || '').trim(),
    ulcaApiKey: (process.env.BHASHINI_UDYAT_KEY || process.env.BHASHINI_API_KEY || '').trim(),
    inferenceApiKey: (process.env.BHASHINI_INFERENCE_API_KEY || '').trim(),
    pipelineId: (process.env.BHASHINI_PIPELINE_ID || DEFAULT_PIPELINE_ID).trim(),
    configUrl: (process.env.BHASHINI_CONFIG_URL || DEFAULT_CONFIG_URL).trim(),
    computeUrl: (process.env.BHASHINI_COMPUTE_URL || DEFAULT_COMPUTE_URL).trim(),
  };
}

/**
 * True when there is at least one usable way to reach Bhashini. Either key
 * alone is enough: the Udyat key drives the config leg, and the inference key
 * can address the compute endpoint directly.
 */
export function isBhashiniConfigured(): boolean {
  const c = readCredentials();
  return !!(c.ulcaApiKey || c.inferenceApiKey);
}

export function bhashiniConfigSummary() {
  const c = readCredentials();
  return {
    configured: !!(c.ulcaApiKey || c.inferenceApiKey),
    BHASHINI_UDYAT_KEY: !!c.ulcaApiKey,
    BHASHINI_INFERENCE_API_KEY: !!c.inferenceApiKey,
    BHASHINI_USER_ID: !!c.userId,
    pipelineId: c.pipelineId,
    computeUrl: c.computeUrl,
    languages: BHASHINI_LANGUAGES.length,
  };
}

// ---------------------------------------------------------------------------
// Pipeline configuration
// ---------------------------------------------------------------------------

interface PipelineLease {
  computeUrl: string;
  authHeaderName: string;
  authHeaderValue: string;
  serviceId: string;
  fetchedAt: number;
  /** How the lease was obtained, surfaced by the diagnostics route. */
  via: 'config' | 'direct';
}

const leases = new Map<string, PipelineLease>();

async function fetchJson(
  url: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; body: any; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body, text };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Asks ULCA which service handles a language pair and where to send it.
 *
 * Bhashini hands back the compute endpoint, the header name it expects its
 * inference key under, and the service id for the pair — none of which are
 * safe to hard-code, because they differ per account and change over time.
 */
async function requestLease(source: string, target: string): Promise<PipelineLease> {
  const c = readCredentials();
  const key = `${source}|${target}`;

  const cached = leases.get(key);
  if (cached && Date.now() - cached.fetchedAt < CONFIG_TTL_MS) return cached;

  let configError = '';

  if (c.ulcaApiKey) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ulcaApiKey: c.ulcaApiKey,
      // Some accounts authorise the config call by Authorization instead of
      // ulcaApiKey. Sending both is accepted by ULCA and saves a round trip
      // guessing which shape this account was issued.
      Authorization: c.ulcaApiKey,
    };
    if (c.userId) headers.userID = c.userId;

    const res = await fetchJson(c.configUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pipelineTasks: [
          {
            taskType: 'translation',
            config: { language: { sourceLanguage: source, targetLanguage: target } },
          },
        ],
        pipelineRequestConfig: { pipelineId: c.pipelineId },
      }),
    });

    if (res.ok && res.body) {
      const endpoint = res.body.pipelineInferenceAPIEndPoint || {};
      const serviceId =
        res.body?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId ||
        process.env.BHASHINI_SERVICE_ID ||
        '';
      const headerName = endpoint?.inferenceApiKey?.name;
      const headerValue = endpoint?.inferenceApiKey?.value;

      if (endpoint?.callbackUrl && headerName && headerValue && serviceId) {
        const lease: PipelineLease = {
          computeUrl: endpoint.callbackUrl,
          authHeaderName: headerName,
          authHeaderValue: headerValue,
          serviceId,
          fetchedAt: Date.now(),
          via: 'config',
        };
        leases.set(key, lease);
        return lease;
      }
      configError = 'pipeline config response was missing a callback URL, key or service id';
    } else {
      configError = `pipeline config returned HTTP ${res.status}${
        res.text ? `: ${res.text.slice(0, 300)}` : ''
      }`;
    }
  }

  // Fall back to addressing the inference endpoint directly. This is the path
  // for accounts issued only an inference key, and the reason a config-leg
  // outage does not take translation down with it.
  if (c.inferenceApiKey) {
    const lease: PipelineLease = {
      computeUrl: c.computeUrl,
      authHeaderName: 'Authorization',
      authHeaderValue: c.inferenceApiKey,
      serviceId: (process.env.BHASHINI_SERVICE_ID || '').trim(),
      fetchedAt: Date.now(),
      via: 'direct',
    };
    leases.set(key, lease);
    return lease;
  }

  throw new Error(
    configError ||
      'No Bhashini credentials are set. Configure BHASHINI_UDYAT_KEY and BHASHINI_INFERENCE_API_KEY.'
  );
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

export interface TranslateResult {
  /** One translation per input, in the same order. */
  translations: string[];
  /** True when the source strings were passed through untranslated. */
  degraded: boolean;
  /** Why it degraded, for the diagnostics route and the server log. */
  reason?: string;
  via?: 'config' | 'direct';
}

/**
 * Translates a batch of strings.
 *
 * Batching matters more than it looks: the interface is a few hundred short
 * phrases, and sending them one per request would be hundreds of round trips
 * on a connection that, for the people this app is for, is often a shared
 * phone on mobile data.
 */
export async function translateBatch(
  texts: string[],
  target: string,
  source = 'en'
): Promise<TranslateResult> {
  const clean = texts.map((t) => (typeof t === 'string' ? t : ''));

  // Nothing to do — and never worth a network call.
  if (target === source || clean.every((t) => !t.trim())) {
    return { translations: clean, degraded: false };
  }

  if (!isSupportedLanguage(target)) {
    return {
      translations: clean,
      degraded: true,
      reason: `"${target}" is not one of the languages Bhashini translates.`,
    };
  }

  let lease: PipelineLease;
  try {
    lease = await requestLease(source, target);
  } catch (err: any) {
    return { translations: clean, degraded: true, reason: err?.message || String(err) };
  }

  // Blank entries are kept out of the payload and stitched back afterwards, so
  // an empty string never costs a model call or comes back as stray text.
  const indices: number[] = [];
  const payload: { source: string }[] = [];
  clean.forEach((text, i) => {
    if (text.trim()) {
      indices.push(i);
      payload.push({ source: text });
    }
  });

  const taskConfig: Record<string, any> = {
    language: { sourceLanguage: source, targetLanguage: target },
  };
  if (lease.serviceId) taskConfig.serviceId = lease.serviceId;

  const res = await fetchJson(lease.computeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [lease.authHeaderName]: lease.authHeaderValue,
    },
    body: JSON.stringify({
      pipelineTasks: [{ taskType: 'translation', config: taskConfig }],
      inputData: { input: payload },
    }),
  }).catch((err: any) => ({
    ok: false,
    status: 0,
    body: null,
    text: err?.name === 'AbortError' ? 'Bhashini did not respond in time.' : String(err?.message || err),
  }));

  if (!res.ok) {
    // A stale lease is the likeliest cause of a 401/403, so drop it and let
    // the next request negotiate a fresh one rather than failing forever.
    if (res.status === 401 || res.status === 403) leases.delete(`${source}|${target}`);
    return {
      translations: clean,
      degraded: true,
      via: lease.via,
      reason: `Bhashini returned HTTP ${res.status}${res.text ? `: ${res.text.slice(0, 300)}` : ''}`,
    };
  }

  const output = res.body?.pipelineResponse?.[0]?.output;
  if (!Array.isArray(output)) {
    return {
      translations: clean,
      degraded: true,
      via: lease.via,
      reason: 'Bhashini responded without a translation payload.',
    };
  }

  const translations = [...clean];
  indices.forEach((originalIndex, i) => {
    const target = output[i]?.target;
    if (typeof target === 'string' && target.trim()) translations[originalIndex] = target;
  });

  return { translations, degraded: false, via: lease.via };
}

/** Clears cached pipeline leases. Used by the diagnostics route. */
export function resetBhashiniCache(): void {
  leases.clear();
}
