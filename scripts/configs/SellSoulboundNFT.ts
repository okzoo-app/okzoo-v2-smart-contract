// Field order must be same with argument order in contract initializer function
const config = {
    nft: "0x715344c226526c889606fC6ff42534be49Cf6aF8",
    initialOwner: "0xe492BE5D1f9C0DA726C560Bc451835AfC5568313",
    paymentToken: "0xa52F3Ef5Fa066011620993F6a1329920CDdb98Dc",
};

export default config;

// https://okzoo-plus-assets.s3.ap-southeast-1.amazonaws.com/public/test
/**
 * 1. SoulboundNFT: 0x11C26AC8e9195C48F09521DC384ad019Aa0244cb
 *      - yarn hardhat write --contract SoulboundNFT --address 0x11C26AC8e9195C48F09521DC384ad019Aa0244cb --method setMinter --args '["0xAAa2b6a59D80DC4025433CE2C3A36d1Fd497E31D"]' --network bscTestnet
 * 2. SellSoulboundNFT: 0xAAa2b6a59D80DC4025433CE2C3A36d1Fd497E31D
 *      - yarn hardhat write --contract SellSoulboundNFT --address 0xAAa2b6a59D80DC4025433CE2C3A36d1Fd497E31D --method createBatch --args '[0,10,"https://okzoo-plus-assets.s3.ap-southeast-1.amazonaws.com/public/test"]' --network bscTestnet
 *      - yarn hardhat write --contract SellSoulboundNFT --address 0xAAa2b6a59D80DC4025433CE2C3A36d1Fd497E31D --method setPublicConfig --args '[{"startTime":"1752059868","endTime":"1754738268","price":"10000000000000000000"}]' --network bscTestnet
 *      - yarn hardhat write --contract SellSoulboundNFT --address 0xAAa2b6a59D80DC4025433CE2C3A36d1Fd497E31D --method setWhitelistConfig --args '[{"startTime":"1752059868","endTime":"1754738268","price":"10000000000000000000","maxMint":50,"whitelistMerkleRoot":"0x0000000000000000000000000000000000000000000000000000000000000000"}]' --network bscTestnet
 */
