# 🐺 Okami Bot - Ultimate Facebook Manga Automation Engine

Okami Bot is a professional, high-performance, and resource-efficient automation system designed for manga and manhwa publishing on Facebook. It leverages a dual-database architecture and an event-driven design specifically optimized for cloud environments such as **Hugging Face Spaces**. The system is built to handle large-scale community interactions while maintaining a low resource footprint.

## 🚀 Key Innovations and Architecture

The project utilizes a **Dual-Database Architecture** to balance persistence and performance. Persistent community data, including user profiles, levels, XP, and global manga metadata, is stored in **MongoDB Cloud**. Meanwhile, high-frequency transient tasks such as chapter download queues and processing states are handled by a local **SQLite** database. This separation ensures that critical data remains safe while transient operations are executed with maximum speed.

Okami Bot follows an **Event-Driven Execution** model, moving away from continuous polling and resource-heavy cron jobs. Features like points calculation, leaderboard generation, and event triggers are activated only when specific user conditions are met. This on-demand approach drastically reduces CPU and memory consumption, making it ideal for ephemeral storage environments like Hugging Face.

| Component | Technology | Primary Function |
| :--- | :--- | :--- |
| **Persistence** | MongoDB | User Profiles, Guilds, Manga Metadata |
| **Transient State** | SQLite | Chapter Queues, Processing Logs |
| **Visuals** | Canvas/Sharp | Dynamic Card Generation |
| **Hosting** | Docker | Hugging Face Spaces Compatibility |

## 🎨 Advanced Visual Engine and Scraper

The **Visual Engine** is designed with a dark anime wolf theme, featuring neon purple accents and minimalist aesthetics. Instead of heavy AI rendering at runtime, the bot uses optimized local templates to generate professional user profiles, leaderboard rankings, and reward notices. An aggressive cleanup mechanism ensures that temporary images are wiped from storage immediately after posting, maintaining a lean environment.

The **Smart Scraping Engine** provides comprehensive support for the most popular Arabic manga platforms. It is built to be resilient against website layout changes and is compatible with various themes such as Madara and MangaStream.

| Supported Source | Description |
| :--- | :--- |
| **G-Manga** | Direct API integration for fast and reliable updates |
| **Azora Manga** | Full support for one of the largest Arabic manga libraries |
| **Manga Arab** | Optimized scraping for high-traffic Arabic manga content |
| **Madara Themes** | Universal compatibility with standard manga site layouts |

## 📊 Interactive Dashboard and Management

Okami Bot features a professional **Interactive Dashboard** accessible directly via the web interface. This dashboard allows administrators to:
- **Execute Commands**: Use the `/` command system to search for manga, check stats, or trigger maintenance.
- **Global Search**: Search for any manga by name across all supported Arabic sources simultaneously.
- **Real-time Console**: Monitor system logs and command outputs directly from the browser.
- **API Management**: The system automatically detects when a source requires an API key and notifies the developer via the dashboard console.

To deploy Okami Bot on **Hugging Face Spaces**, users should create a Space with the Docker SDK and configure the necessary environment variables. The system is pre-configured to bind to port 7860 and handle Facebook Webhook responses within one second to prevent timeout loops.

| Variable | Required Value |
| :--- | :--- |
| `FB_ACCESS_TOKEN` | Facebook Page Access Token |
| `FB_PAGE_ID` | Your Facebook Page ID |
| `FACEBOOK_VERIFY_TOKEN` | Webhook verification token |
| `MONGODB_URI` | Connection string for MongoDB Cloud |
| `ADMIN_ACTIVATION_KEY` | Key for administrative commands |

Okami Bot fosters a competitive community through its **Gamification System**. Users can progress through ranks from *Otaku Beginner* to the ultimate *Okami King 🐺*. The integrated **Guild System** allows fans to form teams and compete for weekly leaderboard dominance, while the **Streak Engine** rewards consistent engagement and reading.

---
✨ **Developed by Manus** - The most advanced solution for automated manga communities. ✨
