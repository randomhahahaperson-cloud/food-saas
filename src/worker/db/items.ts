import { NOW_SQL, buildSet, isForeignKeyError, newId } from "./sql";

export type MenuItem = {
  id: string;
  categoryId: string | null;
  name: string;
  description: string;
  price: number; // centavos
  photoKey: string | null;
  isAvailable: boolean;
  sortOrder: number;
};

type MenuItemRow = {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  price: number;
  photo_key: string | null;
  is_available: number;
  sort_order: number;
};

export type MenuItemInput = {
  categoryId?: string | null;
  name: string;
  description?: string;
  price: number;
  photoKey?: string | null;
  isAvailable?: boolean;
  sortOrder?: number;
};

const COLUMNS = "id, category_id, name, description, price, photo_key, is_available, sort_order";

const toItem = (r: MenuItemRow): MenuItem => ({
  id: r.id,
  categoryId: r.category_id,
  name: r.name,
  description: r.description,
  price: r.price,
  photoKey: r.photo_key,
  isAvailable: r.is_available === 1,
  sortOrder: r.sort_order,
});

export function itemsRepo(db: D1Database, businessId: string) {
  return {
    async list(): Promise<MenuItem[]> {
      const { results } = await db
        .prepare(
          `SELECT ${COLUMNS} FROM menu_items WHERE business_id = ? ORDER BY sort_order, name`,
        )
        .bind(businessId)
        .all<MenuItemRow>();
      return results.map(toItem);
    },

    async get(id: string): Promise<MenuItem | null> {
      const row = await db
        .prepare(`SELECT ${COLUMNS} FROM menu_items WHERE id = ? AND business_id = ?`)
        .bind(id, businessId)
        .first<MenuItemRow>();
      return row ? toItem(row) : null;
    },

    /** Returns null if the category doesn't belong to this store. */
    async create(input: MenuItemInput): Promise<MenuItem | null> {
      const item: MenuItem = {
        id: newId(),
        categoryId: input.categoryId ?? null,
        name: input.name,
        description: input.description ?? "",
        price: input.price,
        photoKey: input.photoKey ?? null,
        isAvailable: input.isAvailable ?? true,
        sortOrder: input.sortOrder ?? 0,
      };
      try {
        await db
          .prepare(
            `INSERT INTO menu_items (id, business_id, category_id, name, description, price, photo_key, is_available, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            item.id,
            businessId,
            item.categoryId,
            item.name,
            item.description,
            item.price,
            item.photoKey,
            item.isAvailable ? 1 : 0,
            item.sortOrder,
          )
          .run();
        return item;
      } catch (err) {
        if (isForeignKeyError(err)) return null;
        throw err;
      }
    },

    /** Returns false if the item (or the new category) isn't in this store. */
    async update(id: string, patch: Partial<MenuItemInput>): Promise<boolean> {
      const set = buildSet(patch, {
        categoryId: "category_id",
        name: "name",
        description: "description",
        price: "price",
        photoKey: "photo_key",
        isAvailable: "is_available",
        sortOrder: "sort_order",
      });
      if (!set) return false;
      try {
        const res = await db
          .prepare(
            `UPDATE menu_items SET ${set.clause}, updated_at = ${NOW_SQL} WHERE id = ? AND business_id = ?`,
          )
          .bind(...set.values, id, businessId)
          .run();
        return res.meta.changes > 0;
      } catch (err) {
        if (isForeignKeyError(err)) return false;
        throw err;
      }
    },

    async delete(id: string): Promise<boolean> {
      const res = await db
        .prepare("DELETE FROM menu_items WHERE id = ? AND business_id = ?")
        .bind(id, businessId)
        .run();
      return res.meta.changes > 0;
    },
  };
}
