import { ethers } from "hardhat";
import { formatEther, parseEther, TransactionRequest } from "ethers";
import * as fs from "fs";
import { TransferResult } from "./advanced-batch-transfer";

interface TransferData {
    to: string;
    amount: string;
}

interface TransferConfig {
    tokenAddress: string;
    transfers: TransferData[];
    gasLimit?: number;
    gasPrice?: string;
}

/**
 * Simple Batch Transfer Script
 *
 * Usage:
 * 1. Create a JSON file with transfer data
 * 2. Run: npx hardhat run scripts/simple-batch-transfer.ts --network <network>
 *
 * Example JSON file (transfers.json):
 * {
 *   "tokenAddress": "0x...",
 *   "transfers": [
 *     { "to": "0x1234...", "amount": "100.5" },
 *     { "to": "0x5678...", "amount": "50.25" }
 *   ],
 *   "gasLimit": 100000
 * }
 */
async function main() {
    console.log("🚀 Starting Simple Batch Transfer...");

    // Load configuration from file or use default
    const configPath = process.env.TRANSFER_CONFIG || "transfers.json";
    let config: TransferConfig;

    try {
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, "utf8");
            config = JSON.parse(configData);
            console.log(`📁 Loaded config from: ${configPath}`);
        } else {
            console.log("⚠️  Config file not found, using example config");
            config = getExampleConfig();
        }
    } catch (error) {
        console.error("❌ Error loading config:", error);
        process.exit(1);
    }

    // Validate config
    if (!config.tokenAddress || !config.transfers || config.transfers.length === 0) {
        console.error("❌ Invalid config: tokenAddress and transfers are required");
        process.exit(1);
    }

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log(`👤 Signer: ${signer.address}`);

    // Get token contract
    console.log(`🔗 Connecting to token: ${config.tokenAddress}`);
    const tokenContract = await ethers.getContractAt("ERC20", config.tokenAddress);

    // Get token info
    const tokenName = await tokenContract.name();
    const tokenSymbol = await tokenContract.symbol();
    const tokenDecimals = await tokenContract.decimals();
    console.log(`📋 Token: ${tokenName} (${tokenSymbol}) - ${tokenDecimals} decimals`);

    // Check balance
    const balance = await tokenContract.balanceOf(signer.address);
    const totalNeeded = config.transfers.reduce((sum, transfer) => {
        return sum + parseEther(transfer.amount);
    }, 0n);

    console.log(`💰 Balance: ${formatEther(balance)} ${tokenSymbol}`);
    console.log(`📤 Total needed: ${formatEther(totalNeeded)} ${tokenSymbol}`);

    if (balance < totalNeeded) {
        console.error(`❌ Insufficient balance. Need ${formatEther(totalNeeded)}, have ${formatEther(balance)}`);
        process.exit(1);
    }

    // Execute transfers
    console.log(`\n📤 Executing ${config.transfers.length} transfers...`);
    const results: TransferResult[] = [];

    for (let i = 0; i < config.transfers.length; i++) {
        const transfer = config.transfers[i];
        console.log(
            `\n${i + 1}/${config.transfers.length} - Transferring ${transfer.amount} ${tokenSymbol} to ${transfer.to}`,
        );

        try {
            // Validate address
            if (!ethers.isAddress(transfer.to)) {
                throw new Error("Invalid address");
            }

            // Validate amount
            const amount = parseFloat(transfer.amount);
            if (isNaN(amount) || amount <= 0) {
                throw new Error("Invalid amount");
            }

            // Prepare transaction
            const amountWei = parseEther(transfer.amount);
            const gasEstimate = await tokenContract.transfer.estimateGas(transfer.to, amountWei);
            const gasLimit = config.gasLimit || Math.ceil(Number(gasEstimate) * 1.2);

            const txOptions: TransactionRequest = { gasLimit };
            if (config.gasPrice) {
                txOptions.gasPrice = parseEther(config.gasPrice);
            }

            // Execute transfer
            const tx = await tokenContract.transfer(transfer.to, amountWei, txOptions);
            console.log(`   ⏳ Transaction sent: ${tx.hash}`);

            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`   ✅ Confirmed in block ${receipt?.blockNumber}`);

            results.push({
                to: transfer.to,
                amount: transfer.amount,
                success: true,
                txHash: tx.hash,
                gasUsed: receipt?.gasUsed.toString(),
                blockNumber: receipt?.blockNumber,
            });
        } catch (error) {
            console.error(`   ❌ Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
            results.push({
                to: transfer.to,
                amount: transfer.amount,
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }

    // Print summary
    printSummary(results, tokenSymbol);

    // Save results to file
    const resultsPath = `transfer-results-${Date.now()}.json`;
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Results saved to: ${resultsPath}`);
}

/**
 * Get example configuration
 */
function getExampleConfig(): TransferConfig {
    return {
        tokenAddress: "0x0000000000000000000000000000000000000000", // Replace with actual token address
        transfers: [
            { to: "0x1234567890123456789012345678901234567890", amount: "100.5" },
            { to: "0x2345678901234567890123456789012345678901", amount: "50.25" },
            { to: "0x3456789012345678901234567890123456789012", amount: "75.0" },
        ],
        gasLimit: 100000,
    };
}

/**
 * Print transfer summary
 */
function printSummary(results: TransferResult[], tokenSymbol: string): void {
    console.log("\n" + "=".repeat(60));
    console.log("📋 TRANSFER SUMMARY");
    console.log("=".repeat(60));

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📊 Total: ${results.length}`);

    if (successful.length > 0) {
        const totalTransferred = successful.reduce((sum, r) => sum + parseFloat(r.amount), 0);
        console.log(`💰 Total transferred: ${totalTransferred} ${tokenSymbol}`);
    }

    if (failed.length > 0) {
        console.log("\n❌ Failed transfers:");
        failed.forEach((result, index) => {
            console.log(`   ${index + 1}. ${result.to} - ${result.amount} ${tokenSymbol} (${result.error})`);
        });
    }

    console.log("=".repeat(60));
}

// Run the script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });
