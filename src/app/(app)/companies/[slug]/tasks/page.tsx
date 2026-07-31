import { notFound } from "next/navigation";
import { BoardWorkspace } from "@/components/deck/board-workspace";
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
  searchParams: Promise<{ board?: string; scope?: string }>;
}

export default async function TasksPage({ params, searchParams }: PageProps) {
  const user = await requireCompanyPageAccess("tasks");
  const [{ slug }, { board: boardParam, scope }] = await Promise.all([
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

  return (
    <BoardWorkspace
      companyId={company.id}
      currentUserId={user.id}
      boards={boards}
      board={board}
      stacks={stacks}
      cards={cards}
      labels={labels}
      members={members}
      initialScope={scope === "team" ? "team" : "mine"}
    />
  );
}
