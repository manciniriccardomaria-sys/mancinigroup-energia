"use client";

import { Printer } from "lucide-react";

export function PrintButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <button className="print-button" type="button" onClick={() => window.print()} disabled={disabled}>
      <Printer size={18} aria-hidden="true" />
      Stampa preventivo
    </button>
  );
}
