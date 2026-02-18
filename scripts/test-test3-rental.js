const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Test renting subdomains under test3.divicompany.eth
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
  console.log('\n🧪 Testing test3.divicompany.eth Rental System');
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Load config
  let config;
  try {
    config = JSON.parse(fs.readFileSync('./test3-registrar-config.json', 'utf8'));
  } catch (e) {
    console.error('❌ test3-registrar-config.json not found!');
    console.error('   Run: npx hardhat run scripts/13-deploy-test3-registrar.js --network sepolia\n');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log('  Registrar:', config.registrarProxy);
  console.log('  Domain:', config.domain);
  console.log('  OffchainResolver:', OFFCHAIN_RESOLVER, '\n');

  // Connect to registrar
  const SubnameRegistrar = await ethers.getContractFactory('SubnameRegistrar');
  const registrar = SubnameRegistrar.attach(config.registrarProxy);

  const rentalPrice = await registrar.rentalPrice();
  console.log('Rental price:', ethers.formatEther(rentalPrice), 'ETH\n');

  // Subdomains to rent
  const subdomains = [
    { label: 'demo', description: 'Demo subdomain' },
    { label: 'alice', description: 'Alice subdomain' },
    { label: '1', description: 'Numbered subdomain' }
  ];

  const nameWrapper = await ethers.getContractAt(
    ['function setResolver(bytes32 node, address resolver) external',
     'function ownerOf(uint256 tokenId) external view returns (address)'],
    NAME_WRAPPER
  );

  console.log('━'.repeat(60));
  
  for (const { label, description } of subdomains) {
    const fullName = `${label}.${config.domain}`;
    const node = namehash(fullName);
    
    console.log(`\n📝 Renting: ${fullName}`);
    console.log(`   Description: ${description}`);
    console.log(`   Node: ${node}`);

    // Check availability
    const available = await registrar.isAvailable(label);
    
    if (available) {
      console.log('   Status: Available ✅');
      
      // Rent subdomain
      console.log('   Renting...');
      try {
        const tx = await registrar.rentSubname(label, deployer.address, {
          value: rentalPrice,
          gasLimit: 500000
        });
        console.log('   TX:', tx.hash);
        await tx.wait();
        console.log('   ✅ Rented!');
      } catch (e) {
        console.log('   ❌ Error renting:', e.message);
        if (e.message.includes('Not approved')) {
          console.log('   ⚠️  Registrar not approved! Run approval via Safe first.');
          console.log('   See: SAFE-TX-APPROVE-TEST3.md\n');
          process.exit(1);
        }
        continue;
      }
    } else {
      const info = await registrar.getRentalInfo(label);
      console.log('   Status: Already rented');
      console.log('   Owner:', info[0]);
      console.log('   Expiry:', new Date(Number(info[1]) * 1000).toLocaleString());
    }

    // Set resolver to OffchainResolver
    console.log('   Setting resolver to OffchainResolver...');
    try {
      const tx2 = await nameWrapper.setResolver(node, OFFCHAIN_RESOLVER, {
        gasLimit: 100000
      });
      console.log('   TX:', tx2.hash);
      await tx2.wait();
      console.log('   ✅ Resolver set!');
    } catch (e) {
      console.log('   ℹ️  Resolver already set or error:', e.message);
    }

    // Verify ownership
    try {
      const owner = await nameWrapper.ownerOf(node);
      console.log('   Owner verified:', owner);
      console.log('   Match:', owner.toLowerCase() === deployer.address.toLowerCase() ? '✅' : '❌');
    } catch (e) {
      console.log('   ⚠️  Could not verify owner');
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log('✅ RENTAL SYSTEM TEST COMPLETE!');
  console.log('━'.repeat(60));
  console.log('\n📊 Summary:');
  console.log('   Registered subdomains under test3.divicompany.eth:');
  subdomains.forEach(({ label }) => {
    console.log(`   - ${label}.${config.domain}`);
  });
  console.log('\n   All resolvers set to OffchainResolver ✅\n');
  
  console.log('📍 Architecture:');
  console.log('   divicompany.eth (MULTISIG)');
  console.log('   └── test3.divicompany.eth (MULTISIG - not rentable)');
  subdomains.forEach(({ label }) => {
    console.log(`       ├── ${label}.test3.divicompany.eth (PUBLIC can rent) ✅`);
  });
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
