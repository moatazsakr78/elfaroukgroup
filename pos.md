│ app/(dashboard)/pos/page.tsx                 │ استبدال products.map بـ FixedSizeGrid    │
     ├──────────────────────────────────────────────┼──────────────────────────────────────────┤
     │ app/components/ui/VirtualizedProductGrid.tsx │ مكون جديد للـ Grid المُجرد               │
     └──────────────────────────────────────────────┴──────────────────────────────────────────┘
     خطوات التنفيذ

     1. تثبيت المكتبة

     npm install react-window @types/react-window

     2. إنشاء مكون VirtualizedProductGrid

     // app/components/ui/VirtualizedProductGrid.tsx
     import { FixedSizeGrid as Grid } from 'react-window';
     import AutoSizer from 'react-virtualized-auto-sizer';

     interface Props {
       products: Product[];
       columnCount: number;
       onProductClick: (product: Product) => void;
       // ... باقي الـ props
     }

     export function VirtualizedProductGrid({ products, columnCount, onProductClick }: Props) {
       const rowCount = Math.ceil(products.length / columnCount);

       return (
         <AutoSizer>
           {({ height, width }) => (
             <Grid
               columnCount={columnCount}
               rowCount={rowCount}
               columnWidth={width / columnCount}
               rowHeight={250}
               width={width}
               height={height}
             >
               {({ columnIndex, rowIndex, style }) => {
                 const index = rowIndex * columnCount + columnIndex;
                 const product = products[index];
                 if (!product) return null;

                 return (
                   <div style={style} className="p-2">
                     <ProductCard
                       product={product}
                       onClick={() => onProductClick(product)}
                     />
                   </div>
                 );
               }}
             </Grid>
           )}
         </AutoSizer>
       );
     }

     3. تحديث pos/page.tsx

     قبل:
     {products.map((product, index) => (
       <div className={`... ${!isProductVisible(product.id) ? "hidden" : ""}`}>
         {/* ProductCard */}
       </div>
     ))}

     بعد:
     <VirtualizedProductGrid
       products={filteredProducts}
       columnCount={isTabletDevice ? 3 : 6}
       onProductClick={handleProductClick}
       // ... باقي الـ props
     />

     4. التحسينات الإضافية

     - ✅ إزالة CSS hidden pattern
     - ✅ استخدام filteredProducts بدلاً من products
     - ✅ إضافة Skeleton loading للصور
     - ✅ الاحتفاظ بـ debounce للبحث

     ---
     التحقق والاختبار

     1. فتح صفحة POS مع كل المنتجات (2000+)
     2. التحقق من:
       - Initial load سريع (< 2 ثانية)
       - Scroll سلس بدون lag
       - البحث يعمل بسلاسة
       - النقر على منتج يفتح التفاصيل
       - إضافة للسلة تعمل
     3. فحص Chrome DevTools:
       - DOM nodes < 100 في أي لحظة
       - Memory usage مستقر
       - No layout thrashing

     ---
     النتائج المتوقعة
     ┌─────────────────┬───────────┬────────┐
     │     المقياس     │    قبل    │  بعد   │
     ├─────────────────┼───────────┼────────┤
     │ DOM Nodes       │ 2000+     │ ~50    │
     ├─────────────────┼───────────┼────────┤
     │ Initial Load    │ 5-10s     │ < 1s   │
     ├─────────────────┼───────────┼────────┤
     │ Memory Usage    │ عالي جداً │ منخفض  │
     ├─────────────────┼───────────┼────────┤
     │ Scroll FPS      │ متقطع     │ 60 FPS │
     ├─────────────────┼───────────┼────────┤
     │ Search Response │ بطيء      │ فوري   │
     └─────────────────┴───────────┴────────┘

● ممتاز! تم الموافقة على الخطة. دعني أبدأ التنفيذ.

● Bash(cd /c/Users/pc/Desktop/elfaroukgroup && npm install react-window react-virtualized-auto-sizer @types/react-window)
  ⎿  added 3 packages, and audited 879 packages in 20s

     184 packages are looking for funding                                                                                                                                                                           
     … +15 lines (ctrl+o to expand)                                                                                    
                                                                                                                                                                                                                    
● دعني أحلل الـ Grid الحالي لفهم البنية.                                                                                                                                                                            
                                                                                                                                                                                                                    
● Read(app\(dashboard)\pos\page.tsx)                                                                                                                                                                                
  ⎿  Read 150 lines                                                                                                                                                                                                 
                                                                                                                                                                                                                    
● دعني أقرأ المزيد من السياق لفهم كل المتغيرات المستخدمة.                                                                                                                                                           
                                                                                                                                                                                                                    
● Read(app\(dashboard)\pos\page.tsx)                                                                                                                                                                                
  ⎿  Read 50 lines                                                                                                                                                                                                  
                                                                                                                                                                                                                    
● Search(pattern: "interface Product|type Product", path: "app", output_mode: "content")                                                                                                                            
  ⎿  Found 51 lines (ctrl+o to expand)                                                                                                                                                                              
                                                                                                                                                                                                                    
● Search(pattern: "import.*Product.*from", path: "app\(dashboard)\pos\page.tsx", output_mode: "content")                                                                                                              ⎿  Found 4 lines (ctrl+o to expand)
                                                                                                                                                                                                                    
● Search(pattern: "export interface Branch", path: "~\Desktop\elfaroukgroup", output_mode: "content")                                                                                                                 ⎿  Found 7 lines (ctrl+o to expand)                                                                                                                                                                               
                                                                                                                                                                                                                    
● الآن دعني أنشئ مكون VirtualizedProductGrid.                                                                                                                                                                                                                                                                                                                                                                                           
● Write(app\components\ui\VirtualizedProductGrid.tsx)                                                                                                                                                               
  ⎿  Wrote 1 lines to app\components\ui\VirtualizedProductGrid.tsx                                                                                                                                                  
     "use client";                                                                                                                                                                                                  
     import { useRef, useCallback, useEffect, useState } from "react";                                                                                                                                              
     import { FixedSizeGrid as Grid, GridChildComponentProps } from "react-window";                                                                                                                                 
     import AutoSizer from "react-virtualized-auto-sizer";                                                                                                                                                          
     import { Product } from "../../lib/hooks/useProductsOptimized";                                                                                                                                                     import { Branch } from "../../../lib/hooks/useProductsAdmin";
     import { ProductGridImage } from "./OptimizedImage";                                                                                                                                                                import { EyeIcon } from "@heroicons/react/24/outline";
                                                                                                                                                                                                                    ● الآن دعني أحدث صفحة POS. أولاً، سأضيف الـ import.                       ↓                        )
    
● Read(app\(dashboard)\pos\page.tsx)
  ⎿  Read 10 lines                            
  
● Update(app\(dashboard)\pos\page.tsx)                                                                   
  ⎿  Added 1 line                                                                                                                                                                                                   
      114  import PostponedInvoicesModal from "../../components/PostponedInvoicesModal";
      115  import CashDrawerModal from "../../components/CashDrawerModal";                                                                                                                                                116  import ProductGridSkeleton from "../../components/ui/ProductGridSkeleton";
      117 +import VirtualizedProductGrid from "../../components/ui/VirtualizedProductGrid";                                                                                                                         
      118  import { useProductsAdmin } from "../../../lib/hooks/useProductsAdmin";                                                                                                                                        119  import { Product } from "../../lib/hooks/useProductsOptimized";                                                                                                                                          
      120  import { usePersistentSelections } from "../../lib/hooks/usePersistentSelections";                                                                                                                          
● الآن دعني أستبدل قسم Grid View بالمكون الجديد.                                                                                                                                                                    
    
● Read(app\(dashboard)\pos\page.tsx)
  ⎿  Read 120 lines                           
  
