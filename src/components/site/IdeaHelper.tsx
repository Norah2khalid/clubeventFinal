import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { UI } from "@/lib/content";
import { specialistPrompt, type Helper } from "@/lib/idea-helpers";
import {
  cleanShortText,
  createDeleteCode,
  formatDeleteCode,
  hashDeleteCode,
  validShortText,
  validStudentName,
  type Participation,
} from "@/lib/participations";
import { BarcodeImage } from "./BarcodeImage";

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
  open,
  onOpenChange,
}: {
  helper: Helper;
  flush?: boolean;
  showTitle?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [studentName, setStudentName] = useState("");
  const [ideaTitle, setIdeaTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [copied, setCopied] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
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

  async function submit() {
    const name = cleanShortText(studentName);
    const title = cleanShortText(ideaTitle);
    const body = idea.trim();
    if (!validStudentName(name)) {
      toast.error(UI.studentNameRequired);
      return;
    }
    if (!validShortText(title)) {
      toast.error(UI.ideaTitleRequired);
      return;
    }
    if (!body) {
      toast.error(UI.participationEmpty);
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const code = createDeleteCode();
    try {
      const deleteCodeHash = await hashDeleteCode(code);
      const { data, error } = await supabase
        .from("participations")
        .insert({
          title,
          student_name: name,
          body,
          section: helper.id,
          delete_code_hash: deleteCodeHash,
        })
        .select("id,title,body,section,student_name,winner_rank,created_at");
      if (error || !data?.length) {
        toast.error(UI.participationFailed);
        return;
      }
      queryClient.setQueryData<Participation[]>(["participations"], (current) => {
        const saved = data.filter((row) => !current?.some((item) => item.id === row.id));
        return [...(current ?? []), ...saved];
      });
      setIssuedCode(code);
      toast.success(UI.participationSaved);
      setStudentName("");
      setIdeaTitle("");
      setIdea("");
      await queryClient.invalidateQueries({ queryKey: ["participations"] });
    } catch {
      toast.error(UI.participationFailed);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div
      id={helper.id}
      className={flush ? "scroll-mt-8" : "mt-5 scroll-mt-8 border-t border-navy-foreground/20 pt-4"}
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          {showTitle && <h4 className="text-lg font-bold leading-snug">{helper.title}</h4>}
          <p className="mt-2 text-sm leading-relaxed text-navy-foreground/80">{helper.summary}</p>
          <p className="mt-2 text-sm leading-relaxed text-navy-foreground/70">{UI.intro}</p>
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
            <div>
              <label htmlFor={`${helper.id}-name`} className="mb-2 block text-sm">
                {UI.studentName}
              </label>
              <Input
                id={`${helper.id}-name`}
                value={studentName}
                placeholder={UI.studentNameHint}
                maxLength={80}
                required
                onChange={(event) => setStudentName(event.target.value)}
              />
            </div>
            <h5 className="text-base font-bold">{UI.shareTitle}</h5>
            <div>
              <label htmlFor={`${helper.id}-title`} className="mb-2 block text-sm">
                {UI.ideaTitle}
              </label>
              <Input
                id={`${helper.id}-title`}
                value={ideaTitle}
                placeholder={UI.ideaTitleHint}
                maxLength={80}
                required
                onChange={(event) => setIdeaTitle(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor={`${helper.id}-idea`} className="mb-2 block text-sm">
                {UI.ideaDetails}
              </label>
              <Textarea
                id={`${helper.id}-idea`}
                value={idea}
                maxLength={8000}
                onChange={(event) => setIdea(event.target.value)}
                rows={5}
              />
            </div>
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
            <Button
              type="button"
              className="h-11 bg-gradient-brand"
              disabled={saving}
              aria-busy={saving}
              onClick={submit}
            >
              {saving ? UI.submitting : UI.submitParticipation}
            </Button>
            {issuedCode && (
              <div className="rounded-lg border border-primary/20 bg-secondary/60 p-4">
                <p className="text-sm font-bold">{UI.participationSaved}</p>
                <p className="mt-1 text-sm text-muted-foreground">{UI.deleteCodeSaved}</p>
                <p
                  aria-label={UI.deleteCodeLabel}
                  className="mt-3 text-center text-xl font-black tracking-widest"
                >
                  {formatDeleteCode(issuedCode)}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 h-10"
                  onClick={() => {
                    void navigator.clipboard.writeText(formatDeleteCode(issuedCode)).then(
                      () => toast.success(UI.deleteCodeCopied),
                      () => toast.error(UI.copyFailed),
                    );
                  }}
                >
                  {UI.copyDeleteCode}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
