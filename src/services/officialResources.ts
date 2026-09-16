/**
 * Official resources, as code rather than as data.
 *
 * WHY THESE ARE NOT ROWS IN support_resources
 *
 * That table is editable by counsellors and admins through the app, which is
 * right for helplines and shelters. It is wrong for these. A mistyped NALSA
 * address sends a survivor to a phishing clone of a government portal at the
 * exact moment they are about to type an FIR number into it. Constants go
 * through review and a deploy; rows do not.
 *
 * WHAT VERIFICATION MEANT HERE
 *
 * Every URL below was checked against search indexing on 16 September 2026 and
 * confirmed to exist and to serve what it claims. Direct fetches were blocked
 * by the build environment's egress policy, so what is NOT claimed is that any
 * given page was reachable at that moment. That is exactly why every outbound
 * link in the Recovery Hub renders through a component that degrades to the
 * "official service is currently unavailable" message rather than looking
 * broken.
 *
 * Two entries from the original brief were corrected rather than copied:
 *
 *   - `vcTrackingResult.action` is not an entry point. It appears nowhere in
 *     NALSA's own site map or in any index, and the name is that of a POST
 *     result handler. Sending someone there lands them on an error. Victim
 *     compensation is tracked through the same diary-number form as legal aid,
 *     which is what this file links to.
 *   - The published-FIR path is `/Citizen/MH/`, capitalised as indexed. ASP.NET
 *     routing is not reliably case-insensitive, and the lowercase spelling in
 *     the brief is a plausible 404.
 *
 * NOTHING HERE ASSERTS ELIGIBILITY. `relevantWhen` decides whether a resource
 * is worth showing someone. It never decides whether they qualify, and the UI
 * that renders these must say so every time.
 */

import type { FinancialImpactType, IncidentCategory } from "../types/recovery";

export type ResourceCategory =
  | "emergency"
  | "police"
  | "legal_aid"
  | "compensation"
  | "state_scheme"
  | "framework";

export interface OfficialResource {
  /** Stable key. Stored on rows instead of URLs so a portal move is a one-line fix. */
  key: string;
  category: ResourceCategory;
  name: string;
  /** Who publishes it. Shown beside the link, per the source-attribution rule. */
  authority: string;
  url: string;
  /** One plain sentence on what the person will find, not marketing. */
  description: string;
  /** ISO date this address was last checked. Displayed, so staleness is visible. */
  checkedOn: string;
  /**
   * Restrict to a state, by the same spelling used in the state picker.
   * Absent means national.
   */
  state?: string;
  /**
   * Whether this is worth surfacing for a given situation. Advisory only:
   * returning true means "may be relevant", never "you qualify".
   */
  relevantWhen?: (ctx: ResourceContext) => boolean;
  /**
   * Why this one appeared, in the person's own terms.
   *
   * Without it, a list that looks identical after changing an answer reads as
   * a control that does nothing. Several of these resources genuinely do apply
   * to everybody, and the honest fix is to say so rather than to invent
   * gating that would hide a route somebody is entitled to.
   */
  whyShown?: (ctx: ResourceContext) => string;
}

export interface ResourceContext {
  state?: string;
  category?: IncidentCategory;
  financialImpacts: FinancialImpactType[];
}

const CHECKED = "2026-09-16";

