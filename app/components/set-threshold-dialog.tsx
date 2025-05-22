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

interface SetThresholdDialogProps {
  productId: string;
  productName: string;
  currentThreshold: number;
  onThresholdUpdated: () => void;
}

export function SetThresholdDialog({
  productId,
  productName,
  currentThreshold,
  onThresholdUpdated,
}: SetThresholdDialogProps) {
  const [threshold, setThreshold] = useState<number>(currentThreshold);
  const [isUpdating, setIsUpdating] = useState(false);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setThreshold(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (threshold === currentThreshold) {
      setOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      await api.products.update({
        productId: productId as any, // Type assertion to handle branded type
        minThreshold: threshold,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["products"] });
      
      // Call the parent callback to refresh the UI
      onThresholdUpdated();
      
      toast.success(`Updated threshold for ${productName}`, {
        description: `Minimum threshold is now set to ${threshold} units.`,
      });
      
      setOpen(false);
    } catch (error) {
      console.error("Error updating threshold:", error);
      toast.error("Failed to update threshold", {
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
          Set Threshold
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Stock Threshold</DialogTitle>
          <DialogDescription>
            Update the minimum threshold for {productName}. An alert will be triggered when stock falls below this level.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="threshold" className="text-right">
                Threshold
              </Label>
              <Input
                id="threshold"
                type="number"
                min="0"
                value={threshold}
                onChange={handleThresholdChange}
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