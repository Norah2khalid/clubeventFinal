import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipationsBoard } from "@/components/site/ParticipationsBoard";
import { UI } from "@/lib/content";
import type { Participation } from "@/lib/participations";
import { toast } from "sonner";

const { rpc, remove, matchId, state } = vi.hoisted(() => ({
  rpc: vi.fn(() => Promise.resolve({ error: null as { message: string; code?: string } | null })),
  remove: vi.fn(() =>
    Promise.resolve({ data: [{ id: "idea-1" }], error: null as { message: string } | null }),
  ),
  matchId: vi.fn(),
  state: {
    admin: false,
    rows: [] as Participation[],
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: state.admin ? { user: { id: "admin-1" } } : null },
        }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    rpc,
    from: (table: string) => {
      if (table === "user_roles") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: state.admin ? { role: "admin" } : null,
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          order: () =>
            Promise.resolve({
              data: state.rows,
              error: state.rows === null ? { message: "x" } : null,
            }),
        }),
        delete: () => ({
          eq: (...args: unknown[]) => {
            matchId(...args);
            return { select: remove };
          },
        }),
      };
    },
  },
}));

const sample: Participation[] = [
  {
    id: "idea-1",
    title: "فكرة الرصد",
    body: "فكرة الرصد\nتفاصيل المتابعة",
    section: "problem_2",
    winner_rank: null,
    created_at: "2026-10-31T21:00:00.000Z",
  },
  {
    id: "idea-2",
    title: "فكرة الفوز",
    body: "نص الفكرة الفائزة",
    section: "application",
    winner_rank: 1,
    created_at: "2026-10-31T18:00:00.000Z",
  },
];

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ParticipationsBoard />
    </QueryClientProvider>,
  );
}

describe("participations board", () => {
  beforeEach(() => {
    state.admin = false;
    state.rows = [];
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
    remove.mockReset();
    remove.mockResolvedValue({ data: [{ id: "idea-1" }], error: null });
    matchId.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("starts with empty winner boxes and no invented rows", async () => {
    renderBoard();
    expect(await screen.findAllByText(UI.winnerEmpty)).toHaveLength(2);
    expect(screen.getByText(UI.participationsEmpty)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: UI.delete })).not.toBeInTheDocument();
  });

  it("shows a real submission separately from the winning idea", async () => {
    state.rows = sample;
    renderBoard();
    expect(await screen.findByText("نص الفكرة الفائزة")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "فكرة الرصد" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText(/تفاصيل المتابعة/)).not.toBeInTheDocument();
    expect(screen.getAllByText(UI.winnerEmpty)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "فكرة الرصد" }));
    expect(screen.getByText(/تفاصيل المتابعة/)).toBeInTheDocument();
    expect(screen.getByText(/رصد ومتابعة انتشار الشائعات على منصة X/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: UI.delete })).not.toBeInTheDocument();
  });

  it("lets an organizer promote and delete, and keeps visitors away from those actions", async () => {
    state.admin = true;
    state.rows = sample;
    renderBoard();
    const card = (await screen.findByRole("button", { name: "فكرة الرصد" })).closest("article");
    if (!card) throw new Error("missing card");
    const view = within(card);
    fireEvent.click(card.querySelector("button")!);
    fireEvent.click(await view.findByRole("button", { name: UI.promoteSecond }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_participation_winner", { _id: "idea-1", _rank: 2 }),
    );
    expect(toast.success).toHaveBeenCalledWith(UI.winnerUpdated);

    rpc.mockResolvedValue({ error: { message: "not authorized", code: "42501" } });
    fireEvent.click(view.getByRole("button", { name: UI.promoteFirst }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(UI.adminOnly));

    fireEvent.click(view.getByRole("button", { name: UI.delete }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: UI.confirmDelete }));
    await waitFor(() => expect(matchId).toHaveBeenCalledWith("id", "idea-1"));
    expect(remove).toHaveBeenCalledWith("id");
    expect(toast.success).toHaveBeenCalledWith(UI.participationDeleted);
  });
});
