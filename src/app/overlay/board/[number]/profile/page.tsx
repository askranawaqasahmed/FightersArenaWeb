import { notFound } from "next/navigation";
import { BoardOverlay } from "@/components/overlay/board-overlay";
import { getBoardState } from "@/lib/stream-board-data";

export const dynamic = "force-dynamic";

export default async function BoardProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const boardNumber = Number((await params).number);
  if (!Number.isInteger(boardNumber) || boardNumber < 1 || boardNumber > 8) notFound();
  const rawSlot = Number((await searchParams).slot);
  const slot = rawSlot === 1 || rawSlot === 2 ? (rawSlot as 1 | 2) : undefined;
  const initialState = await getBoardState(boardNumber, { includeProfile: true, slotOverride: slot });
  return <BoardOverlay number={boardNumber} view="profile" slot={slot} initialState={initialState} />;
}
