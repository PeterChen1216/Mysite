/**
 * A local check of JSON-LD against schema.org's rules (M5, PLAN §11 "Person JSON-LD"), so the
 * structured data is validated in the unit tests and the E2E run without sending the page to an
 * online validator (CLAUDE.md: nothing personal goes to outside services).
 *
 * The vocabulary is the part of schema.org (https://schema.org/) the site can use, copied by hand
 * from schema.org's type pages: each type with its parent, each property with the types it may appear on
 * (schema.org's "domainIncludes", inherited by subtypes) and the types its value may have
 * ("rangeIncludes"). A property, type or value outside this table is an error — a typo such as
 * `sameas` or `affilation` fails, and so does a property the site has no business stating.
 * Extend the table from schema.org's own pages when the site needs more.
 *
 * Data types (schema.org's DataType): `Text` is a non-empty string; `URL` an absolute http(s) URL.
 */

/** schema.org types: each with its parent (`Thing` is the root). */
export const TYPES: Record<string, string | null> = {
  Thing: null,
  Person: 'Thing',
  Organization: 'Thing',
  EducationalOrganization: 'Organization',
  CollegeOrUniversity: 'EducationalOrganization',
  CreativeWork: 'Thing',
  WebSite: 'CreativeWork',
  WebPage: 'CreativeWork',
  ProfilePage: 'WebPage',
};

/** schema.org properties: where each may appear and what its value may be. */
export const PROPERTIES: Record<string, { domain: string[]; range: string[] }> = {
  name: { domain: ['Thing'], range: ['Text'] },
  alternateName: { domain: ['Thing'], range: ['Text'] },
  description: { domain: ['Thing'], range: ['Text'] },
  url: { domain: ['Thing'], range: ['URL'] },
  sameAs: { domain: ['Thing'], range: ['URL'] },
  image: { domain: ['Thing'], range: ['URL'] },
  affiliation: { domain: ['Person'], range: ['Organization'] },
  alumniOf: { domain: ['Person'], range: ['EducationalOrganization', 'Organization'] },
  email: { domain: ['Person', 'Organization'], range: ['Text'] },
  department: { domain: ['Organization'], range: ['Organization'] },
  mainEntity: { domain: ['CreativeWork'], range: ['Thing'] },
};

const DATA_TYPES = new Set(['Text', 'URL']);

/** `type` is `of` or one of its subtypes. */
export function isA(type: string, of: string): boolean {
  for (let t: string | null | undefined = type; t; t = TYPES[t]) if (t === of) return true;
  return false;
}

const isUrl = (v: unknown) => {
  if (typeof v !== 'string') return false;
  try {
    const u = new URL(v);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.href.length > 0;
  } catch {
    return false;
  }
};

function checkNode(node: unknown, at: string, problems: string[], top: boolean): string | null {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    problems.push(`${at}: expected an object with an @type`);
    return null;
  }
  const record = node as Record<string, unknown>;
  if (top && record['@context'] !== 'https://schema.org')
    problems.push(`${at}: @context must be "https://schema.org"`);
  if (!top && '@context' in record) problems.push(`${at}: @context belongs on the top object only`);
  const type = record['@type'];
  if (typeof type !== 'string' || !(type in TYPES)) {
    problems.push(`${at}: unknown @type ${JSON.stringify(type)}`);
    return null;
  }
  for (const [key, value] of Object.entries(record)) {
    if (key === '@context' || key === '@type') continue;
    const where = `${at}.${key}`;
    const prop = PROPERTIES[key];
    if (!prop) {
      problems.push(`${where}: not a schema.org property this check knows`);
      continue;
    }
    if (!prop.domain.some((d) => isA(type, d))) {
      problems.push(`${where}: not a property of ${type}`);
      continue;
    }
    const values = Array.isArray(value) ? value : [value];
    if (values.length === 0) problems.push(`${where}: empty list`);
    values.forEach((v, i) => {
      const w = Array.isArray(value) ? `${where}[${i}]` : where;
      const ok = prop.range.some((r) => {
        if (r === 'Text') return typeof v === 'string' && v.trim().length > 0;
        if (r === 'URL') return isUrl(v);
        return typeof v === 'object' && v !== null && !Array.isArray(v);
      });
      if (!ok) {
        problems.push(`${w}: expected ${prop.range.join(' or ')}, got ${JSON.stringify(v)}`);
        return;
      }
      if (typeof v === 'object' && v !== null) {
        const inner = checkNode(v, w, problems, false);
        const things = prop.range.filter((r) => !DATA_TYPES.has(r));
        if (inner && !things.some((r) => isA(inner, r)))
          problems.push(`${w}: a ${inner} where ${things.join(' or ')} is expected`);
      }
    });
  }
  return type;
}

/** Every way `data` breaks schema.org's rules (empty when it is valid). */
export function schemaProblems(data: unknown): string[] {
  const problems: string[] = [];
  checkNode(data, '$', problems, true);
  return problems;
}
