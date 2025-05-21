/**
 * API client for connecting to the backend services
 */

// Base API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || "";

// Get credentials configuration based on environment (omit for CORS with '*' origins)
const CREDENTIALS = "omit" as const;

// Import advanced types
import type {
  Product,
  Inventory,
  Alert,
  InventoryHistory,
  ProductCreateInput,
  ProductUpdateInput,
  StockAdjustmentInput,
  ApiResponse,
  ProductResponse,
  StockAdjustmentResponse,
  ProductId,
  LocationId,
  AlertId,
} from "./types";
// Import non-type imports separately
import { isApiResponse } from "./types";

// Type for HTTP methods
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

// Type for optional fetch parameters with better type safety
type FetchOptions = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  credentials?: RequestCredentials;
};

/**
 * Create fetch options with appropriate headers and serialized body
 */
const createFetchOptions = (options: FetchOptions = {}) => {
  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: options.credentials || CREDENTIALS,
    mode: "cors" as RequestMode,
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  return fetchOptions;
};

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Base fetch function with error handling and improved type safety
 * @typeParam T - The expected response data type
 * @param url - API endpoint URL (without base URL)
 * @param options - Fetch options
 * @returns Promise resolving to response data of type T
 * @throws ApiError when request fails
 */
const fetchWithErrorHandling = async <T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> => {
  try {
    // Ensure API_URL is set
    if (!API_URL) {
      throw new Error("API URL is not configured");
    }

    // Create full URL and fetch options
    const fullUrl = `${API_URL}${url}`;
    const fetchOptions = createFetchOptions(options);

    // Make the request
    const response = await fetch(fullUrl, fetchOptions);

    // Parse the response
    let data: unknown;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    // Handle unsuccessful responses
    if (!response.ok) {
      const errorMessage =
        isApiResponse(data) && typeof data.error === "string"
          ? data.error
          : `API Error: ${response.status} ${response.statusText}`;

      throw new ApiError(errorMessage, response.status, data);
    }

    // Validate the response type if possible with a type guard
    if (isApiResponse(data)) {
      if (!data.success) {
        throw new ApiError(
          data.error || "API returned error status",
          response.status,
          data
        );
      }

      // For ApiResponse types, extract the data property
      return (data.data as T) || (data as unknown as T);
    }

    return data as T;
  } catch (error) {
    // Re-throw ApiErrors
    if (error instanceof ApiError) {
      throw error;
    }

    // Convert other errors to ApiError
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    throw new ApiError(message, 500);
  }
};

/**
 * API client object with methods for different endpoints
 */
