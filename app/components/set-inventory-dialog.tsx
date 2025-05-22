import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import { api } from "~/lib/api";
import { useQueryClient } from "@tanstack/react-query";

interface SetInventoryDialogProps {
  productId: string;
  productName: string;
  currentStock: number;
  onInventoryUpdated: () => void;
}

export function SetInventoryDialog({
  productId,
  productName,
  currentStock,
  onInventoryUpdated,
}: SetInventoryDialogProps) {
  const [inventory, setInventory] = useState<number>(currentStock);
  const [isUpdating, setIsUpdating] = useState(false);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleInventoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setInventory(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inventory === currentStock) {
      setOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      // Calculate the change amount for the API
      const changeAmount = inventory - currentStock;
      
      await api.inventory.adjustStock({
        productId: productId as any, // Type assertion for branded type
        changeAmount: changeAmount,
        reason: `Stock set to ${inventory} via dashboard`,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      
      // Call the parent callback to refresh the UI
      onInventoryUpdated();
      
      toast.success(`Updated inventory for ${productName}`, {
        description: `Inventory is now set to ${inventory} units.`,
      });
      
      setOpen(false);
    } catch (error) {
      console.error("Error updating inventory:", error);
      toast.error("Failed to update inventory", {
        description: "Please try again or contact support if the issue persists.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Set Inventory
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Inventory Level</DialogTitle>
          <DialogDescription>
            Update the current inventory level for {productName}. This will directly set the stock to the specified value.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="inventory" className="text-right">
                Inventory
              </Label>
              <Input
                id="inventory"
                type="number"
                min="0"
                value={inventory}
                onChange={handleInventoryChange}
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? (
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
                  Updating...
                </span>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}