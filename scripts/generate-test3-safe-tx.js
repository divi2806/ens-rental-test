const hre = require('hardhat');
const ethers = hre.ethers;

/**
 * Generate Safe transaction data for creating test3.divicompany.eth
 */

const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
const MULTISIG = '0x834163C217FF4dAeE028f27cEEb6a7fAB51B02b7';
const OFFCHAIN_RESOLVER = '0x6Dea337D5BDBCe2DB66196AbA020bC02e6193b2d';

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
  console.log('\n📋 Safe Transaction Details for test3.divicompany.eth');
  console.log('━'.repeat(70), '\n');

  // Calculate nodes and hashes
  const parentNode = namehash('divicompany.eth');
  const label = 'test3';
  const labelHash = ethers.keccak256(ethers.toUtf8Bytes(label));
  const fullNode = namehash('test3.divicompany.eth');

  console.log('📌 PARAMETERS:');
  console.log('─'.repeat(70));
  console.log('Parent domain: divicompany.eth');
  console.log('Subdomain to create: test3.divicompany.eth');
  console.log('Owner (multisig):', MULTISIG);
  console.log('Resolver:', OFFCHAIN_RESOLVER);
  console.log('');

  console.log('📌 CALCULATED VALUES:');
  console.log('─'.repeat(70));
  console.log('Parent node (divicompany.eth):');
  console.log('  ', parentNode);
  console.log('Label ("test3"):');
  console.log('  ', label);
  console.log('Label hash:');
  console.log('  ', labelHash);
  console.log('Full node (test3.divicompany.eth):');
  console.log('  ', fullNode);
  console.log('');

  // Encode function call
  const nameWrapperInterface = new ethers.Interface([
    'function setSubnodeRecord(bytes32 parentNode, string label, address owner, address resolver, uint64 ttl, uint32 fuses, uint64 expiry) external returns (bytes32)'
  ]);

  const fuses = 0; // No fuses initially
  const expiry = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year from now
  const ttl = 0;

  const encodedData = nameWrapperInterface.encodeFunctionData('setSubnodeRecord', [
    parentNode,
    label,
    MULTISIG,
    OFFCHAIN_RESOLVER,
    ttl,
    fuses,
    expiry
  ]);

  console.log('━'.repeat(70));
  console.log('SAFE TRANSACTION BUILDER - COPY & PASTE THIS:');
  console.log('━'.repeat(70), '\n');

  console.log('1️⃣  CONTRACT ADDRESS:');
  console.log('   ', NAME_WRAPPER);
  console.log('');

  console.log('2️⃣  ABI (paste entire array):');
  console.log('');
  console.log('[');
  console.log('  {');
  console.log('    "inputs": [');
  console.log('      {"internalType": "bytes32", "name": "parentNode", "type": "bytes32"},');
  console.log('      {"internalType": "string", "name": "label", "type": "string"},');
  console.log('      {"internalType": "address", "name": "owner", "type": "address"},');
  console.log('      {"internalType": "address", "name": "resolver", "type": "address"},');
  console.log('      {"internalType": "uint64", "name": "ttl", "type": "uint64"},');
  console.log('      {"internalType": "uint32", "name": "fuses", "type": "uint32"},');
  console.log('      {"internalType": "uint64", "name": "expiry", "type": "uint64"}');
  console.log('    ],');
  console.log('    "name": "setSubnodeRecord",');
  console.log('    "outputs": [{"internalType": "bytes32", "name": "node", "type": "bytes32"}],');
  console.log('    "stateMutability": "nonpayable",');
  console.log('    "type": "function"');
  console.log('  }');
  console.log(']');
  console.log('');

  console.log('3️⃣  FUNCTION: setSubnodeRecord');
  console.log('');

  console.log('4️⃣  PARAMETERS (fill in each field):');
  console.log('');
  console.log('   parentNode (bytes32):');
  console.log('   ', parentNode);
  console.log('');
  console.log('   label (string):');
  console.log('   ', label);
  console.log('');
  console.log('   owner (address):');
  console.log('   ', MULTISIG);
  console.log('');
  console.log('   resolver (address):');
  console.log('   ', OFFCHAIN_RESOLVER);
  console.log('');
  console.log('   ttl (uint64):');
  console.log('   ', ttl);
  console.log('');
  console.log('   fuses (uint32):');
  console.log('   ', fuses);
  console.log('');
  console.log('   expiry (uint64):');
  console.log('   ', expiry);
  console.log('');

  console.log('━'.repeat(70));
  console.log('OR USE RAW TRANSACTION DATA:');
  console.log('━'.repeat(70), '\n');

  console.log('Contract Address:');
  console.log(NAME_WRAPPER);
  console.log('');
  console.log('Value: 0 ETH');
  console.log('');
  console.log('Data (hex):');
  console.log(encodedData);
  console.log('');

  console.log('━'.repeat(70));
  console.log('✅ AFTER TRANSACTION EXECUTES:');
  console.log('━'.repeat(70), '\n');
  console.log('test3.divicompany.eth will be created with:');
  console.log('  Owner: Multisig (', MULTISIG, ')');
  console.log('  Resolver: OffchainResolver (', OFFCHAIN_RESOLVER, ')');
  console.log('  Expiry:', new Date(expiry * 1000).toLocaleString());
  console.log('');
  console.log('Next step: Deploy SubnameRegistrar for test3.divicompany.eth');
  console.log('  (so public can rent *.test3.divicompany.eth)');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
