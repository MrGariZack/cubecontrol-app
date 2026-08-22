import type { TFunction } from "../i18n";
import type { MobileLibrary, SongLibraryItem } from "./types";
import { readUriBytes } from "../device/files";
import { confirmSongIrWrite } from "../ui/irConfirm";

type Loader = {
  applySong: (songId: string) => Promise<void>;
  loadIrWav: (
    wav: Uint8Array,
    cabinet: number,
    options: { confirmFactoryIrOverwrite: boolean; distance: number; fileName?: string },
  ) => Promise<boolean>;
};

export async function applySongMaybeIr(
  t: TFunction,
  song: SongLibraryItem | undefined,
  library: MobileLibrary,
  loader: Loader,
): Promise<void> {
  if (!song) return;
  await loader.applySong(song.id);
  if (!song.irId) return;
  const ir = library.irs.find((item) => item.id === song.irId);
  if (!ir) return;
  const cabinet = song.irCabinet && song.irCabinet >= 1 && song.irCabinet <= 8 ? song.irCabinet : 8;
  const ok = await confirmSongIrWrite(t, cabinet);
  if (!ok) return;
  const wav = await readUriBytes(ir.uri);
  await loader.loadIrWav(wav, cabinet, {
    confirmFactoryIrOverwrite: cabinet !== 8,
    distance: song.irDistance ?? 0.5,
    fileName: ir.name,
  });
}
