/**
 * PDF Export Utility for Inventory
 * Uses jsPDF + jsPDF-AutoTable for generating PDF reports
 * Supports RTL (Arabic) and images
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Product } from '../../../lib/hooks/useProductsAdmin'

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable
  }
}

// Export column options
export interface PDFExportColumn {
  id: string
  label: string
  enabled: boolean
}

// Price type options
export type PriceType = 'price' | 'wholesale_price' | 'cost_price' | 'price1' | 'price2' | 'price3' | 'price4'

// PDF Export options
export interface PDFExportOptions {
  columns: PDFExportColumn[]
  priceType: PriceType
  includeImages: boolean
  title?: string
}

// Available columns for export
export const EXPORT_COLUMNS: PDFExportColumn[] = [
  { id: 'index', label: '#', enabled: true },
  { id: 'product_code', label: 'كود الصنف', enabled: true },
  { id: 'name', label: 'إسم الصنف', enabled: true },
  { id: 'price', label: 'السعر', enabled: true },
  { id: 'quantity_per_carton', label: 'القطع بالكرتونة', enabled: true },
  { id: 'main_image_url', label: 'صورة الصنف', enabled: true },
  { id: 'barcode', label: 'الباركود', enabled: false },
  { id: 'totalQuantity', label: 'الكمية', enabled: false },
  { id: 'category', label: 'المجموعة', enabled: false },
]

// Price options with labels
export const PRICE_OPTIONS: { value: PriceType; label: string }[] = [
  { value: 'price', label: 'سعر البيع' },
  { value: 'wholesale_price', label: 'سعر الجملة' },
  { value: 'cost_price', label: 'سعر الشراء' },
  { value: 'price1', label: 'سعر 1' },
  { value: 'price2', label: 'سعر 2' },
  { value: 'price3', label: 'سعر 3' },
  { value: 'price4', label: 'سعر 4' },
]

/**
 * Convert image URL to base64 data URL
 */
async function imageToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      mode: 'cors',
      cache: 'no-cache'
    })

    if (!response.ok) {
      console.warn(`Failed to fetch image: ${url}`)
      return null
    }

    const blob = await response.blob()

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.warn(`Error converting image to base64: ${url}`, error)
    return null
  }
}

/**
 * Generate inventory PDF report
 */
