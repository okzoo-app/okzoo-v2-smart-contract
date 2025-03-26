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
import "./hardhat.tasks.ts";

// import { parseEther } from "ethers";
dotenv.config();

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
            //         balance: parseEther("100").toString(),
            //     },
            // ],
        },
        arbitrum_sepolia: {
            url: `https://necessary-spring-rain.arbitrum-sepolia.quiknode.pro/fbabb4a72ef0be13432b40670c857b8f31915ddb/`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
        arbitrumOne: {
            url: `https://maximum-cool-bridge.arbitrum-mainnet.quiknode.pro/d10a1f4dc761c651165cf70d36896bb7004c5ee1/`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
        sepolia: {
            url: `https://newest-tame-pine.ethereum-sepolia.quiknode.pro/a0c357058af54201fb608b3d5a60ff2f3846b0f7/`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
        goerli: {
            url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
        mainnet: {
            url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
        mumbai: {
            url: `https://matic-mumbai.chainstacklabs.com/`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
        bsctestnet: {
            url: `https://data-seed-prebsc-1-s1.binance.org:8545/`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
        x1: {
            url: `https://195.rpc.thirdweb.com`,
            accounts: [`${process.env.PRIVATE_KEY}`],
            // gasPrice: 1000_000_000_000,
        },
        blast_sepolia: {
            url: `https://frosty-late-grass.blast-sepolia.quiknode.pro/71b5b373b064492aa05ea07f9fb8eb4578ebdff6/`,
            accounts: [`${process.env.PRIVATE_KEY}`],
            // gasPrice: 1000_000_000_000,
        },
        blast: {
            url: `https://convincing-evocative-darkness.blast-mainnet.quiknode.pro/52c5930e38dd6d9d3e4a47238f0583f1b5a03979/`,
            accounts: [`${process.env.PRIVATE_KEY}`],
            // gasPrice: 1000_000_000_000,
        },
        mantle_sepolia: {
            url: `https://twilight-winter-card.mantle-sepolia.quiknode.pro/ffbe1b254186be467972f8354149256d39835529/`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
        mantle: {
            url: `https://tiniest-sly-haze.mantle-mainnet.quiknode.pro/61f33fea8db3e85b2bbc758e8fe9fbafac6f4e00/`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
        bsc: {
            // url: `https://thrumming-aged-friday.bsc.quiknode.pro/782e14349ccbf2b4c8c82024abcc5fda15e26f52/`,
            // url: `https://binance.llamarpc.com`,
            url: `https://rpc.ankr.com/bsc`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
    },
    etherscan: {
        apiKey: {
            goerli: `${process.env.ETHERSCAN_KEY}`,
            sepolia: `${process.env.ETHERSCAN_KEY}`,
            bsc: `${process.env.BSCSCAN_KEY}`,
            bscTestnet: `${process.env.BSCSCAN_KEY}`,
            polygonMumbai: `${process.env.POLYGONSCAN_KEY}`,
            mainnet: `${process.env.ETHERSCAN_KEY}`,
            bsctestnet: `${process.env.BSCSCAN_KEY}`,
            polygonMainnet: `${process.env.POLYGONSCAN_KEY}`,
            arbitrumOne: `${process.env.ARBITRUM_KEY}`,
            arbitrum_sepolia: `${process.env.ARBITRUM_KEY}`,
            "x1-testnet": `${process.env.X1TESTNET_KEY}`,
            blast_sepolia: `${process.env.BLAST_SEPOLIA_KEY}`,
            mantle_sepolia: `${process.env.MANTLE_SEPOLIA_KEY}`,
            mantle: `${process.env.MANTLE_SEPOLIA_KEY}`,
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
            {
                network: "arbitrum_sepolia",
                chainId: 421614,
                urls: {
                    apiURL: "https://api-sepolia.arbiscan.io/api",
                    browserURL: "https://sepolia.arbiscan.io",
                },
            },
            {
                network: "arbitrumOne",
                chainId: 42161,
                urls: {
                    apiURL: "https://api.arbiscan.io/api",
                    browserURL: "https://arbiscan.io",
                },
            },
            {
                network: "x1-testnet",
                chainId: 195,
                urls: {
                    apiURL: "https://www.oklink.com/api",
                    browserURL: "https://www.oklink.com/vi/x1-test",
                },
            },
            {
                network: "blast_sepolia",
                chainId: 168587773,
                urls: {
                    apiURL: "https://api-sepolia.blastscan.io/api",
                    browserURL: "https://sepolia.blastscan.io",
                },
            },
            {
                network: "mantle_sepolia",
                chainId: 5003,
                urls: {
                    apiURL: "https://explorer.sepolia.mantle.xyz/api",
                    browserURL: "https://explorer.sepolia.mantle.xyz",
                },
            },
            {
                network: "mantle",
                chainId: 5000,
                urls: {
                    apiURL: "https://explorer.mantle.xyz/api",
                    browserURL: "https://explorer.mantle.xyz",
                },
            },
        ],
    },
    solidity: {
        compilers: [
            {
                version: "0.8.18",
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
        src: "./contracts",
    },
    typechain: {
        outDir: "typechain-types",
        target: "ethers-v6",
    },
};

module.exports = config;
