"use client";

import {
  BadgeEuro,
  BarChart3,
  Calculator,
  ClipboardList,
  Database,
  FilePlus2,
  Flame,
  FolderUp,
  Home,
  Info,
  LogOut,
  MessageCircle,
  ReceiptText,
  Save,
  SearchCheck,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Upload,
  UserPlus,
  UsersRound,
  Zap
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState
} from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User as FirebaseAuthUser } from "firebase/auth";
import { addCommissionPaymentToStore, addCommissionRuleToStore, addCustomerToStore, addEnergyQuoteToStore, addSourceToStore, addUploadedFileToStore, addUserToStore, cloneStore, createDefaultClientStore, importAgencyMarginRecordsToStore, importLoadingRecordsToStore, normalizeStore, reassignCustomerInStore, setCustomerStatusInStore, setSourceActiveInStore, upsertMarketVariableToStore } from "@/lib/client-store";
import { firebaseAuth, firebaseDb, hasFirebaseClientConfig } from "@/lib/firebase-client";
import { readFirestoreStore, seedFirestoreStore, writeFirestoreStore } from "@/lib/firebase-store-client";
import { parseAgencyMarginCsv } from "@/lib/import-agency-margins";
import { parseCaricamentiWorkbook } from "@/lib/import-caricamenti";
import { marketVariableDefinitions } from "@/lib/market-variables";
import { formatDate, formatDateTime, formatEuro, parseEuro } from "@/lib/normalize";
import { offerCatalog, summarizeOfferCatalog } from "@/lib/offers";
import {
  calculateEnergyQuote,
  defaultEnergyQuoteInput,
  type EnergyQuoteInput,
  type LightConsumptionMode,
  type LightLossMode,
  type QuoteCommodity,
  type QuoteCustomerType
} from "@/lib/quote-calculator";
import type {
  Commodity,
  CommissionRule,
  CustomerStatus,
  SessionUser,
  SourceKind,
  StoreData,
  UploadCategory,
  UserRole
} from "@/lib/types";
import {
  activeSourcesForUser,
  monthlyPerformance,
  summarizeAgencyMargins,
  summarizeCommissionRows,
  visibleAgencyMarginRecords,
  visibleCommissionEntries,
  visibleCommissionPayments,
  visibleCustomers,
  visibleLoadingRecords,
  visibleSourcesForUser
} from "@/lib/view-model";

export type StaticView =
  | "login"
  | "dashboard"
  | "customers-new"
  | "customers"
  | "caricamenti"
  | "offers"
  | "sources"
  | "users"
  | "commissions"
  | "commission-rules"
  | "preventivatore";

type Flash = {
  type: "success" | "error";
  message: string;
};

type MutateStore = (change: (draft: StoreData) => void, successMessage: string) => Promise<void>;

type ViewProps = {
  store: StoreData;
  user: SessionUser;
  mutateStore: MutateStore;
};

const LOCAL_STORE_KEY = "mg_energia_static_store";
const LOCAL_AUTH_KEY = "mg_energia_static_auth";
const ADMIN_EMAIL = "manciniriccardomaria@gmail.com";
const DATA_LOAD_TIMEOUT_MS = 18000;

const navItems: Array<{
  href: string;
  view: StaticView;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}> = [
  { href: "/dashboard/", view: "dashboard", label: "Home", icon: <Home size={18} /> },
  { href: "/customers/new/", view: "customers-new", label: "Pre-associa", icon: <FilePlus2 size={18} /> },
  { href: "/customers/", view: "customers", label: "Associazioni", icon: <UsersRound size={18} /> },
  { href: "/caricamenti/", view: "caricamenti", label: "Caricamenti", icon: <ClipboardList size={18} /> },
  { href: "/offers/", view: "offers", label: "Offerte", icon: <Tags size={18} /> },
  { href: "/sources/", view: "sources", label: "Fonti", icon: <UserPlus size={18} /> },
  { href: "/commissions/", view: "commissions", label: "Provvigioni", icon: <BarChart3 size={18} /> },
  { href: "/commission-rules/", view: "commission-rules", label: "Regole", icon: <SlidersHorizontal size={18} /> },
  { href: "/preventivatore/", view: "preventivatore", label: "Preventivatore", icon: <Calculator size={18} /> },
  { href: "/users/", view: "users", label: "Utenti", icon: <ShieldCheck size={18} />, adminOnly: true }
];

const uploadCategoryLabels: Record<UploadCategory, string> = {
  caricamenti: "Caricamenti",
  margini_agenzia: "Provvigioni agenzia",
  altro: "Altro"
};

const commodityLabels: Record<Commodity, string> = {
  luce: "Luce",
  gas: "Gas",
  non_definito: "Non definito"
};

const sourceKindLabels: Record<SourceKind, string> = {
  collaboratore: "Collaboratore",
  frontline: "Frontline",
  sede: "Sede"
};

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  frontline: "Frontline",
  agent: "Agente"
};

function formData(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}

function textValue(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

function numberValue(data: FormData, key: string) {
  return parseEuro(textValue(data, key));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthKey(value: string) {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatShortMonthKey(value: string) {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC"
  })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(/\s+/g, " ");
}

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(2, digits),
    maximumFractionDigits: digits
  }).format(value);
}

function formatSpread(value: number, digits = 3) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function formatInputNumber(value: number) {
  return value ? String(value).replace(".", ",") : "";
}

function parseQuoteDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-\d{2}$/);

  if (!match) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  return {
    year: Number(match[1]),
    month: Number(match[2])
  };
}

function previousQuoteMonthOptions(quoteDate: string) {
  const { year, month } = parseQuoteDate(quoteDate);
  const start = new Date(Date.UTC(year, month - 2, 1));

  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function customerTypeLabel(value: QuoteCustomerType) {
  return value === "RES" ? "Residenziale" : "Business";
}

function printCommodityTitle(value: QuoteCommodity) {
  return value === "luce" ? "Confronto offerte Luce" : "Confronto offerte Gas";
}

function localAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.NEXT_PUBLIC_USE_LOCAL_AUTH === "true" || !hasFirebaseClientConfig())
  );
}

function sessionFromStore(store: StoreData, email: string): SessionUser | null {
  const user = store.users.find((item) => item.email.toLowerCase() === email.toLowerCase());

  if (user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sourceId: user.sourceId
    };
  }

  if (email.toLowerCase() === ADMIN_EMAIL) {
    return {
      id: "usr_manciniriccardomaria-gmail-com",
      email,
      name: "Riccardo Mancini",
      role: "admin"
    };
  }

  return null;
}

function barHeight(value: number, max: number) {
  if (value <= 0) {
    return "2%";
  }

  return `${Math.max(8, Math.round((value / Math.max(1, max)) * 100))}%`;
}

function printSavingClass(value: number) {
  if (value < 0) {
    return "negative";
  }

  return "";
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), milliseconds);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

