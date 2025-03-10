import * as hre from "hardhat";
import * as fs from "fs";
import { formatEther, Signer } from "ethers";
const ethers = hre.ethers;

import { OkzooV2__factory } from "../typechain-types";
import { ConfigOkzooV2 } from "./config";

async function main() {
    //Loading accounts
    const accounts: Signer[] = await ethers.getSigners();
    const admin = await accounts[0].getAddress();
    //Loading contracts' factory

    const OkzooV2: OkzooV2__factory = await ethers.getContractFactory("OkzooV2");

    // Deploy contracts
    console.log("==================================================================");
    console.log("DEPLOY CONTRACTS");
    console.log("==================================================================");

    console.log("ACCOUNT: " + admin);
    console.log(formatEther(await ethers.provider.getBalance(admin)));

    const okzoo = await hre.upgrades.deployProxy(
        OkzooV2,
        [ConfigOkzooV2.owner, ConfigOkzooV2.verifier, ConfigOkzooV2.domain, ConfigOkzooV2.version],
        { initializer: "initialize" },
    );

    const okzooAddress = await okzoo.getAddress();
    console.log("okzoo deployed at: ", okzooAddress);

    const contractAddress = {
        okzoo: okzooAddress,
    };

    fs.writeFileSync("contracts-okzoo.json", JSON.stringify(contractAddress));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
