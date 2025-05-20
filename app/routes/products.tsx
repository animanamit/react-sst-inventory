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
  CardFooter,
  CardDescription,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { useState } from "react";

import { formatDistanceToNow } from "date-fns";

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
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Inventory Items</CardTitle>
          <div className="relative w-full md:w-64">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search inventory..."
              className="pl-8"
              // value={searchQuery}
              // onChange={(e) => setSearchQuery(e.target.value)}
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
                      <GearIcon className="h-4 w-4" />
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
      </CardContent>
    </Card>
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
      <div className="p-6">
        <InventoryTable />
      </div>
      <div className="p-6">
        <AlertsPanel />
      </div>
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
