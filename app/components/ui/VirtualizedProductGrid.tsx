"use client";

import { useRef, useCallback, useEffect, useState, useMemo, CSSProperties, memo } from "react";
import { Grid, GridImperativeAPI, CellComponentProps } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";
import { Product, Branch } from "../../lib/hooks/useProductsOptimized";
import { ProductGridImage } from "./OptimizedImage";
import { EyeIcon } from "@heroicons/react/24/outline";

interface VirtualizedProductGridProps {
  products: Product[];
  branches: Branch[];
  selectedProduct: Product | null;
  onProductClick: (product: Product) => void;
  onProductSelect: (product: Product | null) => void;
  onViewDetails: (product: Product) => void;
  getProductPriceByType: (product: Product) => number;
  isSidebarOpen: boolean;
  columnCount?: number;
  rowHeight?: number;
}

interface CellProps {
  products: Product[];
  branches: Branch[];
  selectedProduct: Product | null;
  columnCount: number;
  onProductClick: (product: Product) => void;
  onProductSelect: (product: Product | null) => void;
  onViewDetails: (product: Product) => void;
  getProductPriceByType: (product: Product) => number;
  isSidebarOpen: boolean;
}

// Product Card Component - Memoized for performance
const ProductCard = memo(function ProductCard({
  product,
  branches,
  isSelected,
  onProductClick,
  onProductSelect,
  onViewDetails,
  getProductPriceByType,
  isSidebarOpen,
}: {
  product: Product;
  branches: Branch[];
  isSelected: boolean;
  onProductClick: (product: Product) => void;
  onProductSelect: (product: Product | null) => void;
  onViewDetails: (product: Product) => void;
  getProductPriceByType: (product: Product) => number;
  isSidebarOpen: boolean;
}) {
  const handleClick = useCallback(() => {
    if (isSelected) {
      onProductSelect(null);
    } else {
      onProductSelect(product);
    }
    onProductClick(product);
  }, [isSelected, product, onProductSelect, onProductClick]);

  const handleViewDetails = useCallback(
    (e: React.MouseEvent) => {
      if (isSidebarOpen) return;
      e.stopPropagation();
      onViewDetails(product);
    },
    [isSidebarOpen, product, onViewDetails]
  );

  // OPTIMIZED: Use pre-computed totalQuantity from hook instead of recalculating
  const totalQuantity = product.totalQuantity || 0;

  // OPTIMIZED: Memoize branch quantities to avoid recalculation on every render
  const branchQuantities = useMemo(() => {
    if (!product.inventoryData) return [];
    return Object.entries(product.inventoryData).map(([locationId, inventory]: [string, any]) => {
      const branch = branches.find((b) => b.id === locationId);
      return {
        locationId,
        locationName: branch?.name || `موقع ${locationId.slice(0, 8)}`,
        quantity: inventory?.quantity || 0
      };
    });
  }, [product.inventoryData, branches]);

  return (
    <div
      onClick={handleClick}
      className={`bg-[#374151] rounded-lg p-3 cursor-pointer transition-all duration-200 border-2 relative group h-full ${
        isSelected
          ? "border-blue-500 bg-[#434E61]"
          : "border-transparent hover:border-gray-500 hover:bg-[#434E61]"
      }`}
    >
      {/* Product Image */}
      <div className="mb-3 relative">
        <ProductGridImage
          src={product.main_image_url}
          alt={product.name}
          priority={false}
        />

        {/* View Details Button */}
        <div className="absolute top-2 right-2 z-50">
          <button
            onClick={handleViewDetails}
            className={`bg-black/50 hover:bg-black/90 text-white p-2 rounded-full opacity-0 ${
              !isSidebarOpen ? "group-hover:opacity-100" : "pointer-events-none"
            } transition-all duration-200 shadow-lg`}
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
            {getProductPriceByType(product).toFixed(2)}
          </span>
        </div>

        {/* Total Quantity */}
        <div className="flex justify-between items-center">
          <span className="text-blue-400 font-medium">{totalQuantity}</span>
          <span className="text-gray-400">الكمية الإجمالية</span>
        </div>

        {/* Branch Quantities - Using memoized data */}
        {branchQuantities.map(({ locationId, locationName, quantity }) => (
          <div
            key={locationId}
            className="flex justify-between items-center"
          >
            <span className="text-white">{quantity}</span>
            <span className="text-gray-400 truncate">{locationName}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

// Grid Cell Component - receives props from cellProps
function CellComponent({
  columnIndex,
  rowIndex,
  style,
  products,
  branches,
  selectedProduct,
  columnCount,
  onProductClick,
  onProductSelect,
  onViewDetails,
  getProductPriceByType,
  isSidebarOpen,
}: {
  ariaAttributes: { "aria-colindex": number; role: "gridcell" };
  columnIndex: number;
  rowIndex: number;
  style: CSSProperties;
} & CellProps) {
  const index = rowIndex * columnCount + columnIndex;
  const product = products[index];

  if (!product) {
    return null;
  }

  const isSelected = selectedProduct?.id === product.id;

  return (
    <div style={style} className="p-2">
      <ProductCard
        product={product}
        branches={branches}
        isSelected={isSelected}
        onProductClick={onProductClick}
        onProductSelect={onProductSelect}
        onViewDetails={onViewDetails}
        getProductPriceByType={getProductPriceByType}
        isSidebarOpen={isSidebarOpen}
      />
    </div>
  );
}

export function VirtualizedProductGrid({
  products,
  branches,
  selectedProduct,
  onProductClick,
  onProductSelect,
  onViewDetails,
  getProductPriceByType,
  isSidebarOpen,
  columnCount: propColumnCount,
  rowHeight = 320,
}: VirtualizedProductGridProps) {
  const gridRef = useRef<GridImperativeAPI>(null);
  const [columnCount, setColumnCount] = useState(propColumnCount || 6);

  // Handle responsive column count
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (propColumnCount) {
        setColumnCount(propColumnCount);
      } else if (width < 768) {
        setColumnCount(2);
      } else if (width < 1024) {
        setColumnCount(4);
      } else {
        setColumnCount(6);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [propColumnCount]);

  // Reset scroll when products change significantly (e.g., search)
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollToCell({ rowIndex: 0, columnIndex: 0 });
    }
  }, [products.length]);

  const rowCount = Math.ceil(products.length / columnCount);

  // Cell props for the grid
  const cellProps: CellProps = {
    products,
    branches,
    selectedProduct,
    columnCount,
    onProductClick,
    onProductSelect,
    onViewDetails,
    getProductPriceByType,
    isSidebarOpen,
  };

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-center">
          <p className="text-lg mb-2">لا توجد منتجات</p>
          <p className="text-sm">جرب البحث بكلمات مختلفة</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <AutoSizer
        renderProp={({ height, width }) => {
          if (!height || !width) {
            return null;
          }
          return (
            <Grid
              gridRef={gridRef}
              columnCount={columnCount}
              rowCount={rowCount}
              columnWidth={width / columnCount}
              rowHeight={rowHeight}
              defaultWidth={width}
              defaultHeight={height}
              cellComponent={CellComponent}
              cellProps={cellProps}
              overscanCount={3}
              className="scrollbar-hide"
            />
          );
        }}
      />
    </div>
  );
}

export default VirtualizedProductGrid;
