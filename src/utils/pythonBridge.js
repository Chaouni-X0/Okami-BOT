import { spawn } from 'child_process';
import path from 'path';
import logger from './logger.js';

export class PythonBridge {
    static async call(action, params = {}) {
        return new Promise((resolve, reject) => {
            const bridgePath = path.resolve('python_engine/bridge.py');
            const args = [bridgePath, action];
            
            for (const [key, value] of Object.entries(params)) {
                args.push(`--${key}`, value);
            }

            logger.info(`[PythonBridge] Executing: python3 ${args.join(' ')}`);
            
            const process = spawn('python3', args, { cwd: path.resolve('python_engine') });
            let data = '';
            let error = '';

            process.stdout.on('data', (chunk) => {
                data += chunk.toString();
            });

            process.stderr.on('data', (chunk) => {
                error += chunk.toString();
            });

            process.on('close', (code) => {
                if (code !== 0) {
                    logger.error(`[PythonBridge] Error: ${error}`);
                    reject(new Error(error || `Process exited with code ${code}`));
                    return;
                }
                try {
                    // Filter out non-JSON output (like logs from python)
                    const lines = data.trim().split('\n');
                    const jsonStr = lines[lines.length - 1];
                    resolve(JSON.parse(jsonStr));
                } catch (e) {
                    logger.error(`[PythonBridge] Parse Error: ${e.message}. Raw data: ${data}`);
                    reject(e);
                }
            });
        });
    }

    static async search(query) {
        return this.call('search', { query });
    }

    static async getDetails(source, url) {
        return this.call('details', { source, url });
    }

    static async downloadChapter(source, title, chapter, url) {
        return this.call('download', { source, title, chapter, url });
    }
}

export default PythonBridge;
