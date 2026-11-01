import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdeaHelper } from "@/components/site/IdeaHelper";
import { ParticipationsBoard } from "@/components/site/ParticipationsBoard";
import { HELPERS, UI } from "@/lib/content";
import { sectionLabel, type Participation } from "@/lib/participations";
import { toast } from "sonner";

const { rpc, remove, matchId, insert, state } = vi.hoisted(() => ({
  rpc: vi.fn(() => Promise.resolve({ error: null as { message: string; code?: string } | null })),
  remove: vi.fn(() =>
    Promise.resolve({ data: [{ id: "idea-1" }], error: null as { message: string } | null }),
  ),
  matchId: vi.fn(),
  insert: vi.fn(),
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
      if (table === "barcodes") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          order: () => Promise.resolve({ data: state.rows, error: null }),
        }),
        insert: (payload: {
          title: string;
          student_name: string;
          body: string;
          section: string;
          delete_code_hash: string;
        }) => {
          insert(payload);
          return {
            select: () => {
              const row: Participation = {
                id: `saved-${state.rows.length + 1}`,
                winner_rank: null,
                created_at: "2026-11-01T12:00:00.000Z",
                title: payload.title,
                student_name: payload.student_name,
                body: payload.body,
                section: payload.section,
              };
              state.rows = [...state.rows, row];
              return Promise.resolve({ data: [row], error: null });
            },
          };
        },
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
    rpc.mockImplementation((fn: string, args?: { _code?: string }) => {
      if (fn === "organizer_authorized") {
        return Promise.resolve({ data: args?._code === "test-organizer-code", error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    insert.mockReset();
    remove.mockReset();
    remove.mockResolvedValue({ data: [{ id: "idea-1" }], error: null });
    matchId.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    sessionStorage.clear();
  });

  it("shows empty winner cards and no invented ideas", async () => {
    renderBoard();
    expect(await screen.findAllByText(UI.rankWaiting)).toHaveLength(2);
    expect(screen.getByText(UI.participationsEmpty)).toBeInTheDocument();
    expect(screen.queryByText("المشاركة الأولى")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: UI.promoteIdea })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: UI.announceWinners })).toBeDisabled();
  });

  it("keeps a winning idea out of the participation slots and hides its text until opened", async () => {
    state.rows = sample;
    renderBoard();
    expect(await screen.findByText("سارة")).toBeInTheDocument();
    expect(screen.getByText("فكرة الفوز")).toBeInTheDocument();
    expect(screen.getByText("نص الفكرة الفائزة").closest("[inert]")).not.toBeNull();
    expect(screen.getAllByText(UI.rankWaiting)).toHaveLength(1);
    expect(screen.getByText("المشاركة الأولى")).toBeInTheDocument();
    expect(screen.getByText("نورة")).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: `${UI.showDetails} فكرة الرصد` });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(
      screen.getAllByText(UI.ideaDetails).some((node) => node.closest("[inert]") === null),
    ).toBe(true);
    expect(screen.getByText(/تفاصيل المتابعة/).closest("[inert]")).toBeNull();
    expect(screen.getByText(new RegExp(sectionLabel("problem_2"))).closest("[inert]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `${UI.close} فكرة الرصد` }));
    expect(screen.getByText(/تفاصيل المتابعة/).closest("[inert]")).not.toBeNull();
    expect(screen.getAllByRole("button", { name: UI.deleteMine }).length).toBeGreaterThan(0);
  });

  it("promotes only after the organizer code and rejects a visitor without it", async () => {
    state.rows = sample;
    renderBoard();
    const announce = await screen.findByRole("button", { name: UI.announceWinners });
    expect(announce).toBeDisabled();

    const card = screen.getByText("نورة").closest("article");
    if (!card) throw new Error("missing card");
    const view = within(card);
    fireEvent.click(view.getByRole("button", { name: UI.promoteIdea }));
    fireEvent.click(view.getByRole("button", { name: UI.promoteToSecond }));
    expect(toast.error).toHaveBeenCalledWith(UI.organizerCodeRequired);
    expect(rpc).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(UI.organizerCode), {
      target: { value: "test-organizer-code" },
    });
    fireEvent.click(view.getByRole("button", { name: UI.promoteToSecond }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_participation_winner", {
        _id: "idea-1",
        _rank: 2,
        _code: "test-organizer-code",
      }),
    );

    fireEvent.click(view.getByRole("button", { name: UI.promoteIdea }));
    fireEvent.click(view.getByRole("button", { name: UI.promoteToFirst }));
    expect(rpc).toHaveBeenCalledTimes(1);
    fireEvent.click(view.getByRole("button", { name: UI.confirmReplace }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_participation_winner", {
        _id: "idea-1",
        _rank: 1,
        _code: "test-organizer-code",
      }),
    );

    rpc.mockResolvedValue({ error: { message: "not authorized", code: "42501" } });
    fireEvent.click(view.getByRole("button", { name: UI.promoteIdea }));
    fireEvent.click(view.getByRole("button", { name: UI.promoteToSecond }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(UI.organizerCodeWrong));
  });

  it("asks for a delete code and removes the idea only when the database accepts it", async () => {
    state.rows = sample;
    renderBoard();
    const card = (await screen.findByText("نورة")).closest("article");
    if (!card) throw new Error("missing card");
    const view = within(card);
    fireEvent.click(view.getByRole("button", { name: UI.deleteMine }));
    const field = view.getByLabelText(UI.deleteCodeLabel);
    fireEvent.change(field, { target: { value: "wrong-code" } });
    rpc.mockResolvedValueOnce({ data: false, error: null });
    fireEvent.click(view.getByRole("button", { name: UI.confirmDelete }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("delete_participation", {
        _id: "idea-1",
        _code: "wrong-code",
      }),
    );
    expect(toast.error).toHaveBeenCalledWith(UI.deleteCodeWrong);
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText("نورة")).toBeInTheDocument();

    fireEvent.change(field, { target: { value: "abcd-efgh-ijkm-npqr" } });
    rpc.mockResolvedValueOnce({ data: true, error: null });
    fireEvent.click(view.getByRole("button", { name: UI.confirmDelete }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("delete_participation", {
        _id: "idea-1",
        _code: "abcd-efgh-ijkm-npqr",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(UI.participationDeleted);
  });

  it("asks for confirmation before announcing a different pair", async () => {
    sessionStorage.setItem("event-winners-announced", "old|pair");
    state.rows = [
      row({
        id: "w1",
        title: "فكرة أولى",
        body: "تفاصيل أولى",
        student_name: "لمى",
        winner_rank: 1,
      }),
      row({
        id: "w2",
        title: "فكرة ثانية",
        body: "تفاصيل ثانية",
        student_name: "هند",
        winner_rank: 2,
      }),
    ];
    renderBoard();
    fireEvent.change(await screen.findByLabelText(UI.organizerCode), {
      target: { value: "wrong-organizer-code" },
    });
    fireEvent.click(screen.getByRole("button", { name: UI.announceWinners }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(UI.organizerCodeWrong));
    expect(rpc).toHaveBeenCalledWith("organizer_authorized", { _code: "wrong-organizer-code" });
    expect(rpc).not.toHaveBeenCalledWith("set_participation_winner", expect.anything());
    expect(screen.queryByText(UI.announceConfirm)).not.toBeInTheDocument();
    expect(screen.queryByText("10")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(UI.organizerCode), {
      target: { value: "test-organizer-code" },
    });
    fireEvent.click(screen.getByRole("button", { name: UI.announceWinners }));
    expect(await screen.findByText(UI.announceConfirm)).toBeInTheDocument();
    expect(screen.queryByText("10")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: UI.confirmAnnounce }));
    expect(await screen.findByText("10")).toBeInTheDocument();
    expect(screen.getByText("لمى")).toBeInTheDocument();
    expect(screen.getByText("هند")).toBeInTheDocument();
  });

  it("does not start the countdown on refresh, then counts from 10 to 1", async () => {
    state.rows = [
      row({
        id: "w1",
        title: "فكرة أولى",
        body: "تفاصيل أولى",
        student_name: "لمى",
        winner_rank: 1,
      }),
      row({
        id: "w2",
        title: "فكرة ثانية",
        body: "تفاصيل ثانية",
        student_name: "هند",
        winner_rank: 2,
        created_at: "2026-10-31T19:00:00.000Z",
      }),
    ];
    renderBoard();
    fireEvent.change(await screen.findByLabelText(UI.organizerCode), {
      target: { value: "test-organizer-code" },
    });
    expect(screen.getByRole("button", { name: UI.announceWinners })).toBeEnabled();
    expect(screen.queryByText("10")).not.toBeInTheDocument();
    expect(screen.queryByText(UI.celebrationTitle)).not.toBeInTheDocument();
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: UI.announceWinners }));
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("لمى")).toBeInTheDocument();
      for (const value of ["9", "8", "7", "6", "5", "4", "3", "2", "1"]) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
        expect(screen.getByText(value)).toBeInTheDocument();
      }
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    } finally {
      vi.useRealTimers();
    }
    expect(await screen.findByText(UI.celebrationTitle)).toBeInTheDocument();
    expect(screen.getByText("لمى").closest("article")).toHaveClass("scale-[1.02]");
    expect(screen.getByText("هند")).toBeInTheDocument();
    expect(document.querySelector(".participation-confetti-piece")).not.toBeNull();
    expect(sessionStorage.getItem("event-winners-announced")).toBe("w1|w2");

    fireEvent.click(screen.getByRole("button", { name: UI.backToBoard }));
    expect(screen.getByText(UI.participationsTitle)).toBeInTheDocument();
    expect(screen.getByText("فكرة أولى")).toBeInTheDocument();
    expect(screen.getByText("فكرة ثانية")).toBeInTheDocument();
    expect(screen.queryByText("10")).not.toBeInTheDocument();
    expect(screen.queryByText(UI.celebrationTitle)).not.toBeInTheDocument();
  });

  it("keeps extra ideas behind show more and opens their details independently", async () => {
    state.rows = Array.from({ length: 7 }, (_, index) =>
      row({
        id: `p${index}`,
        title: `عنوان ${index}`,
        body: `تفاصيل كاملة ${index}`,
        student_name: `طالبة ${index}`,
      }),
    );
    renderBoard();
    expect(await screen.findByText("المشاركة السادسة")).toBeInTheDocument();
    expect(screen.queryByText("المشاركة السابعة")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: UI.showMore }));
    expect(screen.getByText("المشاركة السابعة")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `${UI.showDetails} عنوان 0` }));
    fireEvent.click(screen.getByRole("button", { name: `${UI.showDetails} عنوان 6` }));
    expect(screen.getByText("تفاصيل كاملة 0").closest("[inert]")).toBeNull();
    expect(screen.getByText("تفاصيل كاملة 6").closest("[inert]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `${UI.close} عنوان 0` }));
    expect(screen.getByText("تفاصيل كاملة 0").closest("[inert]")).not.toBeNull();
    expect(screen.getByText("تفاصيل كاملة 6").closest("[inert]")).toBeNull();
  });

  it("puts a newly saved idea on the board without a reload", async () => {
    const helper = HELPERS[0];
    if (!helper) throw new Error("missing helper");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <IdeaHelper helper={helper} open onOpenChange={() => {}} />
        <ParticipationsBoard />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(UI.participationsEmpty)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(UI.studentName), { target: { value: "نورة" } });
    fireEvent.change(screen.getByLabelText(UI.ideaTitle), { target: { value: "عنوان الرصد" } });
    fireEvent.change(screen.getByLabelText(UI.ideaDetails), {
      target: { value: "نص التفاصيل الكامل" },
    });
    fireEvent.click(screen.getByRole("button", { name: UI.submitParticipation }));
    expect(await screen.findByText("المشاركة الأولى")).toBeInTheDocument();
    expect(screen.getByText("عنوان الرصد")).toBeInTheDocument();
    expect(screen.getAllByText("نورة").length).toBeGreaterThan(0);
    expect(screen.getByText("نص التفاصيل الكامل").closest("[inert]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `${UI.showDetails} عنوان الرصد` }));
    expect(screen.getByText("نص التفاصيل الكامل").closest("[inert]")).toBeNull();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "عنوان الرصد",
        student_name: "نورة",
        body: "نص التفاصيل الكامل",
        section: "problem_1",
      }),
    );
    const hash = insert.mock.calls[0]?.[0]?.delete_code_hash;
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(screen.queryByText(String(hash))).not.toBeInTheDocument();
  });
});
