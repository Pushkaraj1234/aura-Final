import { FirstAidCategory, FirstAidItem, FirstAidKit } from "../types";

/**
 * The prompts behind a person's own first-aid kit.
 *
 * Every one asks for something concrete and specific to them — a song, a
 * street, a name — rather than a technique. Generic advice is what the app
 * already offers elsewhere; the whole value here is that the answers could
 * only have come from this person, so they still mean something at the moment
 * they are least able to think.
 *
 * The example text is deliberately ordinary and low-cost. Someone reading
 * these in a shelter with a shared phone should recognise their own life in
 * them, not a life with a garden and a quiet afternoon.
 */

export interface FirstAidPrompt {
  category: FirstAidCategory;
  label: string;
  /** The question, in the second person. */
  question: string;
  /** Placeholder — an example, never a suggestion to adopt. */
  placeholder: string;
  /** Why this one is worth having, shown small. */
  why: string;
}

export const FIRST_AID_PROMPTS: FirstAidPrompt[] = [
  {
    category: "sounds",
    label: "Sounds & songs",
    question: "What do you want to hear?",
    placeholder: "A song, a recording, a prayer, someone's voice note",
    why: "Sound reaches you when reading feels like too much.",
  },
  {
    category: "places",
    label: "Places",
    question: "Where do you go when you need to be somewhere else?",
    placeholder: "The tea stall, the roof, the walk by the water, one particular room",
    why: "Naming it in advance means you do not have to decide when you are already struggling.",
  },
  {
    category: "people",
    label: "People",
    question: "Who could you message, even without explaining why?",
    placeholder: "A name, and how you would reach them",
    why: "Contact helps even when the conversation is about nothing at all.",
  },
  {
    category: "grounding",
    label: "Things that settle me",
    question: "What object, photo, taste or smell brings you back?",
    placeholder: "A photo, a shawl, sweet tea, cold water on your face",
    why: "Physical and specific works better than an instruction to calm down.",
  },
  {
    category: "hands",
    label: "Something to do with my hands",
    question: "What can you do that occupies your hands?",
    placeholder: "Cooking one dish, sweeping, drawing, fixing something, prayer beads",
    why: "Doing usually arrives before feeling better, not after it.",
  },
  {
    category: "words",
    label: "Words for myself",
    question: "What would you want to hear right now — and who would say it?",
    placeholder: "What you would tell a friend in your position",
    why: "Written now, it can be read later by a version of you who cannot think of it.",
  },
  {
    category: "signs",
    label: "How I know it is starting",
    question: "What happens first, before it gets bad?",
    placeholder: "I stop answering messages · I stop eating · I cannot sleep · I get angry quickly",
    why: "Catching it early is worth more than anything else on this list.",
  },
];

export const PROMPT_BY_CATEGORY: Record<FirstAidCategory, FirstAidPrompt> =
  FIRST_AID_PROMPTS.reduce((acc, p) => {
    acc[p.category] = p;
    return acc;
  }, {} as Record<FirstAidCategory, FirstAidPrompt>);

export const EMPTY_KIT: FirstAidKit = { items: [], shareWithWorker: false, updatedAt: "" };

/** Longest a single entry may be. Long enough for a sentence, not an essay. */
export const MAX_ITEM_LENGTH = 160;

/** Guards against one category being filled until the kit is unreadable. */
export const MAX_ITEMS_PER_CATEGORY = 6;

export const newItemId = (): string =>
  `fa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function itemsIn(kit: FirstAidKit | undefined, category: FirstAidCategory): FirstAidItem[] {
  return (kit?.items || []).filter((i) => i.category === category);
}

export function kitItemCount(kit: FirstAidKit | undefined): number {
  return kit?.items?.length ?? 0;
}

export function hasKit(kit: FirstAidKit | undefined): boolean {
  return kitItemCount(kit) > 0;
}

/**
 * Adds an entry, returning a new kit. Rejects blanks, duplicates within the
 * same category, and anything past the per-category cap — returning the kit
 * unchanged rather than throwing, because this runs on a keystroke path and a
 * refused entry is not an error worth interrupting anyone with.
 */
export function addItem(
  kit: FirstAidKit | undefined,
  category: FirstAidCategory,
  rawText: string
): FirstAidKit {
  const base = kit ?? EMPTY_KIT;
  const text = rawText.trim().slice(0, MAX_ITEM_LENGTH);
  if (!text) return base;

  const existing = itemsIn(base, category);
  if (existing.length >= MAX_ITEMS_PER_CATEGORY) return base;
  if (existing.some((i) => i.text.toLowerCase() === text.toLowerCase())) return base;

  return {
    ...base,
    items: [...base.items, { id: newItemId(), category, text }],
    updatedAt: new Date().toISOString(),
  };
}

export function removeItem(kit: FirstAidKit | undefined, id: string): FirstAidKit {
  const base = kit ?? EMPTY_KIT;
  return {
    ...base,
    items: base.items.filter((i) => i.id !== id),
    updatedAt: new Date().toISOString(),
  };
}

export function setSharing(kit: FirstAidKit | undefined, shareWithWorker: boolean): FirstAidKit {
  const base = kit ?? EMPTY_KIT;
  return { ...base, shareWithWorker, updatedAt: new Date().toISOString() };
}

/**
 * Normalises whatever came back from storage. Kits round-trip through
 * Supabase auth metadata as untyped JSON, so a malformed or half-written
 * value must degrade to an empty kit rather than crash the wellbeing board
 * someone opened while distressed.
 */
export function normalizeKit(raw: unknown): FirstAidKit | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const candidate = raw as Partial<FirstAidKit>;
  if (!Array.isArray(candidate.items)) return undefined;

  const valid = new Set<FirstAidCategory>(FIRST_AID_PROMPTS.map((p) => p.category));
  const items = candidate.items
    .filter(
      (i): i is FirstAidItem =>
        !!i &&
        typeof i === "object" &&
        typeof (i as FirstAidItem).text === "string" &&
        valid.has((i as FirstAidItem).category)
    )
    .map((i) => ({
      id: typeof i.id === "string" && i.id ? i.id : newItemId(),
      category: i.category,
      text: String(i.text).slice(0, MAX_ITEM_LENGTH),
    }));

  if (!items.length) return undefined;

  return {
    items,
    shareWithWorker: candidate.shareWithWorker === true,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
  };
}
