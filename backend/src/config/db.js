import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoMemoryServer = null;

let dbStatus = {
  connected: false,
  isVolatile: false,
  storageType: 'Uninitialized',
  sanitizedUri: '',
  connectedAt: null,
  error: null,
};

export function sanitizeMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return '';
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}

export function getDatabaseStatus() {
  const readyState = mongoose.connection.readyState;
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  return {
    ...dbStatus,
    readyState,
    readyStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][readyState] || 'unknown',
    connected: readyState === 1,
  };
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  // 1. Try external persistent MongoDB (e.g. MongoDB Atlas)
  if (uri) {
    const sanitized = sanitizeMongoUri(uri);
    try {
      console.log(`[Database] Attempting connection to persistent MongoDB (MONGODB_URI): ${sanitized}`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      
      dbStatus = {
        connected: true,
        isVolatile: false,
        storageType: 'Persistent (External/Atlas)',
        sanitizedUri: sanitized,
        connectedAt: new Date(),
        error: null,
      };

      console.log('✅ [Database] Connected to external persistent MongoDB successfully. Audits will persist across server restarts.');
      return;
    } catch (err) {
      const sanitizedErr = err.message.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, '[REDACTED_URI]');
      console.error('❌ [Database] Configured MongoDB (MONGODB_URI) connection failed:', sanitizedErr);
      dbStatus.error = `External DB connection failed: ${sanitizedErr}`;
      console.warn('⚠️ [Database] Falling back to local/embedded MongoDB...');
    }
  }

  // 2. Try local MongoDB on standard port (27017)
  try {
    const localUri = 'mongodb://127.0.0.1:27017/sitesentry';
    console.log('[Database] Checking local persistent MongoDB at', localUri);
    await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2000 });

    dbStatus = {
      connected: true,
      isVolatile: false,
      storageType: 'Persistent (Local)',
      sanitizedUri: localUri,
      connectedAt: new Date(),
      error: null,
    };

    console.log('✅ [Database] Connected to local persistent MongoDB instance.');
    return;
  } catch {
    console.log('[Database] Local persistent MongoDB not active. Launching embedded MongoMemoryServer for development/testing...');
  }

  // 3. Fallback to MongoMemoryServer (explicitly declared volatile/ephemeral)
  try {
    mongoMemoryServer = await MongoMemoryServer.create();
    const memoryUri = mongoMemoryServer.getUri();
    await mongoose.connect(memoryUri);

    dbStatus = {
      connected: true,
      isVolatile: true,
      storageType: 'In-Memory (Volatile / Ephemeral)',
      sanitizedUri: memoryUri,
      connectedAt: new Date(),
      error: null,
    };

    console.log(`⚠️ [Database] Connected to embedded in-memory MongoDB (${memoryUri}).`);
    console.log('ℹ️ [Database Notice] Storage is EPHEMERAL: Audit records will reset when the backend process restarts. Configure MONGODB_URI with MongoDB Atlas for persistent storage across restarts.');
  } catch (embeddedErr) {
    dbStatus = {
      connected: false,
      isVolatile: false,
      storageType: 'Failed',
      sanitizedUri: '',
      connectedAt: null,
      error: embeddedErr.message,
    };
    console.error('❌ [Database] Failed to initialize embedded MongoDB:', embeddedErr.message);
    throw embeddedErr;
  }
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
      mongoMemoryServer = null;
    }
    dbStatus.connected = false;
    dbStatus.storageType = 'Disconnected';
    console.log('[Database] Disconnected cleanly.');
  } catch (err) {
    console.error('[Database] Disconnect error:', err);
  }
}
