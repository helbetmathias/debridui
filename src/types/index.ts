import type { z } from "zod";
import type {
    accountSchema,
    addonSchema,
    createAccountSchema,
    fullAccountSchema,
    searchHistoryEntrySchema,
    serverSettingsSchema,
} from "@/lib/schemas";

export type Account = z.infer<typeof accountSchema>;
export type CreateAccount = z.infer<typeof createAccountSchema>;
export type FullAccount = z.infer<typeof fullAccountSchema>;
export type CreateAddon = z.infer<typeof addonSchema>;
export type ServerSettings = z.infer<typeof serverSettingsSchema>;
export type SearchHistoryEntry = z.infer<typeof searchHistoryEntrySchema>;

export enum FileType {
    VIDEO = "video",
    AUDIO = "audio",
    IMAGE = "image",
    DOCUMENT = "document",
    ARCHIVE = "archive",
    TEXT = "text",
    OTHER = "other",
}

export enum Platform {
    ANDROID = "Android",
    IOS = "iOS",
    MACOS = "macOS",
    WINDOWS = "Windows",
    LINUX = "Linux",
    UNKNOWN = "Unknown",
}
