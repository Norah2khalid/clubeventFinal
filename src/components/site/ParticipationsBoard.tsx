import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { UI } from "@/lib/content";
import { formatParticipationDate, sectionLabel, type Participation } from "@/lib/participations";
import { SectionHeading } from "./Reveal";

async function loadParticipations() {
  const { data, error } = await supabase
    .from("participations")
    .select("id,title,body,section,winner_rank,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function ParticipationsBoard() {
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["participations"],
    queryFn: loadParticipations,
    retry: 1,
    refetchInterval: 30_000,
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["participations"] });
  }

  async function promote(id: string, rank: 1 | 2 | null) {
    if (pendingId) return;
    setPendingId(id);
    const { error } = await supabase.rpc("set_participation_winner", { _id: id, _rank: rank });
    setPendingId(null);
    if (error) {
      toast.error(error.code === "42501" ? UI.adminOnly : UI.operationError);
      return;
    }
    toast.success(UI.winnerUpdated);
    await refresh();
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
    setConfirmId(null);
    toast.success(UI.participationDeleted);
    await refresh();
  }

  const rows = query.data ?? [];
  const first = rows.find((row) => row.winner_rank === 1) ?? null;
  const second = rows.find((row) => row.winner_rank === 2) ?? null;
  const list = rows.filter((row) => row.winner_rank == null);

  return (
    <section id="participations" className="scroll-mt-8 px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow={UI.participationsEyebrow} title={UI.participationsTitle} />
        {query.isPending ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="sr-only">{UI.loading}</span>
          </div>
        ) : query.isError ? (
          <p className="text-center text-destructive">{UI.participationsError}</p>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-5 md:grid-cols-2">
              <WinnerBox
                title={UI.winnerFirst}
                row={first}
                isAdmin={isAdmin}
                pending={pendingId === first?.id}
                confirming={confirmId === first?.id}
                onPromote={promote}
                onAskDelete={setConfirmId}
                onCancelDelete={() => setConfirmId(null)}
                onDelete={remove}
              />
              <WinnerBox
                title={UI.winnerSecond}
                row={second}
                isAdmin={isAdmin}
                pending={pendingId === second?.id}
                confirming={confirmId === second?.id}
                onPromote={promote}
                onAskDelete={setConfirmId}
                onCancelDelete={() => setConfirmId(null)}
                onDelete={remove}
              />
            </div>
            {list.length === 0 ? (
              <p className="text-center text-muted-foreground">{UI.participationsEmpty}</p>
            ) : (
              <div className="max-h-[32rem] space-y-3 overflow-y-auto pe-1">
                {list.map((row) => {
                  const open = openId === row.id;
                  return (
                    <article key={row.id} className="rounded-lg border bg-card shadow-soft">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-right"
                        aria-expanded={open}
                        onClick={() => setOpenId(open ? null : row.id)}
                      >
                        <span className="font-bold leading-relaxed">{row.title}</span>
                        <ChevronDown
                          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                      {open && (
                        <div className="space-y-4 border-t px-4 py-4">
                          <ParticipationMeta row={row} />
                          <p className="whitespace-pre-wrap leading-relaxed">{row.body}</p>
                          {isAdmin && (
                            <AdminActions
                              row={row}
                              pending={pendingId === row.id}
                              confirming={confirmId === row.id}
                              onPromote={promote}
                              onAskDelete={() => setConfirmId(row.id)}
                              onCancelDelete={() => setConfirmId(null)}
                              onDelete={() => remove(row.id)}
                            />
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ParticipationMeta({ row }: { row: Participation }) {
  const sentAt = formatParticipationDate(row.created_at);
  return (
    <p className="text-sm text-muted-foreground">
      {sectionLabel(row.section)}
      {sentAt ? ` — ${UI.sentAt}: ${sentAt}` : ""}
    </p>
  );
}

function WinnerBox({
  title,
  row,
  isAdmin,
  pending,
  confirming,
  onPromote,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  title: string;
  row: Participation | null;
  isAdmin: boolean;
  pending: boolean;
  confirming: boolean;
  onPromote: (id: string, rank: 1 | 2 | null) => void;
  onAskDelete: (id: string) => void;
  onCancelDelete: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <article className="rounded-lg border-2 border-primary/45 bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold">{title}</h3>
        <Trophy className="h-6 w-6 shrink-0 text-primary" />
      </div>
      {row ? (
        <div className="space-y-4">
          <p className="text-xl font-bold leading-relaxed">{row.title}</p>
          <ParticipationMeta row={row} />
          <p className="whitespace-pre-wrap leading-relaxed">{row.body}</p>
          {isAdmin && (
            <AdminActions
              row={row}
              pending={pending}
              confirming={confirming}
              onPromote={onPromote}
              onAskDelete={() => onAskDelete(row.id)}
              onCancelDelete={onCancelDelete}
              onDelete={() => onDelete(row.id)}
            />
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">{UI.winnerEmpty}</p>
      )}
    </article>
  );
}

function AdminActions({
  row,
  pending,
  confirming,
  onPromote,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  row: Participation;
  pending: boolean;
  confirming: boolean;
  onPromote: (id: string, rank: 1 | 2 | null) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {row.winner_rank !== 1 && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-auto whitespace-normal"
          disabled={pending}
          onClick={() => onPromote(row.id, 1)}
        >
          {UI.promoteFirst}
        </Button>
      )}
      {row.winner_rank !== 2 && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-auto whitespace-normal"
          disabled={pending}
          onClick={() => onPromote(row.id, 2)}
        >
          {UI.promoteSecond}
        </Button>
      )}
      {row.winner_rank != null && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-auto whitespace-normal"
          disabled={pending}
          onClick={() => onPromote(row.id, null)}
        >
          {UI.clearWinner}
        </Button>
      )}
      {confirming ? (
        <div className="w-full rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm">{UI.confirmDeleteParticipation}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={onDelete}
            >
              {UI.confirmDelete}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onCancelDelete}
            >
              {UI.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={onAskDelete}
        >
          {UI.delete}
        </Button>
      )}
    </div>
  );
}
