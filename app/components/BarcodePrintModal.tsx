'use client'

import { useState, useEffect, useMemo } from 'react'
import JsBarcode from 'jsbarcode'
import { XMarkIcon, PrinterIcon, Cog6ToothIcon, MagnifyingGlassIcon, EyeIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
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

interface PrintableItem {
  key: string
  productName: string
  variantName?: string
  variantType?: 'color' | 'shape'
  barcode: string
  colorHex?: string
  imageUrl?: string
  product: Product
}

interface DisplayGroup {
  productId: string
  productName: string
  imageUrl?: string
  product: Product
  mainItem?: PrintableItem
  variantItems: PrintableItem[]
  hasVariants: boolean
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
  const [copies, setCopies] = useState<{[key: string]: number}>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

  // Build flat list of printable items (product barcode + color barcodes + shape barcodes)
  const printableItems = useMemo(() => {
    const items: PrintableItem[] = []

    products.forEach(product => {
      // Main product barcode
      if (product.barcode) {
        items.push({
          key: product.id as string,
          productName: product.name,
          barcode: product.barcode,
          imageUrl: product.main_image_url || undefined,
          product
        })
      }

      // Color variant barcodes
      const colors = (product as any).colors
      if (colors && Array.isArray(colors)) {
        colors.forEach((color: any) => {
          if (color.barcode) {
            items.push({
              key: `${product.id}__color__${color.name}`,
              productName: product.name,
              variantName: color.name,
              variantType: 'color',
              barcode: color.barcode,
              colorHex: color.hex,
              imageUrl: color.image_url || product.main_image_url || undefined,
              product
            })
          }
        })
      }

      // Shape variant barcodes
      const shapes = (product as any).shapes
      if (shapes && Array.isArray(shapes)) {
        shapes.forEach((shape: any) => {
          if (shape.barcode) {
            items.push({
              key: `${product.id}__shape__${shape.name}`,
              productName: product.name,
              variantName: shape.name,
              variantType: 'shape',
              barcode: shape.barcode,
              imageUrl: shape.image_url || product.main_image_url || undefined,
              product
            })
          }
        })
      }
    })

    return items
  }, [products])

  // Initialize copies to 0 for each printable item
  useEffect(() => {
    if (printableItems.length > 0) {
      const initialCopies: {[key: string]: number} = {}
      printableItems.forEach(item => {
        initialCopies[item.key] = 0
      })
      setCopies(initialCopies)
    }
  }, [printableItems])

  // Set first branch as default
  useEffect(() => {
    if (branches.length > 0 && !selectedBranch) {
      setSelectedBranch(branches[0].id)
    }
  }, [branches, selectedBranch])

  const generateBarcodes = () => {
    // Generate barcodes as Canvas images for thermal printers
    let generatedCount = 0
    printableItems.forEach((item) => {
      const numCopies = copies[item.key] || 0

      for (let i = 0; i < numCopies; i++) {
        const canvasId = `barcode-canvas-${item.key}-${i}`
        const imgId = `barcode-img-${item.key}-${i}`

        // Create temporary canvas
        let canvas = document.getElementById(canvasId) as HTMLCanvasElement
        if (!canvas) {
          canvas = document.createElement('canvas')
          canvas.id = canvasId
          canvas.style.display = 'none'
          document.body.appendChild(canvas)
        }

        if (canvas && item.barcode) {
          try {
            // Generate barcode on canvas - optimized for 50x25mm thermal labels
            JsBarcode(canvas, item.barcode, {
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
            console.error(`Error generating barcode for ${item.productName}:`, error)
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
      alert('\u26A0\uFE0F يرجى تحديد عدد النسخ للمنتجات أولاً')
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
      console.log('Generating barcodes for preview...')
      console.log(`Total labels to preview: ${totalLabels}`)
      const count = generateBarcodes()
      console.log(`Generated ${count} barcode preview images`)

      // Wait for images to load and show preview
      setTimeout(() => {
        const images = printContainer.querySelectorAll('img[id^="barcode-img-"]')
        let loadedCount = 0
        images.forEach((img: any) => {
          if (img.complete && img.src) loadedCount++
        })
        console.log(`Preview images loaded: ${loadedCount}/${images.length}`)

        setShowPreview(true)
        // Keep container visible for preview
      }, 600)
    }, 200)
  }

  const handlePrint = () => {
    // Count total labels to print
    const totalLabels = Object.values(copies).reduce((sum, count) => sum + count, 0)

    if (totalLabels === 0) {
      alert('\u26A0\uFE0F يرجى تحديد عدد النسخ للمنتجات أولاً')
      return
    }

    // Make print container visible to generate barcodes
    const printContainer = document.getElementById('barcode-print-container')
    if (!printContainer) {
      console.error('Print container not found')
      alert('خطأ: لم يتم العثور على حاوية الطباعة')
      return
    }

    // Show loading state
    setIsPreparing(true)

    // Make container visible for barcode generation
    console.log('Preparing print container...')
    printContainer.style.display = 'block'
    printContainer.style.visibility = 'visible'

    // Wait for DOM to update
    setTimeout(() => {
      console.log('Generating barcodes as PNG images...')
      console.log(`Total labels: ${totalLabels}`)
      const count = generateBarcodes()
      console.log(`Generated ${count} barcodes`)

      // Wait for images to fully load
      setTimeout(() => {
        // Check if all images are loaded
        const images = printContainer.querySelectorAll('img[id^="barcode-img-"]')
        let loadedCount = 0
        images.forEach((img: any) => {
          if (img.complete && img.src) loadedCount++
        })
        console.log(`Images: ${loadedCount}/${images.length}`)

        if (loadedCount < images.length) {
          console.warn('Not all images loaded!')
        }

        // Create iframe for printing
        console.log('Creating print iframe...')
        const iframe = document.createElement('iframe')
        iframe.style.position = 'absolute'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = 'none'
        document.body.appendChild(iframe)

        const iframeDoc = iframe.contentWindow?.document
        if (!iframeDoc) {
          console.error('Failed to create iframe')
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
          console.log('Printing from iframe...')
          console.log(`Total pages to print: ${totalLabels} (one label per page)`)
          console.log(`Page size: ${currentDimensions.width}mm (width) x ${currentDimensions.height}mm (height)`)

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
            console.log('Cleanup complete')
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

  // Filter printable items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery) return printableItems

    const query = searchQuery.toLowerCase()
    return printableItems.filter(item =>
      item.productName.toLowerCase().includes(query) ||
      (item.variantName && item.variantName.toLowerCase().includes(query)) ||
      item.barcode.toLowerCase().includes(query)
    )
  }, [printableItems, searchQuery])

  // Group filtered items by product for display
  const displayGroups = useMemo(() => {
    const groupMap = new Map<string, DisplayGroup>()

    filteredItems.forEach(item => {
      const productId = item.product.id as string
      if (!groupMap.has(productId)) {
        groupMap.set(productId, {
          productId,
          productName: item.productName,
          imageUrl: item.product.main_image_url || undefined,
          product: item.product,
          mainItem: undefined,
          variantItems: [],
          hasVariants: false
        })
      }

      const group = groupMap.get(productId)!
      if (!item.variantName) {
        group.mainItem = item
      } else {
        group.variantItems.push(item)
      }
    })

    // Determine hasVariants
    groupMap.forEach(group => {
      group.hasVariants = group.variantItems.length > 0
    })

    return Array.from(groupMap.values())
  }, [filteredItems])

  if (!isOpen) return null

  // Dimensions for thermal label printer (50mm x 25mm sticker)
  const dimensions = {
    small: { width: 50, height: 25 },
    large: { width: 50, height: 25 }
  }

  const currentDimensions = dimensions[labelSize]

  // Get display label for an item
  const getItemDisplayName = (item: PrintableItem) => {
    if (item.variantName) {
      return `${item.productName} - ${item.variantName}`
    }
    return item.productName
  }

  // Get label name for print sticker (shorter)
  const getItemStickerName = (item: PrintableItem) => {
    if (item.variantName) {
      return `${item.productName} - ${item.variantName}`
    }
    return item.productName
  }

  // Count total copies for a group
  const getGroupTotalCopies = (group: DisplayGroup) => {
    let total = 0
    if (group.mainItem) total += copies[group.mainItem.key] || 0
    group.variantItems.forEach(v => { total += copies[v.key] || 0 })
    return total
  }

  // Count color and shape variants
  const getVariantCounts = (group: DisplayGroup) => {
    let colorCount = 0
    let shapeCount = 0
    group.variantItems.forEach(v => {
      if (v.variantType === 'color') colorCount++
      if (v.variantType === 'shape') shapeCount++
    })
    return { colorCount, shapeCount }
  }

  const toggleExpanded = (productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

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
                كل استيكر سيطبع على صفحة منفصلة
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
                        <div className="text-xs opacity-75">50x25 مم</div>
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
                        <div className="text-xs opacity-50">50x25 مم</div>
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
                <p className="text-gray-400 text-sm mb-3 text-center">حدد عدد النسخ لكل منتج أو متغير</p>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن منتج أو لون أو شكل بالاسم أو الباركود..."
                    className="w-full pl-4 pr-10 py-3 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Items Grid */}
              <div className="flex-1 p-4 overflow-y-auto scrollbar-hide">
                <div className="grid grid-cols-3 gap-4">
                  {displayGroups.map(group => {
                    const isExpanded = expandedProducts.has(group.productId)
                    const totalCopies = getGroupTotalCopies(group)
                    const { colorCount, shapeCount } = getVariantCounts(group)

                    // Products WITHOUT variants — simple card
                    if (!group.hasVariants && group.mainItem) {
                      const item = group.mainItem
                      const hasQuantity = (copies[item.key] || 0) > 0

                      return (
                        <div
                          key={group.productId}
                          className={`rounded-lg p-3 border-2 transition-all ${
                            hasQuantity
                              ? 'bg-blue-900/30 border-blue-500 shadow-lg shadow-blue-500/20'
                              : 'bg-[#374151] border-[#4A5568]'
                          }`}
                        >
                          {/* Product Image */}
                          <div className="mb-2 relative h-32">
                            <ProductGridImage
                              src={item.imageUrl || item.product.main_image_url}
                              alt={item.productName}
                              priority={false}
                            />
                          </div>

                          {/* Item Info */}
                          <div className="mb-2">
                            <h4 className="text-white text-sm font-bold line-clamp-2 leading-snug min-h-[2.5rem]">
                              {item.productName || 'بدون اسم'}
                            </h4>
                            <p className="text-gray-400 text-[11px] font-mono mt-1 truncate">{item.barcode}</p>
                          </div>

                          {/* Copies Input */}
                          <div>
                            <label className="block text-gray-300 text-xs mb-1">عدد النسخ</label>
                            <input
                              type="number"
                              min="0"
                              value={copies[item.key] || 0}
                              onChange={(e) => setCopies(prev => ({ ...prev, [item.key]: parseInt(e.target.value) || 0 }))}
                              className={`w-full border rounded px-3 py-2 text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                hasQuantity
                                  ? 'bg-blue-600 border-blue-400 text-white'
                                  : 'bg-[#2B3544] border-gray-600 text-white'
                              }`}
                            />
                          </div>
                        </div>
                      )
                    }

                    // Products WITH variants — collapsed card
                    if (group.hasVariants && !isExpanded) {
                      return (
                        <div
                          key={group.productId}
                          className={`rounded-lg p-3 border-2 transition-all ${
                            totalCopies > 0
                              ? 'bg-blue-900/30 border-blue-500 shadow-lg shadow-blue-500/20'
                              : 'bg-[#374151] border-[#4A5568]'
                          }`}
                        >
                          {/* Product Image */}
                          <div className="mb-2 relative h-32">
                            <ProductGridImage
                              src={group.imageUrl || group.product.main_image_url}
                              alt={group.productName}
                              priority={false}
                            />
                          </div>

                          {/* Product Name */}
                          <div className="mb-2">
                            <h4 className="text-white text-base font-bold line-clamp-2 leading-tight mb-1.5">{group.productName || 'بدون اسم'}</h4>

                            {/* Variant Badges */}
                            <div className="flex flex-wrap gap-1.5 mb-1">
                              {colorCount > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-700/50">
                                  {colorCount} لون
                                </span>
                              )}
                              {shapeCount > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/50 text-orange-300 border border-orange-700/50">
                                  {shapeCount} شكل
                                </span>
                              )}
                              {group.mainItem && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300 border border-green-700/50">
                                  رئيسي
                                </span>
                              )}
                            </div>

                            {/* Total copies badge */}
                            {totalCopies > 0 && (
                              <div className="text-xs text-blue-300 font-medium">
                                {totalCopies} نسخة محددة
                              </div>
                            )}
                          </div>

                          {/* "اختار" button */}
                          <button
                            onClick={() => toggleExpanded(group.productId)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <ChevronDownIcon className="h-4 w-4" />
                            اختار
                          </button>
                        </div>
                      )
                    }

                    // Products WITH variants — expanded card (full row)
                    if (group.hasVariants && isExpanded) {
                      return (
                        <div
                          key={group.productId}
                          className="col-span-3 rounded-lg border-2 border-blue-500 bg-[#374151] shadow-lg shadow-blue-500/10 overflow-hidden"
                        >
                          {/* Header */}
                          <div className="flex items-center gap-4 p-4 bg-[#2B3544] border-b border-[#4A5568]">
                            <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                              <ProductGridImage
                                src={group.imageUrl || group.product.main_image_url}
                                alt={group.productName}
                                priority={false}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white text-lg font-bold line-clamp-2 leading-tight">{group.productName}</h4>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {colorCount > 0 && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-700/50">
                                    {colorCount} لون
                                  </span>
                                )}
                                {shapeCount > 0 && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/50 text-orange-300 border border-orange-700/50">
                                    {shapeCount} شكل
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => toggleExpanded(group.productId)}
                              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                            >
                              <ChevronUpIcon className="h-5 w-5" />
                            </button>
                          </div>

                          {/* Main product barcode row */}
                          {group.mainItem && (
                            <div className="px-4 py-3 border-b border-[#4A5568] flex items-center gap-4">
                              <span className="text-xs px-2 py-1 rounded-full bg-green-900/50 text-green-300 border border-green-700/50 flex-shrink-0">
                                رئيسي
                              </span>
                              <p className="text-gray-400 text-sm flex-shrink-0 font-mono">{group.mainItem.barcode}</p>
                              <div className="flex-1" />
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <label className="text-gray-300 text-xs">نسخ</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={copies[group.mainItem.key] || 0}
                                  onChange={(e) => setCopies(prev => ({ ...prev, [group.mainItem!.key]: parseInt(e.target.value) || 0 }))}
                                  className={`w-20 border rounded px-2 py-1.5 text-center font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    (copies[group.mainItem.key] || 0) > 0
                                      ? 'bg-blue-600 border-blue-400 text-white'
                                      : 'bg-[#2B3544] border-gray-600 text-white'
                                  }`}
                                />
                              </div>
                            </div>
                          )}

                          {/* Variants grid */}
                          <div className="p-4">
                            <div className="grid grid-cols-4 gap-3">
                              {group.variantItems.map(item => {
                                const hasQuantity = (copies[item.key] || 0) > 0

                                return (
                                  <div
                                    key={item.key}
                                    className={`rounded-lg p-3 border transition-all ${
                                      hasQuantity
                                        ? 'bg-blue-900/30 border-blue-500'
                                        : 'bg-[#2B3544] border-[#4A5568]'
                                    }`}
                                  >
                                    {/* Variant label */}
                                    <div className="flex items-center gap-1.5 mb-2">
                                      {item.variantType === 'color' && item.colorHex && (
                                        <span
                                          className="w-4 h-4 rounded-full border border-gray-500 flex-shrink-0"
                                          style={{ backgroundColor: item.colorHex }}
                                        />
                                      )}
                                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                                        item.variantType === 'color'
                                          ? 'bg-purple-900/50 text-purple-300'
                                          : 'bg-orange-900/50 text-orange-300'
                                      }`}>
                                        {item.variantType === 'color' ? 'لون' : 'شكل'}
                                      </span>
                                      <span className="text-white text-sm font-medium truncate">{item.variantName}</span>
                                    </div>

                                    {/* Barcode */}
                                    <p className="text-gray-400 text-xs font-mono truncate mb-2">{item.barcode}</p>

                                    {/* Copies input */}
                                    <input
                                      type="number"
                                      min="0"
                                      value={copies[item.key] || 0}
                                      onChange={(e) => setCopies(prev => ({ ...prev, [item.key]: parseInt(e.target.value) || 0 }))}
                                      className={`w-full border rounded px-2 py-1.5 text-center font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        hasQuantity
                                          ? 'bg-blue-600 border-blue-400 text-white'
                                          : 'bg-[#2B3544] border-gray-600 text-white'
                                      }`}
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    }

                    return null
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
                        <span className="text-white text-xl">i</span>
                      </div>
                      <div>
                        <h4 className="text-blue-900 font-bold mb-1">معاينة الملصقات قبل الطباعة</h4>
                        <p className="text-blue-700 text-sm">تم تحويل الباركود إلى صور PNG لضمان جودة طباعة ممتازة على الطابعات الحرارية</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 justify-center">
                    {printableItems.flatMap(item =>
                      Array.from({ length: copies[item.key] || 0 }, (_, index) => {
                        const imgElement = document.getElementById(`barcode-img-${item.key}-${index}`) as HTMLImageElement
                        const imgSrc = imgElement?.src || ''

                        return (
                          <div
                            key={`preview-${item.key}-${index}`}
                            className="border-2 border-gray-400 bg-white shadow-lg overflow-hidden"
                            style={{
                              width: `${currentDimensions.width * 3}px`,
                              height: `${currentDimensions.height * 3}px`
                            }}
                          >
                            {/* Vertical Layout Preview */}
                            <div className="flex flex-col items-center justify-start w-full h-full p-1 gap-0">
                              {/* Top: Product Name + Variant */}
                              {labelSettings.showProductName && (
                                <div className="text-gray-900 text-center w-full mb-0 truncate px-1" style={{ fontSize: '12px', fontWeight: '800' }}>
                                  {getItemStickerName(item)}
                                </div>
                              )}

                              {/* Center: Barcode and Price */}
                              <div className="flex flex-col items-center justify-center w-full" style={{ gap: '0px' }}>
                                {/* Barcode Image */}
                                {labelSettings.showBarcode && item.barcode && imgSrc && (
                                  <img
                                    src={imgSrc}
                                    alt={item.barcode}
                                    className="max-w-full h-auto"
                                    style={{ imageRendering: 'crisp-edges', maxWidth: '90%' }}
                                  />
                                )}

                                {/* Price - Below Barcode */}
                                {labelSettings.showPrice && (
                                  <div className="text-gray-900 text-center w-full" style={{ fontSize: '11px', fontWeight: '800' }}>
                                    {getPrice(item.product).toFixed(2)} LE
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
          {printableItems.flatMap(item =>
            Array.from({ length: copies[item.key] || 0 }, (_, index) => (
              <div key={`${item.key}-${index}`} className="barcode-sticker">
                {/* Vertical Layout: Product Name + Variant → Barcode → Price */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  height: '100%',
                  padding: '0.5mm 2mm'
                }}>

                  {/* Top: Product Name + Variant */}
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
                      {getItemStickerName(item)}
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
                    {labelSettings.showBarcode && item.barcode && (
                      <img
                        id={`barcode-img-${item.key}-${index}`}
                        alt={item.barcode}
                        style={{
                          display: 'block',
                          maxWidth: '90%',
                          height: 'auto',
                          imageRendering: 'crisp-edges'
                        }}
                      />
                    )}

                    {/* Price - Below Barcode */}
                    {labelSettings.showPrice && (
                      <div style={{
                        fontSize: '10pt',
                        fontWeight: '800',
                        color: '#000',
                        textAlign: 'center',
                        width: '100%',
                        fontFamily: 'Arial, sans-serif'
                      }}>
                        {getPrice(item.product).toFixed(2)} LE
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
