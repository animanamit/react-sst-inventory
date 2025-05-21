import { createContext, useContext, useState } from "react";
import { formatDistanceToNow } from "date-fns";

// Define the type for Alert objects
export interface Alert {
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

// Context interface
export interface AlertsContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeAlerts: Alert[];
  acknowledgedAlerts: Alert[];
  isLoadingActive: boolean;
  isLoadingHistory: boolean;
  isErrorActive: boolean;
  isErrorHistory: boolean;
  handleAcknowledge: (alertId: string) => void;
  isPendingAcknowledge: boolean;
  pendingAlertId: string | null;
  formatTimeAgo: (timestamp: number) => string;
  refetchActive: () => void;
  refetchHistory: () => void;
  setRefetchFunctions?: (functions: {
    refetchActive: () => void;
    refetchHistory: () => void;
  }) => void;
}

// Create the context with a default value
export const AlertsContext = createContext<AlertsContextType>({
  activeTab: "active",
  setActiveTab: () => {},
  activeAlerts: [],
  acknowledgedAlerts: [],
  isLoadingActive: false,
  isLoadingHistory: false,
  isErrorActive: false,
  isErrorHistory: false,
  handleAcknowledge: () => {},
  isPendingAcknowledge: false,
  pendingAlertId: null,
  formatTimeAgo: () => "",
  refetchActive: () => {},
  refetchHistory: () => {},
  setRefetchFunctions: undefined,
});

// Custom hook to use the alerts context
export function useAlertsContext() {
  const context = useContext(AlertsContext);
  
  if (!context) {
    throw new Error("useAlertsContext must be used within an AlertsProvider");
  }
  
  return context;
}

// Helper function for formatting timestamps
export function formatTimeAgo(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
  });
}