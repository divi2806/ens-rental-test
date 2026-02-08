const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Step 4: Test renting a subdomain
 */

async function main() {
  console.log('\n🧪 Testing Subdomain Rental');
  console.log('━'.repeat(60), '\n');

  const [renter] = await ethers.getSigners();
  console.log('Renter address:', renter.address);
  
  const balance = await ethers.provider.getBalance(renter.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Load config
  if (!fs.existsSync('./config.json')) {
    console.error('❌ Config not found!\n');
    process.exit(1);
  }
  
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  
  if (!config.setupComplete) {
    console.error('❌ Setup not complete! Run 03-transfer-ownership.js first\n');
    process.exit(1);
  }
  
  console.log('Configuration:');
  console.log('  Domain:', config.domain);
  console.log('  Registrar:', config.registrarAddress);
  console.log('  Rental Price:', config.rentalPrice, 'ETH/year\n');

  // Connect to contract
  const SubnameRegistrarDirect = await ethers.getContractFactory('SubnameRegistrarDirect');
  const registrar = SubnameRegistrarDirect.attach(config.registrarAddress);
  
  const testLabel = 'alice';
  const fullName = `${testLabel}.${config.domain}`;
  
  // Check availability
  console.log('1️⃣  Checking availability...');
  const available = await registrar.isAvailable(testLabel);
  console.log(`   ${fullName} is ${available ? 'available ✅' : 'taken ❌'}\n`);
  
  if (!available) {
    const info = await registrar.getRentalInfo(testLabel);
    console.log('   Current rental info:');
    console.log('     Renter:', info[0]);
    console.log('     Expiry:', new Date(Number(info[1]) * 1000).toLocaleString());
    console.log('     Active:', info[2], '\n');
    console.log('   Try a different label or wait for expiry\n');
    return;
  }
  
  // Get price
  const rentalPrice = await registrar.rentalPrice();
  console.log('2️⃣  Rental details:');
  console.log('   Label:', testLabel);
  console.log('   Full name:', fullName);
  console.log('   Renter:', renter.address);
  console.log('   Price:', ethers.formatEther(rentalPrice), 'ETH\n');
  
  // Rent subdomain
  console.log('3️⃣  Renting subdomain...');
  const tx = await registrar.rentSubname(testLabel, renter.address, {
    value: rentalPrice,
    gasLimit: 500000
  });
  
  console.log('   TX:', tx.hash);
  const receipt = await tx.wait();
  console.log('   ✅ Subdomain rented!\n');
  
  // Verify
  console.log('4️⃣  Verifying rental...');
  const info = await registrar.getRentalInfo(testLabel);
  const expiryDate = new Date(Number(info[1]) * 1000);
  
  console.log('   Renter:', info[0]);
  console.log('   Expiry:', expiryDate.toLocaleString());
  console.log('   Active:', info[2]);
  console.log('   Match:', info[0].toLowerCase() === renter.address.toLowerCase() ? '✅' : '❌\n');
  
  console.log('━'.repeat(60));
  console.log('✅ TEST SUCCESSFUL!');
  console.log('━'.repeat(60));
  console.log('\n🎉 Subdomain rental is working!');
  console.log(`\n📋 ${fullName}`);
  console.log('   Owner:', info[0]);
  console.log('   Expires:', expiryDate.toLocaleString());
  console.log('   TX:', tx.hash, '\n');
  
  console.log('🌐 View on ENS:');
  console.log('   https://app.ens.domains/' + fullName, '\n');
  
  console.log('💡 Next Steps:');
  console.log('   1. Users can rent subdomains by calling rentSubname()');
  console.log('   2. Renters can renew by calling renewSubname()');
  console.log('   3. You can withdraw fees by calling withdraw()');
  console.log('   4. Update price with updatePrice()\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });