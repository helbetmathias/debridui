import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    getSimklImdbRating,
    getSimklRecommendations,
    getSimklTitleImdbRating,
    simklRatingQuery,
    simklRecommendationQuery,
} from "@/lib/simkl/recommendations";
import { isSimklConfigured, simklConfig } from "@/lib/simkl/security";
import {
    connectionStatus,
    disconnectSimkl,
    finishAuthorization,
    getSimklPlayback,
    startAuthorization,
} from "@/lib/simkl/service";

export const runtime = "nodejs";
const COOKIE = "debridui_simkl_oauth";
const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: privateHeaders });
type Context = { params: Promise<{ action: string }> };

export async function GET(request: NextRequest, context: Context) {
    const { action } = await context.params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return json({ error: "Sign in required" }, 401);
    if (!isSimklConfigured()) {
        if (action === "rating" || action === "title-rating") return json(null);
        return json(action === "recommendations" ? [] : { configured: false, connected: false, items: [] });
    }
    if (action === "callback") {
        const config = simklConfig();
        let result = "failed";
        try {
            const code = request.nextUrl.searchParams.get("code");
            const state = request.nextUrl.searchParams.get("state");
            const cookie = request.cookies.get(COOKIE)?.value;
            if (!code || !state || !cookie || request.nextUrl.searchParams.has("error"))
                throw new Error("Authorization cancelled");
            await finishAuthorization(session.user.id, cookie, state, code);
            result = "connected";
        } catch {
            /* Only a generic outcome is returned, never provider credentials or error bodies. */
        }
        const response = NextResponse.redirect(`${config.origin}/settings?simkl=${result}`, 303);
        response.headers.set("Cache-Control", "private, no-store");
        response.headers.set("Referrer-Policy", "no-referrer");
        response.cookies.set(COOKIE, "", {
            httpOnly: true,
            secure: config.secure,
            sameSite: "lax",
            path: "/api/simkl",
            maxAge: 0,
        });
        return response;
    }
    try {
        if (action === "status") return json(await connectionStatus(session.user.id));
        if (action === "playback") return json(await getSimklPlayback(session.user.id));
        if (action === "recommendations" || action === "title-rating") {
            const query = simklRecommendationQuery.safeParse({
                id: request.nextUrl.searchParams.get("id"),
                type: request.nextUrl.searchParams.get("type"),
            });
            if (!query.success) return json({ error: "Invalid media identifier or type" }, 400);
            const status = await connectionStatus(session.user.id);
            const connected = status.connected && !status.reconnectRequired;
            if (action === "title-rating") return json(connected ? await getSimklTitleImdbRating(query.data) : null);
            return json(connected ? await getSimklRecommendations(query.data) : []);
        }
        if (action === "rating") {
            const query = simklRatingQuery.safeParse({
                id: request.nextUrl.searchParams.get("id"),
                type: request.nextUrl.searchParams.get("type"),
            });
            if (!query.success) return json({ error: "Invalid SIMKL identifier or type" }, 400);
            const status = await connectionStatus(session.user.id);
            return json(status.connected && !status.reconnectRequired ? await getSimklImdbRating(query.data) : null);
        }
        return json({ error: "Not found" }, 404);
    } catch {
        return json({ error: "SIMKL connection is temporarily unavailable" }, 503);
    }
}

export async function POST(request: NextRequest, context: Context) {
    const { action } = await context.params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return json({ error: "Sign in required" }, 401);
    if (!isSimklConfigured()) return json({ error: "SIMKL is not configured on this server" }, 503);
    const config = simklConfig();
    if (request.headers.get("origin") !== config.origin) return json({ error: "Invalid request origin" }, 403);
    try {
        if (action === "connect") {
            const pending = await startAuthorization(session.user.id);
            const response = NextResponse.redirect(pending.url, 303);
            for (const [key, value] of Object.entries(privateHeaders)) response.headers.set(key, value);
            response.cookies.set(COOKIE, pending.cookie, {
                httpOnly: true,
                secure: config.secure,
                sameSite: "lax",
                path: "/api/simkl",
                maxAge: 600,
            });
            return response;
        }
        if (action === "disconnect") return json(await disconnectSimkl(session.user.id));
        return json({ error: "Not found" }, 404);
    } catch {
        return json({ error: "SIMKL connection could not be updated. Please try again." }, 503);
    }
}
