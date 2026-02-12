# Privacy Policy for Discourse Lab Chrome Extension

**Last Updated:** [Current Date]

## Introduction

Discourse Lab ("we," "our," or "the extension") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard information when you use our Chrome extension.

## Information We Collect

### Data Processed Locally
- **Text Content**: The extension analyzes text you type in text fields on social media platforms (Twitter/X, Facebook, etc.) to detect escalating language.
- **No Data Storage**: All text analysis happens locally in your browser. We do not store, transmit, or save any of your text content.

### Optional Data Logging
- If you choose to enable research data logging, the extension may send anonymized interaction data to a Google Sheets endpoint for research purposes.
- This data includes:
  - Whether escalation was detected (yes/no)
  - Type of escalation detected (if any)
  - Whether you accepted or dismissed the rephrasing suggestion
  - General interaction patterns (not the actual text content)

### API Usage (if configured)
- If you configure the extension to use an AI API (OpenAI), your text may be sent to the configured API service for rephrasing.
- This is processed according to the API provider's privacy policy.
- **Important**: You must provide your own API key. We do not have access to your API credentials.

## How We Use Information

- **Local Processing**: Text analysis occurs entirely in your browser using local pattern matching and/or your configured API.
- **Improving the Extension**: Optional anonymized usage data may be used to improve detection algorithms and user experience.
- **Research Purposes**: If enabled, anonymized data may be used for academic research on online discourse and de-escalation techniques.

## Data Sharing

- We do not sell, trade, or rent your personal information to third parties.
- Text content is never shared with our servers.
- If you configure an API, your text may be sent to that API provider according to their terms.

## Permissions Used

- **storage**: To save your preferences (e.g., whether to enable API, API configuration) and user demographics.
- **host_permissions** (`<all_urls>`): To work across different social media platforms where you may compose messages. Content scripts are automatically injected on all pages to detect and analyze text as you type.

## Your Rights

- You can disable or uninstall the extension at any time.
- You can configure the extension to use only local detection (no API).
- You can disable research data logging if you prefer.

## Security

- All processing happens locally in your browser.
- We do not collect or store your personal information or the content you type.
- If you use an API, ensure your API keys are kept secure.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. The date at the top indicates when it was last revised.

## Contact Us

If you have questions about this Privacy Policy, please contact us at [your-email@example.com]

---

**Note**: This extension is designed to help users communicate more constructively. It does not censor or prevent you from posting—it simply offers alternatives when escalating language is detected.

