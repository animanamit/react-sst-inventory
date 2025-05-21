import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "~/lib/api";
import { 
  AlertsContext, 
  formatTimeAgo as formatTime 
} from "./context";
import type { Alert } from "./context";
import { Card } from "~/components/ui/card";

// Type for the props accepted by the AlertsPanel component
interface AlertsPanelProps {
  children: React.ReactNode;
  setRefetchFunctions?: (functions: {
    refetchActive: () => void;
    refetchHistory: () => void;
  }) => void;
}

/**
 * Compound component for the Alerts Panel
 * This is the parent component that provides context to all child components
 */
export function AlertsPanel({ children, setRefetchFunctions }: AlertsPanelProps) {
  // Extract the API URL from the environment for direct fetch calls
  const API_URL = import.meta.env.VITE_API_URL || "";

  // State for active tab
  const [activeTab, setActiveTab] = useState("active");
  
  // Track which alert is being acknowledged
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);

  // Get the query client for cache invalidation
  const queryClient = useQueryClient();

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
          const products = (await api.products.getAll()) as any[];

          // Create a map of productId to product name for easy lookup
          const productMap = (products || []).reduce<Record<string, any>>(
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
          const products = (await api.products.getAll()) as any[];

          // Create a map of productId to product name for easy lookup
          const productMap = (products || []).reduce<Record<string, any>>(
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
      setPendingAlertId(alertId);
      return api.alerts.acknowledge(alertId);
    },
    onSuccess: (data: any) => {
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

      // Clear pending state
      setPendingAlertId(null);

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

      // Clear pending state
      setPendingAlertId(null);

      // Refetch to ensure UI is consistent with server state
      refetchActive();
      refetchHistory();
    },
  });

  // Handle acknowledging an alert
  const handleAcknowledge = (alertId: string) => {
    acknowledgeMutation.mutate(alertId);
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
    if (setRefetchFunctions) {
      setRefetchFunctions({
        refetchActive,
        refetchHistory,
      });
    }
  }, [refetchActive, refetchHistory, setRefetchFunctions]);

  // Create context value
  const contextValue = {
    activeTab,
    setActiveTab,
    activeAlerts,
    acknowledgedAlerts,
    isLoadingActive,
    isLoadingHistory,
    isErrorActive,
    isErrorHistory,
    handleAcknowledge,
    isPendingAcknowledge: acknowledgeMutation.isPending,
    pendingAlertId,
    formatTimeAgo: formatTime,
    refetchActive,
    refetchHistory,
    setRefetchFunctions,
  };

  return (
    <AlertsContext.Provider value={contextValue}>
      <Card className="shadow-sm">
        {children}
      </Card>
    </AlertsContext.Provider>
  );
}

// Re-export components to maintain the pattern
export { useAlertsContext } from './context';
export * from './tabs-content';
export * from './header';