const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Step 5: Deploy OffchainResolver contract
 *
 * The resolver reverts with OffchainLookup (ERC-3668) to direct ENS clients
 * to our CCIP-Read gateway for sub-subdomain resolution.
 */

// Gateway URL template — {sender} and {data} are replaced by the CCIP-Read client
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001/{sender}/{data}.json';

async function main() {
  console.log('\n🚀 Deploying OffchainResolver');
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Load config
  if (!fs.existsSync('./config.json')) {
    console.error('❌ Config not found! Run previous scripts first\n');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

  console.log('Configuration:');
  console.log('  Domain:', config.domain);
  console.log('  Gateway URL:', GATEWAY_URL);
  console.log('  Signer (deployer):', deployer.address, '\n');

  // Deploy
  console.log('📝 Deploying OffchainResolver...\n');

  const OffchainResolver = await ethers.getContractFactory('OffchainResolver');
  const resolver = await OffchainResolver.deploy(GATEWAY_URL, deployer.address);

  await resolver.waitForDeployment();
  const contractAddress = await resolver.getAddress();

  console.log('✅ OffchainResolver deployed!');
  console.log('   Address:', contractAddress, '\n');

  // Verify deployment
  console.log('🔍 Verifying deployment...');
  const url = await resolver.url();
  const isSigner = await resolver.signers(deployer.address);
  const owner = await resolver.owner();

  console.log('   URL:', url);
  console.log('   Deployer is signer:', isSigner);
  console.log('   Owner:', owner);
  console.log('   Owner match:', owner.toLowerCase() === deployer.address.toLowerCase() ? '✅' : '❌', '\n');

  // Check ERC-165 support
  const supportsExtended = await resolver.supportsInterface('0x9061b923');
  console.log('   Supports IExtendedResolver:', supportsExtended ? '✅' : '❌', '\n');

  // Update config
  config.offchainResolverAddress = contractAddress;
  config.gatewayUrl = GATEWAY_URL;
  config.offchainResolverDeployedAt = new Date().toISOString();
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));

  console.log('💾 Config saved\n');

  console.log('━'.repeat(60));
  console.log('✅ OFFCHAIN RESOLVER DEPLOYED!');
  console.log('━'.repeat(60));
  console.log('\n🎯 Next Steps:');
  console.log('   1. Start the gateway:');
  console.log('      PRIVATE_KEY=... node gateway/server.js');
  console.log('   2. Rent subdomains & set resolver:');
  console.log('      npx hardhat run scripts/06-register-and-setup-subdomains.js --network sepolia\n');

  console.log('📍 Contract:', contractAddress);
  console.log('📍 Etherscan: https://sepolia.etherscan.io/address/' + contractAddress, '\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
