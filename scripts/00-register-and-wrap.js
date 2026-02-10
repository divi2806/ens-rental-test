const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Register a new .eth domain via ETH Registrar Controller (commit-reveal)
 * On ENS v3 (Sepolia), this automatically wraps in the Name Wrapper.
 * Pass CANNOT_UNWRAP fuse to lock the parent domain during registration.
 */

const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
const BASE_REGISTRAR = '0x084b1c3C81545d370f3634392De611CaaBFf8148';
const ETH_CONTROLLER = '0xFED6a969AaA60E4961FCD3EBF1A2e8913ac65B72';
const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
const PUBLIC_RESOLVER = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD';

// CONFIGURE THIS
const LABEL = 'divicompany'; // Just the label, without .eth
const DOMAIN = `${LABEL}.eth`;
const DURATION = 31536000; // 1 year in seconds
const CANNOT_UNWRAP = 1; // Fuse to lock the domain in Name Wrapper

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n📝 Register & Wrap ENS Domain (Commit-Reveal)');
  console.log('━'.repeat(60));
  console.log(`Domain: ${DOMAIN}`);
  console.log('━'.repeat(60), '\n');

  const [signer] = await ethers.getSigners();
  console.log('Your address:', signer.address);

  const balance = await ethers.provider.getBalance(signer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // --- 1. Check availability ---
  console.log('1️⃣  Checking availability...');
  const registrarAbi = [
    'function available(uint256 id) view returns (bool)',
    'function ownerOf(uint256 tokenId) view returns (address)',
  ];
  const registrar = new ethers.Contract(BASE_REGISTRAR, registrarAbi, signer);
  const labelHash = ethers.id(LABEL);

  try {
    const isAvailable = await registrar.available(labelHash);
    if (!isAvailable) {
      console.log(`   ❌ ${DOMAIN} is NOT available in Base Registrar.`);
      try {
        const nftOwner = await registrar.ownerOf(labelHash);
        console.log(`   Current NFT owner: ${nftOwner}`);
      } catch (e) {}
      process.exit(1);
    }
    console.log(`   ✅ ${DOMAIN} is available!\n`);
  } catch (error) {
    console.log(`   ⚠️  available() reverted — proceeding anyway (may be unregistered)\n`);
  }

  // --- 2. Get rental price ---
  console.log('2️⃣  Getting registration price...');
  const controllerAbi = [
    'function rentPrice(string memory name, uint256 duration) view returns (tuple(uint256 base, uint256 premium))',
    'function makeCommitment(string memory name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] calldata data, bool reverseRecord, uint16 ownerControlledFuses) pure returns (bytes32)',
    'function commit(bytes32 commitment) external',
    'function register(string calldata name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] calldata data, bool reverseRecord, uint16 ownerControlledFuses) external payable',
    'function minCommitmentAge() view returns (uint256)',
  ];
  const controller = new ethers.Contract(ETH_CONTROLLER, controllerAbi, signer);

  const price = await controller.rentPrice(LABEL, DURATION);
  const totalPrice = price.base + price.premium;
  // Add 10% buffer for price fluctuations
  const priceWithBuffer = totalPrice + (totalPrice / 10n);

  console.log(`   Base price: ${ethers.formatEther(price.base)} ETH`);
  console.log(`   Premium: ${ethers.formatEther(price.premium)} ETH`);
  console.log(`   Total (with 10% buffer): ${ethers.formatEther(priceWithBuffer)} ETH\n`);

  // --- 3. Make commitment ---
  console.log('3️⃣  Creating commitment...');
  const secret = ethers.randomBytes(32);
  const secretHex = ethers.hexlify(secret);
  console.log(`   Secret: ${secretHex}`);

  const commitment = await controller.makeCommitment(
    LABEL,
    signer.address,
    DURATION,
    secretHex,
    PUBLIC_RESOLVER,
    [],          // no extra data
    false,       // no reverse record
    CANNOT_UNWRAP // lock the domain in Name Wrapper
  );
  console.log(`   Commitment: ${commitment}\n`);

  // --- 4. Submit commitment ---
  console.log('4️⃣  Submitting commitment...');
  const commitTx = await controller.commit(commitment);
  console.log(`   TX: ${commitTx.hash}`);
  await commitTx.wait();
  console.log('   ✅ Commitment submitted\n');

  // --- 5. Wait for min commitment age ---
  const minAge = await controller.minCommitmentAge();
  const waitSeconds = Number(minAge) + 5; // Add 5s buffer
  console.log(`5️⃣  Waiting ${waitSeconds} seconds (min commit age: ${Number(minAge)}s)...`);

  for (let i = waitSeconds; i > 0; i--) {
    process.stdout.write(`\r   ⏳ ${i}s remaining...   `);
    await sleep(1000);
  }
  console.log('\r   ✅ Wait complete!              \n');

  // --- 6. Register (+ auto-wrap on ENS v3) ---
  console.log('6️⃣  Registering domain...');
  console.log('   🔒 Burning CANNOT_UNWRAP fuse (locks domain in Name Wrapper)');
  console.log('   📦 ENS v3 auto-wraps during registration\n');

  const registerTx = await controller.register(
    LABEL,
    signer.address,
    DURATION,
    secretHex,
    PUBLIC_RESOLVER,
    [],           // no extra data
    false,        // no reverse record
    CANNOT_UNWRAP, // lock the domain
    { value: priceWithBuffer, gasLimit: 500000 }
  );

  console.log(`   TX: ${registerTx.hash}`);
  const receipt = await registerTx.wait();
  console.log('   ✅ Domain registered!\n');

  // --- 7. Verify ---
  console.log('7️⃣  Verifying registration...');

  // Check ENS Registry
  const registryAbi = ['function owner(bytes32 node) view returns (address)'];
  const registry = new ethers.Contract(ENS_REGISTRY, registryAbi, signer);
  const namehash = ethers.namehash(DOMAIN);
  const registryOwner = await registry.owner(namehash);
  console.log(`   ENS Registry owner: ${registryOwner}`);

  // Check Name Wrapper
  const wrapperAbi = [
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function getData(uint256 tokenId) view returns (address owner, uint32 fuses, uint64 expiry)',
  ];
  const wrapper = new ethers.Contract(NAME_WRAPPER, wrapperAbi, signer);

  try {
    const wrapperOwner = await wrapper.ownerOf(namehash);
    console.log(`   Name Wrapper owner: ${wrapperOwner}`);

    const data = await wrapper.getData(namehash);
    console.log(`   Fuses: 0x${data.fuses.toString(16)} (CANNOT_UNWRAP=${(data.fuses & 1) ? 'YES ✅' : 'NO ❌'})`);
    console.log(`   Expiry: ${new Date(Number(data.expiry) * 1000).toISOString()}`);

    if (wrapperOwner.toLowerCase() === signer.address.toLowerCase()) {
      console.log('   ✅ You own the wrapped domain!\n');
    } else {
      console.log('   ⚠️  Wrapper owner mismatch!\n');
    }
  } catch (error) {
    console.log(`   ⚠️  Name Wrapper check failed: ${error.message}\n`);
    console.log('   Domain may not be auto-wrapped. Run 01-wrap-domain.js next.\n');
  }

  // Check Base Registrar
  try {
    const nftOwner = await registrar.ownerOf(labelHash);
    console.log(`   Base Registrar NFT owner: ${nftOwner}`);
    if (nftOwner.toLowerCase() === NAME_WRAPPER.toLowerCase()) {
      console.log('   ✅ NFT held by Name Wrapper (domain is wrapped)\n');
    }
  } catch (error) {
    console.log(`   ⚠️  Base Registrar check failed\n`);
  }

  // --- 8. Save config ---
  const config = {
    domain: DOMAIN,
    domainHash: namehash,
    owner: signer.address,
    wrapped: true,
    registrationTx: registerTx.hash,
    registeredAt: new Date().toISOString(),
  };
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));

  console.log('💾 Config saved\n');

  console.log('━'.repeat(60));
  console.log('✅ DOMAIN REGISTERED & WRAPPED!');
  console.log('━'.repeat(60));
  console.log(`\n📋 ${DOMAIN}`);
  console.log(`   Owner: ${signer.address}`);
  console.log(`   Wrapped: YES (Name Wrapper)`);
  console.log(`   Locked: YES (CANNOT_UNWRAP)`);
  console.log(`   TX: ${registerTx.hash}\n`);

  console.log('🎯 Next Step:');
  console.log('   Deploy rental contract:');
  console.log('   npx hardhat run scripts/02-deploy-registrar.js --network sepolia\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
