# Campus Dual Cal Web Applet

A local web application designed to synchronize your university schedule from the Campus Dual legacy portal to your Google Calendar or export it directly as an `.ics` calendar file.

## ⚠️ Important Note
This application runs **locally** on your computer. All configuration and synchronization data are stored strictly on your local filesystem and are never transmitted to any external servers other than those required for the optional official Google Calendar API integration.

---

## Setup Instructions

### 1. Prerequisites
* Node.js installed on your machine.
* Python installed on your machine.

### 2. Installation & Execution
1. Clone or download this repository to your local machine.
2. Navigate to the project root directory in your terminal.
3. Execute the setup and bootstrapper sequence:

```bash
npm install
npm audit fix --force
npm start
```

Once started, the web application is accessible locally via your browser at **http://localhost:3000**.

---

## Output Files: Google Calendar compatible (.json) & iCalendar (.ics) Export

Upon processing your schedule, the app generates two output files:

1. **`clean_standardized_calendar.json`** ~ Formatted event payload used for optional Google Calendar sync.
2. **`campus_dual_calendar.ics`** ~ A standard iCalendar file that can be directly imported into any iCalendar-compatible app (such as Apple Calendar, Outlook, Thunderbird, or Google Calendar).

> **💡 Recommended Import Strategy:**  
> When you want to import the `.ics` file manually into your calendar app or feed the `.json` file to Google Calendar, it is strongly recommended to use a **separate dedicated sub-calendar** (e.g. "Campus Dual") for iCalendar-compatible apps this allows you to easily delete/scrub that entire sub-calendar whenever you need to re-import a freshly generated schedule. As for Google Calendar the uploader automatically scrubs the calendar before re-uploading.

---

## Google Calendar Upload Requirements

If you want to use the optional **Google Calendar upload/synchronization** feature so as to have your schedule available on your handheld device, two additional configuration steps are required:

### 1. Add Your Google Calendar ID  
Enter the **Google Calendar ID** of the sub‑calendar you want the app to write to.
*Note: It is recommended to create a separate sub-calendar for this purpose, because the uploader will **clear/reset** the calendar upon upload.*

Example configuration layout:

```json
{
    "campus_dual": {
        "student_id": "1234567",
        "browser": "chrome",
        "start_date": "2026-04-20",
        "end_date": "2026-07-12"
    },
    "google_calendar": {
        "calendar_id": "your-uni-cal-id@group.calendar.google.com"
    }
}
```

### 2. Provide Google OAuth Credentials  
Download your Google OAuth `credentials.json` from the Google Cloud Console and place it **directly in the project’s root directory** (in the same folder where `config.json` is located).

This file is required for the app to authenticate with your Google account and gain permission to upload events.

---

## Additional Information
**Configuration:** Please ensure your configuration file contains your student ID, target browser session, date ranges, and Google Calendar ID.