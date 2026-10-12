"use client";

import type { EnergyQuoteInput, LightConsumptionMode, QuoteOfferResult } from "@/lib/quote-calculator";

export type FixedExcelNumberField = "excelCurrentMonoPrice" | "excelCurrentF1Price" | "excelCurrentF2Price" | "excelCurrentF3Price" | "excelConsumptionF1" | "excelConsumptionF2" | "excelConsumptionF3" | "excelMonoConsumption" | "currentAveragePrice" | "currentPcv" | "gasAnnualConsumption";

export function FixedExcelInputs({ input, offers, selectedOffer, monthOptions, numberValue, onNumber, onChange }: {
  input: EnergyQuoteInput;
  offers: QuoteOfferResult[];
  selectedOffer?: QuoteOfferResult;
  monthOptions: string[];
  numberValue: (field: FixedExcelNumberField) => string;
  onNumber: (field: FixedExcelNumberField, value: string) => void;
  onChange: <K extends keyof EnergyQuoteInput>(key: K, value: EnergyQuoteInput[K]) => void;
}) {
  const numericField = (field: FixedExcelNumberField, label: string) => <label key={field}>{label}<input inputMode="decimal" value={numberValue(field)} onChange={(event) => onNumber(field, event.target.value)} /></label>;
  return <div className="quote-band fixed-excel-inputs">
    <div className="quote-band-title">Bolletta attuale · Fisso</div>
    <div className="quote-line-grid four">
      {numericField("currentAveragePrice", `Prezzo medio quota consumi (${input.commodity === "luce" ? "€/kWh" : "€/Smc"}) · E4`)}
      {numericField("currentPcv", "PCV attuale (€/mese) · F4")}
      <label>Offerta del foglio Excel<select value={selectedOffer?.code ?? ""} onChange={(event) => onChange("selectedOfferCode", event.target.value)}>{offers.map((offer) => <option key={offer.code} value={offer.code}>{offer.offerName}</option>)}</select></label>
      {input.commodity === "gas" && numericField("gasAnnualConsumption", "Consumo annuo gas (Smc) · E8")}
    </div>
    {input.commodity === "luce" && <>
      <div className="quote-line-grid four secondary">
        <label>Mese 1 · E6<select value={input.monthKey} onChange={(event) => onChange("monthKey", event.target.value)}>{monthOptions.map((key) => <option key={key} value={key}>{key}</option>)}</select></label>
        <label>Mese 2 opzionale · F6<select value={input.secondMonthKey ?? ""} onChange={(event) => onChange("secondMonthKey", event.target.value)}><option value="">Un solo mese</option>{monthOptions.map((key) => <option key={key} value={key}>{key}</option>)}</select></label>
        <label>Tipo tariffa attuale · E8<select value={input.lightConsumptionMode} onChange={(event) => onChange("lightConsumptionMode", event.target.value as LightConsumptionMode)}><option value="fasce">A fasce</option><option value="totale">Monoraria</option></select></label>
        <label>Perdite del foglio · E21<input value="1,104" readOnly /></label>
      </div>
      {input.lightConsumptionMode === "fasce" ? <div className="quote-line-grid four secondary">
        {numericField("excelCurrentF1Price", "Prezzo attuale F1 (€/kWh) · E14")}
        {numericField("excelConsumptionF1", "Consumi F1 del periodo (kWh) · F14")}
        {numericField("excelCurrentF2Price", "Prezzo attuale F2 (€/kWh) · E15")}
        {numericField("excelConsumptionF2", "Consumi F2 del periodo (kWh) · F15")}
        {numericField("excelCurrentF3Price", "Prezzo attuale F3 (€/kWh) · E16")}
        {numericField("excelConsumptionF3", "Consumi F3 del periodo (kWh) · F16")}
      </div> : <div className="quote-line-grid four secondary">
        {numericField("excelCurrentMonoPrice", "Prezzo attuale monorario (€/kWh) · E11")}
        {numericField("excelMonoConsumption", "Consumi monorari del periodo (kWh) · F11")}
      </div>}
      <p className="muted-text">Inserisci i consumi dell’intero periodo, come nel foglio Excel. Le tariffe e gli indici usati sono quelli del file di riferimento; i nomi dei mesi nel file non distinguono l’anno.</p>
    </>}
    <p className="muted-text">La differenza annua riproduce la colonna {input.commodity === "luce" ? "H" : "G"} dell’Excel. Quote consumi proposte e provvigioni incomplete nel file sono indicate come da verificare.</p>
  </div>;
}
