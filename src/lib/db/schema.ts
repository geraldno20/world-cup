import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const managers = sqliteTable("managers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
});

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  groupName: text("group_name"),
  flag: text("flag"),
});

export const draftPicks = sqliteTable("draft_picks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  managerId: integer("manager_id")
    .notNull()
    .references(() => managers.id, { onDelete: "cascade" }),
  teamId: integer("team_id")
    .notNull()
    .unique()
    .references(() => teams.id, { onDelete: "cascade" }),
});

export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("external_id").unique(),
  stage: text("stage", {
    enum: ["group", "r32", "r16", "qf", "sf", "third", "final"],
  }).notNull(),
  groupName: text("group_name"),
  homeTeamId: integer("home_team_id").references(() => teams.id, {
    onDelete: "set null",
  }),
  awayTeamId: integer("away_team_id").references(() => teams.id, {
    onDelete: "set null",
  }),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  kickoffAt: text("kickoff_at").notNull(),
  venue: text("venue"),
  status: text("status", { enum: ["scheduled", "live", "final"] })
    .notNull()
    .default("scheduled"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type Manager = typeof managers.$inferSelect;
export type NewManager = typeof managers.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type DraftPick = typeof draftPicks.$inferSelect;
export type NewDraftPick = typeof draftPicks.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;

export const MATCH_STAGES = [
  "group",
  "r32",
  "r16",
  "qf",
  "sf",
  "third",
  "final",
] as const;
export const MATCH_STATUSES = ["scheduled", "live", "final"] as const;