● Update(app\(dashboard)\pos\page.tsx)                                                  
  ⎿  Added 21 lines, removed 114 lines                                                                                                                                                                              
      5951                        />
      5952                      </div>                                                                                                                                                                                    5953                    ) : (                                                                                                                                                                                 
      5954 -                    /* Grid View - Responsive scroll solution */                                                                                                                                        
      5955 -                    <div className="flex-1 overflow-hidden">                                                                                                                                                  5956 -                      <div className="h-full overflow-y-auto scrollbar-hide p-4">                                                                                                                       
      5957 -                        <div className="grid gap-4 grid-cols-2 md:grid-cols-6">                                                                                                                               5958 -                          {/* OPTIMIZED: Use CSS visibility to hide products instead of filtering */}
      5959 -                          {/* This keeps images loaded in DOM and prevents re-loading on search changes */}                                                                                             
      5960 -                          {products.map((product, index) => (
      5961 -                            <div                                                                                                                                                                        
      5962 -                              key={product.id}                                                                                                                                                          
      5963 -                              onClick={() => {                                                                                                                                                          
      5964 -                                if (!isProductVisible(product.id)) return; // Don't allow clicks on hidden products                                                                                     
      5965 -                                if (selectedProduct?.id === product.id) {                                                                                                                               
      5966 -                                  setSelectedProduct(null);                                                                                                                                             
      5967 -                                } else {                                                                                                                                                                
      5968 -                                  setSelectedProduct(product);                                                                                                                                          
      5969 -                                }                                                                                                                                                                       
      5970 -                                handleProductClick(product);                                                                                                                                            
      5971 -                              }}                                                                                                                                                                        
      5972 -                              className={`bg-[#374151] rounded-lg p-3 cursor-pointer transition-all duration-200 border-2 relative group ${                                                             
      5973 -                                selectedProduct?.id === product.id                                                                                                                                      
      5974 -                                  ? "border-blue-500 bg-[#434E61]"                                                                                                                                      
      5975 -                                  : "border-transparent hover:border-gray-500 hover:bg-[#434E61]"                                                                                                       
      5976 -                              } ${!isProductVisible(product.id) ? "hidden" : ""}`}                                                                                                                      
      5977 -                            >                                                                                                                                                                           
      5978 -                              {/* Product Image */}                                                                                                                                                     
      5979 -                              <div className="mb-3 relative">                                                                                                                                           
      5980 -                                <ProductGridImage                                                                                                                                                       
      5981 -                                  src={product.main_image_url}                                                                                                                                          
      5982 -                                  alt={product.name}                                                                                                                                                    
      5983 -                                  priority={index < 6}                                                                                                                                                  
      5984 -                                />                                                                                                                                                                      
      5985 -                                                                                                                                                                                                        
      5986 -                                {/* View Details Button */}                                                                                                                                             
      5987 -                                <div className="absolute top-2 right-2 z-50">                                                                                                                           
      5988 -                                  <button                                                                                                                                                               
      5989 -                                    onClick={(e) => {                                                                                                                                                   
      5990 -                                      if (isSidebarOpen) return; // لا تعمل إذا القائمة مفتوحة                                                                                                          
      5991 -                                      e.stopPropagation();                                                                                                                                              
      5992 -                                      setModalProduct(product);                                                                                                                                         
      5993 -                                      const firstImage =                                                                                                                                                
      5994 -                                        product.allImages?.[0] ||                                                                                                                                       
      5995 -                                        product.main_image_url ||                                                                                                                                       
      5996 -                                        null;                                                                                                                                                           
      5997 -                                      setSelectedImage(firstImage);                                                                                                                                     
      5998 -                                      setShowProductModal(true);                                                                                                                                        
      5999 -                                    }}                                                                                                                                                                  
      6000 -                                    className={`bg-black/50 hover:bg-black/90 text-white p-2 rounded-full opacity-0 ${!isSidebarOpen ? 'group-hover:opacity-100' : 'pointer-events-none'}               
           -transition-all duration-200 shadow-lg`}                                                                                                                                                                 
      6001 -                                  >                                                                                                                                                                     
      6002 -                                    <EyeIcon className="h-4 w-4" />                                                                                                                                     
      6003 -                                  </button>                                                                                                                                                             
      6004 -                                </div>                                                                                                                                                                  
      6005 -                              </div>                                                                                                                                                                    
      6006 -                                                                                                                                                                                                        
      6007 -                              {/* Product Name */}                                                                                                                                                      
      6008 -                              <h3 className="text-white font-medium text-sm text-center mb-2 line-clamp-2">                                                                                             
      6009 -                                {product.name}                                                                                                                                                          
      6010 -                              </h3>                                                                                                                                                                     
      6011 -                                                                                                                                                                                                        
      6012 -                              {/* Product Details */}                                                                                                                                                   
      6013 -                              <div className="space-y-1 text-xs">                                                                                                                                       
      6014 -                                {/* Price */}                                                                                                                                                           
      6015 -                                <div className="flex justify-center mb-2">                                                                                                                              
      6016 -                                  <span className="text-blue-400 font-medium text-sm">                                                                                                                  
      6017 -                                    {getProductPriceByType(product).toFixed(2)}                                                                                                                         
      6018 -                                  </span>                                                                                                                                                               
      6019 -                                </div>                                                                                                                                                                  
      6020 -                                                                                                                                                                                                        
      6021 -                                {/* Total Quantity */}                                                                                                                                                  
      6022 -                                <div className="flex justify-between items-center">                                                                                                                     
      6023 -                                  <span className="text-blue-400 font-medium">                                                                                                                          
      6024 -                                    {(product.inventoryData &&                                                                                                                                          
      6025 -                                      Object.values(product.inventoryData).reduce(                                                                                                                      
      6026 -                                        (sum: number, inv: any) =>                                                                                                                                      
      6027 -                                          sum + (inv?.quantity || 0),                                                                                                                                   
      6028 -                                        0,                                                                                                                                                              
      6029 -                                      )) ||                                                                                                                                                             
      6030 -                                      0}                                                                                                                                                                
      6031 -                                  </span>                                                                                                                                                               
      6032 -                                  <span className="text-gray-400">                                                                                                                                      
      6033 -                                    الكمية الإجمالية                                                                                                                                                    
      6034 -                                  </span>                                                                                                                                                               
      6035 -                                </div>                                                                                                                                                                  
      6036 -                                                                                                                                                                                                        
      6037 -                                {/* Branch Quantities */}                                                                                                                                               
      6038 -                                {product.inventoryData &&                                                                                                                                               
      6039 -                                  Object.entries(product.inventoryData).map(                                                                                                                            
      6040 -                                    ([locationId, inventory]: [string, any]) => {                                                                                                                       
      6041 -                                      const branch = branches.find(                                                                                                                                     
      6042 -                                        (b) => b.id === locationId,                                                                                                                                     
      6043 -                                      );                                                                                                                                                                
      6044 -                                      const locationName =                                                                                                                                              
      6045 -                                        branch?.name ||                                                                                                                                                 
      6046 -                                        `موقع ${locationId.slice(0, 8)}`;                                                                                                                               
      6047 -                                                                                                                                                                                                        
      6048 -                                      return (                                                                                                                                                          
      6049 -                                        <div                                                                                                                                                            
      6050 -                                          key={locationId}                                                                                                                                              
      6051 -                                          className="flex justify-between items-center"                                                                                                                 
      6052 -                                        >                                                                                                                                                               
      6053 -                                          <span className="text-white">                                                                                                                                 
      6054 -                                            {inventory?.quantity || 0}                                                                                                                                  
      6055 -                                          </span>                                                                                                                                                       
      6056 -                                          <span className="text-gray-400 truncate">                                                                                                                     
      6057 -                                            {locationName}                                                                                                                                              
      6058 -                                          </span>                                                                                                                                                       
      6059 -                                        </div>                                                                                                                                                          
      6060 -                                      );                                                                                                                                                                
      6061 -                                    },                                                                                                                                                                  
      6062 -                                  )}                                                                                                                                                                    
      6063 -                              </div>                                                                                                                                                                    
      6064 -                            </div>                                                                                                                                                                      
      6065 -                          ))}                                                                                                                                                                           
      6066 -                        </div>                                                                                                                                                                          
      6067 -                      </div>                                                                                                                                                                            
      5954 +                    /* Grid View - Virtualized for performance with 2000+ products */                                                                                                                   
      5955 +                    <div className="flex-1 overflow-hidden p-2">                                                                                                                                        
      5956 +                      <VirtualizedProductGrid                                                                                                                                                           
      5957 +                        products={filteredProducts}                                                                                                                                                     
      5958 +                        branches={branches}                                                                                                                                                             
      5959 +                        selectedProduct={selectedProduct}                                                                                                                                               
      5960 +                        onProductClick={handleProductClick}                                                                                                                                             
      5961 +                        onProductSelect={setSelectedProduct}                                                                                                                                            
      5962 +                        onViewDetails={(product) => {                                                                                                                                                   
      5963 +                          setModalProduct(product);                                                                                                                                                     
      5964 +                          const firstImage =                                                                                                                                                            
      5965 +                            product.allImages?.[0] ||                                                                                                                                                   
      5966 +                            product.main_image_url ||                                                                                                                                                   
      5967 +                            null;                                                                                                                                                                       
      5968 +                          setSelectedImage(firstImage);                                                                                                                                                 
      5969 +                          setShowProductModal(true);                                                                                                                                                    
      5970 +                        }}                                                                                                                                                                              
      5971 +                        getProductPriceByType={getProductPriceByType}                                                                                                                                   
      5972 +                        isSidebarOpen={isSidebarOpen}                                                                                                                                                   
      5973 +                        columnCount={isTabletDevice ? 3 : undefined}                                                                                                                                    
      5974 +                      />                                                                                                                                                                                
      5975                      </div>
      5976                    )}
      5977                  </>

