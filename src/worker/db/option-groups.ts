import { buildSet, isForeignKeyError, newId } from "./sql";

export type OptionGroup = {
  id: string;
  itemId: string;
  name: string;
  required: boolean;
  maxChoices: number;
  sortOrder: number;
};

type OptionGroupRow = {
  id: string;
  item_id: string;
  name: string;
  required: number;
  max_choices: number;
  sort_order: number;
};

export type OptionGroupInput = {
  name: string;
  required?: boolean;
  maxChoices?: number;
  sortOrder?: number;
};

const toGroup = (r: OptionGroupRow): OptionGroup => ({
  id: r.id,
  itemId: r.item_id,
  name: r.name,
  required: r.required === 1,
  maxChoices: r.max_choices,
  sortOrder: r.sort_order,
});

export function optionGroupsRepo(db: D1Database, businessId: string) {
  return {
    async listForItem(itemId: string): Promise<OptionGroup[]> {
      const { results } = await db
        .prepare(
          `SELECT id, item_id, name, required, max_choices, sort_order FROM option_groups
           WHERE business_id = ? AND item_id = ? ORDER BY sort_order, name`,
        )
        .bind(businessId, itemId)
        .all<OptionGroupRow>();
      return results.map(toGroup);
    },

    /** Returns null if the item doesn't belong to this store. */
    async create(itemId: string, input: OptionGroupInput): Promise<OptionGroup | null> {
      const group: OptionGroup = {
        id: newId(),
        itemId,
        name: input.name,
        required: input.required ?? false,
        maxChoices: input.maxChoices ?? 1,
        sortOrder: input.sortOrder ?? 0,
      };
      try {
        await db
          .prepare(
            `INSERT INTO option_groups (id, business_id, item_id, name, required, max_choices, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            group.id,
            businessId,
            itemId,
            group.name,
            group.required ? 1 : 0,
            group.maxChoices,
            group.sortOrder,
          )
          .run();
        return group;
      } catch (err) {
        if (isForeignKeyError(err)) return null;
        throw err;
      }
    },

    async update(id: string, patch: Partial<OptionGroupInput>): Promise<boolean> {
      const set = buildSet(patch, {
        name: "name",
        required: "required",
        maxChoices: "max_choices",
        sortOrder: "sort_order",
      });
      if (!set) return false;
      const res = await db
        .prepare(`UPDATE option_groups SET ${set.clause} WHERE id = ? AND business_id = ?`)
        .bind(...set.values, id, businessId)
        .run();
      return res.meta.changes > 0;
    },

    async delete(id: string): Promise<boolean> {
      const res = await db
        .prepare("DELETE FROM option_groups WHERE id = ? AND business_id = ?")
        .bind(id, businessId)
        .run();
      return res.meta.changes > 0;
    },
  };
}
