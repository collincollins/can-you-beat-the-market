// __tests__/setHighScore.fixed.test.js
// Tests verifying security fixes in setHighScore

const crypto = require('crypto');

describe('High Score Security - AFTER FIXES', () => {
  let handler;
  let mockClient;
  let mockDb;
  let mockVisitorsCollection;
  let mockCurrentHighScoreCollection;
  let mockHistoryCollection;

  beforeEach(() => {
    process.env.VISITOR_SALT = 'test-salt';
    jest.resetModules();

    mockVisitorsCollection = {
      countDocuments: jest.fn().mockResolvedValue(10)
    };

    mockCurrentHighScoreCollection = {
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true })
    };

    mockHistoryCollection = {
      insertOne: jest.fn().mockResolvedValue({ acknowledged: true })
    };

    mockDb = {
      collection: jest.fn((name) => {
        if (name === 'visitors') return mockVisitorsCollection;
        if (name === 'currentHighScore') return mockCurrentHighScoreCollection;
        if (name === 'highScoreHistory') return mockHistoryCollection;
        return {};
      })
    };

    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn(() => mockDb)
    };

    jest.mock('mongodb', () => ({
      MongoClient: jest.fn(() => mockClient),
      ServerApiVersion: { v1: '1' }
    }));

    handler = require('../netlify/functions/setHighScore').handler;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.VISITOR_SALT;
  });

  describe('XSS Protection - FIXED', () => {
    test('Strips script tags from playerName', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: '<script>alert("XSS")</script>SafeName',
          score: 5,
          userId: '123e4567-e89b-12d3-a456-426614174000'
        })
      }, {});

      expect(result.statusCode).toBe(200);

      // Verify sanitized name was stored (no script tag)
      expect(mockHistoryCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          playerName: 'SafeName'
        })
      );
    });

    test('Rejects playerName that becomes empty after sanitization', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: '<script>alert(1)</script>',
          score: 5,
          userId: '123e4567-e89b-12d3-a456-426614174000'
        })
      }, {});

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('invalid characters');
    });

    test('Strips HTML event handlers', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: '<img src=x onerror="fetch(\'evil.com\')">Player',
          score: 3,
          userId: '123e4567-e89b-12d3-a456-426614174000'
        })
      }, {});

      expect(result.statusCode).toBe(200);

      // Verify sanitized (no onerror)
      expect(mockHistoryCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          playerName: 'Player'
        })
      );
    });

    test('Strips all HTML tags', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: '<b>Bold</b><i>Italic</i> Player',
          score: 3,
          userId: '123e4567-e89b-12d3-a456-426614174000'
        })
      }, {});

      expect(result.statusCode).toBe(200);

      expect(mockHistoryCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          playerName: 'BoldItalic Player'
        })
      );
    });
  });

  describe('Max Length Validation - FIXED', () => {
    test('Rejects playerName longer than 50 characters', async () => {
      const longName = 'A'.repeat(51);

      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: longName,
          score: 5,
          userId: '123e4567-e89b-12d3-a456-426614174000'
        })
      }, {});

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('50 characters');
    });

    test('Accepts playerName exactly 50 characters', async () => {
      const maxName = 'A'.repeat(50);

      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: maxName,
          score: 5,
          userId: '123e4567-e89b-12d3-a456-426614174000'
        })
      }, {});

      expect(result.statusCode).toBe(200);
    });

    test('Prevents 100KB DoS attack', async () => {
      const massiveName = 'A'.repeat(100000);

      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: massiveName,
          score: 5,
          userId: '123e4567-e89b-12d3-a456-426614174000'
        })
      }, {});

      expect(result.statusCode).toBe(400);
      expect(mockHistoryCollection.insertOne).not.toHaveBeenCalled();
    });
  });

  describe('Score Validation Enhanced - FIXED', () => {
    test('Rejects float score', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Test',
          score: 42.5,
          userId: '123e4567-e89b-12d3-a456-426614174000'
        })
      }, {});

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('integer');
    });

    test('Rejects unrealistically high score', async () => {
      mockVisitorsCollection.countDocuments.mockResolvedValue(2000000);

      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Cheater',
          score: 2000000,
          userId: '123e4567-e89b-12d3-a456-426614174000'
        })
      }, {});

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('maximum');
    });

    test('Accepts realistic high score', async () => {
      mockVisitorsCollection.countDocuments.mockResolvedValue(1000);

      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'ProGamer',
          score: 1000,
          userId: '123e4567-e89b-12d3-a456-426614174000'
        })
      }, {});

      expect(result.statusCode).toBe(200);
    });
  });

  describe('UserId Validation Enhanced - FIXED', () => {
    test('Rejects invalid UUID format', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Test',
          score: 5,
          userId: 'not-a-uuid'
        })
      }, {});

      expect(result.statusCode).toBe(403);
      expect(result.body).toContain('logged in');
    });

    test('Rejects malformed UUID', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Test',
          score: 5,
          userId: '123-456-789'
        })
      }, {});

      expect(result.statusCode).toBe(403);
    });

    test('Accepts valid UUID', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Test',
          score: 5,
          userId: '123e4567-e89b-12d3-a456-426614174000'
        })
      }, {});

      expect(result.statusCode).toBe(200);
    });
  });

  describe('JSON Parse Protection - FIXED', () => {
    test('Returns 400 for malformed JSON', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: '{invalid json'
      }, {});

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Bad Request');
      expect(result.body).toContain('Invalid JSON');
    });

    test('Returns 400 for null body', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: null
      }, {});

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('missing');
    });
  });

  describe('Edge Cases Still Handled', () => {
    test('Handles Unicode characters safely', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: '你好世界🎮',
          score: 5,
          userId: '123e4567-e89b-12d3-a456-426614174000'
        })
      }, {});

      expect(result.statusCode).toBe(200);

      expect(mockHistoryCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          playerName: '你好世界🎮'
        })
      );
    });

    test('Trims whitespace from playerName', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: '   SpacedName   ',
          score: 5,
          userId: '123e4567-e89b-12d3-a456-426614174000'
        })
      }, {});

      expect(result.statusCode).toBe(200);

      expect(mockHistoryCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          playerName: 'SpacedName'
        })
      );
    });
  });
});
