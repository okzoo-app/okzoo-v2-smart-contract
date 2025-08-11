# Batch Token Transfer Scripts

Bộ script để transfer token cho nhiều addresses một cách hiệu quả và an toàn.

## 📁 Các Script Có Sẵn

### 1. `scripts/simple-batch-transfer.ts` - Script Đơn Giản

Script cơ bản để transfer token với cấu hình từ file JSON.

**Tính năng:**

-   ✅ Transfer tuần tự từng transaction
-   ✅ Cấu hình từ file JSON
-   ✅ Validation địa chỉ và số lượng
-   ✅ Kiểm tra balance trước khi transfer
-   ✅ Lưu kết quả ra file

**Cách sử dụng:**

```bash
# Tạo file cấu hình transfers.json
# Chạy script
npx hardhat run scripts/simple-batch-transfer.ts --network <network>
```

## 📋 Cấu Trúc File Cấu Hình

### File JSON (cho simple-batch-transfer.ts)

```json
{
    "tokenAddress": "0x0000000000000000000000000000000000000000",
    "transfers": [
        {
            "to": "0x1234567890123456789012345678901234567890",
            "amount": "100.5"
        },
        {
            "to": "0x2345678901234567890123456789012345678901",
            "amount": "50.25"
        }
    ],
    "gasLimit": 100000,
    "gasPrice": "0.00000002"
}
```

## 🚀 Cách Sử Dụng

### Bước 1: Chuẩn Bị

1. Đảm bảo đã cài đặt dependencies:

```bash
npm install
# hoặc
yarn install
```

2. Cấu hình network trong `hardhat.config.ts`

3. Chuẩn bị private key hoặc mnemonic trong environment variables

### Bước 2: Tạo File Cấu Hình

Tạo file `transfers.json` với danh sách addresses và amounts cần transfer.

### Bước 3: Chạy Script

```bash
# Script đơn giản
npx hardhat run scripts/simple-batch-transfer.ts --network <network>

# Với custom config file
TRANSFER_CONFIG=my-transfers.json npx hardhat run scripts/simple-batch-transfer.ts --network <network>
```

## 📊 Kết Quả

Script sẽ tạo ra các file kết quả:

-   `transfer-results-<timestamp>.json` - Kết quả chi tiết dạng JSON

### Format Kết Quả

```json
[
    {
        "to": "0x1234...",
        "amount": "100.5",
        "success": true,
        "txHash": "0x...",
        "gasUsed": "65000",
        "blockNumber": 12345678
    },
    {
        "to": "0x5678...",
        "amount": "50.25",
        "success": false,
        "error": "Insufficient balance"
    }
]
```

## ⚠️ Lưu Ý Quan Trọng

### Bảo Mật

-   ✅ Luôn kiểm tra địa chỉ token và recipient addresses
-   ✅ Verify balance trước khi thực hiện transfer
-   ✅ Sử dụng private key an toàn
-   ✅ Test trên testnet trước khi dùng mainnet

### Gas Optimization

-   ✅ Sử dụng EIP-1559 cho networks hỗ trợ
-   ✅ Estimate gas trước khi thực hiện transaction
-   ✅ Set gas limit phù hợp (thường +20% so với estimate)

### Error Handling

-   ✅ Script có retry mechanism cho failed transactions
-   ✅ Log chi tiết các lỗi để debug
-   ✅ Continue processing ngay cả khi một số transactions fail

## 🔧 Tùy Chỉnh

### Thêm Custom Validation

```typescript
// Trong script, thêm validation logic
private validateTransfer(transfer: TransferData): void {
    // Custom validation logic
    if (transfer.amount.includes('.')) {
        const decimals = transfer.amount.split('.')[1].length;
        if (decimals > 18) {
            throw new Error(`Too many decimals: ${transfer.amount}`);
        }
    }
}
```

### Custom Gas Strategy

```typescript
// Dynamic gas price based on network conditions
const gasPrice = await ethers.provider.getGasPrice();
const adjustedGasPrice = gasPrice * 1.1n; // +10%
```

## 📞 Hỗ Trợ

Nếu gặp vấn đề:

1. Kiểm tra network configuration
2. Verify token contract address
3. Đảm bảo đủ balance (token + ETH cho gas)
4. Check console logs để debug

## 🔄 Cập Nhật

Script được thiết kế để dễ dàng mở rộng và tùy chỉnh. Có thể thêm:

-   Support cho các loại token khác (ERC721, ERC1155)
-   Integration với DEX để swap token
-   Multi-signature support
-   Scheduled transfers
