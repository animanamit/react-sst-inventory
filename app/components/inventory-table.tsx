import React, { useState, useTransition, useDeferredValue, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "~/lib/api";
import { MagnifyingGlassIcon as SearchIcon, PlusIcon } from "@radix-ui/react-icons";
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
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "~/components/ui/card";
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
    direction: 'increase' | 'decrease';
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
        direction: changeAmount > 0 ? 'increase' : 'decrease'
      });

      // Get the product to check minThreshold and current stock
      const product = products.find(
        (p) => p.productId === productId
      );

      if (product) {
        // Predict if this will trigger an alert
        const newStockLevel = product.totalStock + changeAmount;

        // Call the API
        const data = await api.inventory.adjustStock({
          productId: productId,
          changeAmount: changeAmount,
          reason:
            changeAmount > 0
              ? "Stock increased via dashboard"
              : "Stock decreased via dashboard",
        }) as AdjustStockResponse;

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
        product.name.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        (product.category &&
          product.category.toLowerCase().includes(deferredSearchQuery.toLowerCase())) ||
        (product.sku &&
          product.sku.toLowerCase().includes(deferredSearchQuery.toLowerCase()))
    );
  };

  // Get filtered products using the deferred search query
  const filteredProducts = getFilteredProducts();

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <CardTitle>Inventory Items</CardTitle>
            <div className="flex space-x-2">
              <Button variant="default" size="sm" asChild>
                <a href="/product-add">
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Product
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await seedDatabase();

                  // Wait a moment to ensure DB operations are complete
                  setTimeout(() => {
                    // Simply refetch both data sources
                    refetchProducts();
                    refetchInventory();
                  }, 1000);
                }}
                disabled={isLoading || adjustingProduct !== null}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4"
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
                    Loading...
                  </span>
                ) : (
                  "Seed Database"
                )}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    const data = await api.debug.getDbState() as any;
                    
                    // Check for alert conditions
                    let alertConditions = 0;
                    let existingAlerts = 0;
                    let missingAlerts = 0;
                    
                    for (const product of data.items.products) {
                      const inventory = data.items.inventory.find(
                        (i: any) => i.productId === product.productId
                      );
                      if (inventory) {
                        const currentStock = inventory.currentStock;
                        const threshold = product.minThreshold;

                        if (currentStock < threshold) {
                          alertConditions++;
                          // Check if an alert exists for this condition
                          const existingAlert = data.items.alerts.find(
                            (a: any) =>
                              a.productId === product.productId &&
                              a.status === "NEW"
                          );

                          if (existingAlert) {
                            existingAlerts++;
                          } else {
                            missingAlerts++;
                          }
                        }
                      }
                    }

                    toast.success("Database state printed to console", {
                      duration: 5000,
                      style: { background: "#10B981", color: "white" },
                      description: `Found ${data.items.alerts.length} alerts (${existingAlerts} active, ${missingAlerts} missing conditions)`
                    });
                  } catch (error) {
                    console.error("Error getting database state:", error);
                    toast.error("Failed to get database state");
                  }
                }}
              >
                Debug Tables
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  try {
                    // Use the direct API endpoint to check and create all alerts
                    const response = await api.alerts.checkAndCreateAll() as any;

                    // Invalidate alerts queries
                    queryClient.invalidateQueries({ queryKey: ["alerts"] });
                    queryClient.invalidateQueries({
                      queryKey: ["alerts", "active"],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["alerts", "acknowledged"],
                    });

                    // Refresh the UI
                    alertRefetchFunctions.refetchActive();
                    alertRefetchFunctions.refetchHistory();

                    if (response.alerts && response.alerts.length > 0) {
                      toast.success(
                        `Created ${response.alerts.length} alerts`,
                        {
                          description: `Alerts created for products with low stock`,
                          duration: 5000,
                        }
                      );
                    } else {
                      toast.info("No new alerts needed", { duration: 3000 });
                    }
                  } catch (error) {
                    console.error("Error creating alerts:", error);
                    toast.error("Failed to create alerts");
                  }
                }}
              >
                Fix Alerts
              </Button>
            </div>
          </div>
          <div className="relative w-full md:w-64">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search inventory..."
              className="pl-8"
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {isSearchPending && <span className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-500">Filtering...</span>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
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
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}