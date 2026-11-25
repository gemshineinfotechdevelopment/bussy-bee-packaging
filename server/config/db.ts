import mongoose from 'mongoose';
import dns from 'dns';

// Fix for querySrv ECONNREFUSED on local ISP / Windows DNS
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch {
  // Ignore if not supported in environment
}

export const connectDB = async (retryCount = 0): Promise<void> => {
  let uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/bussy_bee';

  // Strip accidental angle brackets from connection strings if present
  if (uri.includes('<') && uri.includes('>')) {
    uri = uri.replace(/<([^>]+)>/g, '$1');
  }

  // Ensure DB name is explicitly set for Atlas if needed
  if (uri.includes('cluster0.txhuc3s.mongodb.net/?')) {
    uri = uri.replace('cluster0.txhuc3s.mongodb.net/?', 'cluster0.txhuc3s.mongodb.net/bussy_bee?');
  }

  const isLocal = uri.includes('127.0.0.1') || uri.includes('localhost');

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log(`=============================================`);
    console.log(`[Database] MongoDB (${isLocal ? 'Local VPS' : 'Cloud/Atlas'}) Connected Successfully!`);
    console.log(`[Database Host] ${conn.connection.host}`);
    console.log(`[Database Name] ${conn.connection.name}`);
    console.log(`=============================================`);
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB (Attempt ${retryCount + 1}):`, error);
    if (retryCount < 5) {
      console.log(`[Database] Retrying connection in 3 seconds...`);
      setTimeout(() => connectDB(retryCount + 1), 3000);
    }
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[Database] MongoDB disconnected. Attempting reconnection...');
});

mongoose.connection.on('error', (err: any) => {
  console.error('[Database Error] MongoDB connection error:', err);
});

