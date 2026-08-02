import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { AccountType } from "../schemas";

export * from "./auth-schema";

import { user } from "./auth-schema";

// User accounts table - stores debrid service accounts
export const userAccounts = pgTable(
    "user_accounts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        apiKey: text("api_key").notNull(),
        type: text("type", { enum: Object.values(AccountType) as [string, ...string[]] }).notNull(),
        name: text("name").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("unique_user_account").on(table.userId, table.apiKey, table.type),
        index("user_accounts_userId_idx").on(table.userId),
    ]
);

// Addons table - stores user addon configurations
export const addons = pgTable(
    "addons",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        url: text("url").notNull(),
        enabled: boolean("enabled").notNull().default(true),
        order: integer("order").notNull().default(0),
    },
    (table) => [index("addons_userId_idx").on(table.userId)]
);

// User settings table - stores user preferences
export const userSettings = pgTable("user_settings", {
    userId: uuid("user_id")
        .primaryKey()
        .references(() => user.id, { onDelete: "cascade" }),
    settings: jsonb("settings").notNull(),
});

// TMDB metadata stored for a search-history entry.
export type MediaSearchMetadata = {
    kind: "tmdb";
    type: "movie" | "show";
    slug?: string;
    imdbId?: string;
    year?: number;
    rating?: number;
    posterUrl?: string;
    /** Short description / overview of the picked item. */
    subtitle?: string;
};

export type SearchHistoryMetadata = MediaSearchMetadata;

// Search history table — provider-agnostic. Stores items the user clicked through
// from a search result so they can be re-surfaced as recent picks.
export const searchHistory = pgTable(
    "search_history",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        // TMDB identity — uniqueness is (user, provider, providerId)
        provider: text("provider").notNull(),
        providerId: text("provider_id").notNull(), // stringified id within provider

        // Generic display field shared by every provider
        title: text("title").notNull(),

        // Structured display data for the TMDB result
        metadata: jsonb("metadata").$type<SearchHistoryMetadata>().notNull(),

        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        // Fast user lookups sorted by most recent
        index("search_history_user_updated_idx").on(table.userId, table.updatedAt.desc()),
        // Upsert key — same item picked twice updates the existing row
        uniqueIndex("search_history_user_provider_id_idx").on(table.userId, table.provider, table.providerId),
    ]
);

// Relations
export const userRelations = relations(user, ({ many, one }) => ({
    userAccounts: many(userAccounts),
    addons: many(addons),
    userSettings: one(userSettings),
    searchHistory: many(searchHistory),
}));

export const userAccountsRelations = relations(userAccounts, ({ one }) => ({
    user: one(user, {
        fields: [userAccounts.userId],
        references: [user.id],
    }),
}));

export const addonsRelations = relations(addons, ({ one }) => ({
    user: one(user, {
        fields: [addons.userId],
        references: [user.id],
    }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
    user: one(user, {
        fields: [userSettings.userId],
        references: [user.id],
    }),
}));

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
    user: one(user, {
        fields: [searchHistory.userId],
        references: [user.id],
    }),
}));

// Type exports for TypeScript
export type UserAccount = typeof userAccounts.$inferSelect;
export type NewUserAccount = typeof userAccounts.$inferInsert;
export type Addon = typeof addons.$inferSelect;
export type NewAddon = typeof addons.$inferInsert;
export type UserSetting = typeof userSettings.$inferSelect;
export type NewUserSetting = typeof userSettings.$inferInsert;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type NewSearchHistory = typeof searchHistory.$inferInsert;
