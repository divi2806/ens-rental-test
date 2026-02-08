const hre = require('hardhat');
const ethers = hre.ethers;

/**
 * Check what ENS domains you own
 */

const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

// Test some common patterns
const TEST_DOMAINS = [
  'test282405.eth',
  'divyansh.eth',
  'divi.eth',
  'testdomain.eth'
];

async function main() {
  console.log('\n🔍 Checking Domain Ownership');
  console.log('━'.repeat(60), '\n');

  const [signer] = await ethers.getSigners();
  console.log('Your address:', signer.address, '\n');

  const registryAbi = ['function owner(bytes32 node) view returns (address)'];
  const registry = new ethers.Contract(ENS_REGISTRY, registryAbi, signer);

  console.log('Checking domains...\n');
  
  for (const domain of TEST_DOMAINS) {
    const namehash = ethers.namehash(domain);
    try {
      const owner = await registry.owner(namehash);
      const youOwn = owner.toLowerCase() === signer.address.toLowerCase();
      
      console.log(`${youOwn ? '✅' : '❌'} ${domain}`);
      console.log(`   Owner: ${owner}`);
      console.log(`   You: ${youOwn ? 'YES' : 'NO'}\n`);
    } catch (error) {
      console.log(`❌ ${domain} - Error checking\n`);
    }
  }
  
  console.log('━'.repeat(60));
  console.log('\n💡 Options:');
  console.log('   1. Register a new domain at https://app.ens.domains');
  console.log('   2. Or I can help you register a random test domain\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
