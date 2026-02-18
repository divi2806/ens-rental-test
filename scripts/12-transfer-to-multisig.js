const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Step 12: Transfer ownership to multisig
 * 
 * This script transfers:
 * 1. Name Wrapper NFT ownership of divicompany.eth
 * 2. Name Wrapper NFT ownership of test.divicompany.eth  
 * 3. Name Wrapper NFT ownership of test2.divicompany.eth
 * 4. SubnameRegistrar ownership for divicompany.eth
 * 5. SubnameRegistrar ownership for test.divicompany.eth
 * 6. SubnameRegistrar ownership for test2.divicompany.eth
 * 7. OffchainResolver ownership
 */

const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
const MULTISIG = '0x834163C217FF4dAeE028f27cEEb6a7fAB51B02b7';

const DOMAINS = [
  'divicompany.eth',
  'test.divicompany.eth',
  'test2.divicompany.eth'
];

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
  console.log('\n🔄 Transferring Ownership to Multisig');
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Current owner:', deployer.address);
  console.log('Multisig:', MULTISIG, '\n');

  // Load configurations
  let testConfig, test2Config;
  try {
    testConfig = JSON.parse(fs.readFileSync('./test-registrar-config.json', 'utf8'));
    test2Config = JSON.parse(fs.readFileSync('./test2-registrar-config.json', 'utf8'));
  } catch (e) {
    console.log('⚠️  Warning: Config files not found, some transfers may be skipped\n');
  }

  const CONTRACTS = {
    divicompanyRegistrar: '0xEbb46841B70ba10BBA83C08B0460Fe0Ae8CE6aD7',
    testRegistrar: testConfig?.registrarProxy || '0x80D29c7d6b0fe927a04E0d561E53063B91d7a48f',
    test2Registrar: test2Config?.registrarProxy || '0xE417a07A7b40fD9A8E54615541Ac6280f5A272FE',
    offchainResolver: '0x6Dea337D5BDBCe2DB66196AbA020bC02e6193b2d'
  };

  console.log('Contracts to transfer:');
  console.log('  1. divicompany.eth Registrar:', CONTRACTS.divicompanyRegistrar);
  console.log('  2. test.divicompany.eth Registrar:', CONTRACTS.testRegistrar);
  console.log('  3. test2.divicompany.eth Registrar:', CONTRACTS.test2Registrar);
  console.log('  4. OffchainResolver:', CONTRACTS.offchainResolver, '\n');

  const nameWrapper = await ethers.getContractAt(
    [
      'function safeTransferFrom(address from, address to, uint256 tokenId, uint256 amount, bytes data) external',
      'function ownerOf(uint256 tokenId) external view returns (address)',
      'function getData(uint256 tokenId) external view returns (address owner, uint32 fuses, uint64 expiry)'
    ],
    NAME_WRAPPER
  );

  // ============================================
  // STEP 1: Transfer ENS Name Wrapper NFTs
  // ============================================
  console.log('━'.repeat(60));
  console.log('STEP 1: Transfer ENS Name Wrapper NFTs');
  console.log('━'.repeat(60), '\n');

  for (const domain of DOMAINS) {
    const node = namehash(domain);
    console.log(`📝 Transferring: ${domain}`);
    console.log(`   Node: ${node}`);

    try {
      // Check current owner
      const currentOwner = await nameWrapper.ownerOf(node);
      console.log(`   Current owner: ${currentOwner}`);

      if (currentOwner.toLowerCase() === MULTISIG.toLowerCase()) {
        console.log(`   ✅ Already owned by multisig!\n`);
        continue;
      }

      if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.log(`   ⚠️  Not owned by current wallet, skipping...\n`);
        continue;
      }

      // Transfer NFT
      console.log(`   Transferring to multisig...`);
      const tx = await nameWrapper.safeTransferFrom(
        deployer.address,
        MULTISIG,
        node,
        1,
        '0x',
        { gasLimit: 200000 }
      );
      console.log(`   TX: ${tx.hash}`);
      await tx.wait();
      
      // Verify transfer
      const newOwner = await nameWrapper.ownerOf(node);
      console.log(`   New owner: ${newOwner}`);
      console.log(`   ✅ Transfer successful!\n`);
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}\n`);
    }
  }

  // ============================================
  // STEP 2: Transfer SubnameRegistrar Ownership
  // ============================================
  console.log('━'.repeat(60));
  console.log('STEP 2: Transfer SubnameRegistrar Ownership');
  console.log('━'.repeat(60), '\n');

  const SubnameRegistrar = await ethers.getContractFactory('SubnameRegistrar');

  const registrars = [
    { name: 'divicompany.eth', address: CONTRACTS.divicompanyRegistrar },
    { name: 'test.divicompany.eth', address: CONTRACTS.testRegistrar },
    { name: 'test2.divicompany.eth', address: CONTRACTS.test2Registrar }
  ];

  for (const { name, address } of registrars) {
    console.log(`📝 Transferring ownership: ${name} Registrar`);
    console.log(`   Address: ${address}`);

    try {
      const registrar = SubnameRegistrar.attach(address);
      
      // Check current owner
      const currentOwner = await registrar.owner();
      console.log(`   Current owner: ${currentOwner}`);

      if (currentOwner.toLowerCase() === MULTISIG.toLowerCase()) {
        console.log(`   ✅ Already owned by multisig!\n`);
        continue;
      }

      // Transfer ownership
      console.log(`   Transferring to multisig...`);
      const tx = await registrar.transferOwnership(MULTISIG, { gasLimit: 100000 });
      console.log(`   TX: ${tx.hash}`);
      await tx.wait();

      // Verify transfer
      const newOwner = await registrar.owner();
      console.log(`   New owner: ${newOwner}`);
      console.log(`   ✅ Transfer successful!\n`);
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}\n`);
    }
  }

  // ============================================
  // STEP 3: Transfer OffchainResolver Ownership
  // ============================================
  console.log('━'.repeat(60));
  console.log('STEP 3: Transfer OffchainResolver Ownership');
  console.log('━'.repeat(60), '\n');

  console.log(`📝 Transferring OffchainResolver ownership`);
  console.log(`   Address: ${CONTRACTS.offchainResolver}`);

  try {
    const OffchainResolver = await ethers.getContractFactory('OffchainResolver');
    const resolver = OffchainResolver.attach(CONTRACTS.offchainResolver);

    // Check current owner
    const currentOwner = await resolver.owner();
    console.log(`   Current owner: ${currentOwner}`);

    if (currentOwner.toLowerCase() === MULTISIG.toLowerCase()) {
      console.log(`   ✅ Already owned by multisig!\n`);
    } else {
      // Transfer ownership
      console.log(`   Transferring to multisig...`);
      const tx = await resolver.transferOwnership(MULTISIG, { gasLimit: 100000 });
      console.log(`   TX: ${tx.hash}`);
      await tx.wait();

      // Verify transfer
      const newOwner = await resolver.owner();
      console.log(`   New owner: ${newOwner}`);
      console.log(`   ✅ Transfer successful!\n`);
    }
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}\n`);
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('━'.repeat(60));
  console.log('✅ OWNERSHIP TRANSFER COMPLETE');
  console.log('━'.repeat(60), '\n');

  console.log('📊 Summary:');
  console.log('   Multisig now controls:');
  console.log('   ✅ divicompany.eth (Name Wrapper NFT)');
  console.log('   ✅ test.divicompany.eth (Name Wrapper NFT)');
  console.log('   ✅ test2.divicompany.eth (Name Wrapper NFT)');
  console.log('   ✅ divicompany.eth SubnameRegistrar');
  console.log('   ✅ test.divicompany.eth SubnameRegistrar');
  console.log('   ✅ test2.divicompany.eth SubnameRegistrar');
  console.log('   ✅ OffchainResolver\n');

  console.log('⚠️  IMPORTANT:');
  console.log('   From now on, all contract management requires multisig approval!');
  console.log('   - Withdraw rental fees');
  console.log('   - Update rental prices');
  console.log('   - Upgrade contracts');
  console.log('   - Transfer ENS domains\n');

  console.log('🎯 Multisig Address:');
  console.log('   ' + MULTISIG + '\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
