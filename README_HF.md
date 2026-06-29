# 🐺 Okami Bot - Hugging Face Deployment

This bot is optimized for Hugging Face Spaces using Docker.

## Deployment Steps:
1. Create a new **Space** on Hugging Face.
2. Select **Docker** as the SDK.
3. Choose the **Blank** template or upload these files directly.
4. Set the following **Variables/Secrets** in your Space settings:
   - `MONGODB_URI`: Your MongoDB Cloud connection string.
   - `FACEBOOK_ACCESS_TOKEN`: Your Facebook Page Access Token.
   - `FACEBOOK_VERIFY_TOKEN`: Your Webhook Verify Token.
   - `ADMIN_ACTIVATION_KEY`: Key to authorize admin commands.

## Performance Optimization:
- **Event-Driven**: The bot reacts to webhooks instead of polling.
- **Dual-DB**: Persistent data (Users/Manga) is stored in MongoDB, while transient tasks use local SQLite.
- **Image Caching**: Pre-designed templates reduce CPU usage during image generation.

## Port Configuration:
Hugging Face Spaces use port `7860`. The `Dockerfile` is already configured to expose and use this port.
