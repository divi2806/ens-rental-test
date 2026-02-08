const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Step 2: Deploy SubnameRegistrarDirect
 */

const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
const PUBLIC_RESOLVER = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD';

async function main() {
  console.log('\n🚀 Deploying SubnameRegistrarDirect');
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Load config
  if (!fs.existsSync('./config.json')) {
    console.error('❌ Config not found! Run 01-setup-direct-domain.js first\n');
    process.exit(1);
  }
  
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  
  console.log('Configuration:');
  console.log('  Domain:', config.domain);
  console.log('  Domain Hash:', config.domainHash);
  console.log('  ENS Registry:', ENS_REGISTRY);
  console.log('  Resolver:', PUBLIC_RESOLVER, '\n');

  // Deploy
  console.log('📝 Deploying SubnameRegistrarDirect...\n');
  
  const SubnameRegistrarDirect = await ethers.getContractFactory('SubnameRegistrarDirect');
  const registrar = await SubnameRegistrarDirect.deploy(
    ENS_REGISTRY,
    PUBLIC_RESOLVER,
    config.domainHash
  );
  
  await registrar.waitForDeployment();
  const contractAddress = await registrar.getAddress();
  
  console.log('✅ SubnameRegistrarDirect deployed!');
  console.log('   Address:', contractAddress, '\n');

  // Verify deployment
  console.log('🔍 Verifying deployment...');
  const parentNode = await registrar.parentNode();
  const rentalPrice = await registrar.rentalPrice();
  const owner = await registrar.owner();
  
  console.log('   Parent Node:', parentNode);
  console.log('   Rental Price:', ethers.formatEther(rentalPrice), 'ETH/year');
  console.log('   Owner:', owner);
  console.log('   Match:', owner.toLowerCase() === deployer.address.toLowerCase() ? '✅' : '❌\n');

  // Update config
  config.registrarAddress = contractAddress;
  config.rentalPrice = ethers.formatEther(rentalPrice);
  config.deployedAt = new Date().toISOString();
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
  
  console.log('💾 Config saved\n');
  
  console.log('━'.repeat(60));
  console.log('✅ DEPLOYMENT COMPLETE!');
  console.log('━'.repeat(60));
  console.log('\n🎯 Next Step:');
  console.log('   Transfer domain ownership to contract:');
  console.log('   npx hardhat run scripts/03-transfer-ownership.js --network sepolia\n');
  
  console.log('📍 Contract:', contractAddress);
  console.log('📍 Etherscan: https://sepolia.etherscan.io/address/' + contractAddress, '\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
