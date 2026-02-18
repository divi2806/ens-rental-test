const hre = require('hardhat');
const ethers = hre.ethers;

/**
 * Directly query OffchainResolver and capture CCIP-Read error with full details
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

async function main() {
  console.log('\n🔍 CCIP-READ OFFCHAIN LOOKUP DATA');
  console.log('═'.repeat(80), '\n');

  const fullName = 'hello.test3.divicompany.eth';
  const node = namehash(fullName);
  
  console.log('Subdomain:', fullName);
  console.log('Node:', node);
  console.log('Resolver:', OFFCHAIN_RESOLVER);
  console.log('');

  // Create function signatures
  const addrSignature = 'addr(bytes32)';
  const textSignature = 'text(bytes32,string)';
  
  console.log('═'.repeat(80));
  console.log('📤 QUERY 1: addr(node)');
  console.log('═'.repeat(80), '\n');

  // Encode addr call
  const iface = new ethers.Interface([
    'function addr(bytes32 node) external view returns (address)'
  ]);
  
  const callData = iface.encodeFunctionData('addr', [node]);
  console.log('Function:', addrSignature);
  console.log('Encoded call data:', callData);
  console.log('');

  // Make raw call to capture error
  const provider = ethers.provider;
  
  try {
    const result = await provider.call({
      to: OFFCHAIN_RESOLVER,
      data: callData
    });
    
    console.log('✅ Call succeeded (unexpected!)');
    console.log('Result:', result);
    
    if (result !== '0x') {
      const decoded = iface.decodeFunctionResult('addr', result);
      console.log('Decoded address:', decoded[0]);
    }
    console.log('');
    
  } catch (error) {
    console.log('⚡ CCIP-READ ERROR TRIGGERED!');
    console.log('─'.repeat(80), '\n');
    
    console.log('Error type:', error.constructor.name);
    console.log('Error code:', error.code);
    console.log('');
    
    // Log all error properties
    console.log('📦 RAW ERROR OBJECT:');
    console.log('─'.repeat(80));
    console.log(JSON.stringify(error, null, 2));
    console.log('');
    
    // Try to extract OffchainLookup from different error formats
    let offchainData = null;
    
    // Check error.data
    if (error.data && error.data !== '0x' && error.data.length > 10) {
      console.log('📦 ERROR.DATA:', error.data);
      console.log('');
      
      try {
        const errorInterface = new ethers.Interface([
          'error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData)'
        ]);
        
        const decoded = errorInterface.parseError(error.data);
        if (decoded) {
          offchainData = decoded.args;
          console.log('🔍 DECODED OFFCHAIN LOOKUP:');
          console.log('═'.repeat(80), '\n');
        }
      } catch (e) {
        console.log('Could not decode as OffchainLookup:', e.message);
        console.log('');
      }
    }
    
    // Check error.error
    if (error.error) {
      console.log('📦 ERROR.ERROR:', JSON.stringify(error.error, null, 2));
      console.log('');
      
      if (error.error.data && error.error.data !== '0x') {
        console.log('📦 ERROR.ERROR.DATA:', error.error.data);
        console.log('');
        
        try {
          const errorInterface = new ethers.Interface([
            'error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData)'
          ]);
          
          const decoded = errorInterface.parseError(error.error.data);
          if (decoded) {
            offchainData = decoded.args;
            console.log('🔍 DECODED OFFCHAIN LOOKUP (from error.error.data):');
            console.log('═'.repeat(80), '\n');
          }
        } catch (e) {
          console.log('Could not decode error.error.data:', e.message);
          console.log('');
        }
      }
    }
    
    // Display decoded offchain lookup
    if (offchainData) {
      console.log('Sender (Resolver):', offchainData.sender || offchainData[0]);
      console.log('');
      
      console.log('Gateway URLs:');
      const urls = offchainData.urls || offchainData[1];
      if (Array.isArray(urls)) {
        urls.forEach((url, i) => {
          console.log(`  [${i}]`, url);
        });
      } else {
        console.log('  ', urls);
      }
      console.log('');
      
      const callDataArg = offchainData.callData || offchainData[2];
      console.log('Call Data (to send to gateway):', callDataArg);
      console.log('');
      
      const callbackFn = offchainData.callbackFunction || offchainData[3];
      console.log('Callback Function:', callbackFn);
      console.log('');
      
      const extraDataArg = offchainData.extraData || offchainData[4];
      console.log('Extra Data:', extraDataArg);
      console.log('');
      
      console.log('═'.repeat(80));
      console.log('📖 HOW CCIP-READ WORKS:');
      console.log('═'.repeat(80), '\n');
      console.log('1. Client queries resolver on-chain');
      console.log('2. Resolver throws OffchainLookup error with:');
      console.log('   - Gateway URLs (where to fetch data)');
      console.log('   - Call data (what to send to gateway)');
      console.log('   - Callback function (how to verify response)');
      console.log('');
      console.log('3. Client fetches from gateway:');
      const firstUrl = Array.isArray(urls) ? urls[0] : urls;
      console.log(`   GET ${firstUrl}/{sender}/{callData}.json`);
      console.log('');
      console.log('4. Gateway returns signed response');
      console.log('5. Client calls callback function with signed data');
      console.log('6. Resolver verifies signature and returns result');
      console.log('');
      
    } else {
      console.log('═'.repeat(80));
      console.log('❌ NO OFFCHAIN LOOKUP DATA FOUND');
      console.log('═'.repeat(80), '\n');
      console.log('The resolver reverted but did not provide OffchainLookup error.');
      console.log('This likely means:');
      console.log('  1. The resolver is not configured with gateway URLs');
      console.log('  2. The resolver is reverting for a different reason');
      console.log('  3. The call data format is incorrect');
      console.log('');
    }
  }

  console.log('═'.repeat(80));
  console.log('✅ ANALYSIS COMPLETE');
  console.log('═'.repeat(80), '\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ SCRIPT ERROR:', error);
    process.exit(1);
  });
