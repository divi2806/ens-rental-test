# Offchain Resolver Implementation Steps

## Overview
This document outlines the complete implementation of an ENS offchain resolver using CCIP-Read (ERC-3668). The system allows subdomain registration without gas costs by storing data offchain while maintaining on-chain ownership verification.

## Prerequisites
- Node.js and npm installed
- Hardhat project configured
- Wallet with Sepolia ETH
- ENS domain registered (divicompany.eth used in this implementation)

## Step 1: Gateway Server Setup

### Created Gateway Server Structure
```
ens-subdomain-rental/gateway/
├── server.js
├── package.json
└── subdomain-registrations.log (generated on startup)
```

### Gateway Implementation (server.js)
Key components:
- Express server on port 3001
- In-memory storage for subdomains (Map object)
- EIP-712 signature generation for verification
- CORS enabled for browser access

### Gateway Endpoints
- GET `/health` - Server health check
- GET `/subdomains` - List all registered subdomains
- POST `/register` - Register new offchain subdomain
- GET `/{sender}/{data}.json` - CCIP-Read resolver endpoint

### Start Gateway
```bash
cd ens-subdomain-rental/gateway
npm install
npm run gateway
```

Expected output:
```
Gateway server running on port 3001
Signer address: 0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595
```

## Step 2: Smart Contract Development

### Created OffchainResolver.sol
Location: `ens-subdomain-rental/contracts/OffchainResolver.sol`

Key features:
- Implements IExtendedResolver interface
- Reverts with OffchainLookup error (CCIP-Read mechanism)
- Verifies gateway signatures in resolveCallback
- Supports addr() and text() record queries

Contract functions:
- `resolve(bytes name, bytes data)` - Triggers offchain lookup
- `resolveCallback(bytes response, bytes extraData)` - Validates gateway response
- `setUrl(string[] urls)` - Configure gateway URLs
- `setSigners(address[] signers)` - Set authorized gateway signers

## Step 3: Deployment Scripts

### Script 1: Deploy OffchainResolver
File: `scripts/05-deploy-offchain-resolver.js`

Steps performed:
1. Get deployer wallet from Hardhat config
2. Deploy OffchainResolver contract
3. Configure gateway URL: `http://localhost:3001/{sender}/{data}.json`
4. Set signer address (same as deployer)
5. Verify contract supports IExtendedResolver
6. Save deployment info to config.json

Run command:
```bash
npx hardhat run scripts/05-deploy-offchain-resolver.js --network sepolia
```

Output:
```
Deploying OffchainResolver...
OffchainResolver deployed to: 0x69d89c8e75FA7F98dcB2295F73A2f91e216550c4
Setting gateway URL...
Gateway URL set successfully
Setting signer address...
Signer set successfully
Verification complete
```

### Script 2: Register On-chain Subdomains
File: `scripts/06-register-and-setup-subdomains.js`

Steps performed:
1. Load contract addresses from config.json
2. Connect to SubnameRegistrarDirect contract
3. Rent test.divicompany.eth (0.001 ETH for 365 days)
4. Rent test2.divicompany.eth (0.001 ETH for 365 days)
5. Set resolver for both to OffchainResolver address

Run command:
```bash
npx hardhat run scripts/06-register-and-setup-subdomains.js --network sepolia
```

Output:
```
Renting test.divicompany.eth...
Transaction hash: 0x834312a9ec607c841897197de7da06549f403e5a711b128594a10b1d8ceb0609
Setting resolver for test.divicompany.eth...
Resolver set successfully

Renting test2.divicompany.eth...
Transaction hash: 0xe46ff42c75dda8102659c39081b32fb8a68657b8b5611a461679f14606922317
Setting resolver for test2.divicompany.eth...
Resolver set successfully
```

### Script 3: Register Offchain Subdomains
File: `scripts/07-register-offchain-subdomains.js`

Steps performed:
1. Check gateway health endpoint
2. Calculate ENS namehash for each subdomain
3. POST to gateway /register endpoint with:
   - name (full subdomain)
   - node (namehash)
   - addr (Ethereum address)
   - texts (twitter, description, url)
4. Verify registration via /subdomains endpoint

Run command:
```bash
node scripts/07-register-offchain-subdomains.js
```

Output:
```
Gateway health check passed
Registering 1.test.divicompany.eth...
Successfully registered: 1.test.divicompany.eth
Node: 0x71d9964043b3911118b4b5470f0d1a53cdbd61bca3e98f0151191fb3e39bb297

Registering alice.test.divicompany.eth...
Successfully registered: alice.test.divicompany.eth
Node: 0x83db8bbc6b5c24f71ecc06f1ea7a86e0c27cdaa11e66f86a6dd071c6d4a7bd91

Registering a.test2.divicompany.eth...
Successfully registered: a.test2.divicompany.eth
Node: 0x4ef4e707c22be44f043129d09f25630c0f0fa06a0c55e1c0c6f60f9a0c13c1ab

Verification: Total registered: 3
```

