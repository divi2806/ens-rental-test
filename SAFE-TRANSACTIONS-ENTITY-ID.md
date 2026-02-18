# Safe Multisig Transactions for entity.id Subdomain Registrar Setup

## 🎯 Overview

You need to execute **2 transactions** from your Safe multisig to enable the SubnameRegistrarDirect contract to manage subdomains under entity.id.

**Safe Address:** `0x834163C217FF4dAeE028f27cEEb6a7fAB51B02b7`  
**Network:** Sepolia Testnet

---

## 📋 Transaction 1: Approve Registrar as Operator

### Purpose
Grant the SubnameRegistrarDirect contract permission to create and manage subdomains under entity.id (e.g., alice.entity.id, bob.entity.id).

### Contract Details
- **Contract Name:** ENS Registry
- **Address:** `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
- **Function:** `setApprovalForAll(address operator, bool approved)`

### ABI
```json
[
  {
    "name": "setApprovalForAll",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {
        "name": "operator",
        "type": "address"
      },
      {
        "name": "approved",
        "type": "bool"
      }
    ],
    "outputs": []
  }
]
```

### Parameters
| Parameter | Type | Value |
|-----------|------|-------|
| `operator` | address | `0x67B4DDd24b2f00285018530ab72127BCEAFbFADd` |
| `approved` | bool | `true` |

### Function Signature
```
setApprovalForAll(address,bool)
```

### Function Selector (4-byte)
```
0xa22cb465
```

### Encoded Calldata
```
0xa22cb46500000000000000000000000067b4ddd24b2f00285018530ab72127bceafbfadd0000000000000000000000000000000000000000000000000000000000000001
```

**Breakdown:**
- `0xa22cb465` - Function selector
- `00000000000000000000000067b4ddd24b2f00285018530ab72127bceafbfadd` - operator address (padded)
- `0000000000000000000000000000000000000000000000000000000000000001` - approved = true

### Value
```
0 ETH
```

---

## 📋 Transaction 2: Set DatabaseResolver

### Purpose
Set the DatabaseResolver as the official resolver for entity.id, enabling CCIP-Read for all subdomain lookups.

### Contract Details
- **Contract Name:** ENS Registry
- **Address:** `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
- **Function:** `setResolver(bytes32 node, address resolver)`

### ABI
```json
[
  {
    "name": "setResolver",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {
        "name": "node",
        "type": "bytes32"
      },
      {
        "name": "resolver",
        "type": "address"
      }
    ],
    "outputs": []
  }
]
```

### Parameters
| Parameter | Type | Value |
|-----------|------|-------|
| `node` | bytes32 | `0x44ba1c7fa78544d7fa6731bcaa83219e3c14ddb8893898b7e7eb50d9927d9dca` |
| `resolver` | address | `0x82824646121ea4c48613ba9feff3c9372036324f` |

**Note:** The `node` value is `namehash("entity.id")`

### Function Signature
```
setResolver(bytes32,address)
```

### Function Selector (4-byte)
```
0x1896f70a
```

### Encoded Calldata
```
0x1896f70a44ba1c7fa78544d7fa6731bcaa83219e3c14ddb8893898b7e7eb50d9927d9dca00000000000000000000000082824646121ea4c48613ba9feff3c9372036324f
```

**Breakdown:**
- `0x1896f70a` - Function selector
- `44ba1c7fa78544d7fa6731bcaa83219e3c14ddb8893898b7e7eb50d9927d9dca` - node (entity.id namehash)
- `00000000000000000000000082824646121ea4c48613ba9feff3c9372036324f` - resolver address (padded)

### Value
```
0 ETH
```

---

## 🔧 Execution Options

### Option 1: Transaction Builder (Recommended)

1. Go to Safe Transaction Builder:
   ```
   https://app.safe.global/apps/open?safe=sep:0x834163C217FF4dAeE028f27cEEb6a7fAB51B02b7&appUrl=https://app.safe.global/share/safe-app?appUrl=https://apps-portal.safe.global/tx-builder
   ```

2. **Add Transaction 1:**
   - Enter Address: `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
   - Paste ABI from above (Transaction 1)
   - Select function: `setApprovalForAll`
   - Fill parameters:
     - operator: `0x67B4DDd24b2f00285018530ab72127BCEAFbFADd`
     - approved: `true`
   - Value: `0`

3. **Click "Add Transaction"**

4. **Add Transaction 2:**
   - Enter Address: `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
   - Paste ABI from above (Transaction 2)
   - Select function: `setResolver`
   - Fill parameters:
     - node: `0x44ba1c7fa78544d7fa6731bcaa83219e3c14ddb8893898b7e7eb50d9927d9dca`
     - resolver: `0x82824646121ea4c48613ba9feff3c9372036324f`
   - Value: `0`

