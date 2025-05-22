import {
  mockInventoryData,
  sampleActiveAlerts,
  sampleAlertHistory,
} from "~/mock-data";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "~/lib/api";
import { seedDatabase } from "~/lib/seed-utils";
import type { Route } from ".react-router/types/app/routes/+types/home";
import { toast } from "sonner";

// Import our components
import { InventoryTable } from "~/components/inventory-table";
import {
  AlertsPanel,
  AlertsHeader,
  AlertsTabsContainer,
} from "~/components/alerts-panel";
import { DashboardLayout } from "~/components/dashboard-layout";

interface InventoryTableProps {
  alertRefetchFunctions: {
    refetchActive: () => void;
    refetchHistory: () => void;
  };
}

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

  // Get active alerts for the notification badge
  const { data: activeAlerts = [] as any[] } = useQuery({
    queryKey: ["alerts", "active"],
    queryFn: async () => {
      try {
        const data = await api.alerts.getAll("NEW");
        return data as any[];
      } catch (error) {
        console.error("Error fetching active alerts:", error);
        return [] as any[];
      }
    },
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });

  // Create the individual views
  const inventoryView = (
    <InventoryTable
      products={combinedData}
      isLoading={isLoading}
      isError={isError}
      refetchProducts={refetchProducts}
      refetchInventory={refetchInventory}
      alertRefetchFunctions={alertPanelRefetchFunctions}
    />
  );

  const alertsView = (
    <AlertsPanel setRefetchFunctions={setLocalAlertRefetchFunctions}>
      <AlertsHeader />
      <AlertsTabsContainer />
    </AlertsPanel>
  );

  // Return the dashboard layout with both views
  return (
    <DashboardLayout
      inventoryView={inventoryView}
      alertsView={alertsView}
      activeAlertsCount={activeAlerts.length}
    />
  );
};

export default HomePage;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Inventory Tracking" },
    { name: "description", content: "Inventory Tracking System" },
  ];
}
