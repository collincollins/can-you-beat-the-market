// __tests__/jsonParse.security.test.js
// Test verifying proper JSON parsing error handling in netlify functions

describe('JSON Parsing Security - Proper Error Handling', () => {
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

  describe('Malformed JSON Handling', () => {
    test('createUser: Returns 400 for malformed JSON', async () => {
      const result = await createUserHandler({
        httpMethod: 'POST',
        body: '{invalid json'
      }, {});

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Bad Request');
      expect(result.body).toContain('Invalid JSON');
    });

    test('loginUser: Returns 400 for malformed JSON', async () => {
      const result = await loginUserHandler({
        httpMethod: 'POST',
        body: '{"username": incomplete'
      }, {});

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Bad Request');
    });

    test('updateVisitor: Returns 400 for malformed JSON', async () => {
      const result = await updateVisitorHandler({
        httpMethod: 'POST',
        body: '[not valid json}'
      }, {});

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Missing/Invalid Body Handling', () => {
    test('createUser: Returns 400 for null body', async () => {
      const result = await createUserHandler({
        httpMethod: 'POST',
        body: null
      }, {});

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Request body is missing');
    });

    test('loginUser: Returns 400 for undefined body', async () => {
      const result = await loginUserHandler({
        httpMethod: 'POST',
        body: undefined
      }, {});

      expect(result.statusCode).toBe(400);
    });

    test('updateVisitor: Returns 400 for empty body', async () => {
      const result = await updateVisitorHandler({
        httpMethod: 'POST',
        body: '   '  // Empty/whitespace only
      }, {});

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Request body is empty');
    });
  });

  describe('Error Logging', () => {
    test('Should NOT log stack traces for client-side JSON errors', async () => {
      // Verify that the functions don't log stack traces for client errors
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await createUserHandler({
        httpMethod: 'POST',
        body: 'not json'
      }, {});

      // Should NOT log errors for client-side issues
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    test('Handles JSON with trailing comma', async () => {
      const result = await createUserHandler({
        httpMethod: 'POST',
        body: '{"username": "test",}'
      }, {});

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Invalid JSON');
    });

    test('Handles JSON with NaN', async () => {
      const result = await updateVisitorHandler({
        httpMethod: 'POST',
        body: '{"value": NaN}'
      }, {});

      expect(result.statusCode).toBe(400);
    });
  });
});
