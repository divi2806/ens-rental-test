const hre = require("hardhat");
const { ethers } = require("hardhat");
const { namehash, dnsEncode } = require("ethers");

// Contract addresses
const REGISTRAR_ADDRESS = "0xeBa8b11aD69abD273A05b9F5AE64FE7381fd2755"; // test3.divicompany.eth registrar
const OFFCHAIN_RESOLVER = "0x6Dea337D5BDBCe2DB66196AbA020bC02e6193b2d";
const NAME_WRAPPER = "0x0635513f179D50A207757E05759CbD106d7dFcE8";
const GATEWAY_URL = "http://localhost:3001";

const SUBDOMAIN_LABEL = "bob"; // Register bob.test3.divicompany.eth
const FULL_DOMAIN = `${SUBDOMAIN_LABEL}.test3.divicompany.eth`;

async function main() {
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  COMPLETE CCIP-READ FLOW WITH DATA");
  console.log("════════════════════════════════════════════════════════════\n");

  const [signer] = await ethers.getSigners();
  console.log(`👤 User: ${signer.address}\n`);

  // Step 1: Check availability
  console.log("━━━ STEP 1: CHECK AVAILABILITY ━━━");
  const registrarABI = [
    "function isAvailable(string label) external view returns (bool)",
    "function rentSubdomain(string label, address owner, uint32 duration, address resolver, uint16 fuses) external payable returns (uint256)"
  ];
  const registrar = new ethers.Contract(REGISTRAR_ADDRESS, registrarABI, signer);

  const isAvailable = await registrar.isAvailable(SUBDOMAIN_LABEL);
  console.log(`📝 Domain: ${FULL_DOMAIN}`);
  console.log(`✅ Available: ${isAvailable}\n`);

  if (isAvailable) {
    // Step 2: Rent subdomain
    console.log("━━━ STEP 2: RENT SUBDOMAIN ━━━");
    
    const duration = 365 * 24 * 60 * 60; // 1 year
    const fuses = 65; // PARENT_CANNOT_CONTROL

    console.log(`⏰ Duration: 1 year`);
    console.log(`🔧 Resolver: ${OFFCHAIN_RESOLVER}`);
    console.log(`🔒 Fuses: ${fuses}\n`);

    try {
      const rentTx = await registrar.rentSubdomain(
        SUBDOMAIN_LABEL,
        signer.address,
        duration,
        OFFCHAIN_RESOLVER,
        fuses,
        { value: ethers.parseEther("0.0001") }
      );

      console.log(`📤 Transaction sent: ${rentTx.hash}`);
      const receipt = await rentTx.wait();
      console.log(`✅ Subdomain registered! (Block ${receipt.blockNumber})\n`);
    } catch (error) {
      console.log(`❌ Rental failed: ${error.message}\n`);
      return;
    }
  } else {
    console.log("⚠️  Subdomain already registered, skipping rental...\n");
  }

  // Step 3: Register address data with gateway
  console.log("━━━ STEP 3: REGISTER DATA WITH GATEWAY ━━━");
  
  const targetAddress = signer.address; // Use our own address for testing
  console.log(`📝 Domain: ${FULL_DOMAIN}`);
  console.log(`🎯 Setting address to: ${targetAddress}\n`);

  try {
    const response = await fetch(`${GATEWAY_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: FULL_DOMAIN,
        address: targetAddress,
        contentHash: "ipfs://QmTest123..." // Optional
      })
    });

    const result = await response.json();
    console.log("✅ Data registered with gateway:");
    console.log(JSON.stringify(result, null, 2));
    console.log("\n");
  } catch (error) {
    console.log(`⚠️  Gateway registration failed: ${error.message}`);
    console.log("   (Gateway may not have /register endpoint, continuing...)\n");
  }

  // Step 4: Verify on-chain data
  console.log("━━━ STEP 4: VERIFY ON-CHAIN DATA ━━━");
  const nameWrapperABI = [
    "function getData(uint256 tokenId) external view returns (address owner, uint32 fuses, uint64 expiry)"
  ];
  const nameWrapper = new ethers.Contract(NAME_WRAPPER, nameWrapperABI, signer);

  const node = namehash(FULL_DOMAIN);
  const tokenId = BigInt(node);
  const [owner, onchainFuses, expiry] = await nameWrapper.getData(tokenId);

  console.log(`📦 Domain: ${FULL_DOMAIN}`);
  console.log(`👤 Owner: ${owner}`);
  console.log(`🔒 Fuses: 0x${onchainFuses.toString(16).padStart(8, '0')}`);
  console.log(`⏰ Expiry: ${new Date(Number(expiry) * 1000).toLocaleString()}\n`);

  // Step 5: Query resolver - Trigger CCIP-Read
  console.log("━━━ STEP 5: QUERY RESOLVER (TRIGGER CCIP-READ) ━━━");
  
  const resolverABI = [
    "function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory)"
  ];
  const resolver = new ethers.Contract(OFFCHAIN_RESOLVER, resolverABI, signer);

  const dnsName = dnsEncode(FULL_DOMAIN);
  const addrInterface = new ethers.Interface(["function addr(bytes32 node) external view returns (address)"]);
  const innerCallData = addrInterface.encodeFunctionData("addr", [node]);

  console.log(`🔍 Querying: ${FULL_DOMAIN}`);
  console.log(`📡 DNS Encoded: ${dnsName}`);
  console.log(`📞 Inner Call: addr(${node})\n`);

  try {
    console.log("⏳ Calling resolve() on OffchainResolver...\n");
    const result = await resolver.resolve(dnsName, innerCallData);
    
    console.log("✅ DIRECT RESOLVE SUCCESSFUL (unexpected!)");
    console.log(`📦 Result: ${result}\n`);
  } catch (error) {
    if (!error.data) {
      console.log(`❌ Error without data: ${error.message}\n`);
      return;
    }

    console.log("⚡ CCIP-READ TRIGGERED!\n");
    
    try {
      const errorInterface = new ethers.Interface([
        "error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData)"
      ]);
      
      const decodedError = errorInterface.parseError(error.data);
      
      if (decodedError) {
        console.log("🔍 OFFCHAIN LOOKUP ERROR:");
        console.log("════════════════════════════════════════════════════════════\n");
        console.log(`Sender: ${decodedError.args[0]}`);
        console.log(`\nGateway URLs:`);
        decodedError.args[1].forEach((url, i) => {
          console.log(`  [${i}] ${url}`);
        });
        console.log(`\nCallback: ${decodedError.args[3]}\n`);
        
        // Build gateway URL
        const sender = decodedError.args[0].toLowerCase();
        const callData = decodedError.args[2].slice(2);
        const gatewayUrl = `${GATEWAY_URL}/${sender}/${callData}.json`;
        
        console.log(`🌐 Gateway URL:\n   ${gatewayUrl}\n`);
        
        // Step 6: Fetch from gateway
        console.log("━━━ STEP 6: FETCH FROM GATEWAY ━━━\n");
        console.log("⏳ Calling gateway...\n");
        
        const gatewayResponse = await fetch(gatewayUrl);
        const gatewayData = await gatewayResponse.json();
        
        console.log("✅ GATEWAY RESPONSE:");
        console.log("════════════════════════════════════════════════════════════");
        console.log(JSON.stringify(gatewayData, null, 2));
        console.log("\n");
        
        if (gatewayData.data === "0x") {
          console.log("⚠️  Gateway returned empty data - data may not be stored\n");
        } else {
          // Step 7: Verify with callback
          console.log("━━━ STEP 7: VERIFY WITH CALLBACK ━━━\n");
          
          const resolverWithCallback = new ethers.Contract(
            OFFCHAIN_RESOLVER,
            ["function resolveWithProof(bytes calldata response, bytes calldata extraData) external view returns (bytes memory)"],
            signer
          );
          
          console.log("⏳ Calling resolveWithProof...\n");
          
          const finalResult = await resolverWithCallback.resolveWithProof(
            gatewayData.data,
            decodedError.args[4]
          );
          
          console.log("✅ PROOF VERIFIED!");
          console.log(`📦 Final Result: ${finalResult}\n`);
          
          if (finalResult && finalResult !== "0x") {
            const finalAddress = ethers.AbiCoder.defaultAbiCoder().decode(["address"], finalResult)[0];
            console.log(`🎯 RESOLVED ADDRESS: ${finalAddress}`);
            
            if (finalAddress.toLowerCase() === targetAddress.toLowerCase()) {
              console.log(`✅ MATCHES EXPECTED: ${targetAddress}\n`);
            } else {
              console.log(`⚠️  MISMATCH - Expected: ${targetAddress}\n`);
            }
          }
        }
      }
    } catch (decodeError) {
      console.log(`❌ Error processing CCIP-Read: ${decodeError.message}\n`);
    }
  }

  console.log("════════════════════════════════════════════════════════════");
  console.log("  TEST COMPLETE");
  console.log("════════════════════════════════════════════════════════════\n");
  
  console.log("📋 SUMMARY:");
  console.log(`   Domain: ${FULL_DOMAIN}`);
  console.log(`   Owner: ${signer.address}`);
  console.log(`   Resolver: ${OFFCHAIN_RESOLVER}`);
  console.log(`   Gateway: ${GATEWAY_URL}`);
  console.log(`   CCIP-Read: Flow demonstrated ✅\n`);
  
  console.log("💡 Check the gateway server terminal for detailed logs!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
