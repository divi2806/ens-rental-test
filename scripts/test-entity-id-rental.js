const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Test entity.id subdomain rental
 * 
 * This script:
 * 1. Checks availability of a subdomain
 * 2. Rents it by paying 0.001 ETH/year
 * 3. Verifies ownership and resolution
 */

async function main() {
  console.log('\n🧪 Testing entity.id Subdomain Rental');
  console.log('━'.repeat(70), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  const config = JSON.parse(fs.readFileSync('./entity-id-config.json', 'utf8'));
  console.log('Registrar:', config.registrarProxy);
  console.log('Domain:', config.domain, '\n');

  const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

  // Load contracts
  const registrarAbi = [
    'function parentNode() view returns (bytes32)',
    'function resolver() view returns (address)',
    'function rentalPrice() view returns (uint256)',
    'function isAvailable(string memory label) view returns (bool)',
    'function getRentalInfo(string memory label) view returns (address renter, uint256 expiryTime)',
    'function rentSubname(string memory label, address subdomainOwner) payable',
    'event SubnameRented(bytes32 indexed parentNode, string label, address indexed owner, uint256 expiryTime)'
  ];

  const ensAbi = [
    'function owner(bytes32 node) view returns (address)',
    'function resolver(bytes32 node) view returns (address)'
  ];

  const registrar = new ethers.Contract(config.registrarProxy, registrarAbi, deployer);
  const ensRegistry = new ethers.Contract(ENS_REGISTRY, ensAbi, ethers.provider);

  const rentalPrice = await registrar.rentalPrice();
  console.log('💰 Rental Price:', ethers.formatEther(rentalPrice), 'ETH/year\n');

  // Subdomain to test
  const label = 'test'; // Will create test.entity.id
  const fullName = `${label}.${config.domain}`;
  
  console.log(`📝 Testing subdomain: ${fullName}\n`);

  // Step 1: Check availability
  console.log('1️⃣  Checking availability...');
  const available = await registrar.isAvailable(label);
  console.log(`   Available: ${available}\n`);

  if (!available) {
    console.log('   ℹ️  Already rented! Checking details...');
    const info = await registrar.getRentalInfo(label);
    console.log(`   Owner: ${info[0]}`);
    console.log(`   Expires: ${new Date(Number(info[1]) * 1000).toLocaleString()}\n`);
    
    if (info[0].toLowerCase() === deployer.address.toLowerCase()) {
      console.log('   ✅ You already own this subdomain!');
      console.log(`\n🎉 SUCCESS! ${fullName} is already registered to you.\n`);
      return;
    } else {
      console.log(`   ⚠️  This subdomain is owned by someone else.`);
      console.log(`   Try a different label or wait for expiry.\n`);
      return;
    }
  }

  // Step 2: Estimate gas
  console.log('2️⃣  Estimating gas...');
  try {
    const gasEstimate = await registrar.rentSubname.estimateGas(label, deployer.address, {
      value: rentalPrice
    });
    console.log(`   Gas estimate: ${gasEstimate.toString()}\n`);
  } catch (e) {
    console.log('   ❌ Gas estimation failed!');
    console.log(`   Error: ${e.message}\n`);
    
    // Check common issues
    console.log('🔍 Debugging:');
    const isApproved = await ensRegistry.isApprovedForAll(config.safeAddress, config.registrarProxy);
    console.log(`   Registrar approved: ${isApproved}`);
    
    if (!isApproved) {
      console.log('\n❌ PROBLEM: Registrar is NOT approved!');
      console.log('   Run verification script:');
      console.log('   npx hardhat run scripts/verify-entity-id-registrar.js --network sepolia\n');
      return;
    }
    
    const entityResolver = await ensRegistry.resolver(config.domainHash);
    console.log(`   entity.id resolver: ${entityResolver}`);
    console.log(`   Expected: ${config.databaseResolverAddress}\n`);
    
    return;
  }

  // Step 3: Rent the subdomain
  console.log('3️⃣  Renting subdomain...');
  console.log(`   Sending ${ethers.formatEther(rentalPrice)} ETH...\n`);

  const tx = await registrar.rentSubname(label, deployer.address, {
    value: rentalPrice,
    gasLimit: 500000 // Set reasonable gas limit
  });

  console.log(`   Transaction hash: ${tx.hash}`);
  console.log(`   Waiting for confirmation...\n`);

  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);

  // Step 4: Verify rental
  console.log('4️⃣  Verifying rental...');
  const rentalInfo = await registrar.getRentalInfo(label);
  console.log(`   Owner: ${rentalInfo[0]}`);
  console.log(`   Expires: ${new Date(Number(rentalInfo[1]) * 1000).toLocaleString()}\n`);

  if (rentalInfo[0].toLowerCase() === deployer.address.toLowerCase()) {
    console.log('   ✅ Ownership verified!\n');
  } else {
    console.log('   ❌ Ownership verification failed!\n');
  }

  // Step 5: Check ENS Registry
  console.log('5️⃣  Checking ENS Registry...');
  const namehash = ethers.namehash(fullName);
  console.log(`   namehash(${fullName}): ${namehash}`);
  
  const subdomainOwner = await ensRegistry.owner(namehash);
  console.log(`   ENS owner: ${subdomainOwner}`);
  
  if (subdomainOwner.toLowerCase() === deployer.address.toLowerCase()) {
    console.log('   ✅ ENS ownership verified!\n');
  } else {
    console.log(`   ⚠️  ENS owner is different\n`);
  }

  const subdomainResolver = await ensRegistry.resolver(namehash);
  console.log(`   ENS resolver: ${subdomainResolver}`);
  console.log(`   Expected: ${config.databaseResolverAddress}`);
  
  if (subdomainResolver.toLowerCase() === config.databaseResolverAddress.toLowerCase()) {
    console.log('   ✅ Resolver verified!\n');
  } else {
    console.log('   ⚠️  Resolver is different\n');
  }

  // Summary
  console.log('━'.repeat(70));
  console.log('\n🎉 SUBDOMAIN RENTAL TEST COMPLETE!\n');
  console.log(`Subdomain: ${fullName}`);
  console.log(`Owner: ${deployer.address}`);
  console.log(`Expires: ${new Date(Number(rentalInfo[1]) * 1000).toLocaleString()}`);
  console.log(`Cost: ${ethers.formatEther(rentalPrice)} ETH\n`);

  console.log('📋 Next Steps:');
  console.log('  1. Set address record via CCIP-Read gateway');
  console.log(`     POST ${config.databaseResolverAddress.replace('0x82824646121ea4c48613ba9feff3c9372036324f', 'https://seashell-app-sajbl.ondigitalocean.app')}/setAddr`);
  console.log(`     { "name": "${fullName}", "address": "${deployer.address}" }\n`);
  console.log('  2. Resolve the subdomain:');
  console.log(`     const resolver = await provider.getResolver("${fullName}");`);
  console.log(`     const address = await resolver.getAddress();\n`);
  console.log('  3. Check resolution in ethers.js or ens.domains app\n');

  console.log(`🔗 View on Etherscan:`);
  console.log(`   https://sepolia.etherscan.io/tx/${tx.hash}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
