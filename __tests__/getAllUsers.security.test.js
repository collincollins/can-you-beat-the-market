// __tests__/getAllUsers.security.test.js
// Test demonstrating the admin authorization bypass vulnerability and its fix

describe('getAllUsers Security - Authorization Bypass', () => {
  let handler;
  let mockClient;
  let mockDb;
  let mockUsersCollection;
  const ADMIN_API_KEY = 'test-admin-key-123';

  beforeEach(() => {
    // Set the admin API key environment variable
    process.env.ADMIN_API_KEY = ADMIN_API_KEY;

    // Reset modules to ensure clean state
    jest.resetModules();

    // Mock the MongoDB client
    mockUsersCollection = {
      aggregate: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { username: 'user1', userId: 'uuid-1', createdAt: new Date(), validGames: 5 },
          { username: 'user2', userId: 'uuid-2', createdAt: new Date(), validGames: 10 }
        ])
      })
    };

    mockDb = {
      collection: jest.fn((name) => {
        if (name === 'users') return mockUsersCollection;
        return { find: jest.fn() };
      })
    };

    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn(() => mockDb)
    };

    // Mock the mongodb module
    jest.mock('mongodb', () => ({
      MongoClient: jest.fn(() => mockClient),
      ServerApiVersion: { v1: '1' }
    }));

    // Load the handler after mocking
    handler = require('../netlify/functions/getAllUsers').handler;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.ADMIN_API_KEY;
  });

  test('FIXED: Query parameter bypass no longer works', async () => {
    // AFTER FIX: Query parameter bypass is blocked
    const maliciousEvent = {
      httpMethod: 'GET',
      queryStringParameters: {
        username: 'collin'  // This no longer grants access
      },
      headers: {}  // No API key provided
    };

    const result = await handler(maliciousEvent, {});

    // AFTER FIX: Now correctly returns 403
    expect(result.statusCode).toBe(403);
    expect(result.body).toContain('Forbidden');
    expect(result.body).toContain('Invalid or missing admin credentials');
  });

  test('FIXED: Case variation query bypass no longer works', async () => {
    const maliciousEvent = {
      httpMethod: 'GET',
      queryStringParameters: {
        username: 'COLLIN'
      },
      headers: {}
    };

    const result = await handler(maliciousEvent, {});

    // AFTER FIX: Correctly blocked
    expect(result.statusCode).toBe(403);
  });

  test('Should reject requests without API key header', async () => {
    const unauthorizedEvent = {
      httpMethod: 'GET',
      headers: {}
    };

    const result = await handler(unauthorizedEvent, {});

    expect(result.statusCode).toBe(403);
    expect(result.body).toContain('Invalid or missing admin credentials');
  });

  test('Should reject requests with incorrect API key', async () => {
    const invalidKeyEvent = {
      httpMethod: 'GET',
      headers: {
        'x-admin-api-key': 'wrong-key'
      }
    };

    const result = await handler(invalidKeyEvent, {});

    expect(result.statusCode).toBe(403);
  });

  test('Should allow access with valid API key in lowercase header', async () => {
    const validEvent = {
      httpMethod: 'GET',
      headers: {
        'x-admin-api-key': ADMIN_API_KEY
      }
    };

    const result = await handler(validEvent, {});

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body)).toBe(true);
  });

  test('Should allow access with valid API key in mixed-case header', async () => {
    const validEvent = {
      httpMethod: 'GET',
      headers: {
        'X-Admin-Api-Key': ADMIN_API_KEY
      }
    };

    const result = await handler(validEvent, {});

    expect(result.statusCode).toBe(200);
  });

  test('Should return 500 when ADMIN_API_KEY is not configured', async () => {
    // Remove the API key
    delete process.env.ADMIN_API_KEY;

    // Reload handler without API key configured
    jest.resetModules();
    handler = require('../netlify/functions/getAllUsers').handler;

    const event = {
      httpMethod: 'GET',
      headers: {
        'x-admin-api-key': 'some-key'
      }
    };

    const result = await handler(event, {});

    expect(result.statusCode).toBe(500);
    expect(result.body).toContain('Server configuration error');
  });
});
