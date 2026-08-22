import { useEffect, useRef } from "react";
import { nativeMidiHost } from "@tonehub/midi-host-android";
import * as Linking from "expo-linking";
import { Alert } from "react-native";
import { useI18n } from "../i18n";
import { isShareCandidate, loadIncomingCubeFile } from "../library/openIncoming";
import { useApp } from "../store/AppStore";
import { confirmAction } from "../ui/confirm";

export function ShareInbox() {
  const { t } = useI18n();
  const app = useApp();
  const seen = useRef(new Set<string>());
  const importShare = app.importShare;
  const importPack = app.importPack;
  const libraryReady = app.libraryReady;

  useEffect(() => {
    if (!libraryReady) return;

    async function handle(url: string | null) {
      if (!url || seen.current.has(url) || !isShareCandidate(url)) return;
      try {
        const incoming = await loadIncomingCubeFile(url);
        seen.current.add(url);
        if (incoming.kind === "pack") {
          const ok = await confirmAction({
            title: t("share.askTitle"),
            message: t("share.askPack", {
              name: incoming.pack.name,
              presets: incoming.pack.presets.length,
              irs: incoming.pack.irs.length,
            }),
            confirmLabel: t("share.load"),
            cancelLabel: t("common.cancel"),
          });
          if (!ok) return;
          await importPack(incoming.pack);
          return;
        }
        const ok = await confirmAction({
          title: t("share.askTitle"),
          message: t("share.askBody", {
            name: incoming.payload.name,
            presets: incoming.payload.presets.length,
            songs: incoming.payload.songs.length,
            shows: incoming.payload.shows.length,
          }),
          confirmLabel: t("share.load"),
          cancelLabel: t("common.cancel"),
        });
        if (!ok) return;
        await importShare(incoming.payload);
      } catch (err) {
        Alert.alert("CubeControl", err instanceof Error ? err.message : String(err));
      }
    }

    const host = nativeMidiHost as
      | {
          getIncomingShareUri?: () => Promise<string | null>;
          addListener?: (
            event: "onIncomingShare",
            listener: (event: { uri: string }) => void,
          ) => { remove: () => void };
        }
      | null;

    void host?.getIncomingShareUri?.().then((url) => void handle(url));
    void Linking.getInitialURL().then((url) => void handle(url));

    const linking = Linking.addEventListener("url", (event) => {
      void handle(event.url);
    });
    const native = host?.addListener?.("onIncomingShare", (event) => {
      void handle(event.uri);
    });

    return () => {
      linking.remove();
      native?.remove();
    };
  }, [importPack, importShare, libraryReady, t]);

  return null;
}
