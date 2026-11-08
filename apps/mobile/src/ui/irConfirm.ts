import { confirmAction } from "./confirm";
import type { TFunction } from "../i18n";

/** Confirm the selected ROM overwrite, regardless of cabinet. */
export async function confirmIrCabinetWrite(
  t: TFunction,
  cabinet: number,
  fileName?: string,
): Promise<boolean> {
  const first = await confirmAction({
    title: t("studio.overwriteCabTitle", { cab: cabinet }),
    message: `${t("studio.overwriteCabBody")}${
      fileName ? `\n${t("studio.overwriteCabDetail", { file: fileName, rom: cabinet - 1 })}` : ""
    }`,
    confirmLabel: t("common.follow"),
    cancelLabel: t("common.cancel"),
    destructive: true,
  });
  if (!first) return false;
  return confirmAction({
    title: t("studio.irLastTitle"),
    message: t("studio.irLastBody", { cab: cabinet }),
    confirmLabel: t("studio.irWrite"),
    cancelLabel: t("common.cancel"),
    destructive: true,
  });
}

export async function confirmSongIrWrite(t: TFunction, cabinet: number): Promise<boolean> {
  const first = await confirmAction({
    title: t("studio.songIrTitle", { cab: cabinet }),
    message: t("studio.songIrBody"),
    confirmLabel: t("common.follow"),
    cancelLabel: t("common.cancel"),
    destructive: true,
  });
  if (!first) return false;
  return confirmAction({
    title: t("studio.irLastTitle"),
    message: t("studio.songIrLastBody", { cab: cabinet }),
    confirmLabel: t("studio.irWrite"),
    cancelLabel: t("common.cancel"),
    destructive: true,
  });
}
