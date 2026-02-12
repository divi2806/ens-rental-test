require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ============================================================
// Configuration
// ============================================================

const PORT = process.env.GATEWAY_PORT || 3001;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('PRIVATE_KEY environment variable is required');
  process.exit(1);
}

const signer = new ethers.Wallet(PRIVATE_KEY);
const LOG_FILE = path.join(__dirname, '..', 'subdomain-registrations.log');

// Default TTL: 100 days (in seconds)
const DEFAULT_TTL = 3600 * 24 * 100;

// ============================================================
// In-memory subdomain store
// Key: namehash of full name (e.g. namehash("1.test.divicompany.eth"))
// Value: { name, parent, label, addr, texts, contenthash, registeredAt }
// ============================================================

const subdomainStore = new Map();

// ============================================================
// ENS helpers
// ============================================================

/**
 * Decode a DNS-encoded name (as used in ENSIP-10 resolve calls) into a dot-separated string.
 * DNS encoding: each label is prefixed with its length byte, ending with 0x00.
 * e.g. \x01\x31\x04test\x0bdivicompany\x03eth\x00 → "1.test.divicompany.eth"
 */
function decodeDnsName(data) {
  const buf = Buffer.from(data.slice(2), 'hex');
  const labels = [];
  let offset = 0;
  while (offset < buf.length) {
    const len = buf[offset];
    if (len === 0) break;
    offset++;
    labels.push(buf.slice(offset, offset + len).toString('utf8'));
    offset += len;
  }
  return labels.join('.');
}

/**
 * Compute the namehash of a dot-separated ENS name.
 */
function namehash(name) {
  if (!name || name === '') return ethers.ZeroHash;
  const labels = name.split('.');
  let node = ethers.ZeroHash;
  for (let i = labels.length - 1; i >= 0; i--) {
    const labelHash = ethers.keccak256(ethers.toUtf8Bytes(labels[i]));
    node = ethers.keccak256(ethers.solidityPacked(['bytes32', 'bytes32'], [node, labelHash]));
  }
  return node;
}

// Well-known function selectors
const SELECTORS = {
  'addr(bytes32)': '0x3b3b57de',
  'addr(bytes32,uint256)': '0xf1cb7e06',
  'text(bytes32,string)': '0x59d1d43c',
  'contenthash(bytes32)': '0xbc1c58d1',
};

// ============================================================
// Logging
// ============================================================

function log(message, data) {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, message, ...(data || {}) };
  const line = JSON.stringify(entry);

  console.log(`[${timestamp}] ${message}`, data ? JSON.stringify(data) : '');

  fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
}

// ============================================================
// Signing (matches SignatureVerifier.sol / signer.ts)
// ============================================================

/**
 * Build the message hash:
 *   keccak256(encodePacked(0x1900, sender, expires, keccak256(request), keccak256(result)))
 * Then sign with ethSignedMessage prefix.
 */
async function signResponse(sender, request, result) {
  const expires = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_TTL);

  const messageHash = ethers.keccak256(
    ethers.solidityPacked(
      ['bytes', 'address', 'uint64', 'bytes', 'bytes'],
      ['0x1900', sender, expires, ethers.keccak256(request), ethers.keccak256(result)]
    )
  );

  // signMessage automatically prepends "\x19Ethereum Signed Message:\n32"
  const sig = await signer.signMessage(ethers.getBytes(messageHash));

  // ABI encode: (bytes result, uint64 expires, bytes signature)
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes', 'uint64', 'bytes'],
    [result, expires, sig]
  );

  return encoded;
}

// ============================================================
// CCIP-Read request handler
// ============================================================

