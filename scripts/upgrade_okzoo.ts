import * as hre from "hardhat";
import * as fs from "fs";
import { OkzooV2__factory } from "../typechain-types";

async function main() {
    // Load the existing proxy address
    const contractAddress = JSON.parse(fs.readFileSync("contracts-okzoo.json", "utf8"));
    const proxyAddress = contractAddress.okzoo;

    // Get the contract factory
    const OkzooV2: OkzooV2__factory = await hre.ethers.getContractFactory("OkzooV2");

    // Force import the existing proxy
    console.log("Force importing existing proxy at:", proxyAddress);
    await hre.upgrades.forceImport(proxyAddress, OkzooV2);

    // Deploy the new implementation
    console.log("Deploying new implementation... proxyAddress:", proxyAddress);
    await hre.upgrades.upgradeProxy(proxyAddress, OkzooV2);
    const implementationAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Implementation address:", implementationAddress);

    console.log("UpgradeProxy completed");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
