import * as fs from "fs";
import { extendEnvironment, task, vars } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import path from "path";
import { ContractInfo, ContractOperation } from "./scripts/contract-operation";

// additional settings
extendEnvironment((hre: HardhatRuntimeEnvironment) => {
    const account = getConfiguredVar("PRIVATE_KEY"); // owner account
    hre.config.networks[hre.network.name].accounts = [account];

    const apiKeyObj = hre.config.etherscan.apiKey;
    // @ts-expect-error - Network name is dynamically assigned
    if (!apiKeyObj[hre.network.name]) {
        const apiKey = getConfiguredVar("API_KEY");
        // @ts-expect-error - Network name is dynamically assigned
        apiKeyObj[hre.network.name] = apiKey;
    }
});
// Task: Deploy a new upgradeable contract using OpenZeppelin's proxy pattern
task("deployProxy", "Deploy a contract in using proxy pattern (openzepellin EIP712Upgradeable)")
    .addParam("contract", "The contract name to deploy")
    .addOptionalParam("configPath", "Path to contract config object")
    .setAction(async (args: ContractInfo, hre) => {
        console.log("DEPLOY CONTRACTS: ", args.contract);
        const taskName = "deployProxy";

        const operation = new ContractOperation(hre);
        const deployedContract = await operation.deployProxy(args);
        console.log("Contract is deployed at: ", deployedContract.address);

        // Log deployment details to contracts.json
        logContractAction({ ...deployedContract, action: taskName, networkName: hre.network.name });
    });

// Task: Verify deployed contract on block explorer (e.g. Etherscan)
task("verifyProxy", "Verify a upgradeable contract")
    .addParam("address", "The contract address to verify")
    .setAction(async (args: ContractInfo, hre) => {
        const taskName = "verifyProxy";
        const operation = new ContractOperation(hre);
        const deployedContract = await operation.verifyProxy(args);
        console.log("Contract is deployed at: ", deployedContract);

        // Log verification details to contracts.json
        logContractAction({ ...deployedContract, action: taskName, networkName: hre.network.name });
    });
// // Task: Verify deployed contract on block explorer (e.g. Etherscan)
task("verifyToken", "Verify a Token contract")
    .addParam("address", "The contract address to verify")
    .addParam("contract", "The contract  to verify")
    .setAction(async (args: ContractInfo, hre) => {
        const taskName = "verifyToken";
        const operation = new ContractOperation(hre);
        const deployedContract = await operation.verifyToken(args);
        // Log verification details to contracts.json
        console.log("Contract is deployed at: ", deployedContract);
        logContractAction({ ...deployedContract, action: taskName, networkName: hre.network.name });
    });
//
// Task: Upgrade an existing proxy contract to a new implementation
task("upgradeProxy", "upgrades a contract")
    .addParam("contract", "The contract name to upgrade")
    .addParam("address", "The contract address to upgrade")
    .addFlag("force", "Force upgrare even if contract was not registered")
    .setAction(async (args: ContractInfo, hre) => {
        const taskName = "upgradeProxy";

        const operation = new ContractOperation(hre);
        const deployedContract = await operation.upgradeProxy(args);
        console.log("Contract is upgraded at: ", deployedContract);

        // Log upgrade details to contracts.json
        logContractAction({ ...deployedContract, action: taskName, networkName: hre.network.name });
    });
//
// // Task: Deploy a new upgradeable contract using OpenZeppelin's proxy pattern
task("deploy", "Deploy a normal contract")
    .addParam("contract", "The contract name to deploy")
    .addOptionalParam("configPath", "Path to contract config object")
    .setAction(async (args: ContractInfo, hre) => {
        const taskName = "deploy";

        const operation = new ContractOperation(hre);
        const deployedContract = await operation.deploy(args);

        console.log("Contract is deployed at: ", deployedContract);
        // Log upgrade details to contracts.json
        logContractAction({ ...deployedContract, action: taskName, networkName: hre.network.name });
    });

// Helper: get value for a var, either from env or vars setting
function getConfiguredVar(key: string) {
    let account = process.env[key] || "";
    if (!account) {
        // try to get from var config if not found in env
        account = vars.get(key, "");
    }
    return account;
}

// Helper: Log contract deployment/verification/upgrade details to contracts.json
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logContractAction(args: any) {
    const contractsFilePath = path.resolve(__dirname, "contracts.json");
    let contracts = [];

    // Load existing contracts if file exists
    if (fs.existsSync(contractsFilePath)) {
        contracts = JSON.parse(fs.readFileSync(contractsFilePath, "utf8"));
    }

    // Add new entry with timestamp
    contracts.push(args);
    args.timestamp = new Date().toISOString();

    // Write updated contracts list back to file
    fs.writeFileSync(contractsFilePath, JSON.stringify(contracts, null, 2));
}
