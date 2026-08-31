import type { LoadingRecord, UploadedFileRecord } from "./types";

type LoadingIdentity = Pick<
  LoadingRecord,
  "idCaricamento" | "podPdrNorm" | "signedAt" | "offer"
>;

export function createLoadingImportKey(row: LoadingIdentity) {
  if (row.idCaricamento) {
    return `id:${row.idCaricamento}|pod:${row.podPdrNorm}`;
  }

  return [row.podPdrNorm, row.signedAt ?? "", row.offer ?? ""].filter(Boolean).join("|");
}

export function compareLoadingRecordsLatestFirst(a: LoadingRecord, b: LoadingRecord) {
  const aDate = a.signedAt || a.loadedAt || a.importedAt;
  const bDate = b.signedAt || b.loadedAt || b.importedAt;

  return (
    bDate.localeCompare(aDate) ||
    b.importedAt.localeCompare(a.importedAt) ||
    b.rowNumber - a.rowNumber
  );
}

export function compareUploadedFilesLatestFirst(a: UploadedFileRecord, b: UploadedFileRecord) {
  return b.uploadedAt.localeCompare(a.uploadedAt);
}

export function deduplicateLoadingRecords(
  records: LoadingRecord[],
  uploadedFiles: UploadedFileRecord[]
) {
  const uploadDateById = new Map(uploadedFiles.map((file) => [file.id, file.uploadedAt]));
  const recordsByIdentity = new Map<string, LoadingRecord>();

  for (const record of records) {
    const identity = createLoadingImportKey(record);
    const existing = recordsByIdentity.get(identity);

    if (!existing) {
      recordsByIdentity.set(identity, record);
      continue;
    }

    const existingFreshness = `${uploadDateById.get(existing.uploadedFileId) ?? ""}|${existing.importedAt}|${existing.id}`;
    const recordFreshness = `${uploadDateById.get(record.uploadedFileId) ?? ""}|${record.importedAt}|${record.id}`;

    if (recordFreshness > existingFreshness) {
      recordsByIdentity.set(identity, record);
    }
  }

  return [...recordsByIdentity.values()];
}
