# Okami Bot - Railway Deployment Guide

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository with the bot code
- Facebook Developer App with Messenger API access
- Facebook Page with access token

## Environment Variables Required

Set these variables in your Railway project:

| Variable | Description | Example |
|----------|-------------|---------|
| `ADMIN_PASSWORD` | Admin activation key for developer mode | `your-secret-key` |
| `FB_ACCESS_TOKEN` / `PAGE_ACCESS_TOKEN` | Facebook Page Access Token | `EAABs...` |
| `FB_PAGE_ID` | Facebook Page ID | `123456789` |
| `FB_VERIFY_TOKEN` / `VERIFY_TOKEN` | Webhook verification token | `your-verify-token` |
| `PORT` | Server port (default: 8080) | `8080` |
| `NODE_ENV` | Environment (production/development) | `production` |
| `MONGODB_URI` / `MONGO_URI` | MongoDB Connection URI | `mongodb+srv://...` |
| `DATA_DIR` | Data directory path | `./data` |

## Deployment Steps

### 1. Connect GitHub Repository
1. Go to Railway dashboard
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Choose the Okami-BOT repository
5. Click "Deploy"

### 2. Configure Environment Variables
1. In Railway project settings, go to "Variables"
2. Add all required environment variables
3. Save changes

### 3. Configure Webhook in Facebook
1. Go to your Facebook App settings
2. In Messenger settings, set Webhook URL to:
   ```
   https://your-railway-app-url.up.railway.app/webhook
   ```
3. Set Verify Token to the value you set in `VERIFY_TOKEN`
4. Subscribe to message_received and messaging_postbacks events

### 4. Monitor Deployment
1. Check Railway logs in real-time
2. Verify the app is running with `/status` endpoint
3. Test with a message to your Facebook page

## Troubleshooting

### Python Not Found Error
- Ensure Dockerfile is being used (check Railway build settings)
- Verify Python is installed in the container
- Check logs for Python path issues

### Search Not Working
- Verify Python dependencies are installed
- Check if websites are accessible from Railway servers
- Review Python bridge logs for scraper errors

### Webhook Not Receiving Messages
- Verify Facebook token is correct
- Check webhook URL is accessible
- Ensure VERIFY_TOKEN matches Facebook settings

### Memory/Performance Issues
- Check Railway resource limits
- Monitor Python process memory usage
- Consider upgrading Railway plan if needed

## Logs and Debugging

View logs in Railway:
```bash
# Real-time logs
railway logs -f

# Search for specific errors
railway logs | grep "error"
```

## Health Check

The app includes a health check endpoint:
```bash
curl https://your-railway-app-url.up.railway.app/health
```

Expected response:
```json
{
  "status": "online",
  "project": "🐺 Okami Bot",
  "version": "7.0.0 (Node-Only Optimized)"
}
```

## Performance Tips

1. **Database**: Use Railway's built-in PostgreSQL for better performance
2. **Caching**: Implement caching for frequently searched manga
3. **Rate Limiting**: Add rate limiting to prevent abuse
4. **Async Processing**: Use queue system for heavy operations

## Security Considerations

1. Never commit `.env` files to GitHub
2. Use Railway's secret management for sensitive data
3. Implement rate limiting on webhook endpoint
4. Validate all incoming Facebook messages
5. Use HTTPS only for webhook

## Updating the Bot

1. Push changes to GitHub
2. Railway will automatically redeploy
3. Monitor logs during deployment
4. Test webhook after deployment

## Support

For issues:
1. Check Railway documentation: https://docs.railway.app
2. Review bot logs in Railway dashboard
3. Check Facebook Messenger API documentation
4. Open an issue on GitHub

## Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Facebook Messenger API](https://developers.facebook.com/docs/messenger-platform)
- [Node.js Best Practices](https://nodejs.org/en/docs/)
- [Python Web Scraping](https://docs.python-requests.org/)
