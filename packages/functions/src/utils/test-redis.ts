import {
  getRedisClient,
  setCache,
  getCache,
  deleteCache,
  pingRedis,
  closeAllRedisConnections
} from './redis';

/**
 * A simple test script for Redis functionality
 * This can be run as a Lambda handler for testing Redis connection and operations
 */
export const handler = async (event: any) => {
  // Initialize result object
  const results: any = {
    connection: false,
    operations: {
      set: false,
      get: false,
      delete: false,
      pattern: false
    },
    errors: []
  };

  // Get a Redis client
  let client;
  try {
    // Get Redis options from environment or event
    const redisOptions = {
      host: process.env.REDIS_HOST || event?.host,
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : (event?.port ? parseInt(event.port, 10) : undefined),
      password: process.env.REDIS_PASSWORD || event?.password,
      keyPrefix: process.env.REDIS_KEY_PREFIX || event?.keyPrefix || 'test:',
      tls: process.env.REDIS_TLS === 'true' || event?.tls === true
    };

    // Log connection attempt
    console.log(`Attempting to connect to Redis at ${redisOptions.host}:${redisOptions.port}`);
    
    // Get Redis client
    client = getRedisClient(redisOptions);
    
    // Test connection with ping
    const pingResult = await pingRedis(client);
    results.connection = pingResult;
    console.log(`Redis connection test: ${pingResult ? 'SUCCESS' : 'FAILED'}`);
    
    if (!pingResult) {
      throw new Error('Redis ping failed');
    }
    
    // Test basic operations
    // 1. Set a value
    const testKey = 'test-key';
    const testValue = {
      timestamp: Date.now(),
      message: 'This is a test value',
      nested: {
        field: 'nested-value',
        array: [1, 2, 3]
      }
    };
    
    await setCache(client, testKey, testValue, 60);
    results.operations.set = true;
    console.log('Set operation: SUCCESS');
    
    // 2. Get the value back
    const retrievedValue = await getCache<typeof testValue>(client, testKey);
    results.operations.get = retrievedValue !== null;
    console.log(`Get operation: ${results.operations.get ? 'SUCCESS' : 'FAILED'}`);
    
    if (retrievedValue) {
      console.log('Retrieved value matches original:', 
        JSON.stringify(retrievedValue) === JSON.stringify(testValue));
    }
    
    // 3. Set multiple values with a pattern
    await setCache(client, 'test-pattern:1', { id: 1, name: 'Item 1' }, 60);
    await setCache(client, 'test-pattern:2', { id: 2, name: 'Item 2' }, 60);
    await setCache(client, 'test-pattern:3', { id: 3, name: 'Item 3' }, 60);
    console.log('Set pattern values: SUCCESS');
    
    // 4. Delete a pattern
    await deleteCache(client, 'test-pattern:*');
    
    // Verify pattern deletion
    const item1 = await getCache(client, 'test-pattern:1');
    const item2 = await getCache(client, 'test-pattern:2');
    const item3 = await getCache(client, 'test-pattern:3');
    
    results.operations.pattern = item1 === null && item2 === null && item3 === null;
    console.log(`Pattern deletion: ${results.operations.pattern ? 'SUCCESS' : 'FAILED'}`);
    
    // 5. Delete a single key
    await deleteCache(client, testKey);
    const deletedValue = await getCache(client, testKey);
    results.operations.delete = deletedValue === null;
    console.log(`Delete operation: ${results.operations.delete ? 'SUCCESS' : 'FAILED'}`);
    
  } catch (error) {
    console.error('Error in Redis test:', error);
    results.errors.push(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    // Close all Redis connections
    if (client) {
      try {
        await closeAllRedisConnections();
        console.log('Redis connections closed successfully');
      } catch (closeError) {
        console.error('Error closing Redis connections:', closeError);
        results.errors.push('Error closing connections: ' + 
          (closeError instanceof Error ? closeError.message : 'Unknown error'));
      }
    }
  }
  
  // Calculate overall success
  results.success = results.connection && 
    Object.values(results.operations).every(Boolean) && 
    results.errors.length === 0;
  
  return {
    statusCode: results.success ? 200 : 500,
    body: JSON.stringify(results, null, 2)
  };
};