5. **Review and Send**

6. **Sign with your wallet** (requires 1 signature since threshold is 1)

7. **Execute the batch transaction**

---

### Option 2: Direct Calldata (Advanced)

If using custom tools or scripts, you can submit the raw calldata:

**Batch Transaction:**
```javascript
const transactions = [
  {
    to: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
    value: "0",
    data: "0xa22cb46500000000000000000000000067b4ddd24b2f00285018530ab72127bceafbfadd0000000000000000000000000000000000000000000000000000000000000001",
    operation: 0 // CALL
  },
  {
    to: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
    value: "0",
    data: "0x1896f70a44ba1c7fa78544d7fa6731bcaa83219e3c14ddb8893898b7e7eb50d9927d9dca00000000000000000000000082824646121ea4c48613ba9feff3c9372036324f",
    operation: 0 // CALL
  }
]
```

---

## ✅ Verification After Execution

After executing both transactions, verify the setup:

### Check 1: Approval Status
```javascript
// Contract: ENS Registry at 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
// Function: isApprovedForAll(address owner, address operator)

isApprovedForAll(
  "0x834163C217FF4dAeE028f27cEEb6a7fAB51B02b7",  // Safe (owner)
  "0x67B4DDd24b2f00285018530ab72127BCEAFbFADd"   // Registrar (operator)
)
// Expected: true
```

### Check 2: Resolver Set
```javascript
// Contract: ENS Registry at 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
// Function: resolver(bytes32 node)

resolver("0x44ba1c7fa78544d7fa6731bcaa83219e3c14ddb8893898b7e7eb50d9927d9dca")
// Expected: 0x82824646121ea4c48613ba9feff3c9372036324f (DatabaseResolver)
```

---

## 🎯 Summary

| Transaction | Contract | Function | Gas Estimate |
|-------------|----------|----------|--------------|
| 1. Approve Operator | ENS Registry | `setApprovalForAll` | ~50,000 gas |
| 2. Set Resolver | ENS Registry | `setResolver` | ~60,000 gas |
| **TOTAL (batched)** | - | - | **~120,000 gas** |

**Estimated Cost on Sepolia:** Free (testnet ETH)

---

## 📚 Reference

### Deployed Contracts
- **SubnameRegistrarDirect (Proxy):** `0x67B4DDd24b2f00285018530ab72127BCEAFbFADd`
- **SubnameRegistrarDirect (Implementation):** `0x57d082307Aeff174C41547f0B03C63E95952cB8a`
- **DatabaseResolver:** `0x82824646121ea4c48613ba9feff3c9372036324f`
- **ENS Registry:** `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
- **Safe Multisig:** `0x834163C217FF4dAeE028f27cEEb6a7fAB51B02b7`

### Configuration
- **Domain:** entity.id
- **Rental Price:** 0.001 ETH/year
- **Owner:** Safe Multisig (full control)

---

## ❓ FAQ

**Q: Why do we use `setApprovalForAll` instead of `setOwner`?**  
A: Because entity.id was DNS-imported (not .eth native). The Safe must retain ownership for DNS verification, but grants operator rights to the registrar contract.

**Q: Can I revoke the approval later?**  
A: Yes! The Safe owner can call `setApprovalForAll(registrar, false)` anytime to revoke permissions.

**Q: What happens if Transaction 1 succeeds but Transaction 2 fails?**  
A: The registrar will have permission to create subdomains, but they won't resolve (no resolver set). You can execute Transaction 2 separately.

**Q: Is this reversible?**  
A: Yes! All transactions can be reversed by the Safe:
- Revoke approval: `setApprovalForAll(registrar, false)`
- Change resolver: `setResolver(node, newResolver)`
- Upgrade registrar: Use UUPS upgrade (owner-only)

---

## 🚀 After Execution

Once both transactions are complete, your entity.id subdomain registrar will be **fully operational**!

Users can then register subdomains like:
- alice.entity.id
- bob.entity.id
- company.entity.id

All subdomains will:
- ✅ Resolve via DatabaseResolver (CCIP-Read)
- ✅ Store data in your gateway database
- ✅ Cost 0.001 ETH/year
- ✅ Be managed by the SubnameRegistrarDirect contract

**Ready to test? Proceed to registering your first subdomain!** 🎉
