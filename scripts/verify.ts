import * as hre from "hardhat";
// import * as contracts from "../contracts.json";
import * as contractOkzoo from "../contracts-okzoo.json";
// import { Config, ConfigToken } from "./config";

async function main() {
    try {
        // await hre.run("verify:verify", {
        //     address: contracts.stakingToken,
        //     contract: "contracts/ERC20Token.sol:ERC20Token",
        //     constructorArguments: [ConfigToken.name, ConfigToken.symbol, ConfigToken.mintAmount, ConfigToken.recipient],
        //     hre,
        // });
        // await hre.run("verify:verify", {
        //     address: contracts.staking,
        //     hre,
        // });
        await hre.run("verify:verify", {
            address: contractOkzoo.okzoo,
            hre,
        });
    } catch (err) {
        console.log("err >>", err);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
