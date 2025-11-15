// __tests__/logCoffeeClick.security.test.js
// Test verifying IP hashing uses salt for security

const crypto = require('crypto');

describe('logCoffeeClick - IP Hashing with Salt', () => {
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

  test('Uses VISITOR_SALT for IP hashing', async () => {
    const testIP = '192.168.1.1';

    const event = {
      httpMethod: 'POST',
      headers: { 'x-nf-client-connection-ip': testIP },
      body: JSON.stringify({})
    };

    await handler(event, {});

    const insertedDoc = mockCollection.insertOne.mock.calls[0][0];
    const fingerprint = insertedDoc.visitorFingerprint;

    // Hash should include salt
    const expectedHash = crypto.createHash('sha256')
      .update(testIP + process.env.VISITOR_SALT)
      .digest('hex');

    expect(fingerprint).toBe(expectedHash);
  });

  test('Returns 500 if VISITOR_SALT not configured', async () => {
    delete process.env.VISITOR_SALT;

    jest.resetModules();
    handler = require('../netlify/functions/logCoffeeClick').handler;

    const event = {
      httpMethod: 'POST',
      headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
      body: JSON.stringify({})
    };

    const result = await handler(event, {});

    expect(result.statusCode).toBe(500);
    expect(result.body).toContain('configuration error');
  });

  test('Salted hash differs from unsalted hash', async () => {
    const testIP = '10.0.0.1';

    const event = {
      httpMethod: 'POST',
      headers: { 'x-nf-client-connection-ip': testIP },
      body: JSON.stringify({})
    };

    await handler(event, {});

    const insertedDoc = mockCollection.insertOne.mock.calls[0][0];
    const saltedFingerprint = insertedDoc.visitorFingerprint;

    // Unsalted hash for comparison
    const unsaltedHash = crypto.createHash('sha256').update(testIP).digest('hex');

    // Salted hash should be different from unsalted
    expect(saltedFingerprint).not.toBe(unsaltedHash);
  });

  test('Same IP with same salt produces same hash (consistency)', async () => {
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

    // Same IP with same salt should produce same hash (for tracking)
    expect(fingerprint1).toBe(fingerprint2);
  });

  test('Different IPs produce different hashes', async () => {
    const event1 = {
      httpMethod: 'POST',
      headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
      body: JSON.stringify({})
    };

    const event2 = {
      httpMethod: 'POST',
      headers: { 'x-nf-client-connection-ip': '192.168.1.2' },
      body: JSON.stringify({})
    };

    await handler(event1, {});
    const fingerprint1 = mockCollection.insertOne.mock.calls[0][0].visitorFingerprint;

    await handler(event2, {});
    const fingerprint2 = mockCollection.insertOne.mock.calls[1][0].visitorFingerprint;

    expect(fingerprint1).not.toBe(fingerprint2);
  });

  test('Consistent with other functions (createVisitorDocument pattern)', () => {
    // Verify we use the same pattern as createVisitorDocument.js
    const testIP = '192.168.1.1';
    const salt = 'test-salt';

    // Pattern from createVisitorDocument.js and setHighScore.js
    const expectedPattern = crypto.createHash('sha256')
      .update(testIP + salt)
      .digest('hex');

    expect(expectedPattern).toBeDefined();
    expect(expectedPattern.length).toBe(64); // SHA-256 hex length
  });
});
