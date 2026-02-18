# 🔐 Safe Transaction: Create test3.divicompany.eth

## Step-by-Step Instructions for Safe UI

### METHOD 1: Using Transaction Builder (Recommended)

#### Step 1: Enter Contract Address
In the "Enter Address or ENS Name" field, paste:
```
0x0635513f179D50A207757E05759CbD106d7dFcE8
```

#### Step 2: Enter ABI
In the "Enter ABI" field, paste this entire JSON array:
```json
[
  {
    "inputs": [
      {"internalType": "bytes32", "name": "parentNode", "type": "bytes32"},
      {"internalType": "string", "name": "label", "type": "string"},
      {"internalType": "address", "name": "owner", "type": "address"},
      {"internalType": "address", "name": "resolver", "type": "address"},
      {"internalType": "uint64", "name": "ttl", "type": "uint64"},
      {"internalType": "uint32", "name": "fuses", "type": "uint32"},
      {"internalType": "uint64", "name": "expiry", "type": "uint64"}
    ],
    "name": "setSubnodeRecord",
    "outputs": [{"internalType": "bytes32", "name": "node", "type": "bytes32"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]
```

#### Step 3: Select Function
Choose: **setSubnodeRecord**

#### Step 4: Fill in Parameters

**parentNode** (bytes32):
```
0xfcf38e057333c4ff22e48a03cd3cef454b0d3f7b786b6e57a4dbe191a5bacb1a
```

**label** (string):
```
test3
```

**owner** (address):
```
0x834163C217FF4dAeE028f27cEEb6a7fAB51B02b7
```

**resolver** (address):
```
0x6Dea337D5BDBCe2DB66196AbA020bC02e6193b2d
```

**ttl** (uint64):
```
0
```

**fuses** (uint32):
```
0
```

**expiry** (uint64):
```
1802514274
```

#### Step 5: Review & Submit
- Value: **0 ETH**
- Click "Add Transaction"
- Review the transaction
- Click "Create Batch" or "Send Batch"
- Sign with required signers

---

### METHOD 2: Using Custom Data (Alternative)

If Transaction Builder doesn't work, use Custom Data:

**To (Contract Address):**
```
0x0635513f179D50A207757E05759CbD106d7dFcE8
```

**Value:**
```
0
```

**Data (hex):**
```
0x24c1af44fcf38e057333c4ff22e48a03cd3cef454b0d3f7b786b6e57a4dbe191a5bacb1a00000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000834163c217ff4daee028f27ceeb6a7fab51b02b70000000000000000000000006dea337d5bdbce2db66196aba020bc02e6193b2d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006b702f620000000000000000000000000000000000000000000000000000000000000005746573743300000000000000000000000000000000000000000000000000000
```

---

## 📋 What This Transaction Does

- **Creates**: test3.divicompany.eth
- **Owner**: Your multisig (0x834163C217FF4dAeE028f27cEEb6a7fAB51B02b7)
- **Resolver**: OffchainResolver (0x6Dea337D5BDBCe2DB66196AbA020bC02e6193b2d)
- **Expiry**: February 13, 2027 (1 year)
- **Fuses**: None (you have full control)

---

## ✅ After Transaction Confirms

1. **Verify Ownership**
   - Check on Sepolia Etherscan
   - View in ENS app: https://app.ens.domains/test3.divicompany.eth

2. **Next Step: Deploy SubnameRegistrar**
   - Once confirmed, you can deploy a SubnameRegistrar for test3.divicompany.eth
   - This will allow public to rent `*.test3.divicompany.eth`
   - Same process as test/test2 registrars

---

## 🔍 Verification

After transaction executes, verify:
```bash
# Check owner
npx hardhat run scripts/verify-test3-ownership.js --network sepolia
```

Or manually check on NameWrapper:
- Contract: 0x0635513f179D50A207757E05759CbD106d7dFcE8
- Function: ownerOf
- TokenId: 0x6c798ec06cf38b9b1286f8d6c9e7545f2e0dc282082ad1f886cdb94b0bb202b9
- Expected Owner: 0x834163C217FF4dAeE028f27cEEb6a7fAB51B02b7 ✅

---

## 🎯 Summary

| Field | Value |
|-------|-------|
| **Contract** | Name Wrapper (0x0635513f179D50A207757E05759CbD106d7dFcE8) |
| **Function** | setSubnodeRecord |
| **Subdomain** | test3.divicompany.eth |
| **Owner** | Multisig (0x834163C217FF4dAeE028f27cEEb6a7fAB51B02b7) |
| **Resolver** | OffchainResolver (0x6Dea337D5BDBCe2DB66196AbA020bC02e6193b2d) |
| **Value** | 0 ETH |
| **Gas** | ~150,000 (estimated) |
