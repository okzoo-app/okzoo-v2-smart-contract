// Field order must be same with argument order in contract initializer function
const config = {
    nft: "0xA1b09e9398Ad3990cD2853303Ce603a1D86A081D",
    initialOwner: "0xe492BE5D1f9C0DA726C560Bc451835AfC5568313",
    paymentToken: "0x0216993204138d1d4019329b4E62dA9AB5aD6e85",
};

export default config;

// https://storage.googleapis.com/324d5927a3db8913-okzoo-plus-assets-dev/public/nft/test/metadatas
/**
 * 1. SoulboundNFT: 0xA1b09e9398Ad3990cD2853303Ce603a1D86A081D
 *      - yarn hardhat write --contract SoulboundNFT --address 0xA1b09e9398Ad3990cD2853303Ce603a1D86A081D --method setMinter --args '["0x02366FF612910377D540515729d0F578aFDB411a"]' --network bscTestnet
 * 2. SellSoulboundNFT: 0x02366FF612910377D540515729d0F578aFDB411a
 *      - yarn hardhat write --contract SellSoulboundNFT --address 0x02366FF612910377D540515729d0F578aFDB411a --method createBatch --args '[1,100,"https://storage.googleapis.com/324d5927a3db8913-okzoo-plus-assets-dev/public/nft/test/metadatas"]' --network bscTestnet
 *      - yarn hardhat write --contract SellSoulboundNFT --address 0x02366FF612910377D540515729d0F578aFDB411a --method setPublicConfig --args '[{"startTime":"1753875879","endTime":"1756554279","price":"10000000000000000000"}]' --network bscTestnet
 *      - yarn hardhat write --contract SellSoulboundNFT --address 0x02366FF612910377D540515729d0F578aFDB411a --method setWhitelistConfig --args '[{"startTime":"1753875879","endTime":"1756554279","price":"10000000000000000000","maxMint":10,"whitelistMerkleRoot":"0x3b0b19de8eb350ffb5a1d814ee419567a958f423ce482bef8523d35d4a53b177"}]' --network bscTestnet
 */

// [0xe56f74f0b5211ad1a2fa826c7feb2c59820ec31de047586f7ee465232ecc0ca5,0xc4fd3d13f71bcec4008a5bde2f2f2b0f01a79d5f6b39593be7c709af8d03bf5c,0xeea7f901206ea015e616b9ddac83e5a82b2c8b0af00db01e1df62413db13e810,0xc0c1f92c73b3a5feef3cdd524be08f61f49d609f22e3e48d99ac96de942e4ec6]

// Transfer token: yarn hardhat write --contract OkzooToken --address 0x0216993204138d1d4019329b4E62dA9AB5aD6e85 --method transfer --args '["0x502EA1235013E5ed5197E6B7Cf093c8b2819F360","1000000000000000000000000"]' --network bscTestnet
