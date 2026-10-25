import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoMemoryServer = null;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      const sanitizedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
      console.log(`[Database] Connecting to configured MongoDB: ${sanitizedUri}`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log('✅ [Database] Connected to external MongoDB successfully.');
      return;
    } catch (err) {
      console.error('❌ [Database] Configured MongoDB (MONGODB_URI) connection failed:', err.message);
      console.warn('⚠️ [Database] Falling back to embedded MongoMemoryServer...');
    }
  }

  // Attempt local MongoDB standard port first
  try {
    const localUri = 'mongodb://127.0.0.1:27017/sitesentry';
    console.log('[Database] Checking local MongoDB at', localUri);
    await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2000 });
    console.log('✅ [Database] Connected to local MongoDB instance.');
    return;
  } catch {
    console.log('[Database] Local MongoDB not detected. Starting high-performance embedded MongoMemoryServer...');
  }

  // Fallback to MongoMemoryServer
  try {
    mongoMemoryServer = await MongoMemoryServer.create();
    const memoryUri = mongoMemoryServer.getUri();
    await mongoose.connect(memoryUri);
    console.log(`✅ [Database] Connected to embedded MongoDB successfully at: ${memoryUri}`);
  } catch (embeddedErr) {
    console.error('❌ [Database] Failed to initialize embedded MongoDB:', embeddedErr.message);
    throw embeddedErr;
  }
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
    }
    console.log('[Database] Disconnected cleanly.');
  } catch (err) {
    console.error('[Database] Disconnect error:', err);
  }
}
