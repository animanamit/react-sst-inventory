/**
 * Suspense-compatible data fetching utilities
 * 
 * This file provides a simple resource cache implementation that works
 * with React Suspense for data fetching.
 */

// Simple cache implementation for Suspense resources
type Status = 'pending' | 'success' | 'error';
type Cache = Map<string, Resource<any>>;
let globalCache: Cache = new Map();

// Resource interface with a read method
interface Resource<T> {
  read(): T;
}

// Clear cache
export function clearCache() {
  globalCache = new Map();
}

// Create a resource cache
export function createResource<T>(
  key: string,
  fetcher: () => Promise<T>
): Resource<T> {
  // Check if we already have this resource in cache
  if (globalCache.has(key)) {
    return globalCache.get(key) as Resource<T>;
  }

  // Otherwise create a new resource
  let status: Status = 'pending';
  let result: T | Error;
  let suspender = fetcher().then(
    (data) => {
      status = 'success';
      result = data;
    },
    (error) => {
      status = 'error';
      result = error instanceof Error ? error : new Error(String(error));
    }
  );

  // Create the resource object
  const resource: Resource<T> = {
    read() {
      // If we're still pending, throw the promise
      if (status === 'pending') {
        throw suspender;
      }
      // If we have an error, throw it
      else if (status === 'error') {
        throw result as Error;
      }
      // Otherwise return the data
      else {
        return result as T;
      }
    }
  };

  // Store in cache and return
  globalCache.set(key, resource);
  return resource;
}

// Fetch product details with cache
export function fetchProductDetails(productId: string) {
  return createResource(`product-${productId}`, () => 
    fetch(`${import.meta.env.VITE_API_URL}/products/${productId}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch product');
        }
        return res.json();
      })
  );
}

// Fetch product inventory with cache
export function fetchProductInventory(productId: string) {
  return createResource(`inventory-${productId}`, () => 
    fetch(`${import.meta.env.VITE_API_URL}/inventory/${productId}/main`)
      .then(res => {
        if (!res.ok) {
          return { currentStock: 0 }; // Default if not found
        }
        return res.json();
      })
  );
}