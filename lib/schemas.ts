import { z } from "zod";

export enum AccountType {
    REALDEBRID = "real-debrid",
    TORBOX = "torbox",
    ALLDEBRID = "alldebrid",
    PREMIUMIZE = "premiumize",
}

// Account schemas (base → inherited)
export const accountSchema = z.object({
    type: z.enum(AccountType, { error: "Invalid account type" }),
    apiKey: z.string().trim().min(1, "API key is required"),
});

export const createAccountSchema = accountSchema.extend({
    name: z.string().trim().min(1, "Account name is required"),
});

export const fullAccountSchema = accountSchema.extend({
    id: z.string().trim().min(1).default(crypto.randomUUID()),
    name: z.string().trim().min(1),
    email: z.string().trim().min(1),
    language: z.string().trim().min(1),
    isPremium: z.boolean(),
    premiumExpiresAt: z.date(),
});

// Addon schemas
export const addonSchema = z.object({
    name: z.string().trim().min(1, "Addon name is required"),
    url: z.url("Invalid addon URL").trim(),
    enabled: z.boolean(),
});

export const addonOrderUpdateSchema = z
    .array(
        z.object({
            id: z.string().min(1, "Addon ID is required"),
            order: z.number().int().min(0, "Order must be a non-negative integer"),
        })
    )
    .min(1, "At least one addon is required")
    .max(100, "Too many addons in one reorder")
    .superRefine((updates, context) => {
        if (new Set(updates.map(({ id }) => id)).size !== updates.length) {
            context.addIssue({ code: "custom", message: "Addon IDs must be unique" });
        }
        if (new Set(updates.map(({ order }) => order)).size !== updates.length) {
            context.addIssue({ code: "custom", message: "Addon orders must be unique" });
        }
    });

// TMDB search history schemas
const mediaSearchMetadataSchema = z.object({
    type: z.enum(["movie", "show"]),
    slug: z.string().optional(),
    imdbId: z.string().optional(),
    year: z.number().int().optional(),
    rating: z.number().optional(),
    posterUrl: z.string().optional(),
    subtitle: z.string().optional(),
});

export const recordSearchPickSchema = z.object({
    provider: z.literal("tmdb"),
    providerId: z.string().min(1),
    title: z.string().min(1),
    metadata: mediaSearchMetadataSchema.extend({ kind: z.literal("tmdb") }),
});

export const searchHistoryEntrySchema = recordSearchPickSchema.extend({
    id: z.string().min(1),
    updatedAt: z.string().datetime(),
});

export const removeSearchPickSchema = z.object({
    provider: z.literal("tmdb"),
    providerId: z.string().min(1),
});

// User settings schema (snake_case for DB storage)
export const serverSettingsSchema = z.object({
    tmdb_api_key: z.string().max(256).optional(),
    catalog_visibility: z.record(z.string(), z.boolean()).optional(),
});
