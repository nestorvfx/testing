/**
 * Speech Logger - Specialized logging for speech recognition
 * Provides comprehensive logging and debugging for speech operations
 */

// Log levels
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

class SpeechLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 200;
    this.listeners = [];
    this.consoleMirror = true;
    this.persistToStorage = false;
    
    // Add timestamp of logger creation
    this.log('Speech Logger initialized', { time: new Date().toISOString() });
  }
  
  /**
   * Create a log entry with details
   * @param {string} message - Log message
   * @param {Object} data - Optional data to include
   * @param {string} level - Log level (debug, info, warn, error)
   * @returns {Object} The created log entry
   */
  log(message, data = null, level = LOG_LEVELS.INFO) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data ? JSON.stringify(data) : null
    };
    
    // Add to in-memory logs
    this.logs.unshift(logEntry);
    
    // Trim logs if they exceed max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    
    // Mirror to console if enabled
    if (this.consoleMirror) {
      const consoleMessage = `[SpeechLog] ${message}${data ? ': ' + JSON.stringify(data) : ''}`;
      
      switch (level) {
        case LOG_LEVELS.ERROR:
          console.error(consoleMessage);
          break;
        case LOG_LEVELS.WARN:
          console.warn(consoleMessage);
          break;
        case LOG_LEVELS.DEBUG:
          console.debug(consoleMessage);
          break;
        default:
          console.log(consoleMessage);
      }
    }
    
    // Notify all listeners
    this.notifyListeners(logEntry);
    
    return logEntry;
  }
  
  /**
   * Log with specific levels
   */
  debug(message, data = null) {
    return this.log(message, data, LOG_LEVELS.DEBUG);
  }
  
  info(message, data = null) {
    return this.log(message, data, LOG_LEVELS.INFO);
  }
  
  warn(message, data = null) {
    return this.log(message, data, LOG_LEVELS.WARN);
  }
  
  error(message, data = null) {
    return this.log(message, data, LOG_LEVELS.ERROR);
  }
  
  /**
   * Get all logs or filtered logs
   * @param {Object} options - Filter options
   * @param {string} options.level - Filter by log level
   * @param {number} options.limit - Limit number of logs returned
   * @param {string} options.search - Search string in message
   * @returns {Array} Filtered logs
   */
  getLogs(options = {}) {
    let filteredLogs = [...this.logs];
    
    // Filter by level if specified
    if (options.level && options.level !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level === options.level);
    }
    
    // Filter by search term if specified
    if (options.search) {
      const searchTerm = options.search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchTerm) || 
        (log.data && log.data.toLowerCase().includes(searchTerm))
      );
    }
    
    // Apply limit if specified
    if (options.limit) {
      filteredLogs = filteredLogs.slice(0, options.limit);
    }
    
    return filteredLogs;
  }
  
  /**
   * Add a listener for new log entries
   * @param {Function} callback - Function to call with new log entries
   * @returns {Function} Function to remove the listener
   */
  addListener(callback) {
    if (typeof callback !== 'function') {
      console.error('Speech Logger: Listener must be a function');
      return () => {};
    }
    
    this.listeners.push(callback);
    
    // Return a function to remove this listener
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }
  
  /**
   * Notify all listeners of a new log entry
   * @param {Object} logEntry - The log entry
   */
  notifyListeners(logEntry) {
    this.listeners.forEach(listener => {
      try {
        listener(logEntry);
      } catch (e) {
        console.error('Speech Logger: Error in listener', e);
      }
    });
  }
  
  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    this.log('Logs cleared');
  }
  
  /**
   * Enable or disable console mirroring
   * @param {boolean} enabled - Whether to mirror logs to console
   */
  setConsoleMirror(enabled) {
    this.consoleMirror = !!enabled;
    this.log(`Console mirroring ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Get statistics about the logs
   * @returns {Object} Statistics object
   */
  getStats() {
    const total = this.logs.length;
    const byLevel = {
      [LOG_LEVELS.DEBUG]: this.logs.filter(log => log.level === LOG_LEVELS.DEBUG).length,
      [LOG_LEVELS.INFO]: this.logs.filter(log => log.level === LOG_LEVELS.INFO).length,
      [LOG_LEVELS.WARN]: this.logs.filter(log => log.level === LOG_LEVELS.WARN).length,
      [LOG_LEVELS.ERROR]: this.logs.filter(log => log.level === LOG_LEVELS.ERROR).length
    };
    
    return {
      total,
      byLevel,
      firstLog: this.logs.length ? this.logs[this.logs.length - 1] : null,
      lastLog: this.logs.length ? this.logs[0] : null
    };
  }
}

// Create a singleton instance
const speechLogger = new SpeechLogger();

export default speechLogger;
