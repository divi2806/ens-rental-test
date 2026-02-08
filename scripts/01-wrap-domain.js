const hre = require('hardhat');
const ethers = hre.ethers;
const fs = require('fs');

/**
 * Step 1: Wrap your .eth domain using Name Wrapper
 * This is required before you can rent subdomains
 */

const BASE_REGISTRAR = '0x084b1c3C81545d370f3634392De611CaaBFf8148';
const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
const PUBLIC_RESOLVER = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD';

// YOUR DOMAIN HERE
const DOMAIN = 'test282405.eth';  // Change this to your domain

async function main() {
  console.log('\n🎁 Wrapping Your ENS Domain');
  console.log('━'.repeat(60));
  console.log(`Domain: ${DOMAIN}`);
  console.log('━'.repeat(60), '\n');

  const [signer] = await ethers.getSigners();
  console.log('Your address:', signer.address);
  
  const balance = await ethers.provider.getBalance(signer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  const label = DOMAIN.replace('.eth', '');
  const labelHash = ethers.id(label);
  
  // Check if you own the domain in Base Registrar
  console.log('1️⃣  Checking domain ownership...');
  const registrarAbi = [
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function approve(address to, uint256 tokenId) external'
  ];
  const registrar = new ethers.Contract(BASE_REGISTRAR, registrarAbi, signer);
  
  try {
    const owner = await registrar.ownerOf(labelHash);
    console.log('   Base Registrar owner:', owner);
    
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      console.error('❌ You do not own this domain!');
      console.log(`   Owner: ${owner}`);
      console.log(`   You: ${signer.address}\n`);
      process.exit(1);
    }
    console.log('   ✅ You own this domain\n');
  } catch (error) {
    console.error('❌ Domain not found in Base Registrar!');
    console.log('   Please register it first at https://app.ens.domains\n');
    process.exit(1);
  }
  
  // Check if already wrapped
  const wrapperAbi = [
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function wrapETH2LD(string calldata label, address wrappedOwner, uint16 ownerControlledFuses, address resolver) external returns (uint64 expiry)'
  ];
  const wrapper = new ethers.Contract(NAME_WRAPPER, wrapperAbi, signer);
  
  const ethNode = ethers.namehash('eth');
  const wrappedTokenId = ethers.solidityPackedKeccak256(['bytes32', 'bytes32'], [ethNode, labelHash]);
  
  console.log('2️⃣  Checking if already wrapped...');
  try {
    const wrappedOwner = await wrapper.ownerOf(wrappedTokenId);
    
    if (wrappedOwner !== ethers.ZeroAddress) {
      console.log(`   ✅ Domain is already wrapped!`);
      console.log(`   Wrapped owner: ${wrappedOwner}\n`);
      
      if (wrappedOwner.toLowerCase() === signer.address.toLowerCase()) {
        console.log('   You own the wrapped domain. Proceed to step 2!\n');
        
        // Save config
        const config = {
          domain: DOMAIN,
          domainHash: ethers.namehash(DOMAIN),
          owner: signer.address,
          wrapped: true,
          wrappedTokenId: wrappedTokenId
        };
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
        return;
      } else {
        console.error('   ❌ Someone else owns the wrapped domain!');
        process.exit(1);
      }
    }
  } catch (error) {
    console.log('   Domain not wrapped yet\n');
  }
  
  // Approve Name Wrapper
  console.log('3️⃣  Approving Name Wrapper...');
  try {
    const approveTx = await registrar.approve(NAME_WRAPPER, labelHash);
    console.log('   TX:', approveTx.hash);
    await approveTx.wait();
    console.log('   ✅ Approved\n');
  } catch (error) {
    console.log('   Error:', error.message);
    console.log('   Trying setApprovalForAll...\n');
    
    const approveAllAbi = ['function setApprovalForAll(address operator, bool approved) external'];
    const registrarWithApproveAll = new ethers.Contract(BASE_REGISTRAR, approveAllAbi, signer);
    const approveAllTx = await registrarWithApproveAll.setApprovalForAll(NAME_WRAPPER, true);
    console.log('   TX:', approveAllTx.hash);
    await approveAllTx.wait();
    console.log('   ✅ Approved\n');
  }
  
  // Wrap the domain
  console.log('4️⃣  Wrapping domain...');
  console.log('   This converts your ENS domain into a wrapped ERC-1155 NFT');
  console.log('   Benefits:');
  console.log('     ✅ Protocol-level subdomain expiry');
  console.log('     ✅ Fuses for guaranteed rental periods');
  console.log('     ✅ ERC-1155 NFT standard\n');
  
  const wrapTx = await wrapper.wrapETH2LD(
    label,
    signer.address,
    0, // No fuses for parent
    PUBLIC_RESOLVER
  );
  
  console.log('   TX:', wrapTx.hash);
  const receipt = await wrapTx.wait();
  console.log('   ✅ Domain wrapped!\n');
  
  // Verify
  const wrappedOwner = await wrapper.ownerOf(wrappedTokenId);
  console.log('5️⃣  Verifying...');
  console.log('   Wrapped owner:', wrappedOwner);
  console.log('   Match:', wrappedOwner.toLowerCase() === signer.address.toLowerCase() ? '✅' : '❌\n');
  
  // Save config
  const config = {
    domain: DOMAIN,
    domainHash: ethers.namehash(DOMAIN),
    owner: signer.address,
    wrapped: true,
    wrappedTokenId: wrappedTokenId,
    wrapTxHash: wrapTx.hash
  };
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
  
  console.log('━'.repeat(60));
  console.log('✅ DOMAIN WRAPPED SUCCESSFULLY!');
  console.log('━'.repeat(60));
  console.log('\n🎯 Next Step:');
  console.log('   Deploy rental contract:');
  console.log('   npx hardhat run scripts/02-deploy-registrar.js --network sepolia\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
