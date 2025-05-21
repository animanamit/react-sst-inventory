import { useState } from "react";
import { useParams, Link } from "@remix-run/react";
import { formatDistanceToNow, format } from "date-fns";
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
  CardDescription,
  CardFooter,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { ArrowLeftIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/lib/api";
import { toast } from "sonner";
import type { Route } from ".react-router/types/app/routes/+types/inventory.$productId.history";

const HistoryPage = () => {
  // Get the product ID from the URL
  const { productId } = useParams();
  
  // For managing the search input
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch product data
  const {
    data: product,
    isLoading: isLoadingProduct,
    isError: isErrorProduct,
  } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      if (!productId) return null;
      try {
        return await api.products.getProduct(productId);
      } catch (error) {
        console.error("Error fetching product:", error);
        toast.error("Failed to load product information");
        throw error;
      }
    },
    enabled: !!productId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Fetch inventory history data
  const {
    data: historyData = [],
    isLoading: isLoadingHistory,
    isError: isErrorHistory,
  } = useQuery({
    queryKey: ["inventoryHistory", productId],
    queryFn: async () => {
      if (!productId) return [];
      try {
        return await api.inventory.getHistory(productId);
      } catch (error) {
        console.error("Error fetching inventory history:", error);
        toast.error("Failed to load inventory history");
        throw error;
      }
    },
    enabled: !!productId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Filter history by search query
  const filteredHistory = historyData.filter(
    (item) => 
      !searchQuery || 
      item.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.userId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If product and history are loading
  if (isLoadingProduct || isLoadingHistory) {
    return (
      <div className="container py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  // If there was an error loading the product or history
  if (isErrorProduct || isErrorHistory) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-500">Error Loading Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p>There was an error loading the product or inventory history data.</p>
            <Button asChild className="mt-4">
              <Link to="/home">Return to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If product not found
  if (!product) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Product Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The product you're looking for doesn't exist or has been removed.</p>
            <Button asChild className="mt-4">
              <Link to="/home">Return to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col gap-6">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              asChild
              className="rounded-full"
            >
              <Link to="/home">
                <ArrowLeftIcon className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Inventory History</h1>
          </div>
        </div>

        {/* Product Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>{product.name}</CardTitle>
            <CardDescription>{product.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Category</p>
                <p className="font-medium">{product.category || "Uncategorized"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-500">SKU</p>
                <p className="font-medium">{product.sku || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Minimum Threshold</p>
                <p className="font-medium">{product.minThreshold}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* History Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle>Stock Adjustment History</CardTitle>
              <div className="relative w-full md:w-64">
                <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search history..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery
                  ? "No history entries match your search criteria."
                  : "No stock adjustment history available for this product."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Before</TableHead>
                    <TableHead>After</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((entry) => (
                    <TableRow key={entry.historyId}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {format(new Date(entry.timestamp), "MMM d, yyyy")}
                          </span>
                          <span className="text-sm text-gray-500">
                            {format(new Date(entry.timestamp), "h:mm a")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            entry.changeAmount > 0
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }
                        >
                          {entry.changeAmount > 0 ? "+" : ""}
                          {entry.changeAmount}
                        </Badge>
                      </TableCell>
                      <TableCell>{entry.stockBefore}</TableCell>
                      <TableCell>{entry.stockAfter}</TableCell>
                      <TableCell>
                        <span className="line-clamp-2" title={entry.reason}>
                          {entry.reason}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {entry.userId}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          <CardFooter className="border-t bg-gray-50/50 py-3">
            <div className="text-sm text-gray-500">
              Showing {filteredHistory.length} of {historyData.length} entries
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default HistoryPage;

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Inventory History | ${params.productId || "Product"}` },
    { name: "description", content: "View inventory history and stock changes" },
  ];
}