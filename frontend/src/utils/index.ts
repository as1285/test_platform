/**
 * 工具函数入口文件
 */

export * from './date'
export * from './number'
export * from './string'

/**
 * 防抖函数
 * @param func 要执行的函数
 * @param wait 等待时间，默认为300ms
 * @returns 防抖处理后的函数
 */
export const debounce = <T extends (...args: any[]) => any>(func: T, wait: number = 300): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

/**
 * 节流函数
 * @param func 要执行的函数
 * @param wait 等待时间，默认为300ms
 * @returns 节流处理后的函数
 */
export const throttle = <T extends (...args: any[]) => any>(func: T, wait: number = 300): ((...args: Parameters<T>) => void) => {
  let lastTime = 0
  
  return (...args: Parameters<T>) => {
    const currentTime = Date.now()
    if (currentTime - lastTime >= wait) {
      func(...args)
      lastTime = currentTime
    }
  }
}

/**
 * 深拷贝对象
 * @param obj 要拷贝的对象
 * @returns 拷贝后的对象
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as any
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any
  if (typeof obj === 'object') {
    const clonedObj = {} as T
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }
  return obj
}

/**
 * 检查对象是否为空
 * @param obj 要检查的对象
 * @returns 是否为空
 */
export const isEmpty = (obj: any): boolean => {
  if (obj === null || obj === undefined) return true
  if (typeof obj === 'string') return obj.trim() === ''
  if (Array.isArray(obj)) return obj.length === 0
  if (typeof obj === 'object') return Object.keys(obj).length === 0
  return false
}

/**
 * 下载文件
 * @param data 文件数据
 * @param filename 文件名
 * @param type 文件类型
 */
export const downloadFile = (data: any, filename: string, type: string = 'application/octet-stream'): void => {
  const blob = new Blob([data], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}