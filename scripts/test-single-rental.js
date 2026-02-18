const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Test single rental with detailed error handling
 */

async function main() {
  console.log('\n🧪 Testing Single Rental with Error Details');
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  const config = JSON.parse(fs.readFileSync('./test3-registrar-config.json', 'utf8'));
  console.log('Registrar:', config.registrarProxy);
  console.log('Domain:', config.domain, '\n');

  const SubnameRegistrar = await ethers.getContractFactory('SubnameRegistrar');
  const registrar = SubnameRegistrar.attach(config.registrarProxy);

  const rentalPrice = await registrar.rentalPrice();
  console.log('Rental price:', ethers.formatEther(rentalPrice), 'ETH\n');

  // Try to rent with detailed error catching
  const label = 'test';
  console.log(`📝 Attempting to rent: ${label}.${config.domain}`);
  
  // Check availability first
  const available = await registrar.isAvailable(label);
  console.log('   Available:', available);
  
  if (!available) {
    const info = await registrar.getRentalInfo(label);
    console.log('   Already rented by:', info[0]);
    console.log('   Expires:', new Date(Number(info[1]) * 1000).toLocaleString());
    console.log('\n   Trying anyway to see the error...\n');
  }

  // Try to estimate gas first
  console.log('🔍 Estimating gas...');
  try {
    const gasEstimate = await registrar.rentSubname.estimateGas(label, deployer.address, {
      value: rentalPrice
    });
    console.log('   Gas estimate:', gasEstimate.toString());
  } catch (e) {
    console.log('   ❌ Gas estimation failed!');
    console.log('   Error:', e.message);
    
    if (e.data) {
      console.log('   Error data:', e.data);
      
      // Try to decode error
      try {
        const iface = new ethers.Interface([
          'error AlreadyRented()',
          'error InsufficientPayment(uint256 required, uint256 sent)',
          'error NotApproved()',
          'error Unauthorized()'
        ]);
        
        const decodedError = iface.parseError(e.data);
        if (decodedError) {
          console.log('   Decoded error:', decodedError.name);
          console.log('   Args:', decodedError.args);
        }
      } catch (decodeErr) {
        console.log('   Could not decode error');
      }
    }
    
    if (e.error && e.error.message) {
      console.log('   Inner error:', e.error.message);
    }
    
    console.log('\n━'.repeat(60));
    console.log('🔍 POSSIBLE ISSUES:');
    console.log('━'.repeat(60));
    
    if (e.message.includes('AlreadyRented')) {
      console.log('❌ Subdomain already rented');
      console.log('   Solution: Try a different label\n');
    } else if (e.message.includes('NotApproved')) {
      console.log('❌ Registrar not approved by Name Wrapper');
      console.log('   Solution: Execute Safe transaction to approve\n');
    } else if (e.message.includes('InsufficientPayment')) {
      console.log('❌ Payment amount incorrect');
      console.log('   Required:', ethers.formatEther(rentalPrice), 'ETH\n');
    } else {
      console.log('❌ Unknown error - checking common issues...\n');
      
      // Check if test3 exists
      const nameWrapper = await ethers.getContractAt(
        ['function ownerOf(uint256 tokenId) external view returns (address)'],
        '0x0635513f179D50A207757E05759CbD106d7dFcE8'
      );
      
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
      
      try {
        const test3Node = namehash('test3.divicompany.eth');
        const owner = await nameWrapper.ownerOf(test3Node);
        console.log('   test3.divicompany.eth owner:', owner);
        console.log('   (Should be multisig: 0x834163C217FF4dAeE028f27cEEb6a7fAB51B02b7)\n');
      } catch (checkErr) {
        console.log('   ❌ test3.divicompany.eth does not exist!');
        console.log('   Solution: Create it via Safe first\n');
      }
    }
    
    return;
  }

  // If gas estimation succeeded, try the actual transaction
  console.log('\n📝 Sending transaction...');
  try {
    const tx = await registrar.rentSubname(label, deployer.address, {
      value: rentalPrice,
      gasLimit: 500000
    });
    console.log('   TX:', tx.hash);
    const receipt = await tx.wait();
    console.log('   ✅ Success! Block:', receipt.blockNumber);
  } catch (e) {
    console.log('   ❌ Transaction failed');
    console.log('   Error:', e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