export const OFFICIAL_RESOURCES: OfficialResource[] = [
  // -------------------------------------------------------------------------
  // Emergency
  // -------------------------------------------------------------------------
  {
    key: "erss_112",
    category: "emergency",
    name: "Dial 112",
    authority: "Emergency Response Support System, Ministry of Home Affairs",
    url: "https://112.gov.in/",
    description:
      "India's single emergency number for police, fire, medical and disaster response, reachable by call, SMS or the 112 India app.",
    checkedOn: CHECKED,
  },

  // -------------------------------------------------------------------------
  // Police
  // -------------------------------------------------------------------------
  {
    key: "mh_police_citizen_portal",
    category: "police",
    name: "Maharashtra Police Citizen Portal",
    authority: "Maharashtra Police",
    url: "https://citizen.mahapolice.gov.in/Citizen/",
    description:
      "Where complaints and e-FIRs are lodged online in Maharashtra, and where a complaint reference can be followed up.",
    checkedOn: CHECKED,
    state: "Maharashtra",
  },
  {
    key: "mh_published_firs",
    category: "police",
    name: "Search published FIRs",
    authority: "Maharashtra Police",
    url: "https://citizen.mahapolice.gov.in/Citizen/MH/PublishedFIRs.aspx",
    description:
      "Search FIRs the Maharashtra Police have published, by police station and date range.",
    checkedOn: CHECKED,
    state: "Maharashtra",
  },

  // -------------------------------------------------------------------------
  // Legal aid
  // -------------------------------------------------------------------------
  {
    key: "nalsa_legal_aid",
    category: "legal_aid",
    name: "Free legal aid",
    authority: "National Legal Services Authority (NALSA)",
    url: "https://nalsa.gov.in/legal-aid/",
    description:
      "Who can get a lawyer at no cost through the legal services authorities, and what they do.",
    checkedOn: CHECKED,
  },
  {
    key: "nalsa_legal_aid_apply",
    category: "legal_aid",
    name: "Apply for legal aid",
    authority: "NALSA, via the Legal Services Management System (NIC)",
    url: "https://scourtapp.nic.in/lsams/nologin/applicationFiling.action",
    description:
      "The official application form. No login is needed, and a diary number is issued when it is submitted.",
    checkedOn: CHECKED,
  },
  {
    key: "nalsa_track_application",
    category: "legal_aid",
    name: "Track an application",
    authority: "NALSA, via the Legal Services Management System (NIC)",
    url: "https://scourtapp.nic.in/lsams/nologin/applicationTrackingForm.action",
    description:
      "Checks the status of a legal aid or victim compensation application using the diary number issued on submission.",
    checkedOn: CHECKED,
  },

  // -------------------------------------------------------------------------
  // Compensation
  // -------------------------------------------------------------------------
  {
    key: "nalsa_victim_compensation",
    whyShown: () =>
      "Shown to everyone. Victim compensation is for victims of crime generally, whether or not you have had a financial loss.",
    category: "compensation",
    name: "Victim compensation",
    authority: "National Legal Services Authority (NALSA)",
    url: "https://nalsa.gov.in/victim-compensation/",
    description:
      "What the victim compensation schemes are for and which authority decides them.",
    checkedOn: CHECKED,
  },
  {
    key: "nalsa_victim_compensation_apply",
    whyShown: () =>
      "Shown to everyone. This is the form the route above is applied for on.",
    category: "compensation",
    name: "Victim compensation application",
    authority: "NALSA, via the Legal Services Management System (NIC)",
    url: "https://scourtapp.nic.in/lsams/nologin/victimcompensation.action",
    description:
      "The official application form for victim compensation. No login is needed.",
    checkedOn: CHECKED,
  },
  {
    key: "csacv",
    whyShown: (ctx) =>
      ctx.category === "communal_violence"
        ? "Because your file records religious or communal violence."
        : ctx.financialImpacts.includes("death_of_family_member")
          ? "Because you said a family member died."
          : "Because you said a disability resulted.",
    category: "compensation",
    name: "Central Scheme for Assistance to Civilian Victims",
    authority: "Ministry of Home Affairs",
    url: "https://csacv.mha.gov.in/",
    description:
      "Central assistance for civilians affected by terrorist, communal, Naxal, cross-border or similar violence.",
    checkedOn: CHECKED,
    relevantWhen: (ctx) =>
      ctx.category === "communal_violence" ||
      ctx.financialImpacts.includes("death_of_family_member") ||
      ctx.financialImpacts.includes("disability"),
  },

  // -------------------------------------------------------------------------
  // Maharashtra schemes
  // -------------------------------------------------------------------------
  {
    key: "mh_scst_atrocity_assistance",
    whyShown: () =>
      "Because your file records a caste-based atrocity in Maharashtra.",
    category: "state_scheme",
    name: "Financial assistance for SC/ST victims of atrocities",
    authority: "Commissionerate of Social Welfare, Government of Maharashtra",
    url:
      "https://socialwelfare.maharashtra.gov.in/en/scheme/provide-financial-assistance-to-family-members-of-scst-victims-of-atrocities/",
    description:
      "The scheme's own page: what it covers and that the district Assistant Commissioner of Social Welfare administers it.",
    checkedOn: CHECKED,
    state: "Maharashtra",
    relevantWhen: (ctx) => ctx.category === "caste_based_atrocity",
  },
  {
    key: "mh_sjsa_atrocity_assistance",
    whyShown: () =>
      "Because your file records a caste-based atrocity in Maharashtra. This is the department that administers it.",
    category: "state_scheme",
    name: "Assistance to SC/ST victims (Social Justice Department)",
    authority: "Social Justice & Special Assistance Department, Government of Maharashtra",
    url:
      "https://sjsa.maharashtra.gov.in/en/scheme/financial-assistance-to-victimized-family-person-of-scheduled-castes-and-scheduled-tribes/",
    description:
      "The same assistance as published by the department that administers it, with the district contact route.",
    checkedOn: CHECKED,
    state: "Maharashtra",
    relevantWhen: (ctx) => ctx.category === "caste_based_atrocity",
  },

  // -------------------------------------------------------------------------
  // Framework
  // -------------------------------------------------------------------------
  {
    key: "un_reparation_principles",
    category: "framework",
    name: "The right to a remedy and reparation",
    authority: "Office of the UN High Commissioner for Human Rights",
    url:
      "https://www.ohchr.org/en/instruments-mechanisms/instruments/basic-principles-and-guidelines-right-remedy-and-reparation",
    description:
      "The readable text of the principles that say victims of serious violations are owed a remedy, adopted as UN General Assembly resolution 60/147.",
    checkedOn: CHECKED,
  },
  {
    key: "un_res_60_147",
    category: "framework",
    name: "General Assembly resolution 60/147",
    authority: "United Nations Digital Library",
    url: "https://digitallibrary.un.org/record/563157?ln=en",
    description: "The resolution itself, in the UN's own archive.",
    checkedOn: CHECKED,
  },
];

