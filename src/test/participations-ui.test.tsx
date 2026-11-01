import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function row(partial: Partial<Participation> & Pick<Participation, "id" | "title">): Participation {
  return {
    body: partial.title,
    section: "problem_1",
    student_name: "نورة",
    winner_rank: null,
    created_at: "2026-10-31T18:00:00.000Z",
    ...partial,
  };
}

const sample: Participation[] = [
  row({
    id: "idea-1",
    title: "فكرة الرصد",
    body: "فكرة الرصد\nتفاصيل المتابعة",
    section: "problem_2",
    student_name: "نورة",
    created_at: "2026-10-31T21:00:00.000Z",
  }),
  row({
    id: "idea-2",
    title: "فكرة الفوز",
    body: "نص الفكرة الفائزة",
    section: "application",
    student_name: "سارة",
    winner_rank: 1,
    created_at: "2026-10-31T18:00:00.000Z",
  }),
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
    sessionStorage.clear();
  });

  it("shows six compact slots and empty rank boxes without invented ideas", async () => {
    renderBoard();
    expect(await screen.findAllByText(UI.rankWaiting)).toHaveLength(2);
    expect(screen.getByText("المشاركة رقم 1")).toBeInTheDocument();
    expect(screen.getByText("المشاركة رقم 6")).toBeInTheDocument();
    expect(screen.getAllByText(UI.slotEmpty)).toHaveLength(6);
    expect(screen.queryByRole("button", { name: UI.promote })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: UI.announceWinners })).not.toBeInTheDocument();
  });

  it("keeps a winning idea out of the participation slots and hides its text until opened", async () => {
    state.rows = sample;
    renderBoard();
    expect(await screen.findByText("سارة")).toBeInTheDocument();
    expect(screen.getByText("فكرة الفوز")).toBeInTheDocument();
    expect(screen.queryByText("نص الفكرة الفائزة")).not.toBeInTheDocument();
    expect(screen.getAllByText(UI.rankWaiting)).toHaveLength(1);
    expect(screen.getByText("نورة")).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: `${UI.showDetails} فكرة الرصد` });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByText(/تفاصيل المتابعة/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `${UI.close} فكرة الرصد` }));
    expect(screen.queryByText(/تفاصيل المتابعة/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: UI.delete })).not.toBeInTheDocument();
  });

  it("lets an organizer promote with confirmation and keeps visitors from announcing", async () => {
    state.admin = true;
    state.rows = sample;
    renderBoard();
    const announce = await screen.findByRole("button", { name: UI.announceWinners });
    expect(announce).toBeDisabled();

    const card = screen.getByText("نورة").closest("article");
    if (!card) throw new Error("missing card");
    const view = within(card);
    fireEvent.click(view.getByRole("button", { name: UI.promote }));
    fireEvent.click(view.getByRole("button", { name: UI.rankSecond }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_participation_winner", { _id: "idea-1", _rank: 2 }),
    );

    fireEvent.click(view.getByRole("button", { name: UI.promote }));
    fireEvent.click(view.getByRole("button", { name: UI.rankFirst }));
    expect(rpc).toHaveBeenCalledTimes(1);
    fireEvent.click(view.getByRole("button", { name: UI.confirmReplace }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_participation_winner", { _id: "idea-1", _rank: 1 }),
    );

    rpc.mockResolvedValue({ error: { message: "not authorized", code: "42501" } });
    fireEvent.click(view.getByRole("button", { name: UI.promote }));
    fireEvent.click(view.getByRole("button", { name: UI.rankSecond }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(UI.adminOnly));

    fireEvent.click(view.getByRole("button", { name: `${UI.showDetails} فكرة الرصد` }));
    fireEvent.click(view.getByRole("button", { name: UI.delete }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: UI.confirmDelete }));
    await waitFor(() => expect(matchId).toHaveBeenCalledWith("id", "idea-1"));
    expect(toast.success).toHaveBeenCalledWith(UI.participationDeleted);
  });

  it("asks for confirmation before announcing a different pair", async () => {
    sessionStorage.setItem("event-winners-announced", "old|pair");
    state.admin = true;
    state.rows = [
      row({ id: "w1", title: "فكرة أولى", student_name: "لمى", winner_rank: 1 }),
      row({ id: "w2", title: "فكرة ثانية", student_name: "هند", winner_rank: 2 }),
    ];
    renderBoard();
    fireEvent.click(await screen.findByRole("button", { name: UI.announceWinners }));
    expect(screen.getByText(UI.announceConfirm)).toBeInTheDocument();
    expect(screen.queryByText("6")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: UI.confirmAnnounce }));
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("counts down from 6 to 1 and keeps the winners after the celebration closes", async () => {
    state.admin = true;
    state.rows = [
      row({ id: "w1", title: "فكرة أولى", student_name: "لمى", winner_rank: 1 }),
      row({
        id: "w2",
        title: "فكرة ثانية",
        student_name: "هند",
        winner_rank: 2,
        created_at: "2026-10-31T19:00:00.000Z",
      }),
    ];
    renderBoard();
    await screen.findByRole("button", { name: UI.announceWinners });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: UI.announceWinners }));
    expect(screen.getByText("6")).toBeInTheDocument();
    for (const value of ["5", "4", "3", "2", "1"]) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    vi.useRealTimers();
    expect(await screen.findByText(UI.celebrationTitle)).toBeInTheDocument();
    expect(screen.getByText("لمى")).toBeInTheDocument();
    expect(screen.getByText("هند")).toBeInTheDocument();
    expect(sessionStorage.getItem("event-winners-announced")).toBe("w1|w2");

    fireEvent.click(screen.getByRole("button", { name: UI.closeCelebration }));
    expect(screen.getByText(UI.participationsTitle)).toBeInTheDocument();
    expect(screen.getByText("فكرة أولى")).toBeInTheDocument();
    expect(screen.getByText("فكرة ثانية")).toBeInTheDocument();
    expect(screen.queryByText("6")).not.toBeInTheDocument();
  });
});