export async function generateInventoryPDF(
  products: Product[],
  options: PDFExportOptions,
  onProgress?: (current: number, total: number, productName: string) => void
): Promise<void> {
  // Create PDF document (A4 landscape for more columns)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  })

  // Get enabled columns in order
  const enabledColumns = options.columns.filter(col => col.enabled)

  // Build table headers (RTL - reverse order for Arabic)
  const headers = enabledColumns.map(col => col.label).reverse()

  // Prepare image cache for better performance
  const imageCache: Map<string, string | null> = new Map()

  // Pre-fetch images if needed
  if (options.includeImages && enabledColumns.some(col => col.id === 'main_image_url')) {
    console.log('📸 Pre-fetching images...')
    const imageUrls = products
      .map(p => p.main_image_url)
      .filter((url): url is string => !!url)

    const uniqueUrls = Array.from(new Set(imageUrls))

    for (let i = 0; i < uniqueUrls.length; i++) {
      const url = uniqueUrls[i]
      onProgress?.(i + 1, uniqueUrls.length, 'تحميل الصور...')

      const base64 = await imageToBase64(url)
      imageCache.set(url, base64)
    }
  }

  // Build table body
  const body: any[][] = []

  for (let i = 0; i < products.length; i++) {
    const product = products[i]
    onProgress?.(i + 1, products.length, product.name)

    const row: any[] = []

    for (const col of enabledColumns) {
      switch (col.id) {
        case 'index':
          row.push(i + 1)
          break
        case 'product_code':
          row.push(product.product_code || '-')
          break
        case 'name':
          row.push(product.name || '-')
          break
        case 'price':
          const priceValue = product[options.priceType] || 0
          row.push(priceValue.toFixed(2))
          break
        case 'quantity_per_carton':
          row.push(product.quantity_per_carton || '-')
          break
        case 'main_image_url':
          // Will be handled separately by cell styling
          row.push('')
          break
        case 'barcode':
          row.push(product.barcode || '-')
          break
        case 'totalQuantity':
          row.push(product.totalQuantity || 0)
          break
        case 'category':
          row.push(product.category?.name || '-')
          break
        default:
          row.push('-')
      }
    }

    // Reverse for RTL
    body.push(row.reverse())
  }

  // Add title
  const title = options.title || 'جرد المخزون - El Farouk Group'
  const date = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  // Title styling
  doc.setFontSize(18)
  doc.setTextColor(43, 53, 68) // #2B3544
  doc.text(title, doc.internal.pageSize.getWidth() - 14, 15, { align: 'right' })

  // Date
  doc.setFontSize(12)
  doc.setTextColor(107, 114, 128) // Gray
  doc.text(`التاريخ: ${date}`, doc.internal.pageSize.getWidth() - 14, 22, { align: 'right' })

  // Find image column index (after reversal for RTL)
  const imageColIndex = enabledColumns.findIndex(col => col.id === 'main_image_url')
  const reversedImageColIndex = imageColIndex >= 0 ? enabledColumns.length - 1 - imageColIndex : -1

  // Calculate column widths
  const pageWidth = doc.internal.pageSize.getWidth() - 28 // margins
  const colCount = enabledColumns.length

  // Define column widths based on content type
  const columnStyles: { [key: number]: { cellWidth: number } } = {}
  enabledColumns.forEach((col, idx) => {
    const reversedIdx = enabledColumns.length - 1 - idx
    let width = pageWidth / colCount // Default equal width

    if (col.id === 'main_image_url') {
      width = 25 // Fixed width for images
    } else if (col.id === 'name') {
      width = 50 // Wider for product names
    } else if (col.id === 'index') {
      width = 12 // Narrow for index
    }

    columnStyles[reversedIdx] = { cellWidth: width }
  })

  // Generate table
  autoTable(doc, {
    head: [headers],
    body: body,
    startY: 28,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3,
      halign: 'center',
      valign: 'middle',
      textColor: [255, 255, 255],
      lineColor: [74, 85, 104],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [43, 53, 68], // #2B3544
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fillColor: [55, 65, 81], // #374151
      textColor: [255, 255, 255],
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [43, 53, 68] // #2B3544
    },
    columnStyles,
    didDrawCell: function(data) {
      // Add images to image cells
      if (data.section === 'body' && reversedImageColIndex >= 0 && data.column.index === reversedImageColIndex) {
        const productIndex = data.row.index
        const product = products[productIndex]

        if (product.main_image_url && options.includeImages) {
          const base64 = imageCache.get(product.main_image_url)

          if (base64) {
            try {
              const imgWidth = 18
              const imgHeight = 18
              const x = data.cell.x + (data.cell.width - imgWidth) / 2
              const y = data.cell.y + (data.cell.height - imgHeight) / 2

              doc.addImage(base64, 'JPEG', x, y, imgWidth, imgHeight)
            } catch (error) {
              console.warn('Error adding image to PDF:', error)
            }
          }
        }
      }
    },
    // Increase row height when images are included
    rowPageBreak: 'avoid',
    didParseCell: function(data) {
      if (reversedImageColIndex >= 0 && data.column.index === reversedImageColIndex && data.section === 'body') {
        // Make rows taller to accommodate images
        data.cell.styles.minCellHeight = 22
      }
    }
  })

  // Add page numbers
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text(
      `صفحة ${i} من ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  // Save the PDF
  const fileName = `inventory-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)

  console.log(`✅ PDF generated: ${fileName}`)
}
