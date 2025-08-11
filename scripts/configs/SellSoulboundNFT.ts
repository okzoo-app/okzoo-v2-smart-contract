// Field order must be same with argument order in contract initializer function
const config = {
    nft: "0xAeA330Eb385A8660211Bd6f0442D8339e3878205",
    initialOwner: "0xe492BE5D1f9C0DA726C560Bc451835AfC5568313",
};

export default config;

// https://storage.googleapis.com/324d5927a3db8913-okzoo-plus-assets-dev/public/nft/test/metadatas
/**
 * 1. SoulboundNFT: 0xAeA330Eb385A8660211Bd6f0442D8339e3878205
 *      - yarn hardhat write --contract SoulboundNFT --address 0xAeA330Eb385A8660211Bd6f0442D8339e3878205 --method addMinter --args '["0xFa9A0F51B12Db0Ab6acE518c9a47185Ef0a09EF0"]' --network bscTestnet
 * 2. SellSoulboundNFT: 0xFa9A0F51B12Db0Ab6acE518c9a47185Ef0a09EF0
 *      - yarn hardhat write --contract SellSoulboundNFT --address 0xFa9A0F51B12Db0Ab6acE518c9a47185Ef0a09EF0 --method createBatch --args '[1,100,"https://storage.googleapis.com/324d5927a3db8913-okzoo-plus-assets-dev/public/nft/test/metadatas"]' --network bscTestnet
 *
 *      - yarn hardhat write --contract SellSoulboundNFT --address 0xFa9A0F51B12Db0Ab6acE518c9a47185Ef0a09EF0 --method setPublicConfig --args '[{"startTime":"1754908608","endTime":"1757587008","price":"10000000000000000000"}]' --network bscTestnet
 *
 *      - yarn hardhat write --contract SellSoulboundNFT --address 0xFa9A0F51B12Db0Ab6acE518c9a47185Ef0a09EF0 --method setWhitelistConfig --args '[{"startTime":"1753875879","endTime":"1756554279","price":"10000000000000000000","maxMint":10,"whitelistMerkleRoot":"0x3b0b19de8eb350ffb5a1d814ee419567a958f423ce482bef8523d35d4a53b177"}]' --network bscTestnet
 *
 *      - yarn hardhat write --contract SellSoulboundNFT --address 0xFa9A0F51B12Db0Ab6acE518c9a47185Ef0a09EF0 --method setPaymentToken --args '["0x0216993204138d1d4019329b4E62dA9AB5aD6e85","10000000000000000000"]' --network bscTestnet
 *
 *      - yarn hardhat write --contract SellSoulboundNFT --address 0xFa9A0F51B12Db0Ab6acE518c9a47185Ef0a09EF0 --method buy --args '["0x0216993204138d1d4019329b4E62dA9AB5aD6e85","10000000000000000000",[],false]' --network bscTestnet
 */

// [0xe56f74f0b5211ad1a2fa826c7feb2c59820ec31de047586f7ee465232ecc0ca5,0xc4fd3d13f71bcec4008a5bde2f2f2b0f01a79d5f6b39593be7c709af8d03bf5c,0xeea7f901206ea015e616b9ddac83e5a82b2c8b0af00db01e1df62413db13e810,0xc0c1f92c73b3a5feef3cdd524be08f61f49d609f22e3e48d99ac96de942e4ec6]

// Transfer token: yarn hardhat write --contract OkzooToken --address 0x0216993204138d1d4019329b4E62dA9AB5aD6e85 --method transfer --args '["0x502EA1235013E5ed5197E6B7Cf093c8b2819F360","1000000000000000000000000"]' --network bscTestnet
// payment token1: 0x0216993204138d1d4019329b4E62dA9AB5aD6e85
// payment token2: 0xbC89769Bb1E4BD614CD3F72D5c5ec282b4cd88Bf

// option + z
