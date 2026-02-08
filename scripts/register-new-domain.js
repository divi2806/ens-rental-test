const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Register a new .eth domain on Sepolia testnet
 * Use this if you don't have a domain yet
 */

const BASE_REGISTRAR = '0x084b1c3C81545d370f3634392De611CaaBFf8148';
const ETH_REGISTRAR_CONTROLLER = '0xFED6a969AaA60E4961FCD3EBF1A2e8913ac65B72'; // Sepolia

// CONFIGURE THIS
const DESIRED_NAME = 'myproject';  // Just the label, without .eth
const DURATION = 31536000; // 1 year in seconds

async function main() {
  console.log('\n📝 Registering New .eth Domain on Sepolia');
  console.log('━'.repeat(60));
  console.log(`Name: ${DESIRED_NAME}.eth`);
  console.log('━'.repeat(60), '\n');

  const [signer] = await ethers.getSigners();
  console.log('Your address:', signer.address);
  
  const balance = await ethers.provider.getBalance(signer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  if (balance < ethers.parseEther('0.01')) {
    console.error('❌ Insufficient balance! Get Sepolia ETH from:');
    console.log('   - https://sepoliafaucet.com');
    console.log('   - https://www.alchemy.com/faucets/ethereum-sepolia');
    console.log('   - https://faucet.quicknode.com/ethereum/sepolia\n');
    process.exit(1);
  }

  // Check availability
  console.log('1️⃣  Checking availability...');
  const registrarAbi = [
    'function available(uint256 id) view returns (bool)'
  ];
  
  const labelHash = ethers.id(DESIRED_NAME);
  const registrar = new ethers.Contract(BASE_REGISTRAR, registrarAbi, signer);
  
  try {
    const isAvailable = await registrar.available(labelHash);
    
    if (!isAvailable) {
      console.log(`   ❌ ${DESIRED_NAME}.eth is already taken!`);
      console.log('   Try a different name.\n');
      process.exit(1);
    }
    
    console.log(`   ✅ ${DESIRED_NAME}.eth is available!\n`);
  } catch (error) {
    console.log('   ⚠️  Cannot check availability:', error.message);
    console.log('   Proceeding anyway...\n');
  }

  console.log('2️⃣  Registration options...');
  console.log('');
  console.log('   Option A: Use ENS App (Recommended)');
  console.log('   ────────────────────────────────────');
  console.log('   1. Go to https://app.ens.domains');
  console.log(`   2. Search for "${DESIRED_NAME}"`);
  console.log('   3. Click "Register"');
  console.log('   4. Follow the 2-step process');
  console.log('   5. Come back and run 01-wrap-domain.js\n');
  console.log('   ✅ Easiest and most reliable\n');
  
  console.log('   Option B: Direct Contract Call (Advanced)');
  console.log('   ──────────────────────────────────────────');
  console.log('   Note: Sepolia controller might have different interface');
  console.log('   This may fail. Use ENS App if it does.\n');

  console.log('━'.repeat(60));
  console.log('💡 RECOMMENDATION');
  console.log('━'.repeat(60));
  console.log('\nFor Sepolia testnet, easiest method:');
  console.log('\n1. Go to https://app.ens.domains');
  console.log(`2. Connect your wallet (${signer.address})`);
  console.log('3. Switch to Sepolia network');
  console.log(`4. Search and register "${DESIRED_NAME}.eth"`);
  console.log('5. Wait for confirmation');
  console.log('6. Update scripts/01-wrap-domain.js with your domain');
  console.log('7. Run: npx hardhat run scripts/01-wrap-domain.js --network sepolia\n');
  
  console.log('🌐 Quick Links:');
  console.log(`   ENS App: https://app.ens.domains/search?q=${DESIRED_NAME}`);
  console.log('   Sepolia Faucet: https://sepoliafaucet.com\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
