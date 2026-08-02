"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addons } from "@/lib/db/schema";
import { addonOrderUpdateSchema, addonSchema } from "@/lib/schemas";
import type { CreateAddon } from "@/lib/types";

/**
 * Get all user addons from database
 */
export async function getUserAddons() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/login");
    }

    const userAddons = await db.select().from(addons).where(eq(addons.userId, session.user.id)).orderBy(addons.order);

    return userAddons;
}

/**
 * Add a new addon
 */
export async function addAddon(data: CreateAddon) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/login");
    }

    const validated = addonSchema.parse(data);

    // Calculate next order atomically
    const [maxOrder] = await db
        .select({ max: sql<number>`COALESCE(MAX(${addons.order}), -1)` })
        .from(addons)
        .where(eq(addons.userId, session.user.id));

    const newOrder = (maxOrder?.max ?? -1) + 1;
    const newId = uuidv7();

    await db.insert(addons).values({
        id: newId,
        userId: session.user.id,
        name: validated.name,
        url: validated.url,
        enabled: validated.enabled,
        order: newOrder,
    });

    revalidatePath("/", "layout");

    return {
        id: newId,
        name: validated.name,
        url: validated.url,
        enabled: validated.enabled,
        order: newOrder,
    };
}

/**
 * Remove an addon
 */
export async function removeAddon(addonId: string) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/login");
    }

    const validatedId = z.string().min(1, "Addon ID is required").parse(addonId);

    await db.delete(addons).where(and(eq(addons.id, validatedId), eq(addons.userId, session.user.id)));

    revalidatePath("/", "layout");
    return { success: true };
}

/**
 * Toggle addon enabled status
 */
export async function toggleAddon(addonId: string, enabled: boolean) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/login");
    }

    const validatedId = z.string().min(1, "Addon ID is required").parse(addonId);
    const validatedEnabled = z.boolean({ error: "Enabled must be a boolean" }).parse(enabled);

    await db
        .update(addons)
        .set({ enabled: validatedEnabled })
        .where(and(eq(addons.id, validatedId), eq(addons.userId, session.user.id)));

    revalidatePath("/", "layout");
    return { success: true };
}

/**
 * Update addon orders (for reordering)
 * Stages affected rows above the current maximum before assigning their final
 * positions. This works whether the optional unique order constraint exists or not.
 */
export async function updateAddonOrders(updates: { id: string; order: number }[]) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/login");
    }

    const validated = addonOrderUpdateSchema.parse(updates);

    await db.transaction(async (tx) => {
        const ids = validated.map(({ id }) => id);
        const ownedAddons = await tx
            .select({ id: addons.id })
            .from(addons)
            .where(and(eq(addons.userId, session.user.id), inArray(addons.id, ids)));

        if (ownedAddons.length !== ids.length) {
            throw new Error("One or more addons could not be reordered");
        }

        const [currentMaximum] = await tx
            .select({ max: sql<number>`COALESCE(MAX(${addons.order}), -1)` })
            .from(addons)
            .where(eq(addons.userId, session.user.id));
        const stagingStart = (currentMaximum?.max ?? -1) + 1;

        // Vacate every destination first. Each temporary order is unique and
        // higher than all current values, so immediate unique constraints are safe.
        for (const [index, update] of validated.entries()) {
            await tx
                .update(addons)
                .set({ order: stagingStart + index })
                .where(and(eq(addons.id, update.id), eq(addons.userId, session.user.id)));
        }

        for (const update of validated) {
            await tx
                .update(addons)
                .set({ order: update.order })
                .where(and(eq(addons.id, update.id), eq(addons.userId, session.user.id)));
        }
    });

    revalidatePath("/", "layout");
    return { success: true };
}
