# Using Different Domains

## Option 1: Use a Different .eth Domain (Recommended)

You can use **any** .eth domain you own! Examples:
- `divicompany.eth` ✅
- `myproject.eth` ✅
- `alice.eth` ✅
- `company123.eth` ✅

### How to Change:

**Step 1:** Open `scripts/01-wrap-domain.js`

**Step 2:** Change this line (around line 15):
```javascript
const DOMAIN = 'test282405.eth';  // Change this to your domain
```

To:
```javascript
const DOMAIN = 'divicompany.eth';  // Your actual domain
```

**Step 3:** Make sure you own it!
- Check ownership at: https://app.ens.domains
- Domain must be registered in your wallet
- Must be a `.eth` 2LD (second-level domain)

**Step 4:** Run the setup:
```bash
npx hardhat run scripts/01-wrap-domain.js --network sepolia
npx hardhat run scripts/02-deploy-registrar.js --network sepolia
npx hardhat run scripts/03-setup-permissions.js --network sepolia
npx hardhat run scripts/04-test-rental.js --network sepolia
```

---

## Option 2: Register a New .eth Domain

Don't have a domain yet? Register one!

### On Sepolia (Testnet - FREE):
```bash
# Option A: Use ENS App
https://app.ens.domains

# Option B: Use our script
npx hardhat run scripts/register-new-domain.js --network sepolia
```

### On Mainnet (Real ENS - Costs $):
1. Go to https://app.ens.domains
2. Search for available name
3. Register for 1+ years
4. Pay registration fee (varies by name length)

---

## ❌ Option 3: Non-.eth Domains (Advanced)

**Can you use other domains?**
- `.com` DNS domains? ❌ No
- `.crypto` domains? ❌ No (different system)
- `.xyz` ENS imports? ⚠️ Complicated
- Subdomains like `alice.mycompany.eth`? ✅ **Yes! This is perfect!**

### Using an Existing Subdomain You Own

**Example:** You own `company.eth` and already created `myteam.company.eth`

You can rent **sub-subdomains** like:
- `alice.myteam.company.eth` ✅
- `bob.myteam.company.eth` ✅

**Just change:**
```javascript
const DOMAIN = 'myteam.company.eth';  // Your subdomain
```

**Requirements:**
- Must be wrapped in Name Wrapper
- You must own it
- It must be on ENS

---

## 🎯 Which Option Should You Choose?

### Scenario 1: Testing / Learning
✅ Use `test282405.eth` (you already have it)
✅ Or register a random name on Sepolia

### Scenario 2: Real Production Service
✅ Register a branded .eth name on mainnet
✅ Examples: `mycompany.eth`, `rentals.eth`, `subnames.eth`

### Scenario 3: Subdomain of Your Existing Domain
✅ Use `team.yourcompany.eth` if you own `yourcompany.eth`
✅ Rent out `alice.team.yourcompany.eth`, etc.

---

## 🔧 Quick Start Templates

### Template 1: Brand New Domain
```javascript
// scripts/01-wrap-domain.js
const DOMAIN = 'mynewproject.eth';  // Register this first at app.ens.domains
```

### Template 2: Existing Domain
```javascript
// scripts/01-wrap-domain.js
const DOMAIN = 'myexisting.eth';  // Use what you already own
```

### Template 3: Subdomain
```javascript
// scripts/01-wrap-domain.js
const DOMAIN = 'team.mycompany.eth';  // If you own mycompany.eth
```

---

## 📋 Complete Checklist

Before running scripts, make sure:

- [ ] You own the domain (check at app.ens.domains)
- [ ] Domain is a .eth name (not .com, .crypto, etc.)
- [ ] You have ETH in your wallet (Sepolia ETH for testnet)
- [ ] Private key is in `.env` file
- [ ] Domain name is updated in `01-wrap-domain.js`

---

## 💡 Pro Tips

**Tip 1:** Test on Sepolia first
- Get free Sepolia ETH from faucets
- Register cheap test domains
- Once working, move to mainnet

**Tip 2:** Choose a good rental domain
- Short and memorable
- Relevant to your use case
- Examples: `dev.eth`, `web3team.eth`, `creators.eth`

**Tip 3:** Check domain availability
```bash
# Check if name is available
https://app.ens.domains/search?q=yourname
```

**Tip 4:** Cost planning (Mainnet)
- 5+ char .eth: ~$5/year
- 4 char .eth: ~$160/year  
- 3 char .eth: ~$640/year
- Plus gas fees for wrapping/deployment

---

## 🚀 Example: Full Setup with New Domain

Let's say you want to use `divicompany.eth`:

```bash
# 1. Register the domain (if you don't have it)
# Go to app.ens.domains and register "divicompany"

# 2. Update the script
# Edit scripts/01-wrap-domain.js, line 15:
const DOMAIN = 'divicompany.eth';

# 3. Run setup
cd ens-subdomain-rental
npm install
cp ../subdomain-rental-service/.env .env  # Copy your private key
npx hardhat run scripts/01-wrap-domain.js --network sepolia
npx hardhat run scripts/02-deploy-registrar.js --network sepolia
npx hardhat run scripts/03-setup-permissions.js --network sepolia

# 4. Test rental
npx hardhat run scripts/04-test-rental.js --network sepolia
# This creates alice.divicompany.eth!
```

---

## ❓ Common Questions

**Q: Can I use multiple domains with one contract?**
A: No, each contract is for ONE parent domain. Deploy multiple contracts for multiple domains.

**Q: Can renters create sub-subdomains?**
A: Yes! If Alice rents `alice.yourname.eth`, she can create `team.alice.yourname.eth`

**Q: What happens when rental expires?**
A: The subdomain becomes available again. Original renter loses control.

**Q: Can I change the domain later?**
A: No, it's set at deployment. Deploy a new contract for a different domain.

**Q: Does this work on mainnet?**
A: Yes! Just change network to `--network mainnet` and use mainnet ENS addresses.

---

## 📞 Need Help?

- ENS Documentation: https://docs.ens.domains
- ENS App: https://app.ens.domains
- ENS Discord: https://chat.ens.domains
