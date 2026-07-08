export type SourceKind = "collaboratore" | "frontline" | "sede";

export type UserRole = "admin" | "frontline" | "agent" | "operativo";

export type CustomerStatus = "attivo" | "in_lavorazione" | "cessato";

export type Commodity = "luce" | "gas" | "non_definito";

export type UploadCategory = "caricamenti" | "margini_agenzia" | "altro";

export type CommissionCalculationType = "fixed_amount" | "margin_percentage";

export type Source = {
  id: string;
  name: string;
  kind: SourceKind;
  active: boolean;
  createdAt: string;
};

export type Customer = {
  id: string;
  podPdr: string;
  podPdrNorm: string;
  name: string;
  sourceId: string;
  commodity: Commodity;
  status: CustomerStatus;
  offer?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
};

export type CommissionEntry = {
  id: string;
  sourceId: string;
  role: "FL" | "COLL" | "SEDE";
  ruleId?: string;
  pod?: string;
  customerName?: string;
  customerSurname?: string;
  type?: "RES" | "BUS";
  competenceMonth?: string;
  dueMonth: string;
  amount: number;
  importedFrom?: string;
  createdAt: string;
};

export type CommissionRule = {
  id: string;
  name: string;
  sourceKind: SourceKind | "tutte";
  customerType: "RES" | "BUS" | "tutti";
  offerName: string;
  calculationType: CommissionCalculationType;
  amount: number;
  percentage?: number;
  maxAmount?: number;
  notes?: string;
  effectiveFrom: string;
  createdAt: string;
  createdBy: string;
};

export type CommissionPayment = {
  id: string;
  sourceId: string;
  amount: number;
  paidAt: string;
  period?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
};

export type MarketVariable = {
  id: string;
  key: string;
  label: string;
  commodity: Exclude<Commodity, "non_definito">;
  monthKey: string;
  value: number;
  unit: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type EnergyQuote = {
  id: string;
  quoteDate: string;
  sourceId?: string;
  sourceName?: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone?: string;
  commodity: Exclude<Commodity, "non_definito">;
  customerType: "RES" | "BUS";
  selectedOfferCode: string;
  selectedOfferName: string;
  currentAveragePrice: number;
  currentSpread: number;
  currentPcv: number;
  currentSpend: number;
  totalConsumption: number;
  annualConsumption: number;
  quotaConsumi: number;
  annualDifference: number;
  annualSaving: number;
  agencyCommission: number;
  inputSnapshot: Record<string, string | number | undefined>;
  createdAt: string;
  createdBy: string;
};

export type UploadedFileRecord = {
  id: string;
  originalName: string;
  storedName: string;
  storageMode?: "local" | "metadata_only";
  category: UploadCategory;
  referenceMonth?: string;
  commodity?: Commodity;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
};

export type LoadingRecord = {
  id: string;
  importKey: string;
  uploadedFileId: string;
  rowNumber: number;
  idCaricamento?: string;
  status?: string;
  agentInCharge?: string;
  agent?: string;
  agency?: string;
  representative?: string;
  customerName: string;
  customerType?: string;
  taxCode?: string;
  vat?: string;
  loadedAt?: string;
  signedAt?: string;
  offer?: string;
  paymentType?: string;
  supplyType?: string;
  commodity: Commodity;
  podPdr: string;
  podPdrNorm: string;
  loadedStatus?: string;
  precheckStatus?: string;
  precheckDetail?: string;
  validationDate?: string;
  startDate?: string;
  endDate?: string;
  practice?: string;
  notes?: string;
  matchedCustomerId?: string;
  matchedSourceId?: string;
  matchedAt?: string;
  importedAt: string;
};

export type LoadingImportRow = Omit<
  LoadingRecord,
  "id" | "uploadedFileId" | "matchedCustomerId" | "matchedSourceId" | "matchedAt" | "importedAt"
>;

export type LoadingImportResult = {
  totalRows: number;
  importedRows: number;
  updatedRows: number;
  skippedRows: number;
  matchedRows: number;
  unmatchedRows: number;
};

export type AgencyMarginRecord = {
  id: string;
  importKey: string;
  uploadedFileId: string;
  rowNumber: number;
  monthKey: string;
  invoiceNumber: string;
  podPdr: string;
  podPdrNorm: string;
  customerName: string;
  representative?: string;
  paymentType?: string;
  vat?: string;
  taxCode?: string;
  issuedAt?: string;
  dueAt?: string;
  invoiceTotal: number;
  paid: number;
  balance: number;
  consumption: number;
  agent?: string;
  offer?: string;
  offerEasy?: string;
  customerType: "RES" | "BUS" | "non_definito";
  commodity: Commodity;
  cmor: number;
  recurringPoint: number;
  recurringConsumption: number;
  grossMarginAmount: number;
  agencyShareRate: number;
  marginAmount: number;
  tariffNote?: string;
  commissionAmount?: number;
  commissionEntryId?: string;
  commissionKind?: "home_once" | "business_coll_monthly" | "business_fl_once";
  commissionStatus:
    | "generata"
    | "anticipata"
    | "in_maturazione"
    | "da_abbinare"
    | "tariffa_mancante"
    | "regola_mancante";
  matchedCustomerId?: string;
  matchedSourceId?: string;
  matchedAt?: string;
  importedAt: string;
};

export type AgencyMarginImportRow = Omit<
  AgencyMarginRecord,
  | "id"
  | "uploadedFileId"
  | "matchedCustomerId"
  | "matchedSourceId"
  | "matchedAt"
  | "commissionEntryId"
  | "commissionAmount"
  | "commissionKind"
  | "commissionStatus"
  | "importedAt"
>;

export type AgencyMarginImportResult = {
  totalRows: number;
  importedRows: number;
  updatedRows: number;
  skippedRows: number;
  matchedRows: number;
  unmatchedRows: number;
  generatedCommissionRows: number;
  anticipatedRows: number;
  maturingRows: number;
  missingTariffRows: number;
  missingRuleRows: number;
  totalMargin: number;
  totalGeneratedCommissions: number;
};

export type ProductionMetric = {
  monthKey: string;
  luce: number;
  gas: number;
  total: number;
  inValidation: number;
  blocked: number;
  exited: number;
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  sourceId?: string;
  passwordHash: string;
  createdAt: string;
};

export type StoreData = {
  sources: Source[];
  customers: Customer[];
  commissionEntries: CommissionEntry[];
  commissionPayments: CommissionPayment[];
  commissionRules: CommissionRule[];
  productionMetrics: ProductionMetric[];
  uploadedFiles: UploadedFileRecord[];
  loadingRecords: LoadingRecord[];
  agencyMarginRecords: AgencyMarginRecord[];
  marketVariables: MarketVariable[];
  energyQuotes: EnergyQuote[];
  users: User[];
};

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "sourceId">;
