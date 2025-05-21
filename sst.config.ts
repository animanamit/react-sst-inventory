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
    const alertQueue = new sst.aws.Queue("AlertsQueue", {
      consumer: {
        function: {
          handler: "packages/functions/src/alerts/process-alerts.handler",
          timeout: "60 seconds",
          environment: {
            ALERTS_TABLE: alertsTable.name,
            PRODUCTS_TABLE: productsTable.name,
          },
          bind: [alertsTable, productsTable],
        },
      },
      // Configure SQS FIFO queue for exactly-once processing
      cdk: {
        queue: {
          fifo: true,
          contentBasedDeduplication: true,
          deliveryDelay: 0,
          retentionPeriod: 1209600, // 14 days (maximum)
        },
      },
    });

    const api = new sst.aws.ApiGatewayV2("InventoryApi", {
      cors: {
        allowHeaders: ["*"],
        allowMethods: ["*"],
        allowOrigins: ["*"],
      },
    });

    /* ───────────── Products ───────────── */
    api.route("GET /products", {
      handler: "packages/functions/src/products/getAll.handler",
      link: [productsTable],
      environment: {
        PRODUCTS_TABLE: productsTable.name,
      },
    });

    api.route("GET /products/{id}", {
      handler: "packages/functions/src/products/getById.handler",
      link: [productsTable],
      environment: {
        PRODUCTS_TABLE: productsTable.name,
      },
    });

    api.route("POST /products", {
      handler: "packages/functions/src/products/create.handler",
      link: [productsTable, bucket],
      environment: {
        PRODUCTS_TABLE: productsTable.name,
        BUCKET_NAME: bucket.name,
      },
    });

    api.route("PUT /products/{id}", {
      handler: "packages/functions/src/products/update.handler",
      link: [productsTable, bucket],
      environment: {
        PRODUCTS_TABLE: productsTable.name,
        BUCKET_NAME: bucket.name,
      },
    });

    api.route("DELETE /products/{id}", {
      handler: "packages/functions/src/products/delete.handler",
      link: [productsTable, bucket],
      environment: {
        PRODUCTS_TABLE: productsTable.name,
        BUCKET_NAME: bucket.name,
      },
    });
    
    api.route("POST /products/seed", {
      handler: "packages/functions/src/products/seedMockData.handler",
      link: [productsTable, inventoryTable],
      environment: {
        PRODUCTS_TABLE: productsTable.name,
        INVENTORY_TABLE: inventoryTable.name,
      },
    });

    /* ───────────── Inventory ───────────── */
    api.route("GET /inventory", {
      handler: "packages/functions/src/inventory/getAll.handler",
      link: [inventoryTable, productsTable],
      environment: {
        INVENTORY_TABLE: inventoryTable.name,
        PRODUCTS_TABLE: productsTable.name,
      },
    });

    api.route("GET /inventory/{productId}/{locationId}", {
      handler: "packages/functions/src/inventory/getItem.handler",
      link: [inventoryTable],
      environment: {
        INVENTORY_TABLE: inventoryTable.name,
      },
    });

    api.route("POST /inventory", {
      handler: "packages/functions/src/inventory/adjustStock.handler",
      link: [inventoryTable, inventoryHistoryTable, alertsTable, productsTable, alertQueue],
      environment: {
        INVENTORY_TABLE: inventoryTable.name,
        PRODUCTS_TABLE: productsTable.name,
        INVENTORY_HISTORY_TABLE: inventoryHistoryTable.name,
        ALERTS_TABLE: alertsTable.name,
        ALERTS_QUEUE: alertQueue.queueUrl,
      },
    });

    api.route("GET /inventory/history/{productId}", {
      handler: "packages/functions/src/inventory/getHistory.handler",
      link: [inventoryHistoryTable],
      environment: {
        INVENTORY_HISTORY_TABLE: inventoryHistoryTable.name,
      },
    });
    
    // Debug endpoint to verify database contents
    api.route("GET /debug", {
      handler: "packages/functions/src/inventory/debug.handler",
      link: [productsTable, inventoryTable, inventoryHistoryTable, alertsTable],
      environment: {
        PRODUCTS_TABLE: productsTable.name,
        INVENTORY_TABLE: inventoryTable.name,
        INVENTORY_HISTORY_TABLE: inventoryHistoryTable.name,
        ALERTS_TABLE: alertsTable.name,
      },
    });

    /* ───────────── Alerts ───────────── */
    api.route("GET /alerts", {
      handler: "packages/functions/src/alerts/getAll.handler",
      link: [alertsTable],
      environment: {
        ALERTS_TABLE: alertsTable.name,
      },
    });

    api.route("GET /alerts/{id}", {
      handler: "packages/functions/src/alerts/getById.handler",
      link: [alertsTable],
      environment: {
        ALERTS_TABLE: alertsTable.name,
      },
    });

    api.route("PUT /alerts/{id}/acknowledge", {
      handler: "packages/functions/src/alerts/acknowledge.handler",
      link: [alertsTable],
      environment: {
        ALERTS_TABLE: alertsTable.name,
      },
    });
    
    api.route("POST /alerts", {
      handler: "packages/functions/src/alerts/create.handler",
      link: [alertsTable],
      environment: {
        ALERTS_TABLE: alertsTable.name,
      },
    });
    
    api.route("POST /alerts/check-all", {
      handler: "packages/functions/src/alerts/check-all.handler",
      link: [alertsTable, inventoryTable, productsTable],
      environment: {
        ALERTS_TABLE: alertsTable.name,
        INVENTORY_TABLE: inventoryTable.name,
        PRODUCTS_TABLE: productsTable.name,
      },
    });

    /* ───────────── File Uploads ───────────── */
    api.route("GET /uploads/presigned-url", {
      handler: "packages/functions/src/uploads/getSignedUrl.handler",
      link: [bucket],
      environment: {
        BUCKET_NAME: bucket.name,
      },
    });

    // Set up React frontend
    const site = new sst.aws.React("InventoryWeb", {
      path: ".",
      link: [productsTable, inventoryTable, alertsTable, bucket, api],
      environment: {
        // Environment variables for the frontend
        VITE_API_URL: api.url,
        VITE_REGION: "ap-southeast-1", // Use input or default
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
