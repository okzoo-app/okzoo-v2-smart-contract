// export const ConfigToken = {
//     name: "StakeToken",
//     symbol: "STK",
//     mintAmount: "100000000",
//     recipient: "",
// };
// export const Config = {
//     stakeToken: "0x0",
//     unstakeLockTime: 604800,
//     owner: "0xe492BE5D1f9C0DA726C560Bc451835AfC5568313",
// };

import { requireEnv } from "../util";

// Field order must be same with argument order in contract initializer function

// const config = {
//     owner: "0x781A5e70d71A1a223995FbCcfF810d57b9Ef1098", // TODO: set owner
//     // owner: "0x458f60CDcbc8ADA5Afd52B6e37D92823FF18F7b5", // TODO: set owner
//     verifier: "0x458f60CDcbc8ADA5Afd52B6e37D92823FF18F7b5",
//     domain: "OKZOO_v2",
//     version: "1",
// };
const config = {
    owner: requireEnv("OWNER_ADDRESS"),
    // owner: "0x458f60CDcbc8ADA5Afd52B6e37D92823FF18F7b5", // TODO: set owner
    verifier: requireEnv("VERIFIER_ADDRESS"),
    domain: "OKZOO_v2",
    version: "1",
};

export default config;
