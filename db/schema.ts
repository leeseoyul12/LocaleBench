import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    payload: text("payload").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("projects_owner").on(t.ownerId)],
);
export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    payload: text("payload").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("runs_project").on(t.projectId)],
);
export const quota = sqliteTable("quota", {
  id: text("id").primaryKey(),
  used: integer("used").notNull().default(0),
});
export const requests = sqliteTable("translation_requests", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  digest: text("digest").notNull(),
  status: text("status").notNull(),
  payload: text("payload"),
  createdAt: text("created_at").notNull(),
});
export const cache = sqliteTable("translation_cache", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
});
