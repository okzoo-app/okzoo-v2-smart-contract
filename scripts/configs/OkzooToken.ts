import { requireEnv } from "../util";

// Field order must be same with argument order in contract initializer function
const config = {
    name_: "OKZOO",
    symbol_: "AIOT",
    mintAmount: 1_000_000_000, // 1 billion tokens
    recipient: requireEnv("OWNER_ADDRESS"),
};

export default config;
