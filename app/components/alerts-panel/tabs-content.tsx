import React from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { 
  ClockIcon, 
  ExclamationTriangleIcon as AlertTriangle,
  InfoCircledIcon 
} from "@radix-ui/react-icons";
import { useAlertsContext } from "./context";

/**
 * TabsContainer component that provides the tabs structure
 */
export function AlertsTabsContainer() {
  const { activeTab, setActiveTab } = useAlertsContext();

  return (
    <div>
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="active">Active Alerts</TabsTrigger>
          <TabsTrigger value="history">Alert History</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <ActiveAlertsList />
        </TabsContent>

        <TabsContent value="history">
          <AlertsHistoryList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Component to render the active alerts list
 */
export function ActiveAlertsList() {
  const { 
    activeAlerts, 
    isLoadingActive, 
    handleAcknowledge, 
    isPendingAcknowledge, 
    pendingAlertId,
    formatTimeAgo
  } = useAlertsContext();

  if (isLoadingActive) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700"></div>
      </div>
    );
  }

  if (activeAlerts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No active alerts. All inventory levels are within thresholds.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeAlerts.map((alert) => {
        // Create some helper properties to handle both real and mock alerts
        const alertId = alert.alertId || alert.id; // Handle both schema formats
        const productName = alert.productName || alert.itemName;
        const currentStock = alert.currentStock || alert.currentQuantity;
        const timestamp = alert.createdAt || alert.timestamp;

        const isPending = isPendingAcknowledge && pendingAlertId === alertId;

        return (
          <div
            key={alertId}
            className="flex items-start justify-between p-3 border rounded-lg bg-amber-50 border-amber-100"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="font-medium text-amber-800">
                  {productName}
                </div>
                <div className="text-sm text-amber-700">
                  Current stock:{" "}
                  <span className="font-medium">{currentStock}</span>{" "}
                  (Threshold: {alert.threshold})
                </div>
                <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <ClockIcon className="h-3 w-3" />
                  {timestamp ? formatTimeAgo(timestamp) : "Unknown time"}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="bg-white hover:bg-gray-50"
              onClick={() => alertId && handleAcknowledge(alertId)}
              disabled={isPendingAcknowledge}
            >
              {isPending ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
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
                  Acknowledging...
                </span>
              ) : (
                "Acknowledge"
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Component to render the alerts history list
 */
export function AlertsHistoryList() {
  const { 
    acknowledgedAlerts, 
    isLoadingHistory,
    formatTimeAgo 
  } = useAlertsContext();

  if (isLoadingHistory) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-700"></div>
      </div>
    );
  }

  if (acknowledgedAlerts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No alert history found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {acknowledgedAlerts.map((alert) => {
        // Create some helper properties to handle both real and mock alerts
        const alertId = alert.alertId || alert.id; // Handle both schema formats
        const productName = alert.productName || alert.itemName;
        const currentStock = alert.currentStock || alert.currentQuantity;
        const timestamp = alert.createdAt || alert.timestamp;
        const acknowledgedAt = alert.acknowledgedAt;

        return (
          <div
            key={alertId}
            className="flex items-start justify-between p-3 border rounded-lg"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <InfoCircledIcon className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <div className="font-medium">{productName}</div>
                <div className="text-sm text-gray-500">
                  Stock was {currentStock} (Threshold: {alert.threshold})
                </div>
                <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <ClockIcon className="h-3 w-3" />
                  {timestamp ? formatTimeAgo(timestamp) : "Unknown time"}
                </div>
                {acknowledgedAt && (
                  <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    Acknowledged: {formatTimeAgo(acknowledgedAt)}
                  </div>
                )}
              </div>
            </div>
            <Badge variant="outline" className="bg-gray-100 text-gray-700">
              Resolved
            </Badge>
          </div>
        );
      })}
    </div>
  );
}