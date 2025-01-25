type LogLevel = "debug" | "info" | "warn" | "error";

interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: any;
}

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private log(level: LogLevel, message: string, data?: any) {
    const logMessage: LogMessage = {
      level,
      message,
      timestamp: this.getTimestamp(),
      data,
    };

    switch (level) {
      case "debug":
        console.debug(`[${logMessage.timestamp}] [DEBUG]`, message, data || "");
        break;
      case "info":
        console.info(`[${logMessage.timestamp}] [INFO]`, message, data || "");
        break;
      case "warn":
        console.warn(`[${logMessage.timestamp}] [WARN]`, message, data || "");
        break;
      case "error":
        console.error(`[${logMessage.timestamp}] [ERROR]`, message, data || "");
        break;
    }
  }

  debug(message: string, data?: any) {
    this.log("debug", message, data);
  }

  info(message: string, data?: any) {
    this.log("info", message, data);
  }

  warn(message: string, data?: any) {
    this.log("warn", message, data);
  }

  error(message: string, data?: any) {
    this.log("error", message, data);
  }
}

const logger = new Logger();
export default logger;
