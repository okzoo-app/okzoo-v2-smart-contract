import { formatEther, Signer } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

/**
 * Handles smart contract deployment, verification, and upgrade operations
 * using the Hardhat environment.
 */
export class ContractOperation {
    hre: HardhatRuntimeEnvironment;

    /**
     * Creates a new ContractOperation instance
     * @param hre The Hardhat Runtime Environment
     */
    constructor(hre: HardhatRuntimeEnvironment) {
        this.hre = hre;
    }

    /**
     * Deploys a proxy contract with initialization parameters
     * @param args Contract information including name and config path
     * @returns Updated contract information with deployed address
     */
    async deployProxy(args: ContractInfo): Promise<ContractInfo> {
        await printOwnerInfo(this.hre);
        const contractConfig = await loadContractConfig(args.configPath, args.contract);
        console.log("initialize contract with args: " + JSON.stringify(contractConfig));

        const ethers = this.hre.ethers;
        // Create and deploy proxy contract with initialization parameters
        const contractFactory = await ethers.getContractFactory(args.contract);
        const deployedContract = await this.hre.upgrades.deployProxy(contractFactory, contractConfig, {
            initializer: "initialize",
        });
        const contractAddr = await deployedContract.getAddress();
        return {
            contract: args.contract,
            address: contractAddr,
            configPath: args.configPath,
        };
    }

    /**
     * Verifies a deployed proxy contract on the blockchain explorer
     * @param args Contract information including address
     * @returns The same contract information
     */
    async verifyProxy(args: ContractInfo): Promise<ContractInfo> {
        await printOwnerInfo(this.hre);
        console.log("Verifying contract...", args.address);

        try {
            // Run verification through Hardhat's verify plugin
            const contract = await this.hre.run("verify:verify", {
                address: args.address,
                // force: true,}
            });
            console.log(contract);
        } catch (e) {
            console.error(e);
        }
        return args;
    }

    /**
     * Upgrades a proxy contract to a new implementation
     * @param args Contract information including address and contract name
     * @returns The same contract information
     */
    async upgradeProxy(args: ContractInfo): Promise<ContractInfo> {
        // Deploy new implementation contract
        await printOwnerInfo(this.hre);
        const contractFactory = await this.hre.ethers.getContractFactory(args.contract);

        if (args.force) {
            const proxy = await this.hre.upgrades.forceImport(args.address, contractFactory);
            await this.hre.upgrades.upgradeProxy(proxy, contractFactory);
        } else {
            await this.hre.upgrades.upgradeProxy(args.address, contractFactory);
        }

        // Get the address of the new implementation
        const implementationAddress = await this.hre.upgrades.erc1967.getImplementationAddress(args.address);
        console.log("Implementation address:", implementationAddress);
        return { ...args };
    }

    /**
     * Deploys a standard (non-proxy) contract
     * @param args Contract information including name and config path
     * @returns Updated contract information with deployed address
     */
    async deploy(args: ContractInfo): Promise<ContractInfo> {
        await printOwnerInfo(this.hre);
        const contractConfig = await loadContractConfig(args.configPath, args.contract);
        console.log("initialize contract with args: " + JSON.stringify(contractConfig));

        const deployedContract = await this.hre.ethers.deployContract(args.contract, contractConfig);
        await deployedContract.waitForDeployment();

        args.address = await deployedContract.getAddress();
        args.configPath = getConfigPath(args.configPath, args.contract);
        return args;
    }

    /**
     * Verifies a deployed token contract on the blockchain explorer
     * It is helpful when we need to verify a contract with a complex constructor arguments
     * @param args Contract information including address and contract name
     * @returns The same contract information
     */
    async verifyToken(args: ContractInfo): Promise<ContractInfo> {
        await printOwnerInfo(this.hre);
        args.configPath = getConfigPath(args.configPath, args.contract);
        const contractConfig = await loadContractConfig(args.configPath, args.contract);

        // Run verification through Hardhat's verify plugin
        await this.hre.run("verify:verify", {
            address: args.address,
            contract: `contracts/${args.contract}.sol:${args.contract}`,
            force: true,
            constructorArguments: contractConfig,
        });

        return args;
    }
}

/**
 * Information about a contract, including its name, address, and configuration path
 */
export type ContractInfo = {
    contract: string;
    address: string;
    configPath: string;
    force?: boolean;
};

/**
 * Loads contract configuration from the specified path or default location
 * @param configPath Path to the configuration file or null for default
 * @param contract The contract name
 * @returns Array of constructor arguments for the contract
 */
async function loadContractConfig(configPath: string, contract: string) {
    const realConfigPath = getConfigPath(configPath, contract);
    const configObject = (await import(realConfigPath)).default;
    const propertyValues = Object.keys(configObject).map((key) => configObject[key]);
    return propertyValues;
}

/**
 * Determines the configuration file path based on inputs or defaults
 * @param configPath User-provided config path or null
 * @param contract The contract name
 * @returns The resolved config path
 */
function getConfigPath(configPath: string, contract: string) {
    return configPath ?? `./configs/${contract}.ts`;
}

/**
 * Prints information about the deployer account including address and balance
 * @param hre The Hardhat Runtime Environment
 */
async function printOwnerInfo(hre: HardhatRuntimeEnvironment) {
    const ethers = hre.ethers;
    const accounts: Signer[] = await ethers.getSigners();
    const admin = await accounts[0].getAddress();
    console.log("ACCOUNT: " + admin);
    console.log("Balance:", formatEther(await ethers.provider.getBalance(admin)));
}
