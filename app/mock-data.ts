import type { Alert, InventoryItem } from "../types";

export const sampleActiveAlerts: Alert[] = [
  {
    id: "alert-1",
    itemId: "2",
    itemName: "Leather Wallet",
    currentQuantity: 12,
    threshold: 15,
    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    acknowledged: false,
  },
  {
    id: "alert-2",
    itemId: "3",
    itemName: "Wireless Headphones",
    currentQuantity: 8,
    threshold: 10,
    timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    acknowledged: false,
  },
  {
    id: "alert-3",
    itemId: "6",
    itemName: "Bamboo Cutting Board",
    currentQuantity: 7,
    threshold: 8,
    timestamp: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
    acknowledged: false,
  },
];

export const sampleAlertHistory: Alert[] = [
  {
    id: "alert-history-1",
    itemId: "5",
    itemName: "Stainless Steel Water Bottle",
    currentQuantity: 18,
    threshold: 20,
    timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    acknowledged: true,
    acknowledgedAt: new Date(Date.now() - 82800000).toISOString(), // 23 hours ago
  },
  {
    id: "alert-history-2",
    itemId: "8",
    itemName: "Leather Journal",
    currentQuantity: 9,
    threshold: 10,
    timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    acknowledged: true,
    acknowledgedAt: new Date(Date.now() - 169200000).toISOString(), // 47 hours ago
  },
];

export const mockInventoryData: InventoryItem[] = [
  {
    id: "1",
    name: "Organic Cotton T-Shirt",
    description: "Soft, eco-friendly cotton t-shirt in various colors.",
    quantity: 45,
    threshold: 20,
    imageUrl: "/plain-white-tshirt.png",
  },
  {
    id: "2",
    name: "Handcrafted Ceramic Mug",
    description: "Artisan-made ceramic mug, perfect for coffee or tea.",
    quantity: 12,
    threshold: 15,
    imageUrl: "/ceramic-mug.png",
  },
  {
    id: "3",
    name: "Leather Wallet",
    description: "Premium leather wallet with multiple card slots.",
    quantity: 8,
    threshold: 10,
    imageUrl: "/leather-wallet-contents.png",
  },
  {
    id: "4",
    name: "Stainless Steel Water Bottle",
    description: "Eco-friendly, double-walled insulated water bottle.",
    quantity: 30,
    threshold: 25,
    imageUrl: "/reusable-water-bottle.png",
  },
  {
    id: "5",
    name: "Wireless Earbuds",
    description: "Bluetooth earbuds with charging case and noise cancellation.",
    quantity: 5,
    threshold: 8,
    imageUrl: "/wireless-earbuds-charging-case.png",
  },
  {
    id: "6",
    name: "Scented Candle",
    description: "Hand-poured soy wax candle with essential oils.",
    quantity: 18,
    threshold: 12,
    imageUrl: "/lit-candle.png",
  },
  {
    id: "7",
    name: "Bamboo Cutting Board",
    description: "Sustainable bamboo cutting board for kitchen use.",
    quantity: 0,
    threshold: 5,
    imageUrl: "/wooden-cutting-board.png",
  },
  {
    id: "8",
    name: "Organic Lip Balm",
    description: "Natural lip balm made with organic ingredients.",
    quantity: 22,
    threshold: 15,
    imageUrl: "/lip-balm.png",
  },
  {
    id: "9",
    name: "Recycled Paper Notebook",
    description: "Eco-friendly notebook made from recycled paper.",
    quantity: 3,
    threshold: 10,
    imageUrl: "/open-notebook-desk.png",
  },
  {
    id: "10",
    name: "Handmade Soap Bar",
    description: "Natural soap bar made with essential oils and botanicals.",
    quantity: 14,
    threshold: 12,
    imageUrl: "/bar-of-lavender-soap.png",
  },
];
