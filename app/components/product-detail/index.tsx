import React, { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { fetchProductDetails, fetchProductInventory } from '~/lib/suspense-cache';

// Error boundary component for handling errors in Suspense
class ErrorBoundary extends React.Component<
  { children: React.ReactNode, fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode, fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

// Loading fallback component
const ProductDetailSkeleton = () => (
  <Card className="shadow-sm animate-pulse">
    <CardHeader>
      <div className="h-8 w-64 bg-gray-200 rounded-md mb-2"></div>
      <div className="h-4 w-32 bg-gray-200 rounded-md"></div>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        <div className="h-24 w-full bg-gray-200 rounded-md"></div>
        <div className="h-8 w-32 bg-gray-200 rounded-md"></div>
        <div className="h-10 w-full bg-gray-200 rounded-md"></div>
      </div>
    </CardContent>
  </Card>
);

// Error fallback component
const ProductErrorFallback = () => (
  <Card className="shadow-sm">
    <CardHeader>
      <CardTitle className="text-red-600">Error Loading Product</CardTitle>
    </CardHeader>
    <CardContent>
      <p>There was an error loading the product details. Please try again.</p>
      <Button className="mt-4" onClick={() => window.location.reload()}>
        Retry
      </Button>
    </CardContent>
  </Card>
);

// Product details component that uses Suspense data
const ProductDetailContent = ({ productId }: { productId: string }) => {
  // These will throw promises that Suspense will catch if data is not ready
  const product = fetchProductDetails(productId).read();
  const inventory = fetchProductInventory(productId).read();

  // Once we have the data, we can render it
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
        <div className="flex items-center gap-2 mt-2">
          {product.sku && <span className="text-sm text-gray-500">SKU: {product.sku}</span>}
          {product.category && (
            <Badge variant="outline" className="text-gray-600">
              {product.category}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-gray-700">{product.description}</p>
          
          <div className="flex items-center gap-4 py-2 border-t border-b">
            <div>
              <div className="text-sm text-gray-500">Current Stock</div>
              <div className="font-semibold">{inventory.currentStock}</div>
            </div>
            
            <div>
              <div className="text-sm text-gray-500">Minimum Threshold</div>
              <div className="font-semibold">{product.minThreshold}</div>
            </div>
            
            <div>
              <div className="text-sm text-gray-500">Status</div>
              {inventory.currentStock <= product.minThreshold ? (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  Low Stock
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  In Stock
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button>Update Product</Button>
            <Button variant="outline">View Inventory History</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Main product detail component with Suspense
export function ProductDetail({ productId }: { productId: string }) {
  return (
    <ErrorBoundary fallback={<ProductErrorFallback />}>
      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductDetailContent productId={productId} />
      </Suspense>
    </ErrorBoundary>
  );
}