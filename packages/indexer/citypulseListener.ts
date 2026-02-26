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

// Event listener
function listenCityPulseEvents() {
  contract.on("HazardReported", (hazardId, latE6, lonE6, category, severity, reporter, noteURI, event) => {
    console.log("HazardReported", {
      hazardId,
      latE6,
      lonE6,
      category,
      severity,
      reporter,
      noteURI,
      blockNumber: event.blockNumber
    });
    // Burada DB'ye kaydedebilir veya indexleyebilirsiniz
  });

  contract.on("HazardVoted", (hazardId, voter, up, event) => {
    console.log("HazardVoted", {
      hazardId,
      voter,
      up,
      blockNumber: event.blockNumber
    });
    // Burada DB güncelleyebilirsiniz
  });

  contract.on("HazardClosed", (hazardId, event) => {
    console.log("HazardClosed", {
      hazardId,
      blockNumber: event.blockNumber
    });
    // Burada DB'de hazard'ı kapatabilirsiniz
  });
}

listenCityPulseEvents();

// Not: .env dosyanızda RPC_URL ve CONTRACT_ADDRESS tanımlı olmalı.
