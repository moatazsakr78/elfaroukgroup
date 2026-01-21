import { DateFilter } from '../../components/SimpleDateFilterModal'

/**
 * Calculates the date range based on the filter type
 * Used for database queries and client-side filtering
 */
export function getDateRangeFromFilter(filter: DateFilter): {
  startDate: Date | null
  endDate: Date | null
} {
  const now = new Date()

  switch (filter.type) {
    case 'today': {
      const startOfDay = new Date(now)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(now)
      endOfDay.setHours(23, 59, 59, 999)
      return { startDate: startOfDay, endDate: endOfDay }
    }

    case 'current_week': {
      // Week starts on Saturday in Arabic calendar
      const dayOfWeek = now.getDay()
      const daysToSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1

      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - daysToSaturday)
      startOfWeek.setHours(0, 0, 0, 0)

      const endOfWeek = new Date(now)
      endOfWeek.setHours(23, 59, 59, 999)

      return { startDate: startOfWeek, endDate: endOfWeek }
    }

    case 'last_week': {
      const dayOfWeek = now.getDay()
      const daysToSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1

      const lastWeekStart = new Date(now)
      lastWeekStart.setDate(now.getDate() - daysToSaturday - 7)
      lastWeekStart.setHours(0, 0, 0, 0)

      const lastWeekEnd = new Date(lastWeekStart)
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6)
      lastWeekEnd.setHours(23, 59, 59, 999)

      return { startDate: lastWeekStart, endDate: lastWeekEnd }
    }

    case 'current_month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      startOfMonth.setHours(0, 0, 0, 0)

      const endOfMonth = new Date(now)
      endOfMonth.setHours(23, 59, 59, 999)

      return { startDate: startOfMonth, endDate: endOfMonth }
    }

    case 'last_month': {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      lastMonthStart.setHours(0, 0, 0, 0)

      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      lastMonthEnd.setHours(23, 59, 59, 999)

      return { startDate: lastMonthStart, endDate: lastMonthEnd }
    }

    case 'custom': {
      let startDate: Date | null = null
      let endDate: Date | null = null

      if (filter.startDate) {
        startDate = new Date(filter.startDate)
        startDate.setHours(0, 0, 0, 0)
      }

      if (filter.endDate) {
        endDate = new Date(filter.endDate)
        endDate.setHours(23, 59, 59, 999)
      }

      return { startDate, endDate }
    }

    case 'all':
    default:
      return { startDate: null, endDate: null }
  }
}

/**
 * Returns a human-readable label for the date filter
 */
export function getDateFilterLabel(filter: DateFilter): string {
  switch (filter.type) {
    case 'today':
      return 'اليوم'
    case 'current_week':
      return 'هذا الأسبوع'
    case 'current_month':
      return 'هذا الشهر'
    case 'last_week':
      return 'الأسبوع الماضي'
    case 'last_month':
      return 'الشهر الماضي'
    case 'custom':
      return 'فترة مخصصة'
    case 'all':
      return 'جميع الفترات'
    default:
      return 'تصفية التاريخ'
  }
}
