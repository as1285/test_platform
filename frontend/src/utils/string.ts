/**
 * 字符串处理工具函数
 */

/**
 * 生成随机字符串
 * @param length 字符串长度，默认为8
 * @returns 随机字符串
 */
export const generateRandomString = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 截断字符串
 * @param str 原始字符串
 * @param maxLength 最大长度，默认为50
 * @param suffix 后缀，默认为 '...'
 * @returns 截断后的字符串
 */
export const truncateString = (str: string, maxLength: number = 50, suffix: string = '...'): string => {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength - suffix.length) + suffix
}

/**
 * 首字母大写
 * @param str 原始字符串
 * @returns 首字母大写后的字符串
 */
export const capitalize = (str: string): string => {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * 驼峰转连字符
 * @param str 驼峰字符串
 * @returns 连字符字符串
 */
export const camelToKebab = (str: string): string => {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * 连字符转驼峰
 * @param str 连字符字符串
 * @returns 驼峰字符串
 */
export const kebabToCamel = (str: string): string => {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
}