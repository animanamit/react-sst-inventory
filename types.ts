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
  itemId: string;
  itemName: string;
  currentQuantity: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}