export function StaticApp({ initialView }: { initialView: StaticView }) {
  const useLocalAuth = localAuthEnabled();
  const firebaseEnabled = hasFirebaseClientConfig() && !useLocalAuth;
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [localUser, setLocalUser] = useState<SessionUser | null>(null);
  const [authReady, setAuthReady] = useState(useLocalAuth || !firebaseEnabled);
  const [dataReady, setDataReady] = useState(!useLocalAuth && !firebaseEnabled);
  const [store, setStore] = useState<StoreData | null>(null);
  const [persistedStore, setPersistedStore] = useState<StoreData | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!useLocalAuth) {
      return;
    }

    queueMicrotask(() => {
      const storedEmail = window.localStorage.getItem(LOCAL_AUTH_KEY);

      if (!storedEmail) {
        setDataReady(true);
        return;
      }

      const rawStore = window.localStorage.getItem(LOCAL_STORE_KEY);
      const nextStore = rawStore
        ? normalizeStore(JSON.parse(rawStore) as Partial<StoreData>, storedEmail)
        : createDefaultClientStore(storedEmail, "Riccardo Mancini");
      const session = sessionFromStore(nextStore, storedEmail);

      setStore(nextStore);
      setPersistedStore(cloneStore(nextStore));
      setLocalUser(session);
      setDataReady(true);
    });
  }, [useLocalAuth]);

  useEffect(() => {
    if (!firebaseEnabled) {
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(firebaseAuth(), (user) => {
        setFirebaseUser(user);
        setAuthReady(true);
      });

      return unsubscribe;
    } catch (error) {
      queueMicrotask(() => {
        setLoadError(error instanceof Error ? error.message : "Firebase Auth non disponibile.");
        setAuthReady(true);
        setDataReady(true);
      });
      return undefined;
    }
  }, [firebaseEnabled]);

  useEffect(() => {
    if (!firebaseEnabled || !authReady) {
      return;
    }

    if (!firebaseUser?.email) {
      queueMicrotask(() => {
        setStore(null);
        setPersistedStore(null);
        setDataReady(true);
      });
      return;
    }

    let cancelled = false;
    const db = firebaseDb();
    queueMicrotask(() => {
      setLoadError(null);
      setDataReady(false);
    });

    withTimeout(
      readFirestoreStore(db, firebaseUser.email),
      DATA_LOAD_TIMEOUT_MS,
      "La sincronizzazione dati sta impiegando troppo tempo. Controlla la connessione e riprova."
    )
      .then(async ({ isEmpty, store: nextStore }) => {
        if (isEmpty) {
          await withTimeout(
            seedFirestoreStore(db, nextStore),
            DATA_LOAD_TIMEOUT_MS,
            "La prima sincronizzazione Firebase sta impiegando troppo tempo."
          );
        }

        if (!cancelled) {
          setStore(nextStore);
          setPersistedStore(cloneStore(nextStore));
          setDataReady(true);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Errore nel caricamento dati Firebase.";
          setLoadError(message);
          setFlash({
            type: "error",
            message
          });
          setDataReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, firebaseEnabled, firebaseUser, retryKey]);

  const sessionUser = useMemo(() => {
    if (localUser) {
      return localUser;
    }

    if (!store || !firebaseUser?.email) {
      return null;
    }

    return sessionFromStore(store, firebaseUser.email);
  }, [firebaseUser, localUser, store]);

  async function handleLogin(email: string, password: string) {
    setFlash(null);

    if (useLocalAuth) {
      const expectedEmail = process.env.NEXT_PUBLIC_LOCAL_ADMIN_EMAIL ?? ADMIN_EMAIL;

      if (email.toLowerCase() !== expectedEmail.toLowerCase() || !password) {
        setFlash({ type: "error", message: "Credenziali non valide." });
        return;
      }

      const rawStore = window.localStorage.getItem(LOCAL_STORE_KEY);
      const nextStore = rawStore
        ? normalizeStore(JSON.parse(rawStore) as Partial<StoreData>, email)
        : createDefaultClientStore(email, "Riccardo Mancini");
      const session = sessionFromStore(nextStore, email);

      window.localStorage.setItem(LOCAL_AUTH_KEY, email);
      window.localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(nextStore));
      setStore(nextStore);
      setPersistedStore(cloneStore(nextStore));
      setLocalUser(session);
      setDataReady(true);
      return;
    }

    if (!hasFirebaseClientConfig()) {
      setFlash({ type: "error", message: "Config Firebase mancante." });
      return;
    }

    await signInWithEmailAndPassword(firebaseAuth(), email, password);
  }

  async function handleLogout() {
    if (useLocalAuth) {
      window.localStorage.removeItem(LOCAL_AUTH_KEY);
      setLocalUser(null);
      setStore(null);
      setPersistedStore(null);
      return;
    }

    await signOut(firebaseAuth());
  }

  const mutateStore: MutateStore = async (change, successMessage) => {
    if (!store || !persistedStore) {
      return;
    }

    const nextStore = cloneStore(store);

    try {
      setSaving(true);
      change(nextStore);

      if (useLocalAuth) {
        window.localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(nextStore));
      } else {
        await writeFirestoreStore(firebaseDb(), persistedStore, nextStore);
      }

      setStore(nextStore);
      setPersistedStore(cloneStore(nextStore));
      setFlash({ type: "success", message: successMessage });
    } catch (error) {
      setFlash({
        type: "error",
        message: error instanceof Error ? error.message : "Operazione non riuscita."
      });
    } finally {
      setSaving(false);
    }
  };

  if (initialView === "login" && !sessionUser) {
    return <LoginScreen flash={flash} onLogin={handleLogin} useLocalAuth={useLocalAuth} />;
  }

  if (!authReady || !dataReady) {
    return <LoadingScreen />;
  }

  if (loadError && firebaseUser?.email) {
    return (
      <LoadErrorScreen
        error={loadError}
        onLogout={handleLogout}
        onRetry={() => {
          setRetryKey((value) => value + 1);
        }}
      />
    );
  }

  if (!sessionUser || !store) {
    return (
      <LoginScreen
        flash={flash}
        onLogin={handleLogin}
        useLocalAuth={useLocalAuth}
        warning={
          useLocalAuth
            ? undefined
            : firebaseEnabled
            ? "Accesso effettuato, ma l'utente non e configurato nel gestionale."
            : "Config Firebase mancante per la produzione."
        }
      />
    );
  }

  const view = initialView === "login" ? "dashboard" : initialView;

  return (
    <AppChrome user={sessionUser} view={view} flash={flash} saving={saving} onLogout={handleLogout}>
      {view === "dashboard" && <DashboardView store={store} user={sessionUser} mutateStore={mutateStore} />}
      {view === "customers-new" && <NewCustomerView store={store} user={sessionUser} mutateStore={mutateStore} />}
      {view === "customers" && <CustomersView store={store} user={sessionUser} mutateStore={mutateStore} />}
      {view === "caricamenti" && <CaricamentiView store={store} user={sessionUser} />}
      {view === "offers" && <OffersView />}
      {view === "sources" && <SourcesView store={store} user={sessionUser} mutateStore={mutateStore} />}
      {view === "users" && <UsersView store={store} user={sessionUser} mutateStore={mutateStore} />}
      {view === "commissions" && <CommissionsView store={store} user={sessionUser} mutateStore={mutateStore} />}
      {view === "commission-rules" && <RulesView store={store} user={sessionUser} mutateStore={mutateStore} />}
      {view === "preventivatore" && <PreventivatoreView store={store} user={sessionUser} mutateStore={mutateStore} />}
    </AppChrome>
  );
}

function LoginScreen({
  flash,
  onLogin,
  useLocalAuth,
  warning
}: {
  flash: Flash | null;
  onLogin: (email: string, password: string) => Promise<void>;
  useLocalAuth: boolean;
  warning?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    setLoading(true);

    try {
      await onLogin(textValue(data, "email"), textValue(data, "password"));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-block">
          <div className="brand-mark">MS</div>
          <div>
            <p className="eyebrow">Mancini Service</p>
            <h1>Gestionale Energia</h1>
          </div>
        </div>
        {warning && <div className="alert error">{warning}</div>}
        {flash && <div className={`alert ${flash.type}`}>{flash.message}</div>}
        {useLocalAuth && <div className="alert success">Modalita locale attiva per sviluppo.</div>}
        <form className="form-grid" onSubmit={submit}>
          <label>
            Email
            <input name="email" type="email" defaultValue={ADMIN_EMAIL} required />
          </label>
          <label>
            Password
            <input name="password" type="password" required />
          </label>
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? "Accesso..." : "Entra"}
          </button>
        </form>
      </section>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-block">
          <div className="brand-mark">MS</div>
          <div>
            <p className="eyebrow">Mancini Service</p>
            <h1>Caricamento</h1>
          </div>
        </div>
        <p className="muted-text">Sincronizzazione dati in corso.</p>
      </section>
    </main>
  );
}

function LoadErrorScreen({
  error,
  onLogout,
  onRetry
}: {
  error: string;
  onLogout: () => Promise<void>;
  onRetry: () => void;
}) {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-block">
          <div className="brand-mark">MS</div>
          <div>
            <p className="eyebrow">Mancini Service</p>
            <h1>Dati non caricati</h1>
          </div>
        </div>
        <div className="alert error">{error}</div>
        <div className="split-actions">
          <button className="primary-button" type="button" onClick={onRetry}>
            Riprova
          </button>
          <button className="secondary-button" type="button" onClick={() => void onLogout()}>
            Esci
          </button>
        </div>
      </section>
    </main>
  );
}

