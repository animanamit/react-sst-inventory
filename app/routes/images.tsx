import { useState, useEffect } from "react";
import type { Route } from "./+types/images";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Inventory Alert System" },
    { name: "description", content: "Track and manage your inventory!" },
  ];
}

const ImagesPage = () => {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    const generateUrl = async () => {
      try {
        // Get presigned URL from our API instead
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiUrl}/uploads/presigned-url`);
        if (!response.ok) {
          throw new Error('Failed to get presigned URL');
        }
        const data = await response.json();
        setUrl(data.url);
      } catch (error) {
        console.error('Error getting presigned URL:', error);
      }
    };
    generateUrl();
  }, []);
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-8">
        <h1 className="leading text-2xl font-bold text-gray-800 dark:text-gray-100">
          Inventory Alert System
        </h1>
        <div className="flex flex-col gap-4">
          <a
            href="/products"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Manage Products
          </a>
          <a
            href="/inventory"
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            Inventory Dashboard
          </a>
          <a
            href="/alerts"
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            View Alerts
          </a>
        </div>
        <form
          className="flex flex-row gap-4 mt-8"
          onSubmit={async (e) => {
            e.preventDefault();

            const form = e.target as HTMLFormElement;
            const fileInput = form.file as HTMLInputElement;
            const file = fileInput.files?.[0];

            if (!file || !url) return;

            try {
              const response = await fetch(url, {
                body: file,
                method: "PUT",
                headers: {
                  "Content-Type": file.type,
                  "Content-Disposition": `attachment; filename="${file.name}"`,
                },
              });

              if (response.ok) {
                // Redirect to the uploaded image
                const imageUrl = url.split("?")[0];
                window.location.href = imageUrl;
              } else {
                alert("Upload failed");
              }
            } catch (error) {
              console.error("Upload error:", error);
              alert("Upload failed");
            }
          }}
        >
          <input
            name="file"
            type="file"
            accept="image/png, image/jpeg"
            className="block w-full text-sm text-slate-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-violet-50 file:text-violet-700
              hover:file:bg-violet-100"
          />
          <button
            className="bg-violet-500 hover:bg-violet-700 text-white text-sm
            font-semibold py-2 px-4 rounded-full"
          >
            Upload Product Image
          </button>
        </form>
      </div>
    </div>
  );
};
export default ImagesPage;
