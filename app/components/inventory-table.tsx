import React, {
  useState,
  useTransition,
  useDeferredValue,
  useEffect,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "~/lib/api";
import {
  MagnifyingGlassIcon as SearchIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { InventoryTableRow } from "./inventory-table-row";
import type { Product } from "./inventory-table-row";
import { seedDatabase } from "~/lib/seed-utils";

interface InventoryTableProps {
  products: Product[];
  isLoading: boolean;
  isError: boolean;
  refetchProducts: () => void;
  refetchInventory: () => void;
  alertRefetchFunctions: {
    refetchActive: () => void;
    refetchHistory: () => void;
  };
}

export function InventoryTable({
  products,
  isLoading,
  isError,
  refetchProducts,
  refetchInventory,
  alertRefetchFunctions,
}: InventoryTableProps) {
  // For managing the search input
  const [searchQuery, setSearchQuery] = useState("");

  // Use useDeferredValue for a more responsive UI during filtering
  // This creates a "delayed" version of the search query that won't block the UI
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Status indicator for when the deferred value is different from the current input
  const [isSearchPending, setIsSearchPending] = useState(false);

  // Track which product is being adjusted
  const [adjustingProduct, setAdjustingProduct] = useState<{
    id: string;
    direction: "increase" | "decrease";
  } | null>(null);

  // Check if the deferred value is different from the current input
  useEffect(() => {
    setIsSearchPending(deferredSearchQuery !== searchQuery);
  }, [deferredSearchQuery, searchQuery]);

  // Query client for invalidating queries after mutations
  const queryClient = useQueryClient();

  // Refetch both data sources
  const refetch = () => {
    refetchProducts();
    refetchInventory();

    // Also refetch alerts if needed
    alertRefetchFunctions.refetchActive();
    alertRefetchFunctions.refetchHistory();
  };

  // Response type for adjustStock API
  interface AdjustStockResponse {
    message: string;
    inventory: {
      productId: string;
      locationId: string;
      previousStock: number;
      currentStock: number;
      changeAmount: number;
      updatedAt: number;
    };
    alert?: any;
  }

  // Handler for stock adjustment buttons
  const handleStockAdjustment = async (
    productId: string,
    changeAmount: number,
    productName: string
  ) => {
    try {
      // Set loading state
      setAdjustingProduct({
        id: productId,
        direction: changeAmount > 0 ? "increase" : "decrease",
      });

      // Get the product to check minThreshold and current stock
      const product = products.find((p) => p.productId === productId);

      if (product) {
        // Predict if this will trigger an alert
        const newStockLevel = product.totalStock + changeAmount;

        // Call the API
        const data = (await api.inventory.adjustStock({
          productId: productId,
          changeAmount: changeAmount,
          reason:
            changeAmount > 0
              ? "Stock increased via dashboard"
              : "Stock decreased via dashboard",
        })) as AdjustStockResponse;

        // Invalidate queries to refetch data
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["alerts"] });

        // Refetch data to ensure UI is updated
        refetch();
        alertRefetchFunctions.refetchActive();
        alertRefetchFunctions.refetchHistory();

        // Show appropriate toast
        if (changeAmount > 0) {
          toast.success(`Stock increased for ${productName}`);
        } else {
          toast.success(`Stock decreased for ${productName}`);

          // Only show warning if we just dropped below threshold with this change
          // and an alert was actually created (included in the response)
          const previousStock = data.inventory?.previousStock || 0;
          const currentStock = data.inventory?.currentStock || 0;
          const alertCreated = data.alert && data.alert.alertId;

          if (
            product &&
            currentStock < product.minThreshold &&
            previousStock >= product.minThreshold &&
            alertCreated
          ) {
            toast.warning(
              `Stock for ${productName} is now below threshold! Alert created.`,
              {
                id: `low-stock-alert-${data.alert.alertId}`, // Use ID to prevent duplicate toasts
                duration: 5000,
              }
            );

            // Ensure the alerts panel is updated
            setTimeout(() => {
              alertRefetchFunctions.refetchActive();
            }, 500);
          }
        }
      }
    } catch (error) {
      console.error("Error adjusting stock:", error);
      toast.error("Failed to adjust stock. Please try again.");
    } finally {
      // Clear loading state
      setAdjustingProduct(null);
    }
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Update the search input immediately - the UI remains responsive
    // because the expensive filtering operation will happen with the deferred value
    setSearchQuery(e.target.value);
  };

  // Filter products based on the deferred search query to avoid blocking the UI
  // By using useDeferredValue, React will prioritize keeping the UI responsive
  // while the filtering happens in the background
  const getFilteredProducts = () => {
    if (!deferredSearchQuery) return products;

    return products.filter(
      (product) =>
        product.name
          .toLowerCase()
          .includes(deferredSearchQuery.toLowerCase()) ||
        product.description
          .toLowerCase()
          .includes(deferredSearchQuery.toLowerCase()) ||
        (product.category &&
          product.category
            .toLowerCase()
            .includes(deferredSearchQuery.toLowerCase())) ||
        (product.sku &&
          product.sku.toLowerCase().includes(deferredSearchQuery.toLowerCase()))
    );
  };

  // Get filtered products using the deferred search query
  const filteredProducts = getFilteredProducts();

  // Wire up the search box from the dashboard
  useEffect(() => {
    const searchInput = document.getElementById('inventory-search') as HTMLInputElement;
    if (searchInput) {
      const handler = (e: Event) => {
        setSearchQuery((e.target as HTMLInputElement).value);
      };
      searchInput.addEventListener('input', handler);
      searchInput.value = searchQuery; // Initialize value
      
      return () => {
        searchInput.removeEventListener('input', handler);
      };
    }
  }, []);

  return (
    <div>
      <Table className="border-collapse">
          <TableHeader>
            <TableRow className="border-b border-gray-200">
              <TableHead className="py-4 font-semibold text-gray-700">Product</TableHead>
              <TableHead className="py-4 font-semibold text-gray-700">Current Stock</TableHead>
              <TableHead className="py-4 font-semibold text-gray-700">Threshold</TableHead>
              <TableHead className="py-4 font-semibold text-gray-700">Status</TableHead>
              <TableHead className="py-4 font-semibold text-gray-700">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Loading inventory data...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-red-600"
                >
                  Error loading products. Please try again.
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  {searchQuery
                    ? "No products match your search criteria."
                    : "No products found. Add some using the 'Add Item' button or seed mock data."}
                </TableCell>
              </TableRow>
            ) : (
              // Use the new memoized row component
              filteredProducts.map((product) => (
                <InventoryTableRow
                  key={product.productId}
                  product={product}
                  onStockAdjustment={handleStockAdjustment}
                  isAdjusting={adjustingProduct !== null}
                  adjustingProductId={adjustingProduct?.id}
                  adjustingDirection={adjustingProduct?.direction}
                  onThresholdUpdated={refetch}
                />
              ))
            )}
          </TableBody>
        </Table>
    </div>
  );
}
