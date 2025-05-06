import { vars } from "hardhat/config";

/**
 * Retrieves the value of the specified environment variable.
 * Throws an error if the environment variable is not set.
 *
 * @param env - The name of the environment variable to retrieve.
 * @returns The value of the environment variable.
 * @throws {Error} If the environment variable is not set.
 */
export function requireEnv(env: string) {
    const res = process.env[env];
    if (!res) {
        throw new Error(`Missing environment variable: ${env}`);
    }
    return res;
}

/**
 * Converts a date string into a Unix timestamp (in seconds).
 *
 * @param dateStr - The date string to convert (e.g., "2023-01-01").
 * @returns The Unix timestamp as a string.
 */
export function dateToUnixTimestamp(dateStr: string): string {
    const date = new Date(dateStr);
    return Math.floor(date.getTime() / 1000).toString();
}

// Helper: get value for a var, either from env or vars setting
export function getConfiguredVar(key: string) {
    let account = process.env[key] || "";
    if (!account) {
        // try to get from var config if not found in env
        account = vars.get(key, "");
    }
    return account;
}
