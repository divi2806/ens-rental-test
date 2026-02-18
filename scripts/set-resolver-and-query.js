const hre = require('hardhat');
const ethers = hre.ethers;

/**
 * Set resolver on hello.test3.divicompany.eth and query data
 */

const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
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
  console.log('\n🔧 SET RESOLVER & QUERY OFFCHAIN DATA');
  console.log('━'.repeat(80), '\n');

  const [deployer] = await ethers.getSigners();
  
  const fullName = 'hello.test3.divicompany.eth';
  const node = namehash(fullName);
  
  console.log('Subdomain:', fullName);
  console.log('Node:', node);
  console.log('Wallet:', deployer.address);
  console.log('');

  // Set resolver
  console.log('━'.repeat(80));
  console.log('📝 SETTING RESOLVER');
  console.log('━'.repeat(80), '\n');
  
  const nameWrapper = await ethers.getContractAt(
    [
      'function setResolver(bytes32 node, address resolver) external',
      'function ownerOf(uint256 tokenId) external view returns (address)'
    ],
    NAME_WRAPPER
  );

  // Check ownership
  try {
    const owner = await nameWrapper.ownerOf(node);
    console.log('Current owner:', owner);
    console.log('Your wallet:', deployer.address);
    console.log('You own it:', owner.toLowerCase() === deployer.address.toLowerCase() ? '✅' : '❌');
    console.log('');
  } catch (e) {
    console.log('❌ Subdomain does not exist!');
    console.log('   Please run: npx hardhat run scripts/test-offchain-data.js --network sepolia');
    console.log('');
    return;
  }

  console.log('Setting resolver to:', OFFCHAIN_RESOLVER);
  try {
    const tx = await nameWrapper.setResolver(node, OFFCHAIN_RESOLVER, {
      gasLimit: 100000
    });
    console.log('TX:', tx.hash);
    await tx.wait();
    console.log('✅ Resolver set!');
    console.log('');
  } catch (e) {
    if (e.message.includes('Unauthorised')) {
      console.log('❌ Not authorized to set resolver (subdomain might have expired)');
      console.log('');
      return;
    } else {
      console.log('ℹ️  Resolver might already be set:', e.message.substring(0, 100));
      console.log('');
    }
  }

  // Now query with proper error handling to catch CCIP-Read
  console.log('━'.repeat(80));
  console.log('🌐 QUERYING OFFCHAIN RESOLVER (CCIP-Read)');
  console.log('━'.repeat(80), '\n');

  const provider = ethers.provider;
  
  // Create resolver interface
  const resolverABI = [
    'function addr(bytes32 node) external view returns (address)',
    'function text(bytes32 node, string calldata key) external view returns (string memory)'
  ];
  
  const resolver = new ethers.Contract(OFFCHAIN_RESOLVER, resolverABI, provider);

  console.log('Query: addr(node)');
  console.log('Node:', node);
  console.log('');

  try {
    // Try to call addr - this should trigger OffchainLookup error
    const data = resolver.interface.encodeFunctionData('addr', [node]);
    console.log('📤 Call data:', data);
    console.log('');

    const result = await provider.call({
      to: OFFCHAIN_RESOLVER,
      data: data
    });
    
    console.log('📥 Result:', result);
    const decoded = resolver.interface.decodeFunctionResult('addr', result);
    console.log('Decoded address:', decoded[0]);
    console.log('');
    
  } catch (error) {
    console.log('━'.repeat(80));
    console.log('⚡ CCIP-READ ERROR CAUGHT!');
    console.log('━'.repeat(80), '\n');
    
    console.log('Error message:', error.message.substring(0, 200));
    console.log('');

    if (error.data) {
      console.log('📦 ERROR DATA:');
      console.log('   ', error.data);
      console.log('');
      
      // Try to decode OffchainLookup error
      try {
        const errorInterface = new ethers.Interface([
          'error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData)'
        ]);
        
        const decodedError = errorInterface.parseError(error.data);
        if (decodedError) {
          console.log('🔍 DECODED OFFCHAIN LOOKUP ERROR:');
          console.log('━'.repeat(80), '\n');
          console.log('Sender (should be resolver):', decodedError.args.sender);
          console.log('');
          console.log('Gateway URLs:', JSON.stringify(decodedError.args.urls, null, 2));
          console.log('');
          console.log('Call Data (what to send to gateway):', decodedError.args.callData);
          console.log('');
          console.log('Callback Function:', decodedError.args.callbackFunction);
          console.log('');
          console.log('Extra Data:', decodedError.args.extraData);
          console.log('');
          
          // Show what this means
          console.log('━'.repeat(80));
          console.log('📖 WHAT THIS MEANS:');
          console.log('━'.repeat(80), '\n');
          console.log('The OffchainResolver is using CCIP-Read (EIP-3668)!');
          console.log('');
          console.log('When you query the resolver on-chain:');
          console.log('  1. It throws an OffchainLookup error');
          console.log('  2. This error contains gateway URLs');
          console.log('  3. Clients fetch data from the gateway');
          console.log('  4. Gateway returns signed data');
          console.log('  5. Client calls the callback function with the signed data');
          console.log('');
          console.log('Gateway URL:', decodedError.args.urls[0]);
          console.log('');
          console.log('To query manually:');
          console.log('  curl "' + decodedError.args.urls[0] + '/{sender}/{callData}.json"');
          console.log('');
        }
      } catch (decodeErr) {
        console.log('Could not decode OffchainLookup:', decodeErr.message);
        console.log('');
      }
    }
    
    if (error.error && error.error.data) {
      console.log('📦 NESTED ERROR DATA:');
      console.log('   ', error.error.data);
      console.log('');
    }
  }

  console.log('━'.repeat(80));
  console.log('✅ COMPLETE');
  console.log('━'.repeat(80), '\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
