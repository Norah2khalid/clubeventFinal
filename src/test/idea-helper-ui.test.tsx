import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdeaHelper } from "@/components/site/IdeaHelper";
import { HELPERS, UI } from "@/lib/content";
import { specialistPrompt } from "@/lib/idea-helpers";
import { toast } from "sonner";

const { insert } = vi.hoisted(() => ({
  insert: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert,
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
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

  it("copies the guidance prompt unchanged", async () => {
    const helper = HELPERS[0];
    if (!helper) throw new Error("missing helper");
    renderHelper(<IdeaHelper helper={helper} open onOpenChange={() => {}} />);
    const prompt = screen.getByLabelText(UI.promptLabel) as HTMLTextAreaElement;
    expect(prompt.value).toBe(specialistPrompt(helper));
    expect(prompt).toHaveAttribute("readonly");

    fireEvent.click(screen.getByRole("button", { name: UI.copy }));
    expect(writeText).toHaveBeenCalledWith(specialistPrompt(helper));
    expect(await screen.findByRole("button", { name: UI.copied })).toBeInTheDocument();
  });

  it("explains external participation and does not collect a submission", () => {
    const helper = HELPERS[0];
    if (!helper) throw new Error("missing helper");
    renderHelper(<IdeaHelper helper={helper} open onOpenChange={() => {}} />);

    expect(screen.getByText(UI.externalParticipation)).toBeInTheDocument();
    for (const field of [UI.studentName, UI.ideaTitle, UI.ideaDetails, UI.externalPrompt]) {
      expect(screen.getByText(field)).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /رفع/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: UI.studentName })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: UI.ideaTitle })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: UI.ideaDetails })).not.toBeInTheDocument();
    expect(insert).not.toHaveBeenCalled();
  });
});
