const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Step 6: Register test/test2 on-chain + set OffchainResolver
 *
 * 1. Rents test.divicompany.eth via SubnameRegistrar (0.001 ETH)
 * 2. Rents test2.divicompany.eth via SubnameRegistrar (0.001 ETH)
 * 3. Sets resolver for test.divicompany.eth → OffchainResolver (via NameWrapper.setResolver)
 * 4. Sets resolver for test2.divicompany.eth → OffchainResolver (via NameWrapper.setResolver)
 *
 * Note: SubnameRegistrar.rentSubname uses setSubnodeOwner which sets resolver=0x0,
 * so we must explicitly set the resolver after renting.
 */

const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';

// Minimal NameWrapper ABI for setResolver
const NAME_WRAPPER_ABI = [
  'function setResolver(bytes32 node, address resolver) external',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function getData(uint256 tokenId) external view returns (address owner, uint32 fuses, uint64 expiry)',
];

function namehash(name) {
  if (!name || name === '') return ethers.ZeroHash;
  const labels = name.split('.');
  let node = ethers.ZeroHash;
  for (let i = labels.length - 1; i >= 0; i--) {
    const labelHash = ethers.keccak256(ethers.toUtf8Bytes(labels[i]));
    node = ethers.keccak256(ethers.solidityPacked(['bytes32', 'bytes32'], [node, labelHash]));
  }
  return node;
}

async function main() {
  console.log('\n🚀 Registering Subdomains & Setting OffchainResolver');
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Load config
  if (!fs.existsSync('./config.json')) {
    console.error('❌ Config not found!\n');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

  if (!config.offchainResolverAddress) {
    console.error('❌ OffchainResolver not deployed! Run 05-deploy-offchain-resolver.js first\n');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log('  Domain:', config.domain);
  console.log('  Registrar:', config.registrarAddress);
  console.log('  OffchainResolver:', config.offchainResolverAddress);
  console.log('  Name Wrapper:', NAME_WRAPPER, '\n');

  // Connect to contracts
  const SubnameRegistrar = await ethers.getContractFactory('SubnameRegistrar');
  const registrar = SubnameRegistrar.attach(config.registrarAddress);

  const nameWrapper = new ethers.Contract(NAME_WRAPPER, NAME_WRAPPER_ABI, deployer);

  const rentalPrice = await registrar.rentalPrice();
  console.log('Rental price:', ethers.formatEther(rentalPrice), 'ETH\n');

  // Subdomains to register
  const subdomains = ['test', 'test2'];

  for (const label of subdomains) {
    const fullName = `${label}.${config.domain}`;
    const node = namehash(fullName);

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📝 Processing: ${fullName}`);
    console.log(`   Node: ${node}`);

    // Step 1: Check availability and rent
    const available = await registrar.isAvailable(label);
    if (available) {
      console.log(`   Status: Available — renting...`);
      const tx = await registrar.rentSubname(label, deployer.address, {
        value: rentalPrice,
        gasLimit: 500000,
      });
      console.log(`   TX: ${tx.hash}`);
      await tx.wait();
      console.log(`   ✅ Rented!`);
    } else {
      const info = await registrar.getRentalInfo(label);
      console.log(`   Status: Already rented`);
      console.log(`   Owner: ${info[0]}`);
      console.log(`   Expiry: ${new Date(Number(info[1]) * 1000).toLocaleString()}`);
    }

    // Step 2: Set resolver to OffchainResolver
    console.log(`   Setting resolver → ${config.offchainResolverAddress}`);
    try {
      const tx2 = await nameWrapper.setResolver(node, config.offchainResolverAddress, {
        gasLimit: 100000,
      });
      console.log(`   TX: ${tx2.hash}`);
      await tx2.wait();
      console.log(`   ✅ Resolver set!`);
    } catch (error) {
      // If not the owner of the wrapped name, this will fail
      console.log(`   ⚠️  Could not set resolver: ${error.reason || error.message}`);
      console.log(`   (You may need to be the wrapped owner of ${fullName})`);
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log('✅ SETUP COMPLETE!');
  console.log('━'.repeat(60));
  console.log('\n🎯 Next Steps:');
  console.log('   1. Start the gateway (if not running):');
  console.log('      PRIVATE_KEY=... node gateway/server.js');
  console.log('   2. Register offchain sub-subdomains:');
  console.log('      node scripts/07-register-offchain-subdomains.js\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
