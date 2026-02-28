import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const CityPulse = await ethers.getContractFactory("CityPulse");
  const contract = await CityPulse.deploy();
  await contract.waitForDeployment();
  const network = await ethers.provider.getNetwork();
  const deployerAddress = await deployer.getAddress();
  console.log("Deploy network:", `${network.name} (${network.chainId.toString()})`);
  console.log("Deploy signer:", deployerAddress);
  console.log("CityPulse deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
