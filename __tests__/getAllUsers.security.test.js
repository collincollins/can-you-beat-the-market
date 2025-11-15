// __tests__/getAllUsers.security.test.js
// Test demonstrating the admin authorization bypass vulnerability

describe('getAllUsers Security - Authorization Bypass', () => {
  let handler;
  let mockClient;
  let mockDb;
  let mockUsersCollection;

  beforeEach(() => {
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
  });

  test('VULNERABILITY: Should allow access when attacker provides username=collin in query', async () => {
    // BEFORE FIX: This demonstrates the vulnerability
    // An attacker can simply add ?username=collin to bypass authorization

    const maliciousEvent = {
      httpMethod: 'GET',
      queryStringParameters: {
        username: 'collin'  // Attacker-controlled value!
      }
    };

    const result = await handler(maliciousEvent, {});

    // BEFORE FIX: This should FAIL (return 403) but instead returns 200
    // The vulnerability allows unauthorized access
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    console.log('VULNERABILITY CONFIRMED: Unauthorized access granted with query param bypass');
  });

  test('VULNERABILITY: Should allow access with case variations', async () => {
    const maliciousEvent = {
      httpMethod: 'GET',
      queryStringParameters: {
        username: 'COLLIN'  // Case variation also works due to .toLowerCase()
      }
    };

    const result = await handler(maliciousEvent, {});

    // BEFORE FIX: This also bypasses security
    expect(result.statusCode).toBe(200);
  });

  test('Should reject requests without proper authorization header', async () => {
    const unauthorizedEvent = {
      httpMethod: 'GET',
      queryStringParameters: {
        username: 'attacker'
      }
    };

    const result = await handler(unauthorizedEvent, {});

    // This correctly returns 403
    expect(result.statusCode).toBe(403);
  });

  test('Should reject requests with no query parameters', async () => {
    const noParamsEvent = {
      httpMethod: 'GET',
      queryStringParameters: null
    };

    const result = await handler(noParamsEvent, {});

    expect(result.statusCode).toBe(403);
  });
});

describe('Expected Behavior AFTER FIX', () => {
  test('Should require server-side authentication (not query params)', () => {
    // AFTER FIX: The function should:
    // 1. Use environment variable or server-side session to verify admin
    // 2. NOT trust client-supplied query parameters
    // 3. Validate requests using secure headers (e.g., API keys, JWT tokens)

    // This test documents the expected secure behavior
    expect(true).toBe(true);
  });
});
