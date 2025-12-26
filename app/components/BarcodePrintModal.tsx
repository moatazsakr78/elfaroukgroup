'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import JsBarcode from 'jsbarcode'
import { XMarkIcon, PrinterIcon, Cog6ToothIcon, MagnifyingGlassIcon, EyeIcon } from '@heroicons/react/24/outline'
import { Product } from '../lib/hooks/useProductsOptimized'
import { ProductGridImage } from './ui/OptimizedImage'

interface Branch {
  id: string
  name: string
}

interface BarcodePrintModalProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
  branches: Branch[]
}

type LabelSize = 'small' | 'large'

interface LabelSettings {
  showProductName: boolean
  showBranch: boolean
  showPrice: boolean
  showBarcode: boolean
  showCompanyName: boolean
  priceType: 'price' | 'wholesale_price' | 'price1' | 'price2' | 'price3' | 'price4'
}

export default function BarcodePrintModal({ isOpen, onClose, products, branches }: BarcodePrintModalProps) {
  const [labelSize, setLabelSize] = useState<LabelSize>('large')
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [labelSettings, setLabelSettings] = useState<LabelSettings>({
    showProductName: true,
    showBranch: true,
    showPrice: true,
    showBarcode: true,
    showCompanyName: true,
    priceType: 'price'
  })
  const [copies, setCopies] = useState<{[productId: string]: number}>({})
  const [searchQuery, setSearchQuery] = useState('')
  const barcodeRefs = useRef<{[key: string]: SVGSVGElement | null}>({})
  const [showPreview, setShowPreview] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)

  // Initialize copies to 0 for each product
  useEffect(() => {
    if (products.length > 0) {
      const initialCopies: {[productId: string]: number} = {}
      products.forEach(product => {
        initialCopies[product.id] = 0
      })
      setCopies(initialCopies)
    }
  }, [products])

  // Set first branch as default
  useEffect(() => {
    if (branches.length > 0 && !selectedBranch) {
      setSelectedBranch(branches[0].id)
    }
  }, [branches, selectedBranch])

  const generateBarcodes = () => {
    // Generate barcodes as Canvas images for thermal printers
    let generatedCount = 0
    products.forEach((product) => {
      const numCopies = copies[product.id] || 0

      for (let i = 0; i < numCopies; i++) {
        const canvasId = `barcode-canvas-${product.id}-${i}`
        const imgId = `barcode-img-${product.id}-${i}`

        // Create temporary canvas
        let canvas = document.getElementById(canvasId) as HTMLCanvasElement
        if (!canvas) {
          canvas = document.createElement('canvas')
          canvas.id = canvasId
          canvas.style.display = 'none'
          document.body.appendChild(canvas)
        }

        if (canvas && product.barcode) {
          try {
            // Generate barcode on canvas - optimized for 50x25mm thermal labels
            JsBarcode(canvas, product.barcode, {
              format: 'CODE128',
              width: 1.4,              // Sharp, clear lines for thermal printing
              height: 38,              // Optimal height for scanning
              displayValue: false,
              margin: 4,               // Compact margin
              marginTop: 2,
              marginBottom: 2,
              background: '#ffffff',
              lineColor: '#000000'
            })

            // Convert canvas to PNG image
            const imgElement = document.getElementById(imgId) as HTMLImageElement
            if (imgElement) {
              imgElement.src = canvas.toDataURL('image/png')
              generatedCount++
            }
          } catch (error) {
            console.error(`Error generating barcode for ${product.name}:`, error)
          }
        }
      }
    })

    console.log(`Generated ${generatedCount} barcodes as PNG images`)
    return generatedCount
  }

  const handlePreview = () => {
    // Count total labels to preview
    const totalLabels = Object.values(copies).reduce((sum, count) => sum + count, 0)

    if (totalLabels === 0) {
      alert('⚠️ يرجى تحديد عدد النسخ للمنتجات أولاً')
      return
    }

    // Make print container visible temporarily to generate barcodes
    const printContainer = document.getElementById('barcode-print-container')
    if (!printContainer) {
      console.error('Print container not found')
      return
    }

    // Show container temporarily (hidden from user)
    printContainer.style.display = 'block'
    printContainer.style.visibility = 'hidden'
    printContainer.style.position = 'fixed'
    printContainer.style.left = '0'
    printContainer.style.top = '0'
    printContainer.style.zIndex = '-1'

    // Wait for DOM to update
    setTimeout(() => {
      console.log('👁️ Generating barcodes for preview...')
      console.log(`📊 Total labels to preview: ${totalLabels}`)
      const count = generateBarcodes()
      console.log(`✅ Generated ${count} barcode preview images`)

      // Wait for images to load and show preview
      setTimeout(() => {
        const images = printContainer.querySelectorAll('img[id^="barcode-img-"]')
        let loadedCount = 0
        images.forEach((img: any) => {
          if (img.complete && img.src) loadedCount++
        })
        console.log(`📸 Preview images loaded: ${loadedCount}/${images.length}`)

        setShowPreview(true)
        // Keep container visible for preview
      }, 600)
    }, 200)
  }

  const handlePrint = () => {
    // Count total labels to print
    const totalLabels = Object.values(copies).reduce((sum, count) => sum + count, 0)

    if (totalLabels === 0) {
      alert('⚠️ يرجى تحديد عدد النسخ للمنتجات أولاً')
      return
    }

    // Make print container visible to generate barcodes
    const printContainer = document.getElementById('barcode-print-container')
    if (!printContainer) {
      console.error('❌ Print container not found')
      alert('خطأ: لم يتم العثور على حاوية الطباعة')
      return
    }

    // Show loading state
    setIsPreparing(true)

    // Make container visible for barcode generation
    console.log('🖨️ Preparing print container...')
    printContainer.style.display = 'block'
    printContainer.style.visibility = 'visible'

    // Wait for DOM to update
    setTimeout(() => {
      console.log('🖨️ Generating barcodes as PNG images...')
      console.log(`📊 Total labels: ${totalLabels}`)
      const count = generateBarcodes()
      console.log(`✅ Generated ${count} barcodes`)

      // Wait for images to fully load
      setTimeout(() => {
        // Check if all images are loaded
        const images = printContainer.querySelectorAll('img[id^="barcode-img-"]')
        let loadedCount = 0
        images.forEach((img: any) => {
          if (img.complete && img.src) loadedCount++
        })
        console.log(`📸 Images: ${loadedCount}/${images.length}`)

        if (loadedCount < images.length) {
          console.warn('⚠️ Not all images loaded!')
        }

        // Create iframe for printing
        console.log('📄 Creating print iframe...')
        const iframe = document.createElement('iframe')
        iframe.style.position = 'absolute'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = 'none'
        document.body.appendChild(iframe)

        const iframeDoc = iframe.contentWindow?.document
        if (!iframeDoc) {
          console.error('❌ Failed to create iframe')
          setIsPreparing(false)
          return
        }

        // Write content to iframe
        iframeDoc.open()
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Print Labels</title>
            <style>
              /* Each sticker on separate page - Landscape orientation */
              @page {
                size: ${currentDimensions.width}mm ${currentDimensions.height}mm landscape;
                margin: 0;
              }

              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }

              body {
                background: white;
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
              }

              .print-labels-grid {
                display: block;
              }

              .barcode-sticker {
                width: ${currentDimensions.width}mm;
                height: ${currentDimensions.height}mm;
                page-break-after: always;
                page-break-inside: avoid;
                display: flex;
                background: white;
                overflow: hidden;
                margin: 0;
                padding: 0;
              }

              .barcode-sticker:last-child {
                page-break-after: auto;
              }

              img {
                image-rendering: -webkit-optimize-contrast;
                image-rendering: crisp-edges;
              }
            </style>
          </head>
          <body>
            ${printContainer.innerHTML}
          </body>
          </html>
        `)
        iframeDoc.close()

        // Wait for iframe to load
        setTimeout(() => {
          console.log('🖨️ Printing from iframe...')
          console.log(`📄 Total pages to print: ${totalLabels} (one label per page)`)
          console.log(`📏 Page size: ${currentDimensions.width}mm (width) × ${currentDimensions.height}mm (height)`)
          console.log(`📐 Orientation: Landscape (horizontal)`)
          console.log(`📊 Ratio: ${(currentDimensions.width / currentDimensions.height).toFixed(1)}:1`)
          console.log(`ℹ️ If sticker appears square, check printer settings in "More settings"`)

          // Hide loading state
          setIsPreparing(false)

          // Print iframe
          iframe.contentWindow?.print()

          // Remove iframe after print
          setTimeout(() => {
            document.body.removeChild(iframe)
            printContainer.style.display = 'none'
            printContainer.style.visibility = 'hidden'

            // Cleanup canvas elements
            const canvases = document.querySelectorAll('[id^="barcode-canvas-"]')
            canvases.forEach(canvas => canvas.remove())
            console.log('✅ Cleanup complete')
          }, 1000)
        }, 500)
      }, 1500)
    }, 500)
  }

  const getPrice = (product: Product): number => {
    switch (labelSettings.priceType) {
      case 'wholesale_price':
        return product.wholesale_price || 0
      case 'price1':
        return product.price1 || 0
      case 'price2':
        return product.price2 || 0
      case 'price3':
        return product.price3 || 0
      case 'price4':
        return product.price4 || 0
      default:
        return product.price || 0
    }
  }

  const getPriceLabel = (): string => {
    switch (labelSettings.priceType) {
      case 'wholesale_price':
        return 'سعر الجملة'
      case 'price1':
        return 'سعر 1'
      case 'price2':
        return 'سعر 2'
      case 'price3':
        return 'سعر 3'
      case 'price4':
        return 'سعر 4'
      default:
        return 'السعر'
    }
  }

  const selectedBranchName = branches.find(b => b.id === selectedBranch)?.name || ''

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products

    const query = searchQuery.toLowerCase()
    return products.filter(product =>
      product.name.toLowerCase().includes(query) ||
      (product.barcode && product.barcode.toLowerCase().includes(query))
    )
  }, [products, searchQuery])

  // Generate barcodes for all products in preview cards
  useEffect(() => {
    filteredProducts.forEach(product => {
      if (product.barcode && barcodeRefs.current[product.id]) {
        try {
          JsBarcode(barcodeRefs.current[product.id]!, product.barcode, {
            format: 'CODE128',
            width: 0.6,          // Very thin for small horizontal preview
            height: 20,          // Low height for horizontal layout
            displayValue: false,
            margin: 1,
            background: '#ffffff',
            lineColor: '#000000'
          })
        } catch (error) {
          console.error('Error generating barcode:', error)
        }
      }
    })
  }, [filteredProducts, labelSize])

  if (!isOpen) return null

  // Dimensions for thermal label printer (50mm x 25mm sticker)
  // For landscape orientation: width (longer side) = 50mm, height (shorter side) = 25mm
  const dimensions = {
    small: { width: 50, height: 25 },
    large: { width: 50, height: 25 }
  }

  // Note: Some thermal printers expect dimensions in different order
  // If the sticker appears square, the printer may be interpreting the size differently

  const currentDimensions = dimensions[labelSize]

  return (
    <>
      {/* Loading Overlay */}
      {isPreparing && (
        <div className="fixed inset-0 bg-black/90 z-[10001] flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-md">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">جاري تحضير الطباعة...</h3>
            <p className="text-gray-600 mb-3">يتم تحويل الباركود إلى صور PNG</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-blue-800 text-sm font-medium">
                📄 كل استيكر سيطبع على صفحة منفصلة
              </p>
              <p className="text-blue-600 text-xs mt-1">
                عدد الملصقات: {Object.values(copies).reduce((sum, count) => sum + count, 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 no-print" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
        <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <PrinterIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">مركز طباعة ملصقات الباركود</h2>
                <p className="text-blue-100 text-sm">تصميم وطباعة ملصقات احترافية لمنتجاتك</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 flex overflow-hidden">

            {/* Settings Panel */}
            <div className="w-80 bg-[#374151] border-l border-[#4A5568] p-6 overflow-y-auto scrollbar-hide">
              <div className="space-y-6">

                {/* Info Banner */}
                <div className="bg-green-900/30 border border-green-600 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 text-lg flex-shrink-0">✓</span>
                    <div>
                      <p className="text-green-300 text-xs font-medium leading-relaxed">
                        باركود Sharp وواضح | خطوط حادة غير متداخلة | اسم المنتج ظاهر بوضوح
                      </p>
                    </div>
                  </div>
                </div>

                {/* Size Selection */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Cog6ToothIcon className="h-5 w-5 text-blue-400" />
                    <h3 className="text-white font-semibold">حجم الملصق</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setLabelSize('small')}
                      className={`py-3 px-4 rounded-lg border-2 transition-all ${
                        labelSize === 'small'
                          ? 'bg-blue-600 border-blue-400 text-white'
                          : 'bg-[#2B3544] border-gray-600 text-gray-300 hover:border-blue-500'
                      }`}
                    >
                      <div className="text-center">
                        <div className="font-bold mb-1">قياسي</div>
                        <div className="text-xs opacity-75">50×25 مم</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setLabelSize('large')}
                      className={`py-3 px-4 rounded-lg border-2 transition-all ${
                        labelSize === 'large'
                          ? 'bg-blue-600 border-blue-400 text-white'
                          : 'bg-[#2B3544] border-gray-600 text-gray-300 hover:border-blue-500'
                      }`}
                      disabled
                    >
                      <div className="text-center">
                        <div className="font-bold mb-1 text-gray-500">كبير</div>
                        <div className="text-xs opacity-50">50×25 مم</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Branch Selection */}
                <div>
                  <label className="block text-white font-semibold mb-2">الفرع</label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full bg-[#2B3544] border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>

                {/* Price Type Selection */}
                <div>
                  <label className="block text-white font-semibold mb-2">نوع السعر</label>
                  <select
                    value={labelSettings.priceType}
                    onChange={(e) => setLabelSettings(prev => ({ ...prev, priceType: e.target.value as any }))}
                    className="w-full bg-[#2B3544] border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="price">سعر البيع</option>
                    <option value="wholesale_price">سعر الجملة</option>
                    <option value="price1">سعر 1</option>
                    <option value="price2">سعر 2</option>
                    <option value="price3">سعر 3</option>
                    <option value="price4">سعر 4</option>
                  </select>
                </div>

                {/* Label Content Settings */}
                <div>
                  <h3 className="text-white font-semibold mb-3">محتوى الملصق</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={labelSettings.showCompanyName}
                        onChange={(e) => setLabelSettings(prev => ({ ...prev, showCompanyName: e.target.checked }))}
                        className="w-5 h-5 rounded border-2 border-gray-600 bg-[#2B3544] checked:bg-blue-600 checked:border-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-300 group-hover:text-white">اسم الشركة</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={labelSettings.showProductName}
                        onChange={(e) => setLabelSettings(prev => ({ ...prev, showProductName: e.target.checked }))}
                        className="w-5 h-5 rounded border-2 border-gray-600 bg-[#2B3544] checked:bg-blue-600 checked:border-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-300 group-hover:text-white">اسم المنتج</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={labelSettings.showBranch}
                        onChange={(e) => setLabelSettings(prev => ({ ...prev, showBranch: e.target.checked }))}
                        className="w-5 h-5 rounded border-2 border-gray-600 bg-[#2B3544] checked:bg-blue-600 checked:border-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-300 group-hover:text-white">اسم الفرع</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={labelSettings.showPrice}
                        onChange={(e) => setLabelSettings(prev => ({ ...prev, showPrice: e.target.checked }))}
                        className="w-5 h-5 rounded border-2 border-gray-600 bg-[#2B3544] checked:bg-blue-600 checked:border-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-300 group-hover:text-white">السعر</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={labelSettings.showBarcode}
                        onChange={(e) => setLabelSettings(prev => ({ ...prev, showBarcode: e.target.checked }))}
                        className="w-5 h-5 rounded border-2 border-gray-600 bg-[#2B3544] checked:bg-blue-600 checked:border-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-300 group-hover:text-white">الباركود</span>
                    </label>
                  </div>
                </div>

                {/* Preview and Print Buttons */}
                <div className="space-y-2">
                  <button
                    onClick={handlePreview}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <EyeIcon className="h-5 w-5" />
                    معاينة الملصقات
                  </button>
                  <button
                    onClick={handlePrint}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <PrinterIcon className="h-5 w-5" />
                    طباعة مباشرة
                  </button>
                </div>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="flex-1 bg-[#2B3544] flex flex-col overflow-hidden">

              {/* Search Bar */}
              <div className="p-4 border-b border-[#4A5568]">
                <h3 className="text-white text-lg font-semibold mb-3 text-center">معاينة الملصقات</h3>
                <p className="text-gray-400 text-sm mb-3 text-center">حدد عدد النسخ لكل منتج</p>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن منتج بالاسم أو الباركود..."
                    className="w-full pl-4 pr-10 py-3 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Products Grid */}
              <div className="flex-1 p-4 overflow-y-auto scrollbar-hide">
                <div className="grid grid-cols-3 gap-4">
                  {filteredProducts.map(product => {
                    const hasQuantity = (copies[product.id] || 0) > 0

                    return (
                      <div
                        key={product.id}
                        className={`rounded-lg p-3 border-2 transition-all ${
                          hasQuantity
                            ? 'bg-blue-900/30 border-blue-500 shadow-lg shadow-blue-500/20'
                            : 'bg-[#374151] border-[#4A5568]'
                        }`}
                      >
                        {/* Product Image */}
                        <div className="mb-2 relative h-32">
                          <ProductGridImage
                            src={product.main_image_url}
                            alt={product.name}
                            priority={false}
                          />
                        </div>

                        {/* Product Info */}
                        <div className="mb-2">
                          <h4 className="text-white font-medium text-sm mb-1 truncate">{product.name}</h4>
                          <p className="text-gray-400 text-xs truncate">{product.barcode || 'لا يوجد باركود'}</p>
                        </div>

                        {/* Copies Input */}
                        <div className="mb-2">
                          <label className="block text-gray-300 text-xs mb-1">عدد النسخ</label>
                          <input
                            type="number"
                            min="0"
                            value={copies[product.id] || 0}
                            onChange={(e) => setCopies(prev => ({ ...prev, [product.id]: parseInt(e.target.value) || 0 }))}
                            className={`w-full border rounded px-3 py-2 text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              hasQuantity
                                ? 'bg-blue-600 border-blue-400 text-white'
                                : 'bg-[#2B3544] border-gray-600 text-white'
                            }`}
                          />
                        </div>

                        {/* Label Preview - Horizontal */}
                        <div className="bg-white rounded p-1 flex items-center justify-center">
                          <div
                            className="border border-gray-300 bg-white flex items-center justify-between overflow-hidden"
                            style={{
                              width: `${currentDimensions.width * 1.8}px`,
                              height: `${currentDimensions.height * 1.8}px`,
                              padding: '2px'
                            }}
                          >
                            {/* Left */}
                            <div className="flex flex-col justify-center flex-1 min-w-0 pr-1">
                              {labelSettings.showCompanyName && (
                                <div className="text-[5px] font-bold text-gray-800 truncate">المعرض</div>
                              )}
                              {labelSettings.showProductName && (
                                <div className="text-[4px] font-medium text-gray-700 truncate">{product.name}</div>
                              )}
                            </div>

                            {/* Center - Barcode */}
                            {labelSettings.showBarcode && product.barcode && (
                              <div className="flex flex-col items-center justify-center flex-[2] px-0.5">
                                <svg
                                  ref={(el) => { if (el) barcodeRefs.current[product.id] = el }}
                                  style={{ maxWidth: '100%', height: 'auto' }}
                                />
                                <div className="text-[4px] font-mono font-bold text-gray-700">*{product.barcode}*</div>
                              </div>
                            )}

                            {/* Right - Price */}
                            {labelSettings.showPrice && (
                              <div className="flex flex-col items-end justify-center flex-1 pl-1">
                                <div className="text-[6px] font-bold text-gray-900">{getPrice(product).toFixed(2)}</div>
                                <div className="text-[4px] font-bold text-gray-900">LE</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 5mm;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* Ensure crisp image rendering for thermal printers */
          img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            image-rendering: pixelated !important;
          }

          /* High contrast for thermal printers */
          .barcode-sticker {
            filter: contrast(1.2) !important;
          }

          /* Hide all page content */
          body {
            margin: 0 !important;
            padding: 0 !important;
          }

          body > * {
            display: none !important;
          }

          /* Show ONLY the print container */
          #barcode-print-container {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            z-index: 9999 !important;
            background: white !important;
          }

          #barcode-print-container,
          #barcode-print-container * {
            visibility: visible !important;
            opacity: 1 !important;
          }

          .print-labels-grid {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, ${currentDimensions.width}mm);
            gap: 3mm;
            padding: 5mm;
            background: white;
            width: 100%;
          }

          .barcode-sticker {
            width: ${currentDimensions.width}mm;
            height: ${currentDimensions.height}mm;
            border: 1px solid #ddd;
            page-break-inside: avoid;
            break-inside: avoid;
            display: flex !important;
            background: white;
            box-sizing: border-box;
            overflow: hidden;
          }

          .barcode-sticker > div {
            width: 100%;
          }

          .barcode-sticker img {
            image-rendering: -webkit-optimize-contrast !important;
            image-rendering: -moz-crisp-edges !important;
            image-rendering: crisp-edges !important;
            -ms-interpolation-mode: nearest-neighbor !important;
          }
        }

        @media screen {
          #barcode-print-container {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            position: absolute !important;
            left: -9999px !important;
          }
        }
      `}</style>

      {/* Preview Modal */}
      {showPreview && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999]" onClick={() => {
            setShowPreview(false)
            // Hide print container
            const printContainer = document.getElementById('barcode-print-container')
            if (printContainer) {
              printContainer.style.display = 'none'
              printContainer.style.position = 'static'
              printContainer.style.left = '0'
            }
          }} />

          {/* Preview Modal */}
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-8">
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <EyeIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">معاينة الملصقات</h2>
                    <p className="text-blue-100 text-sm">معاينة قبل الطباعة</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPreview(false)
                    // Hide print container
                    const printContainer = document.getElementById('barcode-print-container')
                    if (printContainer) {
                      printContainer.style.display = 'none'
                      printContainer.style.position = 'static'
                      printContainer.style.left = '0'
                    }
                  }}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Preview Content */}
              <div className="flex-1 overflow-y-auto p-8 bg-gray-100">
                <div className="max-w-5xl mx-auto bg-white p-8 rounded-lg shadow-lg">
                  {/* Info Banner */}
                  <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xl">ℹ️</span>
                      </div>
                      <div>
                        <h4 className="text-blue-900 font-bold mb-1">معاينة الملصقات قبل الطباعة</h4>
                        <p className="text-blue-700 text-sm">تم تحويل الباركود إلى صور PNG لضمان جودة طباعة ممتازة على الطابعات الحرارية</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 justify-center">
                    {products.flatMap(product =>
                      Array.from({ length: copies[product.id] || 0 }, (_, index) => {
                        const imgElement = document.getElementById(`barcode-img-${product.id}-${index}`) as HTMLImageElement
                        const imgSrc = imgElement?.src || ''

                        return (
                          <div
                            key={`preview-${product.id}-${index}`}
                            className="border-2 border-gray-400 bg-white shadow-lg overflow-hidden"
                            style={{
                              width: `${currentDimensions.width * 3}px`,
                              height: `${currentDimensions.height * 3}px`
                            }}
                          >
                            {/* Vertical Layout Preview */}
                            <div className="flex flex-col items-center justify-start w-full h-full p-1 gap-0">
                              {/* Top: Product Name */}
                              {labelSettings.showProductName && (
                                <div className="text-gray-900 text-center w-full mb-0 truncate px-1" style={{ fontSize: '12px', fontWeight: '800' }}>
                                  {product.name}
                                </div>
                              )}

                              {/* Center: Barcode and Price */}
                              <div className="flex flex-col items-center justify-center w-full" style={{ gap: '0px' }}>
                                {/* Barcode Image */}
                                {labelSettings.showBarcode && product.barcode && imgSrc && (
                                  <img
                                    src={imgSrc}
                                    alt={product.barcode}
                                    className="max-w-full h-auto"
                                    style={{ imageRendering: 'crisp-edges', maxWidth: '90%' }}
                                  />
                                )}

                                {/* Price - Below Barcode (no barcode number) */}
                                {labelSettings.showPrice && (
                                  <div className="text-gray-900 text-center w-full" style={{ fontSize: '11px', fontWeight: '800' }}>
                                    {getPrice(product).toFixed(2)} LE
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Footer with Print Button */}
              <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                <p className="text-gray-600">
                  عدد الملصقات: {Object.values(copies).reduce((sum, count) => sum + count, 0)}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowPreview(false)
                      // Hide print container
                      const printContainer = document.getElementById('barcode-print-container')
                      if (printContainer) {
                        printContainer.style.display = 'none'
                        printContainer.style.position = 'static'
                        printContainer.style.left = '0'
                      }
                    }}
                    className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={() => {
                      setShowPreview(false)
                      handlePrint()
                    }}
                    className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                  >
                    <PrinterIcon className="h-5 w-5" />
                    طباعة الآن
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Hidden print content */}
      <div id="barcode-print-container">
        <div className="print-labels-grid">
          {products.flatMap(product =>
            Array.from({ length: copies[product.id] || 0 }, (_, index) => (
              <div key={`${product.id}-${index}`} className="barcode-sticker">
                {/* Vertical Layout: Company Name → Barcode → Product Name → Price */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  height: '100%',
                  padding: '0.5mm 2mm'
                }}>

                  {/* Top: Product Name */}
                  {labelSettings.showProductName && (
                    <div style={{
                      fontSize: '11pt',
                      fontWeight: '800',
                      color: '#000',
                      textAlign: 'center',
                      width: '100%',
                      marginBottom: '0mm',
                      fontFamily: 'Arial, sans-serif',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      padding: '0 1mm'
                    }}>
                      {product.name}
                    </div>
                  )}

                  {/* Center: Barcode and Price */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    gap: '0mm'
                  }}>
                    {/* Barcode Image */}
                    {labelSettings.showBarcode && product.barcode && (
                      <img
                        id={`barcode-img-${product.id}-${index}`}
                        alt={product.barcode}
                        style={{
                          display: 'block',
                          maxWidth: '90%',
                          height: 'auto',
                          imageRendering: 'crisp-edges'
                        }}
                      />
                    )}

                    {/* Price - Below Barcode (no barcode number) */}
                    {labelSettings.showPrice && (
                      <div style={{
                        fontSize: '10pt',
                        fontWeight: '800',
                        color: '#000',
                        textAlign: 'center',
                        width: '100%',
                        fontFamily: 'Arial, sans-serif'
                      }}>
                        {getPrice(product).toFixed(2)} LE
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
