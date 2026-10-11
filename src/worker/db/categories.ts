import { buildSet, isForeignKeyError, newId } from "./sql";

export type Category = { id: string; name: string; sortOrder: number };

type CategoryRow = { id: string; name: string; sort_order: number };

export type CategoryInput = { name: string; sortOrder?: number };

const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  sortOrder: r.sort_order,
});

export function categoriesRepo(db: D1Database, businessId: string) {
  return {
    async list(): Promise<Category[]> {
      const { results } = await db
        .prepare(
          "SELECT id, name, sort_order FROM menu_categories WHERE business_id = ? ORDER BY sort_order, name",
        )
        .bind(businessId)
        .all<CategoryRow>();
      return results.map(toCategory);
    },

    async create(input: CategoryInput): Promise<Category> {
      const category = { id: newId(), name: input.name, sortOrder: input.sortOrder ?? 0 };
      await db
        .prepare(
          "INSERT INTO menu_categories (id, business_id, name, sort_order) VALUES (?, ?, ?, ?)",
        )
        .bind(category.id, businessId, category.name, category.sortOrder)
        .run();
      return category;
    },

    /** Returns false if the category doesn't exist in this store. */
    async update(id: string, patch: Partial<CategoryInput>): Promise<boolean> {
      const set = buildSet(patch, { name: "name", sortOrder: "sort_order" });
      if (!set) return false;
      const res = await db
        .prepare(`UPDATE menu_categories SET ${set.clause} WHERE id = ? AND business_id = ?`)
        .bind(...set.values, id, businessId)
        .run();
      return res.meta.changes > 0;
    },

    /** "in_use" means the category still has items and can't be removed yet. */
    async delete(id: string): Promise<"deleted" | "not_found" | "in_use"> {
      try {
        const res = await db
          .prepare("DELETE FROM menu_categories WHERE id = ? AND business_id = ?")
          .bind(id, businessId)
          .run();
        return res.meta.changes > 0 ? "deleted" : "not_found";
      } catch (err) {
        if (isForeignKeyError(err)) return "in_use";
        throw err;
      }
    },
  };
}
