# ZotCraft 📚✨

> Automatically sync your Zotero research library to Craft Docs with AI-powered summaries

ZotCraft is an integration tool that bridges your Zotero research collection with Craft's note-taking environment. It is designed to work with the [ZotCraft Template](https://donkeys-melt-ig1.craft.me/Zotcraft-template). 


## ✨ Features

- 🔄 **Automatic Synchronization** - Set it and forget it with configurable auto-sync intervals
- 📂 **Collection Support** - Select specific Zotero collections and target Craft collections
- 🏷️ **Smart Tagging** - Automatically convert Zotero tags to Craft-style hashtags (#machine_learning)
- 🎨 **Rich Formatting** - Create structured notes with metadata, abstracts, and summaries
- 💾 **State Management** - Prevents duplicate imports with intelligent tracking
- ⚡ **Real-time Updates** - Monitor sync progress with live activity logs

## 🚀 Getting Started

### Prerequisites

- [Zotero](https://www.zotero.org/) account with API access
- [Craft](https://www.craft.do/) account with API access

### Installation

1. Clone the repository:
```bash
git clone https://github.com/feldaher/zotcraft.git
cd zotcraft
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## ⚙️ Configuration

### 1. Zotero Setup

1. Get your **User ID**: Found in Zotero Settings → Feeds/API
2. Create an **API Key**: [Zotero API Settings](https://www.zotero.org/settings/keys)
3. Select your source **Collection** from the dropdown (or enter the ID manually)

### 2. Craft Setup

1. Create a **Document API**: In Craft, go to Imagine → Create new document API (you need a document with a Collection block first)
2. **Copy your API URL**: It looks like `https://connect.craft.do/links/YOUR_LINK_ID/api/v1`
3. **Paste it** in the Craft configuration field - the Link ID will be automatically extracted
4. Choose your target **Collection** from the dropdown
5. (Optional) Provide a **Parent Document ID** for sub-page fallback

### 3. Auto-Sync

Enable automatic synchronization with customizable intervals:
- 1 minute
- 5 minutes
- 15 minutes
- 30 minutes
- 1 hour

**Note:** The browser tab must remain open for auto-sync to function.

## 📖 Usage

### Manual Sync

1. Configure your connections in the **Connections** panel
2. Click **Test Connections** to verify your credentials
3. Click **Sync Now** to start the synchronization

The **Activity Log** will display real-time progress:
- ✅ **Created**: Successfully imported items
- ⏭️ **Skipped**: Previously processed items
- ❌ **Error**: Failed imports with details

### Auto-Sync

1. Enable **Auto-Sync** in the settings
2. Select your preferred **Interval**
3. Monitor the **Next Sync** and **Last Sync** timestamps

## 🎯 How It Works

1. **Fetch**: Retrieves new items from your selected Zotero collection (up to 50 items)
2. **Format**: Converts metadata and tags to Craft-compatible format
3. **Create**: Adds items to your target Craft collection or document
4. **Track**: Updates sync state to prevent duplicates

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with TypeScript
- **Styling**: Tailwind CSS
- **APIs**: Zotero API, Craft API
- **State**: localStorage + server-side JSON

## 📝 Configuration Storage

All settings (API keys, collection IDs, preferences) are stored in your browser's `localStorage`. This means:
- ✅ Your credentials stay private and local
- ✅ No backend authentication required
- ⚠️ Settings are browser-specific (not synced across devices)
- ⚠️ Clearing browser data will reset your configuration

## 🚢 Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/feldaher/zotcraft)

**Note:** The sync state (`state.json`) is ephemeral on Vercel. For persistent state, run locally or implement a database solution.

### Local Development

```bash
npm run dev    # Development
npm run build  # Production build
npm start      # Production server
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this project for your research workflow!

## 🙏 Acknowledgments

- [Zotero](https://www.zotero.org/) for the powerful research management platform
- [Craft](https://www.craft.do/) for the beautiful note-taking experience

## 📧 Support

Having issues? Please [open an issue](https://github.com/feldaher/zotcraft/issues) on GitHub.

---

**Made with ❤️ for students, researchers and academics**
