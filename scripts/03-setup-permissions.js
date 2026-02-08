const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Step 3: Grant SubnameRegistrar permission to create subdomains
 */

const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';

async function main() {
  console.log('\n🔐 Setting Up Permissions');
  console.log('━'.repeat(60), '\n');

  const [signer] = await ethers.getSigners();
  console.log('Your address:', signer.address);
  
  const balance = await ethers.provider.getBalance(signer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Load config
  if (!fs.existsSync('./config.json')) {
    console.error('❌ Config not found!\n');
    process.exit(1);
  }
  
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  
  if (!config.registrarAddress) {
    console.error('❌ Registrar not deployed! Run 02-deploy-registrar.js first\n');
    process.exit(1);
  }
  
  console.log('Configuration:');
  console.log('  Domain:', config.domain);
  console.log('  Registrar:', config.registrarAddress, '\n');

  // Approve registrar as operator
  console.log('1️⃣  Approving SubnameRegistrar as operator...');
  console.log('   This allows the contract to create subdomains on your behalf\n');
  
  const wrapperAbi = [
    'function setApprovalForAll(address operator, bool approved) external',
    'function isApprovedForAll(address owner, address operator) view returns (bool)'
  ];
  
  const wrapper = new ethers.Contract(NAME_WRAPPER, wrapperAbi, signer);
  
  // Check if already approved
  const isApproved = await wrapper.isApprovedForAll(signer.address, config.registrarAddress);
  
  if (isApproved) {
    console.log('   ✅ Already approved!\n');
  } else {
    const tx = await wrapper.setApprovalForAll(config.registrarAddress, true);
    console.log('   TX:', tx.hash);
    await tx.wait();
    console.log('   ✅ Approved!\n');
  }
  
  // Verify
  console.log('2️⃣  Verifying permissions...');
  const verified = await wrapper.isApprovedForAll(signer.address, config.registrarAddress);
  console.log('   Approved:', verified ? '✅' : '❌\n');
  
  if (!verified) {
    console.error('❌ Permission setup failed!\n');
    process.exit(1);
  }
  
  // Update config
  config.permissionsSet = true;
  config.setupComplete = true;
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
  
  console.log('━'.repeat(60));
  console.log('✅ SETUP COMPLETE!');
  console.log('━'.repeat(60));
  console.log('\n🎉 Your subdomain rental service is ready!');
  console.log('\n📋 Summary:');
  console.log(`   ✅ Domain ${config.domain} is wrapped`);
  console.log(`   ✅ SubnameRegistrar deployed at ${config.registrarAddress}`);
  console.log(`   ✅ Contract approved to create subdomains`);
  console.log(`   ✅ Rental price: ${config.rentalPrice} ETH/year\n`);
  
  console.log('🎯 Next Step:');
  console.log('   Test renting a subdomain:');
  console.log('   npx hardhat run scripts/04-test-rental.js --network sepolia\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
