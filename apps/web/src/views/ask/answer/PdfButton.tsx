import { FileDown, Loader2 } from "lucide-react";
import { useState, type RefObject } from "react";
import { downloadReportPdf } from "./pdf";

interface Props {
  target: RefObject<HTMLElement | null>;
  title: string;
  workspace: string;
}

export function PdfButton({ target, title, workspace }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async () => {
    if (!target.current || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await downloadReportPdf(target.current, title, workspace);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className="btn btn-ghost ask-copy" onClick={run} disabled={busy} data-pdf-hide>
      {busy ? <Loader2 size={13} style={{ animation: "ask-spin 0.8s linear infinite" }} /> : <FileDown size={13} />}
      <span>{busy ? "Preparing PDF…" : failed ? "Try PDF again" : "Download PDF"}</span>
    </button>
  );
}
