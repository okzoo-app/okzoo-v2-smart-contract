# OKZOO Smart Contract - Hướng dẫn sử dụng

**SMART CONTRACT TEST**

```
Token: 0x0216993204138d1d4019329b4E62dA9AB5aD6e85
SoulboundNFT: 0xA1b09e9398Ad3990cD2853303Ce603a1D86A081D
ConvertToken: 0x502EA1235013E5ed5197E6B7Cf093c8b2819F360
SellSoulBoundNFT: 0x02366FF612910377D540515729d0F578aFDB411a
StakingV2: 0x126D2f9BCFa3A72B62B9fe04dD953d8B0f280E0e
```

Dự án smart contract cho OKZOO với các chức năng chính: Token, Staking, NFT Soulbound và hệ thống bán NFT.

## Cài đặt

```bash
# Cài đặt dependencies
yarn install

# Compile contracts
yarn hardhat compile
```

## Cấu hình môi trường

Tạo file `.env` với các biến môi trường sau:

```env
# Private key của account để thực hiện transactions
PRIVATE_KEY=your_private_key_here

# API Keys
ETHERSCAN_KEY=your_etherscan_api_key
BSCSCAN_KEY=your_bscscan_api_key
RPC_ANKR_KEY=your_ankr_rpc_key

# Contract Addresses
OWNER_ADDRESS=0x...
VERIFIER_ADDRESS=0x...
MAIN_TOKEN_ADDRESS=0x...

# Staking Configuration
STAKING_START_TIME=2024-01-01
STAKING_END_TIME=2024-12-31
```

## Các Networks được hỗ trợ

-   `hardhat`: Local development network
-   `bscTestnet`: BSC Testnet
-   `bsc`: BSC Mainnet

## Hướng dẫn sử dụng Write Functions

### 1. Cú pháp chung

```bash
yarn hardhat write --contract <ContractName> --address <ContractAddress> --method <MethodName> --args <JSONArray> --network <NetworkName>
```

### 2. Các ví dụ thực tế

#### 2.1. SoulboundNFT Contract

**Set Minter:**

```bash
yarn hardhat write \
  --contract SoulboundNFT \
  --address 0xA1b09e9398Ad3990cD2853303Ce603a1D86A081D \
  --method setMinter \
  --args '["0x02366FF612910377D540515729d0F578aFDB411a"]' \
  --network bscTestnet
```

#### 2.2. SellSoulboundNFT Contract

**Create Batch NFT:**

```bash
yarn hardhat write \
  --contract SellSoulboundNFT \
  --address 0x02366FF612910377D540515729d0F578aFDB411a \
  --method createBatch \
  --args '[1,100,"https://storage.googleapis.com/324d5927a3db8913-okzoo-plus-assets-dev/public/nft/test/metadatas"]' \
  --network bscTestnet
```

**Set Public Config:**

```bash
yarn hardhat write \
  --contract SellSoulboundNFT \
  --address 0x02366FF612910377D540515729d0F578aFDB411a \
  --method setPublicConfig \
  --args '[{"startTime":"1753875879","endTime":"1756554279","price":"10000000000000000000"}]' \
  --network bscTestnet
```

**Set Whitelist Config:**

```bash
yarn hardhat write \
  --contract SellSoulboundNFT \
  --address 0x02366FF612910377D540515729d0F578aFDB411a \
  --method setWhitelistConfig \
  --args '[{"startTime":"1753875879","endTime":"1756554279","price":"10000000000000000000","maxMint":10,"whitelistMerkleRoot":"0x3b0b19de8eb350ffb5a1d814ee419567a958f423ce482bef8523d35d4a53b177"}]' \
  --network bscTestnet
```

#### 2.3. OkzooToken Contract

**Transfer Token:**

```bash
yarn hardhat write \
  --contract OkzooToken \
  --address 0x0216993204138d1d4019329b4E62dA9AB5aD6e85 \
  --method transfer \
  --args '["0x502EA1235013E5ed5197E6B7Cf093c8b2819F360","1000000000000000000000000"]' \
  --network bscTestnet
```

### 3. Các tham số tùy chọn

#### Gas Limit

```bash
yarn hardhat write \
  --contract ContractName \
  --address ContractAddress \
  --method MethodName \
  --args '["arg1","arg2"]' \
  --gasLimit 5000000 \
  --network bscTestnet
```

#### Gas Price

```bash
yarn hardhat write \
  --contract ContractName \
  --address ContractAddress \
  --method MethodName \
  --args '["arg1","arg2"]' \
  --gasPrice 5000000000 \
  --network bscTestnet
```

### 4. Các task khác

#### Deploy Contract

```bash
# Deploy normal contract
yarn hardhat deploy --contract ContractName --network bscTestnet

# Deploy upgradeable contract
yarn hardhat deployProxy --contract ContractName --network bscTestnet
```

#### Upgrade Contract

```bash
yarn hardhat upgradeProxy \
  --contract ContractName \
  --address ContractAddress \
  --network bscTestnet
```

#### Verify Contract

```bash
# Verify upgradeable contract
yarn hardhat verifyProxy --address ContractAddress --network bscTestnet

# Verify token contract
yarn hardhat verifyToken --address ContractAddress --contract ContractName --network bscTestnet
```

#### Read Contract Data

```bash
yarn hardhat call \
  --contract ContractName \
  --address ContractAddress \
  --method MethodName \
  --args '["arg1","arg2"]' \
  --network bscTestnet
```

### 5. Lưu ý quan trọng

1. **Private Key**: Đảm bảo private key trong file `.env` có đủ BNB để thực hiện transactions
2. **Gas Limit**: Nếu gặp lỗi "UNPREDICTABLE_GAS_LIMIT", hãy tăng gas limit
3. **Network**: Luôn chỉ định đúng network khi thực hiện transactions
4. **Arguments**: Đảm bảo format JSON array đúng cú pháp
5. **Contract Address**: Kiểm tra địa chỉ contract trước khi thực hiện

### 6. Xử lý lỗi thường gặp

#### Insufficient Funds

```
❌ Insufficient funds for transaction
```

**Giải pháp**: Nạp thêm BNB vào account

#### Gas Limit Too Low

```
❌ Gas limit too low or function call will revert
```

**Giải pháp**: Tăng gas limit bằng tham số `--gasLimit`

#### Method Not Found

```
❌ Method 'methodName' does not exist on contract 'ContractName'
```

**Giải pháp**: Kiểm tra tên method và contract address

#### Nonce Expired

```
❌ Nonce expired. Try again with a new transaction
```

**Giải pháp**: Thử lại transaction

### 7. Contract Addresses (Testnet)

-   **SoulboundNFT**: `0xA1b09e9398Ad3990cD2853303Ce603a1D86A081D`
-   **SellSoulboundNFT**: `0x02366FF612910377D540515729d0F578aFDB411a`
-   **OkzooToken**: `0x0216993204138d1d4019329b4E62dA9AB5aD6e85`

### 8. Testing

```bash
# Chạy tất cả tests
yarn test

# Chạy test cụ thể
yarn test test/okzooV2.test.ts
```

### 9. Documentation

```bash
# Generate documentation
yarn hardhat docgen
```

Documentation sẽ được tạo trong thư mục `docs/`.
