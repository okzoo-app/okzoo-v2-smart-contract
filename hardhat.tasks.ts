import { Signer, formatEther } from "ethers";
import { task } from "hardhat/config";
import * as fs from "fs";
import path from "path";
// import * as hre from "hardhat";

task("balance", "Prints an account's balance")
    .addParam("acc")

    .setAction(async (args: unknown) => {
        console.log("Hello, world!!!" + JSON.stringify(args));
    });

task("deployProxy", "Deploy a contract in using proxy pattern (openzepellin EIP712Upgradeable)")
    .addParam("contract", "The contract name to deploy")
    .addOptionalParam("configPath", "Path to contract config object")
    .setAction(async (args: { contract: string; configPath: string }, hre) => {
        const contractName = args.contract;
        const ethers = hre.ethers;
        console.log("==================================================================");
        console.log("DEPLOY CONTRACTS: ", contractName);
        console.log("==================================================================");

        // print deployer information
        const accounts: Signer[] = await ethers.getSigners();
        const admin = await accounts[0].getAddress();
        console.log("ACCOUNT: " + admin);
        console.log("Balance:", formatEther(await ethers.provider.getBalance(admin)));

        // Determine the Contract config
        const configPath = args.configPath ?? `./scripts/configs/${args.contract}.ts`;
        const configObject = (await import(configPath)).default;
        const propertyValues = Object.keys(configObject).map((key) => configObject[key]);
        console.log("initialize contract with args: " + JSON.stringify(propertyValues)); // Logs an array of property values in declaration order

        //Deploy the contract
        const contractFactory = await ethers.getContractFactory(args.contract);

        const okzoo = await hre.upgrades.deployProxy(contractFactory, propertyValues, { initializer: "initialize" });

        const okzooAddress = await okzoo.getAddress();
        console.log("okzoo deployed at: ", okzooAddress);

        // Load existing contracts from file
        const contractsFilePath = path.resolve(__dirname, "contracts.json");
        let contracts = [];
        if (fs.existsSync(contractsFilePath)) {
            contracts = JSON.parse(fs.readFileSync(contractsFilePath, "utf8"));
        }

        // Add new contract entry
        contracts.push({ name: contractName, address: okzooAddress, timestamp: new Date() });

        // Save updated contracts back to file
        fs.writeFileSync(contractsFilePath, JSON.stringify(contracts, null, 2));
    });
