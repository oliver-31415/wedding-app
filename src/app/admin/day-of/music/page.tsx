import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { deletePartAction, deleteSongAction, removeSheetAction } from "@/app/admin/day-of/actions";
import { PartForm, PrintButton, SongForm } from "@/components/admin/day-of/forms";
import { DayOfSubNav } from "@/components/admin/day-of/sub-nav";
import { Card, CardBody, CardHeader, ConfirmButton, EmptyState, PageHeader } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { INSTRUMENTS } from "@/lib/planning";

export const metadata: Metadata = { title: "Music" };

/** Suggestions for the Moment field (typed freely; these are just hints). */
const MOMENTS = [
  "Walking down the aisle",
  "Signing the register",
  "Recessional",
  "Grand entrance",
  "First dance",
  "Parent dances",
  "Cake cutting",
  "Last song",
];

export default async function MusicPage() {
  const { wedding } = await requireHost();
  const songs = await db
    .select()
    .from(schema.songs)
    .where(eq(schema.songs.weddingId, wedding.id))
    .orderBy(asc(schema.songs.position), asc(schema.songs.createdAt));
  const parts = await db
    .select()
    .from(schema.songParts)
    .where(eq(schema.songParts.weddingId, wedding.id))
    .orderBy(asc(schema.songParts.position), asc(schema.songParts.createdAt));
  const partsOf = (songId: string) => parts.filter((p) => p.songId === songId);

  const play = songs.filter((s) => !s.doNotPlay);
  const momentOrder = (m: string | null) => (m === null ? 999 : MOMENTS.indexOf(m) === -1 ? 500 : MOMENTS.indexOf(m));
  const moments = [...new Set(play.map((s) => s.moment))].sort((a, b) => momentOrder(a) - momentOrder(b));
  const doNot = songs.filter((s) => s.doNotPlay);
  const allMoments = [...new Set([...MOMENTS, ...songs.map((s) => s.moment).filter((m): m is string => !!m)])];

  const SongRow = ({ s }: { s: (typeof songs)[number] }) => (
    <li className="px-5 py-3">
      <p className="text-sm text-ink">
        <span className="font-medium">{s.title}</span>
        {s.artist && <span className="text-ink-muted"> — {s.artist}</span>}
      </p>
      {partsOf(s.id).length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          {partsOf(s.id).map((p) => (
            <li key={p.id}>
              {p.instrument}
              {p.sheetUrl && (
                <>
                  {" · "}
                  <a href={p.sheetUrl} target="_blank" className="text-brand hover:underline print:hidden">
                    {p.sheetName ?? "Sheet music"} ↗
                  </a>
                  <span className="hidden print:inline">sheet music</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <details className="print:hidden">
        <summary className="cursor-pointer text-sm text-ink-muted hover:text-ink">Edit</summary>
        <div className="mt-3 space-y-3">
          <SongForm song={s} moments={allMoments} />
          <form action={deleteSongAction}>
            <input type="hidden" name="id" value={s.id} />
            <ConfirmButton
              confirm={`Remove “${s.title}”?${partsOf(s.id).some((p) => p.sheetUrl) ? " Its sheet music is deleted too." : ""}`}
            >
              Remove
            </ConfirmButton>
          </form>
          {!s.doNotPlay && (
            <div className="space-y-4 border-t border-line pt-4">
              <div>
                <h3 className="text-sm font-medium text-ink">Instruments and sheet music</h3>
                <p className="text-sm text-ink-muted">Add who plays this song, with a PDF of their part if you have one.</p>
              </div>
              {partsOf(s.id).map((p) => (
                <div key={p.id} className="space-y-2 rounded-lg border border-line p-3">
                  <PartForm part={p} />
                  <div className="flex flex-wrap gap-2">
                    {p.sheetUrl && (
                      <form action={removeSheetAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmButton confirm={`Delete the ${p.instrument} sheet music?`}>Remove PDF</ConfirmButton>
                      </form>
                    )}
                    <form action={deletePartAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton
                        confirm={`Remove ${p.instrument} from “${s.title}”?${p.sheetUrl ? " Its sheet music is deleted too." : ""}`}
                      >
                        Remove {p.instrument}
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
              ))}
              <PartForm songId={s.id} />
            </div>
          )}
        </div>
      </details>
    </li>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Music"
        description="Songs for the big moments, requests, and anything the DJ or band must not play. Open a song's Edit to add its instruments and sheet music."
        actions={songs.length > 0 ? <PrintButton /> : undefined}
      />
      <DayOfSubNav current="/admin/day-of/music" />
      <datalist id="song-instruments">
        {INSTRUMENTS.map((i) => (
          <option key={i} value={i} />
        ))}
      </datalist>

      {songs.length === 0 ? (
        <EmptyState title="No songs yet" body="Start with your walk down the aisle and first dance." />
      ) : (
        <>
          {moments.map((m) => (
            <Card key={m ?? "general"}>
              <CardHeader title={m ?? "Requests"} />
              <ul className="divide-y divide-line">
                {play
                  .filter((s) => s.moment === m)
                  .map((s) => (
                    <SongRow key={s.id} s={s} />
                  ))}
              </ul>
            </Card>
          ))}
          {doNot.length > 0 && (
            <Card>
              <CardHeader title="Do not play" />
              <ul className="divide-y divide-line">
                {doNot.map((s) => (
                  <SongRow key={s.id} s={s} />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <Card className="print:hidden">
        <CardHeader title="Add a song" />
        <CardBody>
          <SongForm moments={allMoments} />
        </CardBody>
      </Card>
    </div>
  );
}
