import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";

const localRpcUrl = process.env.LOCAL_RPC_URL ?? "http://127.0.0.1:8545";
const monadRpcUrl = process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    localhost: {
      url: localRpcUrl,
    },
    monadTestnet: {
      url: monadRpcUrl,
      chainId: 10143,
      accounts,
    }
  }
};

export default config;
