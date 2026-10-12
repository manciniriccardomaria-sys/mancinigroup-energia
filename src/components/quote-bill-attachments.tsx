"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { downloadQuoteBill } from "@/lib/quote-bill-files";
import type { PendingEnergyQuote } from "@/lib/types";

export function QuoteBillAttachments({ quote }: { quote: PendingEnergyQuote }) {
  const [downloading, setDownloading] = useState<string>();
  const [error, setError] = useState("");
  if (!quote.attachments?.length) return <span className="muted-text">Nessuna bolletta</span>;
  return <div className="quote-bill-list">
    {quote.attachments.map((file) => <button className="secondary-button" key={file.id} type="button" disabled={Boolean(downloading)} onClick={async () => {
      setDownloading(file.id); setError("");
      try { await downloadQuoteBill(file, `${quote.firstName} ${quote.lastName}`); }
      catch (problem) { setError(problem instanceof Error ? problem.message : "Download non riuscito."); }
      finally { setDownloading(undefined); }
    }}><Download size={14} aria-hidden="true" />{downloading === file.id ? "Download…" : file.originalName}</button>)}
    {error && <p role="alert">{error}</p>}
  </div>;
}
