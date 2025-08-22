import * as fs from "fs";
import { extendEnvironment, task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import path from "path";
import { ContractInfo, ContractOperation } from "./scripts/contract-operation";
import { getConfiguredVar } from "./scripts/util";

// additional settings
extendEnvironment((hre: HardhatRuntimeEnvironment) => {
    // For local development, we dont need to specify the private key
    if (hre.network.name !== "hardhat") {
        const account = getConfiguredVar("PRIVATE_KEY"); // owner account
        hre.config.networks[hre.network.name].accounts = [account];
    }
    const apiKeyObj = hre.config.etherscan.apiKey;

    // @ts-expect-error - Network name is dynamically assigned
    if (!apiKeyObj[hre.network.name]) {
        const apiKey = getConfiguredVar("ETHERSCAN_KEY");
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
        // compile before deploy/upgrade
        hre.run("compile");

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
        // compile before deploy/upgrade
        hre.run("compile");

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
        // compile before deploy/upgrade
        hre.run("compile");

        const operation = new ContractOperation(hre);
        const deployedContract = await operation.deploy(args);

        console.log("Contract is deployed at: ", deployedContract);
        // Log upgrade details to contracts.json
        logContractAction({ ...deployedContract, action: taskName, networkName: hre.network.name });
    });

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

// Task: Call a read-only function
task("call", "Call a read-only function")
    .addParam("contract", "Contract name")
    .addParam("address", "Contract address")
    .addParam("method", "Method name")
    .addParam("args", "JSON array of arguments")
    .setAction(async (args, hre) => {
        try {
            const contract = await hre.ethers.getContractAt(args.contract, args.address);

            // Check if the method exists on the contract
            if (!(args.method in contract)) {
                console.error(`Method '${args.method}' does not exist on contract '${args.contract}'`);
                return;
            }

            const result = await contract[args.method as keyof typeof contract](...JSON.parse(args.args));
            console.log("Result:", result);
        } catch (error: unknown) {
            const err = error as { code?: string; value?: string; message?: string };
            if (err.code === "BAD_DATA" && err.value === "0x") {
                console.error(`Method '${args.method}' returned empty data. This could mean:`);
                console.error(`1. The method doesn't exist on the contract at address ${args.address}`);
                console.error(`2. The method exists but returns no data`);
                console.error(`3. The contract at ${args.address} is not a valid ${args.contract} contract`);
            } else {
                console.error("Error calling contract method:", err.message || "Unknown error");
            }
        }
    });

// Task: Call a write function (transaction)
task("write", "Call a write function (transaction)")
    .addParam("contract", "Contract name")
    .addParam("address", "Contract address")
    .addParam("method", "Method name")
    .addParam("args", "JSON array of arguments")
    .addOptionalParam("gasLimit", "Gas limit for the transaction", "3000000")
    .addOptionalParam("gasPrice", "Gas price in wei", "auto")
    .setAction(async (args, hre) => {
        try {
            const [signer] = await hre.ethers.getSigners();
            const contract = await hre.ethers.getContractAt(args.contract, args.address, signer);

            // Check if the method exists on the contract
            if (!(args.method in contract)) {
                console.error(`Method '${args.method}' does not exist on contract '${args.contract}'`);
                return;
            }

            const parsedArgs = JSON.parse(args.args);
            console.log(`Calling ${args.method} with args:`, parsedArgs);

            // Prepare transaction options
            const txOptions: { gasLimit: number; gasPrice?: bigint } = {
                gasLimit: parseInt(args.gasLimit),
            };

            // Set gas price if specified
            if (args.gasPrice !== "auto") {
                txOptions.gasPrice = hre.ethers.parseUnits(args.gasPrice, "wei");
            }

            // Call the write function
            const tx = await contract[args.method as keyof typeof contract](...parsedArgs, txOptions);
            console.log(`Transaction hash: ${tx.hash}`);
            console.log("Waiting for transaction confirmation...");

            // Wait for transaction to be mined
            const receipt = await tx.wait();
            console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
            console.log(`Gas used: ${receipt?.gasUsed?.toString()}`);

            // Check if transaction was successful
            if (receipt?.status === 1) {
                console.log("✅ Transaction successful!");
            } else {
                console.log("❌ Transaction failed!");
            }
        } catch (error: unknown) {
            const err = error as { code?: string; message?: string; reason?: string };

            if (err.code === "INSUFFICIENT_FUNDS") {
                console.error("❌ Insufficient funds for transaction");
            } else if (err.code === "UNPREDICTABLE_GAS_LIMIT") {
                console.error("❌ Gas limit too low or function call will revert");
                console.error("Try increasing the gas limit or check if the function call is valid");
            } else if (err.code === "NONCE_EXPIRED") {
                console.error("❌ Nonce expired. Try again with a new transaction");
            } else if (err.reason) {
                console.error(`❌ Transaction reverted: ${err.reason}`);
            } else {
                console.error("❌ Error calling contract method:", err.message || "Unknown error");
            }
        }
    });
