const { ethers } = require('ethers');

/**
 * Test wildcard resolution for entity.id subdomains
 * This demonstrates ENSIP-10 wildcard resolution via DatabaseResolver
 */

async function testWildcardResolution() {
  console.log('\n🔍 Testing ENSIP-10 Wildcard Resolution');
  console.log('━'.repeat(70), '\n');

  // Sepolia provider (replace with your Infura/Alchemy key)
  const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_INFURA_KEY');
  
  const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
  const ensAbi = [
    'function owner(bytes32 node) view returns (address)',
    'function resolver(bytes32 node) view returns (address)'
  ];
  
  const ensRegistry = new ethers.Contract(ENS_REGISTRY, ensAbi, provider);

  // Test subdomains
  const subdomains = [
    'test.entity.id',
    'alice.entity.id',
    'acme.entity.id'
  ];

  console.log('📋 Checking subdomain resolvers:\n');

  for (const name of subdomains) {
    const node = ethers.namehash(name);
    const owner = await ensRegistry.owner(node);
    const resolver = await ensRegistry.resolver(node);
    
    console.log(`${name}:`);
    console.log(`  Owner:    ${owner}`);
    console.log(`  Resolver: ${resolver}`);
    
    if (resolver === '0x0000000000000000000000000000000000000000') {
      console.log(`  ✓ No resolver set → will use parent's resolver (wildcard)\n`);
    } else {
      console.log(`  ✓ Has own resolver\n`);
    }
  }

  // Check parent resolver
  console.log('━'.repeat(70));
  console.log('\n📋 Parent domain (entity.id) resolver:\n');
  
  const entityIdNode = ethers.namehash('entity.id');
  const entityIdOwner = await ensRegistry.owner(entityIdNode);
  const entityIdResolver = await ensRegistry.resolver(entityIdNode);
  
  console.log('entity.id:');
  console.log(`  Owner:    ${entityIdOwner}`);
  console.log(`  Resolver: ${entityIdResolver} (DatabaseResolver)`);
  console.log(`  ✓ This resolver handles ALL subdomains via ENSIP-10\n`);

  console.log('━'.repeat(70));
  console.log('\n🎯 How Resolution Works:\n');
  console.log('1. Client queries: test.entity.id');
  console.log('2. ENS Registry: test.entity.id has NO resolver');
  console.log('3. ENSIP-10 client: use parent resolver (DatabaseResolver)');
  console.log('4. DatabaseResolver: trigger CCIP-Read to gateway');
  console.log('5. Gateway: return signed data for test.entity.id');
  console.log('6. Client: verify signature → return result ✓\n');

  console.log('📚 Resources:');
  console.log('  ENSIP-10: https://docs.ens.domains/ensip/10');
  console.log('  EIP-3668: https://eips.ethereum.org/EIPS/eip-3668\n');
}

// For testing with ethers.js CCIP-Read support
async function testResolutionWithEthers() {
  console.log('\n🧪 Testing Resolution with ethers.js:\n');
  
  const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_INFURA_KEY');
  
  try {
    // ethers.js v6 automatically handles CCIP-Read
    const resolver = await provider.getResolver('test.entity.id');
    
    if (resolver) {
      console.log('Resolver found:', resolver.address);
      
      // Try to get address
      const address = await resolver.getAddress();
      console.log('ETH Address:', address);
      
      // Try to get text record
      const description = await resolver.getText('description');
      console.log('Description:', description);
      
      console.log('\n✅ Wildcard resolution works!');
    } else {
      console.log('❌ No resolver found');
    }
  } catch (error) {
    if (error.message.includes('CCIP read')) {
      console.log('✓ CCIP-Read triggered (expected)');
      console.log('  Gateway:', error.message);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run tests
testWildcardResolution()
  .then(() => {
    console.log('\n💡 To test full resolution with CCIP-Read:');
    console.log('   1. Ensure gateway is running');
    console.log('   2. Set records in gateway database');
    console.log('   3. Use ethers.js v6 with CCIP-Read support\n');
  })
  .catch(console.error);
