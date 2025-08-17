/**
 * 全局错误处理器
 *
 * 用于处理应用程序中的全局错误，包括队列错误、渲染器错误等
 */

export type ErrorHandler = (error: Error, context?: string) => void;

let globalErrorHandler: ErrorHandler | null = null;

/**
 * 设置全局错误处理器
 */
export function setGlobalErrorHandler(handler: ErrorHandler): void {
  globalErrorHandler = handler;
}

/**
 * 报告全局错误
 */
export function reportGlobalError(error: Error | unknown, context?: string): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  // 总是记录到控制台
  console.error(`💥 全局错误${context ? ` (${context})` : ''}:`, errorObj);

  // 调用全局错误处理器
  if (globalErrorHandler) {
    try {
      globalErrorHandler(errorObj, context);
    } catch (handlerError) {
      console.error('💥 错误处理器本身发生错误:', handlerError);
    }
  }
}

/**
 * 创建一个带有上下文的错误报告函数
 */
export function createErrorReporter(context: string) {
  return (error: Error | unknown) => reportGlobalError(error, context);
}