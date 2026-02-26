import { expect } from "chai";
import { ethers } from "hardhat";

describe("CityPulse", function () {
  let contract;
  let owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const CityPulse = await ethers.getContractFactory("CityPulse");
    contract = await CityPulse.deploy();
    await contract.waitForDeployment();
  });

  it("should report hazard", async function () {
    await contract.reportHazard(38500000, 35500000, 1, 3, "noteURI");
    expect(await contract.hazardCount()).to.equal(1);
  });

  it("should allow voting and prevent double voting", async function () {
    await contract.reportHazard(38500000, 35500000, 1, 3, "noteURI");
    await contract.connect(addr1).voteHazard(0, true);
    await contract.connect(addr2).voteHazard(0, false);
    await expect(contract.connect(addr1).voteHazard(0, true)).to.be.revertedWith("dv");
  });

  it("should close hazard after enough votes", async function () {
    await contract.reportHazard(38500000, 35500000, 1, 3, "noteURI");
    for (let i = 0; i < 10; i++) {
      const signer = (await ethers.getSigners())[i];
      await contract.connect(signer).voteHazard(0, true);
    }
    await contract.closeHazard(0);
    const hazard = await contract.hazards(0);
    expect(hazard.closed).to.be.true;
  });

  it("should revert close if not enough votes", async function () {
    await contract.reportHazard(38500000, 35500000, 1, 3, "noteURI");
    await contract.connect(addr1).voteHazard(0, true);
    await expect(contract.closeHazard(0)).to.be.revertedWith("th");
  });

  it("should revert on invalid severity", async function () {
    await expect(contract.reportHazard(38500000, 35500000, 1, 0, "noteURI")).to.be.revertedWith("sev");
    await expect(contract.reportHazard(38500000, 35500000, 1, 6, "noteURI")).to.be.revertedWith("sev");
  });
});
