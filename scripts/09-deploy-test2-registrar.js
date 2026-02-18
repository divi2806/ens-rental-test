const hre = require('hardhat');
const ethers = hre.ethers;
const { upgrades } = require('hardhat');
const fs = require('fs');

/**
 * Step 9: Deploy SubnameRegistrar for test2.divicompany.eth
 * 
 * This allows the PUBLIC to rent second-level subdomains like:
 * - 1.test2.divicompany.eth
 * - a.test2.divicompany.eth
 * - bob.test2.divicompany.eth
 * 
 * Architecture:
 * divicompany.eth (YOU - full control)
 *   └── test2.divicompany.eth (YOURS - created directly, not rentable)
 *       └── SubnameRegistrar (PUBLIC can rent *.test2.divicompany.eth)
 */

const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
const DOMAIN = 'test2.divicompany.eth';

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
  console.log('\n🚀 Deploying SubnameRegistrar for test2.divicompany.eth');
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Calculate namehash for test2.divicompany.eth
  const domainHash = namehash(DOMAIN);
  
  console.log('Configuration:');
  console.log('  Domain:', DOMAIN);
  console.log('  Domain Hash:', domainHash);
  console.log('  Name Wrapper:', NAME_WRAPPER, '\n');

  // Verify you own test2.divicompany.eth in Name Wrapper
  console.log('🔍 Verifying ownership of', DOMAIN);
  const nameWrapper = await ethers.getContractAt('INameWrapper', NAME_WRAPPER);
  
  try {
    const owner = await nameWrapper.ownerOf(domainHash);
    console.log('   Owner:', owner);
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error(`\n❌ ERROR: You don't own ${DOMAIN}!`);
      console.error(`   Owner: ${owner}`);
      console.error(`   You: ${deployer.address}\n`);
      process.exit(1);
    }
    console.log('   ✅ Ownership verified!\n');
  } catch (e) {
    console.error(`\n❌ ERROR: ${DOMAIN} doesn't exist or isn't wrapped!\n`);
    process.exit(1);
  }

  // Deploy with UUPS proxy
  console.log('📝 Deploying SubnameRegistrar (UUPS Proxy)...\n');
  
  const SubnameRegistrar = await ethers.getContractFactory('SubnameRegistrar');
  const registrar = await upgrades.deployProxy(
    SubnameRegistrar,
    [NAME_WRAPPER, domainHash, deployer.address],
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

  // Save deployment info
  const deploymentInfo = {
    domain: DOMAIN,
    domainHash: domainHash,
    registrarProxy: proxyAddress,
    registrarImplementation: implementationAddress,
    rentalPrice: ethers.formatEther(rentalPrice),
    nameWrapper: NAME_WRAPPER,
    owner: deployer.address,
    deployedAt: new Date().toISOString(),
    network: hre.network.name
  };
  
  fs.writeFileSync('./test2-registrar-config.json', JSON.stringify(deploymentInfo, null, 2));
  console.log('💾 Config saved to test2-registrar-config.json\n');
  
  console.log('━'.repeat(60));
  console.log('✅ DEPLOYMENT COMPLETE!');
  console.log('━'.repeat(60));
  console.log('\n🎯 Next Steps:');
  console.log('   1. Approve this registrar to manage test2.divicompany.eth:');
  console.log('      (This grants permission to create subdomains)\n');
  console.log('   2. Test renting a subdomain:');
  console.log('      npx hardhat run scripts/test-test2-registrar.js --network sepolia\n');
  
  console.log('📍 Proxy:', proxyAddress);
  console.log('📍 Implementation:', implementationAddress);
  console.log('📍 Etherscan: https://sepolia.etherscan.io/address/' + proxyAddress, '\n');
  
  console.log('🔐 IMPORTANT: You must approve this registrar in Name Wrapper!');
  console.log('   Call: nameWrapper.setApprovalForAll(' + proxyAddress + ', true)\n');
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
