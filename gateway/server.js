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

// TLD used for entityid generation
const TLD = process.env.TLD || 'divicompany.eth';

// ============================================================
// In-memory entity store (RegistryChain-compatible)
// Key: nodehash of full name
// Value: RegistryChain-compatible entity record
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
// RegistryChain-compatible helpers
// ============================================================

// Fields from the entity schema that contribute to constitutionhash
const CONSTITUTION_SCHEMA_FIELDS = new Set([
  'name', 'address', 'avatar', 'description', 'location', 'url', 'email',
  'language', 'mail', 'notice', 'phone', 'header',
  'com.github', 'com.twitter', 'com.youtube', 'com.virtuals', 'com.cookie',
  'org.telegram', 'fun.cookie',
  'owner', 'entityid', 'nodehash', 'registrar', 'source', 'birthdate',
  'keywords', 'video', 'image', 'category',
  'legalentity__lei__elf', 'legalentity__lei', 'legalentity__type',
  'legalentity__lookup__number', 'legalentity__tax__id',
  'legalentity__registrationauthority', 'legalentity__registrationauthority__entity',
  'legalentity__validationauthority', 'legalentity__validationauthority__entity',
  'legalentity__registrationauthority__name', 'legalentity__registrationauthority__region',
  'legalentity__constitution__additionalterms', 'legalentity__constitution__model',
  'aiagent__entrypoint__url', 'aiagent__entrypoint__contenttype',
  'aiagent__entrypoint__instructions', 'aiagent__entrypoint__accesscontrol',
  'aiagent__dependencies', 'aiagent__runtimeplatform', 'aiagent__programminglanguage',
  'token__ownership', 'token__utility', 'token__utlity__minbalance', 'token__governance',
  'location__address__number', 'location__address__line', 'location__address__city',
  'location__address__region', 'location__address__country', 'location__address__postalcode',
  'arbitrator__name', 'arbitrator__address',
  'partners', 'constitutionhash',
  'v3k__hidden', 'v3k__featured', 'v3k__trending',
  'company__name', 'company__description', 'company__address',
]);

/**
 * Normalize a label for entityid generation (mirrors RegistryChain's normalizeLabel).
 */
