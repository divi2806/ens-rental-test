const hre = require('hardhat');
const ethers = hre.ethers;
const { upgrades } = require('hardhat');
const fs = require('fs');

/**
 * Deploy SubnameRegistrarDirect for entity.id (Sepolia)
 *
 * - Uses setApprovalForAll (NOT setOwner) — Safe keeps ownership of entity.id
 * - Safe multisig is set as the contract owner (controls fees, price, upgrades)
 * - DatabaseResolver handles all subname resolution via CCIP-Read
 *
 * Run: npx hardhat run scripts/deploy-entity-id-registrar.js --network sepolia
 */

const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

async function main() {
  console.log('\n Deploying SubnameRegistrarDirect for entity.id');
  console.log('='.repeat(60), '\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Load config
  if (!fs.existsSync('./entity-id-config.json')) {
    console.error('entity-id-config.json not found!');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync('./entity-id-config.json', 'utf8'));

  if (config.databaseResolverAddress === 'FILL_THIS_IN') {
    console.error('Fill in databaseResolverAddress in entity-id-config.json first!');
    process.exit(1);
  }

  console.log('Config:');
  console.log('  Domain:            ', config.domain);
  console.log('  Domain Hash:       ', config.domainHash);
  console.log('  Safe (owner):      ', config.safeAddress);
  console.log('  DatabaseResolver:  ', config.databaseResolverAddress);
  console.log('  ENS Registry:      ', ENS_REGISTRY, '\n');

  // Deploy UUPS proxy
  console.log('Deploying SubnameRegistrarDirect (UUPS Proxy)...\n');

  const SubnameRegistrarDirect = await ethers.getContractFactory('SubnameRegistrarDirect');
  const registrar = await upgrades.deployProxy(
    SubnameRegistrarDirect,
    [
      ENS_REGISTRY,                   // ENS Registry
      config.databaseResolverAddress, // DatabaseResolver (resolver param)
      config.domainHash,              // namehash("entity.id")
      config.safeAddress              // Safe = owner of this contract
    ],
    { kind: 'uups' }
  );

  await registrar.waitForDeployment();
  const proxyAddress = await registrar.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log('SubnameRegistrarDirect deployed!');
  console.log('  Proxy address:          ', proxyAddress);
  console.log('  Implementation address: ', implAddress, '\n');

  // Verify
  const parentNode = await registrar.parentNode();
  const rentalPrice = await registrar.rentalPrice();
  const owner = await registrar.owner();

  console.log('Verification:');
  console.log('  parentNode:  ', parentNode);
  console.log('  rentalPrice: ', ethers.formatEther(rentalPrice), 'ETH/year');
  console.log('  owner:       ', owner);
  console.log('  owner=Safe?  ', owner.toLowerCase() === config.safeAddress.toLowerCase() ? 'YES' : 'NO - something is wrong!');

  // Save results
  config.registrarProxy = proxyAddress;
  config.registrarImpl = implAddress;
  config.rentalPrice = ethers.formatEther(rentalPrice);
  config.deployedAt = new Date().toISOString();
  config.deployedBy = deployer.address;
  fs.writeFileSync('./entity-id-config.json', JSON.stringify(config, null, 2));

  console.log('\n Config saved to entity-id-config.json');

  console.log('\n' + '='.repeat(60));
  console.log('DEPLOYMENT DONE');
  console.log('='.repeat(60));
  console.log('\nNOW DO THESE 2 TRANSACTIONS IN YOUR SAFE:');
  console.log('\nTx 1 - Approve registrar as operator (setApprovalForAll):');
  console.log('  To:       ', ENS_REGISTRY);
  console.log('  Function: setApprovalForAll(address,bool)');
  console.log('  operator: ', proxyAddress);
  console.log('  approved:  true');
  console.log('\nTx 2 - Set DatabaseResolver for entity.id:');
  console.log('  To:       ', ENS_REGISTRY);
  console.log('  Function: setResolver(bytes32,address)');
  console.log('  node:     ', config.domainHash);
  console.log('  resolver: ', config.databaseResolverAddress);
  console.log('\nYou can batch both into one Safe transaction using Multicall.');
  console.log('='.repeat(60), '\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
