const hre = require('hardhat');
const ethers = hre.ethers;
const { upgrades } = require('hardhat');
const fs = require('fs');

/**
 * Step 13: Deploy SubnameRegistrar for test3.divicompany.eth
 * 
 * This allows the PUBLIC to rent second-level subdomains like:
 * - 1.test3.divicompany.eth
 * - alice.test3.divicompany.eth
 * - bob.test3.divicompany.eth
 * 
 * Architecture:
 * divicompany.eth (MULTISIG - full control)
 *   └── test3.divicompany.eth (MULTISIG - created directly, not rentable)
 *       └── SubnameRegistrar (PUBLIC can rent *.test3.divicompany.eth)
 */

const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
const DOMAIN = 'test3.divicompany.eth';
const MULTISIG = '0x834163C217FF4dAeE028f27cEEb6a7fAB51B02b7';

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
  console.log('\n🚀 Deploying SubnameRegistrar for test3.divicompany.eth');
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('Multisig (final owner):', MULTISIG);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Calculate namehash for test3.divicompany.eth
  const domainHash = namehash(DOMAIN);
  
  console.log('Configuration:');
  console.log('  Domain:', DOMAIN);
  console.log('  Domain Hash:', domainHash);
  console.log('  Name Wrapper:', NAME_WRAPPER, '\n');

  // Verify test3.divicompany.eth exists and is owned by multisig
  console.log('🔍 Verifying ownership of', DOMAIN);
  const nameWrapper = await ethers.getContractAt('INameWrapper', NAME_WRAPPER);
  
  try {
    const owner = await nameWrapper.ownerOf(domainHash);
    console.log('   Owner:', owner);
    
    if (owner.toLowerCase() !== MULTISIG.toLowerCase()) {
      console.error(`\n⚠️  WARNING: ${DOMAIN} is not owned by multisig!`);
      console.error(`   Owner: ${owner}`);
      console.error(`   Expected: ${MULTISIG}`);
      console.log('\n   Proceeding anyway, but approval step will need to be done by actual owner...\n');
    } else {
      console.log('   ✅ Owned by multisig!\n');
    }
  } catch (e) {
    console.error(`\n❌ ERROR: ${DOMAIN} doesn't exist yet!`);
    console.error('   Please create test3.divicompany.eth via Safe first!\n');
    process.exit(1);
  }

  // Deploy with UUPS proxy
  console.log('📝 Deploying SubnameRegistrar (UUPS Proxy)...\n');
  
  const SubnameRegistrar = await ethers.getContractFactory('SubnameRegistrar');
  const registrar = await upgrades.deployProxy(
    SubnameRegistrar,
    [NAME_WRAPPER, domainHash, deployer.address], // Initially owned by deployer
    { kind: 'uups' }
  );
  
  await registrar.waitForDeployment();
  const proxyAddress = await registrar.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  
  console.log('✅ SubnameRegistrar deployed!');
  console.log('   Proxy Address:', proxyAddress);
  console.log('   Implementation Address:', implementationAddress, '\n');

  // Verify deployment
  console.log('🔍 Verifying deployment...');
  const parentNode = await registrar.parentNode();
  const rentalPrice = await registrar.rentalPrice();
  const owner = await registrar.owner();
  
  console.log('   Parent Node:', parentNode);
  console.log('   Expected:', domainHash);
  console.log('   Match:', parentNode === domainHash ? '✅' : '❌');
  console.log('   Rental Price:', ethers.formatEther(rentalPrice), 'ETH/year');
  console.log('   Owner:', owner);
  console.log('   Owner Match:', owner.toLowerCase() === deployer.address.toLowerCase() ? '✅' : '❌\n');

  // Transfer ownership to multisig
  console.log('📝 Transferring ownership to multisig...');
  const transferTx = await registrar.transferOwnership(MULTISIG, { gasLimit: 100000 });
  console.log('   TX:', transferTx.hash);
  await transferTx.wait();
  
  const newOwner = await registrar.owner();
  console.log('   New Owner:', newOwner);
  console.log('   ✅ Ownership transferred to multisig!\n');

  // Save deployment info
  const deploymentInfo = {
    domain: DOMAIN,
    domainHash: domainHash,
    registrarProxy: proxyAddress,
    registrarImplementation: implementationAddress,
    rentalPrice: ethers.formatEther(rentalPrice),
    nameWrapper: NAME_WRAPPER,
    owner: MULTISIG,
    deployedAt: new Date().toISOString(),
    network: hre.network.name
  };
  
  fs.writeFileSync('./test3-registrar-config.json', JSON.stringify(deploymentInfo, null, 2));
  console.log('💾 Config saved to test3-registrar-config.json\n');
  
  console.log('━'.repeat(60));
  console.log('✅ DEPLOYMENT COMPLETE!');
  console.log('━'.repeat(60));
  console.log('\n🎯 Next Step: APPROVE REGISTRAR VIA SAFE');
  console.log('   The multisig must approve this registrar to manage test3.divicompany.eth\n');
  console.log('   Use the Safe transaction details in the next message!\n');
  
  console.log('📍 Registrar Proxy:', proxyAddress);
  console.log('📍 Implementation:', implementationAddress);
  console.log('📍 Owner:', MULTISIG);
  console.log('📍 Etherscan: https://sepolia.etherscan.io/address/' + proxyAddress, '\n');
  
  // Generate Safe transaction details for approval
  console.log('━'.repeat(60));
  console.log('SAFE TRANSACTION: Approve Registrar');
  console.log('━'.repeat(60), '\n');
  
  console.log('Contract Address (Name Wrapper):');
  console.log(NAME_WRAPPER);
  console.log('');
  console.log('Function: setApprovalForAll');
  console.log('');
  console.log('Parameters:');
  console.log('  operator (address):', proxyAddress);
  console.log('  approved (bool): true');
  console.log('');
  console.log('This will be saved to SAFE-TX-APPROVE-TEST3.md\n');
}

const INameWrapper_ABI = [
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function getData(uint256 tokenId) external view returns (address owner, uint32 fuses, uint64 expiry)',
  'function setApprovalForAll(address operator, bool approved) external'
];

// Add INameWrapper interface for ethers
ethers.getContractAt = async function(name, address) {
  if (name === 'INameWrapper') {
    return new ethers.Contract(address, INameWrapper_ABI, (await ethers.getSigners())[0]);
  }
  return ethers.getContractFactory(name).then(f => f.attach(address));
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
