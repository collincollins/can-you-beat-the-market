// __tests__/logCoffeeClick.security.test.js
// Test demonstrating missing salt in IP hashing

const crypto = require('crypto');

describe('logCoffeeClick - IP Hashing Security', () => {
  let handler;
  let mockClient;
  let mockDb;
  let mockCollection;

  beforeEach(() => {
    jest.resetModules();

    // Mock MongoDB
    mockCollection = {
      insertOne: jest.fn().mockResolvedValue({ acknowledged: true })
    };

    mockDb = {
      collection: jest.fn(() => mockCollection)
    };

    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn(() => mockDb)
    };

    jest.mock('mongodb', () => ({
      MongoClient: jest.fn(() => mockClient),
      ServerApiVersion: { v1: '1' }
    }));

    handler = require('../netlify/functions/logCoffeeClick').handler;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('BEFORE FIX: IP hash is unsalted and deterministic', async () => {
    const testIP = '192.168.1.1';

    const event = {
      httpMethod: 'POST',
      headers: {
        'x-nf-client-connection-ip': testIP
      },
      body: JSON.stringify({})
    };

    await handler(event, {});

    // Get the fingerprint that was inserted
    expect(mockCollection.insertOne).toHaveBeenCalled();
    const insertedDoc = mockCollection.insertOne.mock.calls[0][0];
    const fingerprint = insertedDoc.visitorFingerprint;

    // BEFORE FIX: The hash is just SHA-256 of IP without salt
    // This means it's vulnerable to rainbow table attacks
    const unsaltedHash = crypto.createHash('sha256').update(testIP).digest('hex');

    // BEFORE FIX: These should match (demonstrating no salt)
    expect(fingerprint).toBe(unsaltedHash);

    console.log('VULNERABILITY: IP hash is deterministic without salt');
    console.log(`IP: ${testIP}`);
    console.log(`Hash: ${fingerprint}`);
    console.log('An attacker can use rainbow tables to de-anonymize users');
  });

  test('BEFORE FIX: Same IP always produces same hash', async () => {
    const testIP = '10.0.0.1';

    const event1 = {
      httpMethod: 'POST',
      headers: { 'x-nf-client-connection-ip': testIP },
      body: JSON.stringify({})
    };

    const event2 = {
      httpMethod: 'POST',
      headers: { 'x-nf-client-connection-ip': testIP },
      body: JSON.stringify({})
    };

    await handler(event1, {});
    const fingerprint1 = mockCollection.insertOne.mock.calls[0][0].visitorFingerprint;

    await handler(event2, {});
    const fingerprint2 = mockCollection.insertOne.mock.calls[1][0].visitorFingerprint;

    // BEFORE FIX: Same IP = same hash (no randomization/salt)
    expect(fingerprint1).toBe(fingerprint2);
  });

  test('Comparison: Other functions USE salt', () => {
    // This test documents expected behavior
    // Functions like createVisitorDocument.js and setHighScore.js
    // use VISITOR_SALT environment variable

    const testIP = '192.168.1.1';
    const salt = 'test-salt-123';

    // With salt (how it SHOULD be):
    const saltedHash = crypto.createHash('sha256').update(testIP + salt).digest('hex');

    // Without salt (current logCoffeeClick):
    const unsaltedHash = crypto.createHash('sha256').update(testIP).digest('hex');

    // These should be different
    expect(saltedHash).not.toBe(unsaltedHash);

    console.log('Expected behavior: Salt makes hashes unpredictable');
    console.log(`Salted:   ${saltedHash}`);
    console.log(`Unsalted: ${unsaltedHash}`);
  });
});

describe('AFTER FIX: IP Hashing with Salt', () => {
  let handler;
  let mockClient;
  let mockDb;
  let mockCollection;

  beforeEach(() => {
    // Set VISITOR_SALT env var
    process.env.VISITOR_SALT = 'test-salt-secret';

    jest.resetModules();

    mockCollection = {
      insertOne: jest.fn().mockResolvedValue({ acknowledged: true })
    };

    mockDb = {
      collection: jest.fn(() => mockCollection)
    };

    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn(() => mockDb)
    };

    jest.mock('mongodb', () => ({
      MongoClient: jest.fn(() => mockClient),
      ServerApiVersion: { v1: '1' }
    }));

    handler = require('../netlify/functions/logCoffeeClick').handler;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.VISITOR_SALT;
  });

  test('AFTER FIX: Should use VISITOR_SALT for hashing', async () => {
    const testIP = '192.168.1.1';

    const event = {
      httpMethod: 'POST',
      headers: { 'x-nf-client-connection-ip': testIP },
      body: JSON.stringify({})
    };

    await handler(event, {});

    const insertedDoc = mockCollection.insertOne.mock.calls[0][0];
    const fingerprint = insertedDoc.visitorFingerprint;

    // AFTER FIX: Hash should include salt
    const expectedHash = crypto.createHash('sha256')
      .update(testIP + process.env.VISITOR_SALT)
      .digest('hex');

    expect(fingerprint).toBe(expectedHash);
  });

  test('AFTER FIX: Should throw error if VISITOR_SALT not configured', async () => {
    delete process.env.VISITOR_SALT;

    jest.resetModules();
    handler = require('../netlify/functions/logCoffeeClick').handler;

    const event = {
      httpMethod: 'POST',
      headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
      body: JSON.stringify({})
    };

    const result = await handler(event, {});

    // Should return 500 if salt is missing
    expect(result.statusCode).toBe(500);
    expect(result.body).toContain('configuration error');
  });
});