● دعني أتحقق من عدم وجود أخطاء TypeScript.                                 
    
● Bash(cd /c/Users/pc/Desktop/elfaroukgroup && npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "(pos/page|VirtualizedProductGrid)" | head -20)
  ⎿ app/components/ui/VirtualizedProductGrid.tsx(4,10): error TS2305: Module '"react-window"' has no exported member 'FixedSizeGrid'.
    app/components/ui/VirtualizedProductGrid.tsx(4,33): error TS2724: '"react-window"' has no exported member named 'GridChildComponentProps'. Did you mean 'CellComponentProps'?
    app/components/ui/VirtualizedProductGrid.tsx(5,8): error TS2613: Module '"C:/Users/pc/Desktop/elfaroukgroup/node_modules/react-virtualized-auto-sizer/dist/react-virtualized-auto-sizer"' has no default ex
    … +3 lines (ctrl+o to expand)                                                                                                                                                                                      
                                                                                                                                                                                                                    
● هناك بعض الأخطاء. دعني أصلحها.
                                                                                                                                                                                                                    
● Read(app\components\ui\VirtualizedProductGrid.tsx)                                                                                                                                                                
  ⎿  Read 30 lines                                                                                                                                                                                                  
                                                                                                                                                                                                                    
● Bash(cd /c/Users/pc/Desktop/elfaroukgroup && cat node_modules/react-window/dist/index.d.ts 2>/dev/null | head -100 || npm show react-window) timeout: 30s                                                         
  ⎿  (No content)                                                                                                                                                                                                   

● Bash(cd /c/Users/pc/Desktop/elfaroukgroup && ls node_modules/react-window/dist/ && head -100 node_modules/react-window/dist/index.esm.js) timeout: 30s                                                              ⎿  Error: Exit code 1
     head: cannot open 'node_modules/react-window/dist/index.esm.js' for reading: No such file or directory                                                                                                         
                                                                                                                                                                                                                         react-window.cjs                                                                                                                                                                                               
     react-window.cjs.map                                                                                                                                                                                           
     react-window.d.ts                                                                                                                                                                                                   react-window.js                      
     react-window.js.map                                                                                                                                                                                            
                                                                                                                                                                                                                    ● Bash(cd /c/Users/pc/Desktop/elfaroukgroup && head -150 node_modules/react-window/dist/react-window.d.ts) timeout: 30s
  ⎿  import { ComponentProps } from 'react';                                                                                                                                                                        
     import { CSSProperties } from 'react';
     import { HTMLAttributes } from 'react';
     … +148 lines (ctrl+o to expand)

● Bash(cd /c/Users/pc/Desktop/elfaroukgroup && npm ls react-window) timeout: 30s                                                                                                                                      ⎿  pos-system@0.1.0 C:\Users\pc\Desktop\elfaroukgroup
     ├─┬ @types/react-window@2.0.0                                                                                                                                                                                  
     │ └── react-window@2.2.5 deduped                                                                                                                                                                               
     └── react-window@2.2.5
                                                                                                                                                                                                                    
● فهمت - الـ react-window 2.x له API جديد. دعني أعيد كتابة المكون.                                                                                                                                                  
                                              
