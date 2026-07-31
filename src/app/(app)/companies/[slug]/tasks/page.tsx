import { notFound } from "next/navigation";
import { DeckBoardView } from "@/components/deck/deck-board";
import { getCompanyBySlug } from "@/features/companies/queries";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { getCompanyMembers } from "@/lib/db/companies";
import {
  ensureDefaultBoard,
  fetchBoard,
  fetchBoardCards,
  fetchBoardLabels,
  fetchBoards,
  fetchStacks,
} from "@/lib/db/deck";
import { listApprovedUsers } from "@/lib/db/users";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ board?: string }>;
}

export default async function TasksPage({ params, searchParams }: PageProps) {
  await requireCompanyPageAccess("tasks");
  const [{ slug }, { board: boardParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  await ensureDefaultBoard(company.id);
  const boards = await fetchBoards(company.id);
  const board =
    (boardParam ? await fetchBoard(boardParam, company.id) : null) ?? boards[0];
  if (!board) notFound();

  const [stacks, cards, labels, companyMembers, allUsers] = await Promise.all([
    fetchStacks(board.id),
    fetchBoardCards(board.id),
    fetchBoardLabels(board.id),
    getCompanyMembers(company.id),
    listApprovedUsers(),
  ]);

  const memberIds = new Set(companyMembers.map((m) => m.user_id as string));
  const members = allUsers
    .filter((u) => memberIds.has(u.id))
    .map((u) => ({ id: u.id, name: u.full_name }));

  if (members.length === 0) {
    members.push(...allUsers.map((u) => ({ id: u.id, name: u.full_name })));
  }

  const overdue = cards.filter(
    (c) =>
      c.due_date && new Date(c.due_date) < new Date() && c.status !== "done"
  ).length;
  const completed = cards.filter((c) => c.status === "done").length;
  const open = cards.filter(
    (c) => c.status !== "done" && c.status !== "cancelled"
  ).length;
  const totalLogged = cards.reduce((s, c) => s + c.time_logged_minutes, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Board</h1>
        <p className="text-muted-foreground">
          {open} open · {completed} completed · {overdue} overdue ·{" "}
          {totalLogged} minutes logged
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
          <p className="text-xs text-muted-foreground">Open</p>
          <p className="text-2xl font-semibold">{open}</p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-xs text-emerald-300/80">Completed</p>
          <p className="text-2xl font-semibold text-emerald-300">{completed}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className="text-2xl font-semibold text-amber-300">{overdue}</p>
        </div>
      </div>
      <DeckBoardView
        companyId={company.id}
        boards={boards}
        board={board}
        stacks={stacks}
        cards={cards}
        labels={labels}
        members={members}
      />
    </div>
  );
}
