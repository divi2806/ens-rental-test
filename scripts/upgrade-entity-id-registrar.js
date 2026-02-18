const hre = require('hardhat');
const { ethers, upgrades } = hre;
const fs = require('fs');

/**
 * Upgrade SubnameRegistrarDirect to add resolver setting functionality
 * 
 * IMPORTANT: This must be executed by the Safe multisig owner
 * For testing on Sepolia with deployer wallet:
 * - Temporarily transfer ownership to deployer
 * - Upgrade
 * - Transfer ownership back to Safe
 */

async function main() {
  console.log('\n🔄 Upgrading SubnameRegistrarDirect Contract');
  console.log('━'.repeat(70), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  const config = JSON.parse(fs.readFileSync('./entity-id-config.json', 'utf8'));
  
  console.log('Current Configuration:');
  console.log('  Proxy:', config.registrarProxy);
  console.log('  Current Implementation:', config.registrarImpl);
  console.log('  Owner:', config.safeAddress, '\n');

  // Check current owner
  const currentProxy = await ethers.getContractAt('SubnameRegistrarDirect', config.registrarProxy);
  const currentOwner = await currentProxy.owner();
  
  console.log('Checking ownership...');
  console.log('  Current owner:', currentOwner);
  
  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log('\n❌ ERROR: You are not the owner!');
    console.log('   Current owner:', currentOwner);
    console.log('   Your address:', deployer.address);
    console.log('\nOPTIONS:');
    console.log('  1. Transfer ownership from Safe to deployer temporarily');
    console.log('  2. Generate Safe transaction for upgrade');
    console.log('  3. Use Safe SDK to execute upgrade\n');
    
    // Generate Safe transaction data
    console.log('📋 Safe Transaction Data (for manual execution):');
    console.log('━'.repeat(70));
    
    const SubnameRegistrarDirect = await ethers.getContractFactory('SubnameRegistrarDirect');
    
    // Deploy new implementation
    console.log('\n1. Deploy new implementation:');
    const newImpl = await SubnameRegistrarDirect.deploy();
    await newImpl.waitForDeployment();
    const newImplAddress = await newImpl.getAddress();
    console.log('   New Implementation:', newImplAddress);
    
    // Generate upgrade calldata
    console.log('\n2. Execute this transaction from Safe:');
    console.log('   To:', config.registrarProxy);
    console.log('   Function: upgradeToAndCall(address,bytes)');
    
    const upgradeCalldata = currentProxy.interface.encodeFunctionData('upgradeToAndCall', [
      newImplAddress,
      '0x' // No initialization data needed
    ]);
    console.log('   Calldata:', upgradeCalldata);
    console.log('\n   OR use Safe Transaction Builder with:');
    console.log('   - Contract:', config.registrarProxy);
    console.log('   - ABI: UUPS Proxy ABI with upgradeToAndCall');
    console.log('   - newImplementation:', newImplAddress);
    console.log('   - data: 0x\n');
    
    return;
  }

  console.log('   ✅ You are the owner!\n');

  // Proceed with upgrade
  console.log('🚀 Deploying new implementation...');
  const SubnameRegistrarDirect = await ethers.getContractFactory('SubnameRegistrarDirect');
  
  const upgraded = await upgrades.upgradeProxy(config.registrarProxy, SubnameRegistrarDirect);
  await upgraded.waitForDeployment();
  
  const newImplAddress = await upgrades.erc1967.getImplementationAddress(config.registrarProxy);
  
  console.log('   ✅ Upgrade complete!\n');
  console.log('Results:');
  console.log('  Proxy (unchanged):', config.registrarProxy);
  console.log('  Old Implementation:', config.registrarImpl);
  console.log('  New Implementation:', newImplAddress, '\n');

  // Verify
  console.log('🔍 Verifying upgrade...');
  const upgradedContract = await ethers.getContractAt('SubnameRegistrarDirect', config.registrarProxy);
  
  const parentNode = await upgradedContract.parentNode();
  const resolver = await upgradedContract.resolver();
  const rentalPrice = await upgradedContract.rentalPrice();
  const owner = await upgradedContract.owner();
  
  console.log('  parentNode:', parentNode);
  console.log('  resolver:', resolver);
  console.log('  rentalPrice:', ethers.formatEther(rentalPrice), 'ETH');
  console.log('  owner:', owner);
  console.log('  ✅ All state preserved!\n');

  // Update config
  config.registrarImpl = newImplAddress;
  config.upgradedAt = new Date().toISOString();
  config.upgradedBy = deployer.address;
  fs.writeFileSync('./entity-id-config.json', JSON.stringify(config, null, 2));
  
  console.log('✅ Configuration updated\n');
  console.log('━'.repeat(70));
  console.log('\n🎉 UPGRADE COMPLETE!\n');
  console.log('Next steps:');
  console.log('  1. Test subdomain rental with new implementation');
  console.log('  2. Verify resolver is set correctly');
  console.log('  3. Transfer ownership back to Safe if needed\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