const BY_KEY = new Map(OFFICIAL_RESOURCES.map((r) => [r.key, r]));

export const officialResource = (key: string): OfficialResource | undefined =>
  BY_KEY.get(key);

export const resourcesByCategory = (category: ResourceCategory): OfficialResource[] =>
  OFFICIAL_RESOURCES.filter((r) => r.category === category);

/**
 * Resources worth showing for one person's situation.
 *
 * A state-specific resource is shown only to that state; a national one is
 * shown to everybody. `relevantWhen`, where present, narrows further. Anything
 * this returns is a candidate to read about, and the caller is required to say
 * so: the phrase the product uses is "may be relevant", and eligibility is
 * decided by the relevant authority.
 */
export function matchResources(
  ctx: ResourceContext,
  category?: ResourceCategory
): OfficialResource[] {
  return OFFICIAL_RESOURCES.filter((r) => {
    if (category && r.category !== category) return false;
    if (r.state && r.state !== ctx.state) return false;
    if (r.relevantWhen && !r.relevantWhen(ctx)) return false;
    return true;
  });
}

/**
 * Why a resource was surfaced for this person.
 *
 * Falls back to a plain statement rather than silence: a card with no reason
 * beside the ones that have them reads as an oversight.
 */
export function explainMatch(r: OfficialResource, ctx: ResourceContext): string {
  if (r.whyShown) return r.whyShown(ctx);
  if (r.state) return `Because your file says ${r.state}.`;
  return "Shown to everyone.";
}

/**
 * The LSAMS portals honour ?requestLocale, so someone reading AURA in Hindi or
 * Marathi does not get dropped into an English government form. Applied only to
 * hosts known to support it; a query string appended blindly to an unrelated
 * portal is at best noise and at worst breaks the link.
 */
export function localisedUrl(url: string, language: string): string {
  if (!/^https:\/\/scourtapp\.nic\.in\//.test(url)) return url;
  const locale = language === "hi" ? "hi" : language === "mr" ? "mr" : "en";
  return `${url}${url.includes("?") ? "&" : "?"}requestLocale=${locale}`;
}
