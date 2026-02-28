import "../../scripts/load-env";
import { ethers } from "ethers";

const abi = [
  "event HazardReported(uint256 indexed hazardId, int32 latE6, int32 lonE6, uint8 category, uint8 severity, address reporter, string noteURI)",
  "event HazardVoted(uint256 indexed hazardId, address indexed voter, bool up)",
  "event HazardClosed(uint256 indexed hazardId)",
  "function reportHazard(int32 latE6, int32 lonE6, uint8 category, uint8 severity, string noteURI)",
  "function voteHazard(uint256 hazardId, bool up)",
  "function closeHazard(uint256 hazardId)"
];



function getContract() {
  if (!process.env.RPC_URL || !process.env.PRIVATE_KEY || !process.env.CONTRACT_ADDRESS) {
    throw new Error("Blockchain env değişkenleri eksik: RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS");
  }
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, signer);
}

export async function reportHazardOnChain(latE6: number, lonE6: number, category: number, severity: number, noteURI: string) {
  const contract = getContract();
  const tx = await contract.reportHazard(latE6, lonE6, category, severity, noteURI);
  return tx.wait();
}

export async function voteHazardOnChain(hazardId: number, up: boolean) {
  const contract = getContract();
  const tx = await contract.voteHazard(hazardId, up);
  return tx.wait();
}

export async function closeHazardOnChain(hazardId: number) {
  const contract = getContract();
  const tx = await contract.closeHazard(hazardId);
  return tx.wait();
}
