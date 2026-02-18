const hre = require('hardhat');
const ethers = hre.ethers;

/**
 * Check fuses on parent (divicompany.eth)
 */

const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';

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
  console.log('\n🔍 Checking Parent Domain Fuses');
  console.log('━'.repeat(60), '\n');

  const nameWrapper = await ethers.getContractAt(
    [
      'function getData(uint256 tokenId) external view returns (address owner, uint32 fuses, uint64 expiry)',
    ],
    NAME_WRAPPER
  );

  // Check divicompany.eth
  const parentNode = namehash('divicompany.eth');
  console.log('📍 divicompany.eth');
  console.log('   Node:', parentNode, '\n');

  try {
    const parentData = await nameWrapper.getData(parentNode);
    console.log('   Owner:', parentData[0]);
    console.log('   Fuses:', '0x' + parentData[1].toString(16).padStart(8, '0'));
    console.log('   Expiry:', new Date(Number(parentData[2]) * 1000).toLocaleString());
    
    const parentFuses = Number(parentData[1]);
    console.log('\n   📊 divicompany.eth Fuse Analysis:');
    console.log('      CANNOT_UNWRAP (0x1):', (parentFuses & 0x1) ? '✅ BURNED' : '❌ NOT BURNED');
    console.log('      PARENT_CANNOT_CONTROL (0x10000):', (parentFuses & 0x10000) ? '✅ BURNED' : '❌ NOT BURNED');
    
    // Check test3.divicompany.eth
    console.log('\n━'.repeat(60));
    const test3Node = namehash('test3.divicompany.eth');
    console.log('\n📍 test3.divicompany.eth');
    console.log('   Node:', test3Node, '\n');
    
    const test3Data = await nameWrapper.getData(test3Node);
    console.log('   Owner:', test3Data[0]);
    console.log('   Fuses:', '0x' + test3Data[1].toString(16).padStart(8, '0'));
    console.log('   Expiry:', new Date(Number(test3Data[2]) * 1000).toLocaleString());
    
    const test3Fuses = Number(test3Data[1]);
    console.log('\n   📊 test3.divicompany.eth Fuse Analysis:');
    console.log('      CANNOT_UNWRAP (0x1):', (test3Fuses & 0x1) ? '✅ BURNED' : '❌ NOT BURNED');
    console.log('      PARENT_CANNOT_CONTROL (0x10000):', (test3Fuses & 0x10000) ? '✅ BURNED' : '❌ NOT BURNED');
    
    console.log('\n' + '━'.repeat(60));
    console.log('🎯 DIAGNOSIS:');
    console.log('━'.repeat(60), '\n');
    
    if (!(parentFuses & 0x1)) {
      console.log('❌ CRITICAL ISSUE: divicompany.eth does NOT have CANNOT_UNWRAP burned!');
      console.log('\n📋 The Problem:');
      console.log('   To burn fuses on a subdomain (test3), the PARENT (divicompany.eth)');
      console.log('   must FIRST have CANNOT_UNWRAP burned.\n');
      console.log('🔧 The Solution:');
      console.log('   1. FIRST: Burn CANNOT_UNWRAP on divicompany.eth');
      console.log('   2. THEN: Burn fuses on test3.divicompany.eth');
      console.log('\n   This is a TWO-STEP process!\n');
    } else if (!(test3Fuses & 0x10000)) {
      console.log('⚠️  divicompany.eth has CANNOT_UNWRAP ✅');
      console.log('   But test3 does NOT have PARENT_CANNOT_CONTROL burned.');
      console.log('\n   This might be because test3 was created without this fuse.');
      console.log('   You can now burn CANNOT_UNWRAP on test3.\n');
    } else {
      console.log('✅ Both domains have proper fuses!');
      console.log('   The registrar should work now.\n');
    }
    
  } catch (e) {
    console.log('❌ Error:', e.message, '\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
