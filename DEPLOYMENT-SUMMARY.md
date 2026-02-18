# Deployment Summary - Upgraded Contracts

## Questions Answered

### Do we need SubnameRegistrarDirect?

**Short Answer:** Not required if you're only using wrapped ENS domains.

**Explanation:**
- **SubnameRegistrar** = For domains wrapped in Name Wrapper (your current setup with divicompany.eth)
- **SubnameRegistrarDirect** = For unwrapped domains using direct ENS Registry

Your current setup uses **SubnameRegistrar** (wrapper method), which is the recommended approach.

**Recommendation:** 
- Keep SubnameRegistrarDirect in the codebase for flexibility
- Some users might have unwrapped domains
- It's compiled but not deployed unless needed
- No additional cost to keep it

## New Deployment Details

### Deployed Contract (Upgradeable UUPS Proxy)

**Contract:** SubnameRegistrar (Name Wrapper based)

**Addresses:**
- Proxy: `0xEbb46841B70ba10BBA83C08B0460Fe0Ae8CE6aD7`
- Implementation: `0x6031bb45a2B1a2BDd4991164c72721f29936dbeB`

**Network:** Sepolia Testnet

**Configuration:**
- Parent Domain: divicompany.eth
- Name Wrapper: 0x0635513f179D50A207757E05759CbD106d7dFcE8
- Rental Price: 0.001 ETH/year
- Rental Duration: 365 days
- Owner: 0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595

**Status:** ✅ Fully deployed and tested

## Deployment Steps Executed

### 1. Contract Deployment
```bash
npx hardhat run scripts/02-deploy-registrar.js --network sepolia
```

Result:
- Proxy deployed at 0xEbb46841B70ba10BBA83C08B0460Fe0Ae8CE6aD7
- Implementation at 0x6031bb45a2B1a2BDd4991164c72721f29936dbeB
- Contract properly initialized with all parameters

### 2. Permissions Setup
```bash
npx hardhat run scripts/03-setup-permissions.js --network sepolia
```

Result:
- Name Wrapper approved contract as operator
- Contract can now create subdomains on behalf of owner
- Transaction: 0xe6e9a6d890c31db0a70d611fb8d92f747924b28fc69c9fd440c0b0dd087af522

### 3. Contract Testing
```bash
npx hardhat run scripts/test-upgraded-contract.js --network sepolia
```

Result:
- Successfully rented subdomain: testupgrade1770966713993.divicompany.eth
- Rental expires: February 13, 2027
- Transaction: 0x09c5db776515b881d57da9476fbbf16d948f19469614ba8475164e1d124231ef
- All contract functions working correctly

## Updated Files

### 1. rental-app/lib/config.ts
Updated contract address from old deployment to new proxy:

**Before:**
```typescript
export const CONTRACT_ADDRESS = '0xa589676a3a68824774Dce210f3448cE1750f676e' as const;
```

**After:**
```typescript
export const CONTRACT_ADDRESS = '0xEbb46841B70ba10BBA83C08B0460Fe0Ae8CE6aD7' as const;
```

### 2. config.json
Updated with new deployment information:
```json
{
  "registrarAddress": "0xEbb46841B70ba10BBA83C08B0460Fe0Ae8CE6aD7",
  "registrarImplementation": "0x6031bb45a2B1a2BDd4991164c72721f29936dbeB",
  "deployedAt": "2026-02-13T07:07:50.096Z",
  "permissionsSet": true,
  "setupComplete": true
}
```

## Contract Verification

### State Check
All contract variables properly initialized:
- ✅ Name Wrapper: 0x0635513f179D50A207757E05759CbD106d7dFcE8
- ✅ Parent Node: 0xfcf38e057333c4ff22e48a03cd3cef454b0d3f7b786b6e57a4dbe191a5bacb1a
- ✅ Rental Price: 0.001 ETH
- ✅ Rental Duration: 365 days
- ✅ Owner: 0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595

### Functionality Test
- ✅ isAvailable() - Working
- ✅ rentSubname() - Working
- ✅ getRentalInfo() - Working
- ✅ Permission system - Working

## Upgrade Capability

The new contract is upgradeable via UUPS pattern.

**To upgrade in the future:**
```bash
CONTRACT_NAME=SubnameRegistrar npx hardhat run scripts/upgrade-contract.js --network sepolia
```

**Benefits:**
- Fix bugs without redeploying
- Add new features
- Keep same contract address
- Preserve all existing rentals and state

## Frontend Update

The rental-app now uses the new proxy contract:
- Contract address updated in config
- All existing functionality preserved
- ABI remains compatible
- No frontend code changes needed

## Next Steps

### Optional: Deploy OffchainResolver (if needed for updates)
```bash
npx hardhat run scripts/05-deploy-offchain-resolver.js --network sepolia
```

The current OffchainResolver is still at:
- Address: 0x69d89c8e75FA7F98dcB2295F73A2f91e216550c4
- Already working with gateway

### Start Rental App
```bash
cd rental-app
pnpm dev
```

Access at: http://localhost:3000

## Transactions Summary

All Sepolia testnet transactions:

1. **Proxy Deployment**
   - Contract: SubnameRegistrar Proxy
   - Address: 0xEbb46841B70ba10BBA83C08B0460Fe0Ae8CE6aD7

2. **Permissions Setup**
   - TX: 0xe6e9a6d890c31db0a70d611fb8d92f747924b28fc69c9fd440c0b0dd087af522
   - Action: Approved contract as Name Wrapper operator

3. **Test Rental**
   - TX: 0x09c5db776515b881d57da9476fbbf16d948f19469614ba8475164e1d124231ef
   - Subdomain: testupgrade1770966713993.divicompany.eth
   - Cost: 0.001 ETH

## Etherscan Links

- Proxy Contract: https://sepolia.etherscan.io/address/0xEbb46841B70ba10BBA83C08B0460Fe0Ae8CE6aD7
- Implementation: https://sepolia.etherscan.io/address/0x6031bb45a2B1a2BDd4991164c72721f29936dbeB
- Permission TX: https://sepolia.etherscan.io/tx/0xe6e9a6d890c31db0a70d611fb8d92f747924b28fc69c9fd440c0b0dd087af522
- Test Rental TX: https://sepolia.etherscan.io/tx/0x09c5db776515b881d57da9476fbbf16d948f19469614ba8475164e1d124231ef

## Cost Analysis

Total deployment cost (approximate on Sepolia):
- Proxy deployment: ~0.007 ETH
- Permissions setup: ~0.001 ETH
- Test rental: 0.001 ETH (rental fee)
- **Total: ~0.009 ETH (~$21 at current prices)**

## Important Notes

1. **Proxy Pattern:** The contract now uses UUPS upgradeable pattern
   - Interact with proxy address only: 0xEbb46841B70ba10BBA83C08B0460Fe0Ae8CE6aD7
   - Implementation address is for reference only

2. **Rental App:** Updated to use new proxy address
   - No code changes needed
   - Same ABI and functionality
   - All existing features work

3. **Upgradeability:** When you upgrade:
   - Proxy address stays the same
   - All rentals preserved
   - No migration needed
   - Frontend continues working

4. **SubnameRegistrarDirect:** 
   - Not deployed (not needed for your setup)
   - Available if needed for unwrapped domains
   - Can deploy separately if requirements change
