const hre = require('hardhat');
const ethers = hre.ethers;
const { upgrades } = require('hardhat');
const fs = require('fs');

/**
 * Step 2: Deploy SubnameRegistrar contract (UUPS Proxy)
 */

const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';

async function main() {
  console.log('\n🚀 Deploying SubnameRegistrar');
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Load config
  if (!fs.existsSync('./config.json')) {
    console.error('❌ Config not found! Run 01-wrap-domain.js first\n');
    process.exit(1);
  }
  
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  
  if (!config.wrapped) {
    console.error('❌ Domain not wrapped! Run 01-wrap-domain.js first\n');
    process.exit(1);
  }
  
  console.log('Configuration:');
  console.log('  Domain:', config.domain);
  console.log('  Domain Hash:', config.domainHash);
  console.log('  Name Wrapper:', NAME_WRAPPER, '\n');

  // Deploy with UUPS proxy
  console.log('📝 Deploying SubnameRegistrar (UUPS Proxy)...\n');
  
  const SubnameRegistrar = await ethers.getContractFactory('SubnameRegistrar');
  const registrar = await upgrades.deployProxy(
    SubnameRegistrar,
    [NAME_WRAPPER, config.domainHash, deployer.address],
    { kind: 'uups' }
  );
  
  await registrar.waitForDeployment();
  const proxyAddress = await registrar.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  
  console.log('✅ SubnameRegistrar deployed!');
  console.log('   Proxy Address:', proxyAddress);
  console.log('   Implementation Address:', implementationAddress, '\n');

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
  config.registrarAddress = proxyAddress;
  config.registrarImplementation = implementationAddress;
  config.rentalPrice = ethers.formatEther(rentalPrice);
  config.deployedAt = new Date().toISOString();
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
  
  console.log('💾 Config saved\n');
  
  console.log('━'.repeat(60));
  console.log('✅ DEPLOYMENT COMPLETE (UPGRADEABLE)!');
  console.log('━'.repeat(60));
  console.log('\n🎯 Next Step:');
  console.log('   Setup permissions:');
  console.log('   npx hardhat run scripts/03-setup-permissions.js --network sepolia\n');
  
  console.log('📍 Proxy:', proxyAddress);
  console.log('📍 Implementation:', implementationAddress);
  console.log('📍 Etherscan: https://sepolia.etherscan.io/address/' + proxyAddress, '\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