function AppChrome({
  children,
  flash,
  onLogout,
  saving,
  user,
  view
}: {
  children: ReactNode;
  flash: Flash | null;
  onLogout: () => Promise<void>;
  saving: boolean;
  user: SessionUser;
  view: StaticView;
}) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark small">MS</div>
          <div>
            <p className="eyebrow">Mancini Service</p>
            <h1>Gestionale Energia</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="user-pill">
            <ShieldCheck size={17} />
            <span>{user.name}</span>
            <strong>{roleLabels[user.role]}</strong>
          </div>
          <button className="icon-button" type="button" onClick={() => void onLogout()} title="Esci">
            <LogOut size={19} />
          </button>
        </div>
      </header>
      <nav className="nav-grid">
        {navItems
          .filter((item) => !item.adminOnly || user.role === "admin")
          .map((item) => (
            <a className={`nav-button ${item.view === view ? "active" : ""}`} href={item.href} key={item.view}>
              {item.icon}
              {item.label}
            </a>
          ))}
      </nav>
      {saving && <div className="alert success">Salvataggio in corso...</div>}
      {flash && <div className={`alert ${flash.type}`}>{flash.message}</div>}
      {children}
    </main>
  );
}

function DashboardView({ store, user, mutateStore }: ViewProps) {
  const [trendCommodity, setTrendCommodity] = useState<"entrambi" | "luce" | "gas">("entrambi");
  const [trendMetric, setTrendMetric] = useState<"andamento" | "agenzia">("andamento");
  const [trendPeriod, setTrendPeriod] = useState<3 | 6 | 12>(12);
  const customers = visibleCustomers(user, store);
  const loadingRecords = visibleLoadingRecords(user, store);
  const agencyMarginRecords = visibleAgencyMarginRecords(user, store);
  const agencySummary = summarizeAgencyMargins(agencyMarginRecords);
  const sources = [...visibleSourcesForUser(user, store.sources)].sort((a, b) => a.name.localeCompare(b.name, "it"));
  const commissionRows = summarizeCommissionRows(
    visibleCommissionEntries(user, store),
    visibleCommissionPayments(user, store),
    sources
  );
  const totalCommissions = commissionRows.reduce((sum, row) => sum + row.total, 0);
  const paidCommissions = commissionRows.reduce((sum, row) => sum + row.paid, 0);
  const matchedLoading = loadingRecords.filter((record) => record.matchedSourceId).length;
  const monthlyRows = monthlyPerformance(
    customers,
    visibleCommissionEntries(user, store),
    store.productionMetrics,
    loadingRecords
  );
  const trendRows =
    trendMetric === "agenzia"
      ? trendRowsFromAgency(agencyMarginRecords)
      : monthlyRows.map((row) => ({
          monthKey: row.monthKey,
          label: formatMonthKey(row.monthKey),
          shortLabel: formatShortMonthKey(row.monthKey),
          luce: row.luce,
          gas: row.gas,
          total: row.luce + row.gas,
          inValidation: row.inValidation,
          blocked: row.blocked,
          exited: row.exited,
          commissions: row.commissions
        }));
  const visibleTrendRows = trendRows
    .slice()
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-trendPeriod);
  const maxTrendValue = Math.max(...visibleTrendRows.map((row) => trendValue(row, trendCommodity)), 1);
  const latestUploads = store.uploadedFiles.slice(0, 5);

  async function upload(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    const files = data
      .getAll("files")
      .filter((item): item is File => item instanceof File && item.size > 0);
    const category = textValue(data, "category") as UploadCategory;
    const referenceMonth = textValue(data, "referenceMonth") || undefined;
    const commodity = textValue(data, "commodity") as Exclude<Commodity, "non_definito">;

    if (files.length === 0) {
      throw new Error("Seleziona almeno un file.");
    }

    const parsed = await Promise.all(
      files.map(async (file) => {
        const buffer = await file.arrayBuffer();

        if (category === "caricamenti") {
          return { kind: "loading" as const, file, loading: parseCaricamentiWorkbook(buffer) };
        }

        if (category === "margini_agenzia") {
          if (!referenceMonth || (commodity !== "luce" && commodity !== "gas")) {
            throw new Error("Per le provvigioni agenzia servono mese, anno e tipologia.");
          }

          return {
            kind: "margin" as const,
            file,
            margin: parseAgencyMarginCsv(buffer, file.name, {
              monthKey: referenceMonth,
              commodity
            })
          };
        }

        return { kind: "metadata" as const, file };
      })
    );

    let message = "File caricato.";
    await mutateStore((draft) => {
      const summaries: string[] = [];

      for (const item of parsed) {
        const uploadRecord = addUploadedFileToStore(draft, {
          originalName: item.file.name,
          category,
          mimeType: item.file.type,
          size: item.file.size,
          uploadedBy: user.id,
          referenceMonth,
          commodity: category === "margini_agenzia" ? commodity : undefined
        });

        if (item.kind === "loading") {
          const result = importLoadingRecordsToStore(draft, {
            uploadedFileId: uploadRecord.id,
            rows: item.loading.rows,
            totalRows: item.loading.totalRows,
            skippedRows: item.loading.skippedRows
          });
          summaries.push(`${item.file.name}: ${result.importedRows} nuovi, ${result.updatedRows} aggiornati.`);
        } else if (item.kind === "margin") {
          const result = importAgencyMarginRecordsToStore(draft, {
            uploadedFileId: uploadRecord.id,
            rows: item.margin.rows,
            totalRows: item.margin.totalRows,
            skippedRows: item.margin.skippedRows
          });
          summaries.push(
            `${item.file.name}: ${result.importedRows} nuovi, ${result.generatedCommissionRows} provvigioni generate.`
          );
        } else {
          summaries.push(`${item.file.name}: metadati salvati.`);
        }
      }

      message = summaries.join(" ");
    }, message);
  }

  return (
    <>
      <section className="stats-grid">
        <StatCard icon={<UsersRound size={24} />} label="POD associati" value={customers.length} />
        <StatCard icon={<SearchCheck size={24} />} label="Caricamenti" value={loadingRecords.length} />
        <StatCard icon={<ReceiptText size={24} />} label="Margine agenzia" value={formatEuro(agencySummary.totalMargin)} />
        <StatCard icon={<BarChart3 size={24} />} label="Provvigioni" value={formatEuro(totalCommissions)} />
      </section>

      <section className="workspace-grid">
        <div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Upload</p>
                <h2>Carica file</h2>
              </div>
              <FolderUp size={24} />
            </div>
            <form className="form-grid compact" onSubmit={(event) => void upload(event)}>
              <label>
                Tipo file
                <select name="category" defaultValue="caricamenti">
                  <option value="caricamenti">Caricamenti</option>
                  <option value="margini_agenzia">Provvigioni agenzia</option>
                  <option value="altro">Altro</option>
                </select>
              </label>
              <label>
                Mese provvigioni
                <input name="referenceMonth" type="month" defaultValue={currentMonthKey()} />
              </label>
              <label>
                Tipologia
                <select name="commodity" defaultValue="luce">
                  <option value="luce">Luce</option>
                  <option value="gas">Gas</option>
                </select>
              </label>
              <label>
                File
                <input name="files" type="file" multiple />
              </label>
              <button className="primary-button wide-field" type="submit">
                <Upload size={18} />
                Carica e importa
              </button>
            </form>
            <div className="upload-list">
              {latestUploads.map((file) => (
                <div className="upload-row" key={file.id}>
                  <strong>{file.originalName}</strong>
                  <span>
                    {uploadCategoryLabels[file.category]} - {formatDateTime(file.uploadedAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="table-section performance-section">
            <div className="section-heading performance-heading">
              <div>
                <p className="eyebrow">Andamento</p>
                <h2>Luce e gas mese per mese</h2>
              </div>
              <div className="trend-filter-stack">
                <FilterGroup label="Tipologia">
                  <button className={`filter-chip ${trendCommodity === "entrambi" ? "active" : ""}`} type="button" onClick={() => setTrendCommodity("entrambi")}>
                    Entrambi
                  </button>
                  <button className={`filter-chip ${trendCommodity === "luce" ? "active" : ""}`} type="button" onClick={() => setTrendCommodity("luce")}>
                    Luce
                  </button>
                  <button className={`filter-chip ${trendCommodity === "gas" ? "active" : ""}`} type="button" onClick={() => setTrendCommodity("gas")}>
                    Gas
                  </button>
                </FilterGroup>
                <FilterGroup label="Dato">
                  <button className={`filter-chip ${trendMetric === "andamento" ? "active" : ""}`} type="button" onClick={() => setTrendMetric("andamento")}>
                    Andamento
                  </button>
                  <button className={`filter-chip ${trendMetric === "agenzia" ? "active" : ""}`} type="button" onClick={() => setTrendMetric("agenzia")}>
                    Provvigioni agenzia
                  </button>
                </FilterGroup>
                <FilterGroup label="Periodo">
                  {[3, 6, 12].map((period) => (
                    <button className={`filter-chip ${trendPeriod === period ? "active" : ""}`} key={period} type="button" onClick={() => setTrendPeriod(period as 3 | 6 | 12)}>
                      {period} mesi
                    </button>
                  ))}
                </FilterGroup>
              </div>
            </div>
            <div className="histogram-grid single">
              <article className={`histogram-card ${trendCommodity}`}>
                <div className="histogram-title">
                  <BarChart3 size={20} />
                  <h2>{trendMetric === "agenzia" ? "Provvigioni agenzia" : "Andamento"} - {trendCommodity}</h2>
                </div>
                <div className="histogram-bars">
                  {visibleTrendRows.map((row) => {
                    const value = trendValue(row, trendCommodity);
                    return (
                      <div className="histogram-column" key={row.monthKey}>
                        <div className="bar-track">
                          <div
                            className={`bar-fill ${value <= 0 ? "empty" : ""}`}
                            data-tooltip={trendTooltip(row, trendMetric, value)}
                            style={{ height: barHeight(value, maxTrendValue) }}
                            tabIndex={0}
                          />
                        </div>
                        <span className="bar-label">{row.shortLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </article>
            </div>
            <details className="expandable-table">
              <summary>Espandi tabella</summary>
              <div className="table-wrap">
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th>Mese</th>
                      <th>Luce</th>
                      <th>Gas</th>
                      <th>Totale</th>
                      <th>Provvigioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTrendRows.map((row) => (
                      <tr key={row.monthKey}>
                        <td>{row.label}</td>
                        <td>{trendMetric === "agenzia" ? formatEuro(row.luce) : row.luce}</td>
                        <td>{trendMetric === "agenzia" ? formatEuro(row.gas) : row.gas}</td>
                        <td>{trendMetric === "agenzia" ? formatEuro(row.total) : row.total}</td>
                        <td>{formatEuro(row.commissions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        </div>

        <aside className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Totale</p>
              <h2>Quadro operativo</h2>
            </div>
          </div>
          <div className="summary-list">
            <SummaryRow label="Contratti totali" value={customers.length} />
            <SummaryRow label="Caricamenti importati" value={loadingRecords.length} />
            <SummaryRow label="Abbinati a fonte" value={matchedLoading} />
            <SummaryRow label="Da abbinare" value={Math.max(0, loadingRecords.length - matchedLoading)} />
            <SummaryRow label="Clienti usciti" value={customers.filter((customer) => customer.status === "cessato").length} />
            <SummaryRow label="Margine luce" value={formatEuro(agencySummary.luceMargin)} />
            <SummaryRow label="Margine gas" value={formatEuro(agencySummary.gasMargin)} />
            <SummaryRow label="Provvigioni maturate" value={formatEuro(totalCommissions)} />
            <SummaryRow label="Provvigioni pagate" value={formatEuro(paidCommissions)} />
            <SummaryRow label="Provvigioni da pagare" value={formatEuro(Math.max(0, totalCommissions - paidCommissions))} />
          </div>
        </aside>
      </section>
    </>
  );
}

function trendRowsFromAgency(records: ReturnType<typeof visibleAgencyMarginRecords>) {
  const buckets = new Map<
    string,
    {
      monthKey: string;
      label: string;
      shortLabel: string;
      luce: number;
      gas: number;
      total: number;
      inValidation: number;
      blocked: number;
      exited: number;
      commissions: number;
    }
  >();

  for (const record of records) {
    const row =
      buckets.get(record.monthKey) ??
      {
        monthKey: record.monthKey,
        label: formatMonthKey(record.monthKey),
        shortLabel: formatShortMonthKey(record.monthKey),
        luce: 0,
        gas: 0,
        total: 0,
        inValidation: 0,
        blocked: 0,
        exited: 0,
        commissions: 0
      };

    if (record.commodity === "luce") {
      row.luce += record.marginAmount;
    } else if (record.commodity === "gas") {
      row.gas += record.marginAmount;
    }

    row.total = row.luce + row.gas;
    buckets.set(record.monthKey, row);
  }

  return [...buckets.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey)).slice(0, 12);
}

function trendValue(
  row: { luce: number; gas: number; total: number },
  commodity: "entrambi" | "luce" | "gas"
) {
  if (commodity === "luce") return row.luce;
  if (commodity === "gas") return row.gas;
  return row.total;
}

function trendTooltip(
  row: { label: string; luce: number; gas: number; total: number; inValidation: number; blocked: number; exited: number; commissions: number },
  metric: "andamento" | "agenzia",
  value: number
) {
  if (metric === "agenzia") {
    return `${row.label}\n${formatEuro(value)}\nLuce: ${formatEuro(row.luce)} | Gas: ${formatEuro(row.gas)} | Totale: ${formatEuro(row.total)}`;
  }

  return `${row.label}\n${value}\nLuce: ${row.luce} | Gas: ${row.gas} | Totale: ${row.total}\nIn validazione: ${row.inValidation} | Bloccati: ${row.blocked} | Usciti: ${row.exited}\nProvvigioni: ${formatEuro(row.commissions)}`;
}

function FilterGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="filter-group">
      <span>{label}</span>
      <div className="filter-chips">{children}</div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <article className="stat-card">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function NewCustomerView({ store, user, mutateStore }: ViewProps) {
  const sources = activeSourcesForUser(user, store.sources).sort((a, b) => a.name.localeCompare(b.name, "it"));

  async function submit(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    await mutateStore((draft) => {
      addCustomerToStore(draft, {
        podPdr: textValue(data, "podPdr"),
        name: textValue(data, "name"),
        sourceId: textValue(data, "sourceId"),
        offer: textValue(data, "offer") || undefined,
        notes: textValue(data, "notes") || undefined,
        createdBy: user.id
      });
    }, "Cliente inserito e associato alla fonte.");
  }

  return (
    <section className="panel narrow-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Pre-associazione</p>
          <h2>Nuovo cliente</h2>
        </div>
        <FilePlus2 size={24} />
      </div>
      <form className="form-grid compact" onSubmit={(event) => void submit(event)}>
        <label>
          N. POD/PDR
          <input name="podPdr" required />
        </label>
        <label>
          Nome cliente
          <input name="name" required />
        </label>
        <label>
          Fonte
          <select name="sourceId" required>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Offerta
          <input name="offer" />
        </label>
        <label className="wide-field">
          Note
          <textarea name="notes" />
        </label>
        <button className="primary-button wide-field" type="submit">
          <Save size={18} />
          Salva cliente
        </button>
      </form>
    </section>
  );
}

function CustomersView({ store, user, mutateStore }: ViewProps) {
  const customers = visibleCustomers(user, store);
  const sources = activeSourcesForUser(user, store.sources).sort((a, b) => a.name.localeCompare(b.name, "it"));
  const sourceById = new Map(store.sources.map((source) => [source.id, source]));

  return (
    <section className="table-section no-margin">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Clienti</p>
          <h2>Associazioni POD/PDR</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>POD/PDR</th>
              <th>Tipologia</th>
              <th>Fonte</th>
              <th>Stato</th>
              <th>Creato</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <strong>{customer.name}</strong>
                  {customer.offer && <small>{customer.offer}</small>}
                </td>
                <td>{customer.podPdr}</td>
                <td>
                  <span className={`status-badge ${customer.commodity}`}>{commodityLabels[customer.commodity]}</span>
                </td>
                <td>
                  <select
                    value={customer.sourceId}
                    onChange={(event) =>
                      void mutateStore(
                        (draft) => reassignCustomerInStore(draft, customer.id, event.target.value),
                        "Fonte aggiornata."
                      )
                    }
                  >
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                  <small>{sourceById.get(customer.sourceId)?.kind}</small>
                </td>
                <td>
                  <select
                    value={customer.status}
                    onChange={(event) =>
                      void mutateStore(
                        (draft) => setCustomerStatusInStore(draft, customer.id, event.target.value as CustomerStatus),
                        "Stato cliente aggiornato."
                      )
                    }
                  >
                    <option value="attivo">Attivo</option>
                    <option value="in_lavorazione">In lavorazione</option>
                    <option value="cessato">Cessato</option>
                  </select>
                </td>
                <td>{formatDateTime(customer.createdAt)}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td className="empty-state" colSpan={6}>
                  Nessun cliente presente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SourcesView({ store, user, mutateStore }: ViewProps) {
  if (user.role !== "admin" && user.role !== "frontline") {
    return <LockedPanel />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    await mutateStore((draft) => {
      addSourceToStore(draft, {
        name: textValue(data, "name"),
        kind: textValue(data, "kind") as SourceKind
      });
    }, "Fonte aggiunta.");
  }

  return (
    <>
      <section className="panel narrow-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Fonti</p>
            <h2>Nuova fonte</h2>
          </div>
          <UserPlus size={24} />
        </div>
        <form className="form-grid compact" onSubmit={(event) => void submit(event)}>
          <label>
            Nome
            <input name="name" required />
          </label>
          <label>
            Ruolo
            <select name="kind" defaultValue="collaboratore">
              <option value="collaboratore">Collaboratore</option>
              <option value="frontline">Frontline</option>
              <option value="sede">Sede</option>
            </select>
          </label>
          <button className="primary-button wide-field" type="submit">
            Aggiungi fonte
          </button>
        </form>
      </section>
      <section className="table-section">
        <div className="section-heading">
          <h2>Elenco fonti</h2>
        </div>
        <div className="table-wrap">
          <table className="compact-table">
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Tipo</th>
                <th>Stato</th>
                <th>Azione</th>
              </tr>
            </thead>
            <tbody>
              {[...store.sources].sort((a, b) => a.name.localeCompare(b.name, "it")).map((source) => (
                <tr key={source.id}>
                  <td className="source-name">{source.name}</td>
                  <td>{sourceKindLabels[source.kind]}</td>
                  <td>{source.active ? "Attiva" : "Disattiva"}</td>
                  <td>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        void mutateStore(
                          (draft) => setSourceActiveInStore(draft, source.id, !source.active),
                          source.active ? "Fonte disattivata." : "Fonte riattivata."
                        )
                      }
                    >
                      {source.active ? "Disattiva" : "Riattiva"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function UsersView({ store, user, mutateStore }: ViewProps) {
  if (user.role !== "admin") {
    return <LockedPanel />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    const role = textValue(data, "role") as UserRole;
    await mutateStore((draft) => {
      addUserToStore(draft, {
        email: textValue(data, "email"),
        name: textValue(data, "name"),
        role,
        sourceId: role === "admin" ? undefined : textValue(data, "sourceId")
      });
    }, "Utente gestionale aggiunto.");
  }

  return (
    <>
      <section className="panel narrow-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Accessi</p>
            <h2>Nuovo utente</h2>
          </div>
          <ShieldCheck size={24} />
        </div>
        <form className="form-grid compact" onSubmit={(event) => void submit(event)}>
          <label>
            Nome
            <input name="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Ruolo
            <select name="role" defaultValue="agent">
              <option value="agent">Agente</option>
              <option value="frontline">Frontline</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>
            Fonte
            <select name="sourceId">
              {store.sources.filter((source) => source.active).map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button wide-field" type="submit">
            Salva utente
          </button>
        </form>
      </section>
      <section className="table-section">
        <div className="section-heading">
          <h2>Utenti configurati</h2>
        </div>
        <div className="table-wrap">
          <table className="compact-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Ruolo</th>
                <th>Fonte</th>
              </tr>
            </thead>
            <tbody>
              {store.users.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.email}</td>
                  <td>{roleLabels[item.role]}</td>
                  <td>{store.sources.find((source) => source.id === item.sourceId)?.name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function OffersView() {
  const summary = summarizeOfferCatalog();

  return (
    <>
      <section className="stats-grid three">
        <StatCard icon={<Tags size={24} />} label="Offerte" value={summary.total} />
        <StatCard icon={<Zap size={24} />} label="Luce" value={summary.luce} />
        <StatCard icon={<Flame size={24} />} label="Gas" value={summary.gas} />
      </section>
      <section className="table-section no-margin">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Catalogo</p>
            <h2>Tabella offerte</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Offerta</th>
                <th>Tipologia</th>
                <th>Cliente</th>
                <th>PCV</th>
                <th>Spread</th>
                <th>Codice</th>
              </tr>
            </thead>
            <tbody>
              {offerCatalog.map((offer) => (
                <tr key={offer.code}>
                  <td>{offer.offerEasy}</td>
                  <td>
                    <span className={`status-badge ${offer.commodity}`}>{commodityLabels[offer.commodity]}</span>
                  </td>
                  <td>{offer.customerType}</td>
                  <td>{formatEuro(offer.pcv)}</td>
                  <td>{formatSpread(offer.spread, 3)}</td>
                  <td>
                    <span className="offer-code">{offer.code}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function CaricamentiView({ store, user }: Omit<ViewProps, "mutateStore">) {
  const loadingRecords = visibleLoadingRecords(user, store);
  const agencyRecords = visibleAgencyMarginRecords(user, store);

  return (
    <>
      <section className="stats-grid three">
        <StatCard icon={<ClipboardList size={24} />} label="Caricamenti" value={loadingRecords.length} />
        <StatCard icon={<ReceiptText size={24} />} label="Righe provvigioni agenzia" value={agencyRecords.length} />
        <StatCard icon={<Database size={24} />} label="File importati" value={store.uploadedFiles.length} />
      </section>
      <section className="table-section no-margin">
        <div className="section-heading">
          <h2>Ultimi caricamenti</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>POD/PDR</th>
                <th>Offerta</th>
                <th>Tipo</th>
                <th>Fonte</th>
                <th>Data firma</th>
              </tr>
            </thead>
            <tbody>
              {loadingRecords.slice(0, 80).map((record) => (
                <tr key={record.id}>
                  <td>{record.customerName}</td>
                  <td>{record.podPdr}</td>
                  <td>{record.offer ?? "-"}</td>
                  <td>{commodityLabels[record.commodity]}</td>
                  <td>{store.sources.find((source) => source.id === record.matchedSourceId)?.name ?? "Da abbinare"}</td>
                  <td>{record.signedAt ? formatDate(record.signedAt) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="table-section">
        <div className="section-heading">
          <h2>Provvigioni agenzia importate</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mese</th>
                <th>Cliente</th>
                <th>POD/PDR</th>
                <th>Tipo</th>
                <th>Margine agenzia</th>
                <th>Provvigione fonte</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {agencyRecords.slice(0, 80).map((record) => (
                <tr key={record.id}>
                  <td>{formatMonthKey(record.monthKey)}</td>
                  <td>{record.customerName}</td>
                  <td>{record.podPdr}</td>
                  <td>{commodityLabels[record.commodity]}</td>
                  <td>{formatEuro(record.marginAmount)}</td>
                  <td>{record.commissionAmount !== undefined ? formatEuro(record.commissionAmount) : "-"}</td>
                  <td>{record.commissionStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function CommissionsView({ store, user, mutateStore }: ViewProps) {
  const sources = visibleSourcesForUser(user, store.sources).sort((a, b) => a.name.localeCompare(b.name, "it"));
  const rows = summarizeCommissionRows(
    visibleCommissionEntries(user, store),
    visibleCommissionPayments(user, store),
    sources
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    await mutateStore((draft) => {
      addCommissionPaymentToStore(draft, {
        sourceId: textValue(data, "sourceId"),
        amount: numberValue(data, "amount"),
        paidAt: textValue(data, "paidAt"),
        period: textValue(data, "period") || undefined,
        notes: textValue(data, "notes") || undefined,
        createdBy: user.id
      });
    }, "Pagamento registrato.");
  }

  return (
    <>
      {user.role !== "agent" && (
        <section className="panel narrow-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Pagamenti</p>
              <h2>Registra provvigione pagata</h2>
            </div>
            <BadgeEuro size={24} />
          </div>
          <form className="form-grid compact" onSubmit={(event) => void submit(event)}>
            <label>
              Fonte
              <select name="sourceId" required>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Importo
              <input name="amount" inputMode="decimal" required />
            </label>
            <label>
              Data
              <input name="paidAt" type="date" defaultValue={today()} required />
            </label>
            <label>
              Periodo
              <input name="period" placeholder="es. maggio 2026" />
            </label>
            <label className="wide-field">
              Note
              <textarea name="notes" />
            </label>
            <button className="primary-button wide-field" type="submit">
              Salva pagamento
            </button>
          </form>
        </section>
      )}
      <section className="table-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Provvigioni</p>
            <h2>Totali per fonte</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="compact-table">
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Totale</th>
                <th>Pagato</th>
                <th>Da pagare</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.source.id}>
                  <td>{row.source.name}</td>
                  <td>{formatEuro(row.total)}</td>
                  <td>{formatEuro(row.paid)}</td>
                  <td>
                    <strong>{formatEuro(row.due)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="table-section">
        <div className="section-heading">
          <h2>Provvigioni generate</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mese</th>
                <th>Fonte</th>
                <th>Cliente</th>
                <th>POD/PDR</th>
                <th>Importo</th>
              </tr>
            </thead>
            <tbody>
              {visibleCommissionEntries(user, store).slice(0, 120).map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.dueMonth}</td>
                  <td>{store.sources.find((source) => source.id === entry.sourceId)?.name ?? "-"}</td>
                  <td>{[entry.customerName, entry.customerSurname].filter(Boolean).join(" ") || "-"}</td>
                  <td>{entry.pod ?? "-"}</td>
                  <td>{formatEuro(entry.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function RulesView({ store, user, mutateStore }: ViewProps) {
  if (user.role !== "admin") {
    return <LockedPanel />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    await mutateStore((draft) => {
      addCommissionRuleToStore(draft, {
        name: textValue(data, "name"),
        sourceKind: textValue(data, "sourceKind") as CommissionRule["sourceKind"],
        customerType: textValue(data, "customerType") as CommissionRule["customerType"],
        offerName: textValue(data, "offerName"),
        calculationType: textValue(data, "calculationType") as CommissionRule["calculationType"],
        amount: numberValue(data, "amount"),
        percentage: numberValue(data, "percentage") || undefined,
        maxAmount: numberValue(data, "maxAmount") || undefined,
        notes: textValue(data, "notes") || undefined,
        effectiveFrom: textValue(data, "effectiveFrom"),
        createdBy: user.id
      });
    }, "Regola provvigionale salvata.");
  }

  return (
    <>
      <section className="panel narrow-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Regole</p>
            <h2>Sistema provvigionale</h2>
          </div>
          <SlidersHorizontal size={24} />
        </div>
        <form className="form-grid compact" onSubmit={(event) => void submit(event)}>
          <label>
            Nome
            <input name="name" required />
          </label>
          <label>
            Offerta
            <input name="offerName" required />
          </label>
          <label>
            Fonte
            <select name="sourceKind" defaultValue="tutte">
              <option value="tutte">Tutte</option>
              <option value="collaboratore">Collaboratore</option>
              <option value="frontline">Frontline</option>
              <option value="sede">Sede</option>
            </select>
          </label>
          <label>
            Cliente
            <select name="customerType" defaultValue="tutti">
              <option value="tutti">Tutti</option>
              <option value="RES">Residenziale</option>
              <option value="BUS">Business</option>
            </select>
          </label>
          <label>
            Calcolo
            <select name="calculationType" defaultValue="fixed_amount">
              <option value="fixed_amount">Gettone</option>
              <option value="margin_percentage">Percentuale margine</option>
            </select>
          </label>
          <label>
            Importo
            <input name="amount" inputMode="decimal" defaultValue="0" />
          </label>
          <label>
            Percentuale
            <input name="percentage" inputMode="decimal" />
          </label>
          <label>
            Valida da
            <input name="effectiveFrom" type="date" defaultValue={today()} required />
          </label>
          <label className="wide-field">
            Note
            <textarea name="notes" />
          </label>
          <button className="primary-button wide-field" type="submit">
            Salva regola
          </button>
        </form>
      </section>
      <section className="table-section">
        <div className="section-heading">
          <h2>Regole attive</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Fonte</th>
                <th>Cliente</th>
                <th>Offerta</th>
                <th>Calcolo</th>
                <th>Valida da</th>
              </tr>
            </thead>
            <tbody>
              {store.commissionRules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.name}</td>
                  <td>{rule.sourceKind}</td>
                  <td>{rule.customerType}</td>
                  <td>{rule.offerName}</td>
                  <td>
                    {rule.calculationType === "fixed_amount"
                      ? formatEuro(rule.amount)
                      : `${formatNumber(rule.percentage ?? 0)}%`}
                  </td>
                  <td>{formatDate(rule.effectiveFrom)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function PreventivatoreView({ store, user, mutateStore }: ViewProps) {
  const monthOptions = previousQuoteMonthOptions(today());
  const [quoteInput, setQuoteInput] = useState<EnergyQuoteInput>(() =>
    defaultEnergyQuoteInput({
      quoteDate: today(),
      commodity: "luce",
      customerType: "RES",
      monthKey: monthOptions[1] ?? "",
      secondMonthKey: monthOptions[0] ?? "",
      gasAnnualConsumption: 300
    })
  );
  const calculation = useMemo(
    () => calculateEnergyQuote(quoteInput, store.marketVariables),
    [quoteInput, store.marketVariables]
  );
  const offerChoices = calculation.offers.filter((offer) => offer.customerType === quoteInput.customerType);
  const selectedOffer = calculation.selectedOffer;
  const dynamicMonthOptions = previousQuoteMonthOptions(quoteInput.quoteDate);

  function updateQuote<K extends keyof EnergyQuoteInput>(key: K, value: EnergyQuoteInput[K]) {
    setQuoteInput((current) => ({ ...current, [key]: value }));
  }

  async function saveQuote() {
    if (!selectedOffer) {
      throw new Error("Seleziona una tariffa.");
    }

    await mutateStore((draft) => {
      addEnergyQuoteToStore(draft, {
        quoteDate: quoteInput.quoteDate,
        sourceId: quoteInput.sourceId,
        sourceName: store.sources.find((source) => source.id === quoteInput.sourceId)?.name,
        customerFirstName: quoteInput.firstName,
        customerLastName: quoteInput.lastName,
        customerPhone: quoteInput.phone,
        commodity: quoteInput.commodity,
        customerType: quoteInput.customerType,
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
          ...quoteInput
        },
        createdBy: user.id
      });
    }, "Preventivo salvato.");
  }

  return (
    <>
      <MarketVariablesPanel store={store} user={user} mutateStore={mutateStore} />
      <section className="quote-layout">
        <div className="quote-card quote-input-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Preventivatore</p>
              <h2>Nuovo preventivo</h2>
            </div>
            <Calculator size={26} />
          </div>

          <div className="quote-form-section">
            <div className="quote-section-heading">
              <span>Anagrafica</span>
            </div>
            <div className="quote-fields top">
              <label>
                Data
                <input
                  type="date"
                  value={quoteInput.quoteDate}
                  onChange={(event) => updateQuote("quoteDate", event.target.value)}
                />
              </label>
              <label>
                Fonte
                <select value={quoteInput.sourceId ?? ""} onChange={(event) => updateQuote("sourceId", event.target.value)}>
                  <option value="">Nessuna</option>
                  {store.sources.filter((source) => source.active).map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nome Cliente
                <input value={quoteInput.firstName} onChange={(event) => updateQuote("firstName", event.target.value)} />
              </label>
              <label>
                Cognome Cliente
                <input value={quoteInput.lastName} onChange={(event) => updateQuote("lastName", event.target.value)} />
              </label>
              <label>
                Cellulare
                <input value={quoteInput.phone ?? ""} onChange={(event) => updateQuote("phone", event.target.value)} />
              </label>
            </div>
          </div>

          <div className="quote-form-section">
            <div className="quote-section-heading">
              <span>Offerta</span>
            </div>
            <div className="quote-fields-three">
              <label>
                Tipologia
                <select
                  value={quoteInput.commodity}
                  onChange={(event) => updateQuote("commodity", event.target.value as QuoteCommodity)}
                >
                  <option value="luce">Luce</option>
                  <option value="gas">Gas</option>
                </select>
              </label>
              <label>
                Cliente
                <select
                  value={quoteInput.customerType}
                  onChange={(event) => updateQuote("customerType", event.target.value as QuoteCustomerType)}
                >
                  <option value="RES">Residenziale</option>
                  <option value="BUS">Business</option>
                </select>
              </label>
              <label>
                Tariffa preventivata
                <select
                  value={selectedOffer?.code ?? ""}
                  onChange={(event) => updateQuote("selectedOfferCode", event.target.value)}
                >
                  {offerChoices.map((offer) => (
                    <option key={offer.code} value={offer.code}>
                      {offer.offerName} - {offer.customerType}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="quote-form-section">
            <div className="quote-section-heading">
              <span>Bolletta</span>
            </div>
            <div className="quote-fields-three">
              <label>
                Mese 1
                <select value={quoteInput.monthKey} onChange={(event) => updateQuote("monthKey", event.target.value)}>
                  {dynamicMonthOptions.map((monthKey) => (
                    <option key={monthKey} value={monthKey}>
                      {formatMonthKey(monthKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mese 2
                <select
                  value={quoteInput.secondMonthKey ?? ""}
                  onChange={(event) => updateQuote("secondMonthKey", event.target.value)}
                >
                  {dynamicMonthOptions.map((monthKey) => (
                    <option key={monthKey} value={monthKey}>
                      {formatMonthKey(monthKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                PCV mensile attuale
                <input
                  inputMode="decimal"
                  value={formatInputNumber(quoteInput.currentPcv)}
                  onChange={(event) => updateQuote("currentPcv", parseEuro(event.target.value))}
                />
              </label>
              <label>
                Prezzo medio {quoteInput.commodity === "luce" ? "kWh spesa energia" : "Smc spesa vendita gas"}
                <input
                  inputMode="decimal"
                  value={formatInputNumber(quoteInput.currentAveragePrice)}
                  onChange={(event) => updateQuote("currentAveragePrice", parseEuro(event.target.value))}
                />
              </label>
              {quoteInput.commodity === "luce" && (
                <>
                  <label>
                    Calcolo consumi
                    <select
                      value={quoteInput.lightConsumptionMode}
                      onChange={(event) => updateQuote("lightConsumptionMode", event.target.value as LightConsumptionMode)}
                    >
                      <option value="totale">Consumo totale mensile</option>
                      <option value="fasce">Consumi per fasce</option>
                    </select>
                  </label>
                  <label>
                    Perdite
                    <select
                      value={quoteInput.lightLossMode}
                      onChange={(event) => updateQuote("lightLossMode", event.target.value as LightLossMode)}
                    >
                      <option value="bassa">Bassa tensione</option>
                      <option value="media_alta">Media/alta tensione</option>
                    </select>
                  </label>
                </>
              )}
              {quoteInput.commodity === "gas" && (
                <label>
                  <span className="field-label-row">
                    Consumo annuo gas
                    <span className="field-info" tabIndex={0}>
                      <Info size={13} />
                      <span className="field-info-tooltip">Se non e disponibile, usa 300 Smc.</span>
                    </span>
                  </span>
                  <input
                    inputMode="decimal"
                    value={formatInputNumber(quoteInput.gasAnnualConsumption)}
                    onChange={(event) => updateQuote("gasAnnualConsumption", parseEuro(event.target.value))}
                  />
                </label>
              )}
            </div>
            {quoteInput.commodity === "luce" && quoteInput.lightConsumptionMode === "fasce" ? (
              <div className="quote-fasce-grid">
                {(["f1Month1", "f2Month1", "f3Month1", "f1Month2", "f2Month2", "f3Month2"] as const).map((key) => (
                  <label key={key}>
                    {key.replace("Month", " mese ")}
                    <input
                      inputMode="decimal"
                      value={formatInputNumber(quoteInput[key])}
                      onChange={(event) => updateQuote(key, parseEuro(event.target.value))}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="quote-fields-two">
                <label>
                  Consumo mese 1
                  <input
                    inputMode="decimal"
                    value={formatInputNumber(quoteInput.consumptionMonth1)}
                    onChange={(event) => updateQuote("consumptionMonth1", parseEuro(event.target.value))}
                  />
                </label>
                <label>
                  Consumo mese 2
                  <input
                    inputMode="decimal"
                    value={formatInputNumber(quoteInput.consumptionMonth2)}
                    onChange={(event) => updateQuote("consumptionMonth2", parseEuro(event.target.value))}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        <aside className="quote-card quote-result-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Risultato</p>
              <h2>{selectedOffer?.offerName ?? "Preventivo"}</h2>
            </div>
            <BadgeEuro size={24} />
          </div>
          <div className="quote-result-meta">
            <span className={`status-badge ${quoteInput.commodity}`}>{commodityLabels[quoteInput.commodity]}</span>
            <span className={`status-badge ${quoteInput.customerType.toLowerCase()}`}>{quoteInput.customerType}</span>
          </div>
          {calculation.warnings.map((warning) => (
            <div className="quote-warning" key={warning}>
              {warning}
            </div>
          ))}
          <div className="quote-result-list">
            <div className="quote-current-row">
              <span>Quota consumi attuale</span>
              <strong>{formatEuro(calculation.source.currentSpend)}</strong>
            </div>
            <div className="quote-current-row">
              <span>Spread attuale</span>
              <strong>{formatSpread(calculation.source.currentSpread, 3)} €</strong>
            </div>
            <div className="quote-current-row">
              <span>PCV attuale</span>
              <strong>{formatEuro(calculation.source.currentPcv)}</strong>
            </div>
            <div className="quote-proposed-row">
              <span>Quota consumi proposta</span>
              <strong>{selectedOffer ? formatEuro(selectedOffer.quotaConsumi) : "-"}</strong>
            </div>
            <div className="quote-proposed-row">
              <span>PCV proposto</span>
              <strong>{selectedOffer ? formatEuro(selectedOffer.pcv) : "-"}</strong>
            </div>
            <div className="quote-highlight">
              <span>Risparmio annuo</span>
              <strong>{selectedOffer ? formatEuro(selectedOffer.annualSaving) : "-"}</strong>
            </div>
          </div>
          <div className="quote-actions">
            <button className="secondary-button" type="button" onClick={() => void saveQuote()}>
              <Save size={18} />
              Salva preventivo
            </button>
            <button className="print-button" type="button" onClick={() => window.print()}>
              <Upload size={18} />
              Stampa preventivo
            </button>
          </div>
        </aside>
      </section>
      <QuotePrintPage calculation={calculation} input={quoteInput} selectedOffer={selectedOffer} />
    </>
  );
}

function MarketVariablesPanel({ store, user, mutateStore }: ViewProps) {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const latestVariables = [...store.marketVariables].sort((a, b) => b.monthKey.localeCompare(a.monthKey) || a.label.localeCompare(b.label, "it")).slice(0, 24);

  async function saveVariables(event: FormEvent<HTMLFormElement>, commodity: Exclude<Commodity, "non_definito">) {
    const data = formData(event);
    await mutateStore((draft) => {
      for (const definition of marketVariableDefinitions.filter((item) => item.commodity === commodity)) {
        const value = numberValue(data, definition.key);
        upsertMarketVariableToStore(draft, {
          key: definition.key,
          monthKey,
          value,
          updatedBy: user.id
        });
      }
    }, commodity === "luce" ? "Variabili luce aggiornate." : "PSV aggiornato.");
  }

  function existingValue(key: string) {
    return store.marketVariables.find((variable) => variable.key === key && variable.monthKey === monthKey)?.value ?? 0;
  }

  return (
    <section className="market-entry-grid">
      <article className="market-entry-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Variabili</p>
            <h2>Luce</h2>
          </div>
          <Zap size={24} />
        </div>
        <label>
          Mese
          <input type="month" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} />
        </label>
        <form className="market-entry-fields" onSubmit={(event) => void saveVariables(event, "luce")}>
          {marketVariableDefinitions.filter((definition) => definition.commodity === "luce").map((definition) => (
            <label key={definition.key}>
              {definition.label}
              <input name={definition.key} inputMode="decimal" defaultValue={formatInputNumber(existingValue(definition.key))} />
            </label>
          ))}
          <button className="primary-button wide-field" type="submit">
            Salva luce
          </button>
        </form>
      </article>
      <article className="market-entry-card gas">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Variabili</p>
            <h2>Gas</h2>
          </div>
          <Flame size={24} />
        </div>
        <label>
          Mese
          <input type="month" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} />
        </label>
        <form className="market-entry-fields" onSubmit={(event) => void saveVariables(event, "gas")}>
          {marketVariableDefinitions.filter((definition) => definition.commodity === "gas").map((definition) => (
            <label key={definition.key}>
              {definition.label}
              <input name={definition.key} inputMode="decimal" defaultValue={formatInputNumber(existingValue(definition.key))} />
            </label>
          ))}
          <button className="primary-button wide-field" type="submit">
            Salva gas
          </button>
        </form>
      </article>
      <details className="table-section market-recap market-entry-grid-contained">
        <summary className="recap-summary">
          <strong>Recap variabili mercato</strong>
          <Info size={20} />
        </summary>
        <div className="table-wrap">
          <table className="market-variables-table">
            <thead>
              <tr>
                <th>Mese</th>
                <th>Tipologia</th>
                <th>Voce</th>
                <th>Valore</th>
                <th>Aggiornato</th>
              </tr>
            </thead>
            <tbody>
              {latestVariables.map((variable) => (
                <tr key={variable.id}>
                  <td>{formatMonthKey(variable.monthKey)}</td>
                  <td>{commodityLabels[variable.commodity]}</td>
                  <td>{variable.label}</td>
                  <td>{formatSpread(variable.value, 6)} {variable.unit}</td>
                  <td>{formatDateTime(variable.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function QuotePrintPage({
  calculation,
  input,
  selectedOffer
}: {
  calculation: ReturnType<typeof calculateEnergyQuote>;
  input: EnergyQuoteInput;
  selectedOffer: ReturnType<typeof calculateEnergyQuote>["selectedOffer"];
}) {
  const saving = selectedOffer?.annualSaving ?? 0;
  const unit = input.commodity === "luce" ? "kWh" : "Smc";

  return (
    <section className="quote-print-page">
      <header className="quote-print-header">
        <div>
          <p>Mancini Service</p>
          <h2>{printCommodityTitle(input.commodity)}</h2>
        </div>
        <div className="print-header-side">
          <div className="print-logo-mark" />
          <div className="print-whatsapp-contact">
            <MessageCircle />
            <span>Servizio clienti WhatsApp</span>
            <strong>3489068756</strong>
          </div>
        </div>
      </header>
      <div className="quote-print-hero">
        <article className="print-client-block">
          <p className="print-kicker">Cliente</p>
          <h3>{[input.firstName, input.lastName].filter(Boolean).join(" ") || "Cliente"}</h3>
          <dl>
            <div>
              <dt>Data</dt>
              <dd>{input.quoteDate ? formatDate(input.quoteDate) : "-"}</dd>
            </div>
            <div>
              <dt>Tipologia</dt>
              <dd>{commodityLabels[input.commodity]}</dd>
            </div>
            <div>
              <dt>Cliente</dt>
              <dd>{customerTypeLabel(input.customerType)}</dd>
            </div>
            <div>
              <dt>Cellulare</dt>
              <dd>{input.phone || "-"}</dd>
            </div>
          </dl>
        </article>
        <article className={`print-saving-panel ${printSavingClass(saving)}`}>
          <span>Risparmio annuo stimato</span>
          <strong>{selectedOffer ? formatEuro(saving) : "-"}</strong>
          <small>{selectedOffer?.offerName ?? "Offerta selezionata"}</small>
        </article>
      </div>
      <div className="print-comparison-grid">
        <article className="print-comparison-card current">
          <span>Situazione attuale</span>
          <strong>{formatEuro(calculation.source.currentSpend)}</strong>
          <div>
            <small>Spread</small>
            <b>{formatSpread(calculation.source.currentSpread, 3)} €</b>
          </div>
          <div>
            <small>PCV</small>
            <b>{formatEuro(calculation.source.currentPcv)}</b>
          </div>
        </article>
        <article className="print-comparison-card proposed">
          <span>Proposta Mancini Service</span>
          <strong>{selectedOffer ? formatEuro(selectedOffer.quotaConsumi) : "-"}</strong>
          <div>
            <small>Spread</small>
            <b>{selectedOffer ? `${formatSpread(selectedOffer.spread, 3)} €` : "-"}</b>
          </div>
          <div>
            <small>PCV</small>
            <b>{selectedOffer ? formatEuro(selectedOffer.pcv) : "-"}</b>
          </div>
        </article>
      </div>
      <div className="print-detail-grid">
        <article>
          <p className="print-kicker">Consumi analizzati</p>
          <h3>Periodo bolletta</h3>
          <div className="print-pill-row">
            <span>{formatMonthKey(input.monthKey)}</span>
            {input.secondMonthKey && <span>{formatMonthKey(input.secondMonthKey)}</span>}
          </div>
          <ul>
            <li>
              <span>Consumo totale</span>
              <strong>{formatNumber(calculation.source.totalConsumption)} {unit}</strong>
            </li>
            <li>
              <span>Consumo annuo stimato</span>
              <strong>{formatNumber(calculation.source.annualConsumption)} {unit}</strong>
            </li>
            <li>
              <span>Prezzo medio attuale</span>
              <strong>{formatSpread(calculation.source.currentAveragePrice, 6)} €/{unit}</strong>
            </li>
          </ul>
        </article>
        <article>
          <p className="print-kicker">Offerta</p>
          <h3>{selectedOffer?.offerName ?? "-"}</h3>
          <ul>
            <li>
              <span>Tipologia</span>
              <strong>{commodityLabels[input.commodity]}</strong>
            </li>
            <li>
              <span>Cliente</span>
              <strong>{customerTypeLabel(input.customerType)}</strong>
            </li>
            <li>
              <span>Differenza annua</span>
              <strong>{selectedOffer ? formatEuro(selectedOffer.annualDifference) : "-"}</strong>
            </li>
          </ul>
        </article>
      </div>
      <footer className="quote-print-footer">
        <strong>Mancini Service</strong>
        <span>Stima indicativa basata sui dati inseriti e sui valori di mercato disponibili al momento del preventivo.</span>
      </footer>
    </section>
  );
}

function LockedPanel() {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Accesso</p>
          <h2>Area riservata</h2>
        </div>
      </div>
      <p className="muted-text">Il tuo ruolo non consente di aprire questa sezione.</p>
    </section>
  );
}
