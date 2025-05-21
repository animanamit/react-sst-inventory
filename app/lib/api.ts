/**
 * API client for connecting to the backend services
 */

// Base API URL from environment variables 
const API_URL = import.meta.env.VITE_API_URL || "";
console.log("Using API URL:", API_URL);

// Get credentials configuration based on environment (omit for CORS with '*' origins)
const CREDENTIALS = "omit" as const;

// Type for optional fetch parameters
type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: any;
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
 * Base fetch function with error handling
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
    const data = await response.json().catch(() => null);

    // Handle unsuccessful responses
    if (!response.ok) {
      const errorMessage = data?.error || `API Error: ${response.status} ${response.statusText}`;
      throw new ApiError(errorMessage, response.status, data);
    }

    return data as T;
  } catch (error) {
    // Re-throw ApiErrors
    if (error instanceof ApiError) {
      throw error;
    }

    // Convert other errors to ApiError
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    throw new ApiError(message, 500);
  }
};

/**
 * API client object with methods for different endpoints
 */
export const api = {
  /**
   * Inventory-related API methods
   */
  inventory: {
    /**
     * Get all inventory items
     */
    getAll: async () => {
      return fetchWithErrorHandling("/inventory");
    },

    /**
     * Get a specific inventory item
     */
    getItem: async (productId: string, locationId: string = "main") => {
      return fetchWithErrorHandling(`/inventory/${productId}/${locationId}`);
    },

    /**
     * Create or update an inventory item
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
      contentType
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
};