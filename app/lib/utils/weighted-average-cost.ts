/**
 * دالة حساب متوسط التكلفة المرجح للمنتجات
 * Weighted Average Cost Calculator for Products
 */

export interface WeightedAverageCostParams {
  current_stock_quantity: number;
  current_cost_per_unit: number;
  new_purchase_quantity: number;
  new_purchase_unit_cost: number;
}

export interface WeightedAverageCostResult {
  updated_cost_per_unit: number;
  total_quantity: number;
  total_cost: number;
}

/**
 * حساب متوسط التكلفة المرجح بعد شراء جديد
 * Calculate weighted average cost after new purchase
 *
 * ✨ تحسين: لو سعر الشراء الحالي = 0 أو المخزون = 0، نستخدم السعر الجديد مباشرة
 *
 * Formula:
 * updated_cost_per_unit =
 *   (current_stock_quantity * current_cost_per_unit +
 *    new_purchase_quantity * new_purchase_unit_cost)
 *   / (current_stock_quantity + new_purchase_quantity)
 */
export function calculateWeightedAverageCost({
  current_stock_quantity,
  current_cost_per_unit,
  new_purchase_quantity,
  new_purchase_unit_cost,
}: WeightedAverageCostParams): WeightedAverageCostResult {
  // التحقق من صحة المدخلات
  if (current_stock_quantity < 0 || new_purchase_quantity <= 0) {
    throw new Error('Invalid quantities: stock cannot be negative and purchase must be positive');
  }

  if (current_cost_per_unit < 0 || new_purchase_unit_cost < 0) {
    throw new Error('Invalid costs: costs cannot be negative');
  }

  // ✨ حالة خاصة: لو سعر الشراء الحالي = 0 أو المخزون = 0
  // نستخدم سعر الشراء الجديد مباشرة بدون Average
  // هذا يمنع المشكلة: (0 + 210) / 2 = 105
  if (current_cost_per_unit === 0 || current_stock_quantity === 0) {
    const total_quantity = current_stock_quantity + new_purchase_quantity;
    const total_cost = new_purchase_quantity * new_purchase_unit_cost;

    return {
      updated_cost_per_unit: new_purchase_unit_cost,
      total_quantity,
      total_cost,
    };
  }

  // حساب التكلفة الإجمالية الحالية
  const current_total_cost = current_stock_quantity * current_cost_per_unit;

  // حساب تكلفة الشراء الجديد
  const new_purchase_total_cost = new_purchase_quantity * new_purchase_unit_cost;

  // الكمية الإجمالية بعد الشراء
  const total_quantity = current_stock_quantity + new_purchase_quantity;

  // التكلفة الإجمالية بعد الشراء
  const total_cost = current_total_cost + new_purchase_total_cost;

  // حساب متوسط التكلفة المرجح (مقرب لمنزلتين عشريتين)
  const updated_cost_per_unit = Math.round((total_cost / total_quantity) * 100) / 100;

  return {
    updated_cost_per_unit,
    total_quantity,
    total_cost,
  };
}

/**
 * مثال على الاستخدام
 * Example usage
 */
export function exampleUsage() {
  const params: WeightedAverageCostParams = {
    current_stock_quantity: 50,
    current_cost_per_unit: 17,
    new_purchase_quantity: 200,
    new_purchase_unit_cost: 14,
  };

  const result = calculateWeightedAverageCost(params);
  
  console.log('Example calculation:');
  console.log(`Current stock: ${params.current_stock_quantity} units @ ${params.current_cost_per_unit} each`);
  console.log(`New purchase: ${params.new_purchase_quantity} units @ ${params.new_purchase_unit_cost} each`);
  console.log(`Updated cost per unit: ${result.updated_cost_per_unit}`);
  console.log(`Total quantity: ${result.total_quantity}`);
  console.log(`Total cost: ${result.total_cost}`);
  
  // Expected result: 14.58
  return result;
}