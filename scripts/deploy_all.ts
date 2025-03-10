import * as hre from "hardhat";
import * as fs from "fs";
import { formatEther, Signer } from "ethers";
const ethers = hre.ethers;
import { Config, ConfigToken } from "./config";

import { Staking__factory } from "../typechain-types";

async function main() {
    //Loading accounts
    const accounts: Signer[] = await ethers.getSigners();
    const admin = await accounts[0].getAddress();
    //Loading contracts' factory

    const Staking: Staking__factory = await ethers.getContractFactory("Staking");

    // Deploy contracts
    console.log("==================================================================");
    console.log("DEPLOY CONTRACTS");
    console.log("==================================================================");

    console.log("ACCOUNT: " + admin);
    console.log(formatEther(await ethers.provider.getBalance(admin)));

    const erc20 = await hre.ethers.deployContract("ERC20Token", [
        ConfigToken.name,
        ConfigToken.symbol,
        ConfigToken.mintAmount,
        ConfigToken.recipient,
    ]);
    await erc20.waitForDeployment();

    const stakingTokenAddress = await erc20.getAddress();
    console.log("staking token deployed at: ", stakingTokenAddress);

    const staking = await hre.upgrades.deployProxy(Staking, [
        stakingTokenAddress,
        Config.unstakeLockTime,
        Config.owner,
    ]);

    const stakingAddress = await staking.getAddress();
    console.log("staking deployed at: ", stakingAddress);

    const contractAddress = {
        stakingToken: stakingTokenAddress,
        staking: stakingAddress,
    };

    fs.writeFileSync("contracts.json", JSON.stringify(contractAddress));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
