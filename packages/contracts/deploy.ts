import { ethers } from "hardhat";

async function main() {
  const CityPulse = await ethers.getContractFactory("CityPulse");
  const contract = await CityPulse.deploy();
  await contract.deployed();
  console.log("CityPulse deployed to:", contract.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
