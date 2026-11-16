import { z } from "zod";
import { Resolution, SourceQuality } from "@/lib/addons/types";

export enum AccountType {
    REALDEBRID = "real-debrid",
    TORBOX = "torbox",
    ALLDEBRID = "alldebrid",
    PREMIUMIZE = "premiumize",
    DEBRIDLINK = "debrid-link",
}

// Here rather than in types.ts to avoid a circular import
export enum MediaPlayer {
    BROWSER = "Browser",
    IINA = "IINA",
    INFUSE = "Infuse",
    VLC = "VLC",
    MPV = "MPV",
    MPV_SIMKL = "MPV (SIMKL bridge)",
    POTPLAYER = "PotPlayer",
    KODI = "Kodi",
    MX_PLAYER = "MX Player",
    MX_PLAYER_PRO = "MX Player Pro",
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
    hero_catalogs: z
        .array(z.string().min(1).max(1024))
        .max(2)
        .refine((keys) => new Set(keys).size === keys.length)
        .optional(),
});

const streamingResolutionSchema = z.union([z.enum(Resolution), z.literal("any")]);
const streamingSourceQualitySchema = z.union([z.enum(SourceQuality), z.literal("any")]);

export const qualityRangeSchema = z.object({
    minResolution: streamingResolutionSchema,
    maxResolution: streamingResolutionSchema,
    minSourceQuality: streamingSourceQualitySchema,
    maxSourceQuality: streamingSourceQualitySchema,
});

export const streamingSettingsSchema = z.object({
    profileId: z.enum(["max-quality", "high-quality", "balanced", "data-saver", "low-bandwidth", "custom"]),
    customRange: qualityRangeSchema,
    allowUncached: z.boolean(),
    autoPlay: z.boolean(),
});

export const settingsSchema = z.object({
    smartOrder: z.boolean(),
    hideTrash: z.boolean(),
    quickPlay: z.boolean(),
    mediaPlayer: z.enum(MediaPlayer),
    downloadLinkMaxAge: z.number().int().positive(),
    streaming: streamingSettingsSchema,
    tmdbApiKey: serverSettingsSchema.shape.tmdb_api_key.unwrap(),
});

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export function pickValid<T extends z.ZodObject>(schema: T, input: unknown): DeepPartial<z.infer<T>> {
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(schema.shape)) {
        const value = (input as Record<string, unknown>)[key];
        if (value === undefined) continue;
        const result = field.safeParse(value);
        if (result.success) out[key] = result.data;
        else if (field instanceof z.ZodObject) out[key] = pickValid(field, value);
    }
    return out as DeepPartial<z.infer<T>>;
}
