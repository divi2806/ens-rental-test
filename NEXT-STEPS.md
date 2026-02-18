# 🎯 Next Steps: Testing entity.id Subdomain Registrar

Now that you've executed the Safe transactions, follow these steps to verify and test your subdomain rental system.

---

## Step 1: Verify Setup ✅

Run the verification script to confirm both Safe transactions completed successfully:

```bash
cd /Users/divyansh/Desktop/RegistryChain/ens-subdomain-rental
npx hardhat run scripts/verify-entity-id-registrar.js --network sepolia
```

**Expected Output:**
```
✅ Verifying entity.id Subdomain Registrar Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Check 1: entity.id Ownership
   ✅ Safe owns entity.id

📋 Check 2: Operator Approval (setApprovalForAll)
   ✅ Registrar is approved as operator

📋 Check 3: DatabaseResolver Set for entity.id
   ✅ DatabaseResolver is set

📋 Check 4: Registrar Configuration
   ✅ Parent node correct
   ✅ Resolver correct
   ✅ Rental price correct
   ✅ Owner is Safe
   ✅ ENS Registry correct

📋 Check 5: Subdomain Availability Check
   ✅ Availability check works

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 SUMMARY: 8 passed, 0 failed

🎉 ALL CHECKS PASSED!

Your entity.id subdomain registrar is FULLY OPERATIONAL!
```

If any checks fail, the script will tell you which Safe transaction needs to be re-executed.

---

## Step 2: Test Subdomain Registration 🧪

Register your first subdomain (e.g., alice.entity.id):

```bash
npx hardhat run scripts/test-entity-id-rental.js --network sepolia
```

**What This Does:**
1. Checks if "alice" is available under entity.id
2. Estimates gas for the rental transaction
3. Sends 0.001 ETH to rent alice.entity.id for 1 year
4. Verifies ownership in the registrar contract
5. Verifies ownership in the ENS Registry
6. Checks that DatabaseResolver is set

**Expected Output:**
```
🧪 Testing entity.id Subdomain Rental
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Deployer: 0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595
Balance: 9.628 ETH

Registrar: 0x67B4DDd24b2f00285018530ab72127BCEAFbFADd
Domain: entity.id

💰 Rental Price: 0.001 ETH/year

📝 Testing subdomain: alice.entity.id

1️⃣  Checking availability...
   Available: true

2️⃣  Estimating gas...
   Gas estimate: 245678

3️⃣  Renting subdomain...
   Sending 0.001 ETH...

   Transaction hash: 0xabcd1234...
   Waiting for confirmation...

   ✅ Confirmed in block 5467890

4️⃣  Verifying rental...
   Owner: 0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595
   Expires: Feb 18, 2027, 12:00:00 PM

   ✅ Ownership verified!

5️⃣  Checking ENS Registry...
   namehash(alice.entity.id): 0x1234abcd...
   ENS owner: 0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595
   ✅ ENS ownership verified!

   ENS resolver: 0x82824646121ea4c48613ba9feff3c9372036324f
   Expected: 0x82824646121ea4c48613ba9feff3c9372036324f
   ✅ Resolver verified!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 SUBDOMAIN RENTAL TEST COMPLETE!

Subdomain: alice.entity.id
Owner: 0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595
Expires: Feb 18, 2027
Cost: 0.001 ETH
```

**To Test Other Subdomains:**
Edit the `label` variable in `test-entity-id-rental.js` (line 53):
```javascript
const label = 'bob';    // Will create bob.entity.id
const label = 'company'; // Will create company.entity.id
```

---

## Step 3: Set Address Records (CCIP-Read) 🌐

Now that alice.entity.id is registered, set its address record via your gateway:

### Option A: Using curl

```bash
curl -X POST https://seashell-app-sajbl.ondigitalocean.app/setAddr \
  -H "Content-Type: application/json" \
  -d '{
    "name": "alice.entity.id",
    "address": "0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595"
  }'
```

### Option B: Using the Gateway Directly

Your DatabaseResolver uses CCIP-Read with Write Deferral, so address records are stored in your gateway database.

Check your gateway's API documentation for:
- `POST /setAddr` - Set ETH address
- `POST /setText` - Set text records
- `POST /setContenthash` - Set content hash

---

## Step 4: Verify Resolution Works 🔍

### Test with ethers.js

Create a test script:

```javascript
const { ethers } = require('ethers');

async function testResolution() {
  const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_INFURA_KEY');
  
  // Resolve alice.entity.id
  const resolver = await provider.getResolver('alice.entity.id');
  
  if (resolver) {
    console.log('Resolver found:', resolver.address);
    
    const address = await resolver.getAddress();
    console.log('ETH Address:', address);
    
    const text = await resolver.getText('description');
    console.log('Description:', text);
  } else {
    console.log('No resolver found');
  }
}

testResolution();
```

