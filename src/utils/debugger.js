
import logger from './logger.js';

class AIDebugger {
    constructor() {
        this.lastIssues = [];
        this.systemStatus = 'OK';
        this.recommendations = [];
        
        logger.onLog((entry) => {
            if (entry.level === 'error') {
                this.analyze(entry);
            }
        });
    }

    analyze(log) {
        let issue = null;
        const msg = log.error_message || log.message || "";
        const code = log.error_code || "";

        // 1. Detect Patterns
        if (msg.toLowerCase().includes('timeout')) {
            issue = {
                type: 'NETWORK_TIMEOUT',
                severity: 'HIGH',
                suggestion: "Possible network latency. Suggest enabling keep-alive or increasing axios timeout."
            };
        } else if (code === 'ECONNRESET' || msg.includes('socket hang up')) {
            issue = {
                type: 'CONNECTION_RESET',
                severity: 'MEDIUM',
                suggestion: "Connection closed by peer. Check Facebook API stability or rate limits."
            };
        } else if (msg.includes('SSL') || msg.includes('handshake')) {
            issue = {
                type: 'SSL_ERROR',
                severity: 'CRITICAL',
                suggestion: "TLS/SSL Handshake failure. Ensure no IPv4 forcing and check Hugging Face network settings."
            };
        }

        if (issue) {
            this.addIssue(issue, log);
        }

        // 2. Update System Status
        this.updateStatus();
    }

    addIssue(issue, log) {
        const entry = {
            ...issue,
            timestamp: log.timestamp,
            requestId: log.requestId
        };
        this.lastIssues.unshift(entry);
        if (this.lastIssues.length > 20) this.lastIssues.pop();
        
        if (!this.recommendations.includes(issue.suggestion)) {
            this.recommendations.unshift(issue.suggestion);
        }
    }

    updateStatus() {
        const recentErrors = logger.getLogs().slice(0, 50).filter(l => l.level === 'error').length;
        if (recentErrors > 10) {
            this.systemStatus = 'DOWN';
        } else if (recentErrors > 0) {
            this.systemStatus = 'DEGRADED';
        } else {
            this.systemStatus = 'OK';
        }
    }

    getInfo() {
        return {
            systemStatus: this.systemStatus,
            lastIssues: this.lastIssues,
            recommendations: this.recommendations.slice(0, 5)
        };
    }
}

const aiDebugger = new AIDebugger();
export default aiDebugger;
