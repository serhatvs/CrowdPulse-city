import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Wallet, type Eip1193Provider } from "ethers";
import HazardFilter from "../components/HazardFilter";

const CityPulseHeatmap = lazy(() => import("../components/CityPulseHeatmap"));
const HazardReportModal = lazy(() => import("../components/HazardReportModal"));

type FilterState = {
  category: number;
  minRisk: number;
  maxRisk: number;
  timeWindow: number;
  includeClosed: boolean;
  sort: "recent" | "risk" | "votes";
};

type AuthNonceResponse = {
  message: string;
};

type AuthVerifyResponse = {
  token: string;
  tokenType: string;
  expiresInSeconds: number;
};

type ApiError = {
  error?: string;
  details?: string;
};

type HazardItem = {
  id: number;
  lat: number;
  lon: number;
  type: string;
  description: string | null;
  createdAt: string;
  createdBy: string | null;
  category: number;
  severity: number;
  closed: boolean;
  chainHazardId: number | null;
  upVotes: number;
  downVotes: number;
  totalVotes: number;
  netVotes: number;
  risk: number;
  lastActivityTimestamp: number;
};

type StatsResponse = {
  hazardCount: number;
  openCount: number;
  closedCount: number;
  totalVotes: number;
  avgRisk: number;
  maxRisk: number;
  highRiskCount: number;
  lastActivityTimestamp: number | null;
};

type ActivityItem = {
  id: number;
  event_type: string;
  payload: unknown;
  created_at: string;
};

type Point = {
  lat: number;
  lon: number;
};

type WalletProvider = Eip1193Provider & {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(eventName: string, listener: (...args: unknown[]) => void): void;
  removeListener?(eventName: string, listener: (...args: unknown[]) => void): void;
};

function normalizeBaseUrl(raw: string | undefined): string {
  return raw?.trim().replace(/\/+$/, "") ?? "";
}

function normalizeChainId(raw: string | number | bigint | null | undefined): string {
  if (raw == null) {
    return "";
  }
  if (typeof raw === "number" || typeof raw === "bigint") {
    return `0x${raw.toString(16)}`.toLowerCase();
  }
  const value = String(raw).trim().toLowerCase();
  if (!value) {
    return "";
  }
  if (value.startsWith("0x")) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `0x${parsed.toString(16)}`.toLowerCase() : value;
}

function getWalletProvider(): WalletProvider | null {
  return (window as unknown as { ethereum?: WalletProvider }).ethereum ?? null;
}

function extractErrorCode(error: unknown): number | null {
  if (typeof error !== "object" || error == null || !("code" in error)) {
    return null;
  }
  const parsed = Number((error as { code?: unknown }).code);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildExplorerUrl(baseUrl: string, address: string): string {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  if (!normalizedBaseUrl || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return "";
  }
  return `${normalizedBaseUrl}/address/${address}`;
}

const apiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);

function apiUrl(path: string): string {
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}

const demoMode = (import.meta.env.VITE_DEMO_MODE ?? "true") === "true";
const closeMinVotes = Number(import.meta.env.VITE_CLOSE_MIN_VOTES ?? 10);
const parsedMonadChainId = Number(import.meta.env.VITE_MONAD_CHAIN_ID ?? 10143);
const monadChainId = Number.isFinite(parsedMonadChainId) ? parsedMonadChainId : 10143;
const monadChainIdHex = normalizeChainId(monadChainId);
const monadChainName = import.meta.env.VITE_MONAD_CHAIN_NAME ?? "Monad Testnet";
const monadRpcUrl = import.meta.env.VITE_MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const monadExplorerUrl = import.meta.env.VITE_MONAD_EXPLORER_URL ?? "https://testnet.monadvision.com";
const monadCurrencyName = import.meta.env.VITE_MONAD_CURRENCY_NAME ?? "Monad";
const monadCurrencySymbol = import.meta.env.VITE_MONAD_CURRENCY_SYMBOL ?? "MON";
const requireMonadNetwork = (import.meta.env.VITE_MONAD_REQUIRED ?? "false") === "true";
const contractAddress = (import.meta.env.VITE_CONTRACT_ADDRESS ?? "").trim();
const contractExplorerUrl = buildExplorerUrl(monadExplorerUrl, contractAddress);

const defaultBbox = {
  minLat: 38.49,
  minLon: 35.49,
  maxLat: 38.52,
  maxLon: 35.52,
};

const demoWallet = {
  address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
};

