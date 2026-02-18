const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

async function main() {
  console.log('\n🔍 Checking Contract State');
  console.log('━'.repeat(60), '\n');

  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  
  console.log('Proxy Address:', config.registrarAddress);
  console.log('Implementation:', config.registrarImplementation, '\n');

  const SubnameRegistrar = await ethers.getContractFactory('SubnameRegistrar');
  const registrar = SubnameRegistrar.attach(config.registrarAddress);
  
  try {
    const nameWrapper = await registrar.nameWrapper();
    console.log('Name Wrapper:', nameWrapper);
    
    const parentNode = await registrar.parentNode();
    console.log('Parent Node:', parentNode);
    
    const rentalPrice = await registrar.rentalPrice();
    console.log('Rental Price:', ethers.formatEther(rentalPrice), 'ETH');
    
    const rentalDuration = await registrar.rentalDuration();
    console.log('Rental Duration:', Number(rentalDuration) / 86400, 'days');
    
    const owner = await registrar.owner();
    console.log('Owner:', owner, '\n');
    
    console.log('✅ Contract is properly initialized!');
  } catch (error) {
    console.error('❌ Error reading contract state:');
    console.error(error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
