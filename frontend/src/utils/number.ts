/**
 * 数字格式化工具函数
 */

/**
 * 格式化数字为千分位格式
 * @param num 数字
 * @returns 格式化后的数字字符串
 */
export const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 格式化百分比
 * @param num 数字
 * @param decimals 小数位数，默认为2
 * @returns 格式化后的百分比字符串
 */
export const formatPercent = (num: number, decimals: number = 2): string => {
  return `${(num * 100).toFixed(decimals)}%`
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @param decimals 小数位数，默认为2
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * 限制数字在指定范围内
 * @param num 数字
 * @param min 最小值
 * @param max 最大值
 * @returns 限制后的数字
 */
export const clamp = (num: number, min: number, max: number): number => {
  return Math.min(Math.max(num, min), max)
}