import React, { useCallback } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { PlusIcon, MinusIcon } from "@radix-ui/react-icons";

// Define the types for our component props
export interface Product {
  productId: string;
  name: string;
  description: string;
  category?: string;
  sku?: string;
  imageUrl?: string;
  minThreshold: number;
  totalStock: number;
}

export interface InventoryTableRowProps {
  product: Product;
  onStockAdjustment: (
    productId: string,
    changeAmount: number,
    productName: string
  ) => void;
  isAdjusting: boolean;
  adjustingProductId?: string;
  adjustingDirection?: "increase" | "decrease";
}

/**
 * Memoized row component for inventory table to prevent unnecessary re-renders
 * when other rows or parts of the table change.
 */
export const InventoryTableRow = React.memo<InventoryTableRowProps>(
  ({
    product,
    onStockAdjustment,
    isAdjusting,
    adjustingProductId,
    adjustingDirection,
  }) => {
    // Create memoized callbacks for the increase/decrease buttons
    const handleDecrease = useCallback(() => {
      onStockAdjustment(product.productId, -1, product.name);
    }, [product.productId, product.name, onStockAdjustment]);

    const handleIncrease = useCallback(() => {
      onStockAdjustment(product.productId, 1, product.name);
    }, [product.productId, product.name, onStockAdjustment]);

    // Determine if this specific row's decrease button is in loading state
    const isDecreaseLoading =
      isAdjusting &&
      adjustingProductId === product.productId &&
      adjustingDirection === "decrease";

    // Determine if this specific row's increase button is in loading state
    const isIncreaseLoading =
      isAdjusting &&
      adjustingProductId === product.productId &&
      adjustingDirection === "increase";

    return (
      <tr>
        <td>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
              {/* {product.imageUrl && (
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
            )} */}
            </div>
            <div>
              <div className="font-medium">{product.name}</div>
              {product.sku && (
                <div className="text-sm text-gray-500">{product.sku}</div>
              )}
            </div>
          </div>
        </td>
        <td>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleDecrease}
              disabled={isAdjusting || product.totalStock <= 0}
            >
              {isDecreaseLoading ? (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <MinusIcon className="h-4 w-4" />
              )}
            </Button>
            <span className="w-12 text-center font-medium">
              {product.totalStock}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleIncrease}
              disabled={isAdjusting}
            >
              {isIncreaseLoading ? (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <PlusIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </td>
        <td>
          <div className="flex items-center gap-2">
            <span>{product.minThreshold}</span>
          </div>
        </td>
        <td>
          {product.totalStock <= product.minThreshold ? (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1"
            >
              Low Stock
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-green-50 text-green-700 border-green-200"
            >
              In Stock
            </Badge>
          )}
        </td>
        <td>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              Set Threshold
            </Button>
            <Button variant="outline" size="sm">
              History
            </Button>
          </div>
        </td>
      </tr>
    );
  }
);

// Add display name for better debugging
InventoryTableRow.displayName = "InventoryTableRow";
