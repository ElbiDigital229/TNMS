# Mobile App (Android)

## Repository

Separate repo: `ElbiDigital229/TNMS-Mobile.git`

## Architecture

The mobile app is an Android WebView wrapper that loads the web application. It provides:
- Native Android shell with app icon and splash
- Full-screen WebView pointing to the hosted web app
- Firebase Cloud Messaging integration for push notifications
- Device token registration with the backend

## Key Files

### MainActivity.java
- Sets up WebView with JavaScript enabled
- Configures WebView settings (DOM storage, file access, etc.)
- `SwipeRefreshLayout` is **disabled** (`setEnabled(false)`) to prevent pull-to-refresh conflicts with the web app's own scrolling
- Handles back button navigation within the WebView

### Push Notifications
- Firebase messaging service receives push notifications
- Device token registered with backend on app start
- Token sent via `POST /api/notifications/device-token`
- Token removed on logout via `DELETE /api/notifications/device-token`

## Build

### Prerequisites
- JDK 17 (`brew install openjdk@17`)
- Android SDK (`brew install --cask android-commandlinetools`)
- Gradle 8.2 (wrapper included)

### Build Debug APK
```bash
cd /path/to/TNMS-Mobile
./gradlew assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`

## Known Considerations

- **Scroll behavior**: SwipeRefreshLayout must be disabled to prevent page reload on scroll-up. The web app handles its own scroll with `overscroll-behavior-y: contain` on html/body.
- **Status bar**: Uses `apple-mobile-web-app-status-bar-style` meta tag for dark status bar
- **Navigation**: Bottom tab bar in the web app is styled with dark navy background for contrast on mobile
