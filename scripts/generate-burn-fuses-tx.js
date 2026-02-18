const hre = require('hardhat');
const ethers = hre.ethers;

/**
 * Generate Safe transaction to burn fuses on test3.divicompany.eth
 * Using setChildFuses (called by parent owner)
 */

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
  console.log('\n🔧 Generate Safe Transaction: Burn Fuses on test3.divicompany.eth');
  console.log('━'.repeat(60), '\n');

  const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
  
  // Calculate nodes
  const parentNode = namehash('divicompany.eth');
  const test3Node = namehash('test3.divicompany.eth');
  const labelHash = ethers.keccak256(ethers.toUtf8Bytes('test3'));
  
  console.log('Parent node (divicompany.eth):', parentNode);
  console.log('Label: "test3"');
  console.log('Label hash:', labelHash);
  console.log('Full node (test3.divicompany.eth):', test3Node);
  console.log('');
  
  // Get test3 current expiry
  const nameWrapper = await ethers.getContractAt(
    ['function getData(uint256 tokenId) external view returns (address owner, uint32 fuses, uint64 expiry)'],
    NAME_WRAPPER
  );
  
  const test3Data = await nameWrapper.getData(test3Node);
  const currentExpiry = test3Data[2];
  
  console.log('Current test3 expiry:', currentExpiry.toString(), '→', new Date(Number(currentExpiry) * 1000).toLocaleString());
  console.log('');
  
  // Fuses to burn:
  // PARENT_CANNOT_CONTROL (0x10000) = 65536
  // CANNOT_UNWRAP (0x1) = 1
  // Combined: 65537
  const fusesToBurn = 65537; // 0x10001
  
  console.log('Fuses to burn:', fusesToBurn, '(0x' + fusesToBurn.toString(16) + ')');
  console.log('  - CANNOT_UNWRAP (0x1)');
  console.log('  - PARENT_CANNOT_CONTROL (0x10000)');
  console.log('');
  
  // Encode function call
  const iface = new ethers.Interface([
    'function setChildFuses(bytes32 parentNode, bytes32 labelhash, uint32 fuses, uint64 expiry) external'
  ]);
  
  const data = iface.encodeFunctionData('setChildFuses', [
    parentNode,
    labelHash,
    fusesToBurn,
    currentExpiry
  ]);
  
  console.log('━'.repeat(60));
  console.log('📋 SAFE TRANSACTION DETAILS');
  console.log('━'.repeat(60), '\n');
  
  console.log('Contract Address (Name Wrapper):');
  console.log(NAME_WRAPPER);
  console.log('');
  
  console.log('Function: setChildFuses');
  console.log('');
  
  console.log('ABI (copy this):');
  console.log('[{"inputs":[{"internalType":"bytes32","name":"parentNode","type":"bytes32"},{"internalType":"bytes32","name":"labelhash","type":"bytes32"},{"internalType":"uint32","name":"fuses","type":"uint32"},{"internalType":"uint64","name":"expiry","type":"uint64"}],"name":"setChildFuses","outputs":[],"stateMutability":"nonpayable","type":"function"}]');
  console.log('');
  
  console.log('Parameters:');
  console.log('  parentNode (bytes32):', parentNode);
  console.log('  labelhash (bytes32):', labelHash);
  console.log('  fuses (uint32):', fusesToBurn);
  console.log('  expiry (uint64):', currentExpiry.toString());
  console.log('');
  
  console.log('━'.repeat(60));
  console.log('OR use Custom Data:');
  console.log('━'.repeat(60), '\n');
  console.log(data);
  console.log('');
  
  console.log('━'.repeat(60));
  console.log('📖 WHAT THIS DOES:');
  console.log('━'.repeat(60), '\n');
  console.log('As the owner of divicompany.eth, this burns fuses on test3:');
  console.log('  1. PARENT_CANNOT_CONTROL - Parent can no longer control test3');
  console.log('  2. CANNOT_UNWRAP - test3 cannot be unwrapped');
  console.log('');
  console.log('After this, the SubnameRegistrar can create secure rentals!');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
