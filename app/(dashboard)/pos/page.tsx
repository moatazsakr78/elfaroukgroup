"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useCart, CartProvider } from "@/lib/contexts/CartContext";
import { useCartBadge } from "@/lib/hooks/useCartBadge";
import CartModal from "@/app/components/CartModal";
import { useCompanySettings } from "@/lib/hooks/useCompanySettings";
import {
  ProductGridImage,
  ProductModalImage,
  ProductThumbnail,
} from "../../components/ui/OptimizedImage";
import { usePerformanceMonitor } from "../../lib/utils/performanceMonitor";
import { useSystemCurrency, useFormatPrice } from "@/lib/hooks/useCurrency";

// Editable Field Component for inline editing
interface EditableFieldProps {
  value: number;
  type?: string;
  step?: string;
  onUpdate: (value: number) => void;
  className?: string;
}

function EditableField({
  value,
  type = "text",
  step,
  onUpdate,
  className = "",
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value.toString());

  const handleClick = () => {
    setIsEditing(true);
    setTempValue(value.toString());
  };

  const handleSubmit = () => {
    const numValue = parseFloat(tempValue);
    if (!isNaN(numValue) && numValue >= 0) {
      onUpdate(numValue);
    }
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setTempValue(value.toString());
    }
  };

  if (isEditing) {
    return (
      <input
        type={type}
        step={step}
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyPress}
        className={`${className} ring-1 ring-blue-500`}
        autoFocus
        onFocus={(e) => e.target.select()}
      />
    );
  }

  return (
    <span
      onClick={handleClick}
      className={`${className} cursor-pointer`}
      title="اضغط للتعديل"
    >
      {value}
    </span>
  );
}

