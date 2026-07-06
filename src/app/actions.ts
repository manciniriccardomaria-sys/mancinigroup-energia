"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSessionCookie, requireUser, setSessionCookie } from "@/lib/auth";
import { parseAgencyMarginCsv } from "@/lib/import-agency-margins";
import { parseCaricamentiWorkbook } from "@/lib/import-caricamenti";
import { isMarketVariableKey, marketVariableDefinitions } from "@/lib/market-variables";
import { parseEuro } from "@/lib/normalize";
import { verifyPassword } from "@/lib/passwords";
import { calculateEnergyQuote, defaultEnergyQuoteInput } from "@/lib/quote-calculator";
import {
  addEnergyQuote,
  addCommissionRule,
  addCommissionPayment,
  addCustomer,
  addSource,
  addUploadedFile,
  addUser,
  findUserByEmail,
  importAgencyMarginRecords,
  importLoadingRecords,
  readStore,
  reassignCustomer,
  setCustomerStatus,
  setSourceActive,
  upsertMarketVariable
} from "@/lib/store";
import type {
  CommissionRule,
  Commodity,
  CustomerStatus,
  SourceKind,
  UploadCategory,
  UserRole
} from "@/lib/types";

function asString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function messageRedirect(pathname: string, type: "success" | "error", message: string): never {
  redirect(`${pathname}?type=${type}&message=${encodeURIComponent(message)}`);
}

function isSourceKind(value: string): value is SourceKind {
  return value === "collaboratore" || value === "frontline" || value === "sede";
}

function isCustomerStatus(value: string): value is CustomerStatus {
  return value === "attivo" || value === "in_lavorazione" || value === "cessato";
}

function isUploadCategory(value: string): value is UploadCategory {
  return value === "caricamenti" || value === "margini_agenzia" || value === "altro";
}

function isUserRole(value: string): value is UserRole {
  return value === "admin" || value === "frontline" || value === "agent";
}

