/**
 * 日期格式化工具函数
 */

/**
 * 格式化日期为指定格式
 * @param date 日期对象或时间戳
 * @param format 格式化字符串，默认为 'YYYY-MM-DD HH:mm:ss'
 * @returns 格式化后的日期字符串
 */
export const formatDate = (date: Date | number | string, format: string = 'YYYY-MM-DD HH:mm:ss'): string => {
  const d = new Date(date)
  
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  
  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

/**
 * 获取当前日期时间
 * @returns 当前日期时间字符串
 */
export const getCurrentDateTime = (): string => {
  return formatDate(new Date())
}

/**
 * 计算两个日期之间的时间差
 * @param start 开始日期
 * @param end 结束日期
 * @returns 时间差对象
 */
export const getDateDiff = (start: Date | number | string, end: Date | number | string): {
  days: number
  hours: number
  minutes: number
  seconds: number
} => {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diff = endDate.getTime() - startDate.getTime()
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  
  return { days, hours, minutes, seconds }
}