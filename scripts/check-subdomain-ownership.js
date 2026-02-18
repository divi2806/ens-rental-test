const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

async function main() {
  console.log('\n🔍 Checking Subdomain Ownership');
  console.log('━'.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  
  const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
  const ensAbi = [
    'function owner(bytes32 node) view returns (address)',
    'function resolver(bytes32 node) view returns (address)'
  ];
  const ens = new ethers.Contract(ENS_REGISTRY, ensAbi, deployer);

  const subdomains = ['test', 'test2'];
  
  for (const label of subdomains) {
    const fullName = `${label}.${config.domain}`;
    console.log(`\n📝 ${fullName}:`);
    
    const parentHash = ethers.namehash(config.domain);
    const labelHash = ethers.keccak256(ethers.toUtf8Bytes(label));
    const nodeHash = ethers.keccak256(ethers.solidityPacked(['bytes32', 'bytes32'], [parentHash, labelHash]));
    
    const owner = await ens.owner(nodeHash);
    const resolver = await ens.resolver(nodeHash);
    
    console.log('   Node Hash:', nodeHash);
    console.log('   Owner:', owner);
    console.log('   Resolver:', resolver);
    console.log('   Your address:', deployer.address);
    console.log('   You own it?', owner.toLowerCase() === deployer.address.toLowerCase());
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
