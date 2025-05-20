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
import { mockInventoryData } from "~/mock-data";
import { PlusIcon, MinusIcon } from "@radix-ui/react-icons";

const InventoryTable = () => {
  return (
    <div className="overflow-x-auto">
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
          {mockInventoryData.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                    <img
                      // src={item.imageUrl || "/placeholder.svg"}
                      // alt={item.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/diverse-products-still-life.png";
                      }}
                    />
                  </div>
                  <div>
                    <div className="font-medium">{item.name}</div>
                    {/* <div className="text-sm text-gray-500">{item.sku}</div> */}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    // onClick={() => handleQuantityChange(item.id, -1)}
                  >
                    <MinusIcon className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-medium">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    // onClick={() => handleQuantityChange(item.id, 1)}
                  >
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>{item.threshold}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    // onClick={() => openThresholdModal(item)}
                  >
                    {/* <Settings className="h-4 w-4" /> */}
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                {item.quantity <= item.threshold ? (
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
                  // onClick={() => openThresholdModal(item)}
                >
                  Set Threshold
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const ProductDisplay = () => {
  return (
    <div>
      <h1>Product Display</h1>
      <p>List of products will be displayed here.</p>
      <ul>
        {mockInventoryData.map((item) => (
          <li key={item.id}>
            <h2>{item.name}</h2>
            <p>{item.description}</p>
            {/* <img src={item.imageUrl} alt={item.name} /> */}
            <p>Quantity: {item.quantity}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ProductPage = () => {
  return (
    <div>
      <h1>Products</h1>
      <p>Explore our range of products.</p>
      <InventoryTable />
      {/* Uncomment the line below to display the product list */}
      {/* <ProductDisplay /> */}
    </div>
  );
};
export default ProductPage;

export function meta() {
  return [
    { title: "Products" },
    { name: "description", content: "List of products" },
  ];
}