function normalizeLabel(label) {
  return label
    .replace(/[()#"',.&\/]/g, '')
    .replace(/ /g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '')
    .toLowerCase();
}

/**
 * Compute the constitutionhash of an entity (mirrors RegistryChain's hashConstitution).
 * keccak256 of the sorted, filtered, non-empty entity fields.
 */
function computeConstitutionHash(entity) {
  const filtered = Object.fromEntries(
    Object.entries(entity).filter(([key]) => CONSTITUTION_SCHEMA_FIELDS.has(key))
  );
  const cleaned = Object.fromEntries(
    Object.entries(filtered).filter(
      ([, value]) =>
        ![false, 0, '', 'false', null, 'NULL', undefined].includes(value)
    )
  );
  const sorted = Object.fromEntries(
    Object.entries(cleaned).sort(([a], [b]) => a.localeCompare(b))
  );
  const jsonStr = JSON.stringify(sorted);
  return ethers.keccak256(ethers.toUtf8Bytes(jsonStr));
}

/**
 * Parse partner fields from flat object keys like `partner__[0]__name`.
 * Also handles role fields like `partner__[0]__is__signer`.
 */
function parsePartnerFields(flatObj) {
  const partners = [];
  const partnerKeys = Object.keys(flatObj).filter(k => k.startsWith('partner__['));

  for (const key of partnerKeys) {
    const index = parseInt(key.split('partner__[')[1].split(']')[0]);
    const field = key.split(index + ']__')[1];

    while (partners.length < index + 1) {
      partners.push({ roles: ['manager'] });
    }

    if (field.includes('__is__')) {
      const role = field.split('__is__')[1];
      if (flatObj[key] === 'true' || flatObj[key] === true) {
        if (!partners[index].roles.includes(role)) {
          partners[index].roles.push(role);
        }
      }
    } else {
      partners[index][field] = flatObj[key];
    }
  }
  return partners;
}

/**
 * Create a changelog entry (mirrors RegistryChain's LogRecord).
 */
function createChangelog(nodehash, data, sourceFunction) {
  return {
    nodehash,
    changedProperties: { ...data },
    sourceFunction,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a full RegistryChain-compatible entity record from request body.
 */
function buildEntityRecord(name, body) {
  const registrar = body.registrar || 'test';
  const label = name.split('.')[0];
  const normalizedLabel = normalizeLabel(label);
  const entityid = `${normalizedLabel}.${registrar}.${TLD}`.toLowerCase();
  const nodehash = namehash(entityid);

  // Parse partners from body — accept array directly or flat partner__[n]__field keys
  let partners = [];
  if (Array.isArray(body.partners) && body.partners.length > 0) {
    partners = body.partners.map(p => ({
      name: p.name || '',
      type: p.type || '',
      walletaddress: p.walletaddress || '',
      shares: p.shares || '0',
      roles: Array.isArray(p.roles) ? p.roles : ['manager'],
      birthdate: p.birthdate || null,
      location: p.location || '',
    }));
  } else {
    const parsed = parsePartnerFields(body);
    if (parsed.length > 0) partners = parsed;
  }

  const record = {
    // ENS / RegistryChain Universal
    name: body.name || name,
    address: body.addr || body.address || null,
    owner: body.owner || body.addr || body.address || null,
    registrar,
    entityid,
    nodehash,
    birthdate: body.birthdate || new Date().toISOString().split('T')[0],
    source: body.source || 'gateway',

    // Company fields
    company__name: body.company__name || body.name || '',
    company__description: body.company__description || body.description || '',
    company__address: body.company__address || '',

    // Legal entity
    legalentity__constitution__model: body.legalentity__constitution__model || '',
    legalentity__constitution__additionalterms: body.legalentity__constitution__additionalterms || '',
    legalentity__type: body.legalentity__type || '',
    legalentity__lei: body.legalentity__lei || '',
    legalentity__lei__elf: body.legalentity__lei__elf || '',
    legalentity__lookup__number: body.legalentity__lookup__number || '',
    legalentity__tax__id: body.legalentity__tax__id || '',
    legalentity__registrationauthority: body.legalentity__registrationauthority || '',
    legalentity__registrationauthority__entity: body.legalentity__registrationauthority__entity || '',
    legalentity__registrationauthority__name: body.legalentity__registrationauthority__name || '',
    legalentity__registrationauthority__region: body.legalentity__registrationauthority__region || '',
    legalentity__validationauthority: body.legalentity__validationauthority || '',
    legalentity__validationauthority__entity: body.legalentity__validationauthority__entity || '',

    // Arbitrator
    arbitrator__name: body.arbitrator__name || '',
    arbitrator__address: body.arbitrator__address || '',

    // ENS standard fields
    avatar: body.avatar || '',
    description: body.description || '',
    location: body.location || '',
    url: body.url || '',
    email: body.email || '',
    keywords: body.keywords || '',
    category: body.category || '',

    // Partners
    partners,

    // Changelogs (populated after creation)
    changelogs: [],

    // ENS text records (for backward compat)
    texts: body.texts || {},
    contenthash: body.contenthash || null,

    // Metadata
    constitutionhash: '',
    v3k__hidden: body.v3k__hidden || false,
    v3k__featured: body.v3k__featured || false,
    v3k__trending: body.v3k__trending || false,
  };

  // Copy any additional fields from body that start with known prefixes
  const knownPrefixes = ['token__', 'location__address__', 'aiagent__', 'source__'];
  for (const key of Object.keys(body)) {
    if (knownPrefixes.some(p => key.startsWith(p)) && !(key in record)) {
      record[key] = body[key];
    }
  }

  // Create initial changelog
  const changelog = createChangelog(nodehash, record, 'register');
  record.changelogs = [changelog];

  // Compute constitutionhash
  record.constitutionhash = computeConstitutionHash(record);

  return { record, nodehash };
}

/**
 * Filter, sort, and paginate entities from the store.
 */
function getEntitiesList({ registrar, page = 0, nameSubstring = '', sortField = 'birthdate', sortDir = 'desc', limit = 25 }) {
  let entities = Array.from(subdomainStore.values());

  // Filter by registrar
  if (registrar && registrar !== 'any') {
    if (registrar.includes(',')) {
      const registrars = registrar.split(',');
      entities = entities.filter(e => registrars.includes(e.registrar));
    } else {
      entities = entities.filter(e => e.registrar === registrar);
    }
  }

  // Filter by name substring (case-insensitive search across name, keywords, description)
  if (nameSubstring && nameSubstring.trim()) {
    const search = nameSubstring.toLowerCase();
    entities = entities.filter(e =>
      (e.name && e.name.toLowerCase().includes(search)) ||
      (e.company__name && e.company__name.toLowerCase().includes(search)) ||
      (e.keywords && e.keywords.toLowerCase().includes(search)) ||
      (e.description && e.description.toLowerCase().includes(search))
    );
  }

  // Sort
  entities.sort((a, b) => {
    const aVal = a[sortField] || '';
    const bVal = b[sortField] || '';
    if (sortDir === 'asc') return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
  });

  // Paginate
  const skip = Number(page) * Number(limit);
  return entities.slice(skip, skip + Number(limit));
}

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
    const addr = record && (record.address || record.addr);
    if (addr) {
      result = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [addr]);
      log('Resolved addr', { name, addr });
    } else {
      log('No addr record', { name });
    }
  } else if (selector === SELECTORS['addr(bytes32,uint256)']) {
    // addr(bytes32, uint256 coinType) → returns bytes
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['bytes32', 'uint256'], '0x' + innerData.slice(10));
    const coinType = Number(decoded[1]);
    const addr = record && (record.address || record.addr);
    if (coinType === 60 && addr) {
      // ETH address (coinType 60)
      result = ethers.AbiCoder.defaultAbiCoder().encode(['bytes'], [addr]);
      log('Resolved addr(coinType=60)', { name, addr });
    } else {
      log('No addr for coinType', { name, coinType });
    }
  } else if (selector === SELECTORS['text(bytes32,string)']) {
    // text(bytes32, string key) → returns string
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['bytes32', 'string'], '0x' + innerData.slice(10));
    const key = decoded[1];
    // Check texts map first, then fall back to top-level entity fields
    let value = null;
    if (record) {
      if (record.texts && record.texts[key]) {
        value = record.texts[key];
      } else if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
        value = String(record[key]);
      }
    }
    if (value) {
      result = ethers.AbiCoder.defaultAbiCoder().encode(['string'], [value]);
      log('Resolved text', { name, key, value });
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

// List all registered entities
app.get('/subdomains', (req, res) => {
  const entries = [];
  for (const [node, record] of subdomainStore) {
    entries.push({ node, ...record });
  }
  res.json({ count: entries.length, subdomains: entries });
});

// ============================================================
// Register entity (POST /register) — RegistryChain-compatible
// ============================================================

app.post('/register', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required (e.g. testentity.test.divicompany.eth)' });
  }

  const { record, nodehash } = buildEntityRecord(name, req.body);

  // Check if entity already exists
  if (subdomainStore.has(nodehash)) {
    return res.status(409).json({ error: 'Entity already registered', nodehash });
  }

  subdomainStore.set(nodehash, record);

  log('Entity registered', { name: record.name, entityid: record.entityid, nodehash });

  res.json({
    success: true,
    name: record.name,
    node: nodehash,
    record,
  });
});

