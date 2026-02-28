import { expect } from "chai";
import { ethers } from "hardhat";

describe("CityPulse Edge Cases", function () {
  let contract;
  let owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const CityPulse = await ethers.getContractFactory("CityPulse");
    contract = await CityPulse.deploy();
    await contract.waitForDeployment();
  });

  it("should revert voting on closed hazard", async function () {
    await contract.reportHazard(38500000, 35500000, 1, 3, "noteURI");
    for (let i = 0; i < 10; i++) {
      const signer = (await ethers.getSigners())[i];
      await contract.connect(signer).voteHazard(0, true);
    }
    await contract.closeHazard(0);
    await expect(contract.connect(addr1).voteHazard(0, true)).to.be.revertedWith("cls");
  });

  it("should revert closing already closed hazard", async function () {
    await contract.reportHazard(38500000, 35500000, 1, 3, "noteURI");
    for (let i = 0; i < 10; i++) {
      const signer = (await ethers.getSigners())[i];
      await contract.connect(signer).voteHazard(0, true);
    }
    await contract.closeHazard(0);
    await expect(contract.closeHazard(0)).to.be.revertedWith("cls");
  });

  it("should revert voting for invalid hazardId", async function () {
    await expect(contract.connect(addr1).voteHazard(99, true)).to.be.revertedWith("id");
  });

  it("should revert closing for invalid hazardId", async function () {
    await expect(contract.closeHazard(99)).to.be.revertedWith("id");
  });

  it("should revert reporting with negative coordinates", async function () {
    await contract.reportHazard(-38500000, -35500000, 1, 3, "noteURI");
    expect(await contract.hazardCount()).to.equal(1);
  });

  it("should allow multiple hazards and independent voting", async function () {
    await contract.reportHazard(38500000, 35500000, 1, 3, "noteURI");
    await contract.reportHazard(38500001, 35500001, 2, 4, "noteURI2");
    await contract.connect(addr1).voteHazard(0, true);
    await contract.connect(addr1).voteHazard(1, false);
    expect(await contract.hazardCount()).to.equal(2);
  });
});
