const hre = require('hardhat');
const ethers = hre.ethers;
const { upgrades } = require('hardhat');
const fs = require('fs');

/**
 * Upgrade any UUPS contract
 * 
 * Usage:
 *   CONTRACT_NAME=OffchainResolver npx hardhat run scripts/upgrade-contract.js --network sepolia
 *   CONTRACT_NAME=SubnameRegistrar npx hardhat run scripts/upgrade-contract.js --network sepolia
 *   CONTRACT_NAME=SubnameRegistrarDirect npx hardhat run scripts/upgrade-contract.js --network sepolia
 */

const VALID_CONTRACTS = ['OffchainResolver', 'SubnameRegistrar', 'SubnameRegistrarDirect'];

async function main() {
  const contractName = process.env.CONTRACT_NAME;
  
  if (!contractName) {
    console.error('❌ CONTRACT_NAME environment variable not set');
    console.log('\nUsage:');
    console.log('  CONTRACT_NAME=OffchainResolver npx hardhat run scripts/upgrade-contract.js --network sepolia');
    console.log('  CONTRACT_NAME=SubnameRegistrar npx hardhat run scripts/upgrade-contract.js --network sepolia');
    console.log('  CONTRACT_NAME=SubnameRegistrarDirect npx hardhat run scripts/upgrade-contract.js --network sepolia\n');
    process.exit(1);
  }

  if (!VALID_CONTRACTS.includes(contractName)) {
    console.error(`❌ Invalid contract name: ${contractName}`);
    console.log(`Valid contracts: ${VALID_CONTRACTS.join(', ')}\n`);
    process.exit(1);
  }

  console.log(`\n🔄 Upgrading ${contractName}`);
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Load config to get proxy address
  if (!fs.existsSync('./config.json')) {
    console.error('❌ Config not found!\n');
    process.exit(1);
  }
  
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  
  let proxyAddress;
  let configKey;
  
  // Determine proxy address based on contract name
  if (contractName === 'OffchainResolver') {
    proxyAddress = config.offchainResolverAddress;
    configKey = 'offchainResolverImplementation';
  } else if (contractName === 'SubnameRegistrar' || contractName === 'SubnameRegistrarDirect') {
    proxyAddress = config.registrarAddress;
    configKey = 'registrarImplementation';
  }
  
  if (!proxyAddress) {
    console.error(`❌ Proxy address not found in config for ${contractName}\n`);
    process.exit(1);
  }

  console.log('Configuration:');
  console.log('  Contract:', contractName);
  console.log('  Proxy Address:', proxyAddress, '\n');

  // Get current implementation
  const currentImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log('Current Implementation:', currentImpl, '\n');

  // Upgrade
  console.log('📝 Upgrading contract...\n');
  
  const ContractFactory = await ethers.getContractFactory(contractName);
  const upgraded = await upgrades.upgradeProxy(proxyAddress, ContractFactory);
  
  await upgraded.waitForDeployment();
  const newImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  
  console.log('✅ Contract upgraded!');
  console.log('   Proxy Address:', proxyAddress);
  console.log('   Old Implementation:', currentImpl);
  console.log('   New Implementation:', newImpl, '\n');

  // Update config
  config[configKey] = newImpl;
  config[`${contractName.toLowerCase()}UpgradedAt`] = new Date().toISOString();
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
  
  console.log('💾 Config updated\n');
  
  console.log('━'.repeat(60));
  console.log('✅ UPGRADE COMPLETE!');
  console.log('━'.repeat(60));
  
  console.log('\n📍 Proxy:', proxyAddress);
  console.log('📍 New Implementation:', newImpl);
  console.log('📍 Etherscan: https://sepolia.etherscan.io/address/' + newImpl, '\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
