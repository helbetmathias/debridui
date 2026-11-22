import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOmdbSeasonRatings, omdbSeasonQuery } from "@/lib/omdb";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });

    const params = request.nextUrl.searchParams;
    const query = omdbSeasonQuery.safeParse({ id: params.get("id"), season: params.get("season") });
    if (!query.success) return NextResponse.json({ error: "Invalid title or season" }, { status: 400, headers });

    try {
        return NextResponse.json(await getOmdbSeasonRatings(query.data), { headers });
    } catch {
        return NextResponse.json(
            { error: "IMDb episode ratings are temporarily unavailable" },
            { status: 503, headers }
        );
    }
}
