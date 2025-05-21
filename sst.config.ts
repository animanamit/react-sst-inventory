/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "inventory",
      removal: "remove",
      protect: ["production"].includes(input?.stage),
      providers: {
        aws: {
          profile: "animan",
        },
      },
      home: "aws",
    };
  },
  async run() {
    const productsTable = new sst.aws.Dynamo("ProductsTable", {
      fields: {
        productId: "string",
        sku: "string",
        category: "string",
      },
      primaryIndex: { hashKey: "productId" },
      globalIndexes: {
        skuIndex: { hashKey: "sku" },
        categoryIndex: { hashKey: "category" },
      },
    });

    const inventoryTable = new sst.aws.Dynamo("InventoryTable", {
      fields: {
        productId: "string",
        locationId: "string",
      },
      primaryIndex: { hashKey: "productId", rangeKey: "locationId" },
    });

    const inventoryHistoryTable = new sst.aws.Dynamo("InventoryHistoryTable", {
      fields: {
        productId: "string",
        timestamp: "number",
        locationId: "string",
      },
      primaryIndex: {
        hashKey: "productId",
        rangeKey: "timestamp",
      },
      globalIndexes: {
        locationIndex: {
          hashKey: "locationId",
          rangeKey: "timestamp",
        },
      },
    });

    const alertsTable = new sst.aws.Dynamo("AlertsTable", {
      fields: {
        alertId: "string",
        productId: "string",
        status: "string",
        createdAt: "number",
      },
      primaryIndex: { hashKey: "alertId" },
      globalIndexes: {
        productIndex: {
          hashKey: "productId",
          rangeKey: "createdAt",
        },
        statusIndex: {
          hashKey: "status",
          rangeKey: "createdAt",
        },
      },
    });

    // S3 bucket for product images
    const bucket = new sst.aws.Bucket("ProductImagesBucket", {
      access: "public",
      cors: {
        allowMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
        allowOrigins: ["*"], // Restrict this in production
        allowHeaders: ["*"],
      },
    });

    // Set up the SQS alert queue
    const alertQueue = new sst.aws.Queue("AlertsQueue");

    const api = new sst.aws.ApiGatewayV2("InventoryApi", {
      cors: {
        allowHeaders: ["*"],
        allowMethods: ["*"],
        allowOrigins: ["http://localhost:3000"],
        allowCredentials: true,
      },
    });

    /* ───────────── Products ───────────── */
    api.route("GET /products", {
      handler: "packages/functions/src/products/getAll.handler",
      link: [productsTable],
    });

    api.route("GET /products/{id}", {
      handler: "packages/functions/src/products/getById.handler",
      link: [productsTable],
    });

    api.route("POST /products", {
      handler: "packages/functions/src/products/create.handler",
      link: [productsTable, bucket],
    });

    api.route("PUT /products/{id}", {
      handler: "packages/functions/src/products/update.handler",
      link: [productsTable, bucket],
    });

    api.route("DELETE /products/{id}", {
      handler: "packages/functions/src/products/delete.handler",
      link: [productsTable, bucket],
    });

    /* ───────────── Inventory ───────────── */
    api.route("GET /inventory", {
      handler: "packages/functions/src/inventory/getAll.handler",
      link: [inventoryTable, productsTable],
    });

    api.route("GET /inventory/{productId}/{locationId}", {
      handler: "packages/functions/src/inventory/getItem.handler",
      link: [inventoryTable],
    });

    api.route("POST /inventory", {
      handler: "packages/functions/src/inventory/updateStock.handler",
      link: [inventoryTable, inventoryHistoryTable, alertsTable, alertQueue],
    });

    api.route("GET /inventory/history/{productId}", {
      handler: "packages/functions/src/inventory/getHistory.handler",
      link: [inventoryHistoryTable],
    });

    /* ───────────── Alerts ───────────── */
    api.route("GET /alerts", {
      handler: "packages/functions/src/alerts/getAll.handler",
      link: [alertsTable],
    });

    api.route("GET /alerts/{id}", {
      handler: "packages/functions/src/alerts/getById.handler",
      link: [alertsTable],
    });

    api.route("PUT /alerts/{id}/acknowledge", {
      handler: "packages/functions/src/alerts/acknowledge.handler",
      link: [alertsTable],
    });

    /* ───────────── File Uploads ───────────── */
    api.route("GET /uploads/presigned-url", {
      handler: "packages/functions/src/uploads/getSignedUrl.handler",
      link: [bucket],
    });

    // Set up React frontend
    const site = new sst.aws.React("InventoryWeb", {
      path: ".",
      link: [productsTable, inventoryTable, alertsTable, bucket, api],
      environment: {
        // Environment variables for the frontend
        VITE_API_URL: api.url,
        VITE_REGION: "ap-southeast-1", // Update with your region
      },
    });

    // Export values
    return {
      // Return output values from your stack
      API_URL: api.url,
      SITE_URL: site.url,
    };
  },
});
