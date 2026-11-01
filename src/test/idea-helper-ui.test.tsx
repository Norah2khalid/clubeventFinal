import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdeaHelper } from "@/components/site/IdeaHelper";
import { HELPERS, UI } from "@/lib/content";
import { specialistPrompt } from "@/lib/idea-helpers";
import { hashDeleteCode } from "@/lib/participations";
import { toast } from "sonner";

const { insert } = vi.hoisted(() => ({
  insert: vi.fn(),
}));

function insertResult(result: { data: unknown; error: { message: string } | null }) {
  return { select: () => Promise.resolve(result) };
}

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "participations") return { insert };
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      };
    },
  },
}));

function renderHelper(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function Pair() {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      {HELPERS.slice(0, 2).map((helper) => (
        <IdeaHelper
          key={helper.id}
          helper={helper}
          open={openId === helper.id}
          onOpenChange={(next) => setOpenId(next ? helper.id : null)}
        />
      ))}
    </>
  );
}

describe("idea helper controls", () => {
  const writeText = vi.fn<(value: string) => Promise<void>>().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    insert.mockReset();
    insert.mockImplementation((payload: Record<string, string>) =>
      insertResult({
        data: [
          {
            id: "saved-1",
            winner_rank: null,
            created_at: "2026-11-01T12:00:00.000Z",
            ...payload,
          },
        ],
        error: null,
      }),
    );
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    Object.assign(navigator, { clipboard: { writeText } });
  });

  it("opens one participation panel at a time", () => {
    renderHelper(<Pair />);

    fireEvent.click(screen.getAllByRole("button", { name: "المشاركة" })[0]!);
    expect(screen.getByRole("button", { name: "إغلاق" })).toHaveAttribute(
      "aria-controls",
      "problem_1-panel",
    );

    fireEvent.click(screen.getByRole("button", { name: "المشاركة" }));
    expect(screen.getByRole("button", { name: "إغلاق" })).toHaveAttribute(
      "aria-controls",
      "problem_2-panel",
    );
  });

  it("copies the guidance prompt unchanged and without the participant text", async () => {
    const helper = HELPERS[0];
    if (!helper) throw new Error("missing helper");
    renderHelper(<IdeaHelper helper={helper} open onOpenChange={() => {}} />);
    const prompt = screen.getByLabelText(UI.promptLabel) as HTMLTextAreaElement;
    expect(prompt.value).toBe(specialistPrompt(helper));
    expect(prompt).toHaveAttribute("readonly");

    fireEvent.change(screen.getByLabelText(UI.ideaDetails), { target: { value: "XZ-idea-8841" } });
    fireEvent.click(screen.getByRole("button", { name: UI.copy }));
    expect(writeText).toHaveBeenCalledWith(specialistPrompt(helper));
    expect(specialistPrompt(helper)).not.toContain("XZ-idea-8841");
    expect(writeText.mock.calls[0]?.[0]).not.toContain("XZ-idea-8841");
    expect(await screen.findByRole("button", { name: UI.copied })).toBeInTheDocument();
  });

  it("refuses an empty participation and saves a real one once", async () => {
    const helper = HELPERS[0];
    if (!helper) throw new Error("missing helper");
    renderHelper(<IdeaHelper helper={helper} open onOpenChange={() => {}} />);

    const submit = screen.getByRole("button", { name: UI.submitParticipation });
    expect(screen.getByLabelText(UI.studentName)).toHaveAttribute(
      "placeholder",
      UI.studentNameHint,
    );
    fireEvent.click(submit);
    expect(insert).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(UI.studentNameRequired);

    fireEvent.change(screen.getByLabelText(UI.studentName), { target: { value: "نورة" } });
    fireEvent.click(submit);
    expect(insert).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(UI.ideaTitleRequired);

    fireEvent.change(screen.getByLabelText(UI.ideaTitle), { target: { value: "فكرتي الخاصة" } });
    fireEvent.click(submit);
    expect(insert).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(UI.participationEmpty);

    fireEvent.change(screen.getByLabelText(UI.ideaDetails), {
      target: { value: "تفاصيل الحل" },
    });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    const payload = insert.mock.calls[0]?.[0] as { delete_code_hash?: string };
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "فكرتي الخاصة",
        student_name: "نورة",
        body: "تفاصيل الحل",
        section: "problem_1",
      }),
    );
    expect(payload.delete_code_hash).toMatch(/^[0-9a-f]{64}$/);
    const shown = screen.getByLabelText(UI.deleteCodeLabel).textContent ?? "";
    expect(await hashDeleteCode(shown)).toBe(payload.delete_code_hash);
    expect(shown.replace(/-/g, "")).not.toBe(payload.delete_code_hash);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(UI.participationSaved));
  });

  it("does not announce success when saving fails", async () => {
    const helper = HELPERS[3];
    if (!helper) throw new Error("missing helper");
    insert.mockImplementation(() => insertResult({ data: null, error: { message: "denied" } }));
    renderHelper(<IdeaHelper helper={helper} open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText(UI.studentName), { target: { value: "سارة" } });
    fireEvent.change(screen.getByLabelText(UI.ideaTitle), { target: { value: "حل للتحقق" } });
    fireEvent.change(screen.getByLabelText(UI.ideaDetails), { target: { value: "تفاصيل التحقق" } });
    fireEvent.click(screen.getByRole("button", { name: UI.submitParticipation }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(UI.participationFailed));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(UI.deleteCodeLabel)).not.toBeInTheDocument();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ section: "problem_4", student_name: "سارة" }),
    );
  });
});
