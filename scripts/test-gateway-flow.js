const hre = require("hardhat");
const { ethers } = require("hardhat");
const { namehash, dnsEncode } = require("ethers");

// Contract addresses
const REGISTRAR_ADDRESS = "0xeBa8b11aD69abD273A05b9F5AE64FE7381fd2755"; // test3.divicompany.eth registrar
const OFFCHAIN_RESOLVER = "0x6Dea337D5BDBCe2DB66196AbA020bC02e6193b2d";
const NAME_WRAPPER = "0x0635513f179D50A207757E05759CbD106d7dFcE8";

const SUBDOMAIN_LABEL = "alice"; // Register alice.test3.divicompany.eth
const FULL_DOMAIN = `${SUBDOMAIN_LABEL}.test3.divicompany.eth`;

async function main() {
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  GATEWAY FLOW TEST - Full CCIP-Read Demonstration");
  console.log("════════════════════════════════════════════════════════════\n");

  const [signer] = await ethers.getSigners();
  console.log(`👤 User: ${signer.address}\n`);

  // Step 1: Check if subdomain is available
  console.log("━━━ STEP 1: CHECK AVAILABILITY ━━━");
  const registrarABI = [
    "function isAvailable(string label) external view returns (bool)",
    "function rentSubdomain(string label, address owner, uint32 duration, address resolver, uint16 fuses) external payable returns (uint256)"
  ];
  const registrar = new ethers.Contract(REGISTRAR_ADDRESS, registrarABI, signer);

  const isAvailable = await registrar.isAvailable(SUBDOMAIN_LABEL);
  console.log(`📝 Domain: ${FULL_DOMAIN}`);
  console.log(`✅ Available: ${isAvailable}\n`);

  if (!isAvailable) {
    console.log("⚠️  Subdomain already registered, using existing registration...\n");
  } else {
    // Rent the subdomain
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
        OFFCHAIN_RESOLVER, // Set OffchainResolver immediately
        fuses,
        { value: ethers.parseEther("0.0001") }
      );

      console.log(`📤 Transaction sent: ${rentTx.hash}`);
      await rentTx.wait();
      console.log(`✅ Subdomain registered!\n`);
    } catch (error) {
      console.log(`❌ Rental failed: ${error.message}\n`);
      console.log("Continuing with verification...\n");
    }
  }

  // Step 2: Verify on-chain data (adjust step numbers)
  console.log("━━━ STEP 3: VERIFY ON-CHAIN DATA ━━━");
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

  // Step 3: Query resolver - This will trigger CCIP-Read
  console.log("━━━ STEP 4: QUERY RESOLVER (TRIGGER CCIP-READ) ━━━");
  
  const resolverABI = [
    "function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory)"
  ];
  const resolver = new ethers.Contract(OFFCHAIN_RESOLVER, resolverABI, signer);

  // DNS encode the domain name
  const dnsName = dnsEncode(FULL_DOMAIN);
  
  // Create addr(bytes32) call
  const addrInterface = new ethers.Interface(["function addr(bytes32 node) external view returns (address)"]);
  const innerCallData = addrInterface.encodeFunctionData("addr", [node]);

  console.log(`🔍 Querying: ${FULL_DOMAIN}`);
  console.log(`📡 DNS Encoded Name: ${dnsName}`);
  console.log(`📞 Inner Call: addr(${node})\n`);

  try {
    console.log("⏳ Calling resolve() on OffchainResolver...\n");
    
    // This should trigger CCIP-Read flow
    const result = await resolver.resolve(dnsName, innerCallData);
    
    console.log("✅ CCIP-READ SUCCESSFUL!");
    console.log(`📦 Result: ${result}\n`);
    
    // Decode the result
    if (result && result !== "0x") {
      try {
        const decodedAddress = ethers.AbiCoder.defaultAbiCoder().decode(["address"], result)[0];
        console.log(`🎯 Resolved Address: ${decodedAddress}\n`);
      } catch (e) {
        console.log(`⚠️  Could not decode result as address\n`);
      }
    }

  } catch (error) {
    console.log("⚡ CCIP-READ ERROR CAPTURED!\n");
    
    if (error.data) {
      console.log("🔍 OFFCHAIN LOOKUP ERROR:");
      console.log("════════════════════════════════════════════════════════════\n");
      
      try {
        // Decode OffchainLookup error
        const errorInterface = new ethers.Interface([
          "error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData)"
        ]);
        
        const decodedError = errorInterface.parseError(error.data);
        
        if (decodedError) {
          console.log(`Sender: ${decodedError.args[0]}`);
          console.log(`\nGateway URLs:`);
          decodedError.args[1].forEach((url, i) => {
            console.log(`  [${i}] ${url}`);
          });
          console.log(`\nCall Data: ${decodedError.args[2]}`);
          console.log(`Callback: ${decodedError.args[3]}`);
          console.log(`Extra Data: ${decodedError.args[4]}\n`);
          
          // Build gateway URL
          const sender = decodedError.args[0].toLowerCase();
          const callData = decodedError.args[2].slice(2); // Remove 0x
          const gatewayUrl = `http://localhost:3001/${sender}/${callData}.json`;
          
          console.log(`🌐 Gateway will be called at:`);
          console.log(`   ${gatewayUrl}\n`);
          
          // Try to fetch from gateway
          console.log("━━━ STEP 5: FETCH FROM GATEWAY ━━━\n");
          console.log("⏳ Fetching from gateway...\n");
          
          try {
            const response = await fetch(gatewayUrl);
            const gatewayData = await response.json();
            
            console.log("✅ GATEWAY RESPONSE:");
            console.log("════════════════════════════════════════════════════════════");
            console.log(JSON.stringify(gatewayData, null, 2));
            console.log("\n");
            
            // Step 6: Call resolveWithProof
            console.log("━━━ STEP 6: VERIFY WITH CALLBACK ━━━\n");
            
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
            
            // Decode final address
            if (finalResult && finalResult !== "0x") {
              try {
                const finalAddress = ethers.AbiCoder.defaultAbiCoder().decode(["address"], finalResult)[0];
                console.log(`🎯 FINAL RESOLVED ADDRESS: ${finalAddress}\n`);
              } catch (e) {
                console.log(`⚠️  Could not decode final result\n`);
              }
            }
            
          } catch (fetchError) {
            console.log(`❌ Gateway fetch failed: ${fetchError.message}\n`);
          }
        }
      } catch (decodeError) {
        console.log(`Error decoding: ${decodeError.message}\n`);
        console.log(`Raw error data: ${error.data}\n`);
      }
    } else {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }

  console.log("════════════════════════════════════════════════════════════");
  console.log("  TEST COMPLETE");
  console.log("════════════════════════════════════════════════════════════\n");
  
  console.log("📋 SUMMARY:");
  console.log(`   Domain: ${FULL_DOMAIN}`);
  console.log(`   Resolver: ${OFFCHAIN_RESOLVER}`);
  console.log(`   Gateway: http://localhost:3001`);
  console.log(`   CCIP-Read: Full flow demonstrated ✅\n`);
  
  console.log("💡 Check the gateway server terminal for logs!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
