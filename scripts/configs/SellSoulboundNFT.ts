// Field order must be same with argument order in contract initializer function
const config = {
    nft: "0x308424cAeeAF61Cb2F8DF97b12C0Db9Cc8d13c68",
    initialOwner: "0xe492BE5D1f9C0DA726C560Bc451835AfC5568313",
    paymentToken: "0xa52F3Ef5Fa066011620993F6a1329920CDdb98Dc",
};

export default config;

// https://okzoo-plus-assets.s3.ap-southeast-1.amazonaws.com/public/test
/**
 * 1. SoulboundNFT: 0x308424cAeeAF61Cb2F8DF97b12C0Db9Cc8d13c68
 *      - yarn hardhat write --contract SoulboundNFT --address 0x308424cAeeAF61Cb2F8DF97b12C0Db9Cc8d13c68 --method setMinter --args '["0x4C750ac27D0a4CDd8291e03051b59cf294E3eBD9"]' --network bscTestnet
 * 2. SellSoulboundNFT: 0x4C750ac27D0a4CDd8291e03051b59cf294E3eBD9
 *      - yarn hardhat write --contract SellSoulboundNFT --address 0x4C750ac27D0a4CDd8291e03051b59cf294E3eBD9 --method createBatch --args '[1,10,"https://okzoo-plus-assets.s3.ap-southeast-1.amazonaws.com/public/test"]' --network bscTestnet
 *      - yarn hardhat write --contract SellSoulboundNFT --address 0x4C750ac27D0a4CDd8291e03051b59cf294E3eBD9 --method setPublicConfig --args '[{"startTime":"1752059868","endTime":"1754738268","price":"10000000000000000000"}]' --network bscTestnet
 *      - yarn hardhat write --contract SellSoulboundNFT --address 0x4C750ac27D0a4CDd8291e03051b59cf294E3eBD9 --method setWhitelistConfig --args '[{"startTime":"1753165632","endTime":"1754738268","price":"10000000000000000000","maxMint":50,"whitelistMerkleRoot":"0x4090a5a32fccc51901a356a6e68f01ad14a6c9fc908959952d30b169e5089b29"}]' --network bscTestnet
 */