// ============================================================
// setText — Update entity fields by nodehash (mirrors mongo.ts setText)
// ============================================================

app.post('/setText', (req, res) => {
  const { node, key, value } = req.body;

  if (!node || !key) {
    return res.status(400).json({ error: 'node and key are required' });
  }

  const record = subdomainStore.get(node);
  if (!record) {
    return res.status(404).json({ error: 'Entity not found', node });
  }

  const previousValue = record[key];

  if (key.includes('partner__[')) {
    // Partner field update: partner__[0]__name, partner__[0]__is__signer
    const index = parseInt(key.split('partner__[')[1].split(']')[0]);
    const field = key.split(index + ']__')[1];

    while (record.partners.length < index + 1) {
      record.partners.push({ roles: ['manager'] });
    }

    if (field.includes('__is__')) {
      const role = field.split('__is__')[1];
      if (!record.partners[index].roles) {
        record.partners[index].roles = ['manager'];
      }
      if (value === 'true' || value === true) {
        if (!record.partners[index].roles.includes(role)) {
          record.partners[index].roles.push(role);
        }
      } else {
        record.partners[index].roles = record.partners[index].roles.filter(r => r !== role);
      }
    } else {
      record.partners[index][field] = value;
    }
  } else if (key.includes('__[')) {
    // Array field update: image__[0], etc.
    const memberIndex = parseInt(key.split('__[')[1].split(']')[0]);
    const baseField = key.split('__[')[0];

    if (!record[baseField] || !Array.isArray(record[baseField]) || record[baseField].length === 0) {
      record[baseField] = [value];
    } else if (value === '') {
      record[baseField].splice(memberIndex, 1);
    } else {
      record[baseField][memberIndex] = value;
    }
  } else {
    // Simple field update
    record[key] = value;
  }

  // Create changelog entry
  const changelog = createChangelog(node, { [key]: previousValue }, 'setText');
  record.changelogs.push(changelog);

  // Recompute constitutionhash
  record.constitutionhash = computeConstitutionHash(record);

  subdomainStore.set(node, record);

  log('setText', { node, key, value });

  res.json({ success: true, node, key, value, record });
});

