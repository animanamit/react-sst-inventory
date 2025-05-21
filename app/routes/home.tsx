import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  mockInventoryData,
  sampleActiveAlerts,
  sampleAlertHistory,
} from "~/mock-data";
import {
  PlusIcon,
  MinusIcon,
  GearIcon,
  MagnifyingGlassIcon as SearchIcon,
  ClockIcon,
  ExclamationTriangleIcon as AlertTriangle,
  InfoCircledIcon,
} from "@radix-ui/react-icons";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "~/lib/api";
import { seedDatabase } from "~/lib/seed-utils";
import type { Route } from ".react-router/types/app/routes/+types/home";
import { toast } from "sonner";

const AlertsPanel = ({
  setRefetchFunctions,
}: {
  setRefetchFunctions: (functions: {
    refetchActive: () => void;
    refetchHistory: () => void;
  }) => void;
}) => {
  const [activeTab, setActiveTab] = useState("active");

  // Get the query client for cache invalidation
  const queryClient = useQueryClient();

  // Type for Alert objects
  interface Alert {
    alertId: string;
    productId: string;
    locationId: string;
    alertType: string;
    threshold: number;
    currentStock: number;
    status: string;
    createdAt: number;
    acknowledgedAt?: number;
    acknowledgedBy?: string;
    productName?: string;
    productDescription?: string;
    // Properties for compatibility with mock alerts
    id?: string;
    itemName?: string;
    currentQuantity?: number;
    timestamp?: number;
  }

  // Extract the API URL from the environment for direct fetch calls
  const API_URL = import.meta.env.VITE_API_URL || "";

  // Type for Product objects
  interface Product {
    productId: string;
    name: string;
    description: string;
    category?: string;
    sku?: string;
    imageUrl?: string;
    minThreshold: number;
  }

  // Fetch active alerts (status = NEW)
  const {
    data: activeAlerts = [] as Alert[],
    isLoading: isLoadingActive,
    isError: isErrorActive,
    refetch: refetchActive,
  } = useQuery({
    queryKey: ["alerts", "active"],
    queryFn: async (): Promise<Alert[]> => {
      try {
        const data = (await api.alerts.getAll("NEW")) as Alert[];

        // If we have alert data, join with product data to get names
        if (data && data.length > 0) {
          const products = (await api.products.getAll()) as Product[];

          // Create a map of productId to product name for easy lookup
          const productMap = (products || []).reduce<Record<string, Product>>(
            (acc, product) => {
              acc[product.productId] = product;
              return acc;
            },
            {}
          );

          // Add product name to each alert
          const enhancedAlerts = data.map((alert) => {
            const productDetails = productMap[alert.productId];
            return {
              ...alert,
              productName: productDetails?.name || "Unknown Product",
              productDescription: productDetails?.description || "",
            };
          });

          return enhancedAlerts;
        }

        return data;
      } catch (error) {
        // If there's an error, check the database state to diagnose
        try {
          const dbState = await api.debug.getDbState();

          // Log alerts with NEW status
          const newAlerts = (dbState as any).items.alerts.filter(
            (a: any) => a.status === "NEW"
          );
        } catch (debugError) {
          console.error("Error fetching debug info:", debugError);
        }

        throw error;
      }
    },
    staleTime: 10000, // Reduced to 10 seconds during testing
    refetchOnWindowFocus: true, // Enable refetch on window focus for better testing
  });

  // Fetch acknowledged alerts
  const {
    data: acknowledgedAlerts = [] as Alert[],
    isLoading: isLoadingHistory,
    isError: isErrorHistory,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["alerts", "acknowledged"],
    queryFn: async (): Promise<Alert[]> => {
      try {
        const data = (await api.alerts.getAll("ACKNOWLEDGED")) as Alert[];

        // If we have alert data, join with product data to get names
        if (data && data.length > 0) {
          const products = (await api.products.getAll()) as Product[];

          // Create a map of productId to product name for easy lookup
          const productMap = (products || []).reduce<Record<string, Product>>(
            (acc, product) => {
              acc[product.productId] = product;
              return acc;
            },
            {}
          );

          // Add product name to each alert
          const enhancedAlerts = data.map((alert) => {
            const productDetails = productMap[alert.productId];
            return {
              ...alert,
              productName: productDetails?.name || "Unknown Product",
              productDescription: productDetails?.description || "",
            };
          });

          return enhancedAlerts;
        }

        return data;
      } catch (error) {
        console.error("Error fetching acknowledged alerts:", error);
        throw error;
      }
    },
    staleTime: 10000, // Reduced to 10 seconds during testing
    refetchOnWindowFocus: true, // Enable refetch on window focus for better testing
  });

  // Mutation for acknowledging alerts
  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => {
      return api.alerts.acknowledge(alertId);
    },
    onSuccess: (data) => {
      // Immediately update the cache for immediate UI feedback
      if (data && data.alert && data.alert.alertId) {
        // Update active alerts cache
        const activeQueryKey = ["alerts", "active"];
        const previousActiveData =
          queryClient.getQueryData<Alert[]>(activeQueryKey) || [];
        const newActiveData = previousActiveData.filter(
          (alert) => alert.alertId !== data.alert.alertId
        );
        queryClient.setQueryData(activeQueryKey, newActiveData);

        // Update acknowledged alerts cache by adding the newly acknowledged alert
        const acknowledgedQueryKey = ["alerts", "acknowledged"];
        const previousAcknowledgedData =
          queryClient.getQueryData<Alert[]>(acknowledgedQueryKey) || [];

        // Include the updated alert in the acknowledged list with correct status
        const acknowledgedAlert = {
          ...data.alert,
          status: "ACKNOWLEDGED",
        };

        queryClient.setQueryData(acknowledgedQueryKey, [
          acknowledgedAlert,
          ...previousAcknowledgedData,
        ]);
      }

      // Then invalidate queries to ensure consistency with the server
      queryClient.invalidateQueries({ queryKey: ["alerts", "active"] });
      queryClient.invalidateQueries({ queryKey: ["alerts", "acknowledged"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });

      // Refetch the data after a short delay to allow the server to process the change
      setTimeout(() => {
        refetchActive();
        refetchHistory();
      }, 500);

      // Show success toast
      toast.success("Alert acknowledged successfully");
    },
    onError: (error) => {
      console.error("Error acknowledging alert:", error);
      toast.error("Failed to acknowledge alert. Please try again.");

      // Refetch to ensure UI is consistent with server state
      refetchActive();
      refetchHistory();
    },
  });

  // Handle acknowledging an alert
  const handleAcknowledge = (alertId: string) => {
    acknowledgeMutation.mutate(alertId);
  };

  // Never use mock data - we want to see real alerts or empty state
  const useActiveMockData = false;
  const useHistoryMockData = false;

  // Auto-refresh alerts periodically
  useEffect(() => {
    // Periodically check for new alerts (every 20 seconds)
    const intervalId = setInterval(() => {
      console.log("Auto-refreshing alerts...");
      refetchActive();
    }, 20000);

    // Clear the interval when component unmounts
    return () => clearInterval(intervalId);
  }, [refetchActive]);

  // Function to render active alert items
  const renderActiveAlerts = () => {
    // We're not using mock data anymore, but we'll keep the type handling for clarity
    const alerts = activeAlerts;

    if (isLoadingActive) {
      return (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700"></div>
        </div>
      );
    }

    if (alerts.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No active alerts. All inventory levels are within thresholds.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {alerts.map((alert) => {
          // Create some helper properties to handle both real and mock alerts
          const alertId = alert.alertId || alert.id; // Handle both schema formats
          const productName = alert.productName || alert.itemName;
          const currentStock = alert.currentStock || alert.currentQuantity;
          const timestamp = alert.createdAt || alert.timestamp;

          return (
            <div
              key={alertId}
              className="flex items-start justify-between p-3 border rounded-lg bg-amber-50 border-amber-100"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="font-medium text-amber-800">
                    {productName}
                  </div>
                  <div className="text-sm text-amber-700">
                    Current stock:{" "}
                    <span className="font-medium">{currentStock}</span>{" "}
                    (Threshold: {alert.threshold})
                  </div>
                  <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <ClockIcon className="h-3 w-3" />
                    {formatDistanceToNow(new Date(timestamp), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="bg-white hover:bg-gray-50"
                onClick={() => handleAcknowledge(alertId)}
                disabled={acknowledgeMutation.isPending}
              >
                {acknowledgeMutation.isPending &&
                acknowledgeMutation.variables === alertId ? (
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
                    Acknowledging...
                  </span>
                ) : (
                  "Acknowledge"
                )}
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  // Function to render acknowledged alert items
  const renderAcknowledgedAlerts = () => {
    // We're not using mock data anymore, but we'll keep the type handling for clarity
    const alerts = acknowledgedAlerts;

    if (isLoadingHistory) {
      return (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-700"></div>
        </div>
      );
    }

    if (alerts.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No alert history found.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {alerts.map((alert) => {
          // Create some helper properties to handle both real and mock alerts
          const alertId = alert.alertId || alert.id; // Handle both schema formats
          const productName = alert.productName || alert.itemName;
          const currentStock = alert.currentStock || alert.currentQuantity;
          const timestamp = alert.createdAt || alert.timestamp;
          const acknowledgedAt = alert.acknowledgedAt;

          return (
            <div
              key={alertId}
              className="flex items-start justify-between p-3 border rounded-lg"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <InfoCircledIcon className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <div className="font-medium">{productName}</div>
                  <div className="text-sm text-gray-500">
                    Stock was {currentStock} (Threshold: {alert.threshold})
                  </div>
                  <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <ClockIcon className="h-3 w-3" />
                    {formatDistanceToNow(new Date(timestamp), {
                      addSuffix: true,
                    })}
                  </div>
                  {acknowledgedAt && (
                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      Acknowledged:{" "}
                      {formatDistanceToNow(new Date(acknowledgedAt), {
                        addSuffix: true,
                      })}
                    </div>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="bg-gray-100 text-gray-700">
                Resolved
              </Badge>
            </div>
          );
        })}
      </div>
    );
  };

  // Track previous active alerts count to detect when new alerts appear
  const [prevActiveAlertsCount, setPrevActiveAlertsCount] = useState(0);

  // Effect to detect new alerts and show toast notification
  useEffect(() => {
    // Only check after the data has been loaded, not on initial render
    if (
      !isLoadingActive &&
      activeAlerts.length > prevActiveAlertsCount &&
      prevActiveAlertsCount !== 0
    ) {
      const newAlertsCount = activeAlerts.length - prevActiveAlertsCount;

      // Show a toast notification
      toast.warning(
        `You have ${
          newAlertsCount === 1
            ? "a new inventory alert"
            : `${newAlertsCount} new inventory alerts`
        }`,
        {
          duration: 5000,
          id: `new-alerts-${Date.now()}`,
          description: "Check the alerts panel for details",
          icon: "⚠️",
        }
      );
    }

    // Update the previous count
    setPrevActiveAlertsCount(activeAlerts.length);
  }, [activeAlerts.length, isLoadingActive, prevActiveAlertsCount]);

  // Register refetch functions
  useEffect(() => {
    setRefetchFunctions({
      refetchActive,
      refetchHistory,
    });
  }, [refetchActive, refetchHistory, setRefetchFunctions]);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Inventory Alerts</CardTitle>
            <CardDescription>Monitor and manage stock alerts</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {activeAlerts.length > 0 && !useActiveMockData && (
              <Badge className="bg-red-100 text-red-800 border-red-200">
                {activeAlerts.length} Active
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchActive();
                refetchHistory();
                toast.info("Refreshing alerts...");
              }}
            >
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="active" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="active">Active Alerts</TabsTrigger>
            <TabsTrigger value="history">Alert History</TabsTrigger>
          </TabsList>

          <TabsContent value="active">{renderActiveAlerts()}</TabsContent>

          <TabsContent value="history">
            {renderAcknowledgedAlerts()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

interface InventoryTableProps {
  alertRefetchFunctions: {
    refetchActive: () => void;
    refetchHistory: () => void;
  };
}

const InventoryTable = ({ alertRefetchFunctions }: InventoryTableProps) => {
  // For managing the search input
  const [searchQuery, setSearchQuery] = useState("");

  // Query client for invalidating queries after mutations
  const queryClient = useQueryClient();

  // Types for the data from our API
  interface Product {
    productId: string;
    name: string;
    description: string;
    category?: string;
    sku?: string;
    imageUrl?: string;
    minThreshold: number;
  }

  interface InventoryItem {
    productId: string;
    locationId: string;
    currentStock: number;
  }

  interface ProductWithInventory extends Product {
    totalStock: number;
  }

  // Fetch products data
  const {
    data: productsData = [] as Product[],
    isLoading: isLoadingProducts,
    isError: isProductsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const data = await api.products.getAll();
      return data as Product[];
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch inventory data separately
  const {
    data: inventoryData = [] as InventoryItem[],
    isLoading: isLoadingInventory,
    isError: isInventoryError,
    refetch: refetchInventory,
  } = useQuery({
    queryKey: ["inventory"],
    queryFn: async (): Promise<InventoryItem[]> => {
      const data = await api.debug.getDbState();
      return (data as any).items.inventory as InventoryItem[];
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Simple combine function to merge products with their inventory
  const combinedData: ProductWithInventory[] = productsData.map(
    (product: Product) => {
      // Find matching inventory item
      const inventory = inventoryData.find(
        (item: InventoryItem) => item.productId === product.productId
      );

      return {
        ...product,
        totalStock: inventory ? inventory.currentStock : 0,
      };
    }
  );

  // Simplified loading and error states
  const isLoading = isLoadingProducts || isLoadingInventory;
  const isError = isProductsError || isInventoryError;

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
  }

  // Mutation for adjusting stock levels
  const adjustStockMutation = useMutation<
    AdjustStockResponse,
    Error,
    { productId: string; changeAmount: number; productName: string }
  >({
    mutationFn: (variables) => {
      console.log("Calling adjustStock API with variables:", variables);

      // Get the product to check minThreshold and current stock
      const product = combinedData.find(
        (p) => p.productId === variables.productId
      );

      if (product) {
        console.log("Product details for threshold check:", {
          productId: product.productId,
          name: product.name,
          currentStock: product.totalStock,
          minThreshold: product.minThreshold,
        });

        // Predict if this will trigger an alert
        const newStockLevel = product.totalStock + variables.changeAmount;
        console.log(
          `Stock change prediction: ${product.totalStock} → ${newStockLevel}`
        );

        if (newStockLevel < product.minThreshold) {
          console.log(
            `ALERT SHOULD BE CREATED: ${newStockLevel} is below threshold ${product.minThreshold}`
          );
        } else {
          console.log(
            `NO ALERT NEEDED: ${newStockLevel} is not below threshold ${product.minThreshold}`
          );
        }
      }

      return api.inventory.adjustStock({
        productId: variables.productId,
        changeAmount: variables.changeAmount,
        reason:
          variables.changeAmount > 0
            ? "Stock increased via dashboard"
            : "Stock decreased via dashboard",
      }) as Promise<AdjustStockResponse>;
    },
    onSuccess: (data, variables) => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });

      // Refetch data to ensure UI is updated
      refetch();
      alertRefetchFunctions.refetchActive();
      alertRefetchFunctions.refetchHistory();

      // Show appropriate toast
      const productName = variables.productName || "Product";

      if (variables.changeAmount > 0) {
        toast.success(`Stock increased for ${productName}`);
      } else {
        toast.success(`Stock decreased for ${productName}`);

        // Only show warning if we just dropped below threshold with this change
        // and an alert was actually created (included in the response)
        const previousStock = data.inventory?.previousStock || 0;
        const currentStock = data.inventory?.currentStock || 0;
        const product = combinedData.find(
          (p) => p.productId === variables.productId
        );
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
    },
    onError: (error) => {
      console.error("Error adjusting stock:", error);
      toast.error("Failed to adjust stock. Please try again.");
    },
  });

  // Handler for stock adjustment buttons
  const handleStockAdjustment = (
    productId: string,
    changeAmount: number,
    productName: string
  ) => {
    adjustStockMutation.mutate({
      productId,
      changeAmount,
      productName, // Pass product name for the toast
    });
  };

  // Filter products based on search query
  const filteredProducts = combinedData.filter(
    (product) =>
      !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.category &&
        product.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (product.sku &&
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
                disabled={isLoading || adjustStockMutation.isPending}
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
                    const data = await api.debug.getDbState();
                    console.log("===== DATABASE DEBUG INFO =====");
                    console.log("TABLES:", data.tables);
                    console.log("TABLE COUNTS:", data.counts);

                    // Log inventory items
                    console.log(
                      "INVENTORY ITEMS:",
                      data.items.inventory.length
                    );
                    data.items.inventory.forEach((item) => {
                      console.log(
                        `- ${item.productId}: currentStock=${item.currentStock}`
                      );
                    });

                    // Log product items with thresholds
                    console.log("PRODUCT ITEMS:", data.items.products.length);
                    data.items.products.forEach((product) => {
                      console.log(
                        `- ${product.productId}: ${product.name}, minThreshold=${product.minThreshold}`
                      );
                    });

                    // Check for alerts
                    console.log("ALERT ITEMS:", data.items.alerts.length);
                    data.items.alerts.forEach((alert) => {
                      console.log(
                        `- ${alert.alertId}: productId=${alert.productId}, status=${alert.status}, stock=${alert.currentStock}, threshold=${alert.threshold}`
                      );
                    });

                    // Check if there SHOULD be any alerts based on current stock vs threshold
                    console.log("\nCHECKING FOR MISSING ALERTS:");
                    for (const product of data.items.products) {
                      const inventory = data.items.inventory.find(
                        (i) => i.productId === product.productId
                      );
                      if (inventory) {
                        const currentStock = inventory.currentStock;
                        const threshold = product.minThreshold;

                        if (currentStock < threshold) {
                          console.log(
                            `!!! ALERT CONDITION: ${product.name} (${product.productId}) has stock=${currentStock} which is below threshold=${threshold}`
                          );

                          // Check if an alert exists for this condition
                          const existingAlert = data.items.alerts.find(
                            (a) =>
                              a.productId === product.productId &&
                              a.status === "NEW"
                          );

                          if (existingAlert) {
                            console.log(
                              `✓ Alert exists: ${existingAlert.alertId}`
                            );
                          } else {
                            console.log(
                              `❌ NO ALERT EXISTS for this condition!`
                            );
                          }
                        }
                      }
                    }

                    console.log("===== END DEBUG INFO =====");

                    toast.success("Database state printed to console", {
                      duration: 5000,
                      style: { background: "#10B981", color: "white" },
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
                    console.log(
                      "Calling server-side check-all endpoint to create alerts..."
                    );

                    // Use the direct API endpoint to check and create all alerts
                    const response = await api.alerts.checkAndCreateAll();
                    console.log("checkAndCreateAll response:", response);

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
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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
                  Error loading products. Using mock data.
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
              filteredProducts.map((product) => (
                <TableRow key={product.productId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-md overflow-hidden bg-gray-100 flex-shrink-0"></div>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.sku && (
                          <div className="text-sm text-gray-500">
                            {product.sku}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          handleStockAdjustment(
                            product.productId,
                            -1,
                            product.name
                          )
                        }
                        disabled={
                          adjustStockMutation.isPending ||
                          product.totalStock <= 0
                        }
                      >
                        {adjustStockMutation.isPending &&
                        adjustStockMutation.variables?.productId ===
                          product.productId &&
                        adjustStockMutation.variables?.changeAmount < 0 ? (
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
                        onClick={() =>
                          handleStockAdjustment(
                            product.productId,
                            1,
                            product.name
                          )
                        }
                        disabled={adjustStockMutation.isPending}
                      >
                        {adjustStockMutation.isPending &&
                        adjustStockMutation.variables?.productId ===
                          product.productId &&
                        adjustStockMutation.variables?.changeAmount > 0 ? (
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
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{product.minThreshold}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.totalStock <= product.minThreshold ? (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1"
                      >
                        {/* <AlertTriangle className="h-3 w-3" /> */}
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
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        // onClick={() => openThresholdModal(product)}
                      >
                        Set Threshold
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/inventory/${product.productId}/history`}>
                          History
                        </a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const HomePage = () => {
  // Access the refetch functions hook at the HomePage level
  const alertPanelRefetchFunctions = {
    refetchActive: () => {},
    refetchHistory: () => {},
  };

  const setLocalAlertRefetchFunctions = (functions: {
    refetchActive: () => void;
    refetchHistory: () => void;
  }) => {
    alertPanelRefetchFunctions.refetchActive = functions.refetchActive;
    alertPanelRefetchFunctions.refetchHistory = functions.refetchHistory;
  };

  return (
    <div>
      <div className="p-6">
        <InventoryTable alertRefetchFunctions={alertPanelRefetchFunctions} />
      </div>
      <div className="p-6">
        <AlertsPanel setRefetchFunctions={setLocalAlertRefetchFunctions} />
      </div>
    </div>
  );
};

export default HomePage;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Inventory Tracking" },
    { name: "description", content: "Inventory Tracking System" },
  ];
}
