/**
 * Utilities for seeding the database with mock data
 */

import { api } from "./api";
import { toast } from "sonner";

/**
 * Seeds the database with mock product and inventory data
 * Shows toast notifications for the process and results
 * @returns A promise that resolves when the seeding process is complete
 */
export const seedDatabase = async (): Promise<void> => {
  // Track loading state with toast
  const seedingToast = toast.loading("Seeding database with mock data...");

  try {
    // Apply timeout to ensure notification displays properly
    await new Promise(resolve => setTimeout(resolve, 500));

    // Call the API to seed data
    const result = await api.products.seedMockData();
    
    console.log("Seed result:", result);
    toast.dismiss(seedingToast);
    
    // Calculate success count for products
    const successCount = (result as any).details?.filter(
      (r: any) => r.type === "product" && r.success
    ).length || 0;
    
    toast.success(`Database seeded successfully! Created ${successCount} products with inventory.`);
    
    // Return a resolved promise after the operation completes
    return Promise.resolve();
  } catch (error) {
    console.error("Seeding error:", error);
    toast.dismiss(seedingToast);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Unknown error";
      
    toast.error(`Failed to seed database: ${errorMessage}`);
    
    // Return a resolved promise to allow proper error handling by the caller
    return Promise.resolve();
  }
};