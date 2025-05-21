import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import type { Route } from ".react-router/types/app/routes/+types/product-add";
import { api } from "~/lib/api";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
import { useMutation } from "@tanstack/react-query";

// Validation schema for our product
const productSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.string().optional(),
  sku: z.string().optional(),
  initialStock: z.coerce
    .number()
    .int()
    .min(0, "Initial stock must be a positive number"),
  minThreshold: z.coerce.number().int().min(1, "Threshold must be at least 1"),
  image: z
    .custom<FileList>()
    .optional()
    .refine(
      (files) =>
        !files ||
        files.length === 0 ||
        Array.from(files).every((file) => file instanceof File),
      "Please upload valid files"
    )
    .transform((files) => (files && files.length > 0 ? files[0] : undefined)),
});

type ProductFormValues = {
  name: string;
  description: string;
  category?: string;
  sku?: string;
  initialStock: number;
  minThreshold: number;
  image?: File;
};

// Initial form values
const defaultValues: Partial<ProductFormValues> = {
  name: "",
  description: "",
  category: "",
  sku: "",
  initialStock: 0,
  minThreshold: 5,
};

export const AddProductPage = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with react-hook-form and zod validation
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues,
  });

  // Mutation for creating a product
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      // Handle image upload if provided
      let imageUrl: string | undefined;
      if (data.image) {
        try {
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
          toast.error(
            "Failed to upload image. The product will be created without an image."
          );
        }
      }

      // First create the product
      const productData = {
        name: data.name,
        description: data.description,
        category: data.category,
        sku: data.sku,
        minThreshold: data.minThreshold,
        imageUrl,
      };

      const result = await api.products.createOrUpdate(productData);

      // If initial stock is greater than 0, also create an inventory record
      if (data.initialStock > 0) {
        await api.inventory.adjustStock({
          productId: result.product.productId,
          changeAmount: data.initialStock,
          reason: "Initial stock on product creation",
        });
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Product added successfully!");
      navigate("/");
    },
    onError: (error) => {
      console.error("Error creating product:", error);
      toast.error("Failed to create product. Please try again.");
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Handle form submission
  const onSubmit = (data: ProductFormValues) => {
    setIsSubmitting(true);
    createProductMutation.mutate(data);
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Add New Product</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter product name" {...field} />
                    </FormControl>
                    <FormDescription>The name of your product</FormDescription>
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
                        placeholder="Enter product description"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      A detailed description of your product
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Electronics, Clothing"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Product category (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. PROD-001" {...field} />
                      </FormControl>
                      <FormDescription>
                        Stock keeping unit (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="initialStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Stock</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormDescription>
                        Starting inventory quantity
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Threshold</FormLabel>
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
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Product"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <p className="text-sm text-muted-foreground">
            Fields marked with * are required
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AddProductPage;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Add Product" },
    { name: "description", content: "Add a new product to your inventory" },
  ];
}
