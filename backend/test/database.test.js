import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { sanitizeMongoUri, getDatabaseStatus } from '../src/config/db.js';

describe('Database Configuration & Diagnostics', () => {
  it('sanitizeMongoUri masks credentials cleanly', () => {
    const testUser = 'test_fixture_user';
    const testSecret = 'fixture_token_abc123';
    const rawUri = `mongodb://${testUser}:${testSecret}@127.0.0.1:27017/test_db`;
    const sanitized = sanitizeMongoUri(rawUri);

    assert.equal(sanitized.includes(testSecret), false);
    assert.equal(sanitized, `mongodb://${testUser}:***@127.0.0.1:27017/test_db`);

    // If MONGODB_URI is provided via environment, verify masking without exposing values
    if (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('@')) {
      const sanitizedEnv = sanitizeMongoUri(process.env.MONGODB_URI);
      assert.ok(sanitizedEnv.includes(':***@'));
    }
  });

  it('sanitizeMongoUri handles URIs without credentials or null safely', () => {
    assert.equal(sanitizeMongoUri('mongodb://127.0.0.1:27017/sitesentry'), 'mongodb://127.0.0.1:27017/sitesentry');
    assert.equal(sanitizeMongoUri(null), '');
    assert.equal(sanitizeMongoUri(undefined), '');
  });

  it('getDatabaseStatus reports connection and volatility metadata', () => {
    const status = getDatabaseStatus();
    assert.ok(typeof status.connected === 'boolean');
    assert.ok(typeof status.isVolatile === 'boolean');
    assert.ok(typeof status.storageType === 'string');
    assert.ok(typeof status.readyStateText === 'string');
  });

  it('validates MongoDB ObjectId accurately', () => {
    assert.equal(mongoose.Types.ObjectId.isValid('507f1f77bcf86cd799439011'), true);
    assert.equal(mongoose.Types.ObjectId.isValid('67bcd1234567890abcdef123'), true);
    // Invalid IDs
    assert.equal(mongoose.Types.ObjectId.isValid('invalid-id'), false);
    assert.equal(mongoose.Types.ObjectId.isValid('../admin'), false);
    assert.equal(mongoose.Types.ObjectId.isValid(''), false);
    assert.equal(mongoose.Types.ObjectId.isValid(null), false);
  });
});
