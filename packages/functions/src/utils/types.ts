import { z } from "zod";
import { ulid } from "ulid";

// Inventory Item schema
export const InventoryItemSchema = z.object({
  productId: z.string().optional().default(() => ulid()),
  locationId: z.string().default("main"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  currentStock: z.number().int().min(0, "Stock must be a positive number"),
  minThreshold: z.number().int().min(1, "Threshold must be at least 1"),
  imageUrl: z.string().optional(),
  createdAt: z.number().optional().default(() => Date.now()),
  updatedAt: z.number().optional().default(() => Date.now()),
});

export type InventoryItem = z.infer<typeof InventoryItemSchema>;

// Inventory Update schema (partial)
export const InventoryUpdateSchema = InventoryItemSchema.partial().required({
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