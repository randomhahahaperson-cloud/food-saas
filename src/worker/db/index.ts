import { businessRepo } from "./businesses";
import { categoriesRepo } from "./categories";
import { itemsRepo } from "./items";
import { optionGroupsRepo } from "./option-groups";
import { optionsRepo } from "./options";

/**
 * Every read and write of a store's data goes through a TenantDb. It is bound to one
 * business_id, and every query it runs filters by that ID, so routes can't forget to.
 */
export function createTenantDb(db: D1Database, businessId: string) {
  if (!businessId) throw new Error("createTenantDb requires a businessId");
  return {
    businessId,
    business: businessRepo(db, businessId),
    categories: categoriesRepo(db, businessId),
    items: itemsRepo(db, businessId),
    optionGroups: optionGroupsRepo(db, businessId),
    options: optionsRepo(db, businessId),
  };
}

export type TenantDb = ReturnType<typeof createTenantDb>;

export { createBusinessWithOwner, findBusinessBySlug } from "./businesses";
export type { Business, BusinessPatch } from "./businesses";
export type { Category, CategoryInput } from "./categories";
export { pingDatabase } from "./health";
export type { MenuItem, MenuItemInput } from "./items";
export type { OptionGroup, OptionGroupInput } from "./option-groups";
export type { Option, OptionInput } from "./options";
