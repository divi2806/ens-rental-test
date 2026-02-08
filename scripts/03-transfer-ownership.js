const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Step 3: Transfer domain ownership to contract
 */

const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

async function main() {
  console.log('\n🔐 Transferring Domain Ownership');
  console.log('━'.repeat(60), '\n');

  const [signer] = await ethers.getSigners();
  console.log('Your address:', signer.address);
  
  const balance = await ethers.provider.getBalance(signer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Load config
  if (!fs.existsSync('./config.json')) {
    console.error('❌ Config not found!\n');
    process.exit(1);
  }
  
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  
  if (!config.registrarAddress) {
    console.error('❌ Registrar not deployed! Run 02-deploy-direct-registrar.js first\n');
    process.exit(1);
  }
  
  console.log('Configuration:');
  console.log('  Domain:', config.domain);
  console.log('  Registrar:', config.registrarAddress, '\n');

  // Transfer ownership
  console.log('1️⃣  Transferring domain ownership to contract...');
  console.log('   This allows the contract to create subdomains on your behalf\n');
  
  const registryAbi = [
    'function setOwner(bytes32 node, address owner) external',
    'function owner(bytes32 node) view returns (address)'
  ];
  
  const registry = new ethers.Contract(ENS_REGISTRY, registryAbi, signer);
  
  const tx = await registry.setOwner(config.domainHash, config.registrarAddress);
  console.log('   TX:', tx.hash);
  await tx.wait();
  console.log('   ✅ Ownership transferred!\n');
  
  // Verify
  console.log('2️⃣  Verifying ownership...');
  const newOwner = await registry.owner(config.domainHash);
  console.log('   New owner:', newOwner);
  console.log('   Expected:', config.registrarAddress);
  console.log('   Match:', newOwner.toLowerCase() === config.registrarAddress.toLowerCase() ? '✅' : '❌\n');
  
  if (newOwner.toLowerCase() !== config.registrarAddress.toLowerCase()) {
    console.error('❌ Transfer failed!\n');
    process.exit(1);
  }
  
  // Update config
  config.ownershipTransferred = true;
  config.setupComplete = true;
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
  
  console.log('━'.repeat(60));
  console.log('✅ SETUP COMPLETE!');
  console.log('━'.repeat(60));
  console.log('\n🎉 Your subdomain rental service is ready!');
  console.log('\n📋 Summary:');
  console.log(`   ✅ Domain ${config.domain} ownership transferred`);
  console.log(`   ✅ SubnameRegistrar deployed at ${config.registrarAddress}`);
  console.log(`   ✅ Rental price: ${config.rentalPrice} ETH/year\n`);
  
  console.log('🎯 Next Step:');
  console.log('   Test renting a subdomain:');
  console.log('   npx hardhat run scripts/04-test-direct-rental.js --network sepolia\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });