import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ReportProblemDialog } from "../components/ReportProblemDialog";

type ReportProblemContextValue = {
  readonly openReportProblem: () => void;
};

const ReportProblemContext = createContext<ReportProblemContextValue | null>(null);

export function ReportProblemProvider({ children }: { readonly children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openReportProblem = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openReportProblem }), [openReportProblem]);

  return (
    <ReportProblemContext.Provider value={value}>
      {children}
      {open ? <ReportProblemDialog onClose={() => setOpen(false)} /> : null}
    </ReportProblemContext.Provider>
  );
}

export function useReportProblem(): ReportProblemContextValue {
  const ctx = useContext(ReportProblemContext);
  if (ctx === null) {
    throw new Error("useReportProblem must be used within ReportProblemProvider");
  }
  return ctx;
}
