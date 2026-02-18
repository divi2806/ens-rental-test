const hre = require('hardhat');
const ethers = hre.ethers;

/**
 * Verify wildcard resolution setup for entity.id
 */

async function main() {
  console.log('\n🔍 Verifying Wildcard Resolution Setup');
  console.log('━'.repeat(70), '\n');

  const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
  const DATABASE_RESOLVER = '0x82824646121ea4c48613ba9feff3c9372036324f';
  
  const ensAbi = [
    'function owner(bytes32 node) view returns (address)',
    'function resolver(bytes32 node) view returns (address)'
  ];
  
  const ensRegistry = new ethers.Contract(ENS_REGISTRY, ensAbi, ethers.provider);

  // Check entity.id (parent)
  console.log('📋 Parent Domain Check:\n');
  const entityIdNode = ethers.namehash('entity.id');
  const entityIdOwner = await ensRegistry.owner(entityIdNode);
  const entityIdResolver = await ensRegistry.resolver(entityIdNode);
  
  console.log('entity.id:');
  console.log(`  namehash:  ${entityIdNode}`);
  console.log(`  owner:     ${entityIdOwner}`);
  console.log(`  resolver:  ${entityIdResolver}`);
  
  if (entityIdResolver.toLowerCase() === DATABASE_RESOLVER.toLowerCase()) {
    console.log('  ✅ DatabaseResolver is set (wildcard resolver)\n');
  } else {
    console.log('  ❌ DatabaseResolver NOT set!\n');
    return;
  }

  // Check subdomains
  console.log('━'.repeat(70));
  console.log('\n📋 Subdomain Status:\n');

  const subdomains = ['test', 'alice', 'acme', 'company'];
  
  for (const label of subdomains) {
    const fullName = `${label}.entity.id`;
    const node = ethers.namehash(fullName);
    const owner = await ensRegistry.owner(node);
    const resolver = await ensRegistry.resolver(node);
    
    const exists = owner !== '0x0000000000000000000000000000000000000000';
    const hasResolver = resolver !== '0x0000000000000000000000000000000000000000';
    
    console.log(`${fullName}:`);
    console.log(`  namehash:  ${node}`);
    console.log(`  exists:    ${exists ? '✓ YES' : '✗ NO'}`);
    console.log(`  owner:     ${owner}`);
    console.log(`  resolver:  ${resolver}`);
    
    if (exists && !hasResolver) {
      console.log('  🎯 WILDCARD: Will use parent resolver (DatabaseResolver)');
    } else if (!exists) {
      console.log('  ℹ️  Not registered yet');
    } else if (hasResolver) {
      console.log('  ℹ️  Has own resolver (not using wildcard)');
    }
    console.log('');
  }

  // Explain resolution flow
  console.log('━'.repeat(70));
  console.log('\n🎯 How ENSIP-10 Wildcard Resolution Works:\n');
  console.log('Example: Resolving alice.entity.id\n');
  console.log('Step 1: Client queries ENS Registry for alice.entity.id');
  console.log('        → owner: 0x8d67... (exists!)');
  console.log('        → resolver: 0x0000... (not set)\n');
  console.log('Step 2: Client detects no resolver, checks parent (entity.id)');
  console.log('        → entity.id resolver: DatabaseResolver (0x8282...)\n');
  console.log('Step 3: Client calls DatabaseResolver.resolve("alice.entity.id", data)');
  console.log('        → DatabaseResolver triggers CCIP-Read OffchainLookup\n');
  console.log('Step 4: Client fetches from gateway:');
  console.log('        → URL: https://seashell-app-sajbl.ondigitalocean.app');
  console.log('        → Query: { name: "alice.entity.id", data: ... }\n');
  console.log('Step 5: Gateway returns signed data from database');
  console.log('        → { result: "0x...", signature: "0x..." }\n');
  console.log('Step 6: Client calls DatabaseResolver.resolveWithProof()');
  console.log('        → Verifies signature ✓');
  console.log('        → Returns result ✓\n');
  
  console.log('━'.repeat(70));
  console.log('\n✅ WILDCARD RESOLUTION IS READY!\n');
  console.log('Benefits:');
  console.log('  • No need to set resolver on each subdomain');
  console.log('  • Single DatabaseResolver handles all subdomains');
  console.log('  • Gateway stores all records in database');
  console.log('  • CCIP-Read verification ensures data integrity\n');
  
  console.log('Next Steps:');
  console.log('  1. Ensure gateway is running and has database records');
  console.log('  2. Test resolution with ethers.js v6 (has CCIP-Read support)');
  console.log('  3. Query any subdomain: test.entity.id, alice.entity.id, etc.\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
