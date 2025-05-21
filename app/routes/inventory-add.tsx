import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import type { Route } from ".react-router/types/app/routes/+types/inventory-add";
import { api } from "~/lib/api";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Validation schema for our inventory item
const inventoryItemSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  quantity: z.coerce.number().int().min(0, "Quantity must be a positive number"),
  threshold: z.coerce.number().int().min(1, "Threshold must be at least 1"),
  image: z.custom<FileList>()
    .optional()
    .refine(
      (files) => !files || files.length === 0 || Array.from(files).every(file => file instanceof File), 
      "Please upload valid files"
    )
    .transform(files => files && files.length > 0 ? files[0] : undefined),
});

type InventoryFormValues = {
  name: string;
  description: string;
  quantity: number;
  threshold: number;
  image?: File;
};

// Initial form values
const defaultValues: Partial<InventoryFormValues> = {
  name: "",
  description: "",
  quantity: 0,
  threshold: 5,
};

export const AddInventoryPage = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with react-hook-form and zod validation
  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(inventoryItemSchema) as any,
    defaultValues,
  });

  // Handle form submission
  const onSubmit = async (data: InventoryFormValues) => {
    try {
      setIsSubmitting(true);
      console.log("Form data:", data);
      
      // Image handling logic 
      let imageUrl: string | undefined;
      if (data.image) {
        try {
          console.log("Uploading image:", data.image.name);
          
          // Get the image upload URL from our backend
          const { uploadUrl, fileUrl } = await api.getUploadUrl(
            data.image.name, 
            data.image.type
          );
          
          // Upload the image directly to S3 using the pre-signed URL
          await api.uploadFile(uploadUrl, data.image);
          
          // Use the file URL for the image URL
          imageUrl = fileUrl;
        } catch (uploadError) {
          console.error("Error uploading image:", uploadError);
          toast.error("Failed to upload image. The item will be created without an image.");
        }
      }

      // Create the inventory item object to send to the API
      const inventoryItem = {
        name: data.name,
        description: data.description,
        currentStock: data.quantity, // Note the field name difference
        minThreshold: data.threshold, // Note the field name difference
        imageUrl,
      };

      try {
        // Call the API to create the inventory item
        console.log("Sending to API:", inventoryItem);
        console.log("API URL being used:", import.meta.env.VITE_API_URL);
        
        try {
          const result = await api.inventory.createOrUpdate(inventoryItem);
          console.log("API response:", result);
          
          toast.success("Inventory item added successfully!");
          navigate("/"); // Redirect to home page after successful submission
        } catch (fetchError) {
          console.error("Fetch error details:", fetchError);
          // Try a simple fetch to see if it's a CORS issue
          const testResponse = await fetch(import.meta.env.VITE_API_URL + "/inventory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(inventoryItem),
            mode: "cors",
          });
          console.log("Direct fetch test response:", testResponse);
          throw fetchError;
        }
      } catch (apiError) {
        console.error("API error:", apiError);
        toast.error("Failed to save inventory item to the database. Please try again.");
        throw apiError; // Re-throw to be caught by the outer try-catch
      }
    } catch (error) {
      console.error("Error adding inventory item:", error);
      // Toast error is already shown in the inner catch blocks
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Add New Inventory Item</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter item name" {...field} />
                    </FormControl>
                    <FormDescription>
                      The name of your inventory item
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter item description"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      A detailed description of your inventory item
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormDescription>
                        Current stock quantity
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="threshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Threshold</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} />
                      </FormControl>
                      <FormDescription>
                        Alert will trigger when stock falls below this number
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="image"
                render={({ field: { value, onChange, ...fieldProps } }) => (
                  <FormItem>
                    <FormLabel>Product Image</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="image/*"
                        className="cursor-pointer"
                        onChange={(e) => {
                          onChange(e.target.files);
                        }}
                        {...fieldProps}
                      />
                    </FormControl>
                    <FormDescription>
                      Upload an image of your product (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Item"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <p className="text-sm text-muted-foreground">
            All fields marked with * are required
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AddInventoryPage;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Add Inventory Item" },
    { name: "description", content: "Add a new item to your inventory" },
  ];
}