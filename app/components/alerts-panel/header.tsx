import React from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "~/components/ui/card";
import { toast } from "sonner";
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
    <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {activeAlerts.length > 0 && (
            <Badge className="bg-red-100 text-red-800 border-red-200">
              {activeAlerts.length} Active
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchActive();
              refetchHistory();
              toast.info("Refreshing alerts...");
            }}
          >
            Refresh
          </Button>
        </div>
      </div>
    </CardHeader>
  );
}