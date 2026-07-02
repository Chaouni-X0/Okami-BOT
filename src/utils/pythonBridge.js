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

            // Railway might use 'python' or 'python3'
            const pythonCmd = process.env.PYTHON_PATH || 'python3';
            logger.info(`[PythonBridge] Executing: ${pythonCmd} ${args.join(' ')}`);
            
            const process = spawn(pythonCmd, args, { cwd: path.resolve('python_engine') });

            process.on('error', (err) => {
                if (err.code === 'ENOENT') {
                    logger.error(`[PythonBridge] Failed to start python process. '${pythonCmd}' not found. Trying 'python'...`);
                    const fallbackProcess = spawn('python', args, { cwd: path.resolve('python_engine') });
                    this._setupProcess(fallbackProcess, resolve, reject);
                } else {
                    reject(err);
                }
            });

            this._setupProcess(process, resolve, reject);
        });
    }

    static _setupProcess(process, resolve, reject) {
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
                const lines = data.trim().split('\n');
                const jsonStr = lines[lines.length - 1];
                resolve(JSON.parse(jsonStr));
            } catch (e) {
                logger.error(`[PythonBridge] Parse Error: ${e.message}. Raw data: ${data}`);
                reject(e);
            }
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
