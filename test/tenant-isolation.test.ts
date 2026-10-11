import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createBusinessWithOwner, createTenantDb, type TenantDb } from "@/worker/db";

function must<T>(value: T | null): T {
  if (value === null) throw new Error("expected a value");
  return value;
}

let storeA: TenantDb;
let storeB: TenantDb;
let a: { categoryId: string; itemId: string; groupId: string; optionId: string };

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM businesses").run();
  const { businessId: aId } = await createBusinessWithOwner(env.DB, {
    name: "Lola Nena",
    slug: "lola-nena",
    ownerEmail: "nena@example.com",
  });
  const { businessId: bId } = await createBusinessWithOwner(env.DB, {
    name: "Kusina Ko",
    slug: "kusina-ko",
    ownerEmail: "ko@example.com",
  });
  storeA = createTenantDb(env.DB, aId);
  storeB = createTenantDb(env.DB, bId);

  const category = await storeA.categories.create({ name: "Rice meals" });
  const item = must(
    await storeA.items.create({ categoryId: category.id, name: "Adobo", price: 12000 }),
  );
  const group = must(await storeA.optionGroups.create(item.id, { name: "Rice" }));
  const option = must(
    await storeA.options.create(group.id, { name: "Extra rice", extraPrice: 2000 }),
  );
  a = { categoryId: category.id, itemId: item.id, groupId: group.id, optionId: option.id };
});

describe("data-access layer", () => {
  it("refuses to build a TenantDb without a store", () => {
    expect(() => createTenantDb(env.DB, "")).toThrow();
  });

  it("reads back a store's own menu", async () => {
    expect((await storeA.categories.list()).map((c) => c.name)).toEqual(["Rice meals"]);
    expect(await storeA.items.get(a.itemId)).toMatchObject({
      name: "Adobo",
      price: 12000,
      isAvailable: true,
    });
    expect(await storeA.optionGroups.listForItem(a.itemId)).toHaveLength(1);
    expect(await storeA.options.listForGroup(a.groupId)).toMatchObject([{ extraPrice: 2000 }]);
  });

  it("updates only the fields given", async () => {
    expect(await storeA.items.update(a.itemId, { isAvailable: false })).toBe(true);
    expect(await storeA.items.get(a.itemId)).toMatchObject({ name: "Adobo", isAvailable: false });
    expect(await storeA.items.update(a.itemId, {})).toBe(false);
  });

  it("won't delete a category that still has items", async () => {
    expect(await storeA.categories.delete(a.categoryId)).toBe("in_use");
  });
});

describe("tenant isolation: store B can't touch store A's data", () => {
  it("can't list it", async () => {
    expect(await storeB.categories.list()).toEqual([]);
    expect(await storeB.items.list()).toEqual([]);
    expect(await storeB.optionGroups.listForItem(a.itemId)).toEqual([]);
    expect(await storeB.options.listForGroup(a.groupId)).toEqual([]);
  });

  it("can't read it by ID", async () => {
    expect(await storeB.items.get(a.itemId)).toBeNull();
  });

  it("can't update it", async () => {
    expect(await storeB.categories.update(a.categoryId, { name: "Hacked" })).toBe(false);
    expect(await storeB.items.update(a.itemId, { price: 1 })).toBe(false);
    expect(await storeB.optionGroups.update(a.groupId, { required: true })).toBe(false);
    expect(await storeB.options.update(a.optionId, { extraPrice: 0 })).toBe(false);
    expect(await storeA.items.get(a.itemId)).toMatchObject({ price: 12000 });
  });

  it("can't delete it", async () => {
    expect(await storeB.categories.delete(a.categoryId)).toBe("not_found");
    expect(await storeB.items.delete(a.itemId)).toBe(false);
    expect(await storeB.optionGroups.delete(a.groupId)).toBe(false);
    expect(await storeB.options.delete(a.optionId)).toBe(false);
    expect(await storeA.options.listForGroup(a.groupId)).toHaveLength(1);
  });

  it("can't attach its own rows to it", async () => {
    expect(
      await storeB.items.create({ categoryId: a.categoryId, name: "Sneaky", price: 100 }),
    ).toBeNull();
    expect(await storeB.optionGroups.create(a.itemId, { name: "Sneaky" })).toBeNull();
    expect(await storeB.options.create(a.groupId, { name: "Sneaky" })).toBeNull();

    const own = must(await storeB.items.create({ name: "Turon", price: 3000 }));
    expect(await storeB.items.update(own.id, { categoryId: a.categoryId })).toBe(false);
  });

  it("only changes its own store record", async () => {
    await storeB.business.update({ name: "Renamed", isOpen: true });
    expect(await storeA.business.get()).toMatchObject({ name: "Lola Nena", isOpen: false });
    expect(await storeB.business.get()).toMatchObject({ name: "Renamed", isOpen: true });
  });
});
