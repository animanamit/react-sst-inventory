import Redis from 'ioredis';

// Cache for Redis clients to avoid creating multiple connections
const clients: { [key: string]: Redis } = {};

/**
 * Get a Redis client instance for the specified endpoint
 * This function maintains a connection pool to avoid creating new connections unnecessarily
 */
export function getRedisClient(options: {
  host?: string;
  port?: number;
  password?: string;
  keyPrefix?: string;
  tls?: boolean;
}): Redis {
  // Get Redis connection details from environment or provided options
  const host = options.host || process.env.REDIS_HOST || 'localhost';
  const port = options.port || parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = options.password || process.env.REDIS_PASSWORD;
  const tls = options.tls || process.env.REDIS_TLS === 'true';
  const keyPrefix = options.keyPrefix || process.env.REDIS_KEY_PREFIX || 'inventory:';
  
  // Create a unique identifier for this connection configuration
  const clientKey = `${host}:${port}:${keyPrefix}`;
  
  // Return existing client if already created
  if (clients[clientKey]) {
    return clients[clientKey];
  }
  
  // Create connection options
  const redisOptions = {
    host,
    port,
    keyPrefix,
    retryStrategy(times: number) {
      const maxRetryTime = 3000; // 3 seconds
      const retryTime = Math.min(times * 50, maxRetryTime);
      return retryTime;
    },
    // If password is provided, use it
    ...(password && { password }),
    // If TLS is enabled, use it
    ...(tls && { tls: { rejectUnauthorized: false } })
  };
  
  try {
    // Create a new Redis client
    const client = new Redis(redisOptions);
    
    // Set up connection and error event handlers
    client.on('connect', () => {
      console.log(`Redis connected to ${host}:${port}`);
    });
    
    client.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
    
    client.on('close', () => {
      console.log(`Redis connection to ${host}:${port} closed`);
      // Remove client from cache when connection is closed
      delete clients[clientKey];
    });
    
    // Store in cache for reuse
    clients[clientKey] = client;
    
    return client;
  } catch (error) {
    console.error('Failed to create Redis client:', error);
    throw error;
  }
}

/**
 * Gracefully shut down all Redis connections
 */
export async function closeAllRedisConnections(): Promise<void> {
  const closePromises = Object.values(clients).map(client => client.quit());
  await Promise.all(closePromises);
  
  // Clear the client cache
  Object.keys(clients).forEach(key => {
    delete clients[key];
  });
}

/**
 * Cache item with expiry
 * @param key Cache key
 * @param data Data to cache (will be JSON stringified)
 * @param ttlSeconds Time to live in seconds
 */
export async function setCache<T>(client: Redis, key: string, data: T, ttlSeconds = 3600): Promise<void> {
  try {
    const serialized = JSON.stringify(data);
    if (ttlSeconds > 0) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
  } catch (error) {
    console.error(`Error setting cache for ${key}:`, error);
    // Don't throw - caching errors shouldn't break the application
  }
}

/**
 * Retrieve cached item
 * @param key Cache key
 * @returns The cached data or null if not found
 */
export async function getCache<T>(client: Redis, key: string): Promise<T | null> {
  try {
    const data = await client.get(key);
    if (!data) return null;
    
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`Error getting cache for ${key}:`, error);
    return null;
  }
}

/**
 * Delete cached item
 * @param key Cache key or pattern (with *)
 */
export async function deleteCache(client: Redis, key: string): Promise<void> {
  try {
    // If key contains wildcard, use scan to delete matching keys
    if (key.includes('*')) {
      // Get all matching keys
      let cursor = '0';
      do {
        // SCAN for matching keys
        const result = await client.scan(cursor, 'MATCH', key, 'COUNT', 100);
        cursor = result[0];
        const keys = result[1];
        
        if (keys.length > 0) {
          // Delete all found keys
          await client.del(...keys);
        }
      } while (cursor !== '0');
    } else {
      // Simple key delete
      await client.del(key);
    }
  } catch (error) {
    console.error(`Error deleting cache for ${key}:`, error);
    // Don't throw - caching errors shouldn't break the application
  }
}

/**
 * Check if Redis is operational by performing a simple ping
 */
export async function pingRedis(client: Redis): Promise<boolean> {
  try {
    const response = await client.ping();
    return response === 'PONG';
  } catch (error) {
    console.error('Redis ping failed:', error);
    return false;
  }
}