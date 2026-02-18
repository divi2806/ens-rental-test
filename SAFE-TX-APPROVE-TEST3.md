# 🔐 Safe Transaction: Approve test3.divicompany.eth Registrar

## Overview

After deploying the SubnameRegistrar for test3.divicompany.eth, the multisig must approve it to create subdomains.

This transaction grants the registrar permission to create `*.test3.divicompany.eth` subdomains.

---

## Prerequisites

✅ test3.divicompany.eth created via Safe (using SAFE-TX-CREATE-TEST3.md)
✅ SubnameRegistrar deployed (run script 13-deploy-test3-registrar.js)
⏳ **NOW**: Approve the registrar via Safe

---

## Step-by-Step Instructions for Safe UI

### METHOD 1: Using Transaction Builder (Recommended)

#### Step 1: Enter Contract Address
In the "Enter Address or ENS Name" field, paste:
```
0x0635513f179D50A207757E05759CbD106d7dFcE8
```
*(This is the Name Wrapper contract)*

#### Step 2: Enter ABI
In the "Enter ABI" field, paste this entire JSON array:
```json
[
  {
    "inputs": [
      {"internalType": "address", "name": "operator", "type": "address"},
      {"internalType": "bool", "name": "approved", "type": "bool"}
    ],
    "name": "setApprovalForAll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]
```

#### Step 3: Select Function
Choose: **setApprovalForAll**

#### Step 4: Fill in Parameters

**operator** (address):
```
REPLACE_WITH_DEPLOYED_REGISTRAR_ADDRESS
```
*(You'll get this address after running the deployment script)*

**approved** (bool):
```
true
```

#### Step 5: Review & Submit
- Value: **0 ETH**
- Click "Add Transaction"
- Review the transaction
- Click "Create Batch" or "Send Batch"
- Sign with required signers

---

## 📋 What This Transaction Does

- **Approves**: The SubnameRegistrar to manage test3.divicompany.eth
- **Allows**: Registrar to create subdomains like `*.test3.divicompany.eth`
- **Required**: Because multisig owns test3.divicompany.eth
- **Effect**: Public can now rent subdomains via the registrar

---

## 🔍 How to Get the Registrar Address

Run the deployment script first:
```bash
cd /Users/divyansh/Desktop/RegistryChain/ens-subdomain-rental
npx hardhat run scripts/13-deploy-test3-registrar.js --network sepolia
```

The script will output:
```
✅ SubnameRegistrar deployed!
   Proxy Address: 0x...
```

**Copy that proxy address** and use it as the `operator` parameter above.

---

## ✅ After Transaction Confirms

The registrar is now approved! Public can rent subdomains:

### Test the System

```bash
# Test renting a subdomain
npx hardhat run scripts/test-test3-rental.js --network sepolia
```

Or rent manually via your frontend/UI by calling:
```javascript
registrar.rentSubname("alice", userAddress, { value: "0.001 ETH" })
```

---

## 🎯 Complete Process Summary

1. ✅ **Create test3.divicompany.eth** (via Safe - SAFE-TX-CREATE-TEST3.md)
2. ✅ **Deploy SubnameRegistrar** (run `scripts/13-deploy-test3-registrar.js`)
3. ⏳ **Approve Registrar** (THIS TRANSACTION - via Safe)
4. ✅ **Test Rental** (run test script or use registrar directly)

---

## 📊 Result

After approval:
- ✅ test3.divicompany.eth exists (owned by multisig)
- ✅ SubnameRegistrar deployed (owned by multisig)
- ✅ Registrar approved to create subdomains
- ✅ Public can rent `*.test3.divicompany.eth` for 0.001 ETH/year

---

## 🔗 Reference

| Item | Address/Value |
|------|---------------|
| **Name Wrapper** | 0x0635513f179D50A207757E05759CbD106d7dFcE8 |
| **test3.divicompany.eth Owner** | 0x834163C217FF4dAeE028f27cEEb6a7fAB51B02b7 (multisig) |
| **SubnameRegistrar** | *(Get from deployment script)* |
| **Approval Function** | setApprovalForAll(registrar, true) |
| **Value** | 0 ETH |

---

## 💡 Alternative: Use Custom Data

If Transaction Builder doesn't work, you can use Custom Data once you have the registrar address:

**To (Contract Address):**
```
0x0635513f179D50A207757E05759CbD106d7dFcE8
```

**Value:**
```
0
```

**Data (hex):**
You need to encode: `setApprovalForAll(REGISTRAR_ADDRESS, true)`

Use this format:
```
0xa22cb465000000000000000000000000[REGISTRAR_ADDRESS_WITHOUT_0x]0000000000000000000000000000000000000000000000000000000000000001
```

Replace `[REGISTRAR_ADDRESS_WITHOUT_0x]` with your registrar address (without the 0x prefix).

For example, if registrar is `0x1234...5678`:
```
0xa22cb46500000000000000000000000012345678...0000000000000001
```
