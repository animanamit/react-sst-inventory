"use strict";
/// <reference path="./.sst/platform/config.d.ts" />
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = $config({
    app: function (input) {
        return {
            name: "inventory",
            removal: "remove",
            protect: ["production"].includes(input === null || input === void 0 ? void 0 : input.stage),
            providers: {
                aws: {
                    profile: "animan",
                },
            },
            home: "aws",
        };
    },
    run: function () {
        return __awaiter(this, void 0, void 0, function () {
            var productsTable, inventoryTable, inventoryHistoryTable, alertsTable, bucket, vpc, cacheCluster, alertQueue, alertFunction, api, site;
            return __generator(this, function (_a) {
                productsTable = new sst.aws.Dynamo("ProductsTable", {
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
                inventoryTable = new sst.aws.Dynamo("InventoryTable", {
                    fields: {
                        productId: "string",
                        locationId: "string",
                    },
                    primaryIndex: { hashKey: "productId", rangeKey: "locationId" },
                });
                inventoryHistoryTable = new sst.aws.Dynamo("InventoryHistoryTable", {
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
                alertsTable = new sst.aws.Dynamo("AlertsTable", {
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
                bucket = new sst.aws.Bucket("ProductImagesBucket", {
                    access: "public",
                    cors: {
                        allowMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
                        allowOrigins: ["*"], // Restrict this in production
                        allowHeaders: ["*"],
                    },
                });
                vpc = new sst.aws.Vpc("RedisVpc");
                cacheCluster = new sst.aws.Redis("ElastiCacheCluster", {
                    vpc: vpc,
                    engine: "redis"
                });
                alertQueue = new sst.aws.Queue("AlertsQueue");
                alertFunction = new sst.aws.Function("AlertsFunction", {
                    handler: "packages/functions/src/alerts/process-alerts.handler",
                    timeout: "60 seconds",
                    environment: {
                        ALERTS_TABLE: alertsTable.name,
                        PRODUCTS_TABLE: productsTable.name,
                    },
                    // Permissions would need to be specified in a different format - removed for typechecking
                });
                api = new sst.aws.ApiGatewayV2("InventoryApi", {
                    cors: {
                        allowHeaders: ["*"],
                        allowMethods: ["*"],
                        allowOrigins: ["*"],
                    },
                });
                /* ───────────── Products ───────────── */
                api.route("GET /products", {
                    handler: "packages/functions/src/products/getAll.handler",
                    link: [productsTable, cacheCluster],
                    environment: {
                        PRODUCTS_TABLE: productsTable.name,
                        REDIS_HOST: cacheCluster.host,
                        REDIS_PORT: "6379", // Hardcoded for typechecking
                        REDIS_KEY_PREFIX: "inventory:",
                        REDIS_ENABLED: "true",
                        REDIS_TTL: "3600", // Cache for 1 hour
                    },
                });
                api.route("GET /products/{id}", {
                    handler: "packages/functions/src/products/getById.handler",
                    link: [productsTable, cacheCluster],
                    environment: {
                        PRODUCTS_TABLE: productsTable.name,
                        REDIS_HOST: cacheCluster.host,
                        REDIS_PORT: "6379", // Hardcoded for typechecking
                        REDIS_KEY_PREFIX: "inventory:",
                        REDIS_ENABLED: "true",
                        REDIS_TTL: "3600", // Cache for 1 hour
                    },
                });
                api.route("POST /products", {
                    handler: "packages/functions/src/products/create.handler",
                    link: [productsTable, bucket, cacheCluster],
                    environment: {
                        PRODUCTS_TABLE: productsTable.name,
                        BUCKET_NAME: bucket.name,
                        REDIS_HOST: cacheCluster.host,
                        REDIS_PORT: "6379", // Hardcoded for typechecking
                        REDIS_KEY_PREFIX: "inventory:",
                        REDIS_ENABLED: "true",
                    },
                });
                api.route("PUT /products/{id}", {
                    handler: "packages/functions/src/products/update.handler",
                    link: [productsTable, bucket, cacheCluster],
                    environment: {
                        PRODUCTS_TABLE: productsTable.name,
                        BUCKET_NAME: bucket.name,
                        REDIS_HOST: cacheCluster.host,
                        REDIS_PORT: "6379", // Hardcoded for typechecking
                        REDIS_KEY_PREFIX: "inventory:",
                        REDIS_ENABLED: "true",
                    },
                });
                api.route("DELETE /products/{id}", {
                    handler: "packages/functions/src/products/delete.handler",
                    link: [productsTable, bucket, cacheCluster],
                    environment: {
                        PRODUCTS_TABLE: productsTable.name,
                        BUCKET_NAME: bucket.name,
                        REDIS_HOST: cacheCluster.host,
                        REDIS_PORT: "6379", // Hardcoded for typechecking
                        REDIS_KEY_PREFIX: "inventory:",
                        REDIS_ENABLED: "true",
                    },
                });
                api.route("POST /products/seed", {
                    handler: "packages/functions/src/products/seedMockData.handler",
                    link: [productsTable, inventoryTable, cacheCluster],
                    environment: {
                        PRODUCTS_TABLE: productsTable.name,
                        INVENTORY_TABLE: inventoryTable.name,
                        REDIS_HOST: cacheCluster.host,
                        REDIS_PORT: "6379", // Hardcoded for typechecking
                        REDIS_KEY_PREFIX: "inventory:",
                        REDIS_ENABLED: "true",
                    },
                });
                /* ───────────── Inventory ───────────── */
                api.route("GET /inventory", {
                    handler: "packages/functions/src/inventory/getAll.handler",
                    link: [inventoryTable, productsTable, cacheCluster],
                    environment: {
                        INVENTORY_TABLE: inventoryTable.name,
                        PRODUCTS_TABLE: productsTable.name,
                        REDIS_HOST: cacheCluster.host,
                        REDIS_PORT: "6379", // Hardcoded for typechecking
                        REDIS_KEY_PREFIX: "inventory:",
                        REDIS_ENABLED: "true",
                        REDIS_TTL: "1800", // Cache for 30 minutes
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
                    link: [
                        inventoryTable,
                        inventoryHistoryTable,
                        alertsTable,
                        productsTable,
                        alertQueue,
                        cacheCluster,
                    ],
                    environment: {
                        INVENTORY_TABLE: inventoryTable.name,
                        PRODUCTS_TABLE: productsTable.name,
                        INVENTORY_HISTORY_TABLE: inventoryHistoryTable.name,
                        ALERTS_TABLE: alertsTable.name,
                        ALERTS_QUEUE: alertQueue.url,
                        REDIS_HOST: cacheCluster.host,
                        REDIS_PORT: "6379", // Hardcoded for typechecking
                        REDIS_KEY_PREFIX: "inventory:",
                        REDIS_ENABLED: "true",
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
                // Redis test endpoint
                api.route("GET /test/redis", {
                    handler: "packages/functions/src/utils/test-redis.handler",
                    link: [cacheCluster],
                    environment: {
                        REDIS_HOST: cacheCluster.host,
                        REDIS_PORT: "6379", // Hardcoded for typechecking
                        REDIS_KEY_PREFIX: "test:",
                        REDIS_ENABLED: "true",
                        REDIS_TTL: "60", // Short TTL for tests
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
                site = new sst.aws.React("InventoryWeb", {
                    path: ".",
                    link: [productsTable, inventoryTable, alertsTable, bucket, api],
                    environment: {
                        // Environment variables for the frontend
                        VITE_API_URL: api.url,
                        VITE_REGION: "ap-southeast-1", // Use input or default
                    },
                });
                // Export values
                return [2 /*return*/, {
                        // Return output values from your stack
                        API_URL: api.url,
                        SITE_URL: site.url,
                    }];
            });
        });
    },
});