import { supabase } from "../../lib/supabase/client";
import { Category } from "../../types";
import ResizableTable from "../../components/tables/ResizableTable";
import Sidebar from "../../components/layout/Sidebar";
import TopHeader from "../../components/layout/TopHeader";
import RecordsSelectionModal from "../../components/RecordsSelectionModal";
import CustomerSelectionModal from "../../components/CustomerSelectionModal";
import BranchSelectionModal from "../../components/BranchSelectionModal";
import HistoryModal from "../../components/HistoryModal";
import AddToCartModal from "../../components/AddToCartModal";
import ColorSelectionModal from "../../components/ColorSelectionModal";
import SupplierSelectionModal from "../../components/SupplierSelectionModal";
import WarehouseSelectionModal from "../../components/WarehouseSelectionModal";
import TransferLocationModal from "../../components/TransferLocationModal";
import QuickAddProductModal from "../../components/QuickAddProductModal";
import ColumnsControlModal from "../../components/ColumnsControlModal";
import PaymentSplit from "../../components/PaymentSplit";
import { useProducts, Product } from "../../lib/hooks/useProductsOptimized";
import { usePersistentSelections } from "../../lib/hooks/usePersistentSelections";
import { usePOSTabs } from "@/lib/hooks/usePOSTabs";
import {
  createSalesInvoice,
  CartItem,
} from "../../lib/invoices/createSalesInvoice";
import { createPurchaseInvoice } from "../../lib/invoices/createPurchaseInvoice";
import { createTransferInvoice } from "../../lib/invoices/createTransferInvoice";
import {
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
  PlusIcon,
  ShoppingCartIcon,
  HomeIcon,
  BuildingOfficeIcon,
  ArrowsRightLeftIcon,
  UserIcon,
  DocumentTextIcon,
  TableCellsIcon,
  CogIcon,
  EyeIcon,
  XMarkIcon,
  ClockIcon,
  ShoppingBagIcon,
  BuildingStorefrontIcon,
  ArrowUturnLeftIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";

function POSPageContent() {
  // OPTIMIZED: Performance monitoring for POS page
  const { startRender, endRender } = usePerformanceMonitor("POSPage");
  const systemCurrency = useSystemCurrency();
  const formatPrice = useFormatPrice();
  const { companyName, logoUrl } = useCompanySettings();

  const [searchQuery, setSearchQuery] = useState("");
  // Keep CartContext for website functionality
  const {
    cartItems: webCartItems,
    addToCart: webAddToCart,
    removeFromCart: webRemoveFromCart,
    updateQuantity: webUpdateQuantity,
    clearCart: webClearCart,
  } = useCart();
  const { cartBadgeCount } = useCartBadge();

  // POS Tabs Management
  const {
    tabs: posTabs,
    activeTab: activePOSTab,
    activeTabId,
    addTab,
    closeTab,
    switchTab,
    updateActiveTabCart,
    updateActiveTabSelections,
    clearActiveTabCart,
    isLoading: isLoadingTabs,
  } = usePOSTabs();

  // Dedicated POS Cart State (separate from website cart)
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRecordsModalOpen, setIsRecordsModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid");
  const [isCartOpen, setIsCartOpen] = useState(true); // Default open for desktop, toggle for mobile;
  const [showProductModal, setShowProductModal] = useState(false);
  const [showAddToCartModal, setShowAddToCartModal] = useState(false);
  const [showColorSelectionModal, setShowColorSelectionModal] = useState(false);
  const [modalProduct, setModalProduct] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isProcessingInvoice, setIsProcessingInvoice] = useState(false);

  // Purchase Mode States
  const [isPurchaseMode, setIsPurchaseMode] = useState(false);
  const [showPurchaseModeConfirm, setShowPurchaseModeConfirm] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [showQuickAddProductModal, setShowQuickAddProductModal] =
    useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<{
    [key: string]: boolean;
  }>({});
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);

  // Returns State - simple toggle
  const [isReturnMode, setIsReturnMode] = useState(false);

  // Transfer Mode States
  const [isTransferMode, setIsTransferMode] = useState(false);
  const [transferFromLocation, setTransferFromLocation] = useState<any>(null);
  const [transferToLocation, setTransferToLocation] = useState<any>(null);
  const [isTransferLocationModalOpen, setIsTransferLocationModalOpen] =
    useState(false);

  // Print Receipt States
  const [showPrintReceiptModal, setShowPrintReceiptModal] = useState(false);
  const [lastInvoiceData, setLastInvoiceData] = useState<any>(null);

  // Add Tab Modal States
  const [showAddTabModal, setShowAddTabModal] = useState(false);
  const [newTabName, setNewTabName] = useState("");

  // Payment Split States
  const [paymentSplitData, setPaymentSplitData] = useState<any[]>([]);
  const [creditAmount, setCreditAmount] = useState<number>(0);

  // Use persistent selections hook
  const {
    selections,
    isLoaded: selectionsLoaded,
    setRecord,
    setCustomer,
    setBranch,
    clearSelections,
    resetToDefaultCustomer,
    hasRequiredForCart,
    hasRequiredForSale,
  } = usePersistentSelections();

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Get products and branches data using the same hook as products page
  const { products, branches, isLoading, error, fetchProducts } = useProducts();

  // Generate dynamic table columns based on branches - same as Products page
  const dynamicTableColumns = useMemo(() => {
    const baseColumns = [
      {
        id: "index",
        header: "#",
        accessor: "#",
        width: 60,
        render: (value: any, item: any, index: number) => (
          <span className="text-gray-400 font-medium">{index + 1}</span>
        ),
      },
      {
        id: "name",
        header: "اسم المنتج",
        accessor: "name",
        width: 200,
        render: (value: string) => (
          <span className="text-white font-medium">{value}</span>
        ),
      },
      {
        id: "group",
        header: "المجموعة",
        accessor: "category",
        width: 100,
        render: (value: any) => (
          <span className="text-gray-300">{value?.name || "غير محدد"}</span>
        ),
      },
      {
        id: "totalQuantity",
        header: "كمية كلية",
        accessor: "totalQuantity",
        width: 120,
        render: (value: number) => (
          <span className="text-blue-400 font-medium">قطعة {value}</span>
        ),
      },
      {
        id: "buyPrice",
        header: "سعر الشراء",
        accessor: "cost_price",
        width: 120,
        render: (value: number) => (
          <span className="text-white">{(value || 0).toFixed(2)}</span>
        ),
      },
      {
        id: "sellPrice",
        header: "سعر البيع",
        accessor: "price",
        width: 120,
        render: (value: number) => (
          <span className="text-white">{(value || 0).toFixed(2)}</span>
        ),
      },
      {
        id: "wholeSalePrice",
        header: "سعر الجملة",
        accessor: "wholesale_price",
        width: 120,
        render: (value: number) => (
          <span className="text-white">{(value || 0).toFixed(2)}</span>
        ),
      },
      {
        id: "sellPrice1",
        header: "سعر 1",
        accessor: "price1",
        width: 100,
        render: (value: number) => (
          <span className="text-white">{(value || 0).toFixed(2)}</span>
        ),
      },
      {
        id: "sellPrice2",
        header: "سعر 2",
        accessor: "price2",
        width: 100,
        render: (value: number) => (
          <span className="text-white">{(value || 0).toFixed(2)}</span>
        ),
      },
      {
        id: "sellPrice3",
        header: "سعر 3",
        accessor: "price3",
        width: 100,
        render: (value: number) => (
          <span className="text-white">{(value || 0).toFixed(2)}</span>
        ),
      },
      {
        id: "sellPrice4",
        header: "سعر 4",
        accessor: "price4",
        width: 100,
        render: (value: number) => (
          <span className="text-white">{(value || 0).toFixed(2)}</span>
        ),
      },
      {
        id: "location",
        header: "الموقع",
        accessor: "location",
        width: 100,
        render: (value: string) => (
          <span className="text-gray-300">{value || "-"}</span>
        ),
      },
      {
        id: "barcode",
        header: "الباركود",
        accessor: "barcode",
        width: 150,
        render: (value: string) => (
          <span className="text-gray-300 font-mono text-sm">
            {value || "-"}
          </span>
        ),
      },
    ];

    // Add dynamic branch quantity columns
    const branchColumns = branches.map((branch) => ({
      id: `branch_${branch.id}`,
      header: branch.name,
      accessor: `branch_${branch.id}`,
      width: 120,
      render: (value: any, item: Product) => {
        const inventoryData = item.inventoryData?.[branch.id];
        const quantity = inventoryData?.quantity || 0;
        return (
          <span className="text-blue-400 font-medium">قطعة {quantity}</span>
        );
      },
    }));

    // Add dynamic branch min stock columns
    const minStockColumns = branches.map((branch) => ({
      id: `min_stock_${branch.id}`,
      header: `منخفض - ${branch.name}`,
      accessor: `min_stock_${branch.id}`,
      width: 150,
      render: (value: any, item: Product) => {
        const inventoryData = item.inventoryData?.[branch.id];
        const minStock = inventoryData?.min_stock || 0;
        const quantity = inventoryData?.quantity || 0;

        // Show warning style if quantity is below or equal to min stock
        const isLowStock = quantity <= minStock && minStock > 0;

        return (
          <span
            className={`font-medium ${isLowStock ? "text-red-400" : "text-yellow-400"}`}
          >
            {minStock} قطعة
          </span>
        );
      },
    }));

    // Add dynamic branch variants columns
    const variantColumns = branches.map((branch) => ({
      id: `variants_${branch.id}`,
      header: `الأشكال والألوان - ${branch.name}`,
      accessor: `variants_${branch.id}`,
      width: 250,
      render: (value: any, item: Product) => {
        const variants = item.variantsData?.[branch.id] || [];
        const colorVariants = variants.filter(
          (v) => v.variant_type === "color",
        );
        const shapeVariants = variants.filter(
          (v) => v.variant_type === "shape",
        );

        // If no color variants from variants table, try to get colors from description
        let descriptionColors: any[] = [];
        if (
          colorVariants.length === 0 &&
          item.productColors &&
          item.productColors.length > 0
        ) {
          descriptionColors = item.productColors.map((color, index) => ({
            name: color.name,
            quantity: Math.floor(
              (item.inventoryData?.[branch.id]?.quantity || 0) /
                (item.productColors?.length || 1),
            ),
            variant_type: "color",
            color: color.color,
          }));
        }

        // Helper function to get variant color
        const getVariantColor = (variant: any) => {
          if (variant.variant_type === "color") {
            // If variant has color property (from description), use it directly
            if (variant.color) {
              return variant.color;
            }

            // Try to find the color from product colors
            const productColor = item.productColors?.find(
              (c) => c.name === variant.name,
            );
            if (productColor?.color) {
              return productColor.color;
            }

            // Try to parse color from variant value if it's JSON
            try {
              if (variant.value && variant.value.startsWith("{")) {
                const valueData = JSON.parse(variant.value);
                if (valueData.color) {
                  return valueData.color;
                }
              }
            } catch (e) {
              // If parsing fails, use default
            }
          }
          return "#6B7280"; // Default gray color
        };

        // Helper function to get text color based on background
        const getTextColor = (bgColor: string) => {
          // Convert hex to RGB
          const hex = bgColor.replace("#", "");
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);

          // Calculate luminance
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

          // Return white for dark colors, black for light colors
          return luminance > 0.5 ? "#000000" : "#FFFFFF";
        };

        // Calculate unassigned quantity
        const totalInventoryQuantity =
          item.inventoryData?.[branch.id]?.quantity || 0;

        // Combine all variants (from database and description)
        const allColorVariants = [...colorVariants, ...descriptionColors];
        const allVariants = [...allColorVariants, ...shapeVariants];

        const assignedQuantity = allVariants.reduce(
          (sum, variant) => sum + variant.quantity,
          0,
        );
        const unassignedQuantity = totalInventoryQuantity - assignedQuantity;

        return (
          <div className="flex flex-wrap gap-1">
            {allVariants.map((variant, index) => {
              const bgColor = getVariantColor(variant);
              const textColor = getTextColor(bgColor);

              return (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border"
                  style={{
                    backgroundColor: bgColor,
                    color: textColor,
                    borderColor: bgColor === "#6B7280" ? "#6B7280" : bgColor,
                  }}
                >
                  {variant.name} ({variant.quantity})
                </span>
              );
            })}

            {/* Show unassigned quantity if any */}
            {unassignedQuantity > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white bg-gray-600 border border-gray-600">
                غير محدد ({unassignedQuantity})
              </span>
            )}
          </div>
        );
      },
    }));

    const activityColumn = {
      id: "activity",
      header: "نشيط",
      accessor: "is_active",
      width: 80,
      render: (value: boolean) => (
        <div className="flex justify-center">
          <div
            className={`w-3 h-3 rounded-full ${value ? "bg-green-500" : "bg-red-500"}`}
          ></div>
        </div>
      ),
    };

    return [
      ...baseColumns,
      ...branchColumns,
      ...minStockColumns,
      ...variantColumns,
      activityColumn,
    ];
  }, [branches]);

  // Get all columns for columns control modal
  const getAllColumns = () => {
    return dynamicTableColumns.map((col) => ({
      id: col.id,
      header: col.header,
      visible: visibleColumns[col.id] !== false,
    }));
  };

  // Handle columns visibility change
  const handleColumnsChange = (updatedColumns: any[]) => {
    const newVisibleColumns: { [key: string]: boolean } = {};
    updatedColumns.forEach((col) => {
      newVisibleColumns[col.id] = col.visible;
    });
    setVisibleColumns(newVisibleColumns);
  };

  // Filter visible columns
  const visibleTableColumns = dynamicTableColumns.filter(
    (col) => visibleColumns[col.id] !== false,
  );

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleRecordsModal = () => {
    setIsRecordsModalOpen(!isRecordsModalOpen);
  };

  const toggleCustomerModal = () => {
    setIsCustomerModalOpen(!isCustomerModalOpen);
  };

  const toggleBranchModal = () => {
    setIsBranchModalOpen(!isBranchModalOpen);
  };

  const toggleCategoriesModal = () => {
    setIsCategoriesModalOpen(!isCategoriesModalOpen);
  };

  const toggleHistoryModal = () => {
    setIsHistoryModalOpen(!isHistoryModalOpen);
  };

  const handleRecordSelect = (record: any) => {
    setRecord(record);
    setIsRecordsModalOpen(false);
    console.log("Selected record:", record);
  };

  const handleCustomerSelect = (customer: any) => {
    setCustomer(customer);
    setIsCustomerModalOpen(false);
    console.log("Selected customer:", customer);
  };

  const handleBranchSelect = (branch: any) => {
    setBranch(branch);
    setIsBranchModalOpen(false);
    console.log("Selected branch:", branch);
  };

  // Categories fetching function
  const fetchCategories = async () => {
    try {
      setIsLoadingCategories(true);
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching categories:", error);
        return;
      }

      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  // OPTIMIZED: Categories real-time subscription with smart updates
  useEffect(() => {
    startRender();
    fetchCategories();
    endRender();

    // Subscribe to real-time changes with optimized handling
    const subscription = supabase
      .channel("categories-realtime-optimized")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        (payload: any) => {
          console.log("Categories change detected:", payload.eventType);
          // Only refetch if necessary
          if (payload.eventType !== "DELETE" || payload.old?.is_active) {
            fetchCategories();
          }
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - fetchCategories and performance monitors are internal

  // Sync cart with active tab
  useEffect(() => {
    if (activePOSTab) {
      setCartItems(activePOSTab.cartItems || []);
    }
  }, [activeTabId, activePOSTab]);

  // OPTIMIZED: Memoized product filtering to prevent unnecessary re-renders
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;

    const query = searchQuery.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        (product.barcode && product.barcode.toLowerCase().includes(query)),
    );
  }, [products, searchQuery]);

  // OPTIMIZED: Memoized refresh handler
  const handleRefresh = useCallback(() => {
    fetchProducts();
  }, [fetchProducts]);

  // OPTIMIZED: Memoized POS Cart Functions
  const handleAddToCart = useCallback(
    (product: any, quantity: number, selectedColor?: string) => {
      console.log("Adding to cart:", {
        productId: product.id,
        quantity,
        selectedColor,
      });

      setCartItems((prev) => {
        const existingItemIndex = prev.findIndex(
          (item) => item.product.id === product.id,
        );

        let newCart;
        if (existingItemIndex >= 0) {
          // Product already exists in cart
          const newCartItems = [...prev];
          const existingItem = { ...newCartItems[existingItemIndex] };

          if (selectedColor) {
            // Initialize selectedColors if it doesn't exist
            if (!existingItem.selectedColors) {
              existingItem.selectedColors = {};
            }

            // Add or update color quantity
            existingItem.selectedColors[selectedColor] =
              (existingItem.selectedColors[selectedColor] || 0) + quantity;

            // Recalculate total quantity from all colors
            existingItem.quantity = Object.values(
              existingItem.selectedColors,
            ).reduce(
              (total: number, colorQty) => total + (colorQty as number),
              0,
            );
          } else {
            existingItem.quantity += quantity;
          }

          // Update total price
          existingItem.total = existingItem.price * existingItem.quantity;

          newCartItems[existingItemIndex] = existingItem;
          newCart = newCartItems;
        } else {
          // New product - create new cart item
          const newCartItem = {
            id: product.id.toString(),
            product: product,
            quantity: quantity,
            price: product.price || 0,
            total: (product.price || 0) * quantity,
            selectedColors: selectedColor
              ? { [selectedColor]: quantity }
              : undefined,
            color: selectedColor || null,
          };

          newCart = [...prev, newCartItem];
        }

        // Update active tab cart
        updateActiveTabCart(newCart);
        return newCart;
      });
    },
    [updateActiveTabCart],
  ); // Empty dependency array since we only need cartItems state

  // OPTIMIZED: Remove from Cart
  const removeFromCart = useCallback((itemId: string) => {
    setCartItems((prev) => {
      const newCart = prev.filter((item) => item.id !== itemId);
      updateActiveTabCart(newCart);
      return newCart;
    });
  }, [updateActiveTabCart]);

  // OPTIMIZED: Clear Cart
  const clearCart = useCallback(() => {
    setCartItems([]);
    clearActiveTabCart();
  }, [clearActiveTabCart]);

  const handleColorSelection = (
    selections: { [key: string]: number },
    totalQuantity: number,
    purchasePrice?: number,
  ) => {
    if (!modalProduct) return;

    const productWithPrice = {
      ...modalProduct,
      price:
        isPurchaseMode && purchasePrice !== undefined
          ? purchasePrice
          : modalProduct.price || 0,
    };

    // البحث عن المنتج في السلة
    const existingItemIndex = cartItems.findIndex(
      (item) => item.product.id === modalProduct.id,
    );

    if (existingItemIndex >= 0) {
      // المنتج موجود - تحديثه
      setCartItems((prev) => {
        const newCartItems = [...prev];
        const existingItem = { ...newCartItems[existingItemIndex] };

        // تحديث الكميات والألوان المحددة
        existingItem.quantity = totalQuantity;
        existingItem.selectedColors =
          Object.keys(selections).length > 0 ? selections : null;
        existingItem.total = productWithPrice.price * totalQuantity;

        newCartItems[existingItemIndex] = existingItem;
        updateActiveTabCart(newCartItems);
        return newCartItems;
      });
    } else {
      // منتج جديد - إضافته
      const newCartItem = {
        id: productWithPrice.id.toString(),
        product: productWithPrice,
        quantity: totalQuantity,
        selectedColors: Object.keys(selections).length > 0 ? selections : null,
        price: productWithPrice.price || 0,
        total: (productWithPrice.price || 0) * totalQuantity,
      };

      setCartItems((prev) => {
        const newCart = [...prev, newCartItem];
        updateActiveTabCart(newCart);
        return newCart;
      });
    }

    // إغلاق النافذة
    setShowColorSelectionModal(false);
    setModalProduct(null);
  };

  const handleProductClick = (product: any) => {
    // Check if required selections are made before allowing cart operations
    if (isPurchaseMode) {
      if (!selectedSupplier || !selectedWarehouse || !selections.record) {
        alert("يجب تحديد المورد والمخزن والسجل أولاً قبل إضافة المنتجات للسلة");
        return;
      }
    } else if (isTransferMode) {
      if (!transferFromLocation || !transferToLocation) {
        alert("يجب تحديد مصدر ووجهة النقل أولاً");
        return;
      }
      // Handle transfer mode product selection
      handleTransferProductClick(product);
      return;
    } else {
      if (!hasRequiredForCart()) {
        alert("يجب تحديد الفرع أولاً قبل إضافة المنتجات للسلة");
        return;
      }
    }

    setModalProduct(product);

    // عرض نافذة اختيار الألوان دائماً
    // ستتعامل النافذة مع عرض الألوان أو إخفائها حسب المنتج
    setShowColorSelectionModal(true);
  };

  // Calculate cart total from CartContext items
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);

  // Handle invoice creation
  const handleCreateInvoice = async () => {
    // Validate based on current mode
    if (isTransferMode) {
      if (!transferFromLocation || !transferToLocation) {
        alert("يجب تحديد مصدر ووجهة النقل قبل تأكيد النقل");
        return;
      }
      if (!selections.record) {
        alert("يجب تحديد السجل أولاً قبل إنشاء فاتورة النقل");
        return;
      }
    } else if (isPurchaseMode) {
      if (!hasRequiredForPurchase()) {
        alert("يجب تحديد السجل والمورد والمخزن قبل تأكيد الطلب");
        return;
      }
    } else {
      if (!hasRequiredForSale()) {
        alert("يجب تحديد السجل والعميل والفرع قبل تأكيد الطلب");
        return;
      }
    }

    if (cartItems.length === 0) {
      const emptyCartMessage = isTransferMode
        ? "لا يمكن إنشاء فاتورة نقل بدون منتجات"
        : isReturnMode
          ? isPurchaseMode
            ? "لا يمكن إنشاء مرتجع شراء بدون منتجات"
            : "لا يمكن إنشاء مرتجع بيع بدون منتجات"
          : isPurchaseMode
            ? "لا يمكن إنشاء فاتورة شراء بدون منتجات"
            : "لا يمكن إنشاء فاتورة بدون منتجات";
      alert(emptyCartMessage);
      return;
    }

    setIsProcessingInvoice(true);

    try {
      if (isTransferMode) {
        // Handle transfer invoice creation
        // Transform cartItems to match TransferCartItem interface
        const transferCartItems = cartItems.map((item) => ({
          id: item.id,
          product: item.product || { name: "Unknown Product" },
          quantity: item.quantity,
          selectedColors: item.selected_color
            ? { [item.selected_color]: item.quantity }
            : undefined,
          isTransfer: true,
        }));

        const transferInvoice = await createTransferInvoice({
          cartItems: transferCartItems,
          transferFromLocation,
          transferToLocation,
          record: selections.record,
        });

        // Store transfer invoice data for printing (with orange theme)
        setLastInvoiceData({
          invoiceNumber: transferInvoice.invoiceNumber,
          totalAmount: 0, // No amount in transfer
          cartItems: cartItems,
          isTransfer: true,
          date: new Date(),
          fromLocation: transferFromLocation,
          toLocation: transferToLocation,
          transferType: "transfer",
        });

        // Show print confirmation modal
        setShowPrintReceiptModal(true);

        // Clear cart and exit transfer mode
        clearCart();
        exitTransferMode();
      } else if (isPurchaseMode) {
        // Handle purchase invoice creation (or return)
        // Transform cartItems to match sales invoice CartItem interface
        const purchaseCartItems = cartItems.map((item) => ({
          id: item.id,
          product: item.product || { name: "Unknown Product" },
          quantity: item.quantity,
          selectedColors: item.selected_color
            ? { [item.selected_color]: item.quantity }
            : null,
          price: item.price,
          total: item.price * item.quantity,
        }));

        const result = await createPurchaseInvoice({
          cartItems: purchaseCartItems,
          selections: {
            supplier: selectedSupplier,
            warehouse: selectedWarehouse,
            record: selections.record,
          },
          paymentMethod: "cash",
          notes: isReturnMode
            ? `مرتجع شراء - ${cartItems.length} منتج`
            : `فاتورة شراء - ${cartItems.length} منتج`,
          isReturn: isReturnMode, // Pass return mode flag
        });

        // Store invoice data for printing
        setLastInvoiceData({
          invoiceNumber: result.invoiceNumber,
          totalAmount: result.totalAmount,
          cartItems: cartItems,
          isReturn: isReturnMode,
          isPurchaseMode: true,
          date: new Date(),
          supplier: selectedSupplier,
          warehouse: selectedWarehouse,
          record: selections.record,
        });

        // Show print confirmation modal
        setShowPrintReceiptModal(true);
      } else {
        // Handle sales invoice creation (or return)
        // Transform cartItems to match sales invoice CartItem interface
        const salesCartItems = cartItems.map((item) => ({
          id: item.id,
          product: item.product || { name: "Unknown Product" },
          quantity: item.quantity,
          selectedColors: item.selected_color
            ? { [item.selected_color]: item.quantity }
            : null,
          price: item.price,
          total: item.price * item.quantity,
        }));

        const result = await createSalesInvoice({
          cartItems: salesCartItems,
          selections: {
            customer: selections.customer,
            branch: selections.branch,
            record: selections.record,
          },
          paymentMethod: "cash",
          notes: isReturnMode
            ? `مرتجع بيع - ${cartItems.length} منتج`
            : `فاتورة بيع - ${cartItems.length} منتج`,
          isReturn: isReturnMode, // Pass return mode flag
          paymentSplitData: paymentSplitData, // Pass payment split data
          creditAmount: creditAmount, // Pass credit amount
        });

        // Store invoice data for printing
        setLastInvoiceData({
          invoiceNumber: result.invoiceNumber,
          totalAmount: result.totalAmount,
          cartItems: cartItems,
          isReturn: isReturnMode,
          isPurchaseMode: false,
          date: new Date(),
          customer: selections.customer,
          branch: selections.branch,
          record: selections.record,
        });

        // Show print confirmation modal
        setShowPrintReceiptModal(true);
      }

      // Clear cart after successful invoice creation
      clearCart();

      // Close tab if not the main tab
      if (activeTabId !== 'main') {
        closeTab(activeTabId);
      }

      // Reset to default customer after sales (not purchase or transfer)
      if (!isPurchaseMode && !isTransferMode) {
        await resetToDefaultCustomer();
      }

      // Exit return mode after successful return
      if (isReturnMode) {
        setIsReturnMode(false);
      }

      // Refresh products to update inventory
      handleRefresh();
    } catch (error: any) {
      console.error("Invoice creation error:", error);
      console.error("Cart items at time of error:", cartItems);
      console.error("Selections at time of error:", {
        customer: selections.customer,
        branch: selections.branch,
        record: selections.record,
      });

      const errorType = isReturnMode
        ? isPurchaseMode
          ? "مرتجع الشراء"
          : "مرتجع البيع"
        : isPurchaseMode
          ? "فاتورة الشراء"
          : "الفاتورة";
      alert(`خطأ في إنشاء ${errorType}: ${error.message}`);
    } finally {
      setIsProcessingInvoice(false);
    }
  };

  // Purchase Mode Functions
  const handlePurchaseModeToggle = () => {
    setShowPurchaseModeConfirm(true);
  };

  const confirmPurchaseMode = () => {
    setIsPurchaseMode(true);
    setShowPurchaseModeConfirm(false);
    // Clear existing selections when switching to purchase mode
    clearSelections();
    clearCart();
  };

  const cancelPurchaseMode = () => {
    setShowPurchaseModeConfirm(false);
  };

  const exitPurchaseMode = () => {
    setIsPurchaseMode(false);
    setIsReturnMode(false); // Also exit return mode
    clearSelections();
    clearCart();
  };

  // Transfer Mode Functions
  const handleTransferModeToggle = () => {
    // Clear existing modes and cart when starting transfer mode
    setIsPurchaseMode(false);
    setIsReturnMode(false);
    clearCart();

    // Reset transfer locations
    setTransferFromLocation(null);
    setTransferToLocation(null);

    // Open transfer location selection modal
    setIsTransferLocationModalOpen(true);
  };

  const handleTransferLocationConfirm = (
    fromLocation: any,
    toLocation: any,
  ) => {
    setTransferFromLocation(fromLocation);
    setTransferToLocation(toLocation);
    setIsTransferMode(true);
    setIsTransferLocationModalOpen(false);
  };

  const exitTransferMode = () => {
    setIsTransferMode(false);
    setTransferFromLocation(null);
    setTransferToLocation(null);
    clearCart();
  };

  const handleTransferProductClick = async (product: any) => {
    setModalProduct(product);

    console.log("نقل المنتج:", product);
    console.log("من:", transferFromLocation);
    console.log("إلى:", transferToLocation);

    // Always use ColorSelectionModal for consistency in transfer mode
    // This modal will handle products with or without colors properly
    setShowColorSelectionModal(true);
  };

  const toggleSupplierModal = () => {
    setIsSupplierModalOpen(!isSupplierModalOpen);
  };

  const toggleWarehouseModal = () => {
    setIsWarehouseModalOpen(!isWarehouseModalOpen);
  };

  const handleQuickAddProduct = (product: any) => {
    setSelectedProduct(product);
    setShowQuickAddProductModal(true);
  };

  const handleQuickAddToCart = (productData: any) => {
    // Use the main handleAddToCart function to ensure consistent grouping
    handleAddToCart(productData, productData.quantity);
  };

  // Check if all required selections are made for purchase mode
  const hasRequiredForPurchase = () => {
    return selectedSupplier && selectedWarehouse && selections.record;
  };

  // Check if all required selections are made (works for both modes)
  const hasAllRequiredSelections = () => {
    if (isTransferMode) {
      return transferFromLocation && transferToLocation && selections.record;
    } else if (isPurchaseMode) {
      return hasRequiredForPurchase();
    } else {
      return hasRequiredForSale();
    }
  };

  // Print Receipt Function
  const printReceipt = (invoiceData?: any) => {
    const dataToUse = invoiceData || lastInvoiceData;
    if (!dataToUse) {
      alert("لا توجد بيانات فاتورة للطباعة");
      return;
    }

    // Create receipt content based on the image format
    const receiptContent = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>فاتورة رقم ${dataToUse.invoiceNumber}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Arial', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              font-size: 13px;
              line-height: 1.3;
              color: #000;
              background: white;
              width: 100%;
              margin: 0;
              padding: 0;
            }
            
            .receipt-header {
              text-align: center;
              margin-bottom: 3px;
              padding: 0 2px;
            }
            
            .company-logo {
              width: 60px;
              height: auto;
              margin: 0 auto 4px auto;
              display: block;
              max-height: 60px;
              object-fit: contain;
            }
            
            .company-logo-fallback {
              display: none;
            }
            
            .company-name {
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 2px;
              color: #000;
            }
            
            .receipt-date {
              font-size: 11px;
              margin-bottom: 1px;
            }
            
            .receipt-address {
              font-size: 10px;
              margin-bottom: 1px;
            }
            
            .receipt-phone {
              font-size: 10px;
            }
            
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 3px 0;
              border: 1px solid #000;
              table-layout: fixed; /* Forces table to use full width */
            }
            
            .items-table th,
            .items-table td {
              border: 1px solid #000;
              padding: 7px;
              text-align: center;
              font-size: 14px;
              font-weight: 400;
            }
            
            .items-table th {
              background-color: #f5f5f5;
              font-weight: 600;
              font-size: 14px;
            }
            
            /* Column width optimization for 80mm thermal paper */
            .items-table th:nth-child(1),
            .items-table td:nth-child(1) {
              width: 45%; /* Item name - reduced slightly */
            }
            
            .items-table th:nth-child(2),
            .items-table td:nth-child(2) {
              width: 12%; /* Quantity - reduced slightly */
            }
            
            .items-table th:nth-child(3),
            .items-table td:nth-child(3) {
              width: 18%; /* Price - same */
            }
            
            .items-table th:nth-child(4),
            .items-table td:nth-child(4) {
              width: 25%; /* Total - increased for full visibility */
              text-align: right !important; /* Align value column to the right */
              padding-right: 4px !important;
            }

            .item-name {
              text-align: right !important;
              padding-right: 4px !important;
              padding-left: 2px !important;
              font-size: 15px;
              font-weight: bold;
              word-wrap: break-word;
              white-space: normal;
              overflow-wrap: break-word;
            }
            
            .total-row {
              border-top: 2px solid #000;
              font-weight: 700;
              font-size: 12px;
            }
            
            .payment-section {
              margin-top: 8px;
              text-align: center;
              font-size: 11px;
              padding: 0 2px;
            }
            
            .payment-table {
              width: 100%;
              border-collapse: collapse;
              margin: 5px 0;
              border: 1px solid #000;
            }
            
            .payment-table th,
            .payment-table td {
              border: 1px solid #000;
              padding: 4px;
              text-align: center;
              font-size: 11px;
            }
            
            .footer {
              text-align: center;
              margin-top: 8px;
              font-size: 9px;
              border-top: 1px solid #000;
              padding: 3px 2px 0 2px;
            }
            
            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }
              
              body {
                width: 80mm !important;
                max-width: 80mm !important;
                margin: 0 !important;
                padding: 0 1.5mm !important;
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              .company-logo {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              .no-print {
                display: none;
              }
              
              .items-table {
                margin: 3px 0;
                width: 100% !important;
              }
              
              .items-table th,
              .items-table td {
                padding: 2px;
              }
              
              /* Ensure no containers limit width */
              * {
                max-width: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <img
              src="${logoUrl || (window.location.origin + '/assets/logo/El Farouk Group2.png')}"
              alt="${companyName}"
              class="company-logo"
              onerror="this.style.display='none'; document.querySelector('.company-logo-fallback').style.display='block';"
            />
            <div class="company-logo-fallback" style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 4px;">🏢</div>
            <div class="company-name">${companyName}</div>
            <div class="receipt-date">${new Date().toLocaleDateString("ar-EG")} - ${new Date().toLocaleDateString("en-US")}</div>
            <div class="receipt-address">${selections.branch?.name || "الفرع الرئيسي"}</div>
            <div class="receipt-phone">${selections.branch?.phone || "01102862856"}</div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th class="item-name">الصنف</th>
                <th>كمية</th>
                <th>سعر</th>
                <th>قيمة</th>
              </tr>
            </thead>
            <tbody>
              ${dataToUse.cartItems
                .map(
                  (item: any) => `
                <tr>
                  <td class="item-name">${item.product.name}</td>
                  <td>${item.quantity}</td>
                  <td>${item.price.toFixed(0)}</td>
                  <td>${(item.price * item.quantity).toFixed(0)}</td>
                </tr>
              `,
                )
                .join("")}
              <tr class="total-row">
                <td class="item-name">-</td>
                <td>${dataToUse.cartItems.length}</td>
                <td>= اجمالي =</td>
                <td>${dataToUse.totalAmount.toFixed(0)}</td>
              </tr>
            </tbody>
          </table>

          <div class="payment-section">
            ألف وأربعمائة وخمسة وثمانون جنيها
            
            <table class="payment-table">
              <tr>
                <th>مدين</th>
                <th>آجل</th>
                <th>سابق</th>
                <th>مدفوع</th>
              </tr>
              <tr>
                <td>0</td>
                <td>135</td>
                <td>-135</td>
                <td>1350</td>
              </tr>
            </table>
          </div>

          <div class="footer">
            ${new Date().toLocaleDateString("en-GB")} ${new Date().toLocaleTimeString("en-GB", { hour12: false })} by: ${selections.record?.name || "kassem"}
          </div>

          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">طباعة</button>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">إغلاق</button>
          </div>
        </body>
      </html>
    `;

    // Open new window with receipt content
    const printWindow = window.open(
      "",
      "_blank",
      "width=450,height=650,scrollbars=yes,resizable=yes",
    );
    if (printWindow) {
      printWindow.document.write(receiptContent);
      printWindow.document.close();

      // Auto-focus the print window
      printWindow.focus();

      // Optional: Auto-print after a short delay
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      alert("يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة");
    }
  };

  return (
    <div className="flex h-screen bg-[#2B3544]">
      {/* Top Header */}
      <TopHeader onMenuClick={toggleSidebar} isMenuOpen={isSidebarOpen} />

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

      {/* Main Content Container - Responsive Layout */}
      <div className="flex-1 flex flex-col md:flex-row h-screen overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out">
          {/* Action Buttons Bar - Desktop Version (hidden on mobile) */}
          <div className="hidden md:block bg-[#374151] border-b border-gray-600 px-4 py-2 w-full mt-12">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {/* Selection Buttons - First three buttons grouped together */}
                <button
                  onClick={toggleRecordsModal}
                  className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-all relative"
                >
                  <DocumentTextIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">السجل</span>
                  {!selections.record && (
                    <div className="w-1 h-1 bg-red-400 rounded-full mt-1"></div>
                  )}
                </button>

                {/* Conditional Customer/Supplier Button */}
                {isPurchaseMode ? (
                  <button
                    onClick={toggleSupplierModal}
                    className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-all relative"
                  >
                    <BuildingStorefrontIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">اختيار مورد</span>
                    {!selectedSupplier && (
                      <div className="w-1 h-1 bg-red-400 rounded-full mt-1"></div>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={toggleCustomerModal}
                    className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-all relative"
                  >
                    <UserIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">اختيار عميل</span>
                    {!selections.customer && (
                      <div className="w-1 h-1 bg-red-400 rounded-full mt-1"></div>
                    )}
                  </button>
                )}

                {/* Conditional Branch/Warehouse Button */}
                {isPurchaseMode ? (
                  <button
                    onClick={toggleWarehouseModal}
                    className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-all relative"
                  >
                    <BuildingOfficeIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">فرع / مخزن</span>
                    {!selectedWarehouse && (
                      <div className="w-1 h-1 bg-red-400 rounded-full mt-1"></div>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={toggleBranchModal}
                    className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-all relative"
                  >
                    <BuildingOfficeIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">تحويل فرع</span>
                    {!selections.branch && (
                      <div className="w-1 h-1 bg-red-400 rounded-full mt-1"></div>
                    )}
                  </button>
                )}

                {/* Separator */}
                <div className="h-8 w-px bg-gray-600 mx-2"></div>

                {/* Other Action Buttons */}
                <button
                  onClick={() => setShowColumnsModal(true)}
                  className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
                >
                  <TableCellsIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">الأعمدة</span>
                </button>

                <button
                  onClick={toggleHistoryModal}
                  className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
                >
                  <ClockIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">التاريخ</span>
                </button>

                <button
                  onClick={handleTransferModeToggle}
                  className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] transition-all ${
                    isTransferMode
                      ? "text-orange-400 hover:text-orange-300"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  <ArrowsRightLeftIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">نقل البضاعة</span>
                </button>

                <button
                  onClick={toggleCategoriesModal}
                  className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
                >
                  <HomeIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">عرض المجموعات</span>
                </button>

                <button
                  onClick={() => setShowPrintReceiptModal(true)}
                  className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
                >
                  <PrinterIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">طباعة ريسيت</span>
                </button>
              </div>

              {/* Right Side - Cart, Purchase Mode Toggle & Returns */}
              <div className="flex items-center gap-2">
                {/* Returns Button */}
                <button
                  onClick={() => setIsReturnMode(!isReturnMode)}
                  className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] transition-all ${
                    isReturnMode
                      ? "text-orange-400 hover:text-orange-300"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  <ArrowUturnLeftIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">مرتجع</span>
                </button>

                {/* Separator */}
                <div className="h-8 w-px bg-gray-600 mx-1"></div>

                {isPurchaseMode ? (
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-sm font-medium">
                      وضع الشراء مفعل
                    </span>
                    <button
                      onClick={() => setShowQuickAddProductModal(true)}
                      className="flex flex-col items-center p-2 text-green-400 hover:text-green-300 cursor-pointer min-w-[80px] transition-all"
                    >
                      <PlusIcon className="h-5 w-5 mb-1" />
                      <span className="text-sm">منتج جديد</span>
                    </button>
                    <button
                      onClick={exitPurchaseMode}
                      className="flex flex-col items-center p-2 text-red-400 hover:text-red-300 cursor-pointer min-w-[80px] transition-all"
                    >
                      <XMarkIcon className="h-5 w-5 mb-1" />
                      <span className="text-sm">إنهاء الوضع</span>
                    </button>
                  </div>
                ) : isTransferMode ? (
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400 text-sm font-medium">
                      وضع النقل مفعل
                    </span>
                    <div className="text-xs text-gray-300">
                      من: {transferFromLocation?.name} → إلى:{" "}
                      {transferToLocation?.name}
                    </div>
                    <button
                      onClick={exitTransferMode}
                      className="flex flex-col items-center p-2 text-red-400 hover:text-red-300 cursor-pointer min-w-[80px] transition-all"
                    >
                      <XMarkIcon className="h-5 w-5 mb-1" />
                      <span className="text-sm">إنهاء النقل</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handlePurchaseModeToggle}
                    className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-all"
                  >
                    <ShoppingBagIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">وضع الشراء</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Bar - Mobile Version (shown only on mobile) */}
          <div className="block md:hidden bg-[#374151] border-b border-gray-600 px-2 py-2 w-full mt-12">
            <div className="flex items-center justify-start gap-1 overflow-x-auto scrollbar-hide">
              {/* Selection Buttons */}
              <button
                onClick={toggleRecordsModal}
                className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors relative"
              >
                <DocumentTextIcon className="h-4 w-4" />
                <span className="text-xs">السجل</span>
                {!selections.record && (
                  <div className="w-1 h-1 bg-red-400 rounded-full absolute -top-1 -right-1"></div>
                )}
              </button>

              {/* Conditional Customer/Supplier Button */}
              {isPurchaseMode ? (
                <button
                  onClick={toggleSupplierModal}
                  className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors relative"
                >
                  <BuildingStorefrontIcon className="h-4 w-4" />
                  <span className="text-xs">اختيار مورد</span>
                  {!selectedSupplier && (
                    <div className="w-1 h-1 bg-red-400 rounded-full absolute -top-1 -right-1"></div>
                  )}
                </button>
              ) : (
                <button
                  onClick={toggleCustomerModal}
                  className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors relative"
                >
                  <UserIcon className="h-4 w-4" />
                  <span className="text-xs">اختيار عميل</span>
                  {!selections.customer && (
                    <div className="w-1 h-1 bg-red-400 rounded-full absolute -top-1 -right-1"></div>
                  )}
                </button>
              )}

              {/* Conditional Branch/Warehouse Button */}
              {isPurchaseMode ? (
                <button
                  onClick={toggleWarehouseModal}
                  className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors relative"
                >
                  <BuildingOfficeIcon className="h-4 w-4" />
                  <span className="text-xs">فرع / مخزن</span>
                  {!selectedWarehouse && (
                    <div className="w-1 h-1 bg-red-400 rounded-full absolute -top-1 -right-1"></div>
                  )}
                </button>
              ) : (
                <button
                  onClick={toggleBranchModal}
                  className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors relative"
                >
                  <BuildingOfficeIcon className="h-4 w-4" />
                  <span className="text-xs">تحويل فرع</span>
                  {!selections.branch && (
                    <div className="w-1 h-1 bg-red-400 rounded-full absolute -top-1 -right-1"></div>
                  )}
                </button>
              )}

              {/* Other Action Buttons */}
              <button
                onClick={() => setShowColumnsModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
              >
                <TableCellsIcon className="h-4 w-4" />
                <span className="text-xs">الأعمدة</span>
              </button>

              <button
                onClick={toggleHistoryModal}
                className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
              >
                <ClockIcon className="h-4 w-4" />
                <span className="text-xs">التاريخ</span>
              </button>

              <button
                onClick={handleTransferModeToggle}
                className={`flex items-center gap-2 px-3 py-2 border border-gray-600 rounded cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors ${
                  isTransferMode
                    ? "bg-orange-600 text-white hover:bg-orange-700"
                    : "bg-[#2B3544] text-gray-300 hover:text-white hover:bg-[#374151]"
                }`}
              >
                <ArrowsRightLeftIcon className="h-4 w-4" />
                <span className="text-xs">نقل البضاعة</span>
              </button>

              <button
                onClick={toggleCategoriesModal}
                className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
              >
                <HomeIcon className="h-4 w-4" />
                <span className="text-xs">عرض المجموعات</span>
              </button>

              <button
                onClick={() => setShowPrintReceiptModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
              >
                <PrinterIcon className="h-4 w-4" />
                <span className="text-xs">طباعة ريسيت</span>
              </button>

              {/* Returns Button */}
              <button
                onClick={() => setIsReturnMode(!isReturnMode)}
                className={`flex items-center gap-2 px-3 py-2 border border-gray-600 rounded cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors ${
                  isReturnMode
                    ? "bg-orange-600 text-white hover:bg-orange-700"
                    : "bg-[#2B3544] text-gray-300 hover:text-white hover:bg-[#374151]"
                }`}
              >
                <ArrowUturnLeftIcon className="h-4 w-4" />
                <span className="text-xs">مرتجع</span>
              </button>

              {/* Purchase Mode Button */}
              {isPurchaseMode ? (
                <>
                  <button
                    onClick={() => setShowQuickAddProductModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 border border-green-500 rounded text-white hover:bg-green-700 cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span className="text-xs">منتج جديد</span>
                  </button>
                  <button
                    onClick={exitPurchaseMode}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600 border border-red-500 rounded text-white hover:bg-red-700 cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    <span className="text-xs">إنهاء الوضع</span>
                  </button>
                </>
              ) : isTransferMode ? (
                <button
                  onClick={exitTransferMode}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 border border-red-500 rounded text-white hover:bg-red-700 cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
                >
                  <XMarkIcon className="h-4 w-4" />
                  <span className="text-xs">إنهاء النقل</span>
                </button>
              ) : (
                <button
                  onClick={handlePurchaseModeToggle}
                  className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
                >
                  <ShoppingBagIcon className="h-4 w-4" />
                  <span className="text-xs">وضع الشراء</span>
                </button>
              )}
            </div>
          </div>

          {/* Combined Selection Display & POS Tabs Bar (hidden on mobile) */}
          <div className="hidden md:flex bg-[#2B3544] border-b border-gray-600 items-center justify-between">
            {/* Right Side: Selection Display */}
            <div className="flex items-center gap-6 text-sm px-4 py-2">
              {/* Customer/Supplier */}
              <span className="text-gray-300 whitespace-nowrap">
                {isPurchaseMode ? "المورد" : "العميل"}:{" "}
                <span className="text-white font-medium">
                  {isPurchaseMode
                    ? selectedSupplier
                      ? selectedSupplier.name
                      : "غير محدد"
                    : selections.customer
                      ? selections.customer.name
                      : "غير محدد"}
                </span>
              </span>

              {/* Branch/Warehouse */}
              <span className="text-gray-300 whitespace-nowrap">
                {isPurchaseMode
                  ? selectedWarehouse
                    ? selectedWarehouse.locationType === "branch"
                      ? "الفرع"
                      : "المخزن"
                    : "فرع / مخزن"
                  : "الفرع"}
                :{" "}
                <span className="text-white font-medium">
                  {isPurchaseMode
                    ? selectedWarehouse
                      ? selectedWarehouse.name
                      : "غير محدد"
                    : selections.branch
                      ? selections.branch.name
                      : "غير محدد"}
                </span>
              </span>

              {/* Record */}
              <span className="text-gray-300 whitespace-nowrap">
                السجل:{" "}
                <span className="text-white font-medium">
                  {selections.record ? selections.record.name : "غير محدد"}
                </span>
              </span>

              {/* Clear all button - if any selections exist */}
              {(selections.customer ||
                selections.branch ||
                selections.record ||
                selectedSupplier ||
                selectedWarehouse) && (
                <button
                  onClick={() => {
                    clearSelections();
                    if (isPurchaseMode) {
                      setSelectedSupplier(null);
                      setSelectedWarehouse(null);
                    }
                  }}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded whitespace-nowrap"
                >
                  مسح الكل
                </button>
              )}
            </div>

            {/* Vertical Divider */}
            <div className="h-8 w-px bg-gray-600"></div>

            {/* Left Side: POS Tabs */}
            <div className="flex items-center overflow-x-auto scrollbar-hide flex-1">
              {posTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center border-l border-gray-600 ${
                    tab.active
                      ? 'bg-[#F97316] text-white'
                      : 'text-gray-300 hover:text-white hover:bg-[#4B5563]'
                  }`}
                >
                  <button
                    onClick={() => switchTab(tab.id)}
                    className="px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <span>{tab.title}</span>
                  </button>

                  {tab.id !== 'main' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="ml-1 p-1 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="إغلاق"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {/* Add New Tab Button */}
              <button
                onClick={() => setShowAddTabModal(true)}
                className="px-3 py-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors flex items-center gap-1 border-l border-gray-600"
                title="إضافة نافذة بيع جديدة"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Desktop Toolbar - Original Design (hidden on mobile) */}
          <div className="hidden md:block bg-[#374151] border-b border-gray-600 px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Left Side Elements */}
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="اسم المنتج..."
                    className="w-64 pl-4 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* View Mode Toggle */}
                <div className="flex bg-[#2B3544] rounded-lg p-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === "grid"
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:text-white"
                    }`}
                  >
                    <Squares2X2Icon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === "table"
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:text-white"
                    }`}
                  >
                    <ListBulletIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Unified Toolbar - New Design (shown only on mobile) */}
          <div className="block md:hidden bg-[#374151] border-b border-gray-600 px-4 py-3 flex-shrink-0">
            {/* Single Horizontal Row - Search Bar, View Toggle, Cart Toggle, Customer Info, Branch Info, Record Info, Clear All */}
            <div
              className="flex items-center gap-3 overflow-x-auto scrollbar-hide"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {/* 1. Search Bar */}
              <div className="relative flex-shrink-0 w-64">
                <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="اسم المنتج..."
                  className="w-full pl-4 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#5DADE2] focus:border-transparent"
                  style={{ fontSize: "16px" }}
                />
              </div>

              {/* 2. Cart Toggle Button */}
              <button
                onClick={() => setIsCartOpen(!isCartOpen)}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md transition-colors bg-[#2B3544] border border-gray-600 flex-shrink-0"
                title={isCartOpen ? "إخفاء السلة" : "إظهار السلة"}
              >
                {isCartOpen ? (
                  <ShoppingBagIcon className="h-4 w-4" />
                ) : (
                  <ShoppingCartIcon className="h-4 w-4" />
                )}
              </button>

              {/* 3. Product Count */}
              <span className="text-xs text-gray-400 whitespace-nowrap">
                عرض {filteredProducts.length} من {products.length}
              </span>

              {/* 3. View Toggle (Images or Tables) */}
              <div className="flex bg-[#2B3544] rounded-md overflow-hidden flex-shrink-0 border border-gray-600">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 transition-colors ${
                    viewMode === "grid"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-600"
                  }`}
                  title="عرض الصور"
                >
                  <Squares2X2Icon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-2 transition-colors ${
                    viewMode === "table"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-600"
                  }`}
                  title="عرض الجداول"
                >
                  <ListBulletIcon className="h-4 w-4" />
                </button>
              </div>

              {/* 4. Customer Info */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">العميل:</span>
                <span className="text-xs text-white bg-[#2B3544] px-2 py-1 rounded border border-gray-600">
                  {selections.customer?.name || "غير محدد"}
                </span>
              </div>

              {/* 5. Branch Info */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">الفرع:</span>
                <span className="text-xs text-white bg-[#2B3544] px-2 py-1 rounded border border-gray-600">
                  {selections.branch?.name || "غير محدد"}
                </span>
              </div>

              {/* 6. Record Info */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">السجل:</span>
                <span className="text-xs text-white bg-[#2B3544] px-2 py-1 rounded border border-gray-600">
                  {selections.record?.name || "غير محدد"}
                </span>
              </div>

              {/* 7. Clear All Button */}
              {(selections.customer ||
                selections.branch ||
                selections.record) && (
                <button
                  onClick={() => {
                    // Clear all selections manually
                    // Note: This would need to be integrated with the proper selection management system
                    console.log('Clear all selections clicked');
                  }}
                  className="text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 px-3 py-2 rounded-md transition-colors bg-[#2B3544] border border-gray-600 flex-shrink-0"
                >
                  مسح الكل
                </button>
              )}
            </div>
          </div>

          {/* Products Content Container - Smart sizing for both layout and scroll */}
          <div className="flex-1 relative overflow-hidden">
            {/* Show cart on mobile when isCartOpen is true */}
            {isCartOpen && (
              <div className="block md:hidden h-full">
                {/* Mobile Cart View */}
                <div className="h-full bg-[#374151] border-t-2 border-gray-500 flex flex-col">
                  {/* Cart Items Area - Full Height */}
                  <div className="flex-1 border-t-2 border-gray-500 overflow-hidden">
                    {cartItems.length === 0 ? (
                      <div className="flex flex-col justify-center items-center h-full p-8">
                        <ShoppingCartIcon className="h-24 w-24 text-gray-500 mb-8" />
                        <p className="text-gray-400 text-sm text-center mb-4">
                          اضغط على المنتجات لإضافتها للسلة
                        </p>
                        <div className="text-center">
                          <span className="bg-gray-600 px-3 py-1 rounded text-sm text-gray-300">
                            0 منتج
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col">
                        {/* Cart Header */}
                        <div className="p-4 border-b border-gray-600 flex-shrink-0">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              {/* Close button for mobile */}
                              <button
                                onClick={() => setIsCartOpen(false)}
                                className="text-gray-400 hover:text-white mr-2"
                                title="إغلاق السلة"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              <span className="text-white font-medium">السلة</span>
                              <span className="bg-blue-600 px-2 py-1 rounded text-xs text-white">
                                {cartItems.length}
                              </span>
                            </div>
                            {cartItems.length > 0 && (
                              <button
                                onClick={() => clearCart()}
                                className="text-red-400 hover:text-red-300 text-sm"
                                title="مسح السلة"
                              >
                                مسح الكل
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3 min-h-0">
                          {cartItems.map((item) => (
                            <div
                              key={item.id}
                              className="bg-[#2B3544] rounded-lg p-3 border border-gray-600"
                            >
                              <div className="flex gap-3 mb-2">
                                {/* Product Image */}
                                <div className="w-12 h-12 bg-[#374151] rounded-lg overflow-hidden flex-shrink-0">
                                  <ProductThumbnail
                                    src={item.product.main_image_url}
                                    alt={item.product.name}
                                  />
                                </div>

                                {/* Product Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-medium text-white text-sm truncate">
                                      {item.product.name}
                                    </h4>
                                    <button
                                      onClick={() => removeFromCart(item.id)}
                                      className="text-red-400 hover:text-red-300 p-1 ml-2 flex-shrink-0"
                                      title="إزالة من السلة"
                                    >
                                      <XMarkIcon className="h-4 w-4" />
                                    </button>
                                  </div>

                                  {/* Quantity and Price Controls */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-400 text-xs">الكمية:</span>
                                      <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => {
                                          const newQuantity = parseInt(e.target.value) || 1;
                                          setCartItems((prev) => {
                                            const newCart = prev.map((cartItem) => {
                                              if (cartItem.id === item.id) {
                                                const pricePerUnit =
                                                  newQuantity / cartItem.quantity;

                                                // Handle selected colors proportionally
                                                let newSelectedColors = null;
                                                if (cartItem.selectedColors) {
                                                  newSelectedColors = Object.fromEntries(
                                                    Object.entries(
                                                      cartItem.selectedColors,
                                                    ).map(([color, count]) => [
                                                      color,
                                                      Math.round(
                                                        (count as number) *
                                                          pricePerUnit,
                                                      ),
                                                    ]),
                                                  );
                                                }

                                                return {
                                                  ...cartItem,
                                                  quantity: newQuantity,
                                                  selectedColors: newSelectedColors,
                                                  totalPrice: cartItem.isCustomPrice
                                                    ? cartItem.totalPrice
                                                    : cartItem.price * newQuantity,
                                                };
                                              }
                                              return cartItem;
                                            });
                                            updateActiveTabCart(newCart);
                                            return newCart;
                                          });
                                        }}
                                        className="w-16 px-2 py-1 bg-[#374151] border border-gray-600 rounded text-white text-xs text-center"
                                      />
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-400 text-xs">السعر:</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={((item.totalPrice || (item.price * item.quantity) || 0) / item.quantity).toFixed(2)}
                                        onChange={(e) => {
                                          const newPrice = parseFloat(e.target.value) || 0;
                                          setCartItems((prev) => {
                                            const newCart = prev.map((cartItem) =>
                                              cartItem.id === item.id
                                                ? {
                                                    ...cartItem,
                                                    isCustomPrice: true,
                                                    totalPrice:
                                                      cartItem.quantity * newPrice,
                                                  }
                                                : cartItem,
                                            );
                                            updateActiveTabCart(newCart);
                                            return newCart;
                                          });
                                        }}
                                        className="w-20 px-2 py-1 bg-[#374151] border border-gray-600 rounded text-white text-xs text-center"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Total Price */}
                              <div className="text-right">
                                <span className="text-green-400 font-bold text-sm">
                                  {formatPrice(item.totalPrice || (item.price * item.quantity) || 0, "system")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cart Footer */}
                  <div className="p-4 border-t border-gray-600 bg-[#2B3544] flex-shrink-0">
                    {/* Payment Split Component - Only show in sales mode (not transfer or purchase) */}
                    {!isTransferMode && !isPurchaseMode && !isReturnMode && (
                      <PaymentSplit
                        totalAmount={cartTotal}
                        onPaymentsChange={(payments, credit) => {
                          setPaymentSplitData(payments);
                          setCreditAmount(credit);
                        }}
                      />
                    )}

                    {/* Single row layout for total and button */}
                    <div className="flex items-center justify-between gap-3">
                      {/* Total/Transfer info section */}
                      <div className="flex-shrink-0">
                        {!isTransferMode ? (
                          <div className="text-right">
                            <div className="text-white text-sm font-medium">الإجمالي:</div>
                            <div className="text-green-400 font-bold text-lg">
                              {formatPrice(cartTotal, "system")}
                            </div>
                          </div>
                        ) : (
                          <div className="text-right">
                            <div className="text-orange-400 text-sm font-medium">وضع النقل</div>
                            <div className="text-white font-bold text-lg">
                              {cartItems.reduce((sum, item) => sum + item.quantity, 0)} قطعة
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Button section */}
                      <button
                        disabled={
                          cartItems.length === 0 ||
                          !hasAllRequiredSelections() ||
                          isProcessingInvoice
                        }
                        className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed text-white ${
                          isTransferMode
                            ? "bg-orange-600 hover:bg-orange-700"
                            : isReturnMode
                              ? "bg-red-600 hover:bg-red-700"
                              : isPurchaseMode
                                ? "bg-purple-600 hover:bg-purple-700"
                                : "bg-blue-600 hover:bg-blue-700"
                        }`}
                        onClick={handleCreateInvoice}
                      >
                        {isProcessingInvoice
                          ? "جاري المعالجة..."
                          : cartItems.length === 0
                            ? "السلة فارغة"
                            : !hasAllRequiredSelections()
                              ? "يجب إكمال التحديدات"
                              : isTransferMode
                                ? `تأكيد النقل (${cartItems.length})`
                                : isReturnMode
                                  ? isPurchaseMode
                                    ? `مرتجع شراء (${cartItems.length})`
                                    : `مرتجع بيع (${cartItems.length})`
                                  : isPurchaseMode
                                    ? `تأكيد الشراء (${cartItems.length})`
                                    : `تأكيد الطلب (${cartItems.length})`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Products Display Container - Responsive: absolute for mobile, normal for desktop */}
            <div className={`${isCartOpen ? "hidden md:block" : "block"} md:h-full md:flex md:flex-col absolute inset-0 md:relative md:inset-auto flex flex-col`}>
              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-white">جاري التحميل...</div>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-red-400">خطأ: {error}</div>
                </div>
              )}

              {/* Products Content */}
              {!isLoading && !error && (
                <>
                  {viewMode === "table" ? (
                    /* Table View */
                    <div className="flex-1 min-h-0">
                      <ResizableTable
                        className="h-full w-full"
                        columns={visibleTableColumns}
                        data={filteredProducts}
                        selectedRowId={selectedProduct?.id || null}
                        onRowClick={(product, index) => {
                          if (selectedProduct?.id === product.id) {
                            setSelectedProduct(null);
                          } else {
                            setSelectedProduct(product as Product);
                          }
                        }}
                      />
                    </div>
                  ) : (
                    /* Grid View - Responsive scroll solution */
                    <div className="flex-1 overflow-hidden">
                      <div className="h-full overflow-y-auto scrollbar-hide p-4">
                        <div className="grid gap-4 grid-cols-2 md:grid-cols-6">
                          {filteredProducts.map((product, index) => (
                            <div
                              key={product.id}
                              onClick={() => {
                                if (selectedProduct?.id === product.id) {
                                  setSelectedProduct(null);
                                } else {
                                  setSelectedProduct(product);
                                }
                                handleProductClick(product);
                              }}
                              className={`bg-[#374151] rounded-lg p-3 cursor-pointer transition-all duration-200 border-2 relative group ${
                                selectedProduct?.id === product.id
                                  ? "border-blue-500 bg-[#434E61]"
                                  : "border-transparent hover:border-gray-500 hover:bg-[#434E61]"
                              }`}
                            >
                              {/* Product Image */}
                              <div className="mb-3 relative">
                                <ProductGridImage
                                  src={product.main_image_url}
                                  alt={product.name}
                                  priority={index < 6}
                                />

                                {/* View Details Button */}
                                <div className="absolute top-2 right-2 z-50">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setModalProduct(product);
                                      const firstImage =
                                        product.allImages?.[0] ||
                                        product.main_image_url ||
                                        null;
                                      setSelectedImage(firstImage);
                                      setShowProductModal(true);
                                    }}
                                    className="bg-black/50 hover:bg-black/90 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
                                  >
                                    <EyeIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Product Name */}
                              <h3 className="text-white font-medium text-sm text-center mb-2 line-clamp-2">
                                {product.name}
                              </h3>

                              {/* Product Details */}
                              <div className="space-y-1 text-xs">
                                {/* Price */}
                                <div className="flex justify-center mb-2">
                                  <span className="text-blue-400 font-medium text-sm">
                                    {(product.price || 0).toFixed(2)}
                                  </span>
                                </div>

                                {/* Total Quantity */}
                                <div className="flex justify-between items-center">
                                  <span className="text-blue-400 font-medium">
                                    {(product.inventoryData &&
                                      Object.values(product.inventoryData).reduce(
                                        (sum: number, inv: any) =>
                                          sum + (inv?.quantity || 0),
                                        0,
                                      )) ||
                                      0}
                                  </span>
                                  <span className="text-gray-400">
                                    الكمية الإجمالية
                                  </span>
                                </div>

                                {/* Branch Quantities */}
                                {product.inventoryData &&
                                  Object.entries(product.inventoryData).map(
                                    ([locationId, inventory]: [string, any]) => {
                                      const branch = branches.find(
                                        (b) => b.id === locationId,
                                      );
                                      const locationName =
                                        branch?.name ||
                                        `موقع ${locationId.slice(0, 8)}`;

                                      return (
                                        <div
                                          key={locationId}
                                          className="flex justify-between items-center"
                                        >
                                          <span className="text-white">
                                            {inventory?.quantity || 0}
                                          </span>
                                          <span className="text-gray-400 truncate">
                                            {locationName}
                                          </span>
                                        </div>
                                      );
                                    },
                                  )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Shopping Cart Panel - Desktop: Sidebar, Mobile: Shows below search toolbar */}
        <div className="hidden md:flex">
          <div className="w-80 bg-[#374151] border-l-2 border-r-2 border-gray-500 flex flex-col h-screen flex-shrink-0"
          >
            {/* Cart Items Area - Full Height */}
            <div className="flex-1 border-t-2 border-gray-500 overflow-hidden">
              {cartItems.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-full p-8">
                  <ShoppingCartIcon className="h-24 w-24 text-gray-500 mb-8" />
                  <p className="text-gray-400 text-sm text-center mb-4">
                    اضغط على المنتجات لإضافتها للسلة
                  </p>
                  <div className="text-center">
                    <span className="bg-gray-600 px-3 py-1 rounded text-sm text-gray-300">
                      0 منتج
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {/* Cart Header */}
                  <div className="p-4 border-b border-gray-600 flex-shrink-0">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">السلة</span>
                        <span className="bg-blue-600 px-2 py-1 rounded text-xs text-white">
                          {cartItems.length}
                        </span>
                      </div>
                      {cartItems.length > 0 && (
                        <button
                          onClick={clearCart}
                          className="text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded px-2 py-1 transition-colors text-xs"
                          title="مسح السلة"
                        >
                          مسح الكل
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cart Items */}
                  <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3 min-h-0">
                    {cartItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-[#2B3544] rounded-lg p-3 border border-gray-600"
                      >
                        <div className="flex gap-3 mb-2">
                          {/* Product Image - OPTIMIZED */}
                          <div className="w-12 h-12 bg-[#374151] rounded-lg overflow-hidden flex-shrink-0">
                            <ProductThumbnail
                              src={item.product.main_image_url}
                              alt={item.product.name}
                            />
                          </div>

                          <div className="flex-1 flex justify-between items-start">
                            <h4 className="text-white text-sm font-medium leading-tight flex-1">
                              {item.product.name}
                            </h4>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-full p-1 transition-colors text-lg leading-none ml-2"
                              title="إزالة من السلة"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {/* Quantity and Price Row */}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs">
                              الكمية:
                            </span>
                            <EditableField
                              value={item.quantity}
                              type="number"
                              onUpdate={(newQuantity) => {
                                setCartItems((prev) => {
                                  const newCart = prev.map((cartItem) => {
                                    if (cartItem.id === item.id) {
                                      // Calculate the ratio of change for proportional color updates
                                      const ratio =
                                        newQuantity / cartItem.quantity;
                                      let updatedColors: {
                                        [key: string]: number;
                                      } | null = null;

                                      // If we have selected colors, update them proportionally
                                      if (cartItem.selectedColors) {
                                        updatedColors = {};
                                        Object.entries(
                                          cartItem.selectedColors,
                                        ).forEach(
                                          ([color, quantity]: [
                                            string,
                                            any,
                                          ]) => {
                                            updatedColors![color] = Math.max(
                                              1,
                                              Math.round(quantity * ratio),
                                            );
                                          },
                                        );
                                      }

                                      return {
                                        ...cartItem,
                                        quantity: newQuantity,
                                        selectedColors: updatedColors,
                                        total: isTransferMode
                                          ? 0
                                          : cartItem.price * newQuantity,
                                      };
                                    }
                                    return cartItem;
                                  });
                                  updateActiveTabCart(newCart);
                                  return newCart;
                                });
                              }}
                              className="text-white font-medium text-right bg-transparent border-none outline-none w-16 hover:bg-gray-600/20 rounded px-1"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            {!isTransferMode && (
                              <>
                                <span className="text-gray-400 text-xs">
                                  السعر:
                                </span>
                                <EditableField
                                  value={item.price}
                                  type="number"
                                  step="0.01"
                                  onUpdate={(newPrice) => {
                                    setCartItems((prev) => {
                                      const newCart = prev.map((cartItem) =>
                                        cartItem.id === item.id
                                          ? {
                                              ...cartItem,
                                              price: newPrice,
                                              total:
                                                cartItem.quantity * newPrice,
                                            }
                                          : cartItem,
                                      );
                                      updateActiveTabCart(newCart);
                                      return newCart;
                                    });
                                  }}
                                  className="text-blue-400 font-medium text-right bg-transparent border-none outline-none w-16 hover:bg-gray-600/20 rounded px-1"
                                />
                                <span className="text-blue-400 text-xs">
                                  {systemCurrency}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Colors Display */}
                        {item.selectedColors &&
                          Object.keys(item.selectedColors).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-600">
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(item.selectedColors).map(
                                  ([color, quantity]: [string, any]) => (
                                    <span
                                      key={color}
                                      className="bg-gray-600 px-2 py-1 rounded text-xs text-white"
                                    >
                                      {color}: {quantity}
                                    </span>
                                  ),
                                )}
                              </div>
                            </div>
                          )}

                        {/* Total */}
                        {!isTransferMode && (
                          <div className="mt-2 text-left">
                            <span className="text-green-400 font-bold text-sm">
                              {item.total.toFixed(2)} {systemCurrency}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cart Footer */}
            <div className="p-4 border-t border-gray-600 bg-[#2B3544] flex-shrink-0">
              {/* Payment Split Component - Only show in sales mode (not transfer or purchase) */}
              {!isTransferMode && !isPurchaseMode && !isReturnMode && (
                <PaymentSplit
                  totalAmount={cartTotal}
                  onPaymentsChange={(payments, credit) => {
                    setPaymentSplitData(payments);
                    setCreditAmount(credit);
                  }}
                />
              )}

              {/* Single row layout for total and button */}
              <div className="flex items-center justify-between gap-3">
                {/* Total/Transfer info section */}
                <div className="flex-shrink-0">
                  {!isTransferMode ? (
                    <div className="text-right">
                      <div className="text-white text-sm font-medium">الإجمالي:</div>
                      <div className="text-green-400 font-bold text-lg">
                        {formatPrice(cartTotal, "system")}
                      </div>
                    </div>
                  ) : (
                    <div className="text-right">
                      <div className="text-orange-400 text-sm font-medium">وضع النقل</div>
                      <div className="text-white font-bold text-lg">
                        {cartItems.reduce((sum, item) => sum + item.quantity, 0)} قطعة
                      </div>
                    </div>
                  )}
                </div>

                {/* Button section */}
                <button
                disabled={
                  cartItems.length === 0 ||
                  !hasAllRequiredSelections() ||
                  isProcessingInvoice
                }
                className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed text-white ${
                  isTransferMode
                    ? "bg-orange-600 hover:bg-orange-700"
                    : isReturnMode
                      ? "bg-red-600 hover:bg-red-700"
                      : isPurchaseMode
                        ? "bg-purple-600 hover:bg-purple-700"
                        : "bg-blue-600 hover:bg-blue-700"
                }`}
                onClick={handleCreateInvoice}
              >
                {isProcessingInvoice
                  ? "جاري المعالجة..."
                  : cartItems.length === 0
                    ? "السلة فارغة"
                    : !hasAllRequiredSelections()
                      ? "يجب إكمال التحديدات"
                      : isTransferMode
                        ? `تأكيد النقل (${cartItems.length})`
                        : isReturnMode
                          ? isPurchaseMode
                            ? `مرتجع شراء (${cartItems.length})`
                            : `مرتجع بيع (${cartItems.length})`
                          : isPurchaseMode
                            ? `تأكيد الشراء (${cartItems.length})`
                            : `تأكيد الطلب (${cartItems.length})`}
              </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Records Selection Modal */}
      <RecordsSelectionModal
        isOpen={isRecordsModalOpen}
        onClose={() => setIsRecordsModalOpen(false)}
        onSelectRecord={handleRecordSelect}
      />

      {/* Customer Selection Modal */}
      <CustomerSelectionModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelectCustomer={handleCustomerSelect}
      />

      {/* Branch Selection Modal */}
      <BranchSelectionModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        onSelectBranch={handleBranchSelect}
      />

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      {/* Add to Cart Modal */}
      <AddToCartModal
        isOpen={showAddToCartModal}
        onClose={() => {
          setShowAddToCartModal(false);
          setModalProduct(null);
        }}
        product={modalProduct}
        isTransferMode={isTransferMode}
        onAddToCart={(product, quantity, selectedColor) => {
          // Use the main handleAddToCart function to ensure consistent grouping
          const productWithCorrectPrice = {
            ...product,
            price: isTransferMode ? 0 : product.price || 0,
          };
          handleAddToCart(productWithCorrectPrice, quantity, selectedColor);
        }}
      />

      {/* Color Selection Modal */}
      <ColorSelectionModal
        isOpen={showColorSelectionModal}
        onClose={() => {
          setShowColorSelectionModal(false);
          setModalProduct(null);
        }}
        product={modalProduct}
        onAddToCart={handleColorSelection}
        hasRequiredForCart={hasRequiredForCart()}
        selectedBranchId={selections.branch?.id}
        isPurchaseMode={isPurchaseMode}
        isTransferMode={isTransferMode}
        transferFromLocation={transferFromLocation}
      />

      {/* Supplier Selection Modal */}
      <SupplierSelectionModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        onSelect={setSelectedSupplier}
        selectedSupplier={selectedSupplier}
      />

      {/* Warehouse Selection Modal */}
      <WarehouseSelectionModal
        isOpen={isWarehouseModalOpen}
        onClose={() => setIsWarehouseModalOpen(false)}
        onSelect={setSelectedWarehouse}
        selectedWarehouse={selectedWarehouse}
      />

      {/* Transfer Location Selection Modal */}
      <TransferLocationModal
        isOpen={isTransferLocationModalOpen}
        onClose={() => setIsTransferLocationModalOpen(false)}
        onConfirm={handleTransferLocationConfirm}
      />

      {/* Quick Add Product Modal */}
      <QuickAddProductModal
        isOpen={showQuickAddProductModal}
        onClose={() => setShowQuickAddProductModal(false)}
        onAddToCart={handleQuickAddToCart}
      />

      {/* Product Details Modal */}
      {showProductModal && modalProduct && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowProductModal(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] max-w-6xl w-full max-h-[90vh] overflow-y-auto scrollbar-hide">
              {/* Header */}
              <div className="sticky top-0 bg-[#2B3544] px-8 py-6 border-b border-[#4A5568] flex items-center justify-between rounded-t-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">📦</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      تفاصيل المنتج
                    </h2>
                    <p className="text-blue-400 font-medium">
                      {modalProduct.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-600/30 rounded-full transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-8">
                <div className="grid grid-cols-3 gap-8">
                  {/* Left Column - Product Info */}
                  <div className="space-y-6">
                    {/* Basic Info Card */}
                    <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                          <span className="text-blue-400 text-sm">ℹ️</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                          معلومات المنتج
                        </h3>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-gray-600/50">
                          <span className="text-gray-400">المجموعة</span>
                          <span className="text-white font-medium">
                            {modalProduct.category?.name || "غير محدد"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-600/50">
                          <span className="text-gray-400">الوحدة</span>
                          <span className="text-white font-medium">
                            {modalProduct.unit || "قطعة"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-600/50">
                          <span className="text-gray-400">الحد الأدنى</span>
                          <span className="text-white font-medium">
                            {modalProduct.min_stock || 0}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-gray-400">الباركود</span>
                          <span className="text-white font-mono text-sm">
                            {modalProduct.barcode || "غير متوفر"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pricing Card */}
                    <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center">
                          <span className="text-green-400 text-sm">💰</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                          الأسعار
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">
                            سعر البيع
                          </p>
                          <p className="text-green-400 font-bold text-xl">
                            {(modalProduct.price || 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">
                            سعر الشراء
                          </p>
                          <p className="text-orange-400 font-bold text-xl">
                            {(modalProduct.cost_price || 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">
                            سعر الجملة
                          </p>
                          <p className="text-blue-400 font-bold text-lg">
                            {(modalProduct.wholesale_price || 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">سعر 1</p>
                          <p className="text-purple-400 font-bold text-lg">
                            {(modalProduct.price1 || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Description Card */}
                    {modalProduct.description && (
                      <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center">
                            <span className="text-purple-400 text-sm">📝</span>
                          </div>
                          <h3 className="text-lg font-semibold text-white">
                            وصف المنتج
                          </h3>
                        </div>
                        <p className="text-gray-300 leading-relaxed">
                          {modalProduct.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Middle Column - Inventory */}
                  <div className="space-y-6">
                    {/* Total Inventory Card */}
                    <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                          <span className="text-blue-400 text-sm">📊</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                          المخازن والفروع
                        </h3>
                      </div>

                      {/* Total Quantity Display */}
                      <div className="bg-blue-600/10 rounded-lg p-4 mb-4 text-center border border-blue-600/20">
                        <p className="text-blue-400 text-sm mb-1">
                          الكمية الإجمالية
                        </p>
                        <p className="text-blue-400 font-bold text-3xl">
                          {(modalProduct.inventoryData &&
                            Object.values(modalProduct.inventoryData).reduce(
                              (sum: number, inv: any) =>
                                sum + (inv?.quantity || 0),
                              0,
                            )) ||
                            0}
                        </p>
                      </div>

                      {/* Branch/Warehouse Details */}
                      <div className="space-y-3">
                        {modalProduct.inventoryData &&
                          Object.entries(modalProduct.inventoryData).map(
                            ([locationId, inventory]: [string, any]) => {
                              const branch = branches.find(
                                (b) => b.id === locationId,
                              );
                              const locationName =
                                branch?.name ||
                                `موقع ${locationId.slice(0, 8)}`;

                              return (
                                <div
                                  key={locationId}
                                  className="bg-[#2B3544] rounded-lg p-4 border border-gray-600/30"
                                >
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-white font-medium">
                                      {locationName}
                                    </span>
                                    <span className="text-blue-400 font-bold text-lg">
                                      {inventory?.quantity || 0}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400">
                                      الحد الأدنى
                                    </span>
                                    <span className="text-orange-400">
                                      {inventory?.min_stock || 0}
                                    </span>
                                  </div>
                                </div>
                              );
                            },
                          )}
                      </div>
                    </div>

                    {/* Variants Card */}
                    {modalProduct.variantsData &&
                      Object.keys(modalProduct.variantsData).length > 0 && (
                        <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center">
                              <span className="text-purple-400 text-sm">
                                🎨
                              </span>
                            </div>
                            <h3 className="text-lg font-semibold text-white">
                              الألوان والأشكال
                            </h3>
                          </div>
                          <div className="space-y-3">
                            {Object.entries(modalProduct.variantsData).map(
                              ([locationId, variants]: [string, any]) => {
                                const branch = branches.find(
                                  (b) => b.id === locationId,
                                );
                                const locationName =
                                  branch?.name ||
                                  `موقع ${locationId.slice(0, 8)}`;

                                return (
                                  <div
                                    key={locationId}
                                    className="bg-[#2B3544] rounded-lg p-4"
                                  >
                                    <p className="text-white font-medium mb-3">
                                      {locationName}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {variants.map(
                                        (variant: any, index: number) => (
                                          <span
                                            key={index}
                                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-600 text-white border border-gray-500"
                                          >
                                            {variant.name} ({variant.quantity})
                                          </span>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Right Column - Images */}
                  <div className="space-y-6">
                    {/* Main Image Preview */}
                    <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center">
                          <span className="text-indigo-400 text-sm">🖼️</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                          صور المنتج
                        </h3>
                      </div>

                      {/* Large Image Preview - OPTIMIZED */}
                      <div className="mb-4">
                        <ProductModalImage
                          src={selectedImage}
                          alt={modalProduct.name}
                          priority={true}
                        />
                      </div>

                      {/* Thumbnail Gallery */}
                      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto scrollbar-hide">
                        {modalProduct.allImages &&
                        modalProduct.allImages.length > 0 ? (
                          modalProduct.allImages.map(
                            (imageUrl: string, index: number) => (
                              <ProductThumbnail
                                key={index}
                                src={imageUrl}
                                alt={`صورة ${index + 1}`}
                                isSelected={selectedImage === imageUrl}
                                onClick={() => setSelectedImage(imageUrl)}
                              />
                            ),
                          )
                        ) : (
                          /* Fallback when no images available */
                          <div className="w-full h-16 bg-[#2B3544] rounded-md border border-gray-600/30 flex items-center justify-center col-span-4">
                            <span className="text-gray-500 text-xs">
                              لا توجد صور متاحة
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Categories Display Modal */}
      {isCategoriesModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#2B3544] rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">المجموعات</h3>
              <button
                onClick={toggleCategoriesModal}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {isLoadingCategories ? (
                <div className="text-center py-4 text-gray-400">
                  جارٍ التحميل...
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-4 text-gray-400">
                  لا توجد مجموعات
                </div>
              ) : (
                categories.map((category) => (
                  <div
                    key={category.id}
                    className="p-3 bg-[#374151] rounded-lg text-white hover:bg-[#4B5563] transition-colors cursor-pointer"
                    onClick={() => {
                      console.log("Selected category:", category);
                      setIsCategoriesModalOpen(false);
                    }}
                  >
                    <div className="font-medium">{category.name}</div>
                    {category.name_en && (
                      <div className="text-sm text-gray-400">
                        {category.name_en}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-600">
              <button
                onClick={toggleCategoriesModal}
                className="w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Mode Confirmation Modal */}
      {showPurchaseModeConfirm && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowPurchaseModeConfirm(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] w-full max-w-md">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#4A5568]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                    <ShoppingBagIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      تفعيل وضع الشراء
                    </h2>
                    <p className="text-gray-400 text-sm">تأكيد تبديل الوضع</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-4">
                  <p className="text-orange-400 text-sm flex items-center gap-2">
                    <span className="text-orange-400">⚠️</span>
                    سيتم تغيير واجهة نقطة البيع لوضع الشراء
                  </p>
                </div>

                <div className="space-y-3 text-gray-300 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">•</span>
                    <span>سيتم استبدال اختيار العميل باختيار المورد</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">•</span>
                    <span>سيتم إضافة خيار اختيار المخزن أو الفرع</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">•</span>
                    <span>سيتم تعطيل اختيار الألوان والأشكال</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">•</span>
                    <span>سيتم إضافة إمكانية إنشاء منتجات جديدة</span>
                  </div>
                </div>

                <p className="text-white font-medium mt-4 text-center">
                  هل تريد تفعيل وضع الشراء؟
                </p>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-[#4A5568]">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPurchaseModeConfirm(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={confirmPurchaseMode}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingBagIcon className="h-5 w-5" />
                    تفعيل وضع الشراء
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Print Receipt Confirmation Modal */}
      {showPrintReceiptModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowPrintReceiptModal(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] w-full max-w-md">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#4A5568]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                    <PrinterIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      طباعة الفاتورة
                    </h2>
                    <p className="text-gray-400 text-sm">
                      تم إنشاء الفاتورة بنجاح
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
                  <p className="text-green-400 text-sm flex items-center gap-2 mb-2">
                    <span className="text-green-400">✅</span>
                    تم إنشاء{" "}
                    {lastInvoiceData?.isReturn ? "المرتجع" : "الفاتورة"} بنجاح
                  </p>
                  <div className="text-white text-sm space-y-1">
                    <p>
                      رقم الفاتورة:{" "}
                      <span className="font-bold">
                        {lastInvoiceData?.invoiceNumber}
                      </span>
                    </p>
                    <p>
                      الإجمالي:{" "}
                      <span className="font-bold text-green-400">
                        {formatPrice(
                          lastInvoiceData?.totalAmount || 0,
                          "system",
                        )}
                      </span>
                    </p>
                    <p>
                      عدد الأصناف:{" "}
                      <span className="font-bold">
                        {lastInvoiceData?.cartItems?.length}
                      </span>
                    </p>
                  </div>
                </div>

                <p className="text-white font-medium text-center mb-4">
                  هل تريد طباعة الفاتورة؟
                </p>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-[#4A5568]">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPrintReceiptModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    لا، شكراً
                  </button>
                  <button
                    onClick={() => {
                      printReceipt(lastInvoiceData);
                      setShowPrintReceiptModal(false);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <PrinterIcon className="h-5 w-5" />
                    نعم، اطبع الفاتورة
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        /* Enhanced scrollbar styles for table container */
        .custom-scrollbar {
          /* For Firefox */
          scrollbar-width: thin;
          scrollbar-color: #6b7280 #374151;
        }

        .custom-scrollbar::-webkit-scrollbar {
          height: 12px; /* Horizontal scrollbar height */
          width: 12px; /* Vertical scrollbar width */
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: #374151;
          border-radius: 7px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #6b7280;
          border-radius: 7px;
          border: 2px solid #374151;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }

        /* Enhanced scrollbar visibility */
        .custom-scrollbar::-webkit-scrollbar:horizontal {
          height: 12px;
          display: block;
        }

        .custom-scrollbar::-webkit-scrollbar:vertical {
          width: 12px;
          display: block;
        }

        /* Ensure proper scrolling behavior */
        .table-container {
          position: relative;
        }

        /* Utility classes for grid view */
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .scrollbar-hide {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Columns Control Modal */}
      <ColumnsControlModal
        isOpen={showColumnsModal}
        onClose={() => setShowColumnsModal(false)}
        columns={getAllColumns()}
        onColumnsChange={handleColumnsChange}
      />

      {/* Cart Modal */}
      <CartModal
        isOpen={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
      />

      {/* Add Tab Modal */}
      {showAddTabModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowAddTabModal(false)}>
          <div className="bg-[#2B3544] rounded-lg p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white text-lg font-medium mb-4">إضافة نافذة بيع جديدة</h3>
            <input
              type="text"
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              placeholder="اسم النافذة..."
              className="w-full px-4 py-2 bg-[#374151] border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newTabName.trim()) {
                  addTab(newTabName.trim());
                  setNewTabName("");
                  setShowAddTabModal(false);
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setNewTabName("");
                  setShowAddTabModal(false);
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  if (newTabName.trim()) {
                    addTab(newTabName.trim());
                    setNewTabName("");
                    setShowAddTabModal(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                disabled={!newTabName.trim()}
              >
                موافق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function POSPage() {
  return (
    <CartProvider>
      <POSPageContent />
    </CartProvider>
  );
}
