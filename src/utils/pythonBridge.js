import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PythonBridge {
    static async call(action, params = {}) {
        return new Promise((resolve, reject) => {
            // Use absolute path for bridge.py to avoid issues in different environments
            const bridgePath = path.resolve(__dirname, '../../python_engine/bridge.py');
            const pythonEngineDir = path.resolve(__dirname, '../../python_engine');
            
            const args = [bridgePath, action];
            
            for (const [key, value] of Object.entries(params)) {
                args.push(`--${key}`, value);
            }

            // Railway might use 'python' or 'python3'
            const pythonCmd = process.env.PYTHON_PATH || 'python3';
            logger.info(`[PythonBridge] Executing: ${pythonCmd} ${args.join(' ')}`);
            
            // Note: spawn is from child_process, not global. 
            // The error 'Cannot access process before initialization' was due to using 'process' 
            // as a variable name while it's also a global object.
            const pythonProcess = spawn(pythonCmd, args, { cwd: pythonEngineDir });

            pythonProcess.on('error', (err) => {
                if (err.code === 'ENOENT' && pythonCmd !== 'python') {
                    logger.error(`[PythonBridge] Failed to start python process. '${pythonCmd}' not found. Trying 'python'...`);
                    const fallbackProcess = spawn('python', args, { cwd: pythonEngineDir });
                    
                    fallbackProcess.on('error', (fallbackErr) => {
                        logger.error(`[PythonBridge] Fallback to 'python' also failed: ${fallbackErr.message}`);
                        reject(new Error(`Python not found (tried ${pythonCmd} and python)`));
                    });

                    this._setupProcess(fallbackProcess, resolve, reject);
                } else {
                    logger.error(`[PythonBridge] Process error: ${err.message}`);
                    reject(err);
                }
            });

            this._setupProcess(pythonProcess, resolve, reject);
        });
    }

    static _setupProcess(pythonProcess, resolve, reject) {
        let data = '';
        let error = '';

        pythonProcess.stdout.on('data', (chunk) => {
            data += chunk.toString();
        });

        pythonProcess.stderr.on('data', (chunk) => {
            error += chunk.toString();
        });

        pythonProcess.on('close', (code) => {
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
