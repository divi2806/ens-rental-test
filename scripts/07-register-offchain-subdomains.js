const fs = require('fs');

/**
 * Step 7: Register example offchain sub-subdomains via the gateway API
 *
 * This script POSTs to the running gateway to register sub-subdomains.
 * No gas required — these are offchain records resolved via CCIP-Read.
 *
 * Usage: node scripts/07-register-offchain-subdomains.js
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';

const exampleSubdomains = [
  {
    name: '1.test.divicompany.eth',
    addr: '0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595',
    texts: {
      'com.twitter': '@divicompany',
      description: 'First offchain subdomain under test.divicompany.eth',
      url: 'https://divicompany.eth',
    },
  },
  {
    name: 'alice.test.divicompany.eth',
    addr: '0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595',
    texts: {
      'com.twitter': '@alice',
      description: 'Alice\'s offchain subdomain',
    },
  },
  {
    name: 'a.test2.divicompany.eth',
    addr: '0x8d674BaEcbA928C9d750f66b0b4A35b83cAFd595',
    texts: {
      description: 'First offchain subdomain under test2.divicompany.eth',
    },
  },
];

async function main() {
  console.log('\n🌐 Registering Offchain Sub-subdomains');
  console.log('━'.repeat(60));
  console.log(`Gateway: ${GATEWAY_URL}\n`);

  // Check gateway is running
  try {
    const healthRes = await fetch(`${GATEWAY_URL}/health`);
    const health = await healthRes.json();
    console.log('✅ Gateway is running');
    console.log(`   Signer: ${health.signer}`);
    console.log(`   Current subdomains: ${health.subdomainCount}\n`);
  } catch (error) {
    console.error('❌ Gateway is not running!');
    console.error(`   Start it with: PRIVATE_KEY=... node gateway/server.js`);
    console.error(`   Expected at: ${GATEWAY_URL}\n`);
    process.exit(1);
  }

  // Register each subdomain
  for (const sub of exampleSubdomains) {
    console.log(`📝 Registering: ${sub.name}`);
    try {
      const res = await fetch(`${GATEWAY_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });

      const result = await res.json();

      if (result.success) {
        console.log(`   ✅ Registered!`);
        console.log(`   Node: ${result.node}`);
        console.log(`   Addr: ${result.record.addr || 'none'}`);
        console.log(`   Texts: ${Object.keys(result.record.texts || {}).join(', ') || 'none'}\n`);
      } else {
        console.log(`   ❌ Failed: ${result.error}\n`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }

  // Verify
  console.log('━'.repeat(60));
  console.log('🔍 Verifying...\n');

  const listRes = await fetch(`${GATEWAY_URL}/subdomains`);
  const list = await listRes.json();

  console.log(`Total registered: ${list.count}`);
  for (const sub of list.subdomains) {
    console.log(`  • ${sub.name} → ${sub.addr || 'no addr'}`);
  }

  console.log('\n' + '━'.repeat(60));
  console.log('✅ OFFCHAIN SUBDOMAINS REGISTERED!');
  console.log('━'.repeat(60));
  console.log('\n📋 These subdomains resolve via CCIP-Read (no gas):');
  for (const sub of exampleSubdomains) {
    console.log(`   ${sub.name}`);
  }
  console.log('\n💡 Test resolution with ethers.js:');
  console.log('   const resolver = await provider.getResolver("1.test.divicompany.eth");');
  console.log('   const addr = await resolver.getAddress();\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
