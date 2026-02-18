const hre = require("hardhat");
const { ethers } = require("hardhat");

const REGISTRAR_ADDRESS = "0xeBa8b11aD69abD273A05b9F5AE64FE7381fd2755"; // test3.divicompany.eth

async function main() {
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  CHECK REGISTRAR CONFIGURATION");
  console.log("════════════════════════════════════════════════════════════\n");

  const [signer] = await ethers.getSigners();
  
  const registrarABI = [
    "function owner() external view returns (address)",
    "function isPublic() external view returns (bool)",
    "function pricePerYear() external view returns (uint256)",
    "function minimumDuration() external view returns (uint32)",
    "function isAvailable(string label) external view returns (bool)",
    "function nameWrapper() external view returns (address)",
    "function parentNode() external view returns (bytes32)"
  ];
  
  const registrar = new ethers.Contract(REGISTRAR_ADDRESS, registrarABI, signer);

  console.log("📋 REGISTRAR INFO:");
  console.log("════════════════════════════════════════════════════════════");
  
  const owner = await registrar.owner();
  const isPublic = await registrar.isPublic();
  const pricePerYear = await registrar.pricePerYear();
  const minimumDuration = await registrar.minimumDuration();
  const nameWrapper = await registrar.nameWrapper();
  const parentNode = await registrar.parentNode();
  
  console.log(`\nAddress: ${REGISTRAR_ADDRESS}`);
  console.log(`Owner: ${owner}`);
  console.log(`Public: ${isPublic}`);
  console.log(`Price/Year: ${ethers.formatEther(pricePerYear)} ETH`);
  console.log(`Min Duration: ${minimumDuration} seconds (${minimumDuration / (24*60*60)} days)`);
  console.log(`Name Wrapper: ${nameWrapper}`);
  console.log(`Parent Node: ${parentNode}\n`);
  
  // Check availability of test labels
  const testLabels = ["bob", "charlie", "david", "eve"];
  console.log("📝 TEST AVAILABILITY:");
  console.log("════════════════════════════════════════════════════════════\n");
  
  for (const label of testLabels) {
    const available = await registrar.isAvailable(label);
    console.log(`${label}.test3.divicompany.eth: ${available ? '✅ Available' : '❌ Taken'}`);
  }
  
  console.log("\n");
  
  // Calculate cost for 1 year
  const duration = 365 * 24 * 60 * 60;
  const cost = pricePerYear * BigInt(duration) / BigInt(365 * 24 * 60 * 60);
  console.log(`💰 COST FOR 1 YEAR RENTAL:`);
  console.log(`════════════════════════════════════════════════════════════`);
  console.log(`   ${ethers.formatEther(cost)} ETH\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
