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
import type { Route } from ".react-router/types/app/routes/+types/home";
import { toast } from "sonner";

const AlertsPanel = () => {
  const [activeTab, setActiveTab] = useState("active");

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Inventory Alerts</CardTitle>
            <CardDescription>Monitor and manage stock alerts</CardDescription>
          </div>
          {/* {activeAlerts.length > 0 && (
            <Badge className="bg-red-100 text-red-800 border-red-200">
              {activeAlerts.length} Active
            </Badge>
          )} */}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="active" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="active">Active Alerts</TabsTrigger>
            <TabsTrigger value="history">Alert History</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <div className="space-y-3">
              {sampleActiveAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between p-3 border rounded-lg bg-amber-50 border-amber-100"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="font-medium text-amber-800">
                        {alert.itemName}
                      </div>
                      <div className="text-sm text-amber-700">
                        Current stock:{" "}
                        <span className="font-medium">
                          {alert.currentQuantity}
                        </span>{" "}
                        (Threshold: {alert.threshold})
                      </div>
                      <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <ClockIcon className="h-3 w-3" />
                        {formatDistanceToNow(new Date(alert.timestamp), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white hover:bg-gray-50"
                    // onClick={() => acknowledgeAlert(alert.id)}
                  >
                    Acknowledge
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-3">
              {sampleAlertHistory.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <InfoCircledIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <div>
                      <div className="font-medium">{alert.itemName}</div>
                      <div className="text-sm text-gray-500">
                        Stock was {alert.currentQuantity} (Threshold:{" "}
                        {alert.threshold})
                      </div>
                      <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <ClockIcon className="h-3 w-3" />
                        {formatDistanceToNow(new Date(alert.timestamp), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-gray-100 text-gray-700"
                  >
                    Resolved
                  </Badge>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const InventoryTable = () => {
  // For managing the search input
  const [searchQuery, setSearchQuery] = useState("");

  // Query client for invalidating queries after mutations
  const queryClient = useQueryClient();

  // Types for the data from our API
  interface ProductWithInventory {
    productId: string;
    name: string;
    description: string;
    category?: string;
    sku?: string;
    imageUrl?: string;
    minThreshold: number;
    inventory?: Array<{
      productId: string;
      locationId: string;
      currentStock: number;
    }>;
    totalStock: number;
  }

  // Fetch products data from API with inventory information included
  const {
    data: productsData = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      try {
        // If we get a 404, the API isn't deployed yet - try seeding the db first
        try {
          const data = await api.products.getAll();
          return data as ProductWithInventory[];
        } catch (error: any) {
          // If API error is 404, try seeding mock data
          if (error.status === 404 && process.env.NODE_ENV === "development") {
            console.log(
              "Products API not found, attempting to seed mock data..."
            );
            await api.products.seedMockData();
            const data = await api.products.getAll();
            return data as ProductWithInventory[];
          }
          throw error;
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        // Return mock data converted to the right format for development
        if (process.env.NODE_ENV === "development") {
          return mockInventoryData.map((item) => ({
            productId: item.id,
            name: item.name,
            description: item.description,
            minThreshold: item.threshold,
            imageUrl: item.imageUrl,
            totalStock: item.quantity,
          })) as ProductWithInventory[];
        }
        return [] as ProductWithInventory[];
      }
    },
  });

  // Mutation for adjusting stock levels
  const adjustStockMutation = useMutation({
    mutationFn: (variables: { productId: string; changeAmount: number }) => {
      return api.inventory.adjustStock({
        productId: variables.productId,
        changeAmount: variables.changeAmount,
        reason:
          variables.changeAmount > 0
            ? "Stock increased via dashboard"
            : "Stock decreased via dashboard",
      });
    },
    onSuccess: () => {
      // Invalidate the products query to refetch data
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      console.error("Error adjusting stock:", error);
      toast.error("Failed to adjust stock. Please try again.");
    },
  });

  // Handler for stock adjustment buttons
  const handleStockAdjustment = (productId: string, changeAmount: number) => {
    adjustStockMutation.mutate({ productId, changeAmount });
  };

  // Filter products based on search query
  const filteredProducts = productsData.filter(
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
                onClick={() => {
                  toast.promise(
                    api.products.seedMockData().then(() => refetch()),
                    {
                      loading: "Seeding database with mock data...",
                      success: "Database seeded successfully!",
                      error: "Failed to seed database. Please try again.",
                    }
                  );
                }}
                disabled={isLoading || adjustStockMutation.isPending}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                          handleStockAdjustment(product.productId, -1)
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
                          handleStockAdjustment(product.productId, 1)
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        // onClick={() => openThresholdModal(product)}
                      >
                        <GearIcon className="h-4 w-4" />
                      </Button>
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
                    <Button
                      variant="outline"
                      size="sm"
                      // onClick={() => openThresholdModal(product)}
                    >
                      Set Threshold
                    </Button>
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
  return (
    <div>
      <div className="p-6">
        <InventoryTable />
      </div>
      <div className="p-6">
        <AlertsPanel />
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
