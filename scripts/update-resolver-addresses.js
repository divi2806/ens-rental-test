const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Update resolver for existing subdomains to new OffchainResolver proxy
 * Uses Name Wrapper since subdomains are wrapped
 */

async function main() {
  console.log('\n🔄 Updating Subdomain Resolvers');
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  
  console.log('Configuration:');
  console.log('  Domain:', config.domain);
  console.log('  Old Resolver:', '0x69d89c8e75FA7F98dcB2295F73A2f91e216550c4');
  console.log('  New Resolver:', config.offchainResolverAddress);
  console.log('  Name Wrapper:', '0x0635513f179D50A207757E05759CbD106d7dFcE8', '\n');

  const subdomains = ['test', 'test2'];
  
  // Name Wrapper interface
  const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
  const nameWrapperAbi = [
    'function setResolver(bytes32 node, address resolver) external',
    'function ownerOf(uint256 id) view returns (address)'
  ];
  const nameWrapper = new ethers.Contract(NAME_WRAPPER, nameWrapperAbi, deployer);
  
  // ENS Registry to check current resolver
  const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
  const ensAbi = ['function resolver(bytes32 node) view returns (address)'];
  const ens = new ethers.Contract(ENS_REGISTRY, ensAbi, deployer);

  for (const label of subdomains) {
    const fullName = `${label}.${config.domain}`;
    console.log(`📝 Updating ${fullName}...`);
    
    // Calculate node hash
    const parentHash = ethers.namehash(config.domain);
    const labelHash = ethers.keccak256(ethers.toUtf8Bytes(label));
    const nodeHash = ethers.keccak256(ethers.solidityPacked(['bytes32', 'bytes32'], [parentHash, labelHash]));
    
    // Check current resolver
    const currentResolver = await ens.resolver(nodeHash);
    console.log(`   Current resolver: ${currentResolver}`);
    
    if (currentResolver.toLowerCase() === config.offchainResolverAddress.toLowerCase()) {
      console.log('   ✅ Already using new resolver\n');
      continue;
    }
    
    // Check ownership via Name Wrapper (tokenId = nodeHash as uint256)
    try {
      const owner = await nameWrapper.ownerOf(nodeHash);
      console.log(`   Wrapped owner: ${owner}`);
      
      if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.log(`   ⚠️  You don't own this subdomain, skipping...\n`);
        continue;
      }
    } catch (e) {
      console.log(`   ⚠️  Failed to get owner, skipping...\n`);
      continue;
    }
    
    // Update resolver via Name Wrapper
    console.log(`   Setting new resolver: ${config.offchainResolverAddress}`);
    const tx = await nameWrapper.setResolver(nodeHash, config.offchainResolverAddress);
    console.log(`   TX: ${tx.hash}`);
    await tx.wait();
    console.log('   ✅ Resolver updated!\n');
  }

  console.log('━'.repeat(60));
  console.log('✅ ALL RESOLVERS UPDATED!');
  console.log('━'.repeat(60));
  console.log('\n🎯 Next Step:');
  console.log('   Verify gateway is running and test resolution\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
