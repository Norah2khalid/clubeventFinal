import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { UI } from "@/lib/content";
import {
  formatParticipationDate,
  normalizeDeleteCode,
  participationLabel,
  sectionLabel,
  type Participation,
} from "@/lib/participations";

const ANNOUNCE_KEY = "event-winners-announced";
const CONFETTI = ["#6d28d9", "#c4b5fd", "#f5d0fe", "#ddd6fe", "#ffffff", "#a78bfa"];

async function loadParticipations() {
  const { data, error } = await supabase
    .from("participations")
    .select("id,title,body,section,student_name,winner_rank,created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

function pairKey(first: Participation | null, second: Participation | null) {
  return first && second ? `${first.id}|${second.id}` : "";
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function ParticipationsBoard() {
  const queryClient = useQueryClient();
  const reducedMotion = usePrefersReducedMotion();
  const [organizerCode, setOrganizerCode] = useState("");
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(6);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [replaceRank, setReplaceRank] = useState<1 | 2 | null>(null);
  const [confirmClear, setConfirmClear] = useState<1 | 2 | null>(null);
  const [confirmAnnounce, setConfirmAnnounce] = useState(false);
  const [phase, setPhase] = useState<"board" | "countdown" | "celebration">("board");
  const [count, setCount] = useState(10);
  const query = useQuery({
    queryKey: ["participations"],
    queryFn: loadParticipations,
    retry: 1,
    refetchInterval: phase === "board" ? 20_000 : false,
  });

  const rows = query.data ?? [];
  const first = rows.find((row) => row.winner_rank === 1) ?? null;
  const second = rows.find((row) => row.winner_rank === 2) ?? null;
  const list = rows.filter((row) => row.winner_rank == null);
  const shown = list.slice(0, visibleCount);
  const announceKey = pairKey(first, second);

  useEffect(() => {
    if (phase !== "countdown") return;
    const delay = reducedMotion ? 350 : 1000;
    const timer = window.setInterval(() => {
      setCount((current) => (current <= 1 ? 0 : current - 1));
    }, delay);
    return () => window.clearInterval(timer);
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (phase !== "countdown" || count > 0) return;
    if (announceKey) sessionStorage.setItem(ANNOUNCE_KEY, announceKey);
    setPhase("celebration");
    setCount(10);
  }, [phase, count, announceKey]);

  useEffect(() => {
    if (phase === "board") return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPhase("board");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["participations"] });
  }

  function organizerDraft() {
    return normalizeDeleteCode(organizerCode).length >= 16 ? organizerCode : "";
  }

  async function promote(id: string, rank: 1 | 2 | null) {
    if (pendingId) return;
    const code = organizerDraft();
    if (!code) {
      toast.error(UI.organizerCodeRequired);
      return;
    }
    setPendingId(id);
    const { error } = await supabase.rpc("set_participation_winner", {
      _id: id,
      _rank: rank,
      _code: code,
    });
    setPendingId(null);
    setPromoteId(null);
    setReplaceRank(null);
    setConfirmClear(null);
    if (error) {
      toast.error(error.code === "42501" ? UI.organizerCodeWrong : UI.operationError);
      return;
    }
    toast.success(UI.winnerUpdated);
    await refresh();
  }

  function requestPromote(id: string, rank: 1 | 2) {
    if (!organizerDraft()) {
      toast.error(UI.organizerCodeRequired);
      return;
    }
    const occupant = rank === 1 ? first : second;
    if (occupant && occupant.id !== id) {
      setReplaceRank(rank);
      setPromoteId(id);
      return;
    }
    void promote(id, rank);
  }

  function requestClear(rank: 1 | 2) {
    if (!organizerDraft()) {
      toast.error(UI.organizerCodeRequired);
      return;
    }
    setConfirmClear(rank);
  }

  async function organizerAccepted() {
    const code = organizerDraft();
    if (!code) {
      toast.error(UI.organizerCodeRequired);
      return false;
    }
    const { data, error } = await supabase.rpc("organizer_authorized", { _code: code });
    if (error || data !== true) {
      toast.error(UI.organizerCodeWrong);
      return false;
    }
    return true;
  }

  async function requestAnnounce() {
    if (!announceKey || phase !== "board") return;
    if (!(await organizerAccepted())) return;
    const previous = sessionStorage.getItem(ANNOUNCE_KEY);
    if (previous && previous !== announceKey) {
      setConfirmAnnounce(true);
      return;
    }
    setConfirmAnnounce(false);
    setCount(10);
    setPhase("countdown");
  }

  async function confirmAnnounceNow() {
    if (!(await organizerAccepted())) return;
    setConfirmAnnounce(false);
    setCount(10);
    setPhase("countdown");
  }

  async function remove(id: string, code: string) {
    if (pendingId) return;
    setPendingId(id);
    const { data, error } = await supabase.rpc("delete_participation", { _id: id, _code: code });
    setPendingId(null);
    if (error || data !== true) {
      toast.error(UI.deleteCodeWrong);
      return;
    }
    setOpenIds((current) => current.filter((item) => item !== id));
    toast.success(UI.participationDeleted);
    await refresh();
  }

  function toggle(id: string) {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <section id="participations" className="participation-board scroll-mt-8 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-5 text-center text-2xl font-extrabold text-primary sm:text-3xl">
          {UI.participationsTitle}
        </h2>
        <div className="rounded-[1.75rem] border border-primary/15 bg-white/55 p-3 shadow-soft backdrop-blur-sm sm:p-5">
          {query.isPending ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="sr-only">{UI.loading}</span>
            </div>
          ) : query.isError ? (
            <p className="py-6 text-center text-sm text-destructive">{UI.participationsError}</p>
          ) : (
            <div className="space-y-4">
              {phase === "countdown" && count >= 1 && (
                <div className="flex flex-col items-center py-2" aria-live="assertive">
                  <p className="sr-only">{UI.countdownLabel}</p>
                  <p
                    key={count}
                    className="participation-count bg-gradient-brand bg-clip-text text-7xl font-black text-transparent sm:text-8xl"
                  >
                    {count}
                  </p>
                </div>
              )}
              <div className="relative">
                {phase === "celebration" && <CelebrationGlow reducedMotion={reducedMotion} />}
                <div className="relative grid gap-3 sm:grid-cols-2">
                  <RankCard
                    title={UI.rankFirst}
                    row={first}
                    prominent
                    celebrating={phase === "celebration"}
                    open={first ? openIds.includes(first.id) : false}
                    confirming={confirmClear === 1}
                    pending={pendingId === first?.id}
                    onToggle={() => first && toggle(first.id)}
                    onAskClear={() => requestClear(1)}
                    onCancel={() => setConfirmClear(null)}
                    onClear={() => first && promote(first.id, null)}
                    onDelete={(code) => first && remove(first.id, code)}
                  />
                  <RankCard
                    title={UI.rankSecond}
                    row={second}
                    celebrating={phase === "celebration"}
                    open={second ? openIds.includes(second.id) : false}
                    confirming={confirmClear === 2}
                    pending={pendingId === second?.id}
                    onToggle={() => second && toggle(second.id)}
                    onAskClear={() => requestClear(2)}
                    onCancel={() => setConfirmClear(null)}
                    onClear={() => second && promote(second.id, null)}
                    onDelete={(code) => second && remove(second.id, code)}
                  />
                </div>
                {phase === "celebration" && (
                  <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-lg font-black text-primary">
                      <Sparkles className="h-5 w-5" />
                      {UI.celebrationTitle}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full border-primary/30 bg-white/80"
                      onClick={() => setPhase("board")}
                    >
                      {UI.backToBoard}
                    </Button>
                  </div>
                )}
              </div>
              {phase === "board" && (
                <div className="space-y-2">
                  <label htmlFor="organizer-code" className="block text-xs font-bold text-primary">
                    {UI.organizerCode}
                  </label>
                  <Input
                    id="organizer-code"
                    type="password"
                    value={organizerCode}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={UI.organizerCodeHint}
                    className="h-9 bg-white"
                    onChange={(event) => setOrganizerCode(event.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 w-full rounded-full bg-gradient-brand shadow-glow"
                    disabled={!first || !second || organizerDraft() === ""}
                    onClick={() => void requestAnnounce()}
                  >
                    {UI.announceWinners}
                  </Button>
                  {confirmAnnounce && (
                    <InlineConfirm
                      text={UI.announceConfirm}
                      confirmLabel={UI.confirmAnnounce}
                      pending={false}
                      onConfirm={() => void confirmAnnounceNow()}
                      onCancel={() => setConfirmAnnounce(false)}
                    />
                  )}
                </div>
              )}
              {list.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  {UI.participationsEmpty}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {shown.map((row, index) => (
                    <IdeaCard
                      key={row.id}
                      label={participationLabel(index)}
                      row={row}
                      open={openIds.includes(row.id)}
                      choosing={promoteId === row.id}
                      replaceRank={promoteId === row.id ? replaceRank : null}
                      pending={pendingId === row.id}
                      onToggle={() => toggle(row.id)}
                      onChoose={() => {
                        setReplaceRank(null);
                        setPromoteId(promoteId === row.id ? null : row.id);
                      }}
                      onPromote={(rank) => requestPromote(row.id, rank)}
                      onConfirmReplace={() => replaceRank && promote(row.id, replaceRank)}
                      onCancelReplace={() => setReplaceRank(null)}
                      onDelete={(code) => remove(row.id, code)}
                    />
                  ))}
                </div>
              )}
              {list.length > 6 && (
                <div className="text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full border-primary/30"
                    onClick={() =>
                      setVisibleCount((current) => (current >= list.length ? 6 : current + 6))
                    }
                  >
                    {visibleCount >= list.length ? UI.showLess : UI.showMore}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RankCard({
  title,
  row,
  prominent = false,
  celebrating = false,
  open,
  confirming,
  pending,
  onToggle,
  onAskClear,
  onCancel,
  onClear,
  onDelete,
}: {
  title: string;
  row: Participation | null;
  prominent?: boolean;
  celebrating?: boolean;
  open: boolean;
  confirming: boolean;
  pending: boolean;
  onToggle: () => void;
  onAskClear: () => void;
  onCancel: () => void;
  onClear: () => void;
  onDelete: (code: string) => void;
}) {
  return (
    <article
      className={`rounded-3xl p-4 text-primary-foreground shadow-soft transition duration-300 ${
        prominent
          ? "bg-gradient-to-br from-primary via-[oklch(0.46_0.16_305)] to-[oklch(0.62_0.12_305)] shadow-glow"
          : "bg-gradient-to-br from-[oklch(0.58_0.11_305)] to-[oklch(0.74_0.07_305)]"
      } ${celebrating && prominent ? "scale-[1.02]" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className={`font-extrabold ${prominent ? "text-lg" : "text-base"}`}>{title}</h3>
        {row && (
          <button
            type="button"
            className="rounded-full bg-white/15 p-1 transition hover:bg-white/25"
            aria-expanded={open}
            aria-label={`${open ? UI.close : UI.showDetails} ${row.title}`}
            onClick={onToggle}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
      {row ? (
        <div className="mt-3">
          <p className={`${prominent ? "text-xl" : "text-lg"} font-black leading-snug`}>
            {row.student_name}
          </p>
          <p className="mt-1 text-sm text-primary-foreground/85">{row.title}</p>
          <Details open={open} body={row.body} meta={participationMeta(row)} light />
          {confirming ? (
            <div className="mt-2">
              <InlineConfirm
                text={UI.clearWinner}
                confirmLabel={UI.confirmReplace}
                pending={pending}
                onConfirm={onClear}
                onCancel={onCancel}
              />
            </div>
          ) : (
            <button
              type="button"
              className="mt-2 text-xs text-primary-foreground/80 underline-offset-2 hover:underline"
              onClick={onAskClear}
            >
              {UI.clearWinner}
            </button>
          )}
          <DeleteControl id={row.id} pending={pending} onDelete={onDelete} light />
        </div>
      ) : (
        <p className="mt-6 text-sm text-primary-foreground/80">{UI.rankWaiting}</p>
      )}
    </article>
  );
}

function IdeaCard({
  label,
  row,
  open,
  choosing,
  replaceRank,
  pending,
  onToggle,
  onChoose,
  onPromote,
  onConfirmReplace,
  onCancelReplace,
  onDelete,
}: {
  label: string;
  row: Participation;
  open: boolean;
  choosing: boolean;
  replaceRank: 1 | 2 | null;
  pending: boolean;
  onToggle: () => void;
  onChoose: () => void;
  onPromote: (rank: 1 | 2) => void;
  onConfirmReplace: () => void;
  onCancelReplace: () => void;
  onDelete: (code: string) => void;
}) {
  return (
    <article className="rounded-3xl border border-primary/10 bg-white/90 p-4 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-glow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-primary">{label}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{row.student_name}</p>
          <h3 className="truncate text-base font-extrabold">{row.title}</h3>
        </div>
        <button
          type="button"
          className="rounded-full bg-secondary p-2 text-primary transition hover:bg-accent"
          aria-expanded={open}
          aria-controls={`participation-${row.id}`}
          aria-label={`${open ? UI.close : UI.showDetails} ${row.title}`}
          onClick={onToggle}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      <Details
        id={`participation-${row.id}`}
        open={open}
        body={row.body}
        meta={participationMeta(row)}
      />
      <div className="mt-3 space-y-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-full rounded-full border-primary/25 text-primary hover:bg-secondary"
          disabled={pending}
          aria-expanded={choosing}
          onClick={onChoose}
        >
          {UI.promoteIdea}
        </Button>
        {choosing && (
          <div className="grid gap-1">
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-full bg-gradient-brand text-xs"
              disabled={pending}
              onClick={() => onPromote(1)}
            >
              {UI.promoteToFirst}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full text-xs"
              disabled={pending}
              onClick={() => onPromote(2)}
            >
              {UI.promoteToSecond}
            </Button>
          </div>
        )}
        {replaceRank && (
          <InlineConfirm
            text={UI.replaceConfirm}
            confirmLabel={UI.confirmReplace}
            pending={pending}
            onConfirm={onConfirmReplace}
            onCancel={onCancelReplace}
          />
        )}
      </div>
      <DeleteControl id={row.id} pending={pending} onDelete={onDelete} />
    </article>
  );
}

function DeleteControl({
  id,
  pending,
  light = false,
  onDelete,
}: {
  id: string;
  pending: boolean;
  light?: boolean;
  onDelete: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  if (!open) {
    return (
      <button
        type="button"
        className={`text-xs ${light ? "mt-2 text-primary-foreground/80" : "mt-3 text-destructive"}`}
        onClick={() => setOpen(true)}
      >
        {UI.deleteMine}
      </button>
    );
  }
  return (
    <div className={`mt-3 space-y-2 rounded-2xl p-2 ${light ? "bg-white/15" : "bg-secondary/70"}`}>
      <label htmlFor={`delete-${id}`} className="block text-xs font-bold">
        {UI.deleteCodeLabel}
      </label>
      <Input
        id={`delete-${id}`}
        value={code}
        autoComplete="off"
        placeholder={UI.deleteCodeHint}
        className="h-8 bg-white text-foreground"
        onChange={(event) => setCode(event.target.value)}
      />
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          className="h-7 rounded-full px-3 text-xs"
          disabled={pending || code.trim().length < 8}
          onClick={() => onDelete(code)}
        >
          {UI.confirmDelete}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 rounded-full bg-white px-3 text-xs text-foreground"
          onClick={() => {
            setOpen(false);
            setCode("");
          }}
        >
          {UI.cancel}
        </Button>
      </div>
    </div>
  );
}

function participationMeta(row: Participation) {
  const sentAt = formatParticipationDate(row.created_at);
  return [sectionLabel(row.section), sentAt ? `${UI.sentAt}: ${sentAt}` : ""]
    .filter(Boolean)
    .join(" · ");
}

function Details({
  id,
  open,
  body,
  meta,
  light = false,
}: {
  id?: string;
  open: boolean;
  body: string;
  meta?: string;
  light?: boolean;
}) {
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      inert={!open}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          id={id}
          className={`mt-3 rounded-2xl p-3 ${light ? "bg-white/15 text-primary-foreground" : "bg-[oklch(0.97_0.02_305)] text-foreground"}`}
        >
          <p className="mb-1 text-xs font-bold">{UI.ideaDetails}</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
          {meta && (
            <p
              className={`mt-3 text-xs ${light ? "text-primary-foreground/75" : "text-muted-foreground"}`}
            >
              {meta}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function InlineConfirm({
  text,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  text: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-secondary/70 p-2 text-foreground">
      <p className="text-xs leading-relaxed">{text}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          className="h-7 rounded-full px-3 text-xs"
          disabled={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 rounded-full px-3 text-xs"
          onClick={onCancel}
        >
          {UI.cancel}
        </Button>
      </div>
    </div>
  );
}

function CelebrationGlow({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) return null;
  const pieces = CONFETTI.flatMap((color, colorIndex) =>
    [0, 1, 2, 3].map((copy) => ({
      color,
      left: `${(colorIndex * 17 + copy * 23) % 100}%`,
      delay: `${(colorIndex + copy) * 70}ms`,
    })),
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_center,oklch(0.78_0.1_305/0.45),transparent_68%)]" />
      {pieces.map((piece, index) => (
        <span
          key={`${piece.left}-${index}`}
          className="participation-confetti-piece"
          style={{ left: piece.left, background: piece.color, animationDelay: piece.delay }}
        />
      ))}
    </div>
  );
}