● Write(app\components\ui\VirtualizedProductGrid.tsx)                                                                                                                                                               
  ⎿  Added 293 lines, removed 293 lines                                                                                                                                                                             
        1 -"use client";                                                                                                                                                                                            
        2 -                                                                                                                                                                                                         
        3 -import { useRef, useCallback, useEffect, useState } from "react";                                                                                                                                        
        4 -import { FixedSizeGrid as Grid, GridChildComponentProps } from "react-window";
        5 -import AutoSizer from "react-virtualized-auto-sizer";                                                                                                                                                            6 -import { Product } from "../../lib/hooks/useProductsOptimized";
        7 -import { Branch } from "../../../lib/hooks/useProductsAdmin";                                                                                                                                                    8 -import { ProductGridImage } from "./OptimizedImage";
        9 -import { EyeIcon } from "@heroicons/react/24/outline";                                                                                                                                                   
       10 -
       11 -interface VirtualizedProductGridProps {                                                                                                                                                                  
       12 -  products: Product[];                                                                                                                                                                                   
       13 -  branches: Branch[];                                                                                                                                                                                    
       14 -  selectedProduct: Product | null;                                                                                                                                                                       
       15 -  onProductClick: (product: Product) => void;                                                                                                                                                            
       16 -  onProductSelect: (product: Product | null) => void;                                                                                                                                                    
       17 -  onViewDetails: (product: Product) => void;                                                                                                                                                             
       18 -  getProductPriceByType: (product: Product) => number;                                                                                                                                                   
       19 -  isSidebarOpen: boolean;                                                                                                                                                                                
       20 -  columnCount?: number;                                                                                                                                                                                  
       21 -  rowHeight?: number;                                                                                                                                                                                    
       22 -}                                                                                                                                                                                                        
       23 -                                                                                                                                                                                                         
       24 -interface ItemData {                                                                                                                                                                                     
       25 -  products: Product[];                                                                                                                                                                                   
       26 -  branches: Branch[];                                                                                                                                                                                    
       27 -  selectedProduct: Product | null;                                                                                                                                                                       
       28 -  columnCount: number;                                                                                                                                                                                   
       29 -  onProductClick: (product: Product) => void;                                                                                                                                                            
       30 -  onProductSelect: (product: Product | null) => void;                                                                                                                                                    
       31 -  onViewDetails: (product: Product) => void;                                                                                                                                                             
       32 -  getProductPriceByType: (product: Product) => number;                                                                                                                                                   
       33 -  isSidebarOpen: boolean;                                                                                                                                                                                
       34 -}                                                                                                                                                                                                        
       35 -                                                                                                                                                                                                         
       36 -// Product Card Component - Memoized for performance                                                                                                                                                     
       37 -const ProductCard = ({                                                                                                                                                                                   
       38 -  product,                                                                                                                                                                                               
       39 -  branches,                                                                                                                                                                                              
       40 -  selectedProduct,                                                                                                                                                                                       
       41 -  onProductClick,                                                                                                                                                                                        
       42 -  onProductSelect,                                                                                                                                                                                       
       43 -  onViewDetails,                                                                                                                                                                                         
       44 -  getProductPriceByType,                                                                                                                                                                                 
       45 -  isSidebarOpen,                                                                                                                                                                                         
       46 -}: {                                                                                                                                                                                                     
       47 -  product: Product;                                                                                                                                                                                      
       48 -  branches: Branch[];                                                                                                                                                                                    
       49 -  selectedProduct: Product | null;                                                                                                                                                                       
       50 -  onProductClick: (product: Product) => void;                                                                                                                                                            
       51 -  onProductSelect: (product: Product | null) => void;                                                                                                                                                    
       52 -  onViewDetails: (product: Product) => void;                                                                                                                                                             
       53 -  getProductPriceByType: (product: Product) => number;                                                                                                                                                   
       54 -  isSidebarOpen: boolean;                                                                                                                                                                                
       55 -}) => {                                                                                                                                                                                                  
       56 -  const isSelected = selectedProduct?.id === product.id;                                                                                                                                                 
       57 -                                                                                                                                                                                                         
       58 -  const handleClick = useCallback(() => {                                                                                                                                                                
       59 -    if (isSelected) {                                                                                                                                                                                    
       60 -      onProductSelect(null);                                                                                                                                                                             
       61 -    } else {                                                                                                                                                                                             
       62 -      onProductSelect(product);                                                                                                                                                                          
       63 -    }                                                                                                                                                                                                    
       64 -    onProductClick(product);                                                                                                                                                                             
       65 -  }, [isSelected, product, onProductSelect, onProductClick]);                                                                                                                                            
       66 -                                                                                                                                                                                                         
       67 -  const handleViewDetails = useCallback(                                                                                                                                                                 
       68 -    (e: React.MouseEvent) => {                                                                                                                                                                           
       69 -      if (isSidebarOpen) return;                                                                                                                                                                         
       70 -      e.stopPropagation();                                                                                                                                                                               
       71 -      onViewDetails(product);                                                                                                                                                                            
       72 -    },                                                                                                                                                                                                   
       73 -    [isSidebarOpen, product, onViewDetails]                                                                                                                                                              
       74 -  );                                                                                                                                                                                                     
       75 -                                                                                                                                                                                                         
       76 -  // Calculate total quantity                                                                                                                                                                            
       77 -  const totalQuantity =                                                                                                                                                                                  
       78 -    product.inventoryData                                                                                                                                                                                
       79 -      ? Object.values(product.inventoryData).reduce(                                                                                                                                                     
       80 -          (sum: number, inv: any) => sum + (inv?.quantity || 0),                                                                                                                                         
       81 -          0                                                                                                                                                                                              
       82 -        )                                                                                                                                                                                                
       83 -      : 0;                                                                                                                                                                                               
       84 -                                                                                                                                                                                                         
       85 -  return (                                                                                                                                                                                               
       86 -    <div                                                                                                                                                                                                 
       87 -      onClick={handleClick}                                                                                                                                                                              
       88 -      className={`bg-[#374151] rounded-lg p-3 cursor-pointer transition-all duration-200 border-2 relative group h-full ${                                                                               
       89 -        isSelected                                                                                                                                                                                       
       90 -          ? "border-blue-500 bg-[#434E61]"                                                                                                                                                               
       91 -          : "border-transparent hover:border-gray-500 hover:bg-[#434E61]"                                                                                                                                
       92 -      }`}                                                                                                                                                                                                
       93 -    >                                                                                                                                                                                                    
       94 -      {/* Product Image */}                                                                                                                                                                              
       95 -      <div className="mb-3 relative">                                                                                                                                                                    
       96 -        <ProductGridImage                                                                                                                                                                                
       97 -          src={product.main_image_url}                                                                                                                                                                   
       98 -          alt={product.name}                                                                                                                                                                             
       99 -          priority={false}                                                                                                                                                                               
      100 -        />                                                                                                                                                                                               
      101 -                                                                                                                                                                                                         
      102 -        {/* View Details Button */}                                                                                                                                                                      
      103 -        <div className="absolute top-2 right-2 z-50">                                                                                                                                                    
      104 -          <button                                                                                                                                                                                        
      105 -            onClick={handleViewDetails}                                                                                                                                                                  
      106 -            className={`bg-black/50 hover:bg-black/90 text-white p-2 rounded-full opacity-0 ${                                                                                                           
      107 -              !isSidebarOpen ? "group-hover:opacity-100" : "pointer-events-none"                                                                                                                         
      108 -            } transition-all duration-200 shadow-lg`}                                                                                                                                                    
      109 -          >                                                                                                                                                                                              
      110 -            <EyeIcon className="h-4 w-4" />                                                                                                                                                              
      111 -          </button>                                                                                                                                                                                      
      112 -        </div>                                                                                                                                                                                           
      113 -      </div>                                                                                                                                                                                             
      114 -                                                                                                                                                                                                         
      115 -      {/* Product Name */}                                                                                                                                                                               
      116 -      <h3 className="text-white font-medium text-sm text-center mb-2 line-clamp-2">                                                                                                                      
      117 -        {product.name}                                                                                                                                                                                   
      118 -      </h3>                                                                                                                                                                                              
      119 -                                                                                                                                                                                                         
      120 -      {/* Product Details */}                                                                                                                                                                            
      121 -      <div className="space-y-1 text-xs">                                                                                                                                                                
      122 -        {/* Price */}                                                                                                                                                                                    
      123 -        <div className="flex justify-center mb-2">                                                                                                                                                       
      124 -          <span className="text-blue-400 font-medium text-sm">                                                                                                                                           
      125 -            {getProductPriceByType(product).toFixed(2)}                                                                                                                                                  
      126 -          </span>                                                                                                                                                                                        
      127 -        </div>                                                                                                                                                                                           
      128 -                                                                                                                                                                                                         
      129 -        {/* Total Quantity */}                                                                                                                                                                           
      130 -        <div className="flex justify-between items-center">                                                                                                                                              
      131 -          <span className="text-blue-400 font-medium">{totalQuantity}</span>                                                                                                                             
      132 -          <span className="text-gray-400">الكمية الإجمالية</span>                                                                                                                                        
      133 -        </div>                                                                                                                                                                                           
      134 -                                                                                                                                                                                                         
      135 -        {/* Branch Quantities */}                                                                                                                                                                        
      136 -        {product.inventoryData &&                                                                                                                                                                        
      137 -          Object.entries(product.inventoryData).map(                                                                                                                                                     
      138 -            ([locationId, inventory]: [string, any]) => {                                                                                                                                                
      139 -              const branch = branches.find((b) => b.id === locationId);                                                                                                                                  
      140 -              const locationName =                                                                                                                                                                       
      141 -                branch?.name || `موقع ${locationId.slice(0, 8)}`;                                                                                                                                        
      142 -                                                                                                                                                                                                         
      143 -              return (                                                                                                                                                                                   
      144 -                <div                                                                                                                                                                                     
      145 -                  key={locationId}                                                                                                                                                                       
      146 -                  className="flex justify-between items-center"                                                                                                                                          
      147 -                >                                                                                                                                                                                        
      148 -                  <span className="text-white">{inventory?.quantity || 0}</span>                                                                                                                         
      149 -                  <span className="text-gray-400 truncate">{locationName}</span>                                                                                                                         
      150 -                </div>                                                                                                                                                                                   
      151 -              );                                                                                                                                                                                         
      152 -            }                                                                                                                                                                                            
      153 -          )}                                                                                                                                                                                             
      154 -      </div>                                                                                                                                                                                             
      155 -    </div>                                                                                                                                                                                               
      156 -  );                                                                                                                                                                                                     
      157 -};                                                                                                                                                                                                       
      158 -                                                                                                                                                                                                         
      159 -// Grid Cell Renderer                                                                                                                                                                                    
      160 -const Cell = ({                                                                                                                                                                                          
      161 -  columnIndex,                                                                                                                                                                                           
      162 -  rowIndex,                                                                                                                                                                                              
      163 -  style,                                                                                                                                                                                                 
      164 -  data,                                                                                                                                                                                                  
      165 -}: GridChildComponentProps<ItemData>) => {                                                                                                                                                               
      166 -  const {                                                                                                                                                                                                
      167 -    products,                                                                                                                                                                                            
      168 -    branches,                                                                                                                                                                                            
      169 -    selectedProduct,                                                                                                                                                                                     
      170 -    columnCount,                                                                                                                                                                                         
      171 -    onProductClick,                                                                                                                                                                                      
      172 -    onProductSelect,                                                                                                                                                                                     
      173 -    onViewDetails,                                                                                                                                                                                       
      174 -    getProductPriceByType,                                                                                                                                                                               
      175 -    isSidebarOpen,                                                                                                                                                                                       
      176 -  } = data;                                                                                                                                                                                              
      177 -                                                                                                                                                                                                         
      178 -  const index = rowIndex * columnCount + columnIndex;                                                                                                                                                    
      179 -  const product = products[index];                                                                                                                                                                       
      180 -                                                                                                                                                                                                         
      181 -  if (!product) {                                                                                                                                                                                        
      182 -    return null;                                                                                                                                                                                         
      183 -  }                                                                                                                                                                                                      
      184 -                                                                                                                                                                                                         
      185 -  return (                                                                                                                                                                                               
      186 -    <div style={style} className="p-2">                                                                                                                                                                  
      187 -      <ProductCard                                                                                                                                                                                       
      188 -        product={product}                                                                                                                                                                                
      189 -        branches={branches}                                                                                                                                                                              
      190 -        selectedProduct={selectedProduct}                                                                                                                                                                
      191 -        onProductClick={onProductClick}                                                                                                                                                                  
      192 -        onProductSelect={onProductSelect}                                                                                                                                                                
      193 -        onViewDetails={onViewDetails}                                                                                                                                                                    
      194 -        getProductPriceByType={getProductPriceByType}                                                                                                                                                    
      195 -        isSidebarOpen={isSidebarOpen}                                                                                                                                                                    
      196 -      />                                                                                                                                                                                                 
      197 -    </div>                                                                                                                                                                                               
      198 -  );                                                                                                                                                                                                     
      199 -};                                                                                                                                                                                                       
      200 -                                                                                                                                                                                                         
      201 -export function VirtualizedProductGrid({                                                                                                                                                                 
      202 -  products,                                                                                                                                                                                              
      203 -  branches,                                                                                                                                                                                              
      204 -  selectedProduct,                                                                                                                                                                                       
      205 -  onProductClick,                                                                                                                                                                                        
      206 -  onProductSelect,                                                                                                                                                                                       
      207 -  onViewDetails,                                                                                                                                                                                         
      208 -  getProductPriceByType,                                                                                                                                                                                 
      209 -  isSidebarOpen,                                                                                                                                                                                         
      210 -  columnCount: propColumnCount,                                                                                                                                                                          
      211 -  rowHeight = 320,                                                                                                                                                                                       
      212 -}: VirtualizedProductGridProps) {                                                                                                                                                                        
      213 -  const gridRef = useRef<Grid>(null);                                                                                                                                                                    
      214 -  const [columnCount, setColumnCount] = useState(propColumnCount || 6);                                                                                                                                  
      215 -                                                                                                                                                                                                         
      216 -  // Handle responsive column count                                                                                                                                                                      
      217 -  useEffect(() => {                                                                                                                                                                                      
      218 -    const handleResize = () => {                                                                                                                                                                         
      219 -      const width = window.innerWidth;                                                                                                                                                                   
      220 -      if (propColumnCount) {                                                                                                                                                                             
      221 -        setColumnCount(propColumnCount);                                                                                                                                                                 
      222 -      } else if (width < 768) {                                                                                                                                                                          
      223 -        setColumnCount(2);                                                                                                                                                                               
      224 -      } else if (width < 1024) {                                                                                                                                                                         
      225 -        setColumnCount(4);                                                                                                                                                                               
      226 -      } else {                                                                                                                                                                                           
      227 -        setColumnCount(6);                                                                                                                                                                               
      228 -      }                                                                                                                                                                                                  
      229 -    };                                                                                                                                                                                                   
      230 -                                                                                                                                                                                                         
      231 -    handleResize();                                                                                                                                                                                      
      232 -    window.addEventListener("resize", handleResize);                                                                                                                                                     
      233 -    return () => window.removeEventListener("resize", handleResize);                                                                                                                                     
      234 -  }, [propColumnCount]);                                                                                                                                                                                 
      235 -                                                                                                                                                                                                         
      236 -  // Reset scroll when products change significantly (e.g., search)                                                                                                                                      
      237 -  useEffect(() => {                                                                                                                                                                                      
      238 -    if (gridRef.current) {                                                                                                                                                                               
      239 -      gridRef.current.scrollTo({ scrollTop: 0, scrollLeft: 0 });                                                                                                                                         
      240 -    }                                                                                                                                                                                                    
      241 -  }, [products.length]);                                                                                                                                                                                 
      242 -                                                                                                                                                                                                         
      243 -  const rowCount = Math.ceil(products.length / columnCount);                                                                                                                                             
      244 -                                                                                                                                                                                                         
      245 -  // Item data for the grid                                                                                                                                                                              
      246 -  const itemData: ItemData = {                                                                                                                                                                           
      247 -    products,                                                                                                                                                                                            
      248 -    branches,                                                                                                                                                                                            
      249 -    selectedProduct,                                                                                                                                                                                     
      250 -    columnCount,                                                                                                                                                                                         
      251 -    onProductClick,                                                                                                                                                                                      
      252 -    onProductSelect,                                                                                                                                                                                     
      253 -    onViewDetails,                                                                                                                                                                                       
      254 -    getProductPriceByType,                                                                                                                                                                               
      255 -    isSidebarOpen,                                                                                                                                                                                       
      256 -  };                                                                                                                                                                                                     
      257 -                                                                                                                                                                                                         
      258 -  if (products.length === 0) {                                                                                                                                                                           
      259 -    return (                                                                                                                                                                                             
      260 -      <div className="flex items-center justify-center h-full">                                                                                                                                          
      261 -        <div className="text-gray-400 text-center">                                                                                                                                                      
      262 -          <p className="text-lg mb-2">لا توجد منتجات</p>                                                                                                                                                 
      263 -          <p className="text-sm">جرب البحث بكلمات مختلفة</p>                                                                                                                                             
      264 -        </div>                                                                                                                                                                                           
      265 -      </div>                                                                                                                                                                                             
      266 -    );                                                                                                                                                                                                   
      267 -  }                                                                                                                                                                                                      
      268 -                                                                                                                                                                                                         
      269 -  return (                                                                                                                                                                                               
      270 -    <div className="h-full w-full">                                                                                                                                                                      
      271 -      <AutoSizer>                                                                                                                                                                                        
      272 -        {({ height, width }) => (                                                                                                                                                                        
      273 -          <Grid                                                                                                                                                                                          
      274 -            ref={gridRef}                                                                                                                                                                                
      275 -            columnCount={columnCount}                                                                                                                                                                    
      276 -            rowCount={rowCount}                                                                                                                                                                          
      277 -            columnWidth={width / columnCount}                                                                                                                                                            
      278 -            rowHeight={rowHeight}                                                                                                                                                                        
      279 -            width={width}                                                                                                                                                                                
      280 -            height={height}                                                                                                                                                                              
      281 -            itemData={itemData}                                                                                                                                                                          
      282 -            overscanRowCount={2}                                                                                                                                                                         
      283 -            className="scrollbar-hide"                                                                                                                                                                   
      284 -          >                                                                                                                                                                                              
      285 -            {Cell}                                                                                                                                                                                       
      286 -          </Grid>                                                                                                                                                                                        
      287 -        )}                                                                                                                                                                                               
      288 -      </AutoSizer>                                                                                                                                                                                       
      289 -    </div>                                                                                                                                                                                               
      290 -  );                                                                                                                                                                                                     
      291 -}                                                                                                                                                                                                        
      292 -                                                                                                                                                                                                         
      293 -export default VirtualizedProductGrid;                                                                                                                                                                   
        1 +"use client";                                                                                                                                                                                            
        2 +                                                                                                                                                                                                         
        3 +import { useRef, useCallback, useEffect, useState, CSSProperties, memo } from "react";                                                                                                                   
        4 +import { Grid, GridImperativeAPI, CellComponentProps } from "react-window";                                                                                                                              
        5 +import { AutoSizer } from "react-virtualized-auto-sizer";                                                                                                                                                
        6 +import { Product } from "../../lib/hooks/useProductsOptimized";                                                                                                                                          
        7 +import { Branch } from "../../../lib/hooks/useProductsAdmin";                                                                                                                                            
        8 +import { ProductGridImage } from "./OptimizedImage";                                                                                                                                                     
        9 +import { EyeIcon } from "@heroicons/react/24/outline";                                                                                                                                                   
       10 +                                                                                                                                                                                                         
       11 +interface VirtualizedProductGridProps {                                                                                                                                                                  
       12 +  products: Product[];                                                                                                                                                                                   
       13 +  branches: Branch[];                                                                                                                                                                                    
       14 +  selectedProduct: Product | null;                                                                                                                                                                       
       15 +  onProductClick: (product: Product) => void;                                                                                                                                                            
       16 +  onProductSelect: (product: Product | null) => void;                                                                                                                                                    
       17 +  onViewDetails: (product: Product) => void;                                                                                                                                                             
       18 +  getProductPriceByType: (product: Product) => number;                                                                                                                                                   
       19 +  isSidebarOpen: boolean;                                                                                                                                                                                
       20 +  columnCount?: number;                                                                                                                                                                                  
       21 +  rowHeight?: number;                                                                                                                                                                                    
       22 +}                                                                                                                                                                                                        
       23 +                                                                                                                                                                                                         
       24 +interface CellProps {                                                                                                                                                                                    
       25 +  products: Product[];                                                                                                                                                                                   
       26 +  branches: Branch[];                                                                                                                                                                                    
       27 +  selectedProduct: Product | null;                                                                                                                                                                       
       28 +  columnCount: number;                                                                                                                                                                                   
       29 +  onProductClick: (product: Product) => void;                                                                                                                                                            
       30 +  onProductSelect: (product: Product | null) => void;                                                                                                                                                    
       31 +  onViewDetails: (product: Product) => void;                                                                                                                                                             
       32 +  getProductPriceByType: (product: Product) => number;                                                                                                                                                   
       33 +  isSidebarOpen: boolean;                                                                                                                                                                                
       34 +}                                                                                                                                                                                                        
       35 +                                                                                                                                                                                                         
       36 +// Product Card Component - Memoized for performance                                                                                                                                                     
       37 +const ProductCard = memo(function ProductCard({                                                                                                                                                          
       38 +  product,                                                                                                                                                                                               
       39 +  branches,                                                                                                                                                                                              
       40 +  isSelected,                                                                                                                                                                                            
       41 +  onProductClick,                                                                                                                                                                                        
       42 +  onProductSelect,                                                                                                                                                                                       
       43 +  onViewDetails,                                                                                                                                                                                         
       44 +  getProductPriceByType,                                                                                                                                                                                 
       45 +  isSidebarOpen,                                                                                                                                                                                         
       46 +}: {                                                                                                                                                                                                     
       47 +  product: Product;                                                                                                                                                                                      
       48 +  branches: Branch[];                                                                                                                                                                                    
       49 +  isSelected: boolean;                                                                                                                                                                                   
       50 +  onProductClick: (product: Product) => void;                                                                                                                                                            
       51 +  onProductSelect: (product: Product | null) => void;                                                                                                                                                    
       52 +  onViewDetails: (product: Product) => void;                                                                                                                                                             
       53 +  getProductPriceByType: (product: Product) => number;                                                                                                                                                   
       54 +  isSidebarOpen: boolean;                                                                                                                                                                                
       55 +}) {                                                                                                                                                                                                     
       56 +  const handleClick = useCallback(() => {                                                                                                                                                                
       57 +    if (isSelected) {                                                                                                                                                                                    
       58 +      onProductSelect(null);                                                                                                                                                                             
       59 +    } else {                                                                                                                                                                                             
       60 +      onProductSelect(product);                                                                                                                                                                          
       61 +    }                                                                                                                                                                                                    
       62 +    onProductClick(product);                                                                                                                                                                             
       63 +  }, [isSelected, product, onProductSelect, onProductClick]);                                                                                                                                            
       64 +                                                                                                                                                                                                         
       65 +  const handleViewDetails = useCallback(                                                                                                                                                                 
       66 +    (e: React.MouseEvent) => {                                                                                                                                                                           
       67 +      if (isSidebarOpen) return;                                                                                                                                                                         
       68 +      e.stopPropagation();                                                                                                                                                                               
       69 +      onViewDetails(product);                                                                                                                                                                            
       70 +    },                                                                                                                                                                                                   
       71 +    [isSidebarOpen, product, onViewDetails]                                                                                                                                                              
       72 +  );                                                                                                                                                                                                     
       73 +                                                                                                                                                                                                         
       74 +  // Calculate total quantity                                                                                                                                                                            
       75 +  const totalQuantity =                                                                                                                                                                                  
       76 +    product.inventoryData                                                                                                                                                                                
       77 +      ? Object.values(product.inventoryData).reduce(                                                                                                                                                     
       78 +          (sum: number, inv: any) => sum + (inv?.quantity || 0),                                                                                                                                         
       79 +          0                                                                                                                                                                                              
       80 +        )                                                                                                                                                                                                
       81 +      : 0;                                                                                                                                                                                               
       82 +                                                                                                                                                                                                         
       83 +  return (                                                                                                                                                                                               
       84 +    <div                                                                                                                                                                                                 
       85 +      onClick={handleClick}                                                                                                                                                                              
       86 +      className={`bg-[#374151] rounded-lg p-3 cursor-pointer transition-all duration-200 border-2 relative group h-full ${                                                                               
       87 +        isSelected                                                                                                                                                                                       
       88 +          ? "border-blue-500 bg-[#434E61]"                                                                                                                                                               
       89 +          : "border-transparent hover:border-gray-500 hover:bg-[#434E61]"                                                                                                                                
       90 +      }`}                                                                                                                                                                                                
       91 +    >                                                                                                                                                                                                    
       92 +      {/* Product Image */}                                                                                                                                                                              
       93 +      <div className="mb-3 relative">                                                                                                                                                                    
       94 +        <ProductGridImage                                                                                                                                                                                
       95 +          src={product.main_image_url}                                                                                                                                                                   
       96 +          alt={product.name}                                                                                                                                                                             
       97 +          priority={false}                                                                                                                                                                               
       98 +        />                                                                                                                                                                                               
       99 +                                                                                                                                                                                                         
      100 +        {/* View Details Button */}                                                                                                                                                                      
      101 +        <div className="absolute top-2 right-2 z-50">                                                                                                                                                    
      102 +          <button                                                                                                                                                                                        
      103 +            onClick={handleViewDetails}                                                                                                                                                                  
      104 +            className={`bg-black/50 hover:bg-black/90 text-white p-2 rounded-full opacity-0 ${                                                                                                           
      105 +              !isSidebarOpen ? "group-hover:opacity-100" : "pointer-events-none"                                                                                                                         
      106 +            } transition-all duration-200 shadow-lg`}                                                                                                                                                    
      107 +          >                                                                                                                                                                                              
      108 +            <EyeIcon className="h-4 w-4" />                                                                                                                                                              
      109 +          </button>                                                                                                                                                                                      
      110 +        </div>                                                                                                                                                                                           
      111 +      </div>                                                                                                                                                                                             
      112 +                                                                                                                                                                                                         
      113 +      {/* Product Name */}                                                                                                                                                                               
      114 +      <h3 className="text-white font-medium text-sm text-center mb-2 line-clamp-2">                                                                                                                      
      115 +        {product.name}                                                                                                                                                                                   
      116 +      </h3>                                                                                                                                                                                              
      117 +                                                                                                                                                                                                         
      118 +      {/* Product Details */}                                                                                                                                                                            
      119 +      <div className="space-y-1 text-xs">                                                                                                                                                                
      120 +        {/* Price */}                                                                                                                                                                                    
      121 +        <div className="flex justify-center mb-2">                                                                                                                                                       
      122 +          <span className="text-blue-400 font-medium text-sm">                                                                                                                                           
      123 +            {getProductPriceByType(product).toFixed(2)}                                                                                                                                                  
      124 +          </span>                                                                                                                                                                                        
      125 +        </div>                                                                                                                                                                                           
      126 +                                                                                                                                                                                                         
      127 +        {/* Total Quantity */}                                                                                                                                                                           
      128 +        <div className="flex justify-between items-center">                                                                                                                                              
      129 +          <span className="text-blue-400 font-medium">{totalQuantity}</span>                                                                                                                             
      130 +          <span className="text-gray-400">الكمية الإجمالية</span>                                                                                                                                        
      131 +        </div>                                                                                                                                                                                           
      132 +                                                                                                                                                                                                         
      133 +        {/* Branch Quantities */}                                                                                                                                                                        
      134 +        {product.inventoryData &&                                                                                                                                                                        
      135 +          Object.entries(product.inventoryData).map(                                                                                                                                                     
      136 +            ([locationId, inventory]: [string, any]) => {                                                                                                                                                
      137 +              const branch = branches.find((b) => b.id === locationId);                                                                                                                                  
      138 +              const locationName =                                                                                                                                                                       
      139 +                branch?.name || `موقع ${locationId.slice(0, 8)}`;                                                                                                                                        
      140 +                                                                                                                                                                                                         
      141 +              return (                                                                                                                                                                                   
      142 +                <div                                                                                                                                                                                     
      143 +                  key={locationId}                                                                                                                                                                       
      144 +                  className="flex justify-between items-center"                                                                                                                                          
      145 +                >                                                                                                                                                                                        
      146 +                  <span className="text-white">{inventory?.quantity || 0}</span>                                                                                                                         
      147 +                  <span className="text-gray-400 truncate">{locationName}</span>                                                                                                                         
      148 +                </div>                                                                                                                                                                                   
      149 +              );                                                                                                                                                                                         
      150 +            }                                                                                                                                                                                            
      151 +          )}                                                                                                                                                                                             
      152 +      </div>                                                                                                                                                                                             
      153 +    </div>                                                                                                                                                                                               
      154 +  );                                                                                                                                                                                                     
      155 +});                                                                                                                                                                                                      
      156 +                                                                                                                                                                                                         
      157 +// Grid Cell Component - receives props from cellProps                                                                                                                                                   
      158 +function CellComponent({                                                                                                                                                                                 
      159 +  columnIndex,                                                                                                                                                                                           
      160 +  rowIndex,                                                                                                                                                                                              
      161 +  style,                                                                                                                                                                                                 
      162 +  products,                                                                                                                                                                                              
      163 +  branches,                                                                                                                                                                                              
      164 +  selectedProduct,                                                                                                                                                                                       
      165 +  columnCount,                                                                                                                                                                                           
      166 +  onProductClick,                                                                                                                                                                                        
      167 +  onProductSelect,                                                                                                                                                                                       
      168 +  onViewDetails,                                                                                                                                                                                         
      169 +  getProductPriceByType,                                                                                                                                                                                 
      170 +  isSidebarOpen,                                                                                                                                                                                         
      171 +}: {                                                                                                                                                                                                     
      172 +  ariaAttributes: { "aria-colindex": number; role: "gridcell" };                                                                                                                                         
      173 +  columnIndex: number;                                                                                                                                                                                   
      174 +  rowIndex: number;                                                                                                                                                                                      
      175 +  style: CSSProperties;                                                                                                                                                                                  
      176 +} & CellProps) {                                                                                                                                                                                         
      177 +  const index = rowIndex * columnCount + columnIndex;                                                                                                                                                    
      178 +  const product = products[index];                                                                                                                                                                       
      179 +                                                                                                                                                                                                         
      180 +  if (!product) {                                                                                                                                                                                        
      181 +    return null;                                                                                                                                                                                         
      182 +  }                                                                                                                                                                                                      
      183 +                                                                                                                                                                                                         
      184 +  const isSelected = selectedProduct?.id === product.id;                                                                                                                                                 
      185 +                                                                                                                                                                                                         
      186 +  return (                                                                                                                                                                                               
      187 +    <div style={style} className="p-2">                                                                                                                                                                  
      188 +      <ProductCard                                                                                                                                                                                       
      189 +        product={product}                                                                                                                                                                                
      190 +        branches={branches}                                                                                                                                                                              
      191 +        isSelected={isSelected}                                                                                                                                                                          
      192 +        onProductClick={onProductClick}                                                                                                                                                                  
      193 +        onProductSelect={onProductSelect}                                                                                                                                                                
      194 +        onViewDetails={onViewDetails}                                                                                                                                                                    
      195 +        getProductPriceByType={getProductPriceByType}                                                                                                                                                    
      196 +        isSidebarOpen={isSidebarOpen}                                                                                                                                                                    
      197 +      />                                                                                                                                                                                                 
      198 +    </div>                                                                                                                                                                                               
      199 +  );                                                                                                                                                                                                     
      200 +}                                                                                                                                                                                                        
      201 +                                                                                                                                                                                                         
      202 +export function VirtualizedProductGrid({                                                                                                                                                                 
      203 +  products,                                                                                                                                                                                              
      204 +  branches,                                                                                                                                                                                              
      205 +  selectedProduct,                                                                                                                                                                                       
      206 +  onProductClick,                                                                                                                                                                                        
      207 +  onProductSelect,                                                                                                                                                                                       
      208 +  onViewDetails,                                                                                                                                                                                         
      209 +  getProductPriceByType,                                                                                                                                                                                 
      210 +  isSidebarOpen,                                                                                                                                                                                         
      211 +  columnCount: propColumnCount,                                                                                                                                                                          
      212 +  rowHeight = 320,                                                                                                                                                                                       
      213 +}: VirtualizedProductGridProps) {                                                                                                                                                                        
      214 +  const gridRef = useRef<GridImperativeAPI>(null);                                                                                                                                                       
      215 +  const [columnCount, setColumnCount] = useState(propColumnCount || 6);                                                                                                                                  
      216 +                                                                                                                                                                                                         
      217 +  // Handle responsive column count                                                                                                                                                                      
      218 +  useEffect(() => {                                                                                                                                                                                      
      219 +    const handleResize = () => {                                                                                                                                                                         
      220 +      const width = window.innerWidth;                                                                                                                                                                   
      221 +      if (propColumnCount) {                                                                                                                                                                             
      222 +        setColumnCount(propColumnCount);                                                                                                                                                                 
      223 +      } else if (width < 768) {                                                                                                                                                                          
      224 +        setColumnCount(2);                                                                                                                                                                               
      225 +      } else if (width < 1024) {                                                                                                                                                                         
      226 +        setColumnCount(4);                                                                                                                                                                               
      227 +      } else {                                                                                                                                                                                           
      228 +        setColumnCount(6);                                                                                                                                                                               
      229 +      }                                                                                                                                                                                                  
      230 +    };                                                                                                                                                                                                   
      231 +                                                                                                                                                                                                         
      232 +    handleResize();                                                                                                                                                                                      
      233 +    window.addEventListener("resize", handleResize);                                                                                                                                                     
      234 +    return () => window.removeEventListener("resize", handleResize);                                                                                                                                     
      235 +  }, [propColumnCount]);                                                                                                                                                                                 
      236 +                                                                                                                                                                                                         
      237 +  // Reset scroll when products change significantly (e.g., search)                                                                                                                                      
      238 +  useEffect(() => {                                                                                                                                                                                      
      239 +    if (gridRef.current) {                                                                                                                                                                               
      240 +      gridRef.current.scrollToCell({ rowIndex: 0, columnIndex: 0 });                                                                                                                                     
      241 +    }                                                                                                                                                                                                    
      242 +  }, [products.length]);                                                                                                                                                                                 
      243 +                                                                                                                                                                                                         
      244 +  const rowCount = Math.ceil(products.length / columnCount);                                                                                                                                             
      245 +                                                                                                                                                                                                         
      246 +  // Cell props for the grid                                                                                                                                                                             
      247 +  const cellProps: CellProps = {                                                                                                                                                                         
      248 +    products,                                                                                                                                                                                            
      249 +    branches,                                                                                                                                                                                            
      250 +    selectedProduct,                                                                                                                                                                                     
      251 +    columnCount,                                                                                                                                                                                         
      252 +    onProductClick,                                                                                                                                                                                      
      253 +    onProductSelect,                                                                                                                                                                                     
      254 +    onViewDetails,                                                                                                                                                                                       
      255 +    getProductPriceByType,                                                                                                                                                                               
      256 +    isSidebarOpen,                                                                                                                                                                                       
      257 +  };                                                                                                                                                                                                     
      258 +                                                                                                                                                                                                         
      259 +  if (products.length === 0) {                                                                                                                                                                           
      260 +    return (                                                                                                                                                                                             
      261 +      <div className="flex items-center justify-center h-full">                                                                                                                                          
      262 +        <div className="text-gray-400 text-center">                                                                                                                                                      
      263 +          <p className="text-lg mb-2">لا توجد منتجات</p>                                                                                                                                                 
      264 +          <p className="text-sm">جرب البحث بكلمات مختلفة</p>                                                                                                                                             
      265 +        </div>                                                                                                                                                                                           
      266 +      </div>                                                                                                                                                                                             
      267 +    );                                                                                                                                                                                                   
      268 +  }                                                                                                                                                                                                      
      269 +                                                                                                                                                                                                         
      270 +  return (                                                                                                                                                                                               
      271 +    <div className="h-full w-full">                                                                                                                                                                      
      272 +      <AutoSizer>                                                                                                                                                                                        
      273 +        {({ height, width }: { height: number; width: number }) => (                                                                                                                                     
      274 +          <Grid                                                                                                                                                                                          
      275 +            gridRef={gridRef}                                                                                                                                                                            
      276 +            columnCount={columnCount}                                                                                                                                                                    
      277 +            rowCount={rowCount}                                                                                                                                                                          
      278 +            columnWidth={width / columnCount}                                                                                                                                                            
      279 +            rowHeight={rowHeight}                                                                                                                                                                        
      280 +            defaultWidth={width}                                                                                                                                                                         
      281 +            defaultHeight={height}                                                                                                                                                                       
      282 +            cellComponent={CellComponent}                                                                                                                                                                
      283 +            cellProps={cellProps}                                                                                                                                                                        
      284 +            overscanCount={2}                                                                                                                                                                            
      285 +            className="scrollbar-hide"                                                                                                                                                                   
      286 +          />                                                                                                                                                                                             
      287 +        )}                                                                                                                                                                                               
      288 +      </AutoSizer>                                                                                                                                                                                       
      289 +    </div>                                                                                                                                                                                               
      290 +  );                                                                                                                                                                                                     
      291 +}                                                                                                                                                                                                        
      292 +                                                                                                                                                                                                         
      293 +export default VirtualizedProductGrid;                                                                                                                                                                   

