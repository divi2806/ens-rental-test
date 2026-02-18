const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Verify that entity.id subdomain registrar setup is complete
 * This checks:
 * 1. Registrar has operator approval
 * 2. DatabaseResolver is set for entity.id
 * 3. Registrar configuration is correct
 */

async function main() {
  console.log('\n✅ Verifying entity.id Subdomain Registrar Setup');
  console.log('━'.repeat(70), '\n');

  const config = JSON.parse(fs.readFileSync('./entity-id-config.json', 'utf8'));
  
  const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
  
  // Load contracts
  const ensAbi = [
    'function owner(bytes32 node) view returns (address)',
    'function resolver(bytes32 node) view returns (address)',
    'function isApprovedForAll(address owner, address operator) view returns (bool)'
  ];
  
  const registrarAbi = [
    'function parentNode() view returns (bytes32)',
    'function resolver() view returns (address)',
    'function rentalPrice() view returns (uint256)',
    'function owner() view returns (address)',
    'function ensRegistry() view returns (address)',
    'function isAvailable(string memory label) view returns (bool)',
    'function rentSubname(string memory label, address subdomainOwner) payable'
  ];

  const ensRegistry = new ethers.Contract(ENS_REGISTRY, ensAbi, ethers.provider);
  const registrar = new ethers.Contract(config.registrarProxy, registrarAbi, ethers.provider);

  let passed = 0;
  let failed = 0;

  // Check 1: entity.id owner
  console.log('📋 Check 1: entity.id Ownership');
  const entityIdOwner = await ensRegistry.owner(config.domainHash);
  console.log(`   Owner: ${entityIdOwner}`);
  console.log(`   Safe:  ${config.safeAddress}`);
  if (entityIdOwner.toLowerCase() === config.safeAddress.toLowerCase()) {
    console.log('   ✅ Safe owns entity.id\n');
    passed++;
  } else {
    console.log('   ❌ Owner mismatch!\n');
    failed++;
  }

  // Check 2: Registrar has approval
  console.log('📋 Check 2: Operator Approval (setApprovalForAll)');
  const isApproved = await ensRegistry.isApprovedForAll(config.safeAddress, config.registrarProxy);
  console.log(`   Safe:      ${config.safeAddress}`);
  console.log(`   Operator:  ${config.registrarProxy}`);
  console.log(`   Approved:  ${isApproved}`);
  if (isApproved) {
    console.log('   ✅ Registrar is approved as operator\n');
    passed++;
  } else {
    console.log('   ❌ Registrar NOT approved! Execute Safe Transaction 1.\n');
    failed++;
  }

  // Check 3: Resolver set
  console.log('📋 Check 3: DatabaseResolver Set for entity.id');
  const entityIdResolver = await ensRegistry.resolver(config.domainHash);
  console.log(`   Current:  ${entityIdResolver}`);
  console.log(`   Expected: ${config.databaseResolverAddress}`);
  if (entityIdResolver.toLowerCase() === config.databaseResolverAddress.toLowerCase()) {
    console.log('   ✅ DatabaseResolver is set\n');
    passed++;
  } else {
    console.log('   ❌ Resolver not set! Execute Safe Transaction 2.\n');
    failed++;
  }

  // Check 4: Registrar configuration
  console.log('📋 Check 4: Registrar Configuration');
  const parentNode = await registrar.parentNode();
  const registrarResolver = await registrar.resolver();
  const rentalPrice = await registrar.rentalPrice();
  const registrarOwner = await registrar.owner();
  const registrarEns = await registrar.ensRegistry();

  console.log(`   parentNode:  ${parentNode}`);
  console.log(`   Expected:    ${config.domainHash}`);
  if (parentNode === config.domainHash) {
    console.log('   ✅ Parent node correct');
    passed++;
  } else {
    console.log('   ❌ Parent node mismatch!');
    failed++;
  }

  console.log(`\n   resolver:    ${registrarResolver}`);
  console.log(`   Expected:    ${config.databaseResolverAddress}`);
  if (registrarResolver.toLowerCase() === config.databaseResolverAddress.toLowerCase()) {
    console.log('   ✅ Resolver correct');
    passed++;
  } else {
    console.log('   ❌ Resolver mismatch!');
    failed++;
  }

  console.log(`\n   rentalPrice: ${ethers.formatEther(rentalPrice)} ETH/year`);
  console.log(`   Expected:    ${config.rentalPrice} ETH/year`);
  if (ethers.formatEther(rentalPrice) === config.rentalPrice) {
    console.log('   ✅ Rental price correct');
    passed++;
  } else {
    console.log('   ⚠️  Rental price different (not critical)');
  }

  console.log(`\n   owner:       ${registrarOwner}`);
  console.log(`   Expected:    ${config.safeAddress}`);
  if (registrarOwner.toLowerCase() === config.safeAddress.toLowerCase()) {
    console.log('   ✅ Owner is Safe');
    passed++;
  } else {
    console.log('   ❌ Owner mismatch!');
    failed++;
  }

  console.log(`\n   ens:         ${registrarEns}`);
  console.log(`   Expected:    ${ENS_REGISTRY}`);
  if (registrarEns.toLowerCase() === ENS_REGISTRY.toLowerCase()) {
    console.log('   ✅ ENS Registry correct\n');
    passed++;
  } else {
    console.log('   ❌ ENS Registry mismatch!\n');
    failed++;
  }

  // Check 5: Test availability check
  console.log('📋 Check 5: Subdomain Availability Check');
  try {
    const testAvailable = await registrar.isAvailable('testdomain');
    console.log(`   isAvailable("testdomain"): ${testAvailable}`);
    console.log('   ✅ Availability check works\n');
    passed++;
  } catch (e) {
    console.log(`   ❌ Availability check failed: ${e.message}\n`);
    failed++;
  }

  // Summary
  console.log('━'.repeat(70));
  console.log(`\n📊 SUMMARY: ${passed} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log('🎉 ALL CHECKS PASSED!');
    console.log('\nYour entity.id subdomain registrar is FULLY OPERATIONAL!\n');
    console.log('Next steps:');
    console.log('  1. Test subdomain registration:');
    console.log('     npx hardhat run scripts/test-entity-id-rental.js --network sepolia\n');
    console.log('  2. Register your first subdomain:');
    console.log('     alice.entity.id, bob.entity.id, etc.\n');
  } else {
    console.log('❌ SETUP INCOMPLETE\n');
    console.log('Action required:');
    if (!isApproved) {
      console.log('  • Execute Safe Transaction 1 (setApprovalForAll)');
    }
    if (entityIdResolver.toLowerCase() !== config.databaseResolverAddress.toLowerCase()) {
      console.log('  • Execute Safe Transaction 2 (setResolver)');
    }
    console.log('\nRefer to SAFE-TRANSACTIONS-ENTITY-ID.md for instructions.\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
