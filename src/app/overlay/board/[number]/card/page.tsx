import { notFound } from "next/navigation";
import { BoardOverlay } from "@/components/overlay/board-overlay";
import { getBoardState } from "@/lib/stream-board-data";

export const dynamic = "force-dynamic";

export default async function BoardCardPage({ params }: { params: Promise<{ number: string }> }) {
  const boardNumber = Number((await params).number);
  if (!Number.isInteger(boardNumber) || boardNumber < 1 || boardNumber > 8) notFound();
  const initialState = await getBoardState(boardNumber);
  return <BoardOverlay number={boardNumber} view="card" initialState={initialState} />;
}
