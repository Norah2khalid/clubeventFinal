import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { UI } from "@/lib/content";
import { specialistPrompt, type Helper } from "@/lib/idea-helpers";
import { BarcodeImage } from "./BarcodeImage";

const EXTERNAL_FIELDS = [UI.studentName, UI.ideaTitle, UI.ideaDetails, UI.externalPrompt] as const;

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(UI.copied);
    return true;
  } catch {
    toast.error(UI.copyFailed);
    return false;
  }
}

export function IdeaHelper({
  helper,
  flush = false,
  showTitle = true,
  showSummary = true,
  showIntro = true,
  open,
  onOpenChange,
}: {
  helper: Helper;
  flush?: boolean;
  showTitle?: boolean;
  showSummary?: boolean;
  showIntro?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const guidance = specialistPrompt(helper);
  const { data: barcodes = [] } = useQuery({
    queryKey: ["published-barcodes", helper.id],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barcodes")
        .select("*")
        .eq("published", true)
        .eq("section", helper.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function copyPrompt() {
    const ok = await copyText(guidance);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div
      id={helper.id}
      className={flush ? "scroll-mt-8" : "mt-5 scroll-mt-8 border-t border-navy-foreground/20 pt-4"}
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          {showTitle && <h4 className="text-lg font-bold leading-snug">{helper.title}</h4>}
          {showSummary && (
            <p className="mt-2 text-sm leading-relaxed text-navy-foreground/80">{helper.summary}</p>
          )}
          {showIntro && (
            <p className="mt-2 text-sm leading-relaxed text-navy-foreground/70">{UI.intro}</p>
          )}
          <Button
            type="button"
            variant="secondary"
            className="mt-4 h-auto whitespace-normal text-right"
            aria-expanded={open}
            aria-controls={`${helper.id}-panel`}
            onClick={() => onOpenChange(!open)}
          >
            {open ? UI.close : UI.openHelper}
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </Button>
        </div>
        {barcodes.map((barcode) => (
          <div key={barcode.id} className="rounded-md bg-card p-2 text-card-foreground">
            <BarcodeImage barcode={barcode} compact />
          </div>
        ))}
      </div>
      <div
        id={`${helper.id}-panel`}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        inert={!open}
      >
        <div className="overflow-hidden">
          <div className="mt-4 space-y-4 rounded-lg bg-card p-4 text-card-foreground sm:p-5">
            <p className="text-sm leading-relaxed">{UI.externalParticipation}</p>
            <ul className="list-disc space-y-1 ps-5 text-sm font-semibold">
              {EXTERNAL_FIELDS.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
            <div>
              <label htmlFor={`${helper.id}-prompt`} className="mb-2 block text-sm">
                {UI.promptLabel}
              </label>
              <Textarea
                id={`${helper.id}-prompt`}
                aria-label={UI.promptLabel}
                value={guidance}
                readOnly
                rows={8}
              />
              <Button type="button" variant="secondary" className="mt-3 h-11" onClick={copyPrompt}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? UI.copied : UI.copy}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
