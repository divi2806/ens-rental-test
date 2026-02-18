const hre = require('hardhat');
const ethers = hre.ethers;

/**
 * Check fuses on test3.divicompany.eth
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
  console.log('\n🔍 Checking Fuses on test3.divicompany.eth');
  console.log('━'.repeat(60), '\n');

  const nameWrapper = await ethers.getContractAt(
    [
      'function getData(uint256 tokenId) external view returns (address owner, uint32 fuses, uint64 expiry)',
      'function ownerOf(uint256 tokenId) external view returns (address)',
    ],
    NAME_WRAPPER
  );

  const test3Node = namehash('test3.divicompany.eth');
  console.log('test3.divicompany.eth node:', test3Node, '\n');

  try {
    const data = await nameWrapper.getData(test3Node);
    console.log('Owner:', data[0]);
    console.log('Fuses:', '0x' + data[1].toString(16).padStart(8, '0'));
    console.log('Expiry:', data[2].toString(), '→', new Date(Number(data[2]) * 1000).toLocaleString());
    
    const fuses = Number(data[1]);
    console.log('\n📊 Fuse Analysis:');
    console.log('   Raw fuses value:', fuses);
    console.log('   CANNOT_UNWRAP (0x1):', (fuses & 0x1) ? '✅ BURNED' : '❌ NOT BURNED');
    console.log('   CANNOT_BURN_FUSES (0x2):', (fuses & 0x2) ? '✅ BURNED' : '❌ NOT BURNED');
    console.log('   CANNOT_TRANSFER (0x4):', (fuses & 0x4) ? '✅ BURNED' : '❌ NOT BURNED');
    console.log('   CANNOT_SET_RESOLVER (0x8):', (fuses & 0x8) ? '✅ BURNED' : '❌ NOT BURNED');
    console.log('   CANNOT_SET_TTL (0x10):', (fuses & 0x10) ? '✅ BURNED' : '❌ NOT BURNED');
    console.log('   CANNOT_CREATE_SUBDOMAIN (0x20):', (fuses & 0x20) ? '✅ BURNED' : '❌ NOT BURNED');
    console.log('   CANNOT_APPROVE (0x40):', (fuses & 0x40) ? '✅ BURNED' : '❌ NOT BURNED');
    console.log('   PARENT_CANNOT_CONTROL (0x10000):', (fuses & 0x10000) ? '✅ BURNED' : '❌ NOT BURNED');
    
    console.log('\n━'.repeat(60));
    console.log('🎯 DIAGNOSIS:');
    console.log('━'.repeat(60), '\n');
    
    if (!(fuses & 0x1)) {
      console.log('❌ PROBLEM FOUND: CANNOT_UNWRAP fuse is NOT burned!');
      console.log('\n📋 Why this matters:');
      console.log('   To create subdomains with PARENT_CANNOT_CONTROL fuse,');
      console.log('   the parent domain MUST have CANNOT_UNWRAP fuse burned.');
      console.log('\n🔧 Solution:');
      console.log('   The multisig needs to burn the CANNOT_UNWRAP fuse on test3.');
      console.log ('   This is done via Safe by calling setFuses on Name Wrapper.');
      console.log('\n   Function: setFuses(bytes32 node, uint16 ownerControlledFuses)');
      console.log('   Contract: 0x0635513f179D50A207757E05759CbD106d7dFcE8');
      console.log('   node:', test3Node);
      console.log('   ownerControlledFuses: 1 (CANNOT_UNWRAP)');
      console.log('\n   After burning this fuse, rentals will work!\n');
    } else {
      console.log('✅ CANNOT_UNWRAP is burned - this should work!');
      console.log('   The issue must be something else...\n');
    }
    
  } catch (e) {
    console.log('❌ Error getting data:', e.message);
    console.log('   test3.divicompany.eth might not exist!\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
