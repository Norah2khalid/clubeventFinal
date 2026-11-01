import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { UI } from "@/lib/content";
import type { Participation } from "@/lib/participations";

const ANNOUNCE_KEY = "event-winners-announced";
const CONFETTI = ["#7c3aed", "#c4b5fd", "#f5d0fe", "#fde68a", "#ffffff", "#a78bfa"];

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
  const isAdmin = useIsAdmin();
  const reducedMotion = usePrefersReducedMotion();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [replaceRank, setReplaceRank] = useState<1 | 2 | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<1 | 2 | null>(null);
  const [confirmAnnounce, setConfirmAnnounce] = useState(false);
  const [phase, setPhase] = useState<"board" | "countdown" | "celebration">("board");
  const [count, setCount] = useState(6);
  const query = useQuery({
    queryKey: ["participations"],
    queryFn: loadParticipations,
    retry: 1,
    refetchInterval: phase === "board" ? 30_000 : false,
  });

  const rows = query.data ?? [];
  const first = rows.find((row) => row.winner_rank === 1) ?? null;
  const second = rows.find((row) => row.winner_rank === 2) ?? null;
  const list = rows.filter((row) => row.winner_rank == null);
  const slots = Array.from({ length: Math.max(6, list.length) }, (_, index) => list[index] ?? null);
  const announceKey = pairKey(first, second);

  useEffect(() => {
    if (phase !== "countdown") return;
    const delay = reducedMotion ? 350 : 1000;
    const timer = window.setInterval(() => setCount((current) => current - 1), delay);
    return () => window.clearInterval(timer);
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (phase !== "countdown" || count > 0) return;
    if (announceKey) sessionStorage.setItem(ANNOUNCE_KEY, announceKey);
    setPhase("celebration");
    setCount(6);
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

  async function promote(id: string, rank: 1 | 2 | null) {
    if (pendingId) return;
    setPendingId(id);
    const { error } = await supabase.rpc("set_participation_winner", { _id: id, _rank: rank });
    setPendingId(null);
    setPromoteId(null);
    setReplaceRank(null);
    setConfirmClear(null);
    if (error) {
      toast.error(error.code === "42501" ? UI.adminOnly : UI.operationError);
      return;
    }
    toast.success(UI.winnerUpdated);
    await refresh();
  }

  function requestPromote(id: string, rank: 1 | 2) {
    const occupant = rank === 1 ? first : second;
    if (occupant && occupant.id !== id) {
      setReplaceRank(rank);
      setPromoteId(id);
      return;
    }
    void promote(id, rank);
  }

  function requestAnnounce() {
    if (!announceKey) return;
    const previous = sessionStorage.getItem(ANNOUNCE_KEY);
    if (previous && previous !== announceKey) {
      setConfirmAnnounce(true);
      return;
    }
    setConfirmAnnounce(false);
    setCount(6);
    setPhase("countdown");
  }

  async function remove(id: string) {
    if (pendingId) return;
    setPendingId(id);
    const { data, error } = await supabase
      .from("participations")
      .delete()
      .eq("id", id)
      .select("id");
    setPendingId(null);
    if (error || !data?.length) {
      toast.error(UI.operationError);
      return;
    }
    if (openId === id) setOpenId(null);
    setConfirmDeleteId(null);
    toast.success(UI.participationDeleted);
    await refresh();
  }

  return (
    <section id="participations" className="scroll-mt-8 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-3 text-center text-xl font-extrabold sm:text-2xl">
          {UI.participationsTitle}
        </h2>
        <div className="relative overflow-hidden rounded-lg border bg-card p-3 shadow-soft sm:p-4">
          {query.isPending ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="sr-only">{UI.loading}</span>
            </div>
          ) : query.isError ? (
            <p className="py-4 text-center text-sm text-destructive">{UI.participationsError}</p>
          ) : phase === "countdown" ? (
            <div
              className="flex min-h-40 flex-col items-center justify-center py-6"
              aria-live="assertive"
            >
              <p className="sr-only">{UI.countdownLabel}</p>
              <p
                key={count}
                className="text-6xl font-black text-primary motion-safe:animate-fade-up sm:text-7xl"
              >
                {Math.max(count, 1)}
              </p>
            </div>
          ) : phase === "celebration" ? (
            <Celebration
              first={first}
              second={second}
              reducedMotion={reducedMotion}
              onClose={() => setPhase("board")}
            />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <RankBox
                  title={UI.rankFirst}
                  row={first}
                  prominent
                  isAdmin={isAdmin}
                  confirming={confirmClear === 1}
                  pending={pendingId === first?.id}
                  onAskClear={() => setConfirmClear(1)}
                  onCancel={() => setConfirmClear(null)}
                  onClear={() => first && promote(first.id, null)}
                />
                <RankBox
                  title={UI.rankSecond}
                  row={second}
                  isAdmin={isAdmin}
                  confirming={confirmClear === 2}
                  pending={pendingId === second?.id}
                  onAskClear={() => setConfirmClear(2)}
                  onCancel={() => setConfirmClear(null)}
                  onClear={() => second && promote(second.id, null)}
                />
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-full bg-gradient-brand text-xs"
                    disabled={!first || !second}
                    onClick={requestAnnounce}
                  >
                    {UI.announceWinners}
                  </Button>
                  {confirmAnnounce && (
                    <InlineConfirm
                      text={UI.announceConfirm}
                      confirmLabel={UI.confirmAnnounce}
                      pending={false}
                      onConfirm={() => {
                        setConfirmAnnounce(false);
                        setCount(6);
                        setPhase("countdown");
                      }}
                      onCancel={() => setConfirmAnnounce(false)}
                    />
                  )}
                </div>
              )}
              <div
                className={`grid grid-cols-2 gap-2 ${slots.length > 6 ? "max-h-80 overflow-y-auto pe-1" : ""}`}
              >
                {slots.map((row, index) => (
                  <Slot
                    key={row?.id ?? `empty-${index}`}
                    number={index + 1}
                    row={row}
                    open={row ? openId === row.id : false}
                    isAdmin={isAdmin}
                    choosing={row ? promoteId === row.id : false}
                    replaceRank={row && promoteId === row.id ? replaceRank : null}
                    pending={row ? pendingId === row.id : false}
                    deleting={row ? confirmDeleteId === row.id : false}
                    onToggle={() => row && setOpenId(openId === row.id ? null : row.id)}
                    onChoose={() => {
                      if (!row) return;
                      setReplaceRank(null);
                      setPromoteId(promoteId === row.id ? null : row.id);
                    }}
                    onPromote={(rank) => row && requestPromote(row.id, rank)}
                    onConfirmReplace={() => row && replaceRank && promote(row.id, replaceRank)}
                    onCancelReplace={() => setReplaceRank(null)}
                    onAskDelete={() => row && setConfirmDeleteId(row.id)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                    onDelete={() => row && remove(row.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RankBox({
  title,
  row,
  prominent = false,
  isAdmin,
  confirming,
  pending,
  onAskClear,
  onCancel,
  onClear,
}: {
  title: string;
  row: Participation | null;
  prominent?: boolean;
  isAdmin: boolean;
  confirming: boolean;
  pending: boolean;
  onAskClear: () => void;
  onCancel: () => void;
  onClear: () => void;
}) {
  return (
    <article
      className={`rounded-md border bg-background p-2 ${prominent ? "border-primary shadow-glow" : "border-primary/35"}`}
    >
      <h3
        className={`font-extrabold ${prominent ? "text-sm text-primary" : "text-xs text-primary/80"}`}
      >
        {title}
      </h3>
      {row ? (
        <div className="mt-1">
          <p className="truncate text-xs text-muted-foreground">{row.student_name}</p>
          <p className={`truncate font-bold ${prominent ? "text-sm" : "text-xs"}`}>{row.title}</p>
          {isAdmin &&
            (confirming ? (
              <InlineConfirm
                text={UI.clearWinner}
                confirmLabel={UI.confirmReplace}
                pending={pending}
                onConfirm={onClear}
                onCancel={onCancel}
              />
            ) : (
              <button
                type="button"
                className="mt-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                onClick={onAskClear}
              >
                {UI.clearWinner}
              </button>
            ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{UI.rankWaiting}</p>
      )}
    </article>
  );
}

function Slot({
  number,
  row,
  open,
  isAdmin,
  choosing,
  replaceRank,
  pending,
  deleting,
  onToggle,
  onChoose,
  onPromote,
  onConfirmReplace,
  onCancelReplace,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  number: number;
  row: Participation | null;
  open: boolean;
  isAdmin: boolean;
  choosing: boolean;
  replaceRank: 1 | 2 | null;
  pending: boolean;
  deleting: boolean;
  onToggle: () => void;
  onChoose: () => void;
  onPromote: (rank: 1 | 2) => void;
  onConfirmReplace: () => void;
  onCancelReplace: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const label = `المشاركة رقم ${number}`;
  return (
    <article className="rounded-md border bg-background p-2">
      <p className="text-[11px] font-semibold text-primary">{label}</p>
      {row ? (
        <div className="mt-1">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{row.student_name}</p>
              <p className="truncate text-sm font-bold">{row.title}</p>
            </div>
            <button
              type="button"
              className="rounded-sm p-1 text-muted-foreground hover:text-primary"
              aria-expanded={open}
              aria-controls={`participation-${row.id}`}
              aria-label={`${open ? UI.close : UI.showDetails} ${row.title}`}
              onClick={onToggle}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </div>
          {isAdmin && (
            <div className="mt-2 space-y-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                disabled={pending}
                aria-expanded={choosing}
                onClick={onChoose}
              >
                {UI.promote}
              </Button>
              {choosing && (
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 bg-gradient-brand px-2 text-xs"
                    disabled={pending}
                    onClick={() => onPromote(1)}
                  >
                    {UI.rankFirst}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={pending}
                    onClick={() => onPromote(2)}
                  >
                    {UI.rankSecond}
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
          )}
          {open && (
            <div id={`participation-${row.id}`} className="mt-2 space-y-2 border-t pt-2">
              <p className="whitespace-pre-wrap text-xs leading-relaxed">{row.body}</p>
              {isAdmin &&
                (deleting ? (
                  <InlineConfirm
                    text={UI.confirmDeleteParticipation}
                    confirmLabel={UI.confirmDelete}
                    pending={pending}
                    onConfirm={onDelete}
                    onCancel={onCancelDelete}
                  />
                ) : (
                  <button
                    type="button"
                    className="text-[11px] text-destructive"
                    disabled={pending}
                    onClick={onAskDelete}
                  >
                    {UI.delete}
                  </button>
                ))}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{UI.slotEmpty}</p>
      )}
    </article>
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
    <div className="rounded-md border border-primary/20 bg-secondary/40 p-2">
      <p className="text-[11px] leading-relaxed">{text}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={onCancel}
        >
          {UI.cancel}
        </Button>
      </div>
    </div>
  );
}

function Celebration({
  first,
  second,
  reducedMotion,
  onClose,
}: {
  first: Participation | null;
  second: Participation | null;
  reducedMotion: boolean;
  onClose: () => void;
}) {
  const pieces = reducedMotion
    ? []
    : CONFETTI.flatMap((color, colorIndex) =>
        [0, 1, 2, 3].map((copy) => ({
          color,
          left: `${(colorIndex * 17 + copy * 23) % 100}%`,
          delay: `${(colorIndex + copy) * 70}ms`,
        })),
      );
  return (
    <div className="relative min-h-44 py-2" aria-live="polite">
      {pieces.map((piece, index) => (
        <span
          key={`${piece.left}-${index}`}
          className="participation-confetti-piece"
          style={{ left: piece.left, background: piece.color, animationDelay: piece.delay }}
        />
      ))}
      <div className="relative flex items-start justify-between gap-2">
        <h3 className="text-lg font-black text-primary">{UI.celebrationTitle}</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={onClose}
        >
          {UI.closeCelebration}
        </Button>
      </div>
      <div className="relative mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <WinnerBadge title={UI.rankFirst} row={first} prominent />
        <WinnerBadge title={UI.rankSecond} row={second} />
      </div>
    </div>
  );
}

function WinnerBadge({
  title,
  row,
  prominent = false,
}: {
  title: string;
  row: Participation | null;
  prominent?: boolean;
}) {
  if (!row) return null;
  return (
    <article
      className={`rounded-md border bg-background p-3 ${prominent ? "border-2 border-primary shadow-glow" : "border-primary/40"}`}
    >
      <p
        className={`font-extrabold ${prominent ? "text-sm text-primary" : "text-xs text-primary/80"}`}
      >
        {title}
      </p>
      <p className="mt-1 text-sm font-semibold">{row.student_name}</p>
      <p className={`font-bold ${prominent ? "text-base" : "text-sm"}`}>{row.title}</p>
    </article>
  );
}
