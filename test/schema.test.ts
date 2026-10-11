import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

const db = env.DB;

async function seedTwoStores() {
  await db.batch([
    db.prepare("DELETE FROM businesses"),
    db.prepare("INSERT INTO businesses (id, name, slug) VALUES ('b1', 'Lola Nena', 'lola-nena')"),
    db.prepare("INSERT INTO businesses (id, name, slug) VALUES ('b2', 'Kusina Ko', 'kusina-ko')"),
    db.prepare(
      "INSERT INTO menu_categories (id, business_id, name) VALUES ('c1', 'b1', 'Rice meals')",
    ),
    db.prepare(
      "INSERT INTO menu_categories (id, business_id, name) VALUES ('c2', 'b2', 'Desserts')",
    ),
    db.prepare(
      "INSERT INTO menu_items (id, business_id, category_id, name, price) VALUES ('i1', 'b1', 'c1', 'Adobo', 12000)",
    ),
    db.prepare(
      "INSERT INTO option_groups (id, business_id, item_id, name) VALUES ('g1', 'b1', 'i1', 'Rice')",
    ),
    db.prepare(
      "INSERT INTO options (id, business_id, group_id, name, extra_price) VALUES ('o1', 'b1', 'g1', 'Extra rice', 2000)",
    ),
  ]);
}

describe("database schema", () => {
  beforeEach(seedTwoStores);

  it("enforces foreign keys", async () => {
    const row = await db.prepare("PRAGMA foreign_keys").first<{ foreign_keys: number }>();
    expect(row?.foreign_keys).toBe(1);
  });

  it("rejects linking an item to another store's category", async () => {
    await expect(
      db
        .prepare(
          "INSERT INTO menu_items (id, business_id, category_id, name, price) VALUES ('x', 'b1', 'c2', 'Leche flan', 5000)",
        )
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  it("rejects an option group on another store's item", async () => {
    await expect(
      db
        .prepare(
          "INSERT INTO option_groups (id, business_id, item_id, name) VALUES ('x', 'b2', 'i1', 'Size')",
        )
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  it("rejects an option in another store's group", async () => {
    await expect(
      db
        .prepare(
          "INSERT INTO options (id, business_id, group_id, name) VALUES ('x', 'b2', 'g1', 'Large')",
        )
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  it("allows items without a category", async () => {
    await db
      .prepare(
        "INSERT INTO menu_items (id, business_id, name, price) VALUES ('i2', 'b1', 'Halo-halo', 9000)",
      )
      .run();
  });

  it("rejects negative prices", async () => {
    await expect(
      db
        .prepare(
          "INSERT INTO menu_items (id, business_id, name, price) VALUES ('x', 'b1', 'Bad', -1)",
        )
        .run(),
    ).rejects.toThrow(/CHECK/);
    await expect(
      db
        .prepare(
          "INSERT INTO options (id, business_id, group_id, name, extra_price) VALUES ('x', 'b1', 'g1', 'Bad', -1)",
        )
        .run(),
    ).rejects.toThrow(/CHECK/);
  });

  it("treats store links as case-insensitive and unique", async () => {
    await expect(
      db
        .prepare("INSERT INTO businesses (id, name, slug) VALUES ('b3', 'Copy', 'LOLA-NENA')")
        .run(),
    ).rejects.toThrow(/UNIQUE/);
  });

  it("blocks deleting a category that still has items", async () => {
    await expect(db.prepare("DELETE FROM menu_categories WHERE id = 'c1'").run()).rejects.toThrow(
      /FOREIGN KEY/,
    );
  });

  it("removes a store's menu when the store is deleted", async () => {
    await db.prepare("DELETE FROM businesses WHERE id = 'b1'").run();
    const counts = await db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM menu_categories WHERE business_id = 'b1') AS categories,
          (SELECT COUNT(*) FROM menu_items WHERE business_id = 'b1') AS items,
          (SELECT COUNT(*) FROM option_groups WHERE business_id = 'b1') AS groups,
          (SELECT COUNT(*) FROM options WHERE business_id = 'b1') AS opts`,
      )
      .first();
    expect(counts).toEqual({ categories: 0, items: 0, groups: 0, opts: 0 });
  });
});
