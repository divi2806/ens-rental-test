const hre = require('hardhat');
const ethers = hre.ethers;

/**
 * Properly query OffchainResolver using resolve() function to capture CCIP-Read data
 */

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

function dnsEncode(name) {
  const labels = name.split('.');
  let encoded = '0x';
  for (const label of labels) {
    const length = label.length.toString(16).padStart(2, '0');
    const hex = Buffer.from(label).toString('hex');
    encoded += length + hex;
  }
  encoded += '00'; // Null terminator
  return encoded;
}

async function main() {
  console.log('\n🌐 QUERY OFFCHAIN RESOLVER WITH CCIP-READ');
  console.log('═'.repeat(80), '\n');

  const fullName = 'hello.test3.divicompany.eth';
  const node = namehash(fullName);
  const dnsName = dnsEncode(fullName);
  
  console.log('Subdomain:', fullName);
  console.log('Node (namehash):', node);
  console.log('DNS-encoded name:', dnsName);
  console.log('Resolver:', OFFCHAIN_RESOLVER);
  console.log('');

  // Create the addr() call data that we want to execute
  const addrInterface = new ethers.Interface(['function addr(bytes32) external view returns (address)']);
  const addrCallData = addrInterface.encodeFunctionData('addr', [node]);
  
  console.log('Inner call (addr):');
  console.log('  Function: addr(bytes32)');
  console.log('  Call data:', addrCallData);
  console.log('');

  // Create the resolve() call
  const resolveInterface = new ethers.Interface([
    'function resolve(bytes memory name, bytes memory data) external view returns (bytes memory)'
  ]);
  
  const resolveCallData = resolveInterface.encodeFunctionData('resolve', [dnsName, addrCallData]);
  
  console.log('Outer call (resolve):');
  console.log('  Function: resolve(bytes name, bytes data)');
  console.log('  Call data:', resolveCallData);
  console.log('');

  console.log('═'.repeat(80));
  console.log('📤 CALLING RESOLVER...');
  console.log('═'.repeat(80), '\n');

  const provider = ethers.provider;
  
  try {
    const result = await provider.call({
      to: OFFCHAIN_RESOLVER,
      data: resolveCallData
    });
    
    console.log('✅ Call succeeded (unexpected!)');
    console.log('Result:', result);
    console.log('');
    
  } catch (error) {
    console.log('⚡ CCIP-READ ERROR CAPTURED!');
    console.log('─'.repeat(80), '\n');
    
    console.log('Error code:', error.code);
    console.log('Error name:', error.name ||error.constructor.name);
    console.log('');

    // Extract error data
    let errorData = error.data;
    
    if (!errorData || errorData === '0x') {
      if (error.error && error.error.data) {
        errorData = error.error.data;
        console.log('Using error.error.data:', errorData);
        console.log('');
      }
    }

    if (errorData && errorData !== '0x' && errorData.length > 10) {
      console.log('📦 ERROR DATA:', errorData);
      console.log('');
      
      try {
        // Try to decode as OffchainLookup error
        const errorInterface = new ethers.Interface([
          'error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData)'
        ]);
        
        const decoded = errorInterface.parseError(errorData);
        
        if (decoded && decoded.name === 'OffchainLookup') {
          console.log('🔍 DECODED OFFCHAIN LOOKUP ERROR:');
          console.log('═'.repeat(80), '\n');
          
          const sender = decoded.args.sender || decoded.args[0];
          const urls = decoded.args.urls || decoded.args[1];
          const callData = decoded.args.callData || decoded.args[2];
          const callbackFunction = decoded.args.callbackFunction || decoded.args[3];
          const extraData = decoded.args.extraData || decoded.args[4];
          
          console.log('Sender (Resolver Address):', sender);
          console.log('  Match:', sender.toLowerCase() === OFFCHAIN_RESOLVER.toLowerCase() ? '✅' : '❌');
          console.log('');
          
          console.log('Gateway URLs:');
          if (Array.isArray(urls)) {
            urls.forEach((url, i) => {
              console.log(`  [${i}] ${url}`);
            });
          } else {
            console.log('  ', urls);
          }
          console.log('');
          
          console.log('Call Data (what to send to gateway):', callData);
          console.log('');
          
          console.log('Callback Function Selector:', callbackFunction);
          console.log('');
          
          console.log('Extra Data:', extraData);
          console.log('');
          
          console.log('═'.repeat(80));
          console.log('📖 HOW TO USE THIS WITH GATEWAY:');
          console.log('═'.repeat(80), '\n');
          
          if (Array.isArray(urls) && urls.length > 0) {
            const gatewayUrl = urls[0];
            
            // Replace {sender} and {data}
            const finalUrl = gatewayUrl
              .replace('{sender}', sender.toLowerCase())
              .replace('{data}', callData.slice(2)); // Remove 0x
            
            console.log('1. Client makes request to gateway:');
            console.log(`   GET ${finalUrl}`);
            console.log('');
            console.log('2. Gateway returns signed response:');
            console.log('   { result: "...", expires: ..., signature: "..." }');
            console.log('');
            console.log('3. Client calls callback with signed data:');
            console.log(`   resolveWithProof(response, extraData) on ${sender}`);
            console.log('');
            console.log('4. Resolver verifies signature and returns result');
            console.log('');
            
            console.log('═'.repeat(80));
            console.log('✅ CCIP-READ DATA SUCCESSFULLY CAPTURED!');
            console.log('═'.repeat(80), '\n');
            
            console.log('📊 SUMMARY:');
            console.log('  Domain:', fullName);
            console.log('  Resolver:', OFFCHAIN_RESOLVER);
            console.log('  Gateway:', gatewayUrl);
            console.log('  Callback:', callbackFunction);
            console.log('');
            
          }  else {
            console.log('⚠️  No gateway URLs configured!');
            console.log('');
          }
          
        } else {
          console.log('Decoded as:', decoded);
          console.log('');
        }
        
      } catch (decodeError) {
        console.log('Could not decode as OffchainLookup:', decodeError.message);
        console.log('');
        
        // Try as generic revert
        try {
          const revertInterface = new ethers.Interface(['error Error(string)']);
          const revertDecoded = revertInterface.parseError(errorData);
          if (revertDecoded) {
            console.log('Revert reason:', revertDecoded.args[0]);
            console.log('');
          }
        } catch (e) {
          console.log('Not a standard revert either');
          console.log('');
        }
      }
      
    } else {
      console.log('❌ No error data found');
      console.log('Error:', error.message);
      console.log('');
      console.log('Full error object:');
      console.log(JSON.stringify(error, null, 2));
      console.log('');
    }
  }

  console.log('═'.repeat(80));
  console.log('✅ COMPLETE');
  console.log('═'.repeat(80), '\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ SCRIPT ERROR:');
    console.error(error);
    process.exit(1);
  });
