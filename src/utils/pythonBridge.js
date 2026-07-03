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
                args.push(`--${key}`, String(value));
            }

            // Railway might use 'python' or 'python3'
            const pythonCmd = process.env.PYTHON_PATH || 'python3';
            logger.info(`[PythonBridge] Executing: ${pythonCmd} ${args.join(' ')}`);
            
            // Spawn Python process with proper error handling
            const pythonProcess = spawn(pythonCmd, args, { 
                cwd: pythonEngineDir,
                timeout: 60000, // 60 second timeout
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large responses
            });

            let stdout = '';
            let stderr = '';
            let timedOut = false;

            // Set timeout for the entire operation
            const timeout = setTimeout(() => {
                timedOut = true;
                pythonProcess.kill('SIGTERM');
                logger.error(`[PythonBridge] Process timeout after 60s for action: ${action}`);
                reject(new Error(`Python process timeout for action: ${action}`));
            }, 60000);

            pythonProcess.stdout.on('data', (chunk) => {
                stdout += chunk.toString();
            });

            pythonProcess.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
                logger.warn(`[PythonBridge] stderr: ${chunk.toString()}`);
            });

            pythonProcess.on('error', (err) => {
                clearTimeout(timeout);
                
                if (err.code === 'ENOENT') {
                    logger.error(`[PythonBridge] Python executable '${pythonCmd}' not found. Trying 'python'...`);
                    
                    // Fallback to 'python' if python3 not found
                    if (pythonCmd !== 'python') {
                        const fallbackProcess = spawn('python', args, { 
                            cwd: pythonEngineDir,
                            timeout: 60000,
                            maxBuffer: 10 * 1024 * 1024
                        });
                        
                        let fallbackStdout = '';
                        let fallbackStderr = '';

                        fallbackProcess.stdout.on('data', (chunk) => {
                            fallbackStdout += chunk.toString();
                        });

                        fallbackProcess.stderr.on('data', (chunk) => {
                            fallbackStderr += chunk.toString();
                        });

                        fallbackProcess.on('error', (fallbackErr) => {
                            logger.error(`[PythonBridge] Fallback to 'python' also failed: ${fallbackErr.message}`);
                            reject(new Error(`Python not found (tried ${pythonCmd} and python)`));
                        });

                        fallbackProcess.on('close', (code) => {
                            if (code !== 0) {
                                logger.error(`[PythonBridge] Fallback process error: ${fallbackStderr}`);
                                reject(new Error(fallbackStderr || `Process exited with code ${code}`));
                                return;
                            }
                            this._parseOutput(fallbackStdout, resolve, reject);
                        });
                    } else {
                        reject(new Error(`Python not found`));
                    }
                } else {
                    logger.error(`[PythonBridge] Process error: ${err.message}`);
                    reject(err);
                }
            });

            pythonProcess.on('close', (code) => {
                clearTimeout(timeout);
                
                if (timedOut) {
                    return; // Already rejected in timeout handler
                }

                if (code !== 0) {
                    logger.error(`[PythonBridge] Process exited with code ${code}`);
                    logger.error(`[PythonBridge] stderr: ${stderr}`);
                    logger.error(`[PythonBridge] stdout: ${stdout}`);
                    reject(new Error(stderr || `Process exited with code ${code}`));
                    return;
                }

                this._parseOutput(stdout, resolve, reject);
            });
        });
    }

    static _parseOutput(data, resolve, reject) {
        try {
            if (!data || data.trim().length === 0) {
                logger.error(`[PythonBridge] Empty output from Python process`);
                reject(new Error('Empty output from Python process'));
                return;
            }

            // Find the last line that looks like JSON
            const lines = data.trim().split('\n');
            let jsonStr = '';
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i].trim();
                if (line.startsWith('{') && line.endsWith('}')) {
                    jsonStr = line;
                    break;
                }
            }
            
            if (!jsonStr) {
                logger.error(`[PythonBridge] No JSON output found in: ${data}`);
                reject(new Error('No valid JSON output from Python process'));
                return;
            }

            const result = JSON.parse(jsonStr);
            resolve(result);
        } catch (e) {
            logger.error(`[PythonBridge] Parse Error: ${e.message}`);
            logger.error(`[PythonBridge] Raw data: ${data}`);
            reject(new Error(`Failed to parse Python output: ${e.message}`));
        }
    }

    static async search(query) {
        if (!query || query.trim().length === 0) {
            throw new Error('Search query cannot be empty');
        }
        return this.call('search', { query: query.trim() });
    }

    static async getDetails(source, url) {
        if (!source || !url) {
            throw new Error('Source and URL are required');
        }
        return this.call('details', { source, url });
    }

    static async downloadChapter(source, title, chapter, url) {
        if (!source || !title || !chapter || !url) {
            throw new Error('Source, title, chapter, and URL are required');
        }
        return this.call('download', { source, title, chapter, url });
    }
}

export default PythonBridge;