● Bash(cd /c/Users/pc/Desktop/elfaroukgroup && npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "(VirtualizedProductGrid)" | head -30)
  ⎿  app/components/ui/VirtualizedProductGrid.tsx(272,8): error TS2322: Type '{ children: ({ height, width }: { height: number; width: number; }) => Element; }' is not assignable to type 'IntrinsicAttributes
     & AutoSizerProps'.
                                                                            
● Bash(cd /c/Users/pc/Desktop/elfaroukgroup && head -50 node_modules/react-virtualized-auto-sizer/dist/react-virtualized-auto-sizer.d.ts) timeout: 30s
  ⎿  import { CSSProperties } from 'react';
     import { Dispatch } from 'react';                                                                                                                                                                              
     import { FunctionComponent } from 'react';
     … +47 lines (ctrl+o to expand)                                                                                                                                                                                 
                                                                                                                                                                                                                    ● Bash(cd /c/Users/pc/Desktop/elfaroukgroup && grep -A 30 "declare type AutoSizerProps" node_modules/react-virtualized-auto-sizer/dist/react-virtualized-auto-sizer.d.t…) timeout: 30s                                ⎿  export declare type AutoSizerProps = {                                                                                                                                                                         
         /**                                                                                                                                                                                                        
          * Corresponds to the `ResizeObserver` [box](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver/observe#box) parameter.                                                                            … +28 lines (ctrl+o to expand)                                                                                                                                                                                 
                                                                                                                                                                                                                    ● Bash(cd /c/Users/pc/Desktop/elfaroukgroup && cat node_modules/react-virtualized-auto-sizer/dist/react-virtualized-auto-sizer.d.ts) timeout: 30s                                                                     ⎿  import { CSSProperties } from 'react';                                                                                                                                                                         
     import { Dispatch } from 'react';                                                                                                                                                                              
     import { FunctionComponent } from 'react';                                                                                                                                                                          … +127 lines (ctrl+o to expand)
                                                                                                                                                                                                                    ● فهمت - الـ API الجديد مختلف. دعني أحدث الكود.                                                                                                                                                                         
● Update(app\components\ui\VirtualizedProductGrid.tsx)                                                                                                                                                              
  ⎿  Added 22 lines, removed 17 lines                                                                                                                                                                               
      269
      270    return (                                                                                                                                                                                               
      271      <div className="h-full w-full">                                                                                                                                                                      
      272 -      <AutoSizer>
      273 -        {({ height, width }: { height: number; width: number }) => (                                                                                                                                           274 -          <Grid                                                                                                                                                                                          
      275 -            gridRef={gridRef}                                                                                                                                                                                  276 -            columnCount={columnCount}                                                                                                                                                                    
      277 -            rowCount={rowCount}                                                                                                                                                                          
      278 -            columnWidth={width / columnCount}                                                                                                                                                            
      279 -            rowHeight={rowHeight}                                                                                                                                                                        
      280 -            defaultWidth={width}                                                                                                                                                                         
      281 -            defaultHeight={height}                                                                                                                                                                       
      282 -            cellComponent={CellComponent}                                                                                                                                                                
      283 -            cellProps={cellProps}                                                                                                                                                                        
      284 -            overscanCount={2}                                                                                                                                                                            
      285 -            className="scrollbar-hide"                                                                                                                                                                   
      286 -          />                                                                                                                                                                                             
      287 -        )}                                                                                                                                                                                               
      288 -      </AutoSizer>                                                                                                                                                                                       
      272 +      <AutoSizer                                                                                                                                                                                         
      273 +        renderProp={({ height, width }) => {                                                                                                                                                             
      274 +          if (!height || !width) {                                                                                                                                                                       
      275 +            return null;                                                                                                                                                                                 
      276 +          }                                                                                                                                                                                              
      277 +          return (                                                                                                                                                                                       
      278 +            <Grid                                                                                                                                                                                        
      279 +              gridRef={gridRef}                                                                                                                                                                          
      280 +              columnCount={columnCount}                                                                                                                                                                  
      281 +              rowCount={rowCount}                                                                                                                                                                        
      282 +              columnWidth={width / columnCount}                                                                                                                                                          
      283 +              rowHeight={rowHeight}                                                                                                                                                                      
      284 +              defaultWidth={width}                                                                                                                                                                       
      285 +              defaultHeight={height}                                                                                                                                                                     
      286 +              cellComponent={CellComponent}                                                                                                                                                              
      287 +              cellProps={cellProps}                                                                                                                                                                      
      288 +              overscanCount={2}                                                                                                                                                                          
      289 +              className="scrollbar-hide"                                                                                                                                                                 
      290 +            />                                                                                                                                                                                           
      291 +          );                                                                                                                                                                                             
      292 +        }}                                                                                                                                                                                               
      293 +      />                                                                                                                                                                                                 
      294      </div>
      295    );
      296  }

● Bash(cd /c/Users/pc/Desktop/elfaroukgroup && npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "(VirtualizedProductGrid|pos/page)" | head -30)
  ⎿  (No content)

● ممتاز! لا توجد أخطاء TypeScript. دعني أتحقق من أن البناء يعمل.
                                                                            
● Bash(cd /c/Users/pc/Desktop/elfaroukgroup && npm run build 2>&1 | tail -50) timeout: 5m 0s
  ⎿  ├ ƒ /api/whatsapp/send                          0 B                0 B                                                                                                                                         
     ├ ƒ /api/whatsapp/sync                          0 B                0 B
     ├ ƒ /api/whatsapp/sync-contacts                 0 B                0 B                                                                                                                                         
     … +46 lines (ctrl+o to expand)                                                                                                                                                                                 
                                                                                                                                                                                                                    
● البناء نجح! دعني أتحقق من أن التغييرات تعمل بشكل صحيح.                                                                                                                             