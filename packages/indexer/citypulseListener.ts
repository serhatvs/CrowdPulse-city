import "../../scripts/load-env";
import { ethers } from "ethers";
import { createHazard, pool } from "../../apps/api/db";

if (!process.env.RPC_URL || !process.env.CONTRACT_ADDRESS) {
  throw new Error("RPC_URL ve CONTRACT_ADDRESS gerekli");
}

const abi = [
  "event HazardReported(uint256 indexed hazardId, int32 latE6, int32 lonE6, uint8 category, uint8 severity, address reporter, string noteURI)",
  "event HazardVoted(uint256 indexed hazardId, address indexed voter, bool up)",
  "event HazardClosed(uint256 indexed hazardId)",
];

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, provider);
const pollIntervalMs = Math.max(2_000, Number(process.env.INDEXER_POLL_INTERVAL_MS ?? 8_000));
const batchBlocks = Math.max(1, Math.min(100, Number(process.env.INDEXER_BATCH_BLOCKS ?? 100)));
const backfillBlocks = Math.max(0, Number(process.env.INDEXER_BACKFILL_BLOCKS ?? 100));
const startBlockRaw = process.env.INDEXER_START_BLOCK?.trim() ?? "";
const configuredStartBlock = startBlockRaw ? Number(startBlockRaw) : Number.NaN;

type IndexedEvent = {
  blockNumber: number;
  index: number;
  kind: "reported" | "voted" | "closed";
  args: ethers.Result;
};

function normalizeIndex(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function toIndexedEvent(
  kind: IndexedEvent["kind"],
  event: ethers.Log | ethers.EventLog,
): IndexedEvent | null {
  if (!("args" in event)) {
    return null;
  }
  return {
    blockNumber: event.blockNumber,
    index: normalizeIndex(event.index),
    kind,
    args: event.args,
  };
}

async function applyReportedEvent(args: ethers.Result): Promise<void> {
  const [hazardId, latE6, lonE6, category, severity, reporter] = args;
  try {
    await createHazard({
      lat: Number(latE6) / 1e6,
      lon: Number(lonE6) / 1e6,
      type: String(category),
      created_by: String(reporter).toLowerCase(),
      category: Number(category),
      severity: Number(severity),
      chain_hazard_id: Number(hazardId),
    });
  } catch (error) {
    console.error("DB insert error (HazardReported)", error);
  }
}

async function applyVotedEvent(args: ethers.Result): Promise<void> {
  const [hazardId, voter, up] = args;
  try {
    const value = up ? 1 : -1;
    await pool.query(
      `INSERT INTO votes (hazard_id, voter, value)
       SELECT id, $2, $3 FROM hazards
       WHERE chain_hazard_id = $1
       ON CONFLICT (hazard_id, voter) DO NOTHING`,
      [Number(hazardId), String(voter).toLowerCase(), value],
    );
  } catch (error) {
    console.error("HazardVoted DB hatasi:", error);
  }
}

async function applyClosedEvent(args: ethers.Result): Promise<void> {
  const [hazardId] = args;
  try {
    await pool.query("UPDATE hazards SET closed = true WHERE chain_hazard_id = $1", [Number(hazardId)]);
  } catch (error) {
    console.error("DB update error (HazardClosed)", error);
  }
}

async function syncBlockRange(fromBlock: number, toBlock: number): Promise<void> {
  if (fromBlock > toBlock) {
    return;
  }

  const [reportedEvents, votedEvents, closedEvents] = await Promise.all([
    contract.queryFilter(contract.filters.HazardReported(), fromBlock, toBlock),
    contract.queryFilter(contract.filters.HazardVoted(), fromBlock, toBlock),
    contract.queryFilter(contract.filters.HazardClosed(), fromBlock, toBlock),
  ]);

  const events: IndexedEvent[] = [
    ...reportedEvents.map((event) => toIndexedEvent("reported", event)),
    ...votedEvents.map((event) => toIndexedEvent("voted", event)),
    ...closedEvents.map((event) => toIndexedEvent("closed", event)),
  ]
    .filter((event): event is IndexedEvent => event !== null)
    .sort((left, right) => left.blockNumber - right.blockNumber || left.index - right.index);

  for (const event of events) {
    if (event.kind === "reported") {
      await applyReportedEvent(event.args);
      continue;
    }
    if (event.kind === "voted") {
      await applyVotedEvent(event.args);
      continue;
    }
    await applyClosedEvent(event.args);
  }
}

async function startIndexer(): Promise<void> {
  const latestBlock = await provider.getBlockNumber();
  const requestedStart = Number.isFinite(configuredStartBlock) && configuredStartBlock >= 0
    ? Math.floor(configuredStartBlock)
    : Math.max(0, latestBlock - backfillBlocks);

  let lastProcessedBlock = requestedStart - 1;
  let syncing = false;

  console.log(
    `[indexer] polling ${process.env.CONTRACT_ADDRESS} on ${process.env.RPC_URL} from block ${requestedStart} every ${pollIntervalMs}ms`,
  );

  async function poll(): Promise<void> {
    if (syncing) {
      return;
    }
    syncing = true;
    try {
      const chainHead = await provider.getBlockNumber();
      let nextFrom = lastProcessedBlock + 1;
      while (nextFrom <= chainHead) {
        const nextTo = Math.min(chainHead, nextFrom + batchBlocks - 1);
        await syncBlockRange(nextFrom, nextTo);
        lastProcessedBlock = nextTo;
        nextFrom = nextTo + 1;
      }
    } catch (error) {
      console.error("[indexer] poll failed:", error);
    } finally {
      syncing = false;
    }
  }

  await poll();
  setInterval(() => {
    void poll();
  }, pollIntervalMs);
}

startIndexer().catch((error) => {
  console.error("[indexer] fatal:", error);
  process.exit(1);
});
