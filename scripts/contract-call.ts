import { ethers } from "hardhat";

/**
 * Call a function of a deployed smart contract
 * Usage:
 *   npx hardhat run scripts/callContract.ts --network <network> \
 *     --contract <ContractName> \
 *     --address <DeployedAddress> \
 *     --method <methodName> \
 *     --args "[\"arg1\", 123, true]"
 */
async function main() {
    const contractName = getArg("--contract");
    const contractAddress = getArg("--address");
    const methodName = getArg("--method");
    const argsRaw = getArg("--args") || "[]";

    const args = JSON.parse(argsRaw);

    if (!contractName || !contractAddress || !methodName) {
        throw new Error("Missing required arguments: --contract, --address, --method");
    }

    const contractFactory = await ethers.getContractFactory(contractName);
    const contract = contractFactory.attach(contractAddress);

    if (typeof contract[methodName as keyof typeof contract] !== "function") {
        throw new Error(`Method ${methodName} not found on contract ${contractName}`);
    }

    const result = await contract[methodName as keyof typeof contract](...args);
    console.log("Result:", result);
}

function getArg(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    if (index >= 0 && index + 1 < process.argv.length) {
        return process.argv[index + 1];
    }
    return undefined;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
