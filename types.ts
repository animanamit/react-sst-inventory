export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  threshold: number;
  imageUrl: string;
}

export interface Alert {
  id: string;
  item: InventoryItem;
  createdAt: string;
  acknowledgedAt?: string;
  message: string;
}
