const hre = require('hardhat');
const ethers = hre.ethers;

/**
 * Debug test3 registrar setup
 */

const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
const MULTISIG = '0x834163C217FF4dAeE028f27cEEb6a7fAB51B02b7';
const REGISTRAR = '0xeBa8b11aD69abD273A05b9F5AE64FE7381fd2755';

function namehash(name) {
  let node = '0x0000000000000000000000000000000000000000000000000000000000000000';
  if (name !== '') {
    const labels = name.split('.');
    for (let i = labels.length - 1; i >= 0; i--) {
      const labelHash = ethers.keccak256(ethers.toUtf8Bytes(labels[i]));
      node = ethers.keccak256(ethers.concat([node, labelHash]));
    }
  }
  return node;
}

async function main() {
  console.log('\n🔍 Debugging test3.divicompany.eth Setup');
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Checking from wallet:', deployer.address, '\n');

  const nameWrapper = await ethers.getContractAt(
    [
      'function ownerOf(uint256 tokenId) external view returns (address)',
      'function isApprovedForAll(address account, address operator) external view returns (bool)'
    ],
    NAME_WRAPPER
  );

  const test3Node = namehash('test3.divicompany.eth');
  console.log('test3.divicompany.eth node:', test3Node);

  // Check ownership
  console.log('\n1️⃣ Checking ownership...');
  try {
    const owner = await nameWrapper.ownerOf(test3Node);
    console.log('   Owner:', owner);
    console.log('   Expected (multisig):', MULTISIG);
    console.log('   Match:', owner.toLowerCase() === MULTISIG.toLowerCase() ? '✅' : '❌');
  } catch (e) {
    console.log('   ❌ Error getting owner:', e.message);
  }

  // Check approval - THIS IS CRITICAL
  console.log('\n2️⃣ Checking if MULTISIG approved REGISTRAR...');
  try {
    const isApproved = await nameWrapper.isApprovedForAll(MULTISIG, REGISTRAR);
    console.log('   Multisig:', MULTISIG);
    console.log('   Registrar:', REGISTRAR);
    console.log('   Is Approved:', isApproved ? '✅ YES' : '❌ NO');
    
    if (!isApproved) {
      console.log('\n   ⚠️  PROBLEM FOUND: Registrar is NOT approved!');
      console.log('   The multisig must approve the registrar via Safe.');
      console.log('   See SAFE-TX-APPROVE-TEST3.md for instructions.\n');
    }
  } catch (e) {
    console.log('   ❌ Error checking approval:', e.message);
  }

  // Check if deployer approved (this is WRONG but let's check)
  console.log('\n3️⃣ Checking if YOUR WALLET approved REGISTRAR (this should be NO)...');
  try {
    const deployerApproved = await nameWrapper.isApprovedForAll(deployer.address, REGISTRAR);
    console.log('   Your Wallet:', deployer.address);
    console.log('   Registrar:', REGISTRAR);
    console.log('   Is Approved:', deployerApproved ? '⚠️  YES (but wrong!)' : '✅ NO (correct)');
    
    if (deployerApproved) {
      console.log('\n   ⚠️  Your wallet approved the registrar, but it should be the MULTISIG!');
    }
  } catch (e) {
    console.log('   ❌ Error checking approval:', e.message);
  }

  // Check registrar ownership
  console.log('\n4️⃣ Checking registrar contract ownership...');
  try {
    const registrar = await ethers.getContractAt(
      ['function owner() external view returns (address)'],
      REGISTRAR
    );
    const registrarOwner = await registrar.owner();
    console.log('   Registrar Owner:', registrarOwner);
    console.log('   Expected (multisig):', MULTISIG);
    console.log('   Match:', registrarOwner.toLowerCase() === MULTISIG.toLowerCase() ? '✅' : '❌');
  } catch (e) {
    console.log('   ❌ Error getting registrar owner:', e.message);
  }

  console.log('\n' + '━'.repeat(60));
  console.log('🎯 DIAGNOSIS:');
  console.log('━'.repeat(60));
  console.log('\nIf "Is Approved" in step 2 shows ❌ NO, then:');
  console.log('  → The Safe multisig transaction might not have worked');
  console.log('  → Or the approval was done from the wrong wallet');
  console.log('\nThe approval MUST be done via Safe Transaction Builder:');
  console.log('  1. Contract: 0x0635513f179D50A207757E05759CbD106d7dFcE8');
  console.log('  2. Function: setApprovalForAll');
  console.log('  3. operator: 0xeBa8b11aD69abD273A05b9F5AE64FE7381fd2755');
  console.log('  4. approved: true');
  console.log('  5. Execute from SAFE (not your individual wallet)\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
