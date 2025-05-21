/**
 * Advanced TypeScript types for the Inventory Management System
 * 
 * This file contains all the core types used throughout the application,
 * leveraging advanced TypeScript patterns for better type safety and developer experience.
 */

// -------------------------------------------------------
// Utility Types
// -------------------------------------------------------

/**
 * Make specific properties required in a type
 */
export type RequireProps<T, K extends keyof T> = T & { [P in K]-?: T[P] };

/**
 * Make all properties in an object readonly
 */
export type Immutable<T> = {
  readonly [K in keyof T]: T[K];
};

/**
 * Make deep readonly (recursive)
 */
export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? DeepReadonly<T[K]>
    : T[K];
};

/**
 * Filter object properties by value type
 */
export type FilterProps<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K]
};

/**
 * Record where the values must be of type T
 */
export type TypedRecord<K extends string | number | symbol, T> = {
  [P in K]: T;
};

// -------------------------------------------------------
// Branded Types (nominal types)
// -------------------------------------------------------

/**
 * Branded type utility - creates a new type that's
 * incompatible with the original type, preventing mix-ups
 */
export type Brand<K, T> = T & { __brand: K };

// Create branded types for IDs to prevent mixing different types of IDs
export type ProductId = Brand<'ProductId', string>;
export type LocationId = Brand<'LocationId', string>;
export type AlertId = Brand<'AlertId', string>;
export type HistoryId = Brand<'HistoryId', string>;

// Creator functions that help ensure correct types
export const createProductId = (id: string): ProductId => id as ProductId;
export const createLocationId = (id: string): LocationId => id as LocationId;
export const createAlertId = (id: string): AlertId => id as AlertId;
export const createHistoryId = (id: string): HistoryId => id as HistoryId;

// -------------------------------------------------------
// Discriminated Unions
// -------------------------------------------------------

// Status type for requests
export type RequestStatus = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success', data: unknown }
  | { status: 'error', error: Error };

// Alert types
export type AlertType = 'LOW' | 'HIGH';
export type AlertStatus = 'NEW' | 'PROCESSING' | 'SENT' | 'ACKNOWLEDGED';

// Stock change action
export type StockAction = 
  | { type: 'increase', amount: number, reason: string }
  | { type: 'decrease', amount: number, reason: string }
  | { type: 'set', amount: number, reason: string };

// -------------------------------------------------------
// Core Domain Types
// -------------------------------------------------------

/**
 * Product interface - represents a product in the inventory
 */
export interface Product {
  productId: ProductId;
  name: string;
  description: string;
  category?: string;
  sku?: string;
  imageUrl?: string;
  minThreshold: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Inventory interface - tracks the stock of a product at a location
 */
export interface Inventory {
  productId: ProductId;
  locationId: LocationId;
  currentStock: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * InventoryHistory - records changes to inventory
 */
export interface InventoryHistory {
  historyId: HistoryId;
  productId: ProductId;
  locationId: LocationId;
  changeAmount: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  userId?: string;
  timestamp: number;
}

/**
 * Alert - notification for inventory conditions
 */
export interface Alert {
  alertId: AlertId;
  productId: ProductId;
  locationId: LocationId;
  alertType: AlertType;
  threshold: number;
  currentStock: number;
  status: AlertStatus;
  createdAt: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Product with inventory information combined - for display
 */
export interface ProductWithInventory extends Product {
  totalStock: number;
  locations?: InventoryLocation[];
}

/**
 * Location with stock information
 */
export interface InventoryLocation {
  locationId: LocationId;
  name: string;
  currentStock: number;
}

// -------------------------------------------------------
// Input/Form types for creating/updating
// -------------------------------------------------------

/**
 * Product creation input
 */
export type ProductCreateInput = Omit<Product, 'productId' | 'createdAt' | 'updatedAt'>;

/**
 * Product update input
 */
export type ProductUpdateInput = RequireProps<Partial<Product>, 'productId'>;

/**
 * Stock adjustment input
 */
export interface StockAdjustmentInput {
  productId: ProductId;
  locationId?: LocationId;
  changeAmount: number;
  reason: string;
  userId?: string;
}

// -------------------------------------------------------
// API Response Types
// -------------------------------------------------------

/**
 * Generic API response interface
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Product API response
 */
export interface ProductResponse extends ApiResponse {
  data?: {
    product: Product;
  };
}

/**
 * Stock adjustment API response
 */
export interface StockAdjustmentResponse extends ApiResponse {
  data?: {
    inventory: Inventory;
    history: InventoryHistory;
    alert?: Alert;
  };
}

// -------------------------------------------------------
// Type Guards
// -------------------------------------------------------

/**
 * Type guard for product interface
 */
export function isProduct(obj: unknown): obj is Product {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'productId' in obj &&
    'name' in obj &&
    'description' in obj &&
    'minThreshold' in obj
  );
}

/**
 * Type guard for inventory interface
 */
export function isInventory(obj: unknown): obj is Inventory {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'productId' in obj &&
    'locationId' in obj &&
    'currentStock' in obj
  );
}

/**
 * Type guard for alert interface
 */
export function isAlert(obj: unknown): obj is Alert {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'alertId' in obj &&
    'productId' in obj &&
    'alertType' in obj &&
    'status' in obj
  );
}

/**
 * Type guard for API response
 */
export function isApiResponse<T = unknown>(obj: unknown): obj is ApiResponse<T> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'success' in obj
  );
}