export const api = {
  /**
   * Product-related API methods with strong typing
   */
  products: {
    /**
     * Get all products with optional inventory data
     * @param category - Optional category filter
     * @returns Promise resolving to array of products
     */
    getAll: async (category?: string): Promise<Product[]> => {
      const url = category
        ? `/products?category=${encodeURIComponent(category)}`
        : "/products";
      return fetchWithErrorHandling<Product[]>(url);
    },

    /**
     * Get a specific product by ID
     * @param productId - ID of the product to fetch
     * @returns Promise resolving to product data
     */
    getProduct: async (productId: string): Promise<Product> => {
      return fetchWithErrorHandling<Product>(`/products/${productId}`);
    },

    /**
     * Create a new product
     * @param product - Product data to create
     * @returns Promise resolving to API response with product data
     */
    create: async (product: ProductCreateInput): Promise<ProductResponse> => {
      return fetchWithErrorHandling<ProductResponse>("/products", {
        method: "POST",
        body: product,
      });
    },

    /**
     * Update an existing product
     * @param product - Product data to update (must include productId)
     * @returns Promise resolving to API response with updated product data
     */
    update: async (product: ProductUpdateInput): Promise<ProductResponse> => {
      return fetchWithErrorHandling<ProductResponse>(
        `/products/${product.productId}`,
        {
          method: "PUT",
          body: product,
        }
      );
    },

    /**
     * Create or update a product (deprecated, use create/update instead)
     * @deprecated Use create or update instead for better type safety
     */
    createOrUpdate: async (
      product: Partial<Product>
    ): Promise<ProductResponse> => {
      return fetchWithErrorHandling<ProductResponse>("/products", {
        method: "POST",
        body: product,
      });
    },

    /**
     * Seed the database with mock product data (development only)
     * @param options - Seeding options
     * @returns Promise resolving to API response
     */
    seedMockData: async (
      options = { clearExisting: false }
    ): Promise<ApiResponse> => {
      return fetchWithErrorHandling<ApiResponse>("/products/seed", {
        method: "POST",
        body: options,
      });
    },
  },

  /**
   * Inventory-related API methods
   */
  inventory: {
    /**
     * Get all inventory items
     * @deprecated Use products.getAll() instead which includes inventory data
     */
    getAll: async () => {
      return fetchWithErrorHandling("/inventory");
    },

    /**
     * Get inventory for a specific product and location
     */
    getItem: async (productId: string, locationId: string = "main") => {
      return fetchWithErrorHandling(`/inventory/${productId}/${locationId}`);
    },

    /**
     * Create or update an inventory item
     * @deprecated Use products.createOrUpdate() and inventory.adjustStock() instead
     */
    createOrUpdate: async (inventoryItem: any) => {
      return fetchWithErrorHandling("/inventory", {
        method: "POST",
        body: inventoryItem,
      });
    },

    /**
     * Adjust the stock level of an inventory item
     */
    adjustStock: async (adjustment: {
      productId: string;
      locationId?: string;
      changeAmount: number;
      reason: string;
      userId?: string;
    }) => {
      return fetchWithErrorHandling("/inventory", {
        method: "POST",
        body: adjustment,
      });
    },

    /**
     * Get history for a specific inventory item
     */
    getHistory: async (productId: string) => {
      return fetchWithErrorHandling(`/inventory/history/${productId}`);
    },
  },

  /**
   * Utility function to generate a pre-signed URL for S3 uploads
   */
  getUploadUrl: async (fileName: string, contentType: string) => {
    const params = new URLSearchParams({
      fileName,
      contentType,
    });

    const response = await fetchWithErrorHandling<{
      uploadUrl: string;
      fileUrl: string;
    }>(`/uploads/presigned-url?${params.toString()}`);

    return response;
  },

  /**
   * Upload a file using a pre-signed URL
   */
  uploadFile: async (url: string, file: File): Promise<string> => {
    // Upload the file directly to S3 using the pre-signed URL
    const response = await fetch(url, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    if (!response.ok) {
      throw new ApiError("Failed to upload file", response.status);
    }

    // Return the URL without the query parameters
    return url.split("?")[0];
  },

  /**
   * Alert-related API methods
   */
  alerts: {
    /**
     * Get all alerts with optional filters
     */
    getAll: async (status?: string) => {
      const url = status
        ? `/alerts?status=${encodeURIComponent(status)}`
        : "/alerts";
      return fetchWithErrorHandling(url);
    },

    /**
     * Get a specific alert by ID
     */
    getById: async (alertId: string) => {
      return fetchWithErrorHandling(`/alerts/${alertId}`);
    },

    /**
     * Acknowledge an alert
     */
    acknowledge: async (alertId: string, userId?: string) => {
      return fetchWithErrorHandling(`/alerts/${alertId}/acknowledge`, {
        method: "PUT",
        body: { userId: userId || "system" },
      });
    },

    /**
     * Create an alert directly
     */
    create: async (alertData: {
      productId: string;
      locationId?: string;
      alertType: string;
      threshold: number;
      currentStock: number;
      status?: string;
    }) => {
      return fetchWithErrorHandling(`/alerts`, {
        method: "POST",
        body: {
          ...alertData,
          locationId: alertData.locationId || "main",
          status: alertData.status || "NEW",
        },
      });
    },

    /**
     * Create alerts for all current conditions
     */
    checkAndCreateAll: async () => {
      return fetchWithErrorHandling(`/alerts/check-all`, {
        method: "POST",
      });
    },
  },

  /**
   * Debug helper functions
   */
  debug: {
    /**
     * Get the current state of all database tables
     */
    getDbState: async () => {
      return fetchWithErrorHandling("/debug");
    },
  },
};
