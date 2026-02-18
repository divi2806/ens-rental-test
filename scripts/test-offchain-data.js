const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Rent a subdomain and show offchain fallback data
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
  console.log('\n🔍 OFFCHAIN FALLBACK DATA TEST');
  console.log('━'.repeat(80), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('👤 Wallet:', deployer.address);
  
  // Load config
  const config = JSON.parse(fs.readFileSync('./test3-registrar-config.json', 'utf8'));
  console.log('📍 Registrar:', config.registrarProxy);
  console.log('📍 Domain:', config.domain);
  console.log('');

  // Connect to registrar
  const SubnameRegistrar = await ethers.getContractFactory('SubnameRegistrar');
  const registrar = SubnameRegistrar.attach(config.registrarProxy);

  const rentalPrice = await registrar.rentalPrice();
  
  // Subdomain to rent
  const label = 'hello';
  const fullName = `${label}.${config.domain}`;
  const node = namehash(fullName);
  
  console.log('━'.repeat(80));
  console.log('📝 RENTING SUBDOMAIN');
  console.log('━'.repeat(80), '\n');
  console.log('Label:', label);
  console.log('Full name:', fullName);
  console.log('Node (namehash):', node);
  console.log('Price:', ethers.formatEther(rentalPrice), 'ETH');
  console.log('');

  // Check if available
  const available = await registrar.isAvailable(label);
  
  if (!available) {
    console.log('⚠️  Already rented! Showing existing data...\n');
  } else {
    console.log('✅ Available! Renting now...\n');
    
    try {
      const tx = await registrar.rentSubname(label, deployer.address, {
        value: rentalPrice,
        gasLimit: 500000
      });
      
      console.log('📤 Transaction sent:', tx.hash);
      console.log('⏳ Waiting for confirmation...');
      
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed! Block:', receipt.blockNumber);
      console.log('');
      
      // Parse events
      console.log('━'.repeat(80));
      console.log('📋 TRANSACTION EVENTS');
      console.log('━'.repeat(80), '\n');
      
      for (const log of receipt.logs) {
        try {
          const parsed = registrar.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsed) {
            console.log('Event:', parsed.name);
            console.log('Args:', JSON.stringify(parsed.args, null, 2));
            console.log('');
          }
        } catch (e) {
          // Not an event from our contract
        }
      }
      
    } catch (e) {
      console.log('❌ Error renting:', e.message);
      console.log('');
      if (e.message.includes('Already rented')) {
        console.log('Subdomain already exists, continuing to show data...\n');
      } else {
        return;
      }
    }
  }

  // Query Name Wrapper for data
  console.log('━'.repeat(80));
  console.log('📊 ON-CHAIN DATA (Name Wrapper)');
  console.log('━'.repeat(80), '\n');
  
  const nameWrapper = await ethers.getContractAt(
    [
      'function ownerOf(uint256 tokenId) external view returns (address)',
      'function getData(uint256 tokenId) external view returns (address owner, uint32 fuses, uint64 expiry)',
      'function names(bytes32 node) external view returns (bytes memory)'
    ],
    NAME_WRAPPER
  );

  try {
    const owner = await nameWrapper.ownerOf(node);
    console.log('Owner:', owner);
    console.log('Owner matches wallet:', owner.toLowerCase() === deployer.address.toLowerCase() ? '✅' : '❌');
    console.log('');
    
    const data = await nameWrapper.getData(node);
    console.log('Fuses:', '0x' + data[1].toString(16).padStart(8, '0'));
    console.log('Expiry:', data[2].toString(), '→', new Date(Number(data[2]) * 1000).toLocaleString());
    console.log('');
    
  } catch (e) {
    console.log('❌ Error fetching on-chain data:', e.message);
    console.log('');
  }

  // Query Offchain Resolver
  console.log('━'.repeat(80));
  console.log('🌐 OFFCHAIN RESOLVER DATA');
  console.log('━'.repeat(80), '\n');
  
  const resolver = await ethers.getContractAt(
    [
      'function addr(bytes32 node) external view returns (address)',
      'function text(bytes32 node, string calldata key) external view returns (string memory)',
      'function contenthash(bytes32 node) external view returns (bytes memory)'
    ],
    OFFCHAIN_RESOLVER
  );

  console.log('Resolver address:', OFFCHAIN_RESOLVER);
  console.log('Node:', node);
  console.log('');

  // Try to get ETH address
  console.log('📍 Querying addr(node)...');
  try {
    const addr = await resolver.addr(node);
    console.log('   ETH Address:', addr);
    console.log('');
  } catch (e) {
    console.log('   Error:', e.message);
    if (e.message.includes('OffchainLookup')) {
      console.log('');
      console.log('   ✅ OFFCHAIN LOOKUP TRIGGERED!');
      console.log('   This means the resolver is redirecting to gateway.');
      console.log('');
      
      // Extract CCIP-Read data
      if (e.data) {
        console.log('   📦 CCIP-Read Error Data:');
        console.log('   ', e.data);
        console.log('');
      }
      
      if (e.error && e.error.data) {
        console.log('   📦 Nested Error Data:');
        console.log('   ', e.error.data);
        console.log('');
        
        // Try to decode OffchainLookup
        try {
          const iface = new ethers.Interface([
            'error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData)'
          ]);
          
          const decoded = iface.parseError(e.error.data);
          if (decoded) {
            console.log('   🔍 DECODED OFFCHAIN LOOKUP:');
            console.log('   ━'.repeat(76), '\n');
            console.log('   Sender:', decoded.args[0]);
            console.log('   URLs:', JSON.stringify(decoded.args[1], null, 2));
            console.log('   Call Data:', decoded.args[2]);
            console.log('   Callback Function:', decoded.args[3]);
            console.log('   Extra Data:', decoded.args[4]);
            console.log('');
          }
        } catch (decodeErr) {
          console.log('   Could not decode OffchainLookup:', decodeErr.message);
          console.log('');
        }
      }
    } else {
      console.log('');
    }
  }

  // Try to get text records
  console.log('━'.repeat(80));
  console.log('📝 TEXT RECORDS');
  console.log('━'.repeat(80), '\n');
  
  const textKeys = ['email', 'url', 'avatar', 'description', 'com.twitter', 'com.github'];
  
  for (const key of textKeys) {
    console.log(`Querying text("${key}")...`);
    try {
      const value = await resolver.text(node, key);
      console.log(`   ${key}:`, value || '(empty)');
    } catch (e) {
      if (e.message.includes('OffchainLookup')) {
        console.log(`   ${key}: → OFFCHAIN LOOKUP`);
      } else {
        console.log(`   ${key}: Error -`, e.message.substring(0, 50));
      }
    }
  }
  
  console.log('');
  console.log('━'.repeat(80));
  console.log('✅ TEST COMPLETE');
  console.log('━'.repeat(80), '\n');
  
  console.log('📌 Summary:');
  console.log('   Subdomain:', fullName);
  console.log('   Node:', node);
  console.log('   Resolver:', OFFCHAIN_RESOLVER);
  console.log('   Owner:', deployer.address);
  console.log('');
  console.log('🔗 Next: Query gateway directly at http://localhost:3001');
  console.log('   curl http://localhost:3001/' + fullName);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
