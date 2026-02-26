import { ethers } from "ethers";

// CityPulse ABI (kısaltılmış, sadece eventler)
const abi = [
  "event HazardReported(uint256 indexed hazardId, int32 latE6, int32 lonE6, uint8 category, uint8 severity, address reporter, string noteURI)",
  "event HazardVoted(uint256 indexed hazardId, address indexed voter, bool up)",
  "event HazardClosed(uint256 indexed hazardId)"
];

// Ağ ve sözleşme adresi
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, provider);


import { createHazard, pool } from "../../apps/api/db";

function listenCityPulseEvents() {
  contract.on("HazardReported", async (hazardId, latE6, lonE6, category, severity, reporter, noteURI, event) => {
    try {
      await createHazard({
        lat: Number(latE6) / 1e6,
        lon: Number(lonE6) / 1e6,
        type: String(category),
        created_by: reporter,
        category: Number(category),
        severity: Number(severity)
      });
    } catch (e) {
      console.error("DB insert error (HazardReported)", e);
    }
  });

  contract.on("HazardClosed", async (hazardId, event) => {
    try {
      await pool.query(
        'UPDATE hazards SET closed=true WHERE chain_hazard_id=$1',
        [Number(hazardId)]
      );
    } catch (e) {
      console.error("DB update error (HazardClosed)", e);
    }
  });
}

listenCityPulseEvents();

// Not: .env dosyanızda RPC_URL ve CONTRACT_ADDRESS tanımlı olmalı.
