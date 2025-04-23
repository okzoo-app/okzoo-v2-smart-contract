import "./hardhat.tasks.ts";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import "@nomiclabs/hardhat-solhint";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage";
import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/types";
import "hardhat-docgen";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "hardhat-tracer";
import "hardhat-log-remover";

// import { parseEther } from "ethers";
dotenv.config();

// for prod, private key should be stored in variable config rather .env to reduces key leak risk
const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            accounts: { count: 100 },
            // forking: {
            //     url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
            //     blockNumber: 19189406,
            // },
            // accounts: [
            //     {
            //         privateKey: `${process.env.PRIVATE_KEY}`,
            //         balance: parseEther("0.6").toString(),
            //     },
            // ],
        },

        bscTestnet: {
            url: `https://data-seed-prebsc-1-s1.binance.org:8545/`,
            // accounts: [`${process.env.PRIVATE_KEY}`],
        },

        bsc: {
            // url: `https://thrumming-aged-friday.bsc.quiknode.pro/782e14349ccbf2b4c8c82024abcc5fda15e26f52/`,
            // url: `https://binance.llamarpc.com`,
            url: `https://rpc.ankr.com/bsc/${process.env.RPC_ANKR_KEY}`,
            //accounts: [`${process.env.PRIVATE_KEY}`],
        },
    },
    etherscan: {
        // apiKey: {},
        apiKey: {
            bscTestnet: `${process.env.BSCSCAN_KEY}`,
        },
        customChains: [
            {
                network: "bsc",
                chainId: 0x38,
                urls: {
                    apiURL: "https://api.bscscan.com/api",
                    browserURL: "https://bscscan.com",
                },
            },
        ],
    },
    solidity: {
        compilers: [
            {
                version: "0.8.28",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                        details: {
                            yul: true,
                        },
                    },
                    viaIR: false,
                },
            },
            {
                version: "0.8.20",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                        details: {
                            yul: true,
                        },
                    },
                    viaIR: false,
                },
            },
        ],
    },
    paths: {
        sources: "./contracts",
        tests: "./tests",
        cache: "./cache",
        artifacts: "./artifacts",
    },
    mocha: {
        timeout: 200000,
        reporter: "mocha-multi-reporters",
        reporterOptions: {
            configFile: "./mocha-report.json",
        },
    },
    docgen: {
        path: "./docs",
        clear: true,
        runOnCompile: false,
    },
    contractSizer: {
        alphaSort: true,
        runOnCompile: true,
        disambiguatePaths: false,
    },
    gasReporter: {
        currency: "ETH",
        gasPrice: 10,
        enabled: process.env.REPORT_GAS ? true : false,
        excludeContracts: [],
        // src: "./contracts",
    },
    typechain: {
        outDir: "typechain-types",
        target: "ethers-v6",
    },
};
export default config;
