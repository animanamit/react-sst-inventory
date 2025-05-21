import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility for combining class names with Tailwind CSS
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Type safe assertion function - throws if condition is false
 * @param condition - Condition to check
 * @param message - Optional error message
 */
export function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

/**
 * Non-nullable type guard - checks if value is defined
 * @param value - Value to check
 * @returns True if value is not null or undefined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for error objects
 * @param error - Value to check
 * @returns True if value is an Error object
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Creates a debounced version of a function
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  
  return function(this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = undefined;
    }, delay);
  };
}

/**
 * Creates a throttled version of a function
 * @param fn - Function to throttle
 * @param limit - Throttle limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  
  return function(this: any, ...args: Parameters<T>) {
    const now = Date.now();
    
    if (now - lastCall < limit) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        lastCall = now;
        fn.apply(this, args);
      }, limit - (now - lastCall));
    } else {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}

/**
 * Format a number as currency
 * @param value - Number to format
 * @param currency - Currency code
 * @param locale - Locale for formatting
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Format a date with appropriate formatting
 * @param date - Date to format
 * @param format - Format type
 * @param locale - Locale for formatting
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | number,
  format: "short" | "medium" | "long" = "medium",
  locale: string = "en-US"
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  
  // Define format options based on the selected format
  let options: Intl.DateTimeFormatOptions;
  
  if (format === "short") {
    options = {
      month: "numeric",
      day: "numeric",
      year: "2-digit"
    };
  } else if (format === "medium") {
    options = {
      month: "short",
      day: "numeric",
      year: "numeric"
    };
  } else { // long format
    options = {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric"
    };
  }
  
  return new Intl.DateTimeFormat(locale, options).format(dateObj);
}

/**
 * Create a namespaced Storage wrapper
 * @param namespace - Namespace for storage keys
 * @returns Storage interface for the namespace
 */
export function createNamespacedStorage(namespace: string) {
  return {
    getItem(key: string): string | null {
      return localStorage.getItem(`${namespace}:${key}`);
    },
    
    setItem(key: string, value: string): void {
      localStorage.setItem(`${namespace}:${key}`, value);
    },
    
    removeItem(key: string): void {
      localStorage.removeItem(`${namespace}:${key}`);
    },
    
    clear(): void {
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`${namespace}:`)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
    },
    
    get length(): number {
      let count = 0;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`${namespace}:`)) {
          count++;
        }
      }
      
      return count;
    }
  };
}