function isMonthKey(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function parseMarketValue(value: string) {
  let normalized = value.trim().replace(/[€\s]/g, "");

  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number.parseFloat(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parsePlainNumber(value: string) {
  let normalized = value.trim().replace(/[€\s]/g, "");

  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number.parseFloat(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMarginCommodity(value: string): value is Exclude<Commodity, "non_definito"> {
  return value === "luce" || value === "gas";
}

function uploadStorageMode(): "local" | "metadata_only" {
  if (process.env.UPLOAD_STORAGE === "local" || process.env.UPLOAD_STORAGE === "metadata_only") {
    return process.env.UPLOAD_STORAGE;
  }

  return process.env.DATA_BACKEND === "firebase" ? "metadata_only" : "local";
}

function marketDefinitionsForCommodity(commodity: Exclude<Commodity, "non_definito">) {
  return marketVariableDefinitions.filter((definition) => definition.commodity === commodity);
}

function isRuleSourceKind(value: string): value is CommissionRule["sourceKind"] {
  return value === "tutte" || value === "collaboratore" || value === "frontline" || value === "sede";
}

function isRuleCustomerType(value: string): value is CommissionRule["customerType"] {
  return value === "tutti" || value === "RES" || value === "BUS";
}

function isRuleCalculationType(value: string): value is CommissionRule["calculationType"] {
  return value === "fixed_amount" || value === "margin_percentage";
}

function quoteInputFromForm(formData: FormData) {
  const commodity = asString(formData, "commodity") === "gas" ? "gas" : "luce";
  const customerType = asString(formData, "customerType") === "BUS" ? "BUS" : "RES";
  const lightConsumptionMode = asString(formData, "lightConsumptionMode") === "fasce" ? "fasce" : "totale";
  const lightLossMode = asString(formData, "lightLossMode") === "media_alta" ? "media_alta" : "bassa";

  return defaultEnergyQuoteInput({
    quoteDate: asString(formData, "quoteDate"),
    sourceId: asString(formData, "sourceId") || undefined,
    firstName: asString(formData, "firstName"),
    lastName: asString(formData, "lastName"),
    phone: asString(formData, "phone"),
    commodity,
    customerType,
    selectedOfferCode: asString(formData, "selectedOfferCode"),
    monthKey: asString(formData, "monthKey"),
    secondMonthKey: asString(formData, "secondMonthKey"),
    currentAveragePrice: parsePlainNumber(asString(formData, "currentAveragePrice")),
    currentSpend: parsePlainNumber(asString(formData, "currentSpend")),
    currentPcv: parsePlainNumber(asString(formData, "currentPcv")),
    lightConsumptionMode,
    lightLossMode,
    consumptionMonth1: parsePlainNumber(asString(formData, "consumptionMonth1")),
    consumptionMonth2: parsePlainNumber(asString(formData, "consumptionMonth2")),
    f1Month1: parsePlainNumber(asString(formData, "f1Month1")),
    f2Month1: parsePlainNumber(asString(formData, "f2Month1")),
    f3Month1: parsePlainNumber(asString(formData, "f3Month1")),
    f1Month2: parsePlainNumber(asString(formData, "f1Month2")),
    f2Month2: parsePlainNumber(asString(formData, "f2Month2")),
    f3Month2: parsePlainNumber(asString(formData, "f3Month2")),
    gasAnnualConsumption: parsePlainNumber(asString(formData, "gasAnnualConsumption"))
  });
}

function quoteSearchParams(formData: FormData, type: "success" | "error", message: string) {
  const keys = [
    "quoteDate",
    "sourceId",
    "firstName",
    "lastName",
    "phone",
    "commodity",
    "customerType",
    "selectedOfferCode",
    "monthKey",
    "secondMonthKey",
    "currentAveragePrice",
    "currentSpend",
    "currentPcv",
    "lightConsumptionMode",
    "lightLossMode",
    "consumptionMonth1",
    "consumptionMonth2",
    "f1Month1",
    "f2Month1",
    "f3Month1",
    "f1Month2",
    "f2Month2",
    "f3Month2",
    "gasAnnualConsumption"
  ];
  const params = new URLSearchParams();

  for (const key of keys) {
    const value = asString(formData, key);

    if (value) {
      params.set(key, value);
    }
  }

  params.set("type", type);
  params.set("message", message);
  return params;
}

export async function loginAction(formData: FormData) {
  const email = asString(formData, "email").toLowerCase();
  const password = asString(formData, "password");
  const user = await findUserByEmail(email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=Credenziali%20non%20valide.");
  }

  await setSessionCookie(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function createSourceAction(formData: FormData) {
  await requireUser(["admin"]);

  const name = asString(formData, "name");
  const kind = asString(formData, "kind");

  if (!name) {
    messageRedirect("/sources", "error", "Inserisci il nome della fonte.");
  }

  if (!isSourceKind(kind)) {
    messageRedirect("/sources", "error", "Seleziona un tipo fonte valido.");
  }

  const sourceKind = kind;

  try {
    await addSource({ name, kind: sourceKind });
  } catch (error) {
    messageRedirect("/sources", "error", error instanceof Error ? error.message : "Fonte non salvata.");
  }

  revalidatePath("/sources");
  revalidatePath("/dashboard");
  messageRedirect("/sources", "success", "Fonte aggiunta.");
}

export async function createUserAction(formData: FormData) {
  await requireUser(["admin"]);

  const email = asString(formData, "email").toLowerCase();
  const name = asString(formData, "name");
  const role = asString(formData, "role");
  const password = asString(formData, "password");
  const sourceId = asString(formData, "sourceId");

  if (!isUserRole(role)) {
    messageRedirect("/users", "error", "Seleziona un ruolo valido.");
  }

  try {
    await addUser({
      email,
      name,
      role,
      password,
      sourceId: role === "admin" ? undefined : sourceId
    });
  } catch (error) {
    messageRedirect("/users", "error", error instanceof Error ? error.message : "Utente non creato.");
  }

  revalidatePath("/users");
  messageRedirect("/users", "success", "Utente creato e collegato alla fonte.");
}

export async function toggleSourceAction(formData: FormData) {
  await requireUser(["admin"]);

  const sourceId = asString(formData, "sourceId");
  const active = asString(formData, "active") === "true";

  try {
    await setSourceActive(sourceId, active);
  } catch (error) {
    messageRedirect("/sources", "error", error instanceof Error ? error.message : "Fonte non aggiornata.");
  }

  revalidatePath("/sources");
  revalidatePath("/dashboard");
  messageRedirect("/sources", "success", active ? "Fonte riattivata." : "Fonte disattivata.");
}

export async function createCustomerAction(formData: FormData) {
  const user = await requireUser();
  const podPdr = asString(formData, "podPdr");
  const name = asString(formData, "name");
  const offer = asString(formData, "offer");
  const notes = asString(formData, "notes");
  let sourceId = asString(formData, "sourceId");

  if (user.role === "agent" && user.sourceId) {
    sourceId = user.sourceId;
  }

  try {
    await addCustomer({
      podPdr,
      name,
      sourceId,
      offer,
      notes,
      createdBy: user.id
    });
  } catch (error) {
    messageRedirect(
      "/customers/new",
      "error",
      error instanceof Error ? error.message : "Associazione non salvata."
    );
  }

  revalidatePath("/customers");
  revalidatePath("/caricamenti");
  revalidatePath("/dashboard");
  messageRedirect("/customers", "success", "POD/PDR associato alla fonte.");
}

export async function reassignCustomerAction(formData: FormData) {
  await requireUser(["admin", "frontline"]);

  const customerId = asString(formData, "customerId");
  const sourceId = asString(formData, "sourceId");

  try {
    await reassignCustomer(customerId, sourceId);
  } catch (error) {
    messageRedirect("/customers", "error", error instanceof Error ? error.message : "Cliente non aggiornato.");
  }

  revalidatePath("/customers");
  revalidatePath("/caricamenti");
  revalidatePath("/dashboard");
  messageRedirect("/customers", "success", "Fonte associazione aggiornata.");
}

export async function setCustomerStatusAction(formData: FormData) {
  await requireUser(["admin", "frontline"]);

  const customerId = asString(formData, "customerId");
  const status = asString(formData, "status");

  if (!isCustomerStatus(status)) {
    messageRedirect("/customers", "error", "Stato cliente non valido.");
  }

  const customerStatus = status;

  try {
    await setCustomerStatus(customerId, customerStatus);
  } catch (error) {
    messageRedirect("/customers", "error", error instanceof Error ? error.message : "Stato non aggiornato.");
  }

  revalidatePath("/customers");
  revalidatePath("/dashboard");
  messageRedirect("/customers", "success", "Stato cliente aggiornato.");
}

export async function uploadFileAction(formData: FormData) {
  const user = await requireUser();
  const category = asString(formData, "category");
  const referenceMonth = asString(formData, "referenceMonth");
  const marginCommodity = asString(formData, "marginCommodity");
  const fileValues = formData.getAll("file").filter((value): value is File => value instanceof File && value.size > 0);

  if (!isUploadCategory(category)) {
    messageRedirect("/dashboard", "error", "Seleziona una categoria file valida.");
  }

  if (fileValues.length === 0) {
    messageRedirect("/dashboard", "error", "Seleziona un file da caricare.");
  }

  if (category === "margini_agenzia" && !isMonthKey(referenceMonth)) {
    messageRedirect("/dashboard", "error", "Seleziona mese e anno delle provvigioni agenzia.");
  }

  if (category === "margini_agenzia" && !isMarginCommodity(marginCommodity)) {
    messageRedirect("/dashboard", "error", "Seleziona se il pacchetto provvigioni e luce o gas.");
  }

  const messages: string[] = [];
  const storageMode = uploadStorageMode();
  const uploadDir = path.join(process.cwd(), "data", "uploads");

  if (storageMode === "local") {
    await mkdir(uploadDir, { recursive: true });
  }

  for (const fileValue of fileValues) {
    const safeName = fileValue.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedName = `${Date.now()}_${randomUUID()}_${safeName}`;
    const bytes = Buffer.from(await fileValue.arrayBuffer());

    if (storageMode === "local") {
      await writeFile(path.join(uploadDir, storedName), bytes);
    }

    const uploadedFile = await addUploadedFile({
      originalName: fileValue.name,
      storedName,
      storageMode,
      category,
      referenceMonth: category === "margini_agenzia" ? referenceMonth : undefined,
      commodity: category === "margini_agenzia" && isMarginCommodity(marginCommodity) ? marginCommodity : undefined,
      mimeType: fileValue.type || "application/octet-stream",
      size: fileValue.size,
      uploadedBy: user.id
    });

    if (category === "caricamenti") {
      try {
        const parsed = parseCaricamentiWorkbook(bytes);

        if (parsed.rows.length === 0) {
          throw new Error("nessuna riga con POD/PDR trovata.");
        }

        const result = await importLoadingRecords({
          uploadedFileId: uploadedFile.id,
          rows: parsed.rows,
          totalRows: parsed.totalRows,
          skippedRows: parsed.skippedRows
        });
        messages.push(
          `${fileValue.name}: ${result.importedRows} caricamenti nuovi, ${result.updatedRows} aggiornati, ${result.matchedRows} abbinati.`
        );
      } catch (error) {
        messageRedirect(
          "/dashboard",
          "error",
          `File salvato, ma import caricamenti non riuscito per ${fileValue.name}: ${
            error instanceof Error ? error.message : "formato non valido"
          }`
        );
      }
    } else if (category === "margini_agenzia") {
      try {
        const parsed = parseAgencyMarginCsv(bytes, fileValue.name, {
          monthKey: referenceMonth,
          commodity: isMarginCommodity(marginCommodity) ? marginCommodity : undefined
        });

        if (parsed.rows.length === 0) {
          throw new Error("nessuna riga con fornitura trovata.");
        }

        const result = await importAgencyMarginRecords({
          uploadedFileId: uploadedFile.id,
          rows: parsed.rows,
          totalRows: parsed.totalRows,
          skippedRows: parsed.skippedRows
        });
        messages.push(
          `${fileValue.name}: provvigioni agenzia ${result.totalMargin.toLocaleString("it-IT", {
            style: "currency",
            currency: "EUR"
          })}, ${result.generatedCommissionRows} provvigioni generate, ${result.maturingRows} in maturazione, ${result.matchedRows} abbinate.`
        );
      } catch (error) {
        messageRedirect(
          "/dashboard",
          "error",
          `File salvato, ma import provvigioni agenzia non riuscito per ${fileValue.name}: ${
            error instanceof Error ? error.message : "formato non valido"
          }`
        );
      }
    } else {
      messages.push(`${fileValue.name}: file caricato.`);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/caricamenti");
  revalidatePath("/commissions");
  messageRedirect("/dashboard", "success", messages.join(" "));
}

export async function createCommissionPaymentAction(formData: FormData) {
  const user = await requireUser(["admin"]);
  const sourceId = asString(formData, "sourceId");
  const amount = parseEuro(asString(formData, "amount"));
  const paidAt = asString(formData, "paidAt");
  const period = asString(formData, "period");
  const notes = asString(formData, "notes");

  try {
    await addCommissionPayment({
      sourceId,
      amount,
      paidAt,
      period,
      notes,
      createdBy: user.id
    });
  } catch (error) {
    messageRedirect(
      "/commissions",
      "error",
      error instanceof Error ? error.message : "Pagamento non registrato."
    );
  }

  revalidatePath("/commissions");
  revalidatePath("/dashboard");
  messageRedirect("/commissions", "success", "Pagamento registrato.");
}

export async function createCommissionRuleAction(formData: FormData) {
  const user = await requireUser(["admin"]);
  const name = asString(formData, "name");
  const sourceKind = asString(formData, "sourceKind");
  const customerType = asString(formData, "customerType");
  const offerName = asString(formData, "offerName");
  const calculationType = asString(formData, "calculationType");
  const amount = parseEuro(asString(formData, "amount"));
  const percentage = parseEuro(asString(formData, "percentage"));
  const maxAmount = parseEuro(asString(formData, "maxAmount"));
  const effectiveFrom = asString(formData, "effectiveFrom");
  const notes = asString(formData, "notes");

  if (!isRuleSourceKind(sourceKind)) {
    messageRedirect("/commission-rules", "error", "Seleziona il tipo fonte.");
  }

  if (!isRuleCustomerType(customerType)) {
    messageRedirect("/commission-rules", "error", "Seleziona il tipo cliente.");
  }

  if (!isRuleCalculationType(calculationType)) {
    messageRedirect("/commission-rules", "error", "Seleziona il tipo calcolo.");
  }

  try {
    await addCommissionRule({
      name,
      sourceKind,
      customerType,
      offerName,
      calculationType,
      amount,
      percentage,
      maxAmount,
      effectiveFrom,
      notes,
      createdBy: user.id
    });
  } catch (error) {
    messageRedirect(
      "/commission-rules",
      "error",
      error instanceof Error ? error.message : "Regola non salvata."
    );
  }

  revalidatePath("/commission-rules");
  messageRedirect("/commission-rules", "success", "Nuova regola provvigionale salvata.");
}

export async function saveMarketVariableAction(formData: FormData) {
  const user = await requireUser(["admin"]);
  const key = asString(formData, "key");
  const monthKey = asString(formData, "monthKey");
  const value = parseMarketValue(asString(formData, "value"));
  const notes = asString(formData, "notes");

  if (!isMarketVariableKey(key)) {
    messageRedirect("/preventivatore", "error", "Seleziona una voce variabile valida.");
  }

  if (!isMonthKey(monthKey)) {
    messageRedirect("/preventivatore", "error", "Seleziona mese e anno.");
  }

  try {
    await upsertMarketVariable({
      key,
      monthKey,
      value,
      notes,
      updatedBy: user.id
    });
  } catch (error) {
    messageRedirect(
      "/preventivatore",
      "error",
      error instanceof Error ? error.message : "Variabile non aggiornata."
    );
  }

  revalidatePath("/preventivatore");
  messageRedirect("/preventivatore", "success", "Variabile preventivatore aggiornata.");
}

export async function saveMarketVariableGroupAction(formData: FormData) {
  const user = await requireUser(["admin"]);
  const commodity = asString(formData, "commodity");
  const monthKey = asString(formData, "monthKey");
  const notes = asString(formData, "notes");

  if (!isMarginCommodity(commodity)) {
    messageRedirect("/preventivatore", "error", "Seleziona luce o gas.");
  }

  if (!isMonthKey(monthKey)) {
    messageRedirect("/preventivatore", "error", "Seleziona mese e anno.");
  }

  const definitions = marketDefinitionsForCommodity(commodity);

  try {
    for (const definition of definitions) {
      const rawValue = asString(formData, `value_${definition.key}`);
      const value = parseMarketValue(rawValue);

      if (!rawValue || !Number.isFinite(value)) {
        throw new Error(`Inserisci un valore valido per ${definition.label}.`);
      }

      await upsertMarketVariable({
        key: definition.key,
        monthKey,
        value,
        notes,
        updatedBy: user.id
      });
    }
  } catch (error) {
    messageRedirect(
      "/preventivatore",
      "error",
      error instanceof Error ? error.message : "Variabili non aggiornate."
    );
  }

  revalidatePath("/preventivatore");
  messageRedirect(
    "/preventivatore",
    "success",
    commodity === "luce" ? "Valori luce aggiornati." : "Valore gas aggiornato."
  );
}

export async function saveEnergyQuoteAction(formData: FormData) {
  const user = await requireUser();
  const input = quoteInputFromForm(formData);
  const store = await readStore();
  const calculation = calculateEnergyQuote(input, store.marketVariables);
  const selectedOffer = calculation.selectedOffer;
  const source = store.sources.find((item) => item.id === input.sourceId);

  if (!calculation.ready || !selectedOffer) {
    const params = quoteSearchParams(
      formData,
      "error",
      calculation.warnings[0] ?? "Compila i dati principali prima di salvare il preventivo."
    );
    redirect(`/preventivatore?${params.toString()}`);
  }

  await addEnergyQuote({
    quoteDate: input.quoteDate,
    sourceId: source?.id,
    sourceName: source?.name,
    customerFirstName: input.firstName,
    customerLastName: input.lastName,
    customerPhone: input.phone || undefined,
    commodity: input.commodity,
    customerType: input.customerType,
    selectedOfferCode: selectedOffer.code,
    selectedOfferName: selectedOffer.offerName,
    currentAveragePrice: calculation.source.currentAveragePrice,
    currentSpread: calculation.source.currentSpread,
    currentPcv: calculation.source.currentPcv,
    currentSpend: calculation.source.currentSpend,
    totalConsumption: calculation.source.totalConsumption,
    annualConsumption: calculation.source.annualConsumption,
    quotaConsumi: selectedOffer.quotaConsumi,
    annualDifference: selectedOffer.annualDifference,
    annualSaving: selectedOffer.annualSaving,
    agencyCommission: selectedOffer.agencyCommission,
    inputSnapshot: {
      quoteDate: input.quoteDate,
      sourceId: input.sourceId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      commodity: input.commodity,
      customerType: input.customerType,
      selectedOfferCode: input.selectedOfferCode,
      monthKey: input.monthKey,
      secondMonthKey: input.secondMonthKey,
      currentAveragePrice: input.currentAveragePrice,
      currentSpend: input.currentSpend,
      currentPcv: input.currentPcv,
      lightConsumptionMode: input.lightConsumptionMode,
      lightLossMode: input.lightLossMode,
      consumptionMonth1: input.consumptionMonth1,
      consumptionMonth2: input.consumptionMonth2,
      f1Month1: input.f1Month1,
      f2Month1: input.f2Month1,
      f3Month1: input.f3Month1,
      f1Month2: input.f1Month2,
      f2Month2: input.f2Month2,
      f3Month2: input.f3Month2,
      gasAnnualConsumption: input.gasAnnualConsumption
    },
    createdBy: user.id
  });

  revalidatePath("/preventivatore");
  const params = quoteSearchParams(formData, "success", "Preventivo salvato.");
  redirect(`/preventivatore?${params.toString()}`);
}
