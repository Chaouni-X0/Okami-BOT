
import fs from 'fs';
import path from 'path';

class Logger {
    constructor() {
        this.logs = [];
        this.maxLogs = 500;
        this.onLogListeners = [];
    }

    // Core logging method
    addLog(logEntry) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: logEntry.level || 'info',
            event: logEntry.event || 'general',
            userId: logEntry.userId || 'system',
            message: logEntry.message || '',
            requestId: logEntry.requestId || 'N/A',
            duration_ms: logEntry.duration_ms || 0,
            error_code: logEntry.error_code || null,
            error_message: logEntry.error_message || null,
            stack: logEntry.stack || null
        };

        this.logs.unshift(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }

        // Notify listeners (Debugger/Metrics)
        this.onLogListeners.forEach(listener => listener(entry));
        
        // Standard Console Output
        const colors = {
            info: '\x1b[32m', // Green
            error: '\x1b[31m', // Red
            warn: '\x1b[33m', // Yellow
            debug: '\x1b[36m'  // Cyan
        };
        const color = colors[entry.level] || colors.info;
        const reset = '\x1b[0m';
        
        let output = `${color}[${entry.level.toUpperCase()}] ${entry.timestamp} | ${entry.event} | user: ${entry.userId} | ${entry.message}${reset}`;
        if (entry.error_message) output += `\n   Error: ${entry.error_message}`;
        if (entry.stack) output += `\n   Stack: ${entry.stack}`;
        
        console.log(output);
    }

    // Standard API methods
    info(message, meta = {}) {
        this.addLog({ level: 'info', message, ...meta });
    }

    error(message, meta = {}) {
        // Handle error objects directly
        if (message instanceof Error) {
            this.addLog({ 
                level: 'error', 
                message: message.message, 
                error_message: message.message, 
                stack: message.stack,
                ...meta 
            });
        } else {
            this.addLog({ level: 'error', message, ...meta });
        }
    }

    warn(message, meta = {}) {
        this.addLog({ level: 'warn', message, ...meta });
    }

    getLogs() {
        return this.logs;
    }

    onLog(callback) {
        this.onLogListeners.push(callback);
    }
}

const logger = new Logger();
export default logger;
