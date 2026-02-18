# Contract Upgradability Guide

## Overview

All contracts in this project have been converted to use the UUPS (Universal Upgradeable Proxy Standard) pattern from OpenZeppelin. This allows contracts to be upgraded without changing their addresses or losing state.

## What Changed

### Contracts Converted to UUPS

1. OffchainResolver
2. SubnameRegistrar
3. SubnameRegistrarDirect

### Key Modifications

Each contract was modified as follows:

1. Added OpenZeppelin upgradeable imports
   - Initializable
   - UUPSUpgradeable
   - OwnableUpgradeable
   - Upgradeable versions of utility contracts (ECDSA, ERC165, etc.)

2. Replaced constructor with initialize function
   - UUPS proxies use initialize() instead of constructors
   - Initialize function can only be called once
   - Constructor is disabled with _disableInitializers()

3. Removed immutable variables
   - Changed from immutable to regular state variables
   - Required because proxy pattern separates storage from logic

4. Added _authorizeUpgrade function
   - Required by UUPS pattern
   - Restricts who can upgrade the contract (onlyOwner)

5. Used OwnableUpgradeable instead of custom ownership
   - Provides standard transferOwnership functionality
   - owner() replaces owner state variable

## How UUPS Works

### Proxy Pattern

The UUPS pattern uses two contracts:

1. Proxy Contract
   - Stores all state variables
   - Forwards all calls to implementation contract
   - Address never changes
   - Users interact with this address

2. Implementation Contract
   - Contains all the logic
   - Can be upgraded by deploying new implementation
   - Address changes on upgrade

### Upgrade Flow

```
User → Proxy (storage) → Implementation V1 (logic)
                      ↓ (upgrade)
User → Proxy (storage) → Implementation V2 (logic)
```

State is preserved because it lives in the Proxy.

## Deployment

### Install Dependencies

```bash
pnpm add @openzeppelin/contracts-upgradeable
pnpm add -D @openzeppelin/hardhat-upgrades
```

### Deploy with Proxy

All deployment scripts have been updated to use proxy deployment:

#### Deploy SubnameRegistrarDirect
```bash
npx hardhat run scripts/02-deploy-direct-registrar.js --network sepolia
```

Output will show:
- Proxy Address (interact with this)
- Implementation Address (logic contract)

#### Deploy SubnameRegistrar
```bash
npx hardhat run scripts/02-deploy-registrar.js --network sepolia
```

#### Deploy OffchainResolver
```bash
npx hardhat run scripts/05-deploy-offchain-resolver.js --network sepolia
```

### Configuration Storage

After deployment, config.json stores:

```json
{
  "registrarAddress": "0x...",          // Proxy address
  "registrarImplementation": "0x...",    // Implementation address
  "offchainResolverAddress": "0x...",
  "offchainResolverImplementation": "0x..."
}
```

## Upgrading Contracts

### When to Upgrade

Upgrade when you need to:
- Fix bugs in contract logic
- Add new features
- Optimize gas usage
- Change business logic

### What is Preserved

After upgrade:
- Contract address (proxy) stays the same
- All state variables remain intact
- All balances and mappings preserved
- Users continue using same address

### How to Upgrade

Use the generic upgrade script:

#### Upgrade OffchainResolver
```bash
CONTRACT_NAME=OffchainResolver npx hardhat run scripts/upgrade-contract.js --network sepolia
```

#### Upgrade SubnameRegistrar
```bash
CONTRACT_NAME=SubnameRegistrar npx hardhat run scripts/upgrade-contract.js --network sepolia
```

#### Upgrade SubnameRegistrarDirect
```bash
CONTRACT_NAME=SubnameRegistrarDirect npx hardhat run scripts/upgrade-contract.js --network sepolia
```

### Upgrade Process

1. Make changes to contract code
2. Compile contracts: `npx hardhat compile`
3. Run upgrade script with CONTRACT_NAME env variable
4. Script will:
   - Load proxy address from config
   - Deploy new implementation
   - Update proxy to point to new implementation
   - Verify upgrade successful
   - Update config.json

