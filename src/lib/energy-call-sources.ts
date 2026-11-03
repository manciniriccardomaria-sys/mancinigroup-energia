// Source directory shared with the Frontline project.
export type SourceDirectoryEntry = {
  code: string;
  name: string;
};

export const SOURCE_DIRECTORY: readonly SourceDirectoryEntry[] = [
  { code: '73-643', name: 'MOLFETTA UMBERTO' },
  { code: '000', name: 'MOLFETTA UMBERTO' },
  { code: '000', name: "DIRETTA D'AGENZIA" },
  { code: '001', name: 'SCOTTI MAURO' },
  { code: '003', name: 'RUGGIERI ROSA' },
  { code: '005', name: 'BARTOLI MARINA ANGELA' },
  { code: '007', name: 'DE MUSSO ANTONIO' },
  { code: '008', name: 'BELLAPIANTA MARIA VALERIA' },
  { code: '009', name: 'GRILLO CATALDO' },
  { code: '010', name: 'DE VINCENZO CARMELA' },
  { code: '700', name: 'BROKER TEDESCO FRANCESCO INDIV' },
  { code: '011', name: 'MURDACA VINCENZO' },
  { code: '012', name: 'CARUSO ANDREA' },
  { code: '015', name: 'DE IUDICIBUS DAVIDE' },
  { code: '017', name: 'CECCHINI NICOLETTA' },
  { code: '020', name: 'SCOTTI ROBERTA' },
  { code: '021', name: 'GACINA MAURIZIO' },
  { code: '024', name: 'DI GIOIA MICHELE' },
  { code: '028', name: 'SFORZA ANGELA' },
  { code: '030', name: 'DALIANI POLI DAVIDE CARMINE' },
  { code: '032', name: "CALO' GAETANO" },
  { code: '057', name: 'CAPPELLUTI ISABELLA' },
  { code: '074', name: 'SCIANCALEPORE MICHELE' },
  { code: '098', name: 'MANCINI RICCARDO MARIA' },
  { code: '099', name: 'MANCINI PASQUALE MARIA' },
  { code: '701', name: 'EUROPEAN BROKERS SRL' },
  { code: '702', name: 'AON SPA INSURANCE & REINSURANCE BROKERS SPA' },
  { code: '703', name: 'HOWDEN SPA' },
  { code: '704', name: 'SUD BROKER DI ALFONSO RONCHI INDIV' },
  { code: '705', name: 'ANTONIO ARBORE SRL' },
  { code: '706', name: 'MAG SPA' },
  { code: '900', name: 'CODICE UTILITÀ' },
  { code: '901', name: 'TERLIZZI 2' },
  { code: '902', name: 'GIOVINAZZO' },
  { code: '004', name: 'MOLFETTA 1' },
  { code: '002', name: 'DALIANI POLI DAVIDE CARMINE' },
  { code: '004', name: 'DIRETTA' },
  { code: '006', name: 'MANCINI PASQUALE MARIA' },
  { code: '038', name: 'SFORZA ANGELA' },
  { code: '043', name: 'BARTOLI MARINA ANGELA' },
  { code: '045', name: 'RUGGIERI ROSA' },
  { code: '026', name: 'TERLIZZI 1' },
  { code: '016', name: 'DE LEO GIOVANNA' },
  { code: '022', name: 'CAPPELLUTI ISABELLA' },
  { code: '026', name: 'DIRETTA' },
  { code: '082', name: 'SFORZA ANGELA' },
  { code: '031', name: 'MOLFETTA VIA CORMIO' },
  { code: '013', name: "CALO' GAETANO" },
  { code: '031', name: 'MANCINI GROUP SAS DI MANCINI E DALIANI POLI SAS' },
] as const;

export function getSourcesByCode(code: string): readonly SourceDirectoryEntry[] {
  return SOURCE_DIRECTORY.filter(source => source.code === code.trim());
}

export function energyCallSourceLabel(value: string) {
  const raw = value.trim();
  if (!raw) return "—";
  const match = raw.match(/^(\d{1,3}(?:-\d{1,3})?)(?=\D|$)/);
  if (!match) return raw;
  const code = /^\d+$/.test(match[1]) ? match[1].padStart(3, "0") : match[1];
  // Frontline maps the retired 019 source to 008. Keep the original report
  // code visible while resolving the current source owner's name.
  const directoryCode = code === "019" ? "008" : code;
  const names = [...new Set(getSourcesByCode(directoryCode).map(source => source.name))];
  if (!names.length) return `${code} · Nome non disponibile`;
  if (names.length === 1) return `${code} · ${names[0]}`;
  const suppliedName = raw.slice(match[0].length).replace(/^[\s·:–—-]+/, "").toLocaleUpperCase("it");
  const exactName = names.find(name => name.toLocaleUpperCase("it") === suppliedName);
  return exactName ? `${code} · ${exactName}` : `${code} · ${names.join(" / ")} (nome da verificare)`;
}
