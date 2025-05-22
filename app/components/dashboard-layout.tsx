import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "~/components/ui/button";
import { BellIcon, TableIcon, PlusIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";

interface DashboardLayoutProps {
  inventoryView: React.ReactNode;
  alertsView: React.ReactNode;
  activeAlertsCount: number;
}

export function DashboardLayout({
  inventoryView,
  alertsView,
  activeAlertsCount,
}: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the current view from URL search params or default to inventory
  const [currentView, setCurrentView] = useState<"inventory" | "alerts">(
    location.search.includes("view=alerts") ? "alerts" : "inventory"
  );
  
  // Update the URL when the view changes
  useEffect(() => {
    navigate(`?view=${currentView}`, { replace: true });
  }, [currentView, navigate]);
  
  // Update view based on URL if it changes externally
  useEffect(() => {
    if (location.search.includes("view=alerts")) {
      setCurrentView("alerts");
    } else if (location.search.includes("view=inventory") || !location.search) {
      setCurrentView("inventory");
    }
  }, [location.search]);
  
  // Toggle between views
  const toggleView = () => {
    setCurrentView(currentView === "inventory" ? "alerts" : "inventory");
  };
  
  return (
    <div className="p-6">
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Inventory Management</h1>
          
          <div className="flex items-center gap-3">
            {currentView === "inventory" && (
              <>
                <Button variant="default" size="sm" asChild>
                  <a href="/inventory-add">
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add Product
                  </a>
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={async () => {
                    try {
                      const api = await import("~/lib/api").then(m => m.api);
                      const data = (await api.debug.getDbState()) as any;

                      // Check for alert conditions
                      let alertConditions = 0;
                      let existingAlerts = 0;
                      let missingAlerts = 0;

                      for (const product of data.items.products) {
                        const inventory = data.items.inventory.find(
                          (i: any) => i.productId === product.productId
                        );
                        if (inventory) {
                          const currentStock = inventory.currentStock;
                          const threshold = product.minThreshold;

                          if (currentStock < threshold) {
                            alertConditions++;
                            // Check if an alert exists for this condition
                            const existingAlert = data.items.alerts.find(
                              (a: any) =>
                                a.productId === product.productId &&
                                a.status === "NEW"
                            );

                            if (existingAlert) {
                              existingAlerts++;
                            } else {
                              missingAlerts++;
                            }
                          }
                        }
                      }

                      const { toast } = await import("sonner");
                      toast.success("Database state printed to console", {
                        duration: 5000,
                        style: { background: "#10B981", color: "white" },
                        description: `Found ${data.items.alerts.length} alerts (${existingAlerts} active, ${missingAlerts} missing conditions)`,
                      });
                    } catch (error) {
                      console.error("Error getting database state:", error);
                      const { toast } = await import("sonner");
                      toast.error("Failed to get database state");
                    }
                  }}
                >
                  Debug Tables
                </Button>
              </>
            )}
            
            {currentView === "alerts" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // This will be handled by the AlertsPanel internally
                  const event = new CustomEvent("refresh-alerts");
                  window.dispatchEvent(event);
                }}
              >
                Refresh
              </Button>
            )}
            
            <Button 
              variant={currentView === "alerts" ? "default" : "outline"}
              onClick={toggleView}
              className="flex items-center gap-2"
              size="sm"
            >
              {currentView === "inventory" ? (
                <>
                  <BellIcon className="h-4 w-4" />
                  Alerts
                  {activeAlertsCount > 0 && (
                    <Badge className="bg-red-500 text-white ml-1 h-5 min-w-5 flex items-center justify-center rounded-full text-xs">
                      {activeAlertsCount}
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <TableIcon className="h-4 w-4" />
                  Inventory
                </>
              )}
            </Button>
          </div>
        </div>
        
        {currentView === "inventory" && (
          <div className="relative w-full md:w-64 self-end">
            <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search inventory..."
              className="pl-8"
              id="inventory-search"
            />
          </div>
        )}
      </div>
      
      {currentView === "inventory" ? inventoryView : alertsView}
    </div>
  );
}