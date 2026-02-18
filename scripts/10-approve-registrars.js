const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Step 10: Approve both SubnameRegistrars to manage subdomains
 * 
 * This grants permission for:
 * - test.divicompany.eth registrar to create *.test.divicompany.eth
 * - test2.divicompany.eth registrar to create *.test2.divicompany.eth
 */

const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';

const NAME_WRAPPER_ABI = [
  'function setApprovalForAll(address operator, bool approved) external',
  'function isApprovedForAll(address owner, address operator) external view returns (bool)'
];

async function main() {
  console.log('\n🔐 Approving SubnameRegistrars');
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address, '\n');

  // Load configs
  const testConfig = JSON.parse(fs.readFileSync('./test-registrar-config.json', 'utf8'));
  const test2Config = JSON.parse(fs.readFileSync('./test2-registrar-config.json', 'utf8'));

  console.log('Registrars to approve:');
  console.log('  1. test.divicompany.eth  →', testConfig.registrarProxy);
  console.log('  2. test2.divicompany.eth →', test2Config.registrarProxy, '\n');

  const nameWrapper = new ethers.Contract(NAME_WRAPPER, NAME_WRAPPER_ABI, deployer);

  // Check current approval status
  console.log('🔍 Checking current approval status...');
  const testApproved = await nameWrapper.isApprovedForAll(deployer.address, testConfig.registrarProxy);
  const test2Approved = await nameWrapper.isApprovedForAll(deployer.address, test2Config.registrarProxy);
  
  console.log('  test.divicompany.eth:', testApproved ? '✅ Already approved' : '❌ Not approved');
  console.log('  test2.divicompany.eth:', test2Approved ? '✅ Already approved' : '❌ Not approved', '\n');

  // Approve test.divicompany.eth registrar
  if (!testApproved) {
    console.log('📝 Approving test.divicompany.eth registrar...');
    const tx1 = await nameWrapper.setApprovalForAll(testConfig.registrarProxy, true, {
      gasLimit: 100000
    });
    console.log('   TX:', tx1.hash);
    await tx1.wait();
    console.log('   ✅ Approved!\n');
  }

  // Approve test2.divicompany.eth registrar
  if (!test2Approved) {
    console.log('📝 Approving test2.divicompany.eth registrar...');
    const tx2 = await nameWrapper.setApprovalForAll(test2Config.registrarProxy, true, {
      gasLimit: 100000
    });
    console.log('   TX:', tx2.hash);
    await tx2.wait();
    console.log('   ✅ Approved!\n');
  }

  // Verify approvals
  console.log('🔍 Verifying approvals...');
  const testApprovedNow = await nameWrapper.isApprovedForAll(deployer.address, testConfig.registrarProxy);
  const test2ApprovedNow = await nameWrapper.isApprovedForAll(deployer.address, test2Config.registrarProxy);
  
  console.log('  test.divicompany.eth:', testApprovedNow ? '✅' : '❌');
  console.log('  test2.divicompany.eth:', test2ApprovedNow ? '✅' : '❌', '\n');

  if (testApprovedNow && test2ApprovedNow) {
    console.log('━'.repeat(60));
    console.log('✅ ALL APPROVALS COMPLETE!');
    console.log('━'.repeat(60));
    console.log('\n🎯 Next Steps:');
    console.log('   The registrars can now create subdomains!\n');
    console.log('   Test by renting a subdomain:');
    console.log('   1. npx hardhat run scripts/11-test-rental-system.js --network sepolia\n');
    console.log('   Public can now rent:');
    console.log('   - *.test.divicompany.eth');
    console.log('   - *.test2.divicompany.eth\n');
  } else {
    console.error('❌ APPROVAL FAILED!\n');
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
