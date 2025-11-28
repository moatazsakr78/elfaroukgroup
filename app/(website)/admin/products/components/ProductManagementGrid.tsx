'use client';

import { useState } from 'react';
import ProductCard from './ProductCard';
import SuggestedProductsModal from './SuggestedProductsModal';

interface ProductManagementItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isHidden: boolean;
  isFeatured: boolean;
  displayOrder: number;
  suggestedProducts: string[];
}

interface ProductManagementGridProps {
  products: ProductManagementItem[];
  isDragMode: boolean;
  onReorder: (products: ProductManagementItem[]) => void;
  onToggleVisibility: (productId: string) => void;
  onToggleFeatured: (productId: string) => void;
  onUpdateSuggestedProducts: (productId: string, suggestedIds: string[]) => void;
  selectedProductId?: string | null;
  onProductSelect?: (productId: string) => void;
}

export default function ProductManagementGrid({
  products,
  isDragMode,
  onReorder,
  onToggleVisibility,
  onToggleFeatured,
  onUpdateSuggestedProducts,
  selectedProductId,
  onProductSelect,
}: ProductManagementGridProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [selectedProductForSuggestions, setSelectedProductForSuggestions] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, productId: string) => {
    if (!isDragMode) return;
    setDraggedItem(productId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isDragMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    if (!isDragMode || !draggedItem) return;
    e.preventDefault();

    if (draggedItem === targetId) {
      setDraggedItem(null);
      return;
    }

    const newProducts = [...products];
    const draggedIndex = newProducts.findIndex(p => p.id === draggedItem);
    const targetIndex = newProducts.findIndex(p => p.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Remove dragged item and insert at target position
    const [draggedProduct] = newProducts.splice(draggedIndex, 1);
    newProducts.splice(targetIndex, 0, draggedProduct);

    onReorder(newProducts);
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const openSuggestionsModal = (productId: string) => {
    setSelectedProductForSuggestions(productId);
  };

  const closeSuggestionsModal = () => {
    setSelectedProductForSuggestions(null);
  };

  const handleUpdateSuggestions = (suggestedIds: string[]) => {
    if (selectedProductForSuggestions) {
      onUpdateSuggestedProducts(selectedProductForSuggestions, suggestedIds);
    }
    closeSuggestionsModal();
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            isDragMode={isDragMode}
            isDragging={draggedItem === product.id}
            isSelected={selectedProductId === product.id}
            onDragStart={(e) => handleDragStart(e, product.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, product.id)}
            onDragEnd={handleDragEnd}
            onToggleVisibility={() => onToggleVisibility(product.id)}
            onToggleFeatured={() => onToggleFeatured(product.id)}
            onManageSuggestions={() => openSuggestionsModal(product.id)}
            onSelect={onProductSelect ? () => onProductSelect(product.id) : undefined}
          />
        ))}
      </div>

      {/* Suggested Products Modal */}
      {selectedProductForSuggestions && (
        <SuggestedProductsModal
          productId={selectedProductForSuggestions}
          products={products}
          currentSuggestions={products.find(p => p.id === selectedProductForSuggestions)?.suggestedProducts || []}
          onSave={handleUpdateSuggestions}
          onClose={closeSuggestionsModal}
        />
      )}
    </>
  );
}