### Upgrade Output

```
Upgrading OffchainResolver
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Deployer: 0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595
Balance: 9.697 ETH

Configuration:
  Contract: OffchainResolver
  Proxy Address: 0x69d89c8e75FA7F98dcB2295F73A2f91e216550c4

Current Implementation: 0x1234...

Upgrading contract...

Contract upgraded!
   Proxy Address: 0x69d89c8e75FA7F98dcB2295F73A2f91e216550c4
   Old Implementation: 0x1234...
   New Implementation: 0x5678...

Config updated
```

## Important Rules

### Storage Layout

When upgrading, you MUST follow these rules:

1. Do NOT change order of existing state variables
2. Do NOT change types of existing state variables
3. Do NOT remove existing state variables
4. You CAN add new state variables at the end
5. You CAN add new functions

### Example - Safe Upgrade

Before:
```solidity
contract MyContract {
    uint256 public price;
    address public owner;
}
```

After (Safe):
```solidity
contract MyContract {
    uint256 public price;
    address public owner;
    uint256 public newFeature;  // Added at end - SAFE
}
```

After (Unsafe):
```solidity
contract MyContract {
    uint256 public newFeature;  // Added at start - BREAKS STORAGE
    uint256 public price;
    address public owner;
}
```

### Initialize Function

- Can only be called once
- Called automatically during proxy deployment
- Cannot be called again after initial deployment
- Use reinitializer modifier if you need to run initialization logic during upgrade

## Security Considerations

### Access Control

Only the contract owner can upgrade:
```solidity
function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
```

### Testing Upgrades

Before upgrading on mainnet:

1. Test on local network (Hardhat)
2. Test on testnet (Sepolia)
3. Verify storage layout compatibility
4. Audit new implementation code
5. Have rollback plan ready

### Verification

After upgrade, verify:

1. All existing functionality still works
2. New features work as expected
3. State variables have correct values
4. Owner is still correct address

## Comparison with Previous Version

### Before (Non-Upgradeable)

```solidity
contract OffchainResolver {
    address public owner;
    
    constructor(string memory _url, address _signer) {
        owner = msg.sender;
    }
}
```

Deployment:
```javascript
const contract = await OffchainResolver.deploy(url, signer);
```

Problems:
- Cannot fix bugs
- Cannot add features
- Must deploy new contract and migrate users

### After (Upgradeable)

```solidity
contract OffchainResolver is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    constructor() {
        _disableInitializers();
    }
    
    function initialize(string memory _url, address _signer, address _owner) public initializer {
        __Ownable_init(_owner);
        // ...
    }
    
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
```

Deployment:
```javascript
const contract = await upgrades.deployProxy(
    OffchainResolver,
    [url, signer, owner],
    { kind: 'uups' }
);
```

Benefits:
- Can fix bugs by upgrading
- Can add features without changing address
- Users keep using same contract address
- All state preserved across upgrades

## Migration from Old Contracts

If you deployed contracts with the old non-upgradeable version:

1. Deploy new UUPS version
2. Update frontend to use new proxy address
3. Migrate any stored data from old contract
4. Old contracts remain at their addresses but are deprecated

## Additional Resources

- OpenZeppelin Upgrades Plugins: https://docs.openzeppelin.com/upgrades-plugins
- UUPS vs Transparent Proxy: https://docs.openzeppelin.com/contracts/4.x/api/proxy
- Writing Upgradeable Contracts: https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable

## Quick Reference

### Commands

```bash
# Deploy new proxy
npx hardhat run scripts/02-deploy-direct-registrar.js --network sepolia

# Upgrade existing proxy
CONTRACT_NAME=SubnameRegistrarDirect npx hardhat run scripts/upgrade-contract.js --network sepolia

# Compile contracts
npx hardhat compile

# Check storage layout
npx hardhat check
```

### Contract Addresses

Always use proxy addresses for interaction:
- config.registrarAddress (proxy)
- config.offchainResolverAddress (proxy)

Implementation addresses are for reference only.
