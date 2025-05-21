import { useState } from "react";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription,
  CardFooter
} from "~/components/ui/card";
import { 
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "~/lib/api";
import { Link } from "react-router-dom";

// Define form validation schema
const productSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  initialStock: z.coerce.number().int().min(0, "Initial stock must be a positive number"),
  minThreshold: z.coerce.number().int().min(1, "Threshold must be at least 1"),
  category: z.string().optional(),
  sku: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function TestAlertsPage() {
  const [productId, setProductId] = useState<string | null>(null);
  const [createdAlert, setCreatedAlert] = useState<any | null>(null);
  const [acknowledgedAlert, setAcknowledgedAlert] = useState<any | null>(null);
  
  // Get the query client
  const queryClient = useQueryClient();
  
  // Initialize form
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "Test Alert Product",
      description: "This is a product for testing alerts functionality",
      initialStock: 10,
      minThreshold: 5,
      category: "Test",
      sku: "TEST-" + Date.now().toString().slice(-6),
    },
  });
  
  // Handle creating a product
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      // Create the product first
      const productResponse = await api.products.createOrUpdate({
        name: data.name,
        description: data.description,
        category: data.category,
        sku: data.sku,
        minThreshold: data.minThreshold,
      }) as any;
      
      // Then set the initial inventory
      if (productResponse.productId && data.initialStock > 0) {
        await api.inventory.adjustStock({
          productId: productResponse.productId,
          changeAmount: data.initialStock,
          reason: "Initial stock setup",
        });
      }
      
      return productResponse;
    },
    onSuccess: (data: any) => {
      toast.success("Product created successfully!");
      setProductId(data.productId);
    },
    onError: (error) => {
      console.error("Error creating product:", error);
      toast.error("Failed to create product");
    },
  });
  
  // Handle reducing stock to trigger alert
  const reduceStockMutation = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("No product selected");
      
      // Get current product info
      const product = await api.products.getProduct(productId) as any;
      
      // Calculate amount to reduce stock below threshold
      const currentStock = 10; // Assuming initial stock is 10
      const amountToReduce = -(currentStock - product.minThreshold + 1);
      
      // Adjust the stock
      return api.inventory.adjustStock({
        productId,
        changeAmount: amountToReduce,
        reason: "Testing alert creation",
      });
    },
    onSuccess: () => {
      toast.success("Stock reduced below threshold!");
      // Invalidate queries to refresh alerts
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      
      // Wait a moment and check for alerts
      setTimeout(checkForAlerts, 1000);
    },
    onError: (error) => {
      console.error("Error reducing stock:", error);
      toast.error("Failed to reduce stock");
    },
  });
  
  // Check for alerts for this product
  const checkForAlerts = async () => {
    try {
      if (!productId) return;
      
      // Get active alerts
      const alerts = await api.alerts.getAll("NEW") as any[];
      
      // Find alert for this product
      const productAlert = alerts.find((alert: any) => alert.productId === productId);
      
      if (productAlert) {
        setCreatedAlert(productAlert);
        toast.success("Alert created successfully!");
      } else {
        toast.error("No alert was created for this product");
      }
    } catch (error) {
      console.error("Error checking alerts:", error);
    }
  };
  
  // Handle acknowledging the alert
  const acknowledgeAlertMutation = useMutation({
    mutationFn: async () => {
      if (!createdAlert) throw new Error("No alert to acknowledge");
      
      return api.alerts.acknowledge(createdAlert.alertId);
    },
    onSuccess: (data: any) => {
      toast.success("Alert acknowledged successfully!");
      setAcknowledgedAlert(data.alert);
      
      // Invalidate queries to refresh alerts
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (error) => {
      console.error("Error acknowledging alert:", error);
      toast.error("Failed to acknowledge alert");
    },
  });
  
  const onSubmit = (data: ProductFormValues) => {
    createProductMutation.mutate(data);
  };
  
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Test Alert Lifecycle</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Create Product */}
        <Card className={productId ? "opacity-50" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              1. Create Product with Threshold
              {productId && <CheckCircle className="h-5 w-5 text-green-600" />}
            </CardTitle>
            <CardDescription>
              Create a new product with a threshold for testing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="initialStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial Stock</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>
                          Starting quantity
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="minThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Threshold</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>
                          Alert below this
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="pt-4">
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={createProductMutation.isPending || !!productId}
                  >
                    {createProductMutation.isPending ? "Creating..." : "Create Product"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        {/* Step 2: Reduce Stock */}
        <Card className={!productId || createdAlert ? "opacity-50" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              2. Reduce Stock Below Threshold
              {createdAlert && <CheckCircle className="h-5 w-5 text-green-600" />}
            </CardTitle>
            <CardDescription>
              Trigger alert creation by reducing stock
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-gray-100 p-4 rounded-lg">
                {productId ? (
                  <>
                    <p className="font-medium">Product Created</p>
                    <p className="text-sm text-gray-600 mb-2">ID: {productId}</p>
                    <p className="text-sm">
                      We'll now reduce the stock below the threshold
                      to trigger an alert.
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500">
                    First create a product in step 1
                  </p>
                )}
              </div>
              
              <Button
                variant="default"
                className="w-full"
                disabled={!productId || !!createdAlert || reduceStockMutation.isPending}
                onClick={() => reduceStockMutation.mutate()}
              >
                {reduceStockMutation.isPending 
                  ? "Reducing Stock..." 
                  : "Reduce Stock Below Threshold"}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Step 3: Acknowledge Alert */}
        <Card className={!createdAlert ? "opacity-50" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              3. Acknowledge Alert
              {acknowledgedAlert && <CheckCircle className="h-5 w-5 text-green-600" />}
            </CardTitle>
            <CardDescription>
              Process the alert and move it to history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {createdAlert ? (
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-amber-800">
                        Low Stock Alert
                      </p>
                      <p className="text-sm text-amber-700">
                        Current stock: {createdAlert.currentStock} (Threshold: {createdAlert.threshold})
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        Alert ID: {createdAlert.alertId}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-100 p-4 rounded-lg">
                  <p className="text-gray-500">
                    Waiting for an alert to be created...
                  </p>
                </div>
              )}
              
              <Button
                variant="default"
                className="w-full"
                disabled={!createdAlert || !!acknowledgedAlert || acknowledgeAlertMutation.isPending}
                onClick={() => acknowledgeAlertMutation.mutate()}
              >
                {acknowledgeAlertMutation.isPending 
                  ? "Acknowledging..." 
                  : "Acknowledge Alert"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Status Summary */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Alert Lifecycle Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border p-4 rounded-lg">
                <div className="flex items-center gap-2 font-medium mb-2">
                  <div className={`h-3 w-3 rounded-full ${productId ? "bg-green-500" : "bg-gray-300"}`}></div>
                  Step 1: Create Product
                </div>
                <p className="text-sm text-gray-600">
                  {productId 
                    ? `Product created with ID: ${productId}` 
                    : "Not started"}
                </p>
              </div>
              
              <div className="border p-4 rounded-lg">
                <div className="flex items-center gap-2 font-medium mb-2">
                  <div className={`h-3 w-3 rounded-full ${createdAlert ? "bg-green-500" : productId ? "bg-amber-500" : "bg-gray-300"}`}></div>
                  Step 2: Trigger Alert
                </div>
                <p className="text-sm text-gray-600">
                  {createdAlert 
                    ? `Alert created with ID: ${createdAlert.alertId}` 
                    : productId 
                    ? "Ready to reduce stock" 
                    : "Waiting for product"}
                </p>
              </div>
              
              <div className="border p-4 rounded-lg">
                <div className="flex items-center gap-2 font-medium mb-2">
                  <div className={`h-3 w-3 rounded-full ${acknowledgedAlert ? "bg-green-500" : createdAlert ? "bg-amber-500" : "bg-gray-300"}`}></div>
                  Step 3: Acknowledge Alert
                </div>
                <p className="text-sm text-gray-600">
                  {acknowledgedAlert 
                    ? `Alert acknowledged successfully` 
                    : createdAlert 
                    ? "Ready to acknowledge" 
                    : "Waiting for alert"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t bg-gray-50 flex justify-between">
          <Button asChild variant="outline">
            <Link to="/home">Return to Dashboard</Link>
          </Button>
          
          {acknowledgedAlert && (
            <Button variant="default" onClick={() => {
              // Reset the test
              setProductId(null);
              setCreatedAlert(null);
              setAcknowledgedAlert(null);
              form.reset();
              toast.success("Test reset. You can start again.");
            }}>
              Reset Test
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}