async function handleCcipRequest(sender, callDataHex) {
  log('CCIP-Read request', { sender, callDataLen: callDataHex.length });

  // The callData is: resolve(bytes name, bytes data)
  // Selector: 0x9061b923
  const resolveIface = new ethers.Interface([
    'function resolve(bytes name, bytes data) view returns (bytes)',
  ]);

  let dnsName, innerData;
  try {
    const decoded = resolveIface.decodeFunctionData('resolve', callDataHex);
    dnsName = decoded[0]; // bytes - DNS-encoded name
    innerData = decoded[1]; // bytes - the inner call (addr, text, etc.)
  } catch (e) {
    log('Failed to decode resolve calldata', { error: e.message });
    return { data: '0x', statusCode: 400 };
  }

  const name = decodeDnsName(dnsName);
  const node = namehash(name);

  log('Resolving', { name, node });

  // Decode the inner function call
  const selector = innerData.slice(0, 10);
  const record = subdomainStore.get(node);

  let result = '0x';

  if (selector === SELECTORS['addr(bytes32)']) {
    // addr(bytes32) → returns address
    if (record && record.addr) {
      result = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [record.addr]);
      log('Resolved addr', { name, addr: record.addr });
    } else {
      log('No addr record', { name });
    }
  } else if (selector === SELECTORS['addr(bytes32,uint256)']) {
    // addr(bytes32, uint256 coinType) → returns bytes
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['bytes32', 'uint256'], '0x' + innerData.slice(10));
    const coinType = Number(decoded[1]);
    if (coinType === 60 && record && record.addr) {
      // ETH address (coinType 60)
      result = ethers.AbiCoder.defaultAbiCoder().encode(['bytes'], [record.addr]);
      log('Resolved addr(coinType=60)', { name, addr: record.addr });
    } else {
      log('No addr for coinType', { name, coinType });
    }
  } else if (selector === SELECTORS['text(bytes32,string)']) {
    // text(bytes32, string key) → returns string
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['bytes32', 'string'], '0x' + innerData.slice(10));
    const key = decoded[1];
    if (record && record.texts && record.texts[key]) {
      result = ethers.AbiCoder.defaultAbiCoder().encode(['string'], [record.texts[key]]);
      log('Resolved text', { name, key, value: record.texts[key] });
    } else {
      log('No text record', { name, key });
    }
  } else if (selector === SELECTORS['contenthash(bytes32)']) {
    // contenthash(bytes32) → returns bytes
    if (record && record.contenthash) {
      result = ethers.AbiCoder.defaultAbiCoder().encode(['bytes'], [record.contenthash]);
      log('Resolved contenthash', { name });
    } else {
      log('No contenthash record', { name });
    }
  } else {
    log('Unknown selector', { selector });
  }

  // Sign the response
  const request = callDataHex;
  const signedResponse = await signResponse(sender, request, result);

  return { data: signedResponse, statusCode: 200 };
}

// ============================================================
// Express app
// ============================================================

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    signer: signer.address,
    subdomainCount: subdomainStore.size,
    uptime: process.uptime(),
  });
});

// List all registered sub-subdomains
app.get('/subdomains', (req, res) => {
  const entries = [];
  for (const [node, record] of subdomainStore) {
    entries.push({ node, ...record });
  }
  res.json({ count: entries.length, subdomains: entries });
});

// Register a sub-subdomain (POST /register)
app.post('/register', (req, res) => {
  const { name, addr, texts, contenthash } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required (e.g. 1.test.divicompany.eth)' });
  }

  const node = namehash(name);

  const record = {
    name,
    parent: name.split('.').slice(1).join('.'),
    label: name.split('.')[0],
    addr: addr || null,
    texts: texts || {},
    contenthash: contenthash || null,
    registeredAt: new Date().toISOString(),
  };

  subdomainStore.set(node, record);

  log('Subdomain registered', record);

  res.json({
    success: true,
    name,
    node,
    record,
  });
});

// CCIP-Read: GET /:sender/:callData.json
app.get('/:sender/:callData.json', async (req, res) => {
  try {
    const { sender } = req.params;
    // Remove .json suffix that Express already stripped
    const callData = req.params.callData;

    const { data, statusCode } = await handleCcipRequest(sender, callData);

    if (statusCode !== 200) {
      return res.status(statusCode).json({ data });
    }

    res.json({ data });
  } catch (error) {
    log('CCIP-Read GET error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// CCIP-Read: POST /
app.post('/rpc', async (req, res) => {
  try {
    const { sender, data: callData } = req.body;

    if (!sender || !callData) {
      return res.status(400).json({ error: 'sender and data are required' });
    }

    const { data, statusCode } = await handleCcipRequest(sender, callData);

    if (statusCode !== 200) {
      return res.status(statusCode).json({ data });
    }

    res.json({ data });
  } catch (error) {
    log('CCIP-Read POST error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Start server
// ============================================================

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('  CCIP-Read Gateway');
  console.log('='.repeat(60));
  console.log(`  Port:    ${PORT}`);
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Log:     ${LOG_FILE}`);
  console.log('='.repeat(60));
  console.log('\nEndpoints:');
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/subdomains`);
  console.log(`  POST http://localhost:${PORT}/register`);
  console.log(`  GET  http://localhost:${PORT}/:sender/:callData.json  (CCIP-Read)`);
  console.log(`  POST http://localhost:${PORT}/rpc                     (CCIP-Read)\n`);

  log('Gateway started', { port: PORT, signer: signer.address });
});
