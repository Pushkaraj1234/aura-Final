import { LanguageCode } from "../types";
import { cachedTranslation, ensureTranslations, lastTranslationOutcome } from "./translation";

/**
 * Translates the rendered interface in place.
 *
 * Why this exists rather than a `t("...")` call on every string: AURA's screens
 * were written with their English text inline, across roughly thirty thousand
 * lines. Threading a lookup through all of it would touch every file and every
 * component, and each missed string would be a sentence of English stranded in
 * the middle of a Tamil page — the failure mode is invisible until someone who
 * cannot read English hits it. Walking the DOM covers everything by
 * construction, including text that was never routed through the dictionary.
 *
 * The hand-written dictionaries still win where they exist: the check-in
 * questionnaire renders from TRANSLATIONS before this ever sees it, so those
 * strings arrive already translated and are left alone.
 *
 * WHAT IS DELIBERATELY NOT TRANSLATED
 *
 * A person's own words never leave the browser through here. Reflections,
 * notes, messages, first-aid kit entries and names are marked
 * `data-no-translate` at their source and skipped, because sending a survivor's
 * account of what happened to them to a third-party translation service is not
 * something a wellbeing app should do quietly in the background. Anything
 * unmarked is interface copy the repository already contains in plain sight.
 */

/** Elements whose text is never interface copy. */
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "TEXTAREA",
  "SVG",
  "PATH",
]);

/** Attributes that hold visible text and so are translated alongside it. */
const TEXT_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"];

/** Marks a subtree as the person's own content. */
const OPT_OUT_SELECTOR = "[data-no-translate]";

/**
 * Worth translating? Numbers, scores, dates, initials and punctuation runs are
 * left as they are — translating "47 / 100" or "P-1042" can only damage it.
 */
function isTranslatable(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  // Needs at least two consecutive Latin letters to be a word rather than a
  // label like "5/5" or an already-translated Devanagari string.
  if (!/[A-Za-z]{2}/.test(trimmed)) return false;
  // Skip anything that is mostly digits and symbols with a stray letter.
  const letters = (trimmed.match(/[A-Za-z]/g) || []).length;
  return letters >= trimmed.length * 0.4;
}

interface Recorded {
  /** The English the node held before anything was applied. */
  source: string;
  /** What was last written into it, so React's own updates are detectable. */
  applied?: string;
}

const nodeState = new WeakMap<Node, Recorded>();
const attrState = new WeakMap<Element, Map<string, Recorded>>();

function shouldSkip(node: Node): boolean {
  let el: Element | null =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;

  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.hasAttribute?.("data-no-translate")) return true;
    el = el.parentElement;
  }
  return false;
}

/**
 * Every text node and text-bearing attribute currently on screen.
 *
 * `ordered` lists the distinct source strings with anything currently in the
 * viewport first. Since batches are fetched and applied in order, that means
 * the part of the page the person is actually looking at changes first,
 * instead of the translation arriving top-to-bottom through content they have
 * already scrolled past.
 */
function collect(root: Node): {
  ordered: string[];
  nodes: Text[];
  attrs: [Element, string][];
} {
  const onScreen: string[] = [];
  const offScreen: string[] = [];
  const seen = new Set<string>();
  const nodes: Text[] = [];
  const attrs: [Element, string][] = [];

  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight || 0 : 0;

  const record = (text: string, el: Element | null) => {
    const key = text.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    let visible = false;
    try {
      const rect = el?.getBoundingClientRect();
      visible = !!rect && rect.bottom >= 0 && rect.top <= viewportHeight;
    } catch {
      // getBoundingClientRect can throw on a detached node; treat as off-screen.
    }
    (visible ? onScreen : offScreen).push(key);
  };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (shouldSkip(node)) return NodeFilter.FILTER_REJECT;
        return isTranslatable(node.nodeValue || "")
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
      // Elements are visited only so their attributes can be read.
      if (SKIP_TAGS.has((node as Element).tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.currentNode;
  const consider = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      const recorded = nodeState.get(textNode);
      const value = textNode.nodeValue || "";
      // If React replaced the text since it was last written, the new value is
      // the source from now on.
      const source = recorded && recorded.applied === value ? recorded.source : value;
      if (!isTranslatable(source)) return;
      nodeState.set(textNode, { source, applied: recorded?.applied });
      nodes.push(textNode);
      record(source, textNode.parentElement);
      return;
    }

    const el = node as Element;
    if (el.closest?.(OPT_OUT_SELECTOR)) return;
    TEXT_ATTRIBUTES.forEach((name) => {
      const value = el.getAttribute?.(name);
      if (!value || !isTranslatable(value)) return;
      let map = attrState.get(el);
      if (!map) {
        map = new Map();
        attrState.set(el, map);
      }
      const recorded = map.get(name);
      const source = recorded && recorded.applied === value ? recorded.source : value;
      map.set(name, { source, applied: recorded?.applied });
      attrs.push([el, name]);
      record(source, el);
    });
  };

  if (current) consider(current);
  while (walker.nextNode()) consider(walker.currentNode);

  return { ordered: [...onScreen, ...offScreen], nodes, attrs };
}

