# Okami Bot - Complete Setup Guide

## 🚀 Quick Start

### Local Development

#### Prerequisites
- Node.js 22+ 
- Python 3.8+
- npm or yarn
- Git

#### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Chaouni-X0/Okami-BOT.git
   cd Okami-BOT
   ```

2. **Install Node dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies**
   ```bash
   pip3 install -r python_engine/requirements.txt
   ```

4. **Create data directories**
   ```bash
   mkdir -p data/temp logs
   ```

5. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

### Railway Deployment

See [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) for detailed instructions.

## 📋 Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=8080
NODE_ENV=production
PYTHON_PATH=python3

# Facebook Configuration
PAGE_ACCESS_TOKEN=your_facebook_page_token
FB_PAGE_ID=your_facebook_page_id
VERIFY_TOKEN=your_webhook_verify_token

# Admin Configuration
ADMIN_PASSWORD=your_admin_activation_key

# Database (Optional)
MONGODB_URI=mongodb://localhost:27017/okami

# Data Directory
DATA_DIR=./data
```

## 🔧 Configuration

### Sources Configuration

Edit `src/config/config.js` to add or modify manga sources:

```javascript
sources: [
    { id: 'mangaarab', name: 'مانجا عرب', url: 'https://mangaarab.com', type: 'wp-manga' },
    // Add more sources here
]
```

### Logger Configuration

Logs are stored in `logs/` directory. Configure logging in `src/utils/logger.js`.

## 🐛 Troubleshooting

### Issue: "Python not found"

**Solution:**
```bash
# Check Python installation
python3 --version

# Set PYTHON_PATH environment variable
export PYTHON_PATH=/usr/bin/python3
npm start
```

### Issue: "Search returns no results"

**Possible causes:**
1. Website is down or changed structure
2. Network connectivity issue
3. Rate limiting from website

**Solutions:**
- Check website directly in browser
- Verify network connectivity: `ping mangaarab.com`
- Wait a few minutes and try again
- Check logs: `tail -f logs/okami.log`

### Issue: "Webhook not receiving messages"

**Solutions:**
1. Verify webhook URL is correct and accessible
2. Check VERIFY_TOKEN matches Facebook settings
3. Ensure PAGE_ACCESS_TOKEN is valid
4. Check firewall/network settings

```bash
# Test webhook endpoint
curl -X GET "http://localhost:8080/webhook?hub.mode=subscribe&hub.verify_token=your_token&hub.challenge=test"
```

### Issue: "Python bridge timeout"

**Solutions:**
1. Increase timeout in `src/utils/pythonBridge.js`
2. Check if website is responding slowly
3. Verify network connectivity
4. Check system resources

### Issue: "Memory leak or high CPU usage"

**Solutions:**
1. Restart the bot: `npm start`
2. Check for infinite loops in scrapers
3. Monitor process: `ps aux | grep node`
4. Check logs for errors

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:8080/status
```

Expected response:
```json
{
  "status": "online",
  "project": "🐺 Okami Bot (Railway Optimized)",
  "version": "2.0.0"
}
```

### View Logs

```bash
# Real-time logs
tail -f logs/okami.log

# Search for errors
grep "ERROR" logs/okami.log

# Search for specific source
grep "MangaArab" logs/okami.log
```

## 🔐 Security

1. **Never commit `.env` files**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Validate all inputs**
   - Bot validates all user inputs
   - Sanitize database queries

3. **Use HTTPS for webhooks**
   - Railway provides automatic HTTPS
   - Never use HTTP in production

4. **Rate limiting**
   - Implement rate limiting for API endpoints
   - Prevent abuse of search functionality

## 📦 Project Structure

```
Okami-BOT/
├── src/
│   ├── config/          # Configuration files
│   ├── database/        # Database setup
│   ├── modules/         # Core modules
│   ├── services/        # Business logic
│   ├── utils/           # Utilities
│   └── index.js         # Entry point
├── python_engine/
│   ├── core/            # Core Python classes
│   ├── scrapers/        # Website scrapers
│   ├── utils/           # Python utilities
│   ├── bridge.py        # Node-Python bridge
│   └── requirements.txt # Python dependencies
├── data/                # Data storage
│   └── temp/            # Temporary files
├── logs/                # Application logs
├── Dockerfile           # Docker configuration
├── railway.json         # Railway configuration
├── package.json         # Node dependencies
└── README.md            # Documentation
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 Adding New Scrapers

1. Create new scraper in `python_engine/scrapers/`
2. Extend `BaseScraper` class
3. Implement required methods:
   - `search(query)`
   - `get_manga_info(url)`
   - `get_chapters(url)`
   - `get_chapter_images(url)`
4. Register in `python_engine/bridge.py`

Example:
```python
from core.base_scraper import BaseScraper

class NewSiteScraper(BaseScraper):
    async def search(self, query):
        # Implementation
        pass
```

## 📚 API Endpoints

### Health Check
```
GET /status
```

### Webhook (Facebook Messenger)
```
GET /webhook - Verification
POST /webhook - Message handling
```

## 🚨 Error Handling

The bot includes comprehensive error handling:
- Timeout protection for searches
- Fallback Python executables
- Graceful degradation
- Detailed logging

## 📞 Support

For issues and questions:
1. Check this guide
2. Review logs
3. Check GitHub issues
4. Open a new issue with details

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with Node.js and Python
- Uses Express.js for HTTP server
- BeautifulSoup for web scraping
- Railway for hosting

---

**Last Updated:** July 2, 2026
**Version:** 2.0.0
