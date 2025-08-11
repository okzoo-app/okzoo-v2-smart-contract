# Contract Call Documentation

## Storage URL
```
https://storage.googleapis.com/324d5927a3db8913-okzoo-plus-assets-dev/public/nft/test/metadatas
```

## Contract Addresses and Commands

### 1. SoulboundNFT Contract
**Address:** `0xf34f5d3bB9B4940e38149AD982e26F95843A78A4`

#### Add Minter
```bash
yarn hardhat write --contract SoulboundNFT --address 0xf34f5d3bB9B4940e38149AD982e26F95843A78A4 --method addMinter --args '["0x040b078E6Fb834a554aB739e23B43D1759C8A520"]' --network bscTestnet
```

### 2. SellSoulboundNFT Contract
**Address:** `0x040b078E6Fb834a554aB739e23B43D1759C8A520`

#### Create Batch
```bash
yarn hardhat write --contract SellSoulboundNFT --address 0x040b078E6Fb834a554aB739e23B43D1759C8A520 --method createBatch --args '[1,100,"https://storage.googleapis.com/324d5927a3db8913-okzoo-plus-assets-dev/public/nft/test/metadatas"]' --network bscTestnet
```

#### Set Public Config
```bash
yarn hardhat write --contract SellSoulboundNFT --address 0x040b078E6Fb834a554aB739e23B43D1759C8A520 --method setPublicConfig --args '[{"startTime":"1754908608","endTime":"1757587008","price":"10000000000000000000"}]' --network bscTestnet
```

#### Set Whitelist Config
```bash
yarn hardhat write --contract SellSoulboundNFT --address 0x040b078E6Fb834a554aB739e23B43D1759C8A520 --method setWhitelistConfig --args '[{"startTime":"1753875879","endTime":"1756554279","price":"10000000000000000000","maxMint":10,"whitelistMerkleRoot":"0x3b0b19de8eb350ffb5a1d814ee419567a958f423ce482bef8523d35d4a53b177"}]' --network bscTestnet
```

#### Set Payment Token
```bash
yarn hardhat write --contract SellSoulboundNFT --address 0x040b078E6Fb834a554aB739e23B43D1759C8A520 --method setPaymentToken --args '["0xbC89769Bb1E4BD614CD3F72D5c5ec282b4cd88Bf","15000000000000000000"]' --network bscTestnet
```

#### Buy NFT
```bash
yarn hardhat write --contract SellSoulboundNFT --address 0x040b078E6Fb834a554aB739e23B43D1759C8A520 --method buy --args '["0x0216993204138d1d4019329b4E62dA9AB5aD6e85","10000000000000000000",[],false]' --network bscTestnet
```

## Additional Commands

### Transfer Token
```bash
yarn hardhat write --contract OkzooToken --address 0x0216993204138d1d4019329b4E62dA9AB5aD6e85 --method transfer --args '["0x502EA1235013E5ed5197E6B7Cf093c8b2819F360","1000000000000000000000000"]' --network bscTestnet
```

### Approve Token (Payment Token 1)
```bash
yarn hardhat write --contract OkzooToken --address 0x0216993204138d1d4019329b4E62dA9AB5aD6e85 --method approve --args '["0x040b078E6Fb834a554aB739e23B43D1759C8A520","10000000000000000000"]' --network bscTestnet
```

### Approve Token (Payment Token 2)
```bash
yarn hardhat write --contract OkzooToken --address 0xbC89769Bb1E4BD614CD3F72D5c5ec282b4cd88Bf --method approve --args '["0x040b078E6Fb834a554aB739e23B43D1759C8A520","1000000000000000000000000"]' --network bscTestnet
```

### Check Allowance
```bash
yarn hardhat read --contract OkzooToken --address 0x0216993204138d1d4019329b4E62dA9AB5aD6e85 --method allowance --args '["0xYOUR_ADDRESS","0x040b078E6Fb834a554aB739e23B43D1759C8A520"]' --network bscTestnet
```

## Payment Tokens
- **Payment Token 1:** `0x0216993204138d1d4019329b4E62dA9AB5aD6e85`
- **Payment Token 2:** `0xbC89769Bb1E4BD614CD3F72D5c5ec282b4cd88Bf`

## Merkle Proof Example
```
[0xe56f74f0b5211ad1a2fa826c7feb2c59820ec31de047586f7ee465232ecc0ca5,0xc4fd3d13f71bcec4008a5bde2f2f2b0f01a79d5f6b39593be7c709af8d03bf5c,0xeea7f901206ea015e616b9ddac83e5a82b2c8b0af00db01e1df62413db13e810,0xc0c1f92c73b3a5feef3cdd524be08f61f49d609f22e3e48d99ac96de942e4ec6]
```
