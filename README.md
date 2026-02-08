# ENS Subdomain Rental Service

Rent out subdomains of your ENS name to users.

## What This Does

If you own `divicompany.eth`, you can rent subdomains like:
- `alice.divicompany.eth` → Alice
- `bob.divicompany.eth` → Bob
- `company.divicompany.eth` → Some company

**Key Features:**
- ✅ Renters get full control during rental period
- ✅ You keep ownership of parent domain
- ✅ Guaranteed ownership via ENS fuses
- ✅ Subdomains are ERC-1155 NFTs
- ✅ Protocol-level expiry enforcement
- ✅ Automatic renewals

## How It Works

1. **You wrap your domain** (e.g., `divicompany.eth`) using ENS Name Wrapper
2. **Deploy the rental contract** pointing to your wrapped domain
3. **Grant contract permission** to create subdomains
4. **Users rent subdomains** by paying the rental fee
5. **Renters get ERC-1155 NFT** representing their subdomain
6. **After expiry**, subdomain becomes available again

## Architecture

```
divicompany.eth (YOU - wrapped in Name Wrapper)
    ├── SubnameRegistrar Contract
    │   ├── Creates subdomains
    │   ├── Sets PARENT_CANNOT_CONTROL fuse
    │   └── Enforces rental periods
    │
    ├── alice.divicompany.eth (Rented to Alice)
    │   └── Alice has full control during rental
    │
    └── bob.divicompany.eth (Rented to Bob)
        └── Bob has full control during rental
```

## Quick Start

### 1. Setup

```bash
cd ens-subdomain-rental
npm install
cp .env.example .env
# Edit .env with your private key
```

### 2. Wrap Your Domain

If you haven't wrapped your domain yet:

```bash
npx hardhat run scripts/01-wrap-domain.js --network sepolia
```

### 3. Deploy Rental Contract

```bash
npx hardhat run scripts/02-deploy-registrar.js --network sepolia
```

### 4. Setup Permissions

```bash
npx hardhat run scripts/03-setup-permissions.js --network sepolia
```

### 5. Test Rental

```bash
npx hardhat run scripts/04-test-rental.js --network sepolia
```

## Contract Configuration

- **Rental Price**: 0.001 ETH per year (customizable)
- **Rental Duration**: 365 days (customizable)
- **Fuses**: `PARENT_CANNOT_CONTROL | CANNOT_UNWRAP`

## Functions

### For Renters

- `rentSubname(label, renter)` - Rent a subdomain
- `renewSubname(label)` - Renew rental before expiry
- `isAvailable(label)` - Check if subdomain is available
- `getRentalInfo(label)` - Get rental details

### For Owner

- `updatePrice(newPrice)` - Change rental price
- `updateDuration(newDuration)` - Change rental duration
- `withdraw()` - Withdraw rental fees
- `transferOwnership(newOwner)` - Transfer contract ownership

## ENS Documentation

Based on official ENS guides:
- [Creating Subname Registrar](https://docs.ens.domains/wrapper/creating-subname-registrar)
- [Rent Subnames Use Case](https://docs.ens.domains/wrapper/usecases#sell-or-rent-subnames)

## Network Addresses (Sepolia)

- Name Wrapper: `0x0635513f179D50A207757E05759CbD106d7dFcE8`
- ENS Registry: `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
- Base Registrar: `0x084b1c3C81545d370f3634392De611CaaBFf8148`
- Public Resolver: `0x8FADE66B79cC9f707aB26799354482EB93a5B7dD`
