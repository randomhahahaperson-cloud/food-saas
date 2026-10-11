import { NOW_SQL, buildSet, newId } from "./sql";

export type Business = {
  id: string;
  name: string;
  slug: string;
  logoKey: string | null;
  bannerKey: string | null;
  about: string;
  hours: string; // JSON, parsed with Zod by the caller
  timezone: string;
  isOpen: boolean;
  settings: string; // JSON, parsed with Zod by the caller
};

type BusinessRow = {
  id: string;
  name: string;
  slug: string;
  logo_key: string | null;
  banner_key: string | null;
  about: string;
  hours: string;
  timezone: string;
  is_open: number;
  settings: string;
};

export type BusinessPatch = Partial<Omit<Business, "id" | "slug">>;

const COLUMNS = "id, name, slug, logo_key, banner_key, about, hours, timezone, is_open, settings";

const toBusiness = (r: BusinessRow): Business => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  logoKey: r.logo_key,
  bannerKey: r.banner_key,
  about: r.about,
  hours: r.hours,
  timezone: r.timezone,
  isOpen: r.is_open === 1,
  settings: r.settings,
});

/** The signed-in store's own record. */
export function businessRepo(db: D1Database, businessId: string) {
  return {
    async get(): Promise<Business | null> {
      const row = await db
        .prepare(`SELECT ${COLUMNS} FROM businesses WHERE id = ?`)
        .bind(businessId)
        .first<BusinessRow>();
      return row ? toBusiness(row) : null;
    },

    async update(patch: BusinessPatch): Promise<boolean> {
      const set = buildSet(patch, {
        name: "name",
        logoKey: "logo_key",
        bannerKey: "banner_key",
        about: "about",
        hours: "hours",
        timezone: "timezone",
        isOpen: "is_open",
        settings: "settings",
      });
      if (!set) return false;
      const res = await db
        .prepare(`UPDATE businesses SET ${set.clause}, updated_at = ${NOW_SQL} WHERE id = ?`)
        .bind(...set.values, businessId)
        .run();
      return res.meta.changes > 0;
    },
  };
}

/**
 * Lookups that run before we know which store a request belongs to. These find the tenant;
 * they never return another table's rows.
 */
export async function findBusinessBySlug(db: D1Database, slug: string): Promise<Business | null> {
  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM businesses WHERE slug = ?`)
    .bind(slug)
    .first<BusinessRow>();
  return row ? toBusiness(row) : null;
}

/** Creates a store and its owner together. Throws if the slug is already taken. */
export async function createBusinessWithOwner(
  db: D1Database,
  input: { name: string; slug: string; ownerEmail: string },
): Promise<{ businessId: string; ownerId: string }> {
  const businessId = newId();
  const ownerId = newId();
  await db.batch([
    db
      .prepare("INSERT INTO businesses (id, name, slug) VALUES (?, ?, ?)")
      .bind(businessId, input.name, input.slug),
    db
      .prepare("INSERT INTO staff_users (id, business_id, email, role) VALUES (?, ?, ?, 'owner')")
      .bind(ownerId, businessId, input.ownerEmail),
  ]);
  return { businessId, ownerId };
}
