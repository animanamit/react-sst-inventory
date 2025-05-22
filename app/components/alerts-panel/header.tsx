import React from "react";
import { Badge } from "~/components/ui/badge";
import { useAlertsContext } from "./context";

interface HeaderProps {
  title?: string;
  description?: string;
}

/**
 * Header component for the AlertsPanel
 * Displays title, description, and action buttons
 */
export function AlertsHeader({ 
  title = "Inventory Alerts", 
  description = "Monitor and manage stock alerts" 
}: HeaderProps) {
  const { 
    activeAlerts, 
    refetchActive, 
    refetchHistory 
  } = useAlertsContext();

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {activeAlerts.length > 0 && (
            <Badge className="bg-red-100 text-red-800 border-red-200">
              {activeAlerts.length} Active
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}