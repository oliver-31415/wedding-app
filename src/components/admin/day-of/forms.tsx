"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { savePartAction, saveRunItemAction, saveSongAction } from "@/app/admin/day-of/actions";
import { Button, Checkbox, Field, FormMessage, Input, SubmitButton, Textarea } from "@/components/ui";
import { MAX_SHEET_BYTES } from "@/lib/planning";

function useResetOnAdd(state: { ok?: boolean } | null, isEdit: boolean) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && !isEdit) ref.current?.reset();
  }, [state, isEdit]);
  return ref;
}

export type RunItem = { id: string; time: string | null; title: string; location: string | null; who: string | null; notes: string | null };

export function RunItemForm({ item }: { item?: RunItem }) {
  const [state, action] = useActionState(saveRunItemAction, null);
  const ref = useResetOnAdd(state, !!item);
  const e = state?.errors ?? {};
  const k = item?.id ?? "new";
  return (
    <form ref={ref} action={action} className="space-y-3">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Field label="Time" htmlFor={`rt-${k}`} optional error={e.time}>
          <Input id={`rt-${k}`} name="time" type="time" defaultValue={item?.time ?? ""} invalid={!!e.time} />
        </Field>
        <Field label="What happens" htmlFor={`rw-${k}`} error={e.title}>
          <Input id={`rw-${k}`} name="title" defaultValue={item?.title ?? ""} placeholder="e.g. Ceremony begins" invalid={!!e.title} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Where" htmlFor={`rl-${k}`} optional>
          <Input id={`rl-${k}`} name="location" defaultValue={item?.location ?? ""} placeholder="e.g. Garden lawn" />
        </Field>
        <Field label="Who" htmlFor={`rp-${k}`} optional>
          <Input id={`rp-${k}`} name="who" defaultValue={item?.who ?? ""} placeholder="e.g. Celebrant, photographer" />
        </Field>
      </div>
      <Field label="Notes" htmlFor={`rn-${k}`} optional>
        <Textarea id={`rn-${k}`} name="notes" rows={2} defaultValue={item?.notes ?? ""} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant={item ? "secondary" : "primary"} size={item ? "sm" : "md"}>
        {item ? "Save" : "Add to run sheet"}
      </SubmitButton>
    </form>
  );
}

export type Song = { id: string; title: string; artist: string | null; moment: string | null; doNotPlay: boolean; notes: string | null };

export function SongForm({ song, moments }: { song?: Song; moments: string[] }) {
  const [state, action] = useActionState(saveSongAction, null);
  const ref = useResetOnAdd(state, !!song);
  const e = state?.errors ?? {};
  const k = song?.id ?? "new";
  return (
    <form ref={ref} action={action} className="space-y-3">
      {song && <input type="hidden" name="id" value={song.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Song" htmlFor={`st-${k}`} error={e.title}>
          <Input id={`st-${k}`} name="title" defaultValue={song?.title ?? ""} invalid={!!e.title} />
        </Field>
        <Field label="Artist" htmlFor={`sa-${k}`} optional>
          <Input id={`sa-${k}`} name="artist" defaultValue={song?.artist ?? ""} />
        </Field>
        <Field label="Moment" htmlFor={`sm-${k}`} optional hint="Leave blank for general requests.">
          <Input id={`sm-${k}`} name="moment" list="song-moments" defaultValue={song?.moment ?? ""} placeholder="e.g. First dance" />
        </Field>
      </div>
      <datalist id="song-moments">
        {moments.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <Checkbox name="doNotPlay" defaultChecked={song?.doNotPlay} label="Do not play" hint="Tell the DJ or band to avoid this one." />
      <FormMessage state={state} />
      <SubmitButton variant={song ? "secondary" : "primary"} size={song ? "sm" : "md"}>
        {song ? "Save" : "Add song"}
      </SubmitButton>
    </form>
  );
}

export type SongPart = { id: string; instrument: string; sheetUrl: string | null; sheetName: string | null };

const FILE_INPUT =
  "block w-full text-sm text-ink-muted file:mr-3 file:h-9 file:cursor-pointer file:rounded-lg file:border file:border-control file:bg-surface file:px-3 file:text-sm file:font-medium file:text-ink hover:file:bg-sunken";

/** Adds an instrument to a song (songId), or edits one (part), with an optional sheet music PDF. */
export function PartForm({ songId, part }: { songId?: string; part?: SongPart }) {
  const [state, action] = useActionState(savePartAction, null);
  const ref = useResetOnAdd(state, !!part);
  // Too-large files are caught here: the server would refuse the whole upload without a message.
  const [tooLarge, setTooLarge] = useState(false);
  const e = state?.errors ?? {};
  const k = part?.id ?? `new-${songId}`;
  const limitMb = MAX_SHEET_BYTES / 1024 / 1024;
  return (
    <form ref={ref} action={action} className="space-y-3">
      {part ? <input type="hidden" name="id" value={part.id} /> : <input type="hidden" name="songId" value={songId} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Instrument" htmlFor={`pi-${k}`} error={e.instrument}>
          <Input
            id={`pi-${k}`}
            name="instrument"
            list="song-instruments"
            defaultValue={part?.instrument ?? ""}
            placeholder="e.g. Violin"
            invalid={!!e.instrument}
          />
        </Field>
        <Field
          label={part?.sheetUrl ? "Replace sheet music" : "Sheet music"}
          htmlFor={`ps-${k}`}
          optional
          hint={`PDF, up to ${limitMb} MB.`}
          error={tooLarge ? `That PDF is too large (${limitMb} MB max).` : e.sheet}
        >
          <input
            id={`ps-${k}`}
            name="sheet"
            type="file"
            accept="application/pdf,.pdf"
            className={FILE_INPUT}
            onChange={(ev) => {
              const file = ev.target.files?.[0];
              const big = !!file && file.size > MAX_SHEET_BYTES;
              setTooLarge(big);
              if (big) ev.target.value = "";
            }}
          />
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" size="sm">
        {part ? "Save" : "Add instrument"}
      </SubmitButton>
    </form>
  );
}

export function PrintButton() {
  return (
    <Button size="sm" variant="secondary" onClick={() => window.print()}>
      Print
    </Button>
  );
}
