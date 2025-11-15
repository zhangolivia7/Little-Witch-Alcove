# Setting Up Your Gemini API Key Securely

Your API key is now stored securely in Chrome's local storage instead of being hardcoded in the files. This prevents accidentally committing your key to version control.

## Quick Setup

### Option 1: Using Chrome DevTools Console (Recommended)

1. Open your extension popup
2. Right-click anywhere in the popup and select "Inspect" (or press F12)
3. Go to the "Console" tab
4. Run this command (replace `YOUR_API_KEY_HERE` with your actual key):

```javascript
chrome.storage.local.set({ geminiApiKey: 'YOUR_API_KEY_HERE' })
```

5. You should see `undefined` returned (that's normal)
6. Reload the extension to apply changes

### Option 2: Using Background Script Console

1. Go to `chrome://extensions/`
2. Find "Little Witch Alcove" extension
3. Click "service worker" or "background page" link
4. In the console that opens, run:

```javascript
chrome.storage.local.set({ geminiApiKey: 'YOUR_API_KEY_HERE' })
```

### Option 3: Verify Your Key is Set

To check if your key is stored correctly:

```javascript
chrome.storage.local.get(['geminiApiKey'], (result) => {
  console.log('API Key stored:', result.geminiApiKey ? 'Yes (hidden for security)' : 'No');
});
```

## Getting Your API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key" or use an existing one
4. Copy the key (it starts with `AIza...`)

## Security Notes

✅ **Good practices:**
- Your API key is now stored in Chrome's encrypted local storage
- It won't be committed to git if you have a `.gitignore` file
- The key is only accessible by your extension

⚠️ **Important:**
- Never share your API key publicly
- Don't commit it to version control
- If you accidentally share it, revoke it in Google AI Studio and create a new one
- Consider setting API key restrictions in Google Cloud Console

## Troubleshooting

If productivity checking isn't working:
1. Check the background script console for errors
2. Verify your API key is set using Option 3 above
3. Make sure you've reloaded the extension after setting the key
4. Check that your API key has the correct permissions in Google Cloud Console

