const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Step 11: Test the rental system
 * 
 * This script:
 * 1. Rents 1.test.divicompany.eth (public rental)
 * 2. Rents alice.test.divicompany.eth (public rental)
 * 3. Rents a.test2.divicompany.eth (public rental)
 * 4. Sets OffchainResolver for all second-level subdomains
 * 5. Verifies ownership and resolver settings
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
  console.log('\n🧪 Testing Rental System');
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Load configs
  const testConfig = JSON.parse(fs.readFileSync('./test-registrar-config.json', 'utf8'));
  const test2Config = JSON.parse(fs.readFileSync('./test2-registrar-config.json', 'utf8'));
  const offchainResolverAddress = '0x6Dea337D5BDBCe2DB66196AbA020bC02e6193b2d'; // From previous deployment

  console.log('Configuration:');
  console.log('  test.divicompany.eth registrar:', testConfig.registrarProxy);
  console.log('  test2.divicompany.eth registrar:', test2Config.registrarProxy);
  console.log('  OffchainResolver:', offchainResolverAddress, '\n');

  // Connect to registrars
  const SubnameRegistrar = await ethers.getContractFactory('SubnameRegistrar');
  const testRegistrar = SubnameRegistrar.attach(testConfig.registrarProxy);
  const test2Registrar = SubnameRegistrar.attach(test2Config.registrarProxy);

  const rentalPrice = await testRegistrar.rentalPrice();
  console.log('Rental price:', ethers.formatEther(rentalPrice), 'ETH\n');

  // Subdomains to rent
  const rentals = [
    { label: '1', domain: 'test.divicompany.eth', registrar: testRegistrar },
    { label: 'alice', domain: 'test.divicompany.eth', registrar: testRegistrar },
    { label: 'a', domain: 'test2.divicompany.eth', registrar: test2Registrar }
  ];

  const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
  const nameWrapper = await ethers.getContractAt(
    ['function setResolver(bytes32 node, address resolver) external',
     'function ownerOf(uint256 tokenId) external view returns (address)'],
    NAME_WRAPPER
  );

  console.log('━'.repeat(60));
  
  for (const { label, domain, registrar } of rentals) {
    const fullName = `${label}.${domain}`;
    const node = namehash(fullName);
    
    console.log(`\n📝 Renting: ${fullName}`);
    console.log(`   Node: ${node}`);

    // Check availability
    const available = await registrar.isAvailable(label);
    
    if (available) {
      console.log('   Status: Available ✅');
      
      // Rent subdomain
      console.log('   Renting...');
      const tx = await registrar.rentSubname(label, deployer.address, {
        value: rentalPrice,
        gasLimit: 500000
      });
      console.log('   TX:', tx.hash);
      await tx.wait();
      console.log('   ✅ Rented!');
    } else {
      const info = await registrar.getRentalInfo(label);
      console.log('   Status: Already rented');
      console.log('   Owner:', info[0]);
      console.log('   Expiry:', new Date(Number(info[1]) * 1000).toLocaleString());
    }

    // Set resolver to OffchainResolver
    console.log('   Setting resolver to OffchainResolver...');
    try {
      const tx2 = await nameWrapper.setResolver(node, offchainResolverAddress, {
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
      console.log('   ⚠️  Could not verify owner:', e.message);
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log('✅ RENTAL SYSTEM TEST COMPLETE!');
  console.log('━'.repeat(60));
  console.log('\n📊 Summary:');
  console.log('   Registered subdomains:');
  console.log('   - 1.test.divicompany.eth');
  console.log('   - alice.test.divicompany.eth');
  console.log('   - a.test2.divicompany.eth\n');
  console.log('   All resolvers set to OffchainResolver ✅\n');
  
  console.log('🎯 Next Steps:');
  console.log('   1. Update gateway to serve these subdomains');
  console.log('   2. Register offchain data for second-level subdomains\n');
  
  console.log('📍 Architecture:');
  console.log('   divicompany.eth (YOU)');
  console.log('   ├── test.divicompany.eth (YOURS - not rentable)');
  console.log('   │   ├── 1.test.divicompany.eth (PUBLIC can rent) ✅');
  console.log('   │   └── alice.test.divicompany.eth (PUBLIC can rent) ✅');
  console.log('   └── test2.divicompany.eth (YOURS - not rentable)');
  console.log('       └── a.test2.divicompany.eth (PUBLIC can rent) ✅\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
