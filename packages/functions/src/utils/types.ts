import { z } from "zod";
import { ulid } from "ulid";

// Product schema - static product information
export const ProductSchema = z.object({
  productId: z.string().optional().default(() => ulid()),
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.string().optional(),
  sku: z.string().optional(),
  imageUrl: z.string().optional(),
  minThreshold: z.number().int().min(1, "Threshold must be at least 1"),
  createdAt: z.number().optional().default(() => Date.now()),
  updatedAt: z.number().optional().default(() => Date.now()),
});

export type Product = z.infer<typeof ProductSchema>;

// Product Update schema (partial)
export const ProductUpdateSchema = ProductSchema.partial().required({
  productId: true,
}).extend({
  updatedAt: z.number().default(() => Date.now()),
});

export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;

// Inventory schema - tracks stock levels for products at locations
export const InventorySchema = z.object({
  productId: z.string(),
  locationId: z.string().default("main"),
  currentStock: z.number().int().min(0, "Stock must be a positive number"),
  createdAt: z.number().optional().default(() => Date.now()),
  updatedAt: z.number().optional().default(() => Date.now()),
});

export type Inventory = z.infer<typeof InventorySchema>;

// Inventory Update schema (partial)
export const InventoryUpdateSchema = InventorySchema.partial().required({
  productId: true,
  locationId: true,
}).extend({
  updatedAt: z.number().default(() => Date.now()),
});

export type InventoryUpdateInput = z.infer<typeof InventoryUpdateSchema>;

// Stock adjustment schema
export const StockAdjustmentSchema = z.object({
  productId: z.string(),
  locationId: z.string().default("main"),
  changeAmount: z.number().int(),
  reason: z.string().min(1, "Reason is required"),
  userId: z.string().optional(),
});

export type StockAdjustment = z.infer<typeof StockAdjustmentSchema>;

// Inventory History schema - tracks all stock changes
export const InventoryHistorySchema = z.object({
  historyId: z.string().default(() => ulid()),
  productId: z.string(),
  locationId: z.string().default("main"),
  changeAmount: z.number().int(),
  stockBefore: z.number().int(),
  stockAfter: z.number().int(),
  reason: z.string(),
  userId: z.string().optional(),
  timestamp: z.number().default(() => Date.now()),
});

export type InventoryHistory = z.infer<typeof InventoryHistorySchema>;

// Alert schema
export const AlertSchema = z.object({
  alertId: z.string().default(() => ulid()),
  productId: z.string(),
  locationId: z.string().default("main"),
  alertType: z.enum(["LOW", "HIGH"]),
  threshold: z.number().int(),
  currentStock: z.number().int(),
  status: z.enum(["NEW", "PROCESSING", "SENT", "ACKNOWLEDGED"]).default("NEW"),
  createdAt: z.number().default(() => Date.now()),
  acknowledgedAt: z.number().optional(),
  acknowledgedBy: z.string().optional(),
});

export type Alert = z.infer<typeof AlertSchema>;