import { Suspense } from "react";
import { useParams } from "react-router-dom";
import { ProductDetail } from "~/components/product-detail";
// Define MetaArgs interface
interface MetaArgs {
  params: {
    productId: string;
  };
}

// Loading fallback for the entire page
const PageLoading = () => (
  <div className="p-6 text-center">
    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] text-primary motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
      <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
    </div>
    <div className="mt-4">Loading product details...</div>
  </div>
);

/**
 * Product detail page that demonstrates React Suspense for data fetching
 */
export default function ProductPage() {
  const { productId } = useParams<{ productId: string }>();

  if (!productId) {
    return <div className="p-6">Product ID is required</div>;
  }

  return (
    <div className="p-6">
      <Suspense fallback={<PageLoading />}>
        <ProductDetail productId={productId} />
      </Suspense>
    </div>
  );
}

export function meta({ params }: MetaArgs) {
  return [
    { title: `Product ${params.productId} | Inventory` },
    { name: "description", content: "View product details" },
  ];
}