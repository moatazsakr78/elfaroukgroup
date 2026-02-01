'use client'

import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface SimpleDateFilterModalProps {
  isOpen: boolean
  onClose: () => void
  onDateFilterChange: (filter: DateFilter) => void
  currentFilter: DateFilter
}

export interface DateFilter {
  type: 'all' | 'today' | 'current_week' | 'current_month' | 'last_week' | 'last_month' | 'custom'
  startDate?: Date
  endDate?: Date
}

export default function SimpleDateFilterModal({ isOpen, onClose, onDateFilterChange, currentFilter }: SimpleDateFilterModalProps) {
  const [selectedFilter, setSelectedFilter] = useState<DateFilter['type']>(currentFilter.type)
  const [customStartDate, setCustomStartDate] = useState<Date | null>(currentFilter.startDate || null)
  const [customEndDate, setCustomEndDate] = useState<Date | null>(currentFilter.endDate || null)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  if (!isOpen) return null

  // Handle filter button click with toggle functionality
  const handleFilterClick = (filterType: DateFilter['type']) => {
    if (selectedFilter === filterType) {
      // Toggle off - return to 'all'
      setSelectedFilter('all')
    } else {
      setSelectedFilter(filterType)
      // Reset custom dates when switching away from custom
      if (filterType !== 'custom') {
        setCustomStartDate(null)
        setCustomEndDate(null)
      }
    }
  }

  const handleApply = () => {
    let filter: DateFilter = { type: selectedFilter }

    if (selectedFilter === 'custom') {
      filter.startDate = customStartDate || undefined
      // إذا لم يكن هناك endDate، استخدم startDate (يوم واحد)
      filter.endDate = customEndDate || customStartDate || undefined
    }

    onDateFilterChange(filter)
    onClose()
  }

  const handleCancel = () => {
    setSelectedFilter(currentFilter.type)
    setCustomStartDate(currentFilter.startDate || null)
    setCustomEndDate(currentFilter.endDate || null)
    onClose()
  }

  // Clear all selections and return to 'all'
  const handleClearAll = () => {
    setSelectedFilter('all')
    setCustomStartDate(null)
    setCustomEndDate(null)
    onDateFilterChange({ type: 'all' })
    onClose()
  }

  // Calendar navigation
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev)
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1)
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1)
      }
      return newMonth
    })
  }

  // Generate calendar days
  const generateCalendarDays = () => {
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const startDate = new Date(firstDayOfMonth)
    
    // Get to Sunday (start of week)
    startDate.setDate(startDate.getDate() - startDate.getDay())
    
    const days = []
    const current = new Date(startDate)
    
    // Generate 6 weeks of days
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    
    return days
  }

  const calendarDays = generateCalendarDays()
  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ]

  const isDateSelected = (date: Date) => {
    return (customStartDate && date.toDateString() === customStartDate.toDateString()) ||
           (customEndDate && date.toDateString() === customEndDate.toDateString())
  }

  const isDateInRange = (date: Date) => {
    if (!customStartDate || !customEndDate) return false
    return date >= customStartDate && date <= customEndDate
  }

  const handleDateClick = (date: Date) => {
    const isStartDate = customStartDate && date.toDateString() === customStartDate.toDateString()
    const isEndDate = customEndDate && date.toDateString() === customEndDate.toDateString()

    // Toggle: إذا ضغط على تاريخ محدد، يتم إلغاؤه
    if (isStartDate && isEndDate) {
      // نفس اليوم محدد كبداية ونهاية (يوم واحد) → إلغاء الكل
      setCustomStartDate(null)
      setCustomEndDate(null)
      setSelectedFilter('all')
      return
    }

    if (isStartDate) {
      // إلغاء تاريخ البداية
      if (customEndDate) {
        // إذا كان هناك تاريخ نهاية، يصبح هو البداية
        setCustomStartDate(customEndDate)
        setCustomEndDate(null)
      } else {
        // لا يوجد نهاية، إلغاء الكل
        setCustomStartDate(null)
        setSelectedFilter('all')
      }
      return
    }

    if (isEndDate) {
      // إلغاء تاريخ النهاية فقط
      setCustomEndDate(null)
      return
    }

    // تاريخ جديد غير محدد
    if (!customStartDate) {
      // لا يوجد بداية، هذا التاريخ يصبح البداية
      setCustomStartDate(date)
      setSelectedFilter('custom')
    } else if (!customEndDate) {
      // يوجد بداية فقط، هذا التاريخ يصبح النهاية
      if (date >= customStartDate) {
        setCustomEndDate(date)
      } else {
        // التاريخ قبل البداية، يصبح هو البداية والقديم يصبح النهاية
        setCustomEndDate(customStartDate)
        setCustomStartDate(date)
      }
    } else {
      // يوجد بداية ونهاية، بدء تحديد جديد
      setCustomStartDate(date)
      setCustomEndDate(null)
      setSelectedFilter('custom')
    }
  }

  // Get formatted date range text
  const getDateRangeText = () => {
    if (selectedFilter === 'all') return 'جميع الفواتير'
    if (selectedFilter === 'today') return 'اليوم'
    if (selectedFilter === 'current_week') return 'الأسبوع الحالي'
    if (selectedFilter === 'last_week') return 'الأسبوع الماضي'
    if (selectedFilter === 'current_month') return 'الشهر الحالي'
    if (selectedFilter === 'last_month') return 'الشهر الماضي'
    
    if (selectedFilter === 'custom') {
      if (customStartDate && customEndDate) {
        const formatDate = (date: Date) => {
          return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
        }
        // إذا كان نفس اليوم، أظهر تاريخ واحد فقط
        if (customStartDate.toDateString() === customEndDate.toDateString()) {
          return formatDate(customStartDate)
        }
        return `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`
      }
      if (customStartDate) {
        const formatDate = (date: Date) => {
          return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
        }
        return `من ${formatDate(customStartDate)}`
      }
    }
    
    return 'حدد نطاق التاريخ'
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#2B3544] border border-gray-600 rounded-lg shadow-xl z-50 w-[95vw] max-w-[580px] max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-[#374151] border-b border-gray-600 px-3 sm:px-6 py-3 sm:py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium text-lg">التاريخ</h3>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-white text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-600/30 transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-6">
          {/* Date Range Display */}
          <div className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded text-center font-medium text-sm sm:text-base mb-4 sm:mb-6">
            {getDateRangeText()}
          </div>

          {/* Quick Filter Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
            <button
              onClick={() => handleFilterClick('today')}
              className={`p-2 sm:p-3 rounded text-xs sm:text-sm font-medium border transition-colors ${
                selectedFilter === 'today'
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#374151] text-gray-300 border-gray-600 hover:bg-gray-600'
              }`}
            >
              اليوم
            </button>

            <button
              onClick={() => handleFilterClick('current_week')}
              className={`p-2 sm:p-3 rounded text-xs sm:text-sm font-medium border transition-colors ${
                selectedFilter === 'current_week'
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#374151] text-gray-300 border-gray-600 hover:bg-gray-600'
              }`}
            >
              الأسبوع الحالي
            </button>

            <button
              onClick={() => handleFilterClick('current_month')}
              className={`p-2 sm:p-3 rounded text-xs sm:text-sm font-medium border transition-colors ${
                selectedFilter === 'current_month'
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#374151] text-gray-300 border-gray-600 hover:bg-gray-600'
              }`}
            >
              الشهر الحالي
            </button>

            <button
              onClick={() => handleFilterClick('last_week')}
              className={`p-2 sm:p-3 rounded text-xs sm:text-sm font-medium border transition-colors ${
                selectedFilter === 'last_week'
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#374151] text-gray-300 border-gray-600 hover:bg-gray-600'
              }`}
            >
              الأسبوع الماضي
            </button>

            <button
              onClick={() => handleFilterClick('last_month')}
              className={`p-2 sm:p-3 rounded text-xs sm:text-sm font-medium border transition-colors ${
                selectedFilter === 'last_month'
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#374151] text-gray-300 border-gray-600 hover:bg-gray-600'
              }`}
            >
              الشهر الماضي
            </button>

            <button
              onClick={() => handleFilterClick('custom')}
              className={`p-2 sm:p-3 rounded text-xs sm:text-sm font-medium border transition-colors ${
                selectedFilter === 'custom'
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#374151] text-gray-300 border-gray-600 hover:bg-gray-600'
              }`}
            >
              فترة مخصصة
            </button>
          </div>

          {/* Calendar for Date Range Selection - Always visible */}
          <div className="space-y-4">
            <h5 className="text-white font-medium text-center">التاريخ</h5>
            
            {/* Calendar */}
            <div className="bg-[#374151] border border-gray-600 rounded p-4">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4">
                <button 
                  onClick={() => navigateMonth('next')}
                  className="p-1 hover:bg-gray-600 rounded transition-colors"
                >
                  <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                </button>
                
                <h6 className="text-white font-medium">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h6>
                
                <button 
                  onClick={() => navigateMonth('prev')}
                  className="p-1 hover:bg-gray-600 rounded transition-colors"
                >
                  <ChevronLeftIcon className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                  <div key={day} className="text-center text-gray-400 text-sm py-2 font-medium">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date, index) => {
                  const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
                  const isToday = date.toDateString() === new Date().toDateString()
                  const isSelected = isDateSelected(date)
                  const isInRange = isDateInRange(date)
                  
                  return (
                    <button
                      key={index}
                      onClick={() => handleDateClick(date)}
                      className={`
                        p-2 text-sm rounded transition-all duration-150 min-h-[36px]
                        ${!isCurrentMonth 
                          ? 'text-gray-500 hover:text-gray-400' 
                          : isSelected
                          ? 'bg-blue-600 text-white font-bold'
                          : isInRange
                          ? 'bg-blue-600/30 text-blue-300'
                          : isToday
                          ? 'text-yellow-400 font-bold'
                          : 'text-white hover:bg-gray-600'
                        }
                      `}
                    >
                      {date.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selection Instructions */}
            <div className="text-center text-gray-400 text-sm">
              {!customStartDate && 'اضغط على تاريخ لتحديده'}
              {customStartDate && !customEndDate && 'اضغط على تاريخ آخر لتحديد فترة، أو اضغط على نفس التاريخ لإلغائه'}
              {customStartDate && customEndDate && 'اضغط على أي تاريخ محدد لإلغائه، أو اضغط على تاريخ جديد لبدء تحديد جديد'}
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="bg-[#374151] border-t border-gray-600 px-3 sm:px-6 py-3 sm:py-4 rounded-b-lg">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-between">
            {/* Clear All Button */}
            <button
              onClick={handleClearAll}
              className="px-4 sm:px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-sm sm:text-base order-last sm:order-first"
            >
              إلغاء التحديد
            </button>

            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors text-sm sm:text-base"
              >
                إلغاء
              </button>
              <button
                onClick={handleApply}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-sm sm:text-base"
              >
                موافق
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}