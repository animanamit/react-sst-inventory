import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  // Product routes
  // route("products", "routes/products.tsx"),
  // { path: "products/:id", lazy: () => import("./routes/products/detail.tsx") },
  // Inventory routes
  // { path: "inventory", lazy: () => import("./routes/inventory/index.tsx") },
  // {
  //   path: "inventory/:id",
  //   lazy: () => import("./routes/inventory/detail.tsx"),
  // },
  route("/inventory-add", "routes/inventory-add.tsx"),
  // Alert routes
  // { path: "alerts", lazy: () => import("./routes/alerts/index.tsx") },
  route("/images", "routes/images.tsx"),
] satisfies RouteConfig;