// ============================================================
// Direct API — getEntitiesList (mirrors RegistryChain Gateway)
// ============================================================

app.get('/direct/getEntitiesList', (req, res) => {
  const { registrar, page = 0, nameSubstring = '', sortField = 'birthdate', sortDir = 'desc', limit = 25 } = req.query;

  const entities = getEntitiesList({
    registrar,
    page: Number(page),
    nameSubstring,
    sortField,
    sortDir,
    limit: Number(limit),
  });

  res.json({ success: true, data: entities });
});

// ============================================================
// Direct API — getRecord by nodehash
// ============================================================

app.get('/direct/getRecord', (req, res) => {
  const { nodehash } = req.query;

  if (!nodehash) {
    return res.status(400).json({ error: 'nodehash query param is required' });
  }

  const record = subdomainStore.get(nodehash);
  if (!record) {
    return res.status(404).json({ error: 'Entity not found', nodehash });
  }

  res.json({ success: true, data: record });
});

// ============================================================
// CCIP-Read endpoints (MUST be after named routes)
// ============================================================

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

// CCIP-Read: POST /rpc
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
  console.log('  CCIP-Read Gateway (RegistryChain-Compatible)');
  console.log('='.repeat(60));
  console.log(`  Port:    ${PORT}`);
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  TLD:     ${TLD}`);
  console.log(`  Log:     ${LOG_FILE}`);
  console.log('='.repeat(60));
  console.log('\nEndpoints:');
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/subdomains`);
  console.log(`  POST http://localhost:${PORT}/register`);
  console.log(`  POST http://localhost:${PORT}/setText`);
  console.log(`  GET  http://localhost:${PORT}/direct/getEntitiesList`);
  console.log(`  GET  http://localhost:${PORT}/direct/getRecord`);
  console.log(`  GET  http://localhost:${PORT}/:sender/:callData.json  (CCIP-Read)`);
  console.log(`  POST http://localhost:${PORT}/rpc                     (CCIP-Read)\n`);

  log('Gateway started', { port: PORT, signer: signer.address });
});