## Step 4: Verification

### Gateway Health Check
```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "signer": "0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595",
  "subdomainCount": 3,
  "uptime": 9.646326083
}
```

### List Registered Subdomains
```bash
curl http://localhost:3001/subdomains
```

Response:
```json
{
  "count": 3,
  "subdomains": [
    {
      "node": "0x71d9964043b3911118b4b5470f0d1a53cdbd61bca3e98f0151191fb3e39bb297",
      "name": "1.test.divicompany.eth",
      "addr": "0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595",
      "texts": {
        "com.twitter": "@divicompany",
        "description": "First offchain subdomain",
        "url": "https://divicompany.eth"
      }
    },
    {
      "name": "alice.test.divicompany.eth",
      "texts": {
        "com.twitter": "@alice",
        "description": "Alice's offchain subdomain"
      }
    },
    {
      "name": "a.test2.divicompany.eth",
      "texts": {
        "description": "First offchain subdomain under test2.divicompany.eth"
      }
    }
  ]
}
```

### Check Gateway Logs
```bash
cat gateway/subdomain-registrations.log
```

## Step 5: How CCIP-Read Works

### Resolution Flow
1. Client queries ENS name (e.g., 1.test.divicompany.eth)
2. Resolver contract (OffchainResolver) receives query
3. Contract reverts with OffchainLookup error containing:
   - Gateway URL
   - Calldata to send
   - Callback function selector
4. Client catches error and calls gateway URL
5. Gateway returns signed response
6. Client calls resolveCallback() with gateway response
7. Contract verifies signature and returns data

### On-chain vs Offchain Cost Comparison
On-chain subdomain (traditional):
- Registration: 0.001 ETH + gas (~$8 total on Sepolia)
- Each record update: gas cost

Offchain subdomain (CCIP-Read):
- Registration: $0 (no transaction)
- Updates: $0 (POST to gateway)
- Only parent subdomain needs on-chain rental

## Key Files and Addresses

### Deployed Contracts
- SubnameRegistrarDirect: 0x2377e7FD75A4dE771d28e0BCF9909294bd0874Fa
- OffchainResolver: 0x69d89c8e75FA7F98dcB2295F73A2f91e216550c4

### Configuration
- Network: Sepolia Testnet
- Gateway URL: http://localhost:3001
- Wallet: 0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595

### On-chain Subdomains
- test.divicompany.eth (node: 0x100c605da9c627fef49b114d682ff596b16f3e47df8401864fe81997e415b861)
- test2.divicompany.eth (node: 0x9cebf732803f7b7a3b80e9c9e310f6f9954e1d9001d57fec3591ee81c8ad6cb1)

### Offchain Subdomains
- 1.test.divicompany.eth
- alice.test.divicompany.eth
- a.test2.divicompany.eth

## Running the Full System

### Terminal 1: Start Gateway
```bash
cd ens-subdomain-rental/gateway
npm run gateway
```

### Terminal 2: Deploy and Setup
```bash
cd ens-subdomain-rental

# Deploy resolver
npx hardhat run scripts/05-deploy-offchain-resolver.js --network sepolia

# Rent and setup on-chain subdomains
npx hardhat run scripts/06-register-and-setup-subdomains.js --network sepolia

# Register offchain subdomains
node scripts/07-register-offchain-subdomains.js
```

### Verify Everything Works
```bash
# Check gateway health
curl http://localhost:3001/health

# List all subdomains
curl http://localhost:3001/subdomains

# Check logs
cat gateway/subdomain-registrations.log
```

## Production Considerations

### Required Changes
1. Deploy gateway to production server with HTTPS
2. Update OffchainResolver with production gateway URL
3. Replace in-memory storage with database (MongoDB/PostgreSQL)
4. Add authentication for registration endpoint
5. Implement rate limiting
6. Set up monitoring and logging
7. Configure CORS for production domains
8. Deploy to Ethereum mainnet

### Security
- Gateway signatures prevent data tampering
- Only authorized signers can generate valid responses
- Clients verify signatures before accepting data
- OffchainResolver verifies all callbacks

## Transaction Hashes (Sepolia)

### OffchainResolver Deployment
- Contract: 0x69d89c8e75FA7F98dcB2295F73A2f91e216550c4
- Etherscan: https://sepolia.etherscan.io/address/0x69d89c8e75FA7F98dcB2295F73A2f91e216550c4

### On-chain Subdomain Registrations
- test.divicompany.eth rental: 0x834312a9ec607c841897197de7da06549f403e5a711b128594a10b1d8ceb0609
- test.divicompany.eth resolver: 0x9b31acf2b853728ca670d18f0e47fba6bd3cc30f028137a08084a05368dfe2f3
- test2.divicompany.eth rental: 0xe46ff42c75dda8102659c39081b32fb8a68657b8b5611a461679f14606922317
- test2.divicompany.eth resolver: 0xb3cd87b106b85d6e18fd5ad9163b1be349f39cca65cff1d7f70da39ee5bd9081