### Expected Flow:
1. ethers.js queries ENS Registry for alice.entity.id
2. Finds DatabaseResolver at 0x82824646121ea4c48613ba9feff3c9372036324f
3. DatabaseResolver triggers CCIP-Read to your gateway
4. Gateway returns signed data from database
5. DatabaseResolver verifies signature and returns data

---

## Step 5: Integration Testing 🔗

### Test Complete Workflow

1. **Register new subdomain:**
   ```bash
   npx hardhat run scripts/test-entity-id-rental.js --network sepolia
   ```

2. **Set records via gateway:**
   ```bash
   curl -X POST https://seashell-app-sajbl.ondigitalocean.app/setAddr \
     -H "Content-Type: application/json" \
     -d '{"name": "alice.entity.id", "address": "0x1234..."}'
   ```

3. **Query via CCIP-Read:**
   ```javascript
   const resolver = await provider.getResolver('alice.entity.id');
   const addr = await resolver.getAddress();
   console.log(addr); // Should match what you set
   ```

4. **Check on Etherscan:**
   - Go to: https://sepolia.etherscan.io/enslookup-search?search=alice.entity.id
   - Should show owner and resolver

---

## Step 6: Monitor Registrar Activity 📊

### Check Registrar Balance

```bash
npx hardhat console --network sepolia
```

```javascript
const registrar = await ethers.getContractAt(
  'SubnameRegistrarDirect',
  '0x67B4DDd24b2f00285018530ab72127BCEAFbFADd'
);

const balance = await ethers.provider.getBalance(registrar.target);
console.log('Registrar balance:', ethers.formatEther(balance), 'ETH');
```

### Withdraw Funds (Safe Only)

Only the Safe multisig can withdraw accumulated rental fees:

```javascript
// Via Safe Transaction Builder
// Contract: 0x67B4DDd24b2f00285018530ab72127BCEAFbFADd
// Function: withdraw()
// ABI: [{"name":"withdraw","type":"function","inputs":[],"outputs":[]}]
```

---

## Step 7: Production Checklist ✅

Before going to mainnet:

- [ ] All verification tests pass on Sepolia
- [ ] Multiple subdomains registered successfully
- [ ] CCIP-Read resolution works end-to-end
- [ ] Gateway is stable and returns valid signatures
- [ ] Safe multisig has multiple signers (not just 1)
- [ ] Increase signature threshold (e.g., 2-of-3)
- [ ] Rental price set appropriately (currently 0.001 ETH)
- [ ] DatabaseResolver gateway URL is production-ready
- [ ] Monitor gas costs for rental transactions
- [ ] Test contract upgrade path (UUPS)

---

## Common Issues & Fixes 🔧

### Issue 1: "NotApproved" Error
**Cause:** Safe Transaction 1 (setApprovalForAll) not executed  
**Fix:** Run verification script, execute missing Safe transaction

### Issue 2: Subdomain Doesn't Resolve
**Cause:** DatabaseResolver not set for entity.id  
**Fix:** Execute Safe Transaction 2 (setResolver)

### Issue 3: "AlreadyRented" Error
**Cause:** Subdomain already registered  
**Fix:** Try different label or wait for expiry

### Issue 4: CCIP-Read Fails
**Cause:** Gateway offline or returning invalid signatures  
**Fix:** Check gateway logs, verify signer address matches DatabaseResolver

---

## What's Next? 🚀

Your entity.id subdomain registrar is now fully operational! You can:

1. **Build a Frontend UI:**
   - Let users browse available subdomains
   - Enable one-click registration (MetaMask)
   - Show rental expiry dates
   - Allow record management

2. **Add Features:**
   - Bulk registration discounts
   - Referral rewards
   - Custom rental periods (2 years, 5 years)
   - Transfer subdomain ownership
   - Automatic renewal

3. **Integrate with Demo-UI:**
   - Update contracts.ts with registrar address
   - Add subdomain rental page
   - Show registered subdomains in dashboard

4. **Deploy to Mainnet:**
   - Use same deployment script with `--network mainnet`
   - Change entity.id ownership to mainnet Safe
   - Update gateway URL to production endpoint

---

## Quick Reference Commands

```bash
# Verify setup
npx hardhat run scripts/verify-entity-id-registrar.js --network sepolia

# Test rental
npx hardhat run scripts/test-entity-id-rental.js --network sepolia

# Check contract
npx hardhat console --network sepolia

# View on Etherscan
https://sepolia.etherscan.io/address/0x67B4DDd24b2f00285018530ab72127BCEAFbFADd
```

---

## Support

If you encounter issues:
1. Check verification script output
2. Review Safe transaction history
3. Inspect Etherscan for failed transactions
4. Check gateway logs for CCIP-Read errors

**Your entity.id subdomain rental system is ready! 🎉**
