import { NextResponse } from "next/server";
import { z } from "zod";
import { apiData, invalidInput } from "@/lib/api";
import { boardVersion, getBoardState, toSimpleBoard } from "@/lib/stream-board-data";

export const dynamic = "force-dynamic";

const paramsSchema = z.coerce.number().int().min(1).max(8);
const slotSchema = z.union([z.literal(1), z.literal(2)]);

export async function GET(request: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    const boardNumber = paramsSchema.parse((await params).number);
    const url = new URL(request.url);
    const simple = url.searchParams.get("format") === "simple";
    const includeProfile = url.searchParams.get("include") === "profile";
    const rawSlot = url.searchParams.get("slot");
    const slotOverride = rawSlot === null ? undefined : slotSchema.parse(Number(rawSlot));

    const state = await getBoardState(boardNumber, {
      includeProfile: includeProfile && !simple,
      allProfiles: simple,
      slotOverride,
    });
    const version = boardVersion(state);
    const etag = `"${version}${simple ? ":simple" : includeProfile ? ":profile" : ""}"`;
    const headers = {
      etag,
      "cache-control": "no-store, must-revalidate",
      "access-control-allow-origin": "*",
    };
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers });
    }
    if (simple) {
      return NextResponse.json(toSimpleBoard(state), { headers });
    }
    return apiData({ ...state, version }, { headers });
  } catch (error) {
    return invalidInput(error);
  }
}
