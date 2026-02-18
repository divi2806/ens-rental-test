const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

async function main() {
  console.log('\n🧪 Testing Subdomain Rental (Updated)');
  console.log('━'.repeat(60), '\n');

  const [renter] = await ethers.getSigners();
  console.log('Renter address:', renter.address);
  
  const balance = await ethers.provider.getBalance(renter.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  
  console.log('Configuration:');
  console.log('  Domain:', config.domain);
  console.log('  Registrar:', config.registrarAddress);
  console.log('  Rental Price:', config.rentalPrice, 'ETH/year\n');

  const SubnameRegistrar = await ethers.getContractFactory('SubnameRegistrar');
  const registrar = SubnameRegistrar.attach(config.registrarAddress);
  
  const testLabel = 'testupgrade' + Date.now();
  const fullName = `${testLabel}.${config.domain}`;
  
  console.log('1️⃣  Checking availability...');
  const available = await registrar.isAvailable(testLabel);
  console.log(`   ${testLabel} is ${available ? 'available ✅' : 'taken ❌'}\n`);
  
  const rentalPrice = await registrar.rentalPrice();
  console.log('2️⃣  Rental details:');
  console.log('   Label:', testLabel);
  console.log('   Full name:', fullName);
  console.log('   Renter:', renter.address);
  console.log('   Price:', ethers.formatEther(rentalPrice), 'ETH\n');
  
  console.log('3️⃣  Renting subdomain...');
  try {
    const tx = await registrar.rentSubname(testLabel, renter.address, {
      value: rentalPrice,
      gasLimit: 500000
    });
    
    console.log('   TX:', tx.hash);
    const receipt = await tx.wait();
    console.log('   ✅ Subdomain rented!\n');
    
    console.log('4️⃣  Verifying rental...');
    const info = await registrar.getRentalInfo(testLabel);
    console.log('   Renter:', info[0]);
    console.log('   Expiry:', new Date(Number(info[1]) * 1000).toLocaleString());
    console.log('   Active:', info[2], '\n');
    
    console.log('━'.repeat(60));
    console.log('✅ TEST SUCCESSFUL!');
    console.log('━'.repeat(60));
    console.log(`\n🎉 Subdomain ${fullName} rented successfully!`);
    console.log('📍 TX:', tx.hash);
    console.log('📍 Etherscan: https://sepolia.etherscan.io/tx/' + tx.hash, '\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.data) {
      console.error('Data:', error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
