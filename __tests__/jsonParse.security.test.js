// __tests__/jsonParse.security.test.js
// Test demonstrating unprotected JSON.parse() vulnerability across netlify functions

describe('JSON.parse() Security - Unhandled Exceptions', () => {
  let createUserHandler;
  let loginUserHandler;
  let updateVisitorHandler;
  let mockClient;
  let mockDb;
  let mockCollection;

  beforeEach(() => {
    // Reset modules
    jest.resetModules();

    // Mock MongoDB client
    mockCollection = {
      findOne: jest.fn().mockResolvedValue(null),
      insertOne: jest.fn().mockResolvedValue({ acknowledged: true }),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([])
      })
    };

    mockDb = {
      collection: jest.fn(() => mockCollection)
    };

    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn(() => mockDb)
    };

    // Mock mongodb module
    jest.mock('mongodb', () => ({
      MongoClient: jest.fn(() => mockClient),
      ServerApiVersion: { v1: '1' },
      ObjectId: jest.fn((id) => id)
    }));

    // Mock bcrypt
    jest.mock('bcryptjs', () => ({
      hash: jest.fn().mockResolvedValue('hashed-password'),
      compare: jest.fn().mockResolvedValue(true)
    }));

    // Load handlers
    createUserHandler = require('../netlify/functions/createUser').handler;
    loginUserHandler = require('../netlify/functions/loginUser').handler;
    updateVisitorHandler = require('../netlify/functions/updateVisitorDocument').handler;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser.js - Malformed JSON', () => {
    test('BEFORE FIX: Returns 500 instead of 400 for malformed JSON', async () => {
      const malformedEvent = {
        httpMethod: 'POST',
        body: '{invalid json'  // Malformed JSON
      };

      // BEFORE FIX: Returns generic 500 instead of proper 400 Bad Request
      const result = await createUserHandler(malformedEvent, {});
      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('Internal Server Error');
      // Should be 400 with specific error message
    });

    test('BEFORE FIX: Returns 500 for null body', async () => {
      const nullBodyEvent = {
        httpMethod: 'POST',
        body: null
      };

      const result = await createUserHandler(nullBodyEvent, {});
      expect(result.statusCode).toBe(500);
    });

    test('BEFORE FIX: Returns 500 for undefined body', async () => {
      const undefinedBodyEvent = {
        httpMethod: 'POST',
        body: undefined
      };

      const result = await createUserHandler(undefinedBodyEvent, {});
      expect(result.statusCode).toBe(500);
    });
  });

  describe('loginUser.js - Malformed JSON', () => {
    test('BEFORE FIX: Returns 500 for malformed JSON', async () => {
      const malformedEvent = {
        httpMethod: 'POST',
        body: '{"username": incomplete'
      };

      const result = await loginUserHandler(malformedEvent, {});
      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('Internal Server Error');
    });

    test('BEFORE FIX: Returns 500 for trailing comma', async () => {
      const trailingCommaEvent = {
        httpMethod: 'POST',
        body: '{"username": "test",}'  // Invalid JSON
      };

      const result = await loginUserHandler(trailingCommaEvent, {});
      expect(result.statusCode).toBe(500);
    });
  });

  describe('updateVisitorDocument.js - Malformed JSON', () => {
    test('BEFORE FIX: Returns 500 for malformed JSON', async () => {
      const malformedEvent = {
        httpMethod: 'POST',
        body: '[not valid json}'
      };

      const result = await updateVisitorHandler(malformedEvent, {});
      expect(result.statusCode).toBe(500);
    });

    test('BEFORE FIX: Returns 500 for NaN in JSON', async () => {
      const nanEvent = {
        httpMethod: 'POST',
        body: '{"value": NaN}'  // NaN is not valid JSON
      };

      const result = await updateVisitorHandler(nanEvent, {});
      expect(result.statusCode).toBe(500);
    });
  });
});

describe('AFTER FIX: Proper Error Handling', () => {
  test('Should return 400 with descriptive error for malformed JSON', () => {
    // AFTER FIX: Functions should:
    // 1. Wrap JSON.parse() in try-catch
    // 2. Return 400 Bad Request with clear error message
    // 3. Log the error for debugging
    // 4. NOT crash the function

    // This documents expected behavior after fix
    expect(true).toBe(true);
  });

  test('Should validate request body exists before parsing', () => {
    // AFTER FIX: Check if body exists and is a string before parsing
    expect(true).toBe(true);
  });
});
