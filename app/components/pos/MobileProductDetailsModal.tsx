"use client";

import { useState, useEffect } from "react";
import { XMarkIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { ProductModalImage, ProductThumbnail } from "../ui/OptimizedImage";
import { LastPurchaseInfo } from "@/app/lib/utils/purchase-cost-management";

type TabType = "info" | "inventory" | "images";

interface MobileProductDetailsModalProps {
  product: any;
  onClose: () => void;
  branches: any[];
  lastPurchaseInfo?: LastPurchaseInfo | null;
  showPurchasePrice: boolean;
  onTogglePurchasePrice: () => void;
  selectedImage: string | null;
  onSelectImage: (url: string) => void;
  onShowPurchaseHistory?: () => void;

  // Products page extras
  rating?: number | null;
  ratingCount?: number | null;
  isDiscounted?: boolean;
  finalPrice?: number | null;
  discountLabel?: string | null;
  price2?: number | null;

  // Inventory page extras
  selectedBranches?: { [key: string]: boolean };
  calculateTotalQuantity?: (product: any) => number;

  // Image labels (Products + Inventory)
  showImageLabels?: boolean;
  mainImageUrl?: string | null;
  subImageUrl?: string | null;
}

export default function MobileProductDetailsModal({
  product,
  onClose,
  branches,
  lastPurchaseInfo,
  showPurchasePrice,
  onTogglePurchasePrice,
  selectedImage,
  onSelectImage,
  onShowPurchaseHistory,
  rating,
  ratingCount,
  isDiscounted,
  finalPrice,
  discountLabel,
  price2,
  selectedBranches,
  calculateTotalQuantity: calculateTotalQuantityFn,
  showImageLabels,
  mainImageUrl,
  subImageUrl,
}: MobileProductDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("info");

  // Reset tab when modal opens with new product
  useEffect(() => {
    setActiveTab("info");
  }, [product?.id]);

  const totalQuantity = calculateTotalQuantityFn
    ? calculateTotalQuantityFn(product)
    : (product.inventoryData &&
        Object.values(product.inventoryData).reduce(
          (sum: number, inv: any) => sum + (inv?.quantity || 0),
          0
        )) ||
      0;

  const tabs: { key: TabType; label: string }[] = [
    { key: "info", label: "المعلومات" },
    { key: "inventory", label: "المخزون" },
    { key: "images", label: "الصور" },
  ];

  const getVariantColor = (variant: any) => {
    if (variant.variant_type === "color") {
      const productColor = product.productColors?.find(
        (c: any) => c.name === variant.name
      );
      if (productColor?.color) return productColor.color;
      if (variant.value) return variant.value;
      if (variant.color_hex) return variant.color_hex;
    }
    return "#6B7280";
  };

  const getTextColor = (bgColor: string) => {
    const hex = bgColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#FFFFFF";
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1F2937] animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#2B3544] border-b border-[#4A5568] shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white text-xs">📦</span>
        </div>
        <h2 className="text-white font-semibold text-sm truncate flex-1">
          {product.name}
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600/30 rounded-full transition-colors shrink-0"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex bg-[#2B3544] border-b border-[#4A5568] shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4">
        {/* Info Tab */}
        {activeTab === "info" && (
          <>
            {/* Quick Stats */}
            <div className="flex gap-3">
              <div className="flex-1 bg-green-600/10 border border-green-600/20 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs mb-0.5">سعر البيع</p>
                {isDiscounted ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <p className="text-green-400 font-bold text-lg">
                      {(finalPrice || 0).toFixed(2)}
                    </p>
                    <p className="text-gray-500 line-through text-sm">
                      {(product.price || 0).toFixed(2)}
                    </p>
                    {discountLabel && (
                      <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        {discountLabel}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-green-400 font-bold text-lg">
                    {(product.price || 0).toFixed(2)}
                  </p>
                )}
              </div>
              <div className="flex-1 bg-blue-600/10 border border-blue-600/20 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs mb-0.5">الكمية</p>
                <p className="text-blue-400 font-bold text-lg">
                  {totalQuantity}
                </p>
              </div>
            </div>

            {/* Basic Info */}
            <div className="bg-[#374151] rounded-xl p-4 border border-[#4A5568]">
              <h3 className="text-white font-semibold text-sm mb-3">
                معلومات المنتج
              </h3>
              <div className="space-y-2.5">
                {[
                  { label: "المجموعة", value: product.category?.name || "غير محدد" },
                  { label: "الوحدة", value: product.unit || "قطعة" },
                  { label: "الحد الأدنى", value: product.min_stock || 0 },
                  { label: "الباركود", value: product.barcode || "غير متوفر", mono: true },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex justify-between items-center py-1.5 border-b border-gray-600/30 last:border-0"
                  >
                    <span className="text-gray-400 text-sm">{item.label}</span>
                    <span
                      className={`text-white text-sm ${
                        item.mono ? "font-mono" : "font-medium"
                      }`}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-[#374151] rounded-xl p-4 border border-[#4A5568]">
              <h3 className="text-white font-semibold text-sm mb-3">الأسعار</h3>

              {/* Main sell price with discount (if applicable) */}
              {isDiscounted && (
                <div className="bg-[#2B3544] rounded-lg p-3 text-center mb-2.5 border border-green-600/30">
                  <p className="text-gray-400 text-xs mb-0.5">سعر البيع</p>
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-green-400 font-bold text-xl">{(finalPrice || 0).toFixed(2)}</p>
                    <p className="text-gray-500 line-through text-base">{(product.price || 0).toFixed(2)}</p>
                    {discountLabel && (
                      <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {discountLabel}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {!isDiscounted && (
                  <div className="bg-[#2B3544] rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs mb-0.5">سعر البيع</p>
                    <p className="text-green-400 font-bold text-base">
                      {(product.price || 0).toFixed(2)}
                    </p>
                  </div>
                )}
                <div
                  onClick={onTogglePurchasePrice}
                  className="bg-[#2B3544] rounded-lg p-3 text-center cursor-pointer active:bg-[#374151] transition-colors"
                >
                  {showPurchasePrice ? (
                    <>
                      <p className="text-gray-400 text-xs mb-0.5">سعر الشراء</p>
                      <p className="text-orange-400 font-bold text-base">
                        {(product.cost_price || 0).toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full min-h-[40px]">
                      <EyeSlashIcon className="h-5 w-5 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="bg-[#2B3544] rounded-lg p-3 text-center">
                  <p className="text-gray-400 text-xs mb-0.5">سعر الجملة</p>
                  <p className="text-blue-400 font-bold text-base">
                    {(product.wholesale_price || 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-[#2B3544] rounded-lg p-3 text-center">
                  <p className="text-gray-400 text-xs mb-0.5">سعر 1</p>
                  <p className="text-purple-400 font-bold text-base">
                    {(product.price1 || 0).toFixed(2)}
                  </p>
                </div>
                {price2 !== undefined && (
                  <div className="bg-[#2B3544] rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs mb-0.5">سعر 2</p>
                    <p className="text-indigo-400 font-bold text-base">
                      {(price2 || 0).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Rating (Products page) */}
            {rating !== undefined && (
              <div className="bg-[#374151] rounded-xl p-4 border border-[#4A5568]">
                <h3 className="text-white font-semibold text-sm mb-3">التقييمات</h3>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="text-yellow-400 font-bold text-2xl">
                      {(rating || 0).toFixed(1)}
                    </span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-base ${
                            star <= (rating || 0)
                              ? "text-yellow-400"
                              : "text-gray-600"
                          }`}
                        >
                          ⭐
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs">
                    {ratingCount || 0} تقييم
                  </p>
                  {(ratingCount || 0) === 0 && (
                    <p className="text-gray-500 text-[11px] mt-1">
                      لا توجد تقييمات بعد
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Profit & Purchase Info (POS only) */}
            {onShowPurchaseHistory && (
              <div className="bg-[#374151] rounded-xl p-4 border border-[#4A5568]">
                <h3 className="text-white font-semibold text-sm mb-3">
                  الربح ومعلومات الشراء
                </h3>
                <div className="bg-[#2B3544] rounded-lg p-3 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">ربح المنتج</span>
                    <span className="text-xs text-gray-500 font-mono">
                      PD:{" "}
                      {(
                        (product.price || 0) - (product.cost_price || 0)
                      ).toFixed(0)}
                    </span>
                  </div>
                </div>

                {lastPurchaseInfo ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-600/30">
                      <span className="text-gray-400 text-sm">آخر سعر شراء</span>
                      <span className="text-orange-400 font-bold text-sm">
                        {lastPurchaseInfo.unitPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-600/30">
                      <span className="text-gray-400 text-sm">المورد</span>
                      <span className="text-white font-medium text-sm">
                        {lastPurchaseInfo.supplierName}
                      </span>
                    </div>
                    <button
                      onClick={onShowPurchaseHistory}
                      className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors mt-2"
                    >
                      عرض تاريخ الشراء
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm text-center py-3">
                    لا يوجد سجل شراء لهذا المنتج
                  </p>
                )}
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="bg-[#374151] rounded-xl p-4 border border-[#4A5568]">
                <h3 className="text-white font-semibold text-sm mb-2">
                  وصف المنتج
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}
          </>
        )}

        {/* Inventory Tab */}
        {activeTab === "inventory" && (
          <>
            {/* Total Quantity Banner */}
            <div className="bg-blue-600/10 rounded-xl p-4 text-center border border-blue-600/20">
              <p className="text-blue-400 text-sm mb-1">الكمية الإجمالية</p>
              <p className="text-blue-400 font-bold text-3xl">{totalQuantity}</p>
            </div>

            {/* Branch/Warehouse Cards */}
            {product.inventoryData &&
              Object.entries(product.inventoryData)
                .filter(([locationId]) => !selectedBranches || selectedBranches[locationId])
                .map(
                ([locationId, inventory]: [string, any]) => {
                  const branch = branches.find((b) => b.id === locationId);
                  const locationName =
                    branch?.name || `موقع ${locationId.slice(0, 8)}`;

                  return (
                    <div
                      key={locationId}
                      className="bg-[#374151] rounded-xl p-4 border border-[#4A5568]"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white font-medium text-sm">
                          {locationName}
                        </span>
                        <span className="text-blue-400 font-bold text-lg">
                          {inventory?.quantity || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">الحد الأدنى</span>
                        <span className="text-orange-400">
                          {inventory?.min_stock || 0}
                        </span>
                      </div>
                    </div>
                  );
                }
              )}

            {/* Variants */}
            {product.variantsData &&
              Object.keys(product.variantsData).length > 0 && (
                <div className="bg-[#374151] rounded-xl p-4 border border-[#4A5568]">
                  <h3 className="text-white font-semibold text-sm mb-3">
                    الألوان والأشكال
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(product.variantsData)
                      .filter(([locationId]) => !selectedBranches || selectedBranches[locationId])
                      .map(
                      ([locationId, variants]: [string, any]) => {
                        const branch = branches.find(
                          (b) => b.id === locationId
                        );
                        const locationName =
                          branch?.name || `موقع ${locationId.slice(0, 8)}`;

                        const totalInventoryQuantity =
                          product.inventoryData?.[locationId]?.quantity || 0;
                        const assignedQuantity = variants.reduce(
                          (sum: number, v: any) => sum + (v.quantity || 0),
                          0
                        );
                        const unassignedQuantity =
                          totalInventoryQuantity - assignedQuantity;

                        return (
                          <div key={locationId} className="bg-[#2B3544] rounded-lg p-3">
                            <p className="text-white font-medium text-sm mb-2">
                              {locationName}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {variants
                                .filter((v: any) => v.name !== "غير محدد")
                                .map((variant: any, index: number) => {
                                  const bgColor = getVariantColor(variant);
                                  const textColor = getTextColor(bgColor);
                                  return (
                                    <span
                                      key={index}
                                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
                                      style={{
                                        backgroundColor: bgColor,
                                        color: textColor,
                                        borderColor:
                                          bgColor === "#6B7280"
                                            ? "#6B7280"
                                            : bgColor,
                                      }}
                                    >
                                      {variant.name} ({variant.quantity})
                                    </span>
                                  );
                                })}
                              {unassignedQuantity > 0 && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white bg-gray-600 border border-gray-600">
                                  غير محدد ({unassignedQuantity})
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
          </>
        )}

        {/* Images Tab */}
        {activeTab === "images" && (
          <>
            {/* Main Image */}
            <div className="bg-[#374151] rounded-xl p-4 border border-[#4A5568]">
              <ProductModalImage
                src={selectedImage}
                alt={product.name}
                priority={true}
              />
            </div>

            {/* Thumbnail Strip */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
              {product.allImages && product.allImages.length > 0 ? (
                product.allImages.map((imageUrl: string, index: number) => {
                  const isMainImage = showImageLabels && imageUrl === mainImageUrl;
                  const isSubImage = showImageLabels && imageUrl === subImageUrl;
                  return (
                    <div key={index} className="shrink-0 w-16 relative">
                      <ProductThumbnail
                        src={imageUrl}
                        alt={isMainImage ? "الصورة الرئيسية" : isSubImage ? "الصورة الثانوية" : `صورة ${index + 1}`}
                        isSelected={selectedImage === imageUrl}
                        onClick={() => onSelectImage(imageUrl)}
                      />
                      {(isMainImage || isSubImage) && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-1 py-0.5 text-center rounded-b-md">
                          {isMainImage ? "رئيسية" : "ثانوية"}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="w-full h-16 bg-[#2B3544] rounded-md border border-gray-600/30 flex items-center justify-center">
                  <span className="text-gray-500 text-xs">
                    لا توجد صور متاحة
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
