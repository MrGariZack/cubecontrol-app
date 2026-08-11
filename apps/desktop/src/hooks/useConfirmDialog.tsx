import { useCallback, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog, type ConfirmRequest } from "../components/ConfirmDialog";

/**
 * Promise-based confirm for async handlers (replaces `window.confirm`).
 */
export function useConfirmDialog(): {
  confirm: (request: ConfirmRequest) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    resolve?.(value);
  }, []);

  const confirm = useCallback((next: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setRequest(next);
    });
  }, []);

  const dialog =
    request === null ? null : (
      <ConfirmDialog
        request={request}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    );

  return { confirm, dialog };
}
