/**
 * Suspense-compatible data fetching utilities with advanced TypeScript patterns
 * 
 * This file provides a robust resource cache implementation that works
 * with React Suspense for data fetching, with proper typing.
 */

// Discriminated union for resource status
type ResourceStatus<T> = 
  | { status: 'pending'; promise: Promise<void>; data?: never; error?: never }
  | { status: 'success'; promise?: never; data: T; error?: never }
  | { status: 'error'; promise?: never; data?: never; error: Error };

// Define a branded type for cache keys for type safety
type CacheKey = string & { __brand: 'CacheKey' };

// Type-safe cache map
type Cache = Map<CacheKey, Resource<unknown>>;

// Create a singleton cache instance
let globalCache: Cache = new Map();

/**
 * Resource interface with a read method for Suspense
 * Generic type T defines the shape of the data this resource will provide
 */
export interface Resource<T> {
  read(): T;
  preload(): Promise<void>;
  invalidate(): void;
}

/**
 * Create a cache key with the correct type
 */
function createCacheKey(key: string): CacheKey {
  return key as CacheKey;
}

/**
 * Clear the entire resource cache
 */
export function clearCache(): void {
  globalCache = new Map();
}

/**
 * Invalidate specific cache entries by key prefix
 * @param prefix The prefix of cache keys to invalidate
 */
export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of globalCache.keys()) {
    if (key.startsWith(prefix)) {
      globalCache.delete(key);
    }
  }
}

/**
 * Create a resource cache that works with React Suspense
 * 
 * @typeParam T - The type of data this resource will provide
 * @param key - Unique key for caching this resource
 * @param fetcher - Async function that fetches the data
 * @param options - Optional configuration for the resource behavior
 * @returns A resource object with a read method for use with Suspense
 */
export function createResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    /**
     * Time to live in milliseconds, after which the cache expires
     * Set to 0 to disable TTL
     */
    ttl?: number;
    /**
     * Whether to deduplicate in-flight requests
     */
    deduplicate?: boolean;
  } = {}
): Resource<T> {
  // Create cache key with branded type
  const cacheKey = createCacheKey(key);
  
  // Check if we already have this resource in cache
  if (globalCache.has(cacheKey)) {
    const cachedResource = globalCache.get(cacheKey) as Resource<T>;
    return cachedResource;
  }

  // Otherwise create a new resource
  let state: ResourceStatus<T> = {
    status: 'pending',
    promise: fetcher()
      .then(data => {
        state = { status: 'success', data };
        
        // Set cache expiration if TTL is provided
        if (options.ttl && options.ttl > 0) {
          setTimeout(() => {
            // Only invalidate if this entry is still in the cache
            if (globalCache.get(cacheKey) === resource) {
              globalCache.delete(cacheKey);
            }
          }, options.ttl);
        }
      })
      .catch(error => {
        state = { 
          status: 'error', 
          error: error instanceof Error ? error : new Error(String(error))
        };
      })
  };

  // Create the resource object with additional methods
  const resource: Resource<T> = {
    read() {
      // If we're still pending, throw the promise
      if (state.status === 'pending') {
        throw state.promise;
      }
      // If we have an error, throw it
      else if (state.status === 'error') {
        throw state.error;
      }
      // Otherwise return the data
      else {
        return state.data;
      }
    },
    
    // Preload the resource without suspending
    preload(): Promise<void> {
      if (state.status === 'pending') {
        return state.promise;
      }
      return Promise.resolve();
    },
    
    // Manually invalidate this cache entry
    invalidate(): void {
      globalCache.delete(cacheKey);
    }
  };

  // Store in cache and return
  globalCache.set(cacheKey, resource as Resource<unknown>);
  return resource;
}

// Import types
import type { Product, Inventory, ProductWithInventory } from './types';
import { api } from './api';

/**
 * Fetch product details with cache
 * @param productId - Product ID to fetch details for
 * @param options - Optional resource configuration
 * @returns A resource that provides Product data
 */
export function fetchProductDetails(
  productId: string, 
  options: { ttl?: number } = { ttl: 60000 }
): Resource<Product> {
  return createResource<Product>(
    `product-${productId}`, 
    async () => {
      try {
        const product = await api.products.getProduct(productId);
        return product as Product;
      } catch (error) {
        throw new Error(`Failed to fetch product: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    options
  );
}

/**
 * Fetch product inventory with cache
 * @param productId - Product ID to fetch inventory for
 * @param locationId - Optional location ID (defaults to "main")
 * @param options - Optional resource configuration
 * @returns A resource that provides Inventory data
 */
export function fetchProductInventory(
  productId: string, 
  locationId: string = "main",
  options: { ttl?: number } = { ttl: 30000 }
): Resource<Inventory> {
  return createResource<Inventory>(
    `inventory-${productId}-${locationId}`, 
    async () => {
      try {
        const inventory = await api.inventory.getItem(productId, locationId);
        return inventory as Inventory;
      } catch (error) {
        // Return default inventory if not found
        return {
          productId: productId as any,
          locationId: locationId as any,
          currentStock: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      }
    },
    options
  );
}

/**
 * Fetch combined product and inventory data with cache
 * @param productId - Product ID to fetch details for
 * @param options - Optional resource configuration
 * @returns A resource that provides ProductWithInventory data
 */
export function fetchProductWithInventory(
  productId: string,
  options: { ttl?: number } = { ttl: 30000 }
): Resource<ProductWithInventory> {
  return createResource<ProductWithInventory>(
    `product-with-inventory-${productId}`,
    async () => {
      // Fetch product and inventory in parallel
      const [product, inventory] = await Promise.all([
        api.products.getProduct(productId),
        api.inventory.getItem(productId)
      ]);
      
      // Combine the data
      return {
        ...(product as Product),
        totalStock: (inventory as Inventory)?.currentStock || 0,
        locations: [
          {
            locationId: ((inventory as Inventory)?.locationId || "main") as any,
            name: "Main Warehouse",
            currentStock: (inventory as Inventory)?.currentStock || 0
          }
        ]
      };
    },
    options
  );
}

/**
 * Invalidate all product related caches for a specific product
 * @param productId - Product ID to invalidate caches for
 */
export function invalidateProductCaches(productId: string): void {
  invalidateCacheByPrefix(`product-${productId}`);
  invalidateCacheByPrefix(`inventory-${productId}`);
  invalidateCacheByPrefix(`product-with-inventory-${productId}`);
}