let observer: MutationObserver | null = null;
let currentLang: LanguageCode = "en";
let applying = false;
let scheduled: ReturnType<typeof setTimeout> | null = null;

/** Writes translations into the nodes gathered by the last sweep. */
function apply(nodes: Text[], attrs: [Element, string][], lang: LanguageCode): void {
  applying = true;
  try {
    nodes.forEach((node) => {
      const recorded = nodeState.get(node);
      if (!recorded) return;
      const translated =
        lang === "en" ? recorded.source : cachedTranslation(recorded.source.trim(), lang);
      if (translated === undefined) return;

      // Whitespace around a text node is layout, not content, so it is kept.
      const leading = recorded.source.match(/^\s*/)?.[0] ?? "";
      const trailing = recorded.source.match(/\s*$/)?.[0] ?? "";
      const next = lang === "en" ? recorded.source : `${leading}${translated}${trailing}`;
      if (node.nodeValue === next) return;
      node.nodeValue = next;
      nodeState.set(node, { source: recorded.source, applied: next });
    });

    attrs.forEach(([el, name]) => {
      const recorded = attrState.get(el)?.get(name);
      if (!recorded) return;
      const translated =
        lang === "en" ? recorded.source : cachedTranslation(recorded.source.trim(), lang);
      if (translated === undefined) return;
      if (el.getAttribute(name) === translated) return;
      el.setAttribute(name, translated);
      attrState.get(el)?.set(name, { source: recorded.source, applied: translated });
    });
  } finally {
    // Released on the next tick so the observer ignores this batch's own
    // mutations rather than treating them as fresh English to translate.
    setTimeout(() => {
      applying = false;
    }, 0);
  }
}

/**
 * What the language control is currently doing, so it can say so.
 *
 * Without this the picker was silent for Hindi and Marathi — their
 * questionnaire dictionary is built in, so the old status never left "ready"
 * even while every other string on the page was still being fetched. The
 * screen stayed English with nothing to explain why, which reads as broken.
 */
export type DomTranslationStatus = "ready" | "loading" | "degraded";

type StatusListener = (status: DomTranslationStatus) => void;

const statusListeners = new Set<StatusListener>();
let status: DomTranslationStatus = "ready";

export function onDomTranslationStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => statusListeners.delete(listener);
}

function setStatus(next: DomTranslationStatus): void {
  if (status === next) return;
  status = next;
  statusListeners.forEach((l) => {
    try {
      l(next);
    } catch {
      // A failing listener must not stop translation.
    }
  });
}

/** Re-reads the page and writes in whatever is cached for `lang`. */
function paint(lang: LanguageCode): void {
  const fresh = collect(document.body);
  apply(fresh.nodes, fresh.attrs, lang);
}

/** One sweep: gather, fetch what is missing, then write. */
function sweep(): void {
  if (typeof document === "undefined") return;
  const lang = currentLang;
  const { ordered, nodes, attrs } = collect(document.body);

  if (lang === "en") {
    apply(nodes, attrs, lang);
    setStatus("ready");
    return;
  }

  // Anything already cached is written immediately, so a screen that has been
  // seen before never flashes English.
  apply(nodes, attrs, lang);

  const missing = ordered.filter((t) => cachedTranslation(t, lang) === undefined);
  if (!missing.length) {
    setStatus("ready");
    return;
  }

  setStatus("loading");
  ensureTranslations(missing, lang, () => {
    // Paint each batch the moment it lands rather than waiting for the whole
    // page. This is the difference between text visibly filling in and a
    // language change that appears to do nothing at all.
    if (currentLang !== lang) return;
    paint(lang);
  })
    .then(() => {
      if (currentLang !== lang) return;
      paint(lang);
      setStatus(lastTranslationOutcome().degraded ? "degraded" : "ready");
    })
    .catch(() => {
      if (currentLang === lang) setStatus("degraded");
    });
}

function schedule(): void {
  if (scheduled !== null) return;
  scheduled = setTimeout(() => {
    scheduled = null;
    sweep();
  }, 120);
}

/**
 * Starts translating the live interface into `lang`, and keeps translating as
 * React renders new screens. Call again to change language; call the returned
 * function to stop.
 */
export function startDomTranslation(lang: LanguageCode): void {
  if (typeof document === "undefined") return;
  currentLang = lang;

  if (!observer) {
    observer = new MutationObserver((records) => {
      const meaningful = records.some((r) =>
        r.type === "childList" ? r.addedNodes.length > 0 : true
      );
      if (!meaningful) return;
      // Mutations that arrive while a batch is being written used to be
      // discarded. If React re-rendered in that window — which it does on a
      // language change, because the questionnaire dictionary swaps at the
      // same moment — the new English was never picked up, and the page only
      // came right on the next reload. Re-scheduling instead is safe: apply
      // writes nothing when the text already matches, so the follow-up sweep
      // produces no mutations of its own and the chain stops.
      schedule();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TEXT_ATTRIBUTES,
    });
  }

  sweep();
}

export function stopDomTranslation(): void {
  observer?.disconnect();
  observer = null;
  if (scheduled !== null) {
    clearTimeout(scheduled);
    scheduled = null;
  }
}
