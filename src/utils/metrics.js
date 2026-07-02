
import logger from './logger.js';

class Metrics {
    constructor() {
        this.data = {
            total_messages: 0,
            total_success: 0,
            total_failures: 0,
            avg_response_time: 0,
            total_response_time: 0,
            uptime_start: Date.now()
        };

        // Hook into logger to update metrics
        logger.onLog((entry) => {
            if (entry.event === 'message_received') {
                this.data.total_messages++;
            } else if (entry.event === 'send_success') {
                this.data.total_success++;
                this.updateResponseTime(entry.duration_ms);
            } else if (entry.event === 'send_failure') {
                this.data.total_failures++;
            }
        });
    }

    updateResponseTime(ms) {
        if (ms > 0) {
            this.data.total_response_time += ms;
            this.data.avg_response_time = Math.round(this.data.total_response_time / this.data.total_success);
        }
    }

    getMetrics() {
        const success_rate = this.data.total_messages > 0 
            ? ((this.data.total_success / (this.data.total_success + this.data.total_failures || 1)) * 100).toFixed(2) 
            : 100;

        return {
            ...this.data,
            success_rate: parseFloat(success_rate),
            uptime: Math.floor((Date.now() - this.data.uptime_start) / 1000)
        };
    }
}

const metrics = new Metrics();
export default metrics;
