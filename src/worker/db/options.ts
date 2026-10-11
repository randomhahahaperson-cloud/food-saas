import { buildSet, isForeignKeyError, newId } from "./sql";

export type Option = {
  id: string;
  groupId: string;
  name: string;
  extraPrice: number; // centavos
  sortOrder: number;
};

type OptionRow = {
  id: string;
  group_id: string;
  name: string;
  extra_price: number;
  sort_order: number;
};

export type OptionInput = { name: string; extraPrice?: number; sortOrder?: number };

const toOption = (r: OptionRow): Option => ({
  id: r.id,
  groupId: r.group_id,
  name: r.name,
  extraPrice: r.extra_price,
  sortOrder: r.sort_order,
});

export function optionsRepo(db: D1Database, businessId: string) {
  return {
    async listForGroup(groupId: string): Promise<Option[]> {
      const { results } = await db
        .prepare(
          `SELECT id, group_id, name, extra_price, sort_order FROM options
           WHERE business_id = ? AND group_id = ? ORDER BY sort_order, name`,
        )
        .bind(businessId, groupId)
        .all<OptionRow>();
      return results.map(toOption);
    },

    /** Returns null if the option group doesn't belong to this store. */
    async create(groupId: string, input: OptionInput): Promise<Option | null> {
      const option: Option = {
        id: newId(),
        groupId,
        name: input.name,
        extraPrice: input.extraPrice ?? 0,
        sortOrder: input.sortOrder ?? 0,
      };
      try {
        await db
          .prepare(
            `INSERT INTO options (id, business_id, group_id, name, extra_price, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(option.id, businessId, groupId, option.name, option.extraPrice, option.sortOrder)
          .run();
        return option;
      } catch (err) {
        if (isForeignKeyError(err)) return null;
        throw err;
      }
    },

    async update(id: string, patch: Partial<OptionInput>): Promise<boolean> {
      const set = buildSet(patch, {
        name: "name",
        extraPrice: "extra_price",
        sortOrder: "sort_order",
      });
      if (!set) return false;
      const res = await db
        .prepare(`UPDATE options SET ${set.clause} WHERE id = ? AND business_id = ?`)
        .bind(...set.values, id, businessId)
        .run();
      return res.meta.changes > 0;
    },

    async delete(id: string): Promise<boolean> {
      const res = await db
        .prepare("DELETE FROM options WHERE id = ? AND business_id = ?")
        .bind(id, businessId)
        .run();
      return res.meta.changes > 0;
    },
  };
}
