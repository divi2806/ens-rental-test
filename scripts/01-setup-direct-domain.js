const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Step 1 (Alternative): Setup for domains already owned in ENS Registry
 * Use this if your domain is not in Base Registrar
 */

const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';

// YOUR DOMAIN HERE
const DOMAIN = 'divi.eth';

async function main() {
  console.log('\n🎁 Setting Up ENS Domain for Subdomain Rental');
  console.log('━'.repeat(60));
  console.log(`Domain: ${DOMAIN}`);
  console.log('━'.repeat(60), '\n');

  const [signer] = await ethers.getSigners();
  console.log('Your address:', signer.address);
  
  const balance = await ethers.provider.getBalance(signer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Check ownership in ENS Registry
  console.log('1️⃣  Checking domain ownership...');
  const registryAbi = [
    'function owner(bytes32 node) view returns (address)',
    'function setApprovalForAll(address operator, bool approved) external'
  ];
  const registry = new ethers.Contract(ENS_REGISTRY, registryAbi, signer);
  
  const namehash = ethers.namehash(DOMAIN);
  const owner = await registry.owner(namehash);
  
  console.log('   ENS Registry owner:', owner);
  console.log('   Your address:', signer.address);
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error('\n❌ You do not own this domain!');
    console.log(`   Owner: ${owner}`);
    console.log('   Please use a domain you own.\n');
    process.exit(1);
  }
  
  console.log('   ✅ You own this domain\n');
  
  // Since domain is directly owned, we can't wrap it the traditional way
  // Instead, we'll work directly with ENS Registry
  console.log('2️⃣  Domain configuration...');
  console.log('   ⚠️  This domain is owned directly in ENS Registry');
  console.log('   ✅ We can create subdomains without wrapping\n');
  
  // Save config
  const config = {
    domain: DOMAIN,
    domainHash: namehash,
    owner: signer.address,
    wrapped: false,
    directOwnership: true,
    note: 'Domain owned directly in ENS Registry, not Base Registrar'
  };
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
  
  console.log('💾 Configuration saved\n');
  
  console.log('━'.repeat(60));
  console.log('✅ SETUP COMPLETE!');
  console.log('━'.repeat(60));
  console.log('\n📋 Summary:');
  console.log(`   ✅ Domain: ${DOMAIN}`);
  console.log(`   ✅ Owner: ${signer.address}`);
  console.log(`   ⚠️  Not wrapped (direct ENS Registry ownership)`);
  console.log('   ✅ Ready for subdomain rentals\n');
  
  console.log('🎯 Next Step:');
  console.log('   Deploy rental contract:');
  console.log('   npx hardhat run scripts/02-deploy-registrar.js --network sepolia\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