const defaultReportPoint: Point = {
  lat: (defaultBbox.minLat + defaultBbox.maxLat) / 2,
  lon: (defaultBbox.minLon + defaultBbox.maxLon) / 2,
};

const categoryNames: Record<number, string> = {
  1: "Sidewalk height",
  2: "Pothole",
  3: "Missing ramp",
  4: "Stairs",
  5: "Slippery surface",
  255: "Other",
};

async function readApiError(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as ApiError;
    return payload.error ?? payload.details ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function fetchNonce(address: string): Promise<AuthNonceResponse> {
  const res = await fetch(apiUrl(`/api/auth/nonce?address=${address.toLowerCase()}`));
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return (await res.json()) as AuthNonceResponse;
}

async function verifySignature(address: string, signature: string): Promise<AuthVerifyResponse> {
  const res = await fetch(apiUrl("/api/auth/verify"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: address.toLowerCase(), signature }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return (await res.json()) as AuthVerifyResponse;
}

function buildFilterQuery(
  bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number },
  filter: FilterState,
): URLSearchParams {
  return new URLSearchParams({
    bbox: `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`,
    category: String(filter.category),
    minRisk: String(filter.minRisk),
    maxRisk: String(filter.maxRisk),
    timeWindow: String(filter.timeWindow),
    includeClosed: String(filter.includeClosed),
  });
}

function prettyCategory(category: number): string {
  return categoryNames[category] ?? `Category ${category}`;
}

function toLocalTime(timestampSeconds: number | null): string {
  if (!timestampSeconds) {
    return "-";
  }
  return new Date(timestampSeconds * 1000).toLocaleTimeString();
}

function formatActivityText(item: ActivityItem): string {
  const payload = item.payload && typeof item.payload === "object" ? (item.payload as Record<string, unknown>) : null;
  if (item.event_type === "hazard_created") {
    const hazardId = payload?.hazard && typeof payload.hazard === "object" ? (payload.hazard as { id?: number }).id : null;
    return `Hazard created${hazardId ? ` #${hazardId}` : ""}`;
  }
  if (item.event_type === "hazard_voted") {
    const hazardId = typeof payload?.hazardId === "number" ? payload.hazardId : null;
    const value = typeof payload?.value === "number" ? payload.value : null;
    const voteText = value === 1 ? "upvote" : value === -1 ? "downvote" : "vote";
    return `Hazard ${hazardId ? `#${hazardId} ` : ""}${voteText}`;
  }
  if (item.event_type === "hazard_closed") {
    const hazardId = typeof payload?.hazardId === "number" ? payload.hazardId : null;
    return `Hazard closed${hazardId ? ` #${hazardId}` : ""}`;
  }
  return item.event_type;
}

export default function App() {
  const [bbox] = useState(defaultBbox);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<FilterState>({
    category: 0,
    minRisk: 0,
    maxRisk: 100,
    timeWindow: 24,
    includeClosed: true,
    sort: "recent",
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportPoint, setReportPoint] = useState<Point | null>(null);
  const [lastReportedPoint, setLastReportedPoint] = useState<Point | null>(null);
  const [mapFocusPoint, setMapFocusPoint] = useState<Point | null>(null);
  const [mapFocusToken, setMapFocusToken] = useState(0);
  const [mapResetToken, setMapResetToken] = useState(0);
  const [token, setToken] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [tokenExpiryAt, setTokenExpiryAt] = useState<number | null>(null);
  const [status, setStatus] = useState("Ready");
  const [walletChainId, setWalletChainId] = useState("");
  const [selectedHazardId, setSelectedHazardId] = useState<number | null>(null);
  const [manualAddress, setManualAddress] = useState(demoWallet.address);
  const [manualKey, setManualKey] = useState(demoWallet.privateKey);
  const [isBusy, setIsBusy] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [hazards, setHazards] = useState<HazardItem[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }
    const timer = setInterval(() => setRefreshKey((value) => value + 1), 15000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  const tokenRemainingSeconds = tokenExpiryAt ? Math.max(0, Math.floor((tokenExpiryAt - nowTick) / 1000)) : 0;

  function clearSession(message = "Logged out") {
    setToken("");
    setWalletAddress("");
    setTokenExpiryAt(null);
    setStatus(message);
  }

  useEffect(() => {
    if (token && tokenExpiryAt && tokenRemainingSeconds <= 0) {
      clearSession("Session expired. Login again.");
    }
  }, [token, tokenExpiryAt, tokenRemainingSeconds]);

  useEffect(() => {
    const ethereum = getWalletProvider();
    if (!ethereum) {
      setWalletChainId("");
      return undefined;
    }
    const walletProvider = ethereum;

    async function syncChain(): Promise<void> {
      try {
        const chainId = await walletProvider.request({ method: "eth_chainId" });
        setWalletChainId(normalizeChainId(typeof chainId === "string" ? chainId : String(chainId ?? "")));
      } catch {
        setWalletChainId("");
      }
    }

    const handleChainChanged = (chainId: unknown): void => {
      setWalletChainId(normalizeChainId(typeof chainId === "string" ? chainId : String(chainId ?? "")));
    };

    void syncChain();
    walletProvider.on?.("chainChanged", handleChainChanged);

    return () => {
      walletProvider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  const authHeaders = useMemo(() => {
    if (!token || !walletAddress) {
      return null;
    }
    return {
      Authorization: `Bearer ${token}`,
      "x-wallet-address": walletAddress,
      "Content-Type": "application/json",
    };
  }, [token, walletAddress]);

  function focusMap(point: Point): void {
    setMapFocusPoint(point);
    setMapFocusToken((value) => value + 1);
  }

  function selectReportPoint(point: Point): void {
    setReportPoint(point);
    focusMap(point);
  }

  function openReportModal(): void {
    const point = reportPoint ?? defaultReportPoint;
    selectReportPoint(point);
    setIsModalOpen(true);
  }

  async function requestMonadNetwork(ethereum: WalletProvider): Promise<void> {
    const chainId = await ethereum.request({ method: "eth_chainId" });
    const currentChainId = normalizeChainId(typeof chainId === "string" ? chainId : String(chainId ?? ""));
    if (!requireMonadNetwork || currentChainId === monadChainIdHex) {
      setWalletChainId(currentChainId);
      return;
    }

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: monadChainIdHex }],
      });
    } catch (error) {
      if (extractErrorCode(error) !== 4902) {
        throw new Error(`MetaMask must be switched to ${monadChainName}.`);
      }

      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: monadChainIdHex,
            chainName: monadChainName,
            nativeCurrency: {
              name: monadCurrencyName,
              symbol: monadCurrencySymbol,
              decimals: 18,
            },
            rpcUrls: [monadRpcUrl],
            blockExplorerUrls: monadExplorerUrl ? [monadExplorerUrl] : [],
          },
        ],
      });
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: monadChainIdHex }],
      });
    }

    setWalletChainId(monadChainIdHex);
  }

  async function switchToMonadNetwork(): Promise<void> {
    const ethereum = getWalletProvider();
    if (!ethereum) {
      setStatus("MetaMask not found.");
      return;
    }

    try {
      setIsBusy(true);
      setStatus(`Switching MetaMask to ${monadChainName}...`);
      await requestMonadNetwork(ethereum);
      setStatus(`${monadChainName} selected in MetaMask.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const baseQuery = buildFilterQuery(bbox, filter);
    const hazardsQuery = new URLSearchParams(baseQuery);
    hazardsQuery.set("sort", filter.sort);
    hazardsQuery.set("limit", "120");
    const statsQuery = new URLSearchParams(baseQuery);
    const activityQuery = new URLSearchParams({ limit: "30" });

    async function loadDashboard() {
      setLoadingData(true);
      setDataError(null);
      try {
        const [hazardsRes, statsRes, activityRes] = await Promise.all([
          fetch(apiUrl(`/api/hazards?${hazardsQuery.toString()}`), { signal: controller.signal }),
          fetch(apiUrl(`/api/stats?${statsQuery.toString()}`), { signal: controller.signal }),
          fetch(apiUrl(`/api/activity?${activityQuery.toString()}`), { signal: controller.signal }),
        ]);
        if (!hazardsRes.ok) {
          throw new Error(await readApiError(hazardsRes));
        }
        if (!statsRes.ok) {
          throw new Error(await readApiError(statsRes));
        }
        if (!activityRes.ok) {
          throw new Error(await readApiError(activityRes));
        }

        const hazardsPayload = (await hazardsRes.json()) as HazardItem[];
        const statsPayload = (await statsRes.json()) as StatsResponse;
        const activityPayload = (await activityRes.json()) as ActivityItem[];

        setHazards(hazardsPayload);
        setStats(statsPayload);
        setActivity(activityPayload);
        setSelectedHazardId((current) => {
          if (current == null) {
            return current;
          }
          return hazardsPayload.some((hazard) => hazard.id === current) ? current : null;
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setDataError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        setLoadingData(false);
      }
    }

    loadDashboard();
    return () => controller.abort();
  }, [bbox, filter, refreshKey]);

  async function loginWithMetamask(): Promise<void> {
    try {
      setIsBusy(true);
      setStatus("Connecting MetaMask...");
      const ethereum = getWalletProvider();
      if (!ethereum) {
        throw new Error("MetaMask not found.");
      }

      const provider = new BrowserProvider(ethereum);
      await provider.send("eth_requestAccounts", []);
      await requestMonadNetwork(ethereum);
      const signer = await provider.getSigner();
      const address = (await signer.getAddress()).toLowerCase();
      const nonce = await fetchNonce(address);
      const signature = await signer.signMessage(nonce.message);
      const verified = await verifySignature(address, signature);

      setWalletAddress(address);
      setToken(verified.token);
      setTokenExpiryAt(Date.now() + verified.expiresInSeconds * 1000);
      setStatus(`Signed in: ${address.slice(0, 8)}...`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function loginWithManualKey(): Promise<void> {
    try {
      setIsBusy(true);
      setStatus("Signing with demo wallet...");
      const wallet = new Wallet(manualKey);
      const address = manualAddress.toLowerCase();
      if (wallet.address.toLowerCase() !== address) {
        throw new Error("Address and private key do not match.");
      }

      const nonce = await fetchNonce(address);
      const signature = await wallet.signMessage(nonce.message);
      const verified = await verifySignature(address, signature);

      setWalletAddress(address);
      setToken(verified.token);
      setTokenExpiryAt(Date.now() + verified.expiresInSeconds * 1000);
      setStatus(`Signed in: ${address.slice(0, 8)}...`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function logout(): Promise<void> {
    try {
      if (token) {
        await fetch(apiUrl("/api/auth/logout"), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // Ignore logout call failures; local session clear still applies.
    } finally {
      clearSession("Logged out.");
    }
  }

  async function submitHazard(payload: {
    lat: number;
    lon: number;
    category: number;
    severity: number;
    noteURI: string;
    otherDetail?: string;
  }): Promise<boolean> {
    if (!authHeaders) {
      setStatus("Login required before reporting.");
      return false;
    }

    try {
      setIsBusy(true);
      const customDetail = payload.otherDetail?.trim() ?? "";
      const body = {
        lat: payload.lat,
        lon: payload.lon,
        type: payload.category === 255 ? "category_other" : `category_${payload.category}`,
        description: customDetail || "UI report",
        category: payload.category,
        severity: payload.severity,
        noteURI: payload.noteURI,
      };
      const res = await fetch(apiUrl("/api/hazards"), {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }

      const created = (await res.json()) as { id: number };
      const point = { lat: payload.lat, lon: payload.lon };
      setReportPoint(point);
      setLastReportedPoint(point);
      setStatus(`Hazard created: #${created.id} at ${payload.lat.toFixed(6)}, ${payload.lon.toFixed(6)}`);
      setSelectedHazardId(created.id);
      setMapResetToken((value) => value + 1);
      setRefreshKey((value) => value + 1);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message);
      throw new Error(message);
    } finally {
      setIsBusy(false);
    }
  }

  async function voteHazardById(hazardId: number, voteType: "up" | "down"): Promise<void> {
    if (!authHeaders) {
      setStatus("Login required before voting.");
      return;
    }
    if (!Number.isInteger(hazardId) || hazardId <= 0) {
      setStatus("Provide a valid hazard id.");
      return;
    }

    try {
      setIsBusy(true);
      const res = await fetch(apiUrl(`/api/hazards/${hazardId}/vote`), {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ vote: voteType }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }

      setStatus(`Vote sent: #${hazardId} (${voteType})`);
      setSelectedHazardId(hazardId);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function closeHazardById(hazardId: number): Promise<void> {
    if (!authHeaders) {
      setStatus("Login required before closing.");
      return;
    }
    try {
      setIsBusy(true);
      const res = await fetch(apiUrl(`/api/hazards/${hazardId}/close`), {
        method: "POST",
        headers: authHeaders,
      });
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }
      setStatus(`Hazard closed: #${hazardId}`);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  const selectedHazard = selectedHazardId == null ? null : hazards.find((hazard) => hazard.id === selectedHazardId) ?? null;
  const hasWalletProvider = Boolean(getWalletProvider());
  const isExpectedNetwork = walletChainId === monadChainIdHex;
  const walletNetworkLabel = !hasWalletProvider
    ? "MetaMask not detected"
    : !walletChainId
      ? "Not connected yet"
      : isExpectedNetwork
        ? `${monadChainName} (${monadChainId})`
        : `Unexpected chain ${walletChainId}`;

  return (
    <div className="app-shell">
      <header className="hero">
        <h1>CrowdPulse City Demo</h1>
        <p>End-to-end demo: wallet auth, hazard reporting, voting, closing, heatmap and activity timeline.</p>
      </header>

      <section className="control-panel">
        <div className="card">
          <h2>Wallet Auth</h2>
          <p>Login once, then test report, vote and close flows directly from UI.</p>
          <small>
            Target network: {monadChainName} ({monadChainId}){requireMonadNetwork ? " required" : " optional"}.
          </small>
          <small>Wallet network: {walletNetworkLabel}</small>
          {requireMonadNetwork && hasWalletProvider && walletChainId && !isExpectedNetwork ? (
            <div className="status status-warning">Switch MetaMask to {monadChainName} before signing in.</div>
          ) : null}
          <div className="row">
            <button onClick={loginWithMetamask} disabled={isBusy}>
              MetaMask Login
            </button>
            {requireMonadNetwork ? (
              <button onClick={() => void switchToMonadNetwork()} disabled={isBusy || !hasWalletProvider} type="button">
                Switch to Monad
              </button>
            ) : null}
            {token ? (
              <button onClick={logout} disabled={isBusy}>
                Logout
              </button>
            ) : null}
          </div>
          {contractExplorerUrl ? (
            <a className="button-link" href={contractExplorerUrl} rel="noreferrer" target="_blank">
              View Contract on Monad
            </a>
          ) : null}
          {demoMode ? (
            <>
              <button onClick={loginWithManualKey} disabled={isBusy}>
                Demo Wallet Login
              </button>
              <input
                value={manualAddress}
                onChange={(event) => setManualAddress(event.target.value)}
                placeholder="Wallet address"
              />
              <input
                value={manualKey}
                onChange={(event) => setManualKey(event.target.value)}
                placeholder="Private key (local demo)"
                type="password"
              />
            </>
          ) : (
            <small>Demo private-key login is disabled outside demo mode.</small>
          )}
          <div className="status">
            {status}
            <br />
            {token ? `Session: ${tokenRemainingSeconds}s` : "Session: not signed in"}
          </div>
        </div>

        <div className="card">
          <h2>Filters & Data</h2>
          <HazardFilter onFilter={setFilter} />
          <div className="row">
            <button onClick={() => setRefreshKey((value) => value + 1)} disabled={isBusy}>
              Refresh Now
            </button>
            <button onClick={() => setAutoRefresh((value) => !value)} type="button">
              Auto Refresh: {autoRefresh ? "ON" : "OFF"}
            </button>
          </div>
          {dataError ? <div className="status">Data error: {dataError}</div> : null}
        </div>

        <div className="card">
          <h2>Quick Actions</h2>
          <p>Click map to select coordinates, keep navigating, then open modal with Report Hazard.</p>
          <div className="row">
            <button onClick={openReportModal} disabled={!token || isBusy}>
              Report Hazard
            </button>
            <button
              onClick={() => {
                setMapResetToken((value) => value + 1);
              }}
              type="button"
            >
              Reset Map View
            </button>
          </div>
          <div className="row">
            <input
              value={selectedHazardId ?? ""}
              onChange={(event) => {
                const next = Number(event.target.value);
                setSelectedHazardId(Number.isInteger(next) && next > 0 ? next : null);
              }}
              placeholder="Selected hazard id"
            />
          </div>
          <small>
            Selected point:{" "}
            {reportPoint ? `${reportPoint.lat.toFixed(6)}, ${reportPoint.lon.toFixed(6)}` : "none yet (click map first)"}
          </small>
          <small>
            Last reported point:{" "}
            {lastReportedPoint
              ? `${lastReportedPoint.lat.toFixed(6)}, ${lastReportedPoint.lon.toFixed(6)}`
              : "no report submitted yet"}
          </small>
          <div className="row">
            <button onClick={() => selectedHazardId && voteHazardById(selectedHazardId, "up")} disabled={!token || isBusy}>
              Vote Up
            </button>
            <button onClick={() => selectedHazardId && voteHazardById(selectedHazardId, "down")} disabled={!token || isBusy}>
              Vote Down
            </button>
            <button onClick={() => selectedHazardId && closeHazardById(selectedHazardId)} disabled={!token || isBusy}>
              Close
            </button>
          </div>
          <small>
            Close rule: reporter only, minimum {closeMinVotes} total votes.
            {selectedHazard ? ` Selected #${selectedHazard.id} (${selectedHazard.totalVotes} votes).` : ""}
          </small>
        </div>

        <div className="card metrics-card">
          <h2>Live Metrics</h2>
          <div className="metrics-grid">
            <div>
              <span>Hazards</span>
              <strong>{stats?.hazardCount ?? "-"}</strong>
            </div>
            <div>
              <span>Open</span>
              <strong>{stats?.openCount ?? "-"}</strong>
            </div>
            <div>
              <span>Closed</span>
              <strong>{stats?.closedCount ?? "-"}</strong>
            </div>
            <div>
              <span>Total Votes</span>
              <strong>{stats?.totalVotes ?? "-"}</strong>
            </div>
            <div>
              <span>Avg Risk</span>
              <strong>{stats?.avgRisk ?? "-"}</strong>
            </div>
            <div>
              <span>Max Risk</span>
              <strong>{stats?.maxRisk ?? "-"}</strong>
            </div>
            <div>
              <span>High Risk (70+)</span>
              <strong>{stats?.highRiskCount ?? "-"}</strong>
            </div>
            <div>
              <span>Last Activity</span>
              <strong>{toLocalTime(stats?.lastActivityTimestamp ?? null)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <article className="map-shell">
          <Suspense fallback={<div className="status">Loading map...</div>}>
            <CityPulseHeatmap
              bbox={bbox}
              refreshKey={refreshKey}
              minRisk={filter.minRisk}
              maxRisk={filter.maxRisk}
              category={filter.category}
              timeWindow={filter.timeWindow}
              includeClosed={filter.includeClosed}
              selectedPoint={reportPoint}
              reportedPoint={lastReportedPoint}
              focusPoint={mapFocusPoint}
              focusToken={mapFocusToken}
              resetViewToken={mapResetToken}
              onMapClick={(lat, lon) => {
                selectReportPoint({ lat, lon });
                setStatus(`Point selected: ${lat.toFixed(6)}, ${lon.toFixed(6)}. Open Report Hazard when ready.`);
              }}
            />
          </Suspense>
        </article>

        <aside className="side-stack">
          <section className="card table-card">
            <div className="row row-between">
              <h2>Hazard Feed</h2>
              <small>{loadingData ? "Loading..." : `${hazards.length} rows`}</small>
            </div>
            <div className="table-wrap">
              <table className="hazard-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Category</th>
                    <th>Risk</th>
                    <th>Votes</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hazards.map((hazard) => (
                    <tr key={hazard.id} className={selectedHazardId === hazard.id ? "selected-row" : undefined}>
                      <td>
                        <button
                          className="link-button"
                          type="button"
                          onClick={() => {
                            setSelectedHazardId(hazard.id);
                            selectReportPoint({ lat: hazard.lat, lon: hazard.lon });
                          }}
                        >
                          #{hazard.id}
                        </button>
                      </td>
                      <td>{prettyCategory(hazard.category)}</td>
                      <td>{hazard.risk}</td>
                      <td>
                        {hazard.upVotes}/{hazard.downVotes} ({hazard.totalVotes})
                      </td>
                      <td>{hazard.closed ? "Closed" : "Open"}</td>
                      <td>
                        <div className="row compact-row">
                          <button onClick={() => voteHazardById(hazard.id, "up")} disabled={!token || isBusy || hazard.closed}>
                            +
                          </button>
                          <button onClick={() => voteHazardById(hazard.id, "down")} disabled={!token || isBusy || hazard.closed}>
                            -
                          </button>
                          <button
                            onClick={() => closeHazardById(hazard.id)}
                            disabled={
                              !token ||
                              isBusy ||
                              hazard.closed ||
                              hazard.totalVotes < closeMinVotes ||
                              (hazard.createdBy?.toLowerCase() ?? "") !== walletAddress
                            }
                          >
                            Close
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card activity-card">
            <h2>Recent Activity</h2>
            <ul className="activity-list">
              {activity.map((item) => (
                <li key={item.id}>
                  <span>{new Date(item.created_at).toLocaleTimeString()}</span>
                  <strong>{formatActivityText(item)}</strong>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </section>

      <Suspense fallback={null}>
        <HazardReportModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={submitHazard}
          initialLat={reportPoint?.lat ?? defaultReportPoint.lat}
          initialLon={reportPoint?.lon ?? defaultReportPoint.lon}
        />
      </Suspense>
    </div>
